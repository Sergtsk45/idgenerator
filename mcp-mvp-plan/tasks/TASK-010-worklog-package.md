# TASK-010: Черновой журнал работ и итоговый execution package

## Метаданные

- **Тип:** implementation task
- **Зависимости:** TASK-009
- **Результат:** Сформировать трассируемый черновой журнал и итоговый manifest/архив для проверки комплектности.

## Задание агенту

### Роль

Ты — senior TypeScript backend engineer, работающий в существующем репозитории `Sergtsk45/idgenerator`. Твоя задача — выполнить только описанный scope, сохранив совместимость существующего приложения.

### Цель

Сформировать трассируемый черновой журнал и итоговый manifest/архив для проверки комплектности.

### Контекст

Текущий worklog объединяет сообщения и акты, но нужно различать план, факт и подтверждение актом.

### Связанные файлы для первичного изучения

- `server/routes/messages.ts`
- worklog schemas в `shared/routes.ts`
- messages/acts/schedules schema
- generated PDF storage
- artifact download routes

Список не является исчерпывающим. Найди фактические зависимости через импорты, схемы и тесты.

### Обязательные первые действия

1. Прочитай все применимые `AGENTS.md`, `.cursor/rules`, ADR и документацию.
2. Изучи текущий код и существующие тесты; не предполагай отсутствующие контракты.
3. Дай краткий план из 3–7 пунктов.
4. Зафиксируй найденные риски и несовместимости до редактирования.
5. Не начинай широкий рефакторинг без необходимости для acceptance criteria.

### Scope

1. Создай worklog draft service.
2. Источники: schedule tasks, normalized messages, acts.
3. Добавь `sourceType` и `evidenceStatus`.
4. Не превращай planned entries в фактические.
5. MCP `get_worklog_draft`.
6. MCP `generate_worklog_draft`/export.
7. Создай handover readiness service.
8. MCP `check_handover_readiness`.
9. MCP `build_execution_package`.
10. Package содержит manifest и доступные artifacts.
11. Добавь checksum и artifact metadata.
12. Сформируй ZIP безопасно и ограничь размер.

### Non-goals

- Не заявлять полный нормативный ОЖР.
- Не подписывать документы.
- Не включать файлы другого объекта.
- Не скрывать missing artifacts.
- Не генерировать фактические записи без сообщения/акта.

### Обязательные контракты

- `planned`, `reported`, `act_confirmed` различаются.
- Manifest перечисляет blockers/warnings/assumptions.
- Final package блокируется по критическим issues.
- Draft package может быть создан с явной отметкой.
- ZIP filename безопасный.
- Download требует auth/ownership.
- Package build идемпотентен для одного input hash.

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

- Черновой журнал явно различает плановые и фактические записи.
- Manifest содержит все ожидаемые artifacts и missing items.
- Final package нельзя создать при critical blocker.
- Draft package содержит явную маркировку.
- В ZIP нет файлов другого объекта.
- Повторный build с тем же input hash не создаёт лишние дубли.

### Проверки

- Worklog source precedence tests.
- Planned vs actual tests.
- Manifest fixture.
- ZIP content/checksum test.
- Cross-object exclusion.
- Size limit failure.

Обязательно выполнить:

```bash
npm run check
npm test
npm run build
```

### Риски и особые замечания

В MVP документ следует называть «черновик журнала», если не реализованы все обязательные разделы конкретной нормативной формы.

### Формат финального отчёта

1. Краткий результат.
2. Изменённые файлы.
3. Миграции и совместимость.
4. Добавленные/изменённые контракты.
5. Тесты и фактические результаты команд.
6. Ручной smoke-сценарий.
7. Известные ограничения.
8. Следующая зависимая TASK.
