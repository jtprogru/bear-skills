#!/usr/bin/env python3
"""Инструмент для agentops-compress: детект, бэкап и валидация memory-файлов.

Зачем отдельный скрипт, а не работа модели: детект типа файла, снятие бэкапа и
проверка сохранности якорей — механические операции. Если их делает модель, они
стоят токенов на каждом прогоне и иногда ошибаются. Здесь они стоят ноль токенов
и не ошибаются никогда.

Подкоманды:
  detect <файл>              тип файла, размер, оценка токенов, число якорей
  backup <файл>              копия в $XDG_DATA_HOME/bear-skills/compress-backups
  validate <ориг> <сжатый>   какие якоря потерялись при сжатии

Зависимостей нет, Python 3.8+.
"""

import hashlib
import json
import os
import re
import shutil
import sys
import time
from pathlib import Path

# ─────────────────────────────────────────────────────────────────────────────
# Якоря — фрагменты, которые обязаны пережить сжатие дословно.
#
# Сжатие переписывает формулировки, и это нормально. Ненормально — когда вместе
# с водой уходит путь к файлу, флаг команды или имя переменной: такой текст
# выглядит целым, но перестаёт работать как инструкция.
# ─────────────────────────────────────────────────────────────────────────────

ANCHOR_PATTERNS = [
    # Пути: ~/.claude/rules/foo.md, domains/git/, ./bin/cli.js
    (r'(?:^|[\s`"\'(])((?:~|\.{1,2})?/[\w.@/-]+\.\w+|(?:[\w.-]+/){2,}[\w.-]*)', 'path'),
    # Команды в бэктиках: `git push --force`, `make check`
    (r'`([^`\n]{2,80})`', 'code'),
    # Переменные окружения: BEAR_VAULT, $HOME, ${CLAUDE_HOME}
    (r'\$?\{?\b([A-Z][A-Z0-9_]{2,})\b\}?', 'env'),
    # URL
    (r'(https?://[^\s)\]]+)', 'url'),
    # Числа со смыслом: 1500 символов, 15 минут, v0.3.0
    (r'\b(v?\d+(?:\.\d+){1,2}|\d{2,})\b', 'number'),
]

FILE_TYPES = [
    ('claude-md', lambda p, t: p.name in ('CLAUDE.md', 'AGENTS.md', 'GEMINI.md')),
    ('rule', lambda p, t: '/rules/' in str(p) or p.parent.name == 'rules'),
    ('skill', lambda p, t: p.name == 'SKILL.md'),
    ('todo', lambda p, t: bool(re.search(r'^\s*[-*]\s*\[[ x]\]', t, re.M))),
    ('preferences', lambda p, t: 'preference' in p.name.lower()),
    ('memory', lambda p, t: True),
]


def extract_anchors(text):
    """Множество якорей. Комментарии-заглушки и разметку отсеиваем."""
    found = set()
    for pattern, kind in ANCHOR_PATTERNS:
        for m in re.finditer(pattern, text, re.M):
            value = m.group(1).strip()
            if len(value) < 2:
                continue
            # Служебные слова в верхнем регистре — не переменные окружения.
            if kind == 'env' and value in {
                'TODO', 'NOTE', 'WARNING', 'IMPORTANT', 'FIXME', 'API', 'CLI',
                'URL', 'JSON', 'YAML', 'HTTP', 'HTTPS', 'PARA', 'MOC', 'SRE',
                'TLDR', 'SLO', 'ADR', 'RFC', 'PKB', 'AI', 'CI', 'PR', 'SDK',
            }:
                continue
            found.add((kind, value))
    return found


def estimate_tokens(text):
    """Грубая оценка: ~3.3 символа на токен для смеси русского и кода.

    Это порядок величины для «стоит ли вообще сжимать», а не биллинг.
    Точное число — только через реальный токенайзер, и в отчётах его
    надо называть оценкой, а не результатом замера.
    """
    return round(len(text) / 3.3)


def detect_type(path, text):
    for name, pred in FILE_TYPES:
        if pred(path, text):
            return name
    return 'memory'


def backup_dir():
    """Бэкапы уезжают out-of-tree намеренно.

    Если положить копию рядом с оригиналом, её подхватит автозагрузчик скиллов
    или memory-файлов — и сжатие увеличит контекст вместо того, чтобы уменьшить.
    """
    base = os.environ.get('XDG_DATA_HOME') or str(Path.home() / '.local' / 'share')
    return Path(base) / 'bear-skills' / 'compress-backups'


def cmd_detect(argv):
    if not argv:
        die('detect: нужен путь к файлу')
    path = Path(argv[0]).expanduser()
    if not path.is_file():
        die(f'не файл: {path}')
    text = path.read_text(encoding='utf-8')
    anchors = extract_anchors(text)
    report = {
        'path': str(path),
        'type': detect_type(path, text),
        'bytes': len(text.encode('utf-8')),
        'lines': text.count('\n') + 1,
        'estimated_tokens': estimate_tokens(text),
        'anchors': len(anchors),
        'anchors_by_kind': {
            k: sum(1 for kind, _ in anchors if kind == k)
            for k in sorted({kind for kind, _ in anchors})
        },
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))


def cmd_backup(argv):
    if not argv:
        die('backup: нужен путь к файлу')
    path = Path(argv[0]).expanduser().resolve()
    if not path.is_file():
        die(f'не файл: {path}')
    dest_dir = backup_dir()
    dest_dir.mkdir(parents=True, exist_ok=True)
    digest = hashlib.sha256(str(path).encode('utf-8')).hexdigest()[:8]
    stamp = time.strftime('%Y%m%d-%H%M%S')
    dest = dest_dir / f'{path.name}.{digest}.{stamp}.bak'
    shutil.copy2(path, dest)
    print(json.dumps({'backup': str(dest), 'source': str(path)}, ensure_ascii=False))


def cmd_validate(argv):
    if len(argv) < 2:
        die('validate: нужны исходный и сжатый файлы')
    src = Path(argv[0]).expanduser()
    dst = Path(argv[1]).expanduser()
    for p in (src, dst):
        if not p.is_file():
            die(f'не файл: {p}')

    src_text = src.read_text(encoding='utf-8')
    dst_text = dst.read_text(encoding='utf-8')
    src_anchors = extract_anchors(src_text)
    dst_anchors = extract_anchors(dst_text)

    lost = sorted(src_anchors - dst_anchors)
    src_tokens = estimate_tokens(src_text)
    dst_tokens = estimate_tokens(dst_text)
    saved = src_tokens - dst_tokens

    result = {
        'ok': not lost,
        'estimated_tokens_before': src_tokens,
        'estimated_tokens_after': dst_tokens,
        'estimated_saved': saved,
        'estimated_saved_percent': round(saved / src_tokens * 100, 1) if src_tokens else 0.0,
        'anchors_before': len(src_anchors),
        'anchors_after': len(dst_anchors),
        'lost': [{'kind': k, 'value': v} for k, v in lost],
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    # Ненулевой код — сигнал скиллу, что нужен точечный фикс, а не переписывание.
    sys.exit(0 if not lost else 2)


def die(msg):
    print(f'ошибка: {msg}', file=sys.stderr)
    sys.exit(1)


COMMANDS = {'detect': cmd_detect, 'backup': cmd_backup, 'validate': cmd_validate}


def main():
    argv = sys.argv[1:]
    if not argv or argv[0] in ('-h', '--help'):
        print(__doc__)
        return
    cmd = COMMANDS.get(argv[0])
    if not cmd:
        die(f'неизвестная подкоманда: {argv[0]}')
    cmd(argv[1:])


if __name__ == '__main__':
    main()
