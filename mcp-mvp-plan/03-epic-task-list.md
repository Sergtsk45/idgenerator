# Укрупнённый список задач первого MVP

| ID | Задача | Основной результат | Зависимости |
|---|---|---|---|
| TASK-001 | MCP foundation | `/mcp`, Streamable HTTP, JWT context, tool skeleton | — |
| TASK-002 | Workflow state | State machine, inputs, events, idempotency | TASK-001 |
| TASK-003 | Upload + estimate import | Защищённая загрузка XLSX и импорт в workflow | TASK-001, TASK-002 |
| TASK-004 | Estimate analysis | Основные работы, ресурсы, labor availability | TASK-003 |
| TASK-005 | Missing inputs engine | Формальные вопросы и сохранение ответов | TASK-002, TASK-004 |
| TASK-006 | Schedule planning | Draft, assumptions, approval, schedule tasks | TASK-004, TASK-005 |
| TASK-007 | Material register | Классификация, дедуп, требования к документам | TASK-004, TASK-006 |
| TASK-008 | Document ingestion | Upload PDF, document record, binding, readiness | TASK-003, TASK-007 |
| TASK-009 | Acts readiness | Проверки, generate-acts, export PDFs | TASK-006, TASK-008 |
| TASK-010 | Worklog + package | Draft journal, manifest, package | TASK-009 |
| TASK-011 | Agent contract + E2E | MCP prompt/resources, сквозной тест | TASK-001…010 |
| TASK-012 | Security + rollout | Audit, limits, telemetry, deployment runbook | TASK-001…011 |

## Definition of Done для каждой задачи

- код соответствует существующей архитектуре;
- REST и MCP не дублируют бизнес-логику;
- ownership проверяется сервером;
- Zod-схемы описывают входы/выходы;
- миграция обратима или содержит безопасный rollback-план;
- добавлены unit/contract/integration tests;
- выполнены `npm run check`, `npm test`, `npm run build`;
- обновлены `docs/changelog.md` и `docs/tasktracker.md`;
- PR содержит риски, тестовые доказательства и ограничения;
- отсутствуют необъяснённые изменения вне scope.

## Общие решения

1. MCP endpoint не обращается к Express route handlers.
2. Workflow state хранится в БД, а не в контексте чата.
3. Большие файлы передаются через upload session.
4. Расчёты детерминированы и версионируются.
5. Все предположения видны пользователю.
6. Финальный выпуск требует подтверждения.
7. В первом MVP график линейный; зависимости и параллельность — следующий этап.
