# TASK-008: Загрузка документов качества и безопасная привязка

## Метаданные

- **Тип:** implementation task
- **Зависимости:** TASK-003, TASK-007
- **Результат:** Позволить агенту принять PDF сертификата/паспорта через upload session, создать документ и связать его с материалом или оборудованием.

## Задание агенту

### Роль

Ты — senior TypeScript backend engineer, работающий в существующем репозитории `Sergtsk45/idgenerator`. Твоя задача — выполнить только описанный scope, сохранив совместимость существующего приложения.

### Цель

Позволить агенту принять PDF сертификата/паспорта через upload session, создать документ и связать его с материалом или оборудованием.

### Контекст

Текущая система уже хранит documents и bindings; MCP должен использовать тот же domain contract и ownership.

### Связанные файлы для первичного изучения

- `server/routes/materials.ts`
- `server/document-files.ts`
- document storage methods
- `shared/schema.ts`: documents, documentBindings
- upload sessions из TASK-003
- `shared/documentBinding.ts`

Список не является исчерпывающим. Найди фактические зависимости через импорты, схемы и тесты.

### Обязательные первые действия

1. Прочитай все применимые `AGENTS.md`, `.cursor/rules`, ADR и документацию.
2. Изучи текущий код и существующие тесты; не предполагай отсутствующие контракты.
3. Дай краткий план из 3–7 пунктов.
4. Зафиксируй найденные риски и несовместимости до редактирования.
5. Не начинай широкий рефакторинг без необходимости для acceptance criteria.

### Scope

1. Расширь upload purpose `quality_document`.
2. MCP `attach_document_from_upload`.
3. Input: material ID, doc type, title/number/date, useInActs.
4. Проверяй material ownership и upload ownership.
5. Переиспользуй saveDocumentFile/createDocument/createBinding services.
6. Разреши несколько документов одного материала.
7. Идемпотентность по upload ID + material ID.
8. Обновляй workflow readiness/event log.
9. MCP `list_material_documents`.
10. Возвращай missing document delta.

### Non-goals

- Не выполнять OCR.
- Не извлекать номер документа автоматически.
- Не заменять существующий файл без отдельного флага.
- Не разрешать scheme/other как quality doc автоматически.

### Обязательные контракты

- Только PDF, установленный size limit.
- File path защищён от traversal.
- Binding role определяется валидированным doc type.
- Один consumed upload нельзя привязать к другому материалу.
- Error codes: `DOCUMENT_UPLOAD_INVALID`, `MATERIAL_NOT_OWNED`, `DOCUMENT_ALREADY_ATTACHED`.
- Audit event без содержимого PDF.

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

- PDF сохраняется и доступен авторизованному владельцу.
- Пользователь B не скачивает/привязывает файл A.
- Retry не создаёт второй document/binding.
- Несколько паспортов одного материала поддерживаются.
- Missing list уменьшается после загрузки.

### Проверки

- File validation tests.
- Path traversal test.
- Ownership/download tests.
- Idempotency tests.
- Multiple docs regression tests.

Обязательно выполнить:

```bash
npm run check
npm test
npm run build
```

### Риски и особые замечания

Нет дополнительных замечаний. Все обнаруженные риски отрази в финальном отчёте.

### Формат финального отчёта

1. Краткий результат.
2. Изменённые файлы.
3. Миграции и совместимость.
4. Добавленные/изменённые контракты.
5. Тесты и фактические результаты команд.
6. Ручной smoke-сценарий.
7. Известные ограничения.
8. Следующая зависимая TASK.
