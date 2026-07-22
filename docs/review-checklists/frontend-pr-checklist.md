# Чеклист ревью: Frontend PR

> Проект: idgenerator · перенос ревью из TJR `feature/tablet-ui-v2`
> Референсы: `docs/stilegidtopus/styleguide-odoo-tjr.md`, `docs/TZfrontend/07-qa-rollout.md`, `client/src/lib/navigation.ts`

## Статус для PR `4dadebe` (2026-07-22)

- [x] `npm run check` — пройден
- [x] `npm run build` — пройден
- [x] Изменение отражено в `docs/changelog.md`
- [x] Active-state для `/acts/:id` исправлен в `client/src/lib/navigation.ts`
- [x] Убрано дублирование nav surfaces на tablet (`BottomNav`/`ResponsiveShell`/`Header`)
- [x] Исправлен `showBack` на `ActDetail`
- [x] Исправлена прокрутка и reconnect `IntersectionObserver` на `SourceDocuments`/`SourceMaterials`
- [x] Добавлены подтверждения перед unlink/delete документа
- [ ] Полный ручной smoke по всем затронутым экранам (осталось)
- [ ] Полная проверка UI-пунктов (контраст, токены, таблицы ЖР) по всему приложению (осталось)

## 0. Гейты (перед чтением кода)

- [ ] `npm run check` — TypeScript без ошибок
- [ ] `npm run build` — сборка проходит
- [ ] PR < 400 строк (макс. 1000), одна задача/экран
- [ ] Изменение описано в `docs/changelog.md` (если user-visible)

## 1. Контракты и данные

- [ ] Клиентские хуки соответствуют `shared/routes.ts` (Zod-типы, не `any`)
- [ ] Мутации инвалидируют нужные query-ключи (`invalidateQueries`)
- [ ] **Object-aware**: данные не «перетекают» при смене текущего объекта
- [ ] Нет клиентской валидации без серверного дубля

## 2. UI / Odoo Design System

- [ ] Только токены: `--p*`, `--g*`, `--o-*` — нет hardcoded цветов/размеров/теней
- [ ] `OdooCard` / `OdooBadge` / pill-кнопки — нет glass/blur, нет outline-badge для статусов
- [ ] Skeleton на первичной загрузке (не спиннер); спиннер — только inline-действия
- [ ] Empty state и error state для каждого списка
- [ ] Иконки Lucide `strokeWidth=1.5`; числа в таблицах `tabular-nums`
- [ ] ⚠️ Шапки таблиц ЖР (Разд. 1–5) — НЕ изменены

## 3. Адаптивность (обязательно 3 зоны)

- [ ] **Mobile < 768px** — нет регресса: BottomNav, safe-area (`pb-safe`), overflow карточек
- [ ] **Tablet 768–1024px** — top-nav через `ResponsiveShell`, нет дублирования с `Header`
- [ ] **Desktop > 1024px** — sidebar, `BottomNav` скрыт (`lg:hidden`)
- [ ] Touch targets ≥ 44×44px (кнопки, инпуты, строки таблиц)
- [ ] Контраст текста ≥ 4.5:1

## 4. Навигация и состояние

- [ ] Active-state корректен для nested-маршрутов (`/source/materials/:id` и т.п.)
- [ ] Telegram BackButton / `onBack` согласованы с уровнем стека
- [ ] Dirty-state форм не теряется при смене вкладки/объекта (или явно сбрасывается)
- [ ] Диалоги/Sheet не ломаются при resize и смене табов (был баг в Schedule)

## 5. Ручной smoke (по затронутому экрану)

- [ ] `npm run dev` → вход `admin@admin.com / 12345678`
- [ ] Пройден основной сценарий экрана + один edge case (пустой список, ошибка сети)
- [ ] Консоль браузера без ошибок/новых warning

## 6. Типичные ловушки проекта

- [ ] Не сломаны стабильные экраны из `main` (`WorkLog.tsx`, `Works.tsx` уже откатывались)
- [ ] При возврате между экранами не теряется контекст (пример: actTemplate при возврате из материалов задачи)

## Вердикт

**Blocker**: регресс mobile, потеря данных формы, IDOR через клиент · **Major**: неверная инвалидация кэша, дубли навигации, hardcoded токены массово · **Minor/Nit**: стиль, naming, missing empty state
