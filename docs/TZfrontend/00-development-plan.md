# Tablet UI для TelegramJurnalRabot — Детальный план разработки

**Дата**: 2026-03-10  
**Статус**: Draft  
**Версия плана**: 1.0

---

## 1. Цели проекта

### Primary Goals
1. **Расширить поддержку планшетов (iPad, Android tablets)** без регрессии на мобильных
2. **Адаптировать shell (Header, BottomNav, navigation)** для breakpoints lg+ (1024px+)
3. **Оптимизировать сложные экраны** (Schedule/Gantt, Tables, Forms) для горизонтального использования
4. **Поддержать Telegram MiniApp** и browser режимы на всех breakpoints
5. **Обеспечить кроссбраузерную совместимость** и доступность (A11y)
6. **Сохранить мобильный UX** без regression на размерах <768px

### Secondary Goals
- Улучшить performance на планшетах (lazy loading, virtualization для больших таблиц)
- Добавить keyboard navigation и focus management
- Поддержать landscape orientation (rotate events, safe-area)
- Обновить документацию и примеры компонентов

---

## 2. Scope

### In Scope ✅
- **Breakpoints**: md (768px), lg (1024px), xl (1280px), 2xl (1536px)
- **Shell components**: Header, BottomNav, Sidebar (tablet-только)
- **Navigation patterns**: hamburger menu (mobile), top nav + sidebar (tablet)
- **Dialogs & Sheets**: responsive (mobile fullscreen → tablet modal)
- **Tabtops**: горизонтальный scroll → tab bar с overflow handling
- **Tables**: горизонтальный scroll → полноширинные с sticky headers
- **Gantt Chart** (`/schedule`): масштабируемая временная шкала
- **Forms**: two-column layout (tablet), single-column (mobile)
- **Safe-area & fullscreen**: ещё корректнее для iPad
- **Object switching**: query cache invalidation по всей app
- **Mobile-first CSS**: существующие mobile стили сохранены, tablet — расширение
- **Telegram + Browser режимы**: оба работают на всех breakpoints

### Out of Scope ❌
- Поддержка IE11 / очень старых браузеров
- Desktop версия (3+ column layouts, desktop-only UI)
- PWA / offline (не требуется по scope)
- Native мобильное приложение (только web)
- Локализация новых элементов (используются существующие переводы)

---

## 3. Основные требования (High-Level)

### Архитектурные требования
- ⭐ **Design System Compliance** — ВСЕ компоненты tablet UI должны строго соответствовать Design System (см. `design-system-12.03.2026-design-system/`). Запрет на hardcoded цвета, размеры, spacing — только design-system tokens
- **Mobile-first approach** — мобильные стили базовые, tablet стили — расширение
- **CSS-in-Tailwind** — использовать только responsive utilities, никаких media queries в компонентах
- **Responsive tokens** — tailwind переменные для spacing, font-size по breakpoints, дополняющие design-system
- **State isolation** — при адаптации не ломать текущую модель данных; dirty-state и переключение объекта должны обрабатываться явно
- **Object-aware queries** — все хуки `useWorks()`, `useMessages()`, `useActs()` и связанные запросы должны корректно реагировать на смену текущего объекта
- **Query cache invalidation** — явная инвалидация при переключении объекта
- **Tablet-specific patterns** — Sidebar, Master-Detail, Split Views используются только на lg+

### Performance требования
- **LCP** (Largest Contentful Paint): < 2.5s на 4G (мобильных), < 1.5s на планшетах
- **FID** (First Input Delay): < 100ms
- **CLS** (Cumulative Layout Shift): < 0.1
- **Таблицы** > 500 строк: виртуализация (TanStack Virtual)
- **Ганта** > 100 задач: lazy rendering
- **Bundle size**: не более +15% от текущего (tablet новых компонентов)

### Доступность (WCAG 2.1 AA minimum)
- Keyboard navigation: Tab, Shift+Tab, Enter, Escape, Arrow keys
- Screen reader: semantic HTML, aria-* атрибуты
- Focus visible: `:focus-visible` для всех интерактивных элементов
- Color contrast: ≥ 4.5:1 для текста
- Respects prefers-reduced-motion

### Безопасность
- XSS protection: React escaping (встроено)
- Auth storage и API-контракты не меняются в рамках tablet UI; используется текущая модель проекта
- Telegram auth: проверка подписи на сервере (нет изменений)
- JWT/browser flow и Telegram initData flow должны сохранить текущую совместимость без введения новой auth-схемы

---

## 4. Этапы разработки (Phases)

### Phase 1: Foundation Shell (1-2 неделя)
**Цель**: Настроить breakpoints, создать responsive shell, header, navigation.

**Задачи**:
- [ ] Проверить `tailwind.config.ts` и при необходимости уточнить breakpoints md, lg, xl
- [ ] Обновить `client/src/index.css`: responsive tokens (font-size, spacing)
- [ ] Обновить `Header.tsx`: 
  - Desktop: фиксированная left sidebar (меню вместо Sheet)
  - Tablet (lg): меню в header (dropdown или horizontal nav)
  - Mobile: гамбургер Sheet (текущее)
- [ ] Обновить `BottomNav.tsx`:
  - Tablet (lg+): переместить в top nav (horizontal bar)
  - Мобильные: оставить bottom (текущее)
- [ ] Создать `Sidebar.tsx` компонент (tablet lg+)
- [ ] Обновить `App.tsx` layout: условная навигация по breakpoint
- [ ] Обновить `index.css`: safe-area для iPad, landscape orientation

**Deliverables**:
- Актуализированный `tailwind.config.ts` с согласованными breakpoints
- Responsive Header/BottomNav/Sidebar компоненты
- Updated App.tsx layout с условной навигацией
- Обновлённый index.css с safe-area
- **Acceptance criteria**:
  - [ ] На мобильных (< 768px): BottomNav + Header + Hamburger (no regression)
  - [ ] На планшетах (lg): Top nav + Sidebar видны
  - [ ] Header адаптируется к breakpoints
  - [ ] Safe-area работает на iPad
  - [ ] Landscape rotation работает
  - [ ] LCP < 2.5s

---

### Phase 2: Dialogs & Sheets Responsiveness (1 неделя)
**Цель**: Сделать Dialogs responsive (mobile fullscreen, tablet modal).

**Задачи**:
- [ ] Обновить `shadcn/ui dialog.tsx`:
  - Мобильные: fullscreen (нижний Sheet)
  - Tablet: centered modal dialog
- [ ] Обновить `shadcn/ui sheet.tsx`: fullscreen для мобильных
- [ ] Обновить все dialog-использующие компоненты:
  - `Schedule.tsx` dialogs
  - `SourceMaterials.tsx` dialogs
  - `Acts.tsx` dialogs
- [ ] Тестирование: dismiss on ESC, outside click только на tablet
- [ ] Обновить animation для разных breakpoints

**Deliverables**:
- Updated shadcn/ui dialog & sheet components
- Updated page-level dialogs в Schedule, SourceMaterials, Acts
- **Acceptance criteria**:
  - [ ] На мобильных: dialogs = fullscreen (no regression)
  - [ ] На планшетах: dialogs = centered modal
  - [ ] Outside click работает (tablet только)
  - [ ] ESC dismiss работает везде
  - [ ] Animation smooth (нет jank)

---

### Phase 3: Tables & Data-Heavy Screens (1.5 недели)
**Цель**: Адаптировать таблицы, горизонтальные scrolls.

**Задачи**:
- [ ] Обновить `Works.tsx` таблица:
  - Мобильные: горизонтальный scroll, fixed левая колонка (текущее)
  - Tablet (lg): полноширинная таблица, 4-5 колонок видны, sticky header
  - Desktop (xl): добавить filters sidebar
- [ ] Обновить `WorkLog.tsx` таблицы:
  - Мобильные: карточки, горизонтальный tab scroll (текущее)
  - Tablet: tab bar + полноширинная таблица
- [ ] Добавить virtual scrolling для таблиц > 500 строк (TanStack Virtual)
- [ ] Обновить `SourceData.tsx`:
  - Мобильные: горизонтальный scroll карточек (текущее)
  - Tablet: grid 2-3 колонки
- [ ] Обновить `SourceMaterials.tsx` grid:
  - Мобильные: 1 колонка (текущее)
  - Tablet: 2-3 колонки

**Deliverables**:
- Updated Works, WorkLog, SourceData, SourceMaterials components
- Added TanStack Virtual для больших таблиц
- Updated table styles (sticky headers, responsive columns)
- **Acceptance criteria**:
  - [ ] На мобильных: горизонтальный scroll (no regression)
  - [ ] На планшетах: все колонки видны, sticky header
  - [ ] Таблицы > 500 строк: FID < 100ms (виртуализация работает)
  - [ ] Grid на tablet: 2-3 колонки видны
  - [ ] Поиск / фильтры работают везде
  - [ ] Horizontal scroll accessible (keyboard navigation)

---

### Phase 4: Schedule (Gantt) Tablet Optimization (1.5 недели)
**Цель**: Масштабируемая диаграмма Ганта для планшетов.

**Задачи**:
- [ ] Анализ текущей Ганта реализации в `Schedule.tsx`
- [ ] Обновить временную шкалу:
  - Мобильные: месячный view, горизонтальный scroll (текущее)
  - Tablet: недельный/месячный view, zoom controls
- [ ] Добавить Master-Detail (tablet lg):
  - Левая колонка: список задач (sticky)
  - Правая колонка: Ганта шкала + деталь выбранной задачи
- [ ] Обновить редактирование задач (dialogs → modal на tablet)
- [ ] Обновить split task dialog (modal на tablet)
- [ ] Ганта: prevent horizontal scroll jank (горизонтальный скролл синхронизирован с левой колонкой)

**Deliverables**:
- Updated Schedule.tsx для responsive Gantt
- Added zoom controls
- Master-Detail layout для tablet
- Updated split task dialog
- **Acceptance criteria**:
  - [ ] На мобильных: месячный Gantt, горизонтальный scroll (no regression)
  - [ ] На планшетах: Master-Detail видно полностью
  - [ ] Zoom controls работают
  - [ ] Редактирование: modal dialogs на tablet
  - [ ] Синхронизация скроллов работает
  - [ ] Performance: LCP < 2.5s при загрузке 100+ задач

---

### Phase 5: Forms & Input Optimization (1 неделя)
**Цель**: Оптимизировать формы для разных размеров экрана.

**Задачи**:
- [ ] Обновить `TaskMaterialsEditor.tsx` форма:
  - Мобильные: single-column (текущее)
  - Tablet: two-column (материалы слева, документы справа)
- [ ] Обновить `SplitTaskDialog.tsx` форма:
  - Мобильные: vertical stack (текущее)
  - Tablet: two-column (details + preview)
- [ ] Обновить поля ввода (Input, Textarea, Select):
  - Увеличенные touch targets на мобильных
  - Нормальный размер на tablet+
- [ ] Обновить календарь компонент для tablet (больший размер)

**Deliverables**:
- Updated forms с responsive layouts
- Updated input components для touch/mouse
- **Acceptance criteria**:
  - [ ] На мобильных: single-column forms (no regression)
  - [ ] На планшетах: two-column где применимо
  - [ ] Touch targets ≥ 44x44px на мобильных
  - [ ] Keyboard navigation работает везде
  - [ ] Validation error messages видны везде

---

### Phase 6: Pagination, Overflow Handling, Edge Cases (1 неделя)
**Цель**: Обработать edge cases, pagination, overflow.

**Задачи**:
- [ ] Добавить pagination для больших списков (если не virtualization)
- [ ] Overflow handling:
  - Длинные тексты: truncate vs wrap (по breakpoints)
  - Много фильтров: horizontal scroll или collapse (tablet)
  - Много табов: scroll tab bar (mobile) или fixed (tablet)
- [ ] Object switcher:
  - Мобильные: dropdown в Header subtitle (текущее)
  - Tablet: dropdown или sidebar section
- [ ] Landscape mode:
  - Header shorter height
  - BottomNav может стать sidebar (lg+ landscape)
  - Tables: adjust column width
- [ ] Обработать малые landscape экраны (iPad mini в landscape)

**Deliverables**:
- Pagination компоненты
- Overflow handling логика
- Landscape mode optimization
- Object switcher адаптация
- **Acceptance criteria**:
  - [ ] На мобильных landscape: все UI видно без horizontal scroll
  - [ ] На планшетах landscape: эргономичная layout
  - [ ] Overflow текст обрабатывается корректно (ellipsis / wrap)
  - [ ] Object switching: fast, no re-render jank

---

### Phase 7: Telegram & Browser Integration (1 неделя)
**Цель**: Убедиться, что Telegram MiniApp и browser режимы работают везде.

**Задачи**:
- [ ] Протестировать Telegram MainButton / BackButton на tablet:
  - Положение кнопки в Telegram header (не конфликтует с нашей top nav)
  - Size и visibility на разных ориентациях
- [ ] Протестировать safe-area на iPad:
  - Home indicator bottom (нижняя safe-area)
  - Notch top (верхняя safe-area)
  - Keyboard overlay
- [ ] Протестировать theme switching:
  - CSS переменные --tg-theme-* применяются везде
  - Dark mode работает везде
- [ ] Browser режим (не в Telegram):
  - Login/Register должны работать на tablet
  - JWT auth должна работать везде
- [ ] Телеметрия ошибок:
  - Логировать адаптацию-specific ошибки (resize, orientation change)
  - Tracking для Telegram vs Browser режимов

**Deliverables**:
- Test report: Telegram MiniApp на tablet
- Test report: Browser режим на tablet
- Updated telemetry/error logging
- Fix для найденных issues
- **Acceptance criteria**:
  - [ ] Telegram MiniApp: работает на iPad + Android tablet (все ориентации)
  - [ ] Browser режим: работает везде, auth работает
  - [ ] Safe-area: корректна на iOS
  - [ ] MainButton / BackButton не конфликтуют с нашей UI
  - [ ] Theme switching: instant, no FOUC (flash of unstyled content)

---

### Phase 8: Performance & Optimization (1 неделя)
**Цель**: Оптимизировать performance для tablet.

**Задачи**:
- [ ] Lighthouse audit для всех breakpoints
- [ ] Code splitting по routes (Vite dynamic import)
- [ ] Lazy loading для тяжёлых компонентов (Gantt, Table virtualization)
- [ ] Image optimization (если есть)
- [ ] CSS purging: удалить неиспользуемые Tailwind классы
- [ ] Bundle size audit: ensure < +15% от baseline
- [ ] Memory profiling: check для Memory Leaks при navigation
- [ ] Профилирование на реальных устройствах (iPad, Pixel Tablet)

**Deliverables**:
- Performance reports (Lighthouse, Bundle analysis)
- Optimized components (code splitting, lazy loading)
- Real device testing results
- **Acceptance criteria**:
  - [ ] LCP: < 2.5s (4G, mobile), < 1.5s (tablet)
  - [ ] FID: < 100ms везде
  - [ ] CLS: < 0.1 везде
  - [ ] Bundle size: +10-15% max от текущего
  - [ ] Memory stable при navigation (no leaks)

---

### Phase 9: Documentation & Testing (1 неделя)
**Цель**: Полная документация и тестирование.

**Задачи**:
- [ ] Обновить `/docs/frontend.md`: responsive patterns, tablet breakpoints
- [ ] Создать `/docs/responsive-patterns.md`: примеры (Master-Detail, grid, tabs)
- [ ] Создать `/docs/accessibility-checklist.md`: WCAG 2.1 AA checklist
- [ ] Создать `/docs/testing-tablet-ui.md`: как тестировать на разных размерах
- [ ] Unit tests:
  - Responsive utilities
  - Breakpoint-specific logic
- [ ] E2E тесты (Cypress / Playwright):
  - Navigation на разных breakpoints
  - Object switching с query invalidation
  - Dialog responsive behavior
- [ ] Cross-browser тестирование:
  - Chrome (Desktop + Tablet)
  - Safari (iPad)
  - Firefox (Desktop + Tablet)
  - Samsung Internet (Android Tablet)

**Deliverables**:
- Updated docs (responsive patterns, accessibility, testing)
- Test suite (unit + E2E)
- Cross-browser test report
- **Acceptance criteria**:
  - [ ] Docs полные и актуальные
  - [ ] Все экраны протестированы на md, lg, xl breakpoints
  - [ ] Cross-browser: работает везде
  - [ ] A11y: screen reader tested, keyboard navigation работает
  - [ ] All user stories covered (see below)

---

## 5. Deliverables по фазам

| Phase | Deliverable | Completion Date (est.) |
|-------|------------|----------------------|
| 1 | Responsive shell + navigation | Week 1-2 |
| 2 | Responsive dialogs & sheets | Week 2-3 |
| 3 | Responsive tables & data screens | Week 3-5 |
| 4 | Responsive Gantt chart | Week 5-6 |
| 5 | Responsive forms | Week 6-7 |
| 6 | Pagination & overflow handling | Week 7-8 |
| 7 | Telegram & browser integration | Week 8-9 |
| 8 | Performance optimization | Week 9-10 |
| 9 | Documentation & testing | Week 10-11 |

**Total Estimate**: 8-11 weeks (1 frontend developer full-time)

---

## 6. Dependencies

### Internal
- **Design System** (`docs/TZfrontend/design-system-12.03.2026-design-system/`): ⭐ Обязательный visual contract для всех компонентов tablet UI
- Backend API: no changes required (существующий API compatible)
- Database: no changes required
- Authentication: existing JWT + Telegram auth работает везде

### External Libraries
- **TanStack Virtual** (для таблиц > 500 строк): `npm install @tanstack/react-virtual`
- **date-fns** (уже установлена): для work с датами в Gantt
- **Tailwind CSS** (уже установлена): responsive utilities

### Team Dependencies
- **QA**: cross-browser тестирование на tablet, проверка соответствия Design System
- **Design**: Design System (`design-system-12.03.2026-design-system/` уже готов); tablet wireframes / mockups на основе design-system
- **Product**: approval для tablet-specific features (sidebar, master-detail), review design-system compliance

---

## 7. Риски и миtigations

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| Regression на мобильных из-за responsive изменений | High | High | Mobile-first approach, thorough testing на < 768px |
| Performance деградация от Gantt на tablet | High | High | Virtualization, lazy rendering, profiling на реальных device |
| Safe-area issues на iPad | Medium | Medium | Thorough testing на iPad (real device), use notch simulator |
| Keyboard overlay + fixed header conflicts | Medium | Medium | Dynamic viewport height tracking, position: fixed adjustments |
| Browser compatibility issues (старые Safari) | Low | Medium | Test на реальных iPad, fallbacks для CSS features |
| Timeline delays на Phase 4 (Gantt complexity) | Medium | High | Early spike/POC, consider external library (react-gantt) |
| State management issues (object switching) | High | High | Early implementation, query cache tests, object-aware hooks |

---

## 8. Критерии готовности (Definition of Done)

Каждая фаза считается **готовой** если:

- ✅ **Design System Compliance**: Все компоненты используют design-system tokens (цвета, sizes, spacing). Нет hardcoded значений кроме Telegram theme fallback
- ✅ **Code Review**: Reviewer проверил соответствие design-system (CSS переменные, токены, touch targets >= 44px для interactive controls)
- ✅ Все user stories implementед
- ✅ Acceptance criteria пройдены
- ✅ Unit tests: coverage ≥ 80% для new code
- ✅ E2E tests: все основные flows протестированы
- ✅ Cross-browser: tested на Chrome, Safari, Firefox
- ✅ Responsive: tested на md, lg, xl breakpoints (real devices)
- ✅ Accessibility: keyboard navigation, screen reader, contrast
- ✅ Performance: Lighthouse ≥ 85 (Performance score)
- ✅ Documentation: updated, examples provided
- ✅ No console errors / warnings
- ✅ No regressions на мобильных (< 768px)

---

## 9. Test Strategy

### Manual Testing
- **Real device testing**: iPhone SE + iPad (iOS), Pixel 6 + Pixel Tablet (Android)
- **Responsive mode DevTools**: Chrome DevTools, Safari Inspector
- **Rotation testing**: portrait ↔ landscape switches
- **Keyboard testing**: external keyboard on tablet
- **Touch testing**: gestures, long-press, swipe
- **Network conditions**: 4G, WiFi, offline (if applicable)

### Automated Testing
- **Unit tests** (Jest): responsive utils, breakpoint logic
- **E2E tests** (Cypress / Playwright):
  - Navigation flows на разных breakpoints
  - Object switching + query invalidation
  - Dialog open/close
  - Form submission
  - Auth flows
- **Visual regression**: Percy / Chromatic (если бюджет позволяет)

### Test Plan
1. **Phase 1 testing**: Navigation, header, sidebar responsive
2. **Phase 2 testing**: Dialog open/close, fullscreen vs modal
3. **Phase 3 testing**: Table scroll, grid layout, virtual scrolling
4. **Phase 4 testing**: Gantt zoom, master-detail, task editing
5. **Phase 5 testing**: Form layout, validation, submission
6. **Phase 6 testing**: Pagination, overflow, landscape, object switcher
7. **Phase 7 testing**: Telegram MainButton, safe-area, browser auth
8. **Phase 8 testing**: Performance, bundle size, memory leaks
9. **Phase 9 testing**: Full cross-browser, accessibility audit

---

## 10. Приоритеты экранов

**Priority 1** (MVP):
1. Shell (Header, BottomNav, Sidebar) — foundation для всего
2. Home (чат) — most-used screen
3. Schedule (Gantt) — most complex, needs tablet optimization

**Priority 2** (Phase 2):
4. Works (таблица) — data-heavy, needs virtualization
5. Acts (список актов) — two-column layout potential

**Priority 3** (Phase 3):
6. WorkLog (таблицы) — similar to Works
7. SourceData (дашборд) — grid layout
8. SourceMaterials (карточки) — grid layout

**Priority 4** (Phase 4):
9. Settings (настройки) — minimal changes
10. Objects (список объектов) — grid layout

---

## 11. Порядок внедрения без регрессий

### Strategy
1. **Feature branch**: разработка в отдельной ветке `feature/tablet-ui`
2. **Feature flag**: responsive новые компоненты скрытия за feature flag (if necessary)
3. **Gradual rollout**:
   - Phase 1-2: internal testing только
   - Phase 3+: beta release для selected users
   - Phase 9: general release
4. **A/B тестирование**: monitor для performance, errors по breakpoints
5. **Rollback план**: быстрый откат если критические issues

### Backward Compatibility
- Все responsive изменения **additive** (расширение, не замена мобильных стилей)
- Existing mobile styles остаются unchanged
- New tablet-only компоненты (Sidebar, etc.) не влияют на мобильные
- API contracts не меняются

### Migration Path
1. Deploy Phase 1 (shell) с feature flag disabled по умолчанию
2. Enable для 10% users, monitor для 1-2 недели
3. Если OK → 50% users
4. Если OK → 100% users
5. Repeat для каждой Phase

---

## 12. User Stories & Acceptance Scenarios

### Epic 1: Responsive Shell
- **US-1.1**: Как пользователь на планшете, я хочу видеть боковую навигацию (sidebar) слева, чтобы быстро переходить между экранами
  - **AC**: На lg+ видна sidebar, на < lg видна bottom nav / hamburger

- **US-1.2**: Как пользователь iPad, я хочу, чтобы safe-area учитывалась (notch, home indicator), чтобы UI не перекрывалась
  - **AC**: На iPad no overlap, padding применен корректно

### Epic 2: Responsive Tables
- **US-2.1**: Как пользователь на планшете, я хочу видеть полную таблицу ВОР без горизонтального скролла
  - **AC**: На lg все основные колонки видны без скролла, поиск работает

- **US-2.2**: Как пользователь с большим списком работ (500+), я хочу быстрой загрузки и навигации (no lag)
  - **AC**: Virtual scrolling используется, FID < 100ms, LCP < 2.5s

### Epic 3: Gantt Chart
- **US-3.1**: Как пользователь на планшете, я хочу видеть граф работ в master-detail layout
  - **AC**: Список слева, Gantt справа, оба видны одновременно на lg+

- **US-3.2**: Как пользователь, я хочу zoom in/out Gantt chart, чтобы видеть недели или месяцы
  - **AC**: Zoom controls присутствуют, zoom сохраняется при переключении задач

### Epic 4: Dialogs
- **US-4.1**: Как пользователь на мобильном, я хочу fullscreen dialogs
  - **AC**: На < lg dialogs занимают весь экран

- **US-4.2**: Как пользователь на планшете, я хочу centered modal dialogs
  - **AC**: На lg+ dialogs это modal window (не fullscreen), можно dismiss outside-click

### Epic 5: Object Switching
- **US-5.1**: Как пользователь, я хочу быстро переключаться между объектами, чтобы видеть данные для разных объектов
  - **AC**: Object switcher видна везде (Header на мобильных, Sidebar на tablet), переключение instant, query cache invalidated

---

## 13. Monitoring & Metrics

### Technical Metrics
- **Performance**: LCP, FID, CLS (Lighthouse)
- **Bundle size**: +% от baseline
- **Error rate**: JS errors per session
- **User engagement**: bounce rate, session duration по breakpoints

### Business Metrics
- **Adoption**: % users on tablet devices
- **Retention**: DAU / MAU по device type
- **Satisfaction**: NPS для tablet users

### Monitoring Tools
- **Sentry**: error tracking
- **Datadog / New Relic**: performance monitoring (optional)
- **Google Analytics 4**: breakpoint tracking, user flows
- **Lighthouse CI**: automated performance testing (if available)

---

## 14. Sign-off & Approval

**Stakeholders**:
- Product Owner: approve scope, priorities, timeline
- Tech Lead: approve architecture decisions, phase structure
- QA Lead: approve test strategy, device list
- Frontend Lead: approve implementation approach

**Go/No-go decisions**:
- After Phase 1: shell responsive? → go to Phase 2
- After Phase 3: tables performant? → go to Phase 4
- After Phase 7: Telegram integration stable? → go to Phase 8
- After Phase 9: all tests passing? → ready for release

---

## Conclusion

Этот план структурирует разработку tablet UI в 9 фаз с четкими deliverables, acceptance criteria, и risk mitigation. Фокус на **mobile-first, no regressions, performance, and accessibility** обеспечит качественный результат.

**Next step**: Обсудить с Product Owner приоритеты экранов (может ли Phase 3 быть раньше Phase 4 если Gantt менее критичен?), получить approval на timeline, и начать Phase 1.
