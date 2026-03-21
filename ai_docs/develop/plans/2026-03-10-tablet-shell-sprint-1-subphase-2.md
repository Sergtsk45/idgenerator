# Plan: Tablet Shell Sprint 1 Subphase 2

**Created:** 2026-03-10
**Orchestration:** orch-2026-03-10-13-00-tablet-shell-s1-subphase-2
**Status:** Ready
**Branch:** `feature/tablet-ui`

## Goal
Безопасно ввести `md/lg+` navigation surfaces на базе уже существующего manifest contract: `top-nav` для `md..lg`, `sidebar/secondary` pattern для `lg+`, при этом не менять `auth`, бизнес-логику, router, state-management и UI framework.

## Constraints
- Работа только в ветке `feature/tablet-ui`; `main` не трогаем.
- Foundation shell и unified navigation contract уже считаются готовой базой.
- Mobile-first остаётся основой: `BottomNav` остаётся только для mobile.
- `Header` не должен превращаться в центр логики; он только потребляет готовые selectors/adapters.
- Временный `md+` fallback через `Header` `Sheet` удаляется только если новые surfaces полностью закрывают navigation без регрессии.
- Любые находки, похожие на существующий дефект из `main`, помечаются как `fix for main` и не входят в реализацию этого плана.

## In Scope
- Использование существующего manifest contract из `client/src/lib/navigation.ts`.
- Добавление минимальных `md/lg+` adapters/surfaces поверх текущей навигации.
- Условное отключение временного `md+` fallback в `Header`.
- Минимальная breakpoint/regression-проверка именно для navigation shell.

## Out of Scope
- Sprint 2+ и массовая адаптация экранов/контентных layout.
- Новые flows, новые экраны, новый router composition.
- Изменения `AuthGuard`, auth flows, TanStack Query, Zustand, Telegram button logic.
- Переработка page-level content containers (`max-w-*`, forms, tables, cards) под tablet layouts.
- Любые дефекты, унаследованные из `main` (`fix for main`).

## Tasks
- [ ] **UI-101: Зафиксировать surface matrix на базе существующего manifest**
  - Priority: Critical
  - Complexity: Simple
  - Dependencies: None
  - Acceptance criteria:
    - подтверждено, какие manifest surfaces покрывают `primary`, `secondary`, `quickAction`;
    - зафиксирован точный mapping для `md..lg top-nav`, `lg+ secondary/sidebar`, mobile-only `BottomNav`;
    - определён gate для удаления временного `Header Sheet` fallback.

- [ ] **UI-102: Ввести `md..lg` top-nav adapter без переноса логики в `Header`**
  - Priority: High
  - Complexity: Moderate
  - Dependencies: UI-101
  - Acceptance criteria:
    - `primary` navigation для `md..lg` рендерится из существующего manifest;
    - active-state использует текущие manifest match rules;
    - `BottomNav` остаётся скрыт на `md+`;
    - `Header` лишь подключает готовый adapter/view, а не хранит новую nav-логику.

- [ ] **UI-103: Добавить `lg+` secondary/sidebar pattern через один тонкий shell-компонент**
  - Priority: High
  - Complexity: Moderate
  - Dependencies: UI-101
  - Acceptance criteria:
    - `secondary` links и `quickAction` для `lg+` доступны через отдельную surface;
    - допустим один минимальный компонент уровня Sprint 1, например `ResponsiveShell.tsx`, только как presentational shell/adaptor;
    - компонент не владеет auth/router/state и не тянет массовую адаптацию страниц.

- [ ] **UI-104: Убрать временный `md+` fallback через `Header Sheet` только по gate**
  - Priority: High
  - Complexity: Simple
  - Dependencies: UI-102, UI-103
  - Acceptance criteria:
    - `Header Sheet` не остаётся единственным способом попасть в `primary/secondary/quickAction` на `md+`;
    - удаление fallback происходит только после подтверждения покрытия новых surfaces;
    - mobile hamburger behavior сохраняется там, где он всё ещё нужен;
    - `BottomNav` по-прежнему mobile-only.

- [ ] **UI-105: Провести узкую regression-проверку shell-navigation и вынести посторонние дефекты**
  - Priority: High
  - Complexity: Simple
  - Dependencies: UI-104
  - Acceptance criteria:
    - проверены переходы `mobile -> md -> lg+` без потери доступа к `primary`, `secondary`, `quickAction`;
    - проверены `/source-data`, `/source/materials`, `/source/materials/:id`, `/source/documents`;
    - найденные дефекты базового приложения маркируются как `fix for main`, а не чинятся в рамках этого подэтапа.

## Dependencies Graph
`UI-101 -> UI-102`

`UI-101 -> UI-103`

`UI-102 + UI-103 -> UI-104 -> UI-105`

## Minimal Files Affected
- `client/src/lib/navigation.ts`
- `client/src/components/Header.tsx`
- `client/src/components/BottomNav.tsx`
- `client/src/components/ResponsiveShell.tsx` (optional, thin presentational shell only)
- `client/src/index.css` (only if minimal shell spacing/visibility tokens are strictly required)

## Files To Avoid In This Subphase
- `client/src/App.tsx`
- `client/src/components/AuthGuard.tsx`
- `client/src/hooks/use-auth.ts`
- массовые правки `client/src/pages/*`

## Risks
- Повторяющиеся page-level контейнеры (`max-w-md`, локальные sticky blocks, page-specific padding) могут визуально ограничить `lg+` shell; это не повод расширять scope на адаптацию экранов.
- Если `Header` начнёт выбирать breakpoints, surface policy и fallback rules одновременно, он станет центром логики и усложнит Sprint 2+.
- Преждевременное удаление `Header Sheet` fallback может сломать доступ к `/objects`, `/settings` или quick action `/` на `md+`.
- Реальные дефекты из текущего приложения могут проявиться при breakpoint-тестах; такие находки должны идти отдельной пометкой `fix for main`.
- `lg+` sidebar легко затронет spacing/content flow; это допустимо только как минимальный shell-layer, без переделки контентных экранов.

## Implementation Notes
- Основываться только на уже существующем manifest contract и текущих `surfaceVisibility`/`activeMatch`.
- Предпочесть один тонкий shell adapter/component вместо разрастания условий внутри `Header`.
- Если для `lg+` sidebar потребуется вмешательство в layout нескольких экранов, это считается выходом за рамки подэтапа и переносится в Sprint 2+.
- Любой спорный пункт решать в пользу mobile-first и минимального diff.
