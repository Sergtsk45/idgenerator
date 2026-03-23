# Plan: Tablet UI Sprint 1 Navigation Contract

**Created:** 2026-03-10
**Orchestration:** orch-2026-03-10-12-18-tablet-nav-contract-s1
**Status:** Ready

## Goal
Декомпозировать и затем реализовать только Sprint 1-подэтап по унификации navigation contract для tablet UI: один source of truth для `Header`, `BottomNav` и будущего responsive shell без изменения auth-модели, бизнес-логики, router, state-management и UI framework.

## Scope
- Унифицировать primary и secondary navigation metadata.
- Сохранить `BottomNav` mobile-first и mobile-only.
- Обеспечить, чтобы `Header` hamburger и будущий md/lg+ shell читали один и тот же contract.
- Учесть вложенные `source`-роуты как часть `source-data`.
- Сохранить browser fallback и не пересечься с Telegram `MainButton` / `BackButton`.

## Out of Scope
- Полная tablet-адаптация экранов.
- Sidebar, top tabs и полноценный responsive shell UI.
- Изменение `wouter` router-схемы, `AuthGuard`, query/state management.
- Исправление дефектов из `main` в рамках этого спринта.

## Tasks
- [ ] UI-001: Провести аудит текущего дублирования навигации и матчинга маршрутов
  - Priority: High
  - Complexity: Simple
  - Files/components affected: `client/src/components/Header.tsx`, `client/src/components/BottomNav.tsx`, `client/src/App.tsx`, nested source pages
  - Acceptance criteria: зафиксированы primary/secondary группы, текущие дубли и вложенные маршруты, которые должны считаться активными для `source-data`

- [ ] UI-002: Определить shared navigation contract как единый source of truth
  - Priority: Critical
  - Complexity: Moderate
  - Dependencies: UI-001
  - Files/components affected: новый helper/config-файл навигации, при необходимости matcher util
  - Acceptance criteria: contract описывает route id, href, nav group, label source, icon reference, visibility per breakpoint, active match rules для nested routes

- [ ] UI-003: Перевести `Header` и `BottomNav` на shared contract
  - Priority: Critical
  - Complexity: Moderate
  - Dependencies: UI-002
  - Files/components affected: `client/src/components/Header.tsx`, `client/src/components/BottomNav.tsx`
  - Acceptance criteria: локальные списки ссылок удалены; `Header` hamburger рендерит secondary links из общего contract; `BottomNav` рендерит только mobile primary items из того же contract

- [ ] UI-004: Подготовить basis для md/lg+ responsive shell без полной адаптации экранов
  - Priority: High
  - Complexity: Moderate
  - Dependencies: UI-003
  - Files/components affected: shared contract types, возможно lightweight shell-facing helper/selector, опционально тонкий scaffold component без переноса экранов
  - Acceptance criteria: в contract есть достаточно данных, чтобы следующий этап построил md tabs и lg sidebar без повторного описания навигации; текущий UI не меняет router и не ломает mobile layout

- [ ] UI-005: Проверить ограничения интеграции и оформить non-scope дефекты отдельно
  - Priority: High
  - Complexity: Simple
  - Dependencies: UI-003, UI-004
  - Files/components affected: `client/src/hooks/use-telegram-main-button.ts`, `client/src/hooks/use-telegram-back-button.ts`, browser fallback helpers, docs notes
  - Acceptance criteria: contract не управляет Telegram buttons; browser fallback не зависит от Telegram presence; найденные баги из `main` помечаются как отдельный `fix for main`

## Dependencies Graph
`UI-001 -> UI-002 -> UI-003 -> UI-004 -> UI-005`

## Architecture Decisions
- Shared navigation source должен быть декларативным, а не зашитым в `Header` или `BottomNav`.
- Активность `source-data` должна определяться через route matching rules, а не только по точному `location === href`.
- Breakpoint behavior должен описываться метаданными contract и Tailwind visibility, а не runtime breakpoint logic в JS.
- Telegram `MainButton` и `BackButton` остаются отдельным каналом управления экраном; navigation contract не должен дублировать их семантику.

## Expected Files
- `client/src/components/Header.tsx`
- `client/src/components/BottomNav.tsx`
- `client/src/config/navigation.ts` or `client/src/lib/navigation-contract.ts`
- `client/src/lib/navigation-match.ts` if active route matching is split out
- `docs/tasktracker.md`
- `docs/changelog.md`
- `docs/project.md` if the contract is treated as frontend architecture baseline

## Risks
- Точное совпадение маршрутов сломает active-state для `/source/materials`, `/source/materials/:id`, `/source/documents`.
- Попытка сразу вынести shell в `App.tsx` может незаметно затронуть router behavior и lifecycle страниц.
- Смесь navigation responsibility и Telegram buttons создаст конфликт UX на detail screens с `BackButton`.
- Если начать править баги из `main` по пути, scope спринта расползется и потеряется изоляция изменений.
