---
name: sre-k8s-triage
description: >
  Систематический алгоритм диагностики проблем в Kubernetes — Pod/Deployment/Service.
  Ведёт от симптома (CrashLoopBackOff, Pending, 5xx, нет трафика) через kubectl-команды
  к гипотезе и митигации. Используй, когда пользователь говорит «под падает», «не
  стартует», «не ходит трафик», «k8s проблема», «помоги разобраться с подом»,
  «pod в CrashLoopBackOff/ImagePullBackOff/Pending/OOMKilled».
---

# sre-k8s-triage — Диагностика k8s от симптома к причине

Цель: дать структурированный путь от симптома к гипотезе, без бесцельного kubectl-серфинга.

Перед началом — если у пользователя есть домашний runbook на этот сценарий, посмотри его (`~/.claude/rules/sre-runbook-template.md` — структура общая).

## Шаг 0. Зафиксируй симптом

Спроси:
- ресурс: Pod / Deployment / Service / Ingress
- namespace, имя
- статус: `kubectl -n <ns> get <res> <name>` — что показывает
- с какого времени, что изменилось

Если симптом размыт («приложение не работает») — попроси конкретику: ошибка пользователя, HTTP-статус, логи.

## Шаг 1. Выбери ветку по симптому

| Симптом / Status | Идти в раздел |
|------------------|---------------|
| Pod: `Pending` | A. Шедулинг |
| Pod: `CrashLoopBackOff` | B. Падает на старте |
| Pod: `ImagePullBackOff` / `ErrImagePull` | C. Образ |
| Pod: `OOMKilled` (в `kubectl describe` Last State) | D. Память |
| Pod: `Running`, но не отвечает | E. Readiness / трафик |
| Service: нет endpoints | F. Селектор |
| Ingress: 502/503/504 | G. Маршрутизация |
| Deployment: rollout stuck | H. Деплой |

---

### A. Pod Pending — шедулинг

```bash
kubectl -n <ns> describe pod <pod> | tail -20
```

Смотри секцию `Events`. Частые причины:
- **`Insufficient cpu/memory`** → нет нод с нужными ресурсами. Решение: понизить `requests`, скейл нод, проверить `kubectl top nodes`.
- **`0/N nodes are available: ... untolerated taint`** → под не толерирует taint. Решение: добавить `tolerations` или unaint ноду.
- **`pod has unbound immediate PersistentVolumeClaims`** → PVC не provisioned. Проверить StorageClass, провижионер.
- **`node(s) didn't match Pod's node affinity/selector`** → проверить `nodeSelector`/`affinity`.

### B. CrashLoopBackOff — падает на старте

```bash
kubectl -n <ns> logs <pod> --previous --tail=100
kubectl -n <ns> describe pod <pod> | grep -A5 'Last State'
```

Частые причины:
- **Exit code 1 + ошибка в логах** → ошибка приложения (конфиг, миссинг env-vars, БД недоступна).
- **Exit code 137** → OOM, см. раздел D.
- **Exit code 139 (SIGSEGV)** → segfault, скорее всего баг в коде или libc-несовместимость.
- **Liveness probe failure** → проверь `livenessProbe`. Часто стартап дольше, чем `initialDelaySeconds`.

### C. ImagePullBackOff

```bash
kubectl -n <ns> describe pod <pod> | grep -A3 'Events'
```

- **`pull access denied`** → нет imagePullSecret или истёк токен registry.
- **`manifest unknown`** → тег не существует. Проверь `kubectl -n <ns> get pod <pod> -o jsonpath='{.spec.containers[*].image}'`.
- **`net/http: TLS handshake timeout`** → сетевая проблема к registry с ноды.

### D. OOMKilled

```bash
kubectl -n <ns> describe pod <pod> | grep -A3 'Last State'
kubectl -n <ns> top pod <pod> --containers
```

- Текущий `resources.limits.memory` ниже реального потребления.
- Утечка памяти в приложении.
- Митигация: поднять limit, рестарт. Root cause: профилирование heap'а.

### E. Pod Running, не отвечает

Проверь, что readiness probe проходит:
```bash
kubectl -n <ns> describe pod <pod> | grep -A5 'Conditions'
kubectl -n <ns> get pod <pod> -o jsonpath='{.status.containerStatuses[*].ready}'
```

- **`Ready: false`** → readiness fails, под в `Service` не попадает.
- **`Ready: true`, но 5xx** → проверь приложение: `kubectl exec -it <pod> -- <healthcheck-cmd>`, логи.

### F. Service без endpoints

```bash
kubectl -n <ns> get svc <name> -o wide
kubectl -n <ns> get endpoints <name>
kubectl -n <ns> get pods -l <selector-from-svc> --show-labels
```

- Endpoints пустой → селектор Service не матчит ни один Pod (или ни один не `Ready`).
- Проверь `kubectl -n <ns> describe svc <name>` — раздел Selector.

### G. Ingress 502/503/504

- **502** → upstream (Pod) не отвечает. Иди в раздел E.
- **503** → нет endpoints или ingress controller не нашёл backend. Раздел F.
- **504** → timeout от upstream. Проверь `kubectl logs` ingress-controller'а, таймауты в аннотациях Ingress.

### H. Deployment rollout stuck

```bash
kubectl -n <ns> rollout status deployment/<name>
kubectl -n <ns> describe deployment <name> | tail -30
kubectl -n <ns> get rs -l app=<name>           # ReplicaSet'ы
kubectl -n <ns> get pod -l app=<name>          # поды
```

- Новые поды Pending/Crash — иди по соответствующей ветке.
- `MinimumReplicasAvailable: False` → стратегия rolling не может продвинуться.
- Откат: `kubectl -n <ns> rollout undo deployment/<name>`.

---

## Шаг 2. Сформулируй гипотезу

После kubectl-копания **скажи пользователю одну гипотезу** с обоснованием:

```
Гипотеза: под не стартует из-за миссинга секрета DATABASE_URL.
Основание: в логах "env DATABASE_URL not set", в манифесте deploy секрет
не приcоединён. Восстановление: добавить envFrom secretRef или ручной
patch.
```

Если данных мало — назови **2-3 гипотезы** и спроси, что проверить первым.

## Шаг 3. Митигация vs root cause

Спроси, что важнее сейчас:
- **митигация** — быстро поднять (rollback, scale, ручной patch) → действуй после подтверждения
- **root cause** — копать глубже → продолжай диагностику

На production — обычно сначала митигация.

## Шаг 4. Покажи план, дождись подтверждения

Перед `kubectl delete`, `rollout undo`, любым изменяющим действием — **покажи команду, спроси, выполнить ли**. Read-only команды (`get`, `describe`, `logs`, `top`) — можно запускать без подтверждения.

## Чего не делать

- Не запускай `kubectl delete` на ресурсах прода без явного подтверждения
- Не предполагай namespace — спроси
- Не давай 10 команд подряд, не дождавшись вывода предыдущей: это диагностика, а не сценарий
- Не выдавай одну гипотезу за единственную — k8s-симптомы часто многопричинные
