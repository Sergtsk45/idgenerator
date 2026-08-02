# TASK-003: Upload sessions и импорт сметы в workflow

## Метаданные

- **Тип:** implementation task
- **Зависимости:** TASK-001, TASK-002
- **Результат:** Реализовать безопасную двухэтапную загрузку XLSX и связать существующий импорт сметы с execution workflow.

## Задание агенту

### Роль

Ты — senior TypeScript backend engineer, работающий в существующем репозитории `Sergtsk45/idgenerator`. Твоя задача — выполнить только описанный scope, сохранив совместимость существующего приложения.

### Цель

Реализовать безопасную двухэтапную загрузку XLSX и связать существующий импорт сметы с execution workflow.

### Контекст

MCP tool arguments не подходят для передачи больших бинарных файлов. Нужна upload session и защищённый HTTP upload endpoint.

### Связанные файлы для первичного изучения

- `server/routes/estimates.ts`
- `server/storage.ts`
- `shared/routes.ts`
- `shared/schema.ts`
- клиентский parser смет
- существующая логика upload файлов документов
- `server/document-files.ts`

Список не является исчерпывающим. Найди фактические зависимости через импорты, схемы и тесты.

### Обязательные первые действия

1. Прочитай все применимые `AGENTS.md`, `.cursor/rules`, ADR и документацию.
2. Изучи текущий код и существующие тесты; не предполагай отсутствующие контракты.
3. Дай краткий план из 3–7 пунктов.
4. Зафиксируй найденные риски и несовместимости до редактирования.
5. Не начинай широкий рефакторинг без необходимости для acceptance criteria.

### Scope

1. Добавь таблицу/модель upload sessions.
2. MCP tool `create_upload_session` возвращает upload ID, URL, ограничения и expiry.
3. Создай HTTP endpoint загрузки.
4. Проверяй extension, MIME/signature, размер, sha256.
5. Добавь purpose `estimate`.
6. Вынеси существующую бизнес-логику импорта сметы в reusable service.
7. MCP tool `import_estimate_from_upload`.
8. Свяжи estimate ID с workflow.
9. Удали/пометь upload consumed после успеха.
10. Реализуй безопасный retry.

### Non-goals

- Не поддерживать произвольные PDF.
- Не менять формат существующего Excel parser без необходимости.
- Не хранить base64 в БД.
- Не принимать внешний URL.
- Не реализовывать OCR.

### Обязательные контракты

- Upload session одноразовая, ограничена user/object/purpose.
- Срок жизни по умолчанию не более 30 минут.
- Повторный import с idempotency key возвращает тот же estimate.
- Проверка ownership до чтения файла.
- Error codes: `UPLOAD_EXPIRED`, `UPLOAD_NOT_FOUND`, `UPLOAD_ALREADY_CONSUMED`, `FILE_TYPE_NOT_ALLOWED`, `FILE_TOO_LARGE`, `ESTIMATE_IMPORT_FAILED`.
- Исходный файл хранится с непрогнозируемым storage key.

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

- Успешная загрузка поддерживаемого XLSX.
- PDF/EXE отклоняется.
- Пользователь B не импортирует upload A.
- Повторный tool call не создаёт вторую смету.
- Существующий REST import работает через тот же service.

### Проверки

- Unit tests validation/signature.
- Integration upload/import.
- Ownership and expiry tests.
- Idempotency test.
- Regression test REST import.

Обязательно выполнить:

```bash
npm run check
npm test
npm run build
```

### Риски и особые замечания

Клиентский parser может быть тесно связан с browser APIs. При необходимости вынеси общий parsing core или зафиксируй server-side input contract без дублирования.

### Формат финального отчёта

1. Краткий результат.
2. Изменённые файлы.
3. Миграции и совместимость.
4. Добавленные/изменённые контракты.
5. Тесты и фактические результаты команд.
6. Ручной smoke-сценарий.
7. Известные ограничения.
8. Следующая зависимая TASK.
