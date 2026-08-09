#!/usr/bin/env python3
"""Считает пороги по корпусу автора и кладёт их в baseline.json.

Проблема прежних порогов была не в значениях, а в способе их получить: они
подобраны на глаз. Плотность длинных тире 2.5 на 100 слов срабатывала на любом
тексте автора, который пользуется тире как родным знаком, — тэлл горел всегда и
информации не нёс.

Правильная норма — своя. Прогоняешь скрипт по своему архиву, получаешь
распределение метрик и берёшь пороги как перцентили: тревога срабатывает там,
где текст выбивается из собственного корпуса, а не из чужого представления о
норме.

Оговорка, которую надо держать в голове: корпус — это то, что автор уже
опубликовал, а не эталон человеческого письма. Если половина архива писалась с
моделью, пороги унаследуют её привычки. Скрипт даёт норму «как обычно у меня»,
и это полезнее выдуманной нормы, но эталоном не является.

Использование:
  calibrate.py <каталог>                 обойти *.md рекурсивно, показать сводку
  calibrate.py <каталог> --write         записать baseline.json рядом со скриптом
  calibrate.py <каталог> --glob '*.txt'  другая маска

Зависимостей нет, Python 3.9+.
"""

import json
import re
import statistics
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import rutext  # noqa: E402
import scan_rhythm  # noqa: E402
import scan_tells  # noqa: E402

BASELINE_PATH = Path(__file__).resolve().parent / 'baseline.json'

MIN_WORDS = 200  # короткие тексты дают шумные метрики, в норму не берём

# Метрики ритма: с какой стороны ставим порог и на каком перцентиле.
RHYTHM_RULES = {
    'sent_cv':        ('lo', 10),
    'para_cv':        ('lo', 10),
    'short_share':    ('lo', 10),
    'long_share':     ('lo', 10),
    'flat_run':       ('hi', 90),
    'noun_verb':      ('hi', 90),
    'listicle_share': ('hi', 90),
}

# Перцентиль для порогов агрегатных тэллов: срабатываем на верхней десятине
# собственного корпуса.
RATE_PERCENTILE = 90


def percentile(values, p):
    """Линейная интерполяция между соседними значениями отсортированного ряда."""
    if not values:
        return 0.0
    ordered = sorted(values)
    if len(ordered) == 1:
        return float(ordered[0])
    k = (len(ordered) - 1) * p / 100
    lo = int(k)
    hi = min(lo + 1, len(ordered) - 1)
    frac = k - lo
    return ordered[lo] + (ordered[hi] - ordered[lo]) * frac


def rate_of(code, rx, prose_only, stripped, prose, words, prose_words):
    haystack, base = (prose, prose_words) if prose_only else (stripped, words)
    if not base:
        return None
    return len(rx.findall(haystack)) / base * 100


def collect(paths):
    """Собирает по каждому файлу: плотность тэллов, частоты и метрики ритма."""
    densities = []
    rates = {code: [] for code, *_ in scan_tells.RATE_TELLS}
    rhythm = {key: [] for key in RHYTHM_RULES}
    used = []

    for path in paths:
        try:
            raw = path.read_text(encoding='utf-8')
        except (OSError, UnicodeDecodeError):
            continue

        stripped = rutext.strip_markdown(raw)
        prose = rutext.prose_text(stripped)
        words = rutext.word_count(stripped)
        prose_words = rutext.word_count(prose)
        if words < MIN_WORDS:
            continue

        used.append(path)
        densities.append(scan_tells.scan(raw)['density'])

        for code, _desc, rx, _t, _w, prose_only in scan_tells.RATE_COMPILED:
            value = rate_of(code, rx, prose_only, stripped, prose, words, prose_words)
            if value is not None:
                rates[code].append(value)

        stats = scan_rhythm.measure(raw)
        for key in RHYTHM_RULES:
            if key in stats:
                rhythm[key].append(stats[key])

    return used, densities, rates, rhythm


def build_baseline(densities, rates, rhythm):
    rate_thresholds = {}
    for code, values in rates.items():
        if not values:
            continue
        # Порог не ниже медианы: если тэлл встречается у автора повсеместно,
        # ставить порог по нулю бессмысленно — он будет гореть всегда.
        rate_thresholds[code] = round(max(percentile(values, RATE_PERCENTILE),
                                          percentile(values, 50)), 2)

    rhythm_thresholds = {}
    for key, (side, p) in RHYTHM_RULES.items():
        values = rhythm.get(key) or []
        if len(values) < 5:
            continue
        rhythm_thresholds[key] = {side: round(percentile(values, p), 3)}

    # Полосы вердикта привязаны к собственному разбросу: «чисто» — то, что
    # укладывается в девять десятых корпуса, дальше кратные ступени.
    clean = round(percentile(densities, 90), 2) if densities else 1.5
    clean = max(clean, 0.5)
    bands = [[clean, 'чисто'],
             [round(clean * 3, 2), 'следы есть, точечная правка'],
             [round(clean * 8, 2), 'заметно, нужна переработка']]

    return {
        'corpus_files': len(densities),
        'density_median': round(statistics.median(densities), 2) if densities else 0.0,
        'density_p90': clean,
        'bands': bands,
        'rate_thresholds': rate_thresholds,
        'rhythm': rhythm_thresholds,
    }


def summary(baseline, densities, rhythm):
    print(f'Файлов в корпусе: {baseline["corpus_files"]} '
          f'(короче {MIN_WORDS} слов пропущены)')
    if densities:
        print(f'Плотность тэллов: медиана {baseline["density_median"]}, '
              f'p90 {baseline["density_p90"]}, максимум {max(densities):.2f}')
    print('\nПолосы вердикта:')
    for limit, label in baseline['bands']:
        print(f'   < {limit:<6} {label}')
    print(f'   ≥ {baseline["bands"][-1][0]:<6} {scan_tells.WORST_BAND}')

    print('\nПороги агрегатных тэллов (на 100 слов):')
    for code, value in sorted(baseline['rate_thresholds'].items()):
        old = dict((c, t) for c, _d, _r, t, _w, _p in scan_tells.RATE_TELLS)[code]
        mark = ' ←' if abs(value - old) > 0.05 else ''
        print(f'   {code:<4} {value:>6}   (было {old}){mark}')

    print('\nПороги ритма:')
    for key, rule in sorted(baseline['rhythm'].items()):
        side, value = next(iter(rule.items()))
        values = rhythm.get(key) or []
        word = 'не ниже' if side == 'lo' else 'не выше'
        median = statistics.median(values) if values else 0
        print(f'   {scan_rhythm.LABELS.get(key, key):<38} {word} {value} '
              f'(медиана корпуса {median:.3f})')


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if not args or '--help' in sys.argv or '-h' in sys.argv:
        print(__doc__)
        return

    pattern = '*.md'
    for i, a in enumerate(sys.argv):
        if a == '--glob' and i + 1 < len(sys.argv):
            pattern = sys.argv[i + 1]

    root = Path(args[0]).expanduser()
    if not root.is_dir():
        print(f'ошибка: не каталог: {root}', file=sys.stderr)
        sys.exit(1)

    paths = sorted(p for p in root.rglob(pattern) if p.is_file())
    if not paths:
        print(f'ошибка: по маске {pattern} ничего не найдено в {root}', file=sys.stderr)
        sys.exit(1)

    used, densities, rates, rhythm = collect(paths)
    if len(used) < 5:
        print(f'ошибка: пригодных файлов {len(used)}, для порогов нужно хотя бы 5',
              file=sys.stderr)
        sys.exit(1)

    baseline = build_baseline(densities, rates, rhythm)
    summary(baseline, densities, rhythm)

    if '--write' in sys.argv:
        BASELINE_PATH.write_text(
            json.dumps(baseline, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print(f'\nЗаписано: {BASELINE_PATH}')
    else:
        print('\n(не записано — добавь --write)')


if __name__ == '__main__':
    main()
