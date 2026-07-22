# Чеклист ревью: Backend PR

> Проект: TelegramJurnalRabot · Модули: `server/routes/*`, `server/storage.ts`, `shared/routes.ts`
> Референсы: `docs/tasktreckerroutes.md` (smoke-лист), `.cursor/skills/security-guidelines/SKILL.md`, `ai_docs/develop/issues/ISS-*`

## Статус для PR `4dadebe` (2026-07-22)

- [x] `npm run check` + `npm run build` — пройдены
- [x] Изменения отражены в `docs/changelog.md`
- [x] Контракт `documents.delete`/`documentBindings.delete` обновлён в `shared/routes.ts`
- [x] На DELETE endpoints добавлены `appAuth` + `resolveCurrentObject`
- [x] Добавлена object-aware проверка владения в `server/storage.ts` (защита от IDOR)
- [x] `use-documents` destructive mutations переведены на общий `apiRequest` (JWT/Telegram headers + 401 flow)
- [x] Восстановлена CJS-совместимость PDF runtime (`createRequire(__filename)`)
- [x] Добавлены контрактные тесты delete endpoints в `tests/`
- [ ] Полный ручной smoke всех backend-доменов из `docs/tasktreckerroutes.md` (осталось)
- [ ] Расширение тестов до интеграционных сценариев удаления/доступа (осталось)

## 0. Гейты

- [ ] `npm run check` + `npm run build` (важно: сервер собирается в CJS — нет `import.meta.url` без fallback)
- [ ] PR = один домен (`admin` / `materials` / `schedule` / ...), диспетчер `server/routes.ts` остаётся тонким
- [ ] Изменение описано в `docs/changelog.md` (API/config/security/deps)

## 1. Контракт API

- [ ] Новые/изменённые endpoints описаны в `shared/routes.ts` (Zod — единый источник истины)
- [ ] Вход валидируется Zod на сервере (не только на клиенте)
- [ ] Формат ошибок единый через `handleError` из `_common.ts` (см. ISS-009)
- [ ] Breaking change явно указан в описании PR; клиентские хуки обновлены

## 2. Безопасность (критический блок)

- [ ] `authMiddleware` (`appAuth`) на всех непубличных маршрутах; `adminAuth` на `/api/admin/*`
- [ ] **Object isolation**: `resolveCurrentObject` / проверка владения — нет IDOR (доступ к чужому объекту по id)
- [ ] Rate limiters сохранены/добавлены (voice, invoice-parse, auth)
- [ ] Upload: multer limits + MIME-фильтр; proxy к invoice-extractor с SSRF-защитой
- [ ] Нет секретов/токенов в коде, конфиге, логах; нет логирования паролей/JWT
- [ ] Только Drizzle/параметризованные запросы — нет конкатенации SQL
- [ ] Роли — константы/enum, не magic strings (ISS-003)

## 3. Качество кода

- [ ] Нет `any` (ISS-010); типы выводятся из Zod (`z.infer`)
- [ ] Внешние вызовы (OpenAI, invoice-extractor, PDF) обёрнуты в try/catch с осмысленной ошибкой — нет «тихих» сбоев
- [ ] Нет N+1: списки грузятся батчем/join, не запросом в цикле
- [ ] Общие хелперы — в `_common.ts` / `_dateUtils.ts`, без дублирования между модулями
- [ ] Функции < 30 строк, один уровень абстракции; нет мёртвого кода

## 4. Данные и хранилище

- [ ] Логика работы с БД — в `server/storage.ts`, роуты не лезут в Drizzle напрямую (если так принято в домене)
- [ ] `updated_at` не выставляется руками (только триггер)
- [ ] Идемпотентность/дедуп для импортов (Excel, PDF-счета) сохранена

## 5. Ручной smoke (по затронутому домену)

Из `docs/tasktreckerroutes.md` Фаза 3 — выбрать релевантное:

- [ ] Auth (Telegram + email)
- [ ] Objects CRUD + выбор текущего
- [ ] Materials list/create + parse invoice
- [ ] Schedule tasks + split
- [ ] Generate acts + export PDF + `GET /api/pdfs/:filename`
- [ ] Admin: users / tariffs / materials-catalog import

## 6. Middleware parity (для рефакторингов)

- [ ] Кол-во `appAuth` / `adminAuth` / `requireFeature` / `requireQuota` / rate limiters / multer-конфигов не уменьшилось без причины

## Вердикт

**Blocker**: IDOR, отсутствие auth, утечка секретов, сломан generate-acts/PDF · **Major**: смена контракта без обновления `shared/routes.ts`, потеря middleware, N+1 на горячем пути · **Minor/Nit**: naming, дублирование, формат ошибок
