# Спецификация событий Kafka

Файл: `<feature>_asyncapi.yaml` · Владелец: system-analyst

## Назначение

Машиночитаемый контракт событий инициативы: топики, сообщения, конверт, ключи, публикаторы и потребители, настройки топиков и DLQ. По нему согласуют интеграции между командами, генерируют модели и проверяют совместимость схем. Читатели — разработчики публикаторов и потребителей, владельцы Kafka-кластера, security-reviewer.

## Входы

Прочитай в каталоге `<feature>`:

- `_backend.md` — события, шаги публикации и потребления, идемпотентность, раздел соответствия имён и типов, аудит;
- `_sequence.plantuml` — асинхронные сообщения `->>` с адресами и именами;
- `_brd.md` — сроки хранения данных и классы данных;
- существующие спецификации и конфигурацию топиков проекта — версия AsyncAPI, конвенция имён, формат конверта, реестр схем.

Факты, которые нужны до начала работы, запрашиваются одним списком:

1. Кластер и окружения: адреса брокеров, способ аутентификации клиентов, TLS.
2. Конвенция имён топиков и формат конверта, принятые в проекте.
3. Потребители каждого события и их consumer group.
4. Требования к порядку событий: для какой сущности важен порядок.
5. Число партиций, фактор репликации, `cleanup.policy`, `retention.ms`.
6. Политика ретраев потребителей и порядок разбора DLQ.
7. Использование реестра схем и режим совместимости.

`[GAP]` ставится в `description` канала, операции или сообщения или строкой-значением поля настройки: `retention.ms: "[GAP: … → …]"`. Адресаты: настройки топиков и кластер → владелец Kafka-кластера через пользователя; сроки хранения → business-analyst и security-reviewer; потребители → пользователь.

## Шаблон

```yaml
asyncapi: 3.0.0
info:
  title: "<Название контракта событий>"
  version: "<версия спецификации>"
  description: |
    Feature: <feature>
    Владелец: system-analyst · Статус: <draft | review> · Обновлён: <YYYY-MM-DD>
    AsyncAPI <версия> — <причина: версия проекта | умолчание>
    Доставка: at-least-once, потребители дедуплицируют по eventId
    Связанные артефакты: <feature>_backend.md, <feature>_sequence.plantuml
defaultContentType: application/json
servers:
  "<environment>":
    host: "<broker-host>:<port>"
    protocol: kafka
    description: "<окружение, TLS при передаче>"
    security:
      - $ref: "#/components/securitySchemes/<brokerAuth>"
channels:
  "<channelId>":
    address: "<domain>.<entity>.<event>.v<N>"
    description: "<когда публикуется, FR-n; период параллельной публикации при смене версии>"
    messages:
      "<messageId>": { $ref: "#/components/messages/<MessageName>" }
    bindings:
      kafka:
        partitions: "<число>"
        replicas: "<число>"
        topicConfiguration:
          cleanup.policy: ["<delete | compact>"]
          retention.ms: "<миллисекунды>"
        bindingVersion: "0.5.0"
  "<channelId>Dlq":
    address: "<domain>.<entity>.<event>.v<N>.dlq"
    description: "<условие попадания, число ретраев до DLQ, кто и как разбирает, срок хранения>"
    messages:
      "<messageId>": { $ref: "#/components/messages/<MessageName>" }
operations:
  "<publishEvent>":
    action: send
    summary: "<сервис-публикатор и событие-триггер>"
    channel: { $ref: "#/channels/<channelId>" }
    messages:
      - $ref: "#/channels/<channelId>/messages/<messageId>"
  "<consumeEvent>":
    action: receive
    summary: "<сервис-потребитель и его действие>"
    channel: { $ref: "#/channels/<channelId>" }
    messages:
      - $ref: "#/channels/<channelId>/messages/<messageId>"
    bindings:
      kafka:
        groupId: { type: string, enum: ["<consumer-group>"] }
        bindingVersion: "0.5.0"
components:
  messages:
    "<MessageName>":
      name: "<MessageName>"
      title: "<название события>"
      summary: "<смысл события>"
      traits:
        - $ref: "#/components/messageTraits/EventEnvelope"
      payload: { $ref: "#/components/schemas/<MessagePayload>" }
      bindings:
        kafka:
          key: { type: string, format: uuid, description: "<идентификатор сущности, задающей порядок>" }
          bindingVersion: "0.5.0"
  messageTraits:
    EventEnvelope:
      contentType: application/json
      correlationId:
        location: "$message.header#/correlationId"
      headers:
        type: object
        required: [eventId, eventType, eventVersion, occurredAt, source, correlationId]
        properties:
          eventId: { type: string, format: uuid }
          eventType: { type: string, maxLength: "<длина>" }
          eventVersion: { type: string, pattern: "^[1-9][0-9]*$" }
          occurredAt: { type: string, format: date-time }
          source: { type: string, maxLength: "<длина>" }
          correlationId: { type: string, format: uuid }
  schemas:
    "<MessagePayload>":
      type: object
      required: ["<entityId>"]
      properties:
        "<entityId>": { type: string, format: uuid }
        "<field>": { type: string, maxLength: "<длина>" }
  securitySchemes:
    "<brokerAuth>":
      type: "<scramSha512 | X509 | gssapi>"
      description: "<механизм аутентификации клиентов брокера>"
```

## Правила

1. Версия AsyncAPI берётся из существующих спецификаций проекта, иначе `3.0.0`; `3.1.0` выбирается, когда генераторы и реестр схем проекта его поддерживают. Версия и причина выбора записаны в `info.description`. Проект на AsyncAPI 2.x меняет каркас: адрес топика служит ключом в `channels`, операции описываются внутри канала как `publish`/`subscribe`, корневого `operations` нет, у сервера `url` вместо `host`.
2. Каждое событие из backend-логики и каждое сообщение `->>` в Sequence описано каналом, сообщением и операцией с тем же адресом и именем.
3. Адрес топика следует конвенции проекта, иначе `<domain>.<entity>.<event>.v<N>` в нижнем регистре; DLQ получает тот же адрес с суффиксом `.dlq`.
4. Каждое сообщение несёт конверт `EventEnvelope` с полями `eventId` (UUID), `eventType`, `eventVersion`, `occurredAt` (UTC, ISO 8601), `source`, `correlationId`. В шаблоне конверт передаётся заголовками Kafka через `messageTraits`, поэтому значения строковые; проект, который кладёт конверт в payload, сохраняет те же поля.
5. Ключ сообщения — идентификатор сущности, для которой важен порядок событий; все события одной сущности публикуются с одним ключом.
6. Семантика доставки at-least-once записана в `info.description`; потребитель идемпотентен по `eventId`, способ дедупликации описан в backend-логике.
7. Схема payload перечисляет поля, нужные потребителям; потребители игнорируют неизвестные поля. Внутри версии топика добавляются только необязательные поля; удаление, переименование, смена типа или обязательности идут в новый топик `.v<N+1>`, период параллельной публикации записан в `description` канала.
8. Для каждого топика заданы `partitions`, `replicas`, `cleanup.policy` и `retention.ms` из источников или `[GAP]`; retention согласован со сроком хранения данных из BRD.
9. Для каждого потребляемого топика описан DLQ-канал: условие попадания, число ретраев до DLQ, ответственный за разбор, срок хранения.
10. У операции `receive` задан `groupId`; `summary` каждой операции называет сервис и действие.
11. Время и суммы в payload записаны способом из раздела 13 backend-логики, строки ограничены `maxLength`, имена полей в camelCase совпадают с этим разделом.
12. Аутентификация клиентов брокера описана в `securitySchemes`, шифрование при передаче — протоколом `kafka-secure` или описанием TLS в сервере. ИБ-требования к событиям полностью — в `references/security-review.md`.

## Валидация

```bash
command -v asyncapi && asyncapi validate <feature>_asyncapi.yaml
```

Без локальной установки: `npx @asyncapi/cli validate <feature>_asyncapi.yaml`. Если запуск недоступен, команда уходит пользователю в блоке «Передача».

## Чеклист качества

- [ ] Версия AsyncAPI и причина её выбора указаны в `info.description`.
- [ ] Каждое событие backend-логики и Sequence описано каналом, сообщением и операцией.
- [ ] Адреса топиков следуют конвенции и содержат версию.
- [ ] Все сообщения используют конверт с шестью обязательными полями.
- [ ] У каждого сообщения задан ключ Kafka с описанием его смысла.
- [ ] Семантика доставки и способ дедупликации указаны.
- [ ] Для каждого топика заданы партиции, реплики, `cleanup.policy` и `retention.ms` или стоит `[GAP]`.
- [ ] Для каждого потребляемого топика описаны DLQ и политика ретраев.
- [ ] У каждой операции `receive` задан `groupId`.
- [ ] Правило эволюции схемы соблюдено: несовместимые изменения идут в новый топик.
- [ ] Имена и типы полей payload совпадают с разделом 13 backend-логики.
- [ ] Аутентификация клиентов брокера и шифрование при передаче указаны.
- [ ] `asyncapi validate` проходит без ошибок, или команда проверки передана пользователю.
