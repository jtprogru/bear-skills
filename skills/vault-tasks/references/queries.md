<!-- СГЕНЕРИРОВАНО bin/mirror.js. Не редактировать: правки затрёт следующая генерация.
     Источник правды — domains/<домен>/. -->

# Запросы задач: дашборд и шаблоны

Эталон — сами файлы в хранилище: карта `03. Ресурсы/07. Карты/Задачи.md` и шаблоны в `_Система/1. Шаблоны/`. Здесь копия на случай, когда нужно понять, почему строка попадает или не попадает в срез, или собрать дашборд заново. Правка запросов в хранилище — тяжёлый рефакторинг, только по явному запросу.

Глобальный фильтр `#task` применяется ко всем `tasks`-блокам сам, в запросах его не пишут. Кастомные статусы `/` и `?` имеют тип `IN_PROGRESS` и `TODO`, поэтому `not done` их включает.

## Дашборд `Задачи`

Шапка карты — навигация на `README`, `Инбокс`, `Карта проектов` и регламент. Разделы идут в порядке утреннего обзора, потом срезы недельного разбора.

### Разобрать

Захвачено, но не размечено: нет области. Это и есть Inbox, на разборе опустошается до нуля.

```tasks
not done
filter by function !task.tags.some((t) => t.startsWith('#area/'))
sort by created reverse
sort by scheduled reverse
limit 25
```

### Фокус дня

Запланировано на сегодня и раньше. Не больше десяти строк, из них три `⏫` как ориентир и пять как потолок.

```tasks
not done
happens before tomorrow
tags do not include #task/someday
group by priority
sort by scheduled reverse
limit 20
```

### В работе

Больше двух одновременно — нарушение «одна задача в квант времени».

```tasks
filter by function task.status.symbol === '/'
sort by scheduled
```

### Жду ответа

Молчание дольше недели означает пинг, а не ожидание.

```tasks
filter by function task.status.symbol === '?'
sort by scheduled
```

### Эта неделя

```tasks
not done
happens this week
happens after today
tags do not include #task/someday
group by happens
sort by priority
```

### По областям

Разрез для недельного разбора: двигается ли каждая область.

```tasks
not done
tags do not include #task/someday
group by function task.tags.filter((t) => t.startsWith('#area/')).join(', ') || 'Без области'
sort by priority
limit groups 12
```

### По проектам

```tasks
not done
path includes 01. Проекты
group by filename
sort by priority
```

### Без срока

Ни одной даты. В дневнике дата подставляется из имени файла, поэтому сюда попадает записанное в проектах и заметках и выпавшее из планирования.

```tasks
not done
no due date
no scheduled date
no start date
tags do not include #task/someday
group by filename
sort by created reverse
limit groups 10
```

### Долгожители

Запланировано больше двух месяцев назад и всё ещё открыто. Сначала меняется формулировка, потом дата; не улучшается формулировка — задача мертва, статус `-`.

```tasks
not done
scheduled before 2 months ago
sort by scheduled
limit 30
```

### Someday

Попала сюда второй раз — скорее всего не твоя задача.

```tasks
not done
tags include #task/someday
sort by created reverse
```

### Чекбоксы без метки

Записано в дневнике как чекбокс, но без `#task`: Tasks таких не видит, поэтому срез собирает Dataview. Страховка от единственного способа потерять задачу — либо дописать метку, либо это был не список задач.

```dataview
TASK
FROM "05. Дневник"
WHERE !completed AND !contains(text, "#task")
SORT file.day DESC
LIMIT 30
```

### Сделано за неделю

Не отчётность, а присвоение результата.

```tasks
done
done this week
sort by done reverse
limit 40
```

## Блоки в шаблонах

### Ежедневная заметка

Витрина вверху, захват в конце. Комментарий в `## Инбокс` — подсказка формата для быстрого захвата.

````markdown
## Задачи

```tasks
not done
happens before tomorrow
sort by priority
sort by scheduled reverse
short mode
limit 15
```

## Дневник

...

## Инбокс

<!-- сюда пишет Raycast и быстрый захват: - [ ] глагол в инфинитиве #task -->
````

### Еженедельная заметка

Границу недели запрос берёт из имени файла `YYYY-Www` через `{{query.file.filenameWithoutExtension}}`.

````markdown
## Разбор задач недели

Каждой строке — один из трёх исходов: перенести (новая `⏳`), переформулировать, отменить (`- [-]`).

```tasks
happens on or before {{query.file.filenameWithoutExtension}}
(not done) OR (done after {{query.file.filenameWithoutExtension}}) OR (cancelled after {{query.file.filenameWithoutExtension}})
sort by priority
sort by scheduled
group by function task.file.folder
```

## План на следующую неделю

<!-- глагол в инфинитиве + метка + ⏳ дата: - [ ] Собрать матрицу приоритетов [[h3llo.cloud]] ⏳ 2026-09-12 #area/work #task/deep -->
````

### Шаблон проекта

Свои задачи проекта — строками в секции, чужие — запросом по wikilink на проект из любой другой заметки.

````markdown
## Задачи

<!-- глагол в инфинитиве, первый шаг: - [ ] Прочитать текущий RBAC-конфиг и выписать роли ⏳ 2026-09-12 #area/work #task/deep -->

### Задачи по проекту из других заметок

```tasks
not done
path does not include {{query.file.path}}
description includes [[{{query.file.filenameWithoutExtension}}
sort by priority
sort by scheduled
```
````
