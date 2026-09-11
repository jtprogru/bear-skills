# Спецификация REST API

Файл: `<feature>_openapi.yaml` · Владелец: system-analyst

## Назначение

Машиночитаемый контракт REST API инициативы: операции, схемы запросов и ответов, ошибки, безопасность. По нему генерируют клиентов и серверные заглушки, пишут контрактные тесты и проверяют реализацию. Читатели — разработчики сервиса и клиентов, QA, security-reviewer.

## Входы

Прочитай в каталоге `<feature>`:

- `_backend.md` — операции, валидации, коды ошибок, модель состояний, идемпотентность, раздел соответствия имён и типов;
- `_sequence.plantuml` — `operationId` и порядок вызовов;
- `_ddl.sql` — типы, обязательность, значения `CHECK`;
- существующие спецификации проекта — версия OpenAPI, стиль путей, формат ошибок, схема безопасности, пагинация.

Факты, которые нужны до начала работы, запрашиваются одним списком:

1. Базовый URL и окружения.
2. Схема аутентификации клиентов и выдача учётных данных.
3. Какие операции публичные.
4. Лимиты частоты по операциям.
5. Способ пагинации и максимальный размер страницы.
6. Ограничения длины и формата полей, которые не следуют из backend-логики.

`[GAP]` ставится в `description` операции, схемы или поля: `description: "[GAP: … → …]"`. Адресаты: окружения и лимиты → пользователь или владелец сервиса; аутентификация → пользователь и security-reviewer; форматы полей бизнес-данных → business-analyst.

## Шаблон

```yaml
openapi: 3.1.0
info:
  title: "<Название API>"
  version: "<версия спецификации>"
  description: |
    Feature: <feature>
    Владелец: system-analyst · Статус: <draft | review> · Обновлён: <YYYY-MM-DD>
    OpenAPI <версия> — <причина: версия проекта | умолчание>
    Публичные операции: <operationId, … | нет>
    Связанные артефакты: <feature>_backend.md, <feature>_sequence.plantuml, <feature>_ddl.sql
servers:
  - { url: "<https://host/base-path>", description: "<окружение>" }
tags:
  - { name: "<resource>", description: "<ресурс и связанные UC-n>" }
security:
  - "<securitySchemeName>": []
paths:
  "/v1/<resources>":
    post:
      operationId: "<createResource>"
      summary: "<действие>"
      description: "<поведение, FR-n, ответ на повтор с тем же Idempotency-Key>"
      tags: ["<resource>"]
      parameters:
        - $ref: "#/components/parameters/IdempotencyKey"
      requestBody:
        required: true
        content: { application/json: { schema: { $ref: "#/components/schemas/<ResourceCreateRequest>" } } }
      responses:
        "201":
          description: "<результат>"
          content: { application/json: { schema: { $ref: "#/components/schemas/<Resource>" } } }
        "400": { $ref: "#/components/responses/BadRequest" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "403": { $ref: "#/components/responses/Forbidden" }
        "409": { $ref: "#/components/responses/Conflict" }
        "422": { $ref: "#/components/responses/UnprocessableContent" }
        "429": { $ref: "#/components/responses/TooManyRequests" }
        "500": { $ref: "#/components/responses/InternalError" }
    get:
      operationId: "<listResources>"
      summary: "<действие>"
      description: "<поведение, FR-n>"
      tags: ["<resource>"]
      parameters:
        - $ref: "#/components/parameters/Limit"
        - $ref: "#/components/parameters/Cursor"
      responses:
        "200":
          description: "<страница результатов>"
          content: { application/json: { schema: { $ref: "#/components/schemas/<ResourcePage>" } } }
        "400": { $ref: "#/components/responses/BadRequest" }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "500": { $ref: "#/components/responses/InternalError" }
  "/v1/<resources>/{resourceId}":
    get:
      operationId: "<getResource>"
      summary: "<действие>"
      description: "<поведение, FR-n, проверка владения объектом>"
      tags: ["<resource>"]
      parameters:
        - { name: resourceId, in: path, required: true, schema: { type: string, format: uuid } }
      responses:
        "200":
          description: "<ресурс>"
          content: { application/json: { schema: { $ref: "#/components/schemas/<Resource>" } } }
        "401": { $ref: "#/components/responses/Unauthorized" }
        "403": { $ref: "#/components/responses/Forbidden" }
        "404": { $ref: "#/components/responses/NotFound" }
        "500": { $ref: "#/components/responses/InternalError" }
components:
  securitySchemes:
    "<securitySchemeName>":
      type: "<oauth2 | http | mutualTLS | apiKey>"
      # обязательные поля по type: http — scheme (для bearer ещё bearerFormat); oauth2 — flows; apiKey — name и in; mutualTLS — дополнительных полей нет
      description: "<механизм, выдача и срок жизни учётных данных>"
  parameters:
    IdempotencyKey: { name: Idempotency-Key, in: header, required: true, description: "<срок жизни ключа из backend-логики>", schema: { type: string, format: uuid } }
    Limit: { name: limit, in: query, schema: { type: integer, minimum: 1, maximum: "<максимальный размер страницы>", default: "<размер по умолчанию>" } }
    Cursor: { name: cursor, in: query, schema: { type: string, maxLength: "<длина>" } }
  headers:
    RetryAfter: { description: "Число секунд до повторной попытки", schema: { type: integer, minimum: 1 } }
  responses:
    BadRequest:
      description: "Запрос не соответствует схеме"
      content: { application/problem+json: { schema: { $ref: "#/components/schemas/Problem" } } }
    TooManyRequests:
      description: "Превышен лимит частоты"
      headers: { Retry-After: { $ref: "#/components/headers/RetryAfter" } }
      content: { application/problem+json: { schema: { $ref: "#/components/schemas/Problem" } } }
    # Unauthorized, Forbidden, NotFound, Conflict, UnprocessableContent, InternalError — по образцу BadRequest
  schemas:
    Problem:
      type: object
      required: [type, title, status, code]
      properties:
        type: { type: string, format: uri-reference, maxLength: "<длина>" }
        title: { type: string, maxLength: "<длина>" }
        status: { type: integer, minimum: 400, maximum: 599 }
        detail: { type: string, maxLength: "<длина>" }
        instance: { type: string, format: uri-reference, maxLength: "<длина>" }
        code: { type: string, pattern: "^[A-Z][A-Z0-9_]*$", description: "Код ошибки из backend-логики" }
        correlationId: { type: string, format: uuid }
        errors:
          type: array
          maxItems: "<лимит>"
          items:
            type: object
            required: [field, code]
            properties: { field: { type: string, maxLength: "<длина>" }, code: { type: string, pattern: "^[A-Z][A-Z0-9_]*$" } }
    "<ResourceCreateRequest>":
      type: object
      additionalProperties: false
      required: ["<requiredField>"]
      properties:
        "<requiredField>": { type: string, minLength: 1, maxLength: "<длина>", pattern: "<regex>" }
        "<amountField>": { type: integer, minimum: 1, description: "Сумма в минимальных единицах валюты" }
        "<currencyField>": { type: string, pattern: "^[A-Z]{3}$", description: "Код валюты ISO 4217" }
        "<enumField>": { type: string, enum: ["<value_1>", "<value_2>"] }
        "<optionalField>": { type: ["string", "null"], maxLength: "<длина>" }
        "<secretField>": { type: string, writeOnly: true, maxLength: "<длина>" }
      examples:
        - { "<requiredField>": "<пример>" }
    "<Resource>":
      type: object
      required: [id, "<requiredField>", createdAt]
      properties:
        id: { type: string, format: uuid, readOnly: true }
        "<requiredField>": { type: string, maxLength: "<длина>" }
        "<statusField>": { type: string, enum: ["<state_1>", "<state_2>"], readOnly: true }
        createdAt: { type: string, format: date-time, readOnly: true }
    "<ResourcePage>":
      type: object
      required: [items]
      properties:
        items: { type: array, maxItems: "<максимальный размер страницы>", items: { $ref: "#/components/schemas/<Resource>" } }
        nextCursor: { type: ["string", "null"], maxLength: "<длина>" }
```

## Правила

1. Версия OpenAPI берётся из существующих спецификаций проекта, иначе `3.1.0`; версия и причина выбора записаны в `info.description`.
2. Каждая операция из backend-логики и Sequence есть в `paths`; `operationId` в camelCase, уникален и совпадает с подписью в Sequence.
3. У каждой операции есть `summary`, `description` со ссылками на `FR-n`, `tags` и ответ на каждый исход из backend-логики.
4. Ошибки отдаются как `application/problem+json` по RFC 9457 через `components/responses`; поле `code` содержит код из таблицы ошибок backend-логики. Распределение статусов: `400` — запрос не соответствует схеме, `422` — нарушено бизнес-правило, `409` — конфликт состояния или повтор ключа идемпотентности с другим телом; проект со своей конвенцией статусов следует ей.
5. Схема запроса закрыта `additionalProperties: false` и перечисляет `required`. У строки есть `maxLength` и, где формат известен, `format` или `pattern`; у числа — `minimum`/`maximum`; у массива — `maxItems`; у перечисления — `enum` со значениями из модели состояний.
6. Поля, которые заполняет сервер, помечены `readOnly: true`; секреты во входных данных — `writeOnly: true`.
7. Синтаксис выбранной версии: в 3.1 nullable-поле записывается `type: [<type>, "null"]`, пример схемы — массивом `examples`; в 3.0 — `nullable: true` и `example`.
8. Версия API входит в путь (`/v1/…`); несовместимое изменение контракта получает новый префикс версии.
9. Списки пагинируются способом, принятым в проекте, иначе курсором; у `limit` есть `maximum`, у массива страницы — `maxItems` с тем же значением.
10. Операции с финансовым эффектом или побочным эффектом во внешней системе принимают `Idempotency-Key`; поведение при повторе в `description` совпадает с backend-логикой.
11. `path` и `query` содержат идентификаторы ресурсов и параметры фильтрации; ПДн, токены и реквизиты передаются в теле запроса или заголовках.
12. `securitySchemes` объявлены, `security` задана на корневом уровне; публичная операция переопределяет её пустым `security: []` и перечислена в `info.description`.
13. Время — `type: string`, `format: date-time`, UTC; суммы — способом из раздела 13 backend-логики; идентификаторы — `format: uuid`, если проект не задаёт другое.
14. Имена полей JSON в camelCase и совпадают с разделом 13 backend-логики.
15. Операция с лимитом частоты возвращает `429` с заголовком `Retry-After`.
16. У каждой схемы запроса и ответа есть пример, который проходит валидацию по этой схеме. ИБ-требования к API полностью — в `references/security-review.md`.

## Валидация

```bash
command -v redocly && redocly lint <feature>_openapi.yaml
```

Без локальной установки: `npx @redocly/cli lint <feature>_openapi.yaml`. Если запуск недоступен, команда уходит пользователю в блоке «Передача».

## Чеклист качества

- [ ] Версия OpenAPI и причина её выбора указаны в `info.description`.
- [ ] Каждая операция backend-логики и Sequence есть в `paths` с тем же `operationId`.
- [ ] У каждой операции есть `summary`, `description` со ссылками на `FR`, `tags`.
- [ ] Каждый исход backend-логики имеет ответ; ошибки описаны через Problem Details с полем `code`.
- [ ] Коды ошибок совпадают с таблицей ошибок backend-логики.
- [ ] Все схемы запросов закрыты `additionalProperties: false` и содержат `required`.
- [ ] У каждой строки есть `maxLength`, у чисел границы, у массивов `maxItems`.
- [ ] Значения `enum` совпадают с моделью состояний и `CHECK` в DDL.
- [ ] Nullable-поля и примеры записаны синтаксисом выбранной версии OpenAPI.
- [ ] Списки пагинируются с верхним лимитом страницы.
- [ ] Операции с финансовым эффектом принимают `Idempotency-Key`.
- [ ] В `path` и `query` нет ПДн, токенов и реквизитов.
- [ ] `security` задана, публичные операции перечислены явно.
- [ ] Имена полей совпадают с разделом 13 backend-логики.
- [ ] `redocly lint` проходит без ошибок, или команда проверки передана пользователю.
