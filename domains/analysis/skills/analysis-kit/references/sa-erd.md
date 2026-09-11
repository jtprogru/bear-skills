# ER-диаграмма и DDL

Файл: `<feature>_erd.plantuml` и `<feature>_ddl.sql` · Владелец: system-analyst

## Назначение

Фиксирует модель данных инициативы в двух согласованных формах. ER-диаграмма показывает сущности, ключи и кардинальности для обсуждения, DDL — исполняемое описание таблиц, ограничений, индексов и классов данных. Читатели — разработчики, DBA и security-reviewer.

## Входы

Прочитай в каталоге `<feature>`:

- `_backend.md` — сущности, поля, модель состояний, раздел соответствия имён и типов, идемпотентность, аудит;
- `_brd.md` — бизнес-ключи, сроки хранения, классы данных;
- `_openapi.yaml` и `_asyncapi.yaml`, если уже есть, — типы, форматы, обязательность полей;
- существующие миграции и схему БД проекта — диалект, тип PK, конвенции имён.

Факты, которые нужны до начала работы, запрашиваются одним списком:

1. СУБД и версия.
2. Тип первичного ключа, принятый в проекте.
3. Представление денежных сумм, если оно ещё не записано в backend-логике.
4. Бизнес-ключи и правила уникальности.
5. Ожидаемые объёмы данных и основные запросы.
6. Сроки хранения и способ удаления или обезличивания.
7. Класс данных каждого поля: ПДн, банковская тайна, данные карт.

`[GAP]` ставится комментарием на строке столбца или ограничения: `-- [GAP: … → …]` в SQL и `' [GAP: … → …]` в PlantUML. Адресаты: объёмы и запросы → пользователь или владелец сервиса; классы данных и сроки хранения → business-analyst и security-reviewer; конвенции проекта → пользователь.

## Шаблон

### ER-диаграмма `<feature>_erd.plantuml`

```plantuml
@startuml <feature>_erd
' Feature: <feature> · Владелец: system-analyst · Статус: <draft | review> · Версия: <версия> · Обновлён: <YYYY-MM-DD>
' СУБД: <СУБД и версия> — <причина: конвенция проекта | умолчание PostgreSQL>
' Связанные артефакты: <feature>_backend.md, <feature>_ddl.sql

hide circle
skinparam linetype ortho

entity "<parent_table>" as <parent_alias> {
  * id : uuid <<PK>>
  --
  * <business_key> : <type>
  * created_at : timestamptz
  * updated_at : timestamptz
}

entity "<child_table>" as <child_alias> {
  * id : uuid <<PK>>
  --
  * <parent>_id : uuid <<FK>>
  * <status_column> : text
  <optional_column> : <type>
  * created_at : timestamptz
  * updated_at : timestamptz
}

<parent_alias> ||--o{ <child_alias> : "<глагол связи>"
@enduml
```

### DDL `<feature>_ddl.sql`

```sql
-- Feature: <feature> · Владелец: system-analyst · Статус: <draft | review> · Версия: <версия> · Обновлён: <YYYY-MM-DD>
-- СУБД: <СУБД и версия> — <причина: конвенция проекта | умолчание PostgreSQL>
-- Связанные артефакты: <feature>_backend.md, <feature>_erd.plantuml

CREATE TABLE <parent_table> (
    id                uuid        NOT NULL,
    <business_key>    <type>      NOT NULL,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT <parent_table>_pk PRIMARY KEY (id),
    CONSTRAINT <parent_table>_<business_key>_uq UNIQUE (<business_key>)
);

CREATE TABLE <child_table> (
    id                uuid        NOT NULL,
    <parent>_id       uuid        NOT NULL,
    <status_column>   text        NOT NULL,
    <amount_column>   bigint      NOT NULL, -- сумма в минимальных единицах или numeric(<p>, <s>) по разделу 13 backend-логики
    <currency_column> char(3)     NOT NULL, -- код валюты ISO 4217
    <optional_column> <type>,
    <version_column>  integer     NOT NULL DEFAULT 0, -- версия записи, если её выбрала backend-логика
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT <child_table>_pk PRIMARY KEY (id),
    CONSTRAINT <child_table>_<parent>_id_fk FOREIGN KEY (<parent>_id)
        REFERENCES <parent_table> (id) ON DELETE <RESTRICT | CASCADE | SET NULL>,
    CONSTRAINT <child_table>_<status_column>_ck CHECK (<status_column> IN ('<state_1>', '<state_2>')),
    CONSTRAINT <child_table>_<amount_column>_ck CHECK (<amount_column> > 0)
);

-- Индекс внешнего ключа
CREATE INDEX <child_table>_<parent>_id_idx ON <child_table> (<parent>_id);
-- Обслуживает запрос: <запрос из backend-логики или NFR>
CREATE INDEX <child_table>_<columns>_idx ON <child_table> (<column_1>, <column_2>);

COMMENT ON TABLE <child_table> IS '<назначение таблицы>';
COMMENT ON COLUMN <child_table>.<column> IS '<смысл поля>. Класс данных: <ПДн | банковская тайна | данные карт | нет>';
```

## Правила

1. Набор сущностей и полей в ERD, DDL и backend-логике один и тот же, имена совпадают.
2. Таблицы и столбцы в `snake_case`, таблицы во множественном числе. Ограничения и индексы называются `<table>_<columns>_<pk|fk|uq|ck|idx>` и укладываются в 63 символа — лимит идентификатора PostgreSQL.
3. Первичный ключ `id uuid`, если проект не задаёт другой тип; значение генерирует приложение или `DEFAULT gen_random_uuid()` по конвенции проекта.
4. Каждая таблица с изменяемыми данными содержит `created_at` и `updated_at` типа `timestamptz NOT NULL`; все временные столбцы имеют тип `timestamptz`.
5. Суммы хранятся способом из раздела 13 backend-логики: `bigint` в минимальных единицах или `numeric(<p>, <s>)`, рядом `char(3)` с кодом валюты ISO 4217.
6. Перечисление со стабильным набором значений хранится как `text` с `CHECK`; набор, который меняется без релиза или несёт атрибуты, — справочной таблицей. Значения совпадают с моделью состояний backend-логики и `enum` в OpenAPI.
7. У каждого внешнего ключа явный `ON DELETE`, выбранный по бизнес-смыслу; финансовые и аудиторские данные используют `RESTRICT`.
8. На каждый столбец внешнего ключа есть индекс. Остальные индексы создаются под запросы из backend-логики или NFR, над каждым — комментарий с обслуживаемым запросом.
9. Бизнес-ключи и ключи идемпотентности закреплены ограничением `UNIQUE`.
10. `NOT NULL` стоит у полей, обязательных по валидациям backend-логики и `required` в OpenAPI; столбец без `NOT NULL` соответствует необязательному полю.
11. У каждой таблицы есть `COMMENT ON TABLE`, у каждого столбца — `COMMENT ON COLUMN` на русском с классом данных: `ПДн`, `банковская тайна`, `данные карт` или `нет`.
12. Кардинальности ERD соответствуют DDL: обязательный родитель `||` — FK `NOT NULL`; необязательный родитель `|o` — FK допускает `NULL`; связь «один к одному» — `UNIQUE` на FK.
13. Миграции, партиционирование и архивные таблицы описываются, когда есть данные об объёмах и сроках хранения; без этих данных в метаданных стоит `[GAP]`.
14. DDL выполняется целиком на пустой базе: таблицы создаются в порядке зависимостей.

## Валидация

ER-диаграмма:

```bash
command -v plantuml && plantuml -checkonly <feature>_erd.plantuml
```

Без локального PlantUML: `brew install plantuml` или `java -jar plantuml.jar -checkonly <feature>_erd.plantuml` с jar из https://github.com/plantuml/plantuml/releases.

DDL на одноразовой базе PostgreSQL, если есть Docker:

```bash
docker run --rm -d --name ddl-check -e POSTGRES_PASSWORD=check postgres:<версия>
until docker exec ddl-check pg_isready -U postgres; do sleep 1; done; sleep 3
docker exec -i ddl-check psql -U postgres -v ON_ERROR_STOP=1 < <feature>_ddl.sql
docker stop ddl-check
```

Если запуск недоступен, команды уходят пользователю в блоке «Передача».

## Чеклист качества

- [ ] Набор сущностей и полей в ERD, DDL и backend-логике совпадает.
- [ ] Кардинальность каждой связи ERD соответствует `NULL`/`NOT NULL` и `UNIQUE` внешнего ключа в DDL.
- [ ] У каждой таблицы есть PK, `created_at` и `updated_at`.
- [ ] У каждого FK есть явный `ON DELETE` и индекс.
- [ ] Бизнес-ключи и ключи идемпотентности закреплены `UNIQUE`.
- [ ] Значения `CHECK` для статусов совпадают с моделью состояний и `enum` в OpenAPI.
- [ ] Обязательность столбцов совпадает с валидациями backend-логики и `required` в OpenAPI.
- [ ] Суммы и время хранятся способом, выбранным для инициативы.
- [ ] У каждой таблицы и каждого столбца есть комментарий с классом данных.
- [ ] Для столбцов с классом данных, отличным от `нет`, способ защиты указан в комментарии или заведён `Q-n` к security-reviewer.
- [ ] Имена в `snake_case`, идентификаторы не длиннее 63 символов.
- [ ] `plantuml -checkonly` и прогон DDL на пустой базе прошли, или команды проверки переданы пользователю.
