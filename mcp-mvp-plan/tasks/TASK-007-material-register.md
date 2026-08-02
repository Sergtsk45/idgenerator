# TASK-007: Реестр материалов, оборудования и требования к документам

## Метаданные

- **Тип:** implementation task
- **Зависимости:** TASK-004, TASK-006
- **Результат:** Построить из ресурсов сметы проверяемый реестр project materials и определить минимально требуемые документы.

## Задание агенту

### Роль

Ты — senior TypeScript backend engineer, работающий в существующем репозитории `Sergtsk45/idgenerator`. Твоя задача — выполнить только описанный scope, сохранив совместимость существующего приложения.

### Цель

Построить из ресурсов сметы проверяемый реестр project materials и определить минимально требуемые документы.

### Контекст

Система должна объяснить, почему запрошен сертификат или паспорт, и позволить пользователю исправить классификацию.

### Связанные файлы для первичного изучения

- `server/routes/materials.ts`
- `server/storage.ts`
- `shared/schema.ts`: materialsCatalog, projectMaterials, estimate positions/resources
- estimate analysis
- task material linking
- `shared/documentBinding.ts`

Список не является исчерпывающим. Найди фактические зависимости через импорты, схемы и тесты.

### Обязательные первые действия

1. Прочитай все применимые `AGENTS.md`, `.cursor/rules`, ADR и документацию.
2. Изучи текущий код и существующие тесты; не предполагай отсутствующие контракты.
3. Дай краткий план из 3–7 пунктов.
4. Зафиксируй найденные риски и несовместимости до редактирования.
5. Не начинай широкий рефакторинг без необходимости для acceptance criteria.

### Scope

1. Создай material register service.
2. Нормализуй имя/единицу без потери source name.
3. Классифицируй rules-first: material/equipment/product/unclassified.
4. Дедуп только при безопасном совпадении.
5. Сохрани source links к estimate resource IDs.
6. Создай seed rules requirements.
7. MCP `build_material_register`, `get_material_register`.
8. MCP `confirm_material_classification`.
9. MCP `get_missing_quality_documents`.
10. Свяжи materials с schedule tasks по source estimate position.
11. Не перезаписывай ручные классификации при rebuild.

### Non-goals

- Не использовать интернет.
- Не заявлять нормативную достаточность.
- Не удалять существующие project materials.
- Не объединять разные марки/модели только по похожему тексту.
- Не генерировать сертификаты.

### Обязательные контракты

- Каждая строка имеет source IDs.
- Classification содержит method/confidence/confirmed.
- Requirement содержит rule ID и reason.
- Unclassified блокирует автоматическую финальную комплектность, но не просмотр draft.
- Manual override имеет приоритет.
- Rebuild идемпотентен.

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

- Fixture формирует ожидаемые materials/equipment.
- Похожие, но разные марки не объединяются.
- Manual classification сохраняется после rebuild.
- Missing docs отражают bindings.
- Чужой material недоступен.

### Проверки

- Normalization/dedup tests.
- Rule matching tests.
- Idempotency/rebuild tests.
- Ownership tests.
- Task-link integration test.

Обязательно выполнить:

```bash
npm run check
npm test
npm run build
```

### Риски и особые замечания

Схема может потребовать отдельную таблицу source links; не складывать критичные связи только в свободный JSON без индексов.

### Формат финального отчёта

1. Краткий результат.
2. Изменённые файлы.
3. Миграции и совместимость.
4. Добавленные/изменённые контракты.
5. Тесты и фактические результаты команд.
6. Ручной smoke-сценарий.
7. Известные ограничения.
8. Следующая зависимая TASK.
