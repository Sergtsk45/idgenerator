# TASK-012: Security hardening, observability и rollout

## Метаданные

- **Тип:** implementation task
- **Зависимости:** TASK-001–TASK-011
- **Результат:** Подготовить MCP-MVP к ограниченному пилоту: аудит, лимиты, метрики, runbook и rollback.

## Задание агенту

### Роль

Ты — senior TypeScript backend engineer, работающий в существующем репозитории `Sergtsk45/idgenerator`. Твоя задача — выполнить только описанный scope, сохранив совместимость существующего приложения.

### Цель

Подготовить MCP-MVP к ограниченному пилоту: аудит, лимиты, метрики, runbook и rollback.

### Контекст

MCP расширяет поверхность доступа к данным и write-операциям. Пилот нельзя запускать без наблюдаемости и проверок границ.

### Связанные файлы для первичного изучения

- `/mcp`
- auth middleware
- all MCP tools
- upload/download endpoints
- logging infrastructure
- deployment/docker configs
- docs/runbooks

Список не является исчерпывающим. Найди фактические зависимости через импорты, схемы и тесты.

### Обязательные первые действия

1. Прочитай все применимые `AGENTS.md`, `.cursor/rules`, ADR и документацию.
2. Изучи текущий код и существующие тесты; не предполагай отсутствующие контракты.
3. Дай краткий план из 3–7 пунктов.
4. Зафиксируй найденные риски и несовместимости до редактирования.
5. Не начинай широкий рефакторинг без необходимости для acceptance criteria.

### Scope

1. Проведи inventory tools и side effects.
2. Добавь per-tool metrics: count, latency, errors.
3. Добавь correlation ID: request → tool → domain operation → event.
4. Audit log для write/final actions.
5. Rate limits per user/tool.
6. Timeouts/cancellation.
7. Redaction чувствительных полей.
8. Host/origin validation для MCP HTTP.
9. Security tests ownership/IDOR.
10. Threat model: prompt injection through uploaded content, malicious filenames, token leakage, confused deputy.
11. Feature flag MCP.
12. Staging deployment runbook.
13. Rollback plan.
14. Pilot checklist and operational dashboards.

### Non-goals

- Не открывать публичный self-service без pilot.
- Не хранить полные файлы/сметы в application logs.
- Не отключать существующие auth checks ради совместимости клиента.
- Не объявлять систему production-ready без прохождения checklist.

### Обязательные контракты

- Все write tools имеют audit event.
- Token/authorization headers redacted.
- Rate limit выдаёт стабильный error.
- Cancellation не оставляет partial transaction.
- Feature flag полностью отключает endpoint.
- Runbook содержит migrations, env, smoke, rollback.
- Security findings имеют severity/owner/status.

### Безопасность и качество

- Всегда получать user identity из проверенного auth context.
- Не принимать доверенный `userId` из tool arguments.
- Проверять ownership всех object/workflow/entity ID.
- Для write-операций предусмотреть идемпотентность или доказать, почему она не нужна.
- Не логировать токены, содержимое секретов и полные персональные данные.
- Возвращать стабильные машинно-читаемые error codes.
- Сохранить обратную совместимость текущих REST-сценариев.
- Переиспользовать Zod и domain services вместо дублирования правил.
- Не скрывать ошибки тестов; устранить или явно описать блокер.

### Acceptance criteria

- Все tools проходят ownership/IDOR matrix.
- Метрики отражают invocation, latency и error code.
- Секреты не попадают в логи.
- Feature flag отключает transport без влияния на REST.
- Runbook проверен на staging.
- Rollback и restore шаги документированы.
- Критические security findings закрыты до пилота.

### Проверки

- IDOR matrix across all tools.
- Rate-limit tests.
- Timeout/cancellation tests.
- Log redaction tests.
- Feature flag test.
- Staging smoke evidence.
- Restore/rollback rehearsal documented.

Обязательно выполнить:

```bash
npm run check
npm test
npm run build
```

### Риски и особые замечания

Отдельно проверить существующие REST endpoints без appAuth/ownership, если MCP services переиспользуют их внутреннюю логику.

### Формат финального отчёта

1. Краткий результат.
2. Изменённые файлы.
3. Миграции и совместимость.
4. Добавленные/изменённые контракты.
5. Тесты и фактические результаты команд.
6. Ручной smoke-сценарий.
7. Известные ограничения.
8. Следующая зависимая TASK.
