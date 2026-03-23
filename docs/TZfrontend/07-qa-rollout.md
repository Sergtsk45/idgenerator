# ТЗ-07: QA & Rollout Strategy (Tablet UI)

**Дата:** 2026-03-10  
**Статус:** Draft  
**Версия:** 1.0  
**Аудитория:** QA, DevOps, Product Owner, Frontend Lead  

---

## 📋 Оглавление
1. [Обзор](#обзор)
2. [Текущие риски](#текущие-риски)
3. [Целевой UX](#целевой-ux)
4. [Тестовая стратегия](#тестовая-стратегия)
5. [Breakpoint & Device Matrix](#breakpoint--device-matrix)
6. [Telegram & Browser Matrix](#telegram--browser-matrix)
7. [Рegressions Testing](#regressions-testing)
8. [Performance Testing](#performance-testing)
9. [Accessibility Testing](#accessibility-testing)
10. [Security Testing](#security-testing)
11. [Rollout Plan](#rollout-plan)
12. [Definition of Done](#definition-of-done)

---

## Обзор

### Scope
Документация QA стратегии и rollout плана для tablet UI development:
- **ТЗ-05:** Source Data, Materials, Documents screens
- **ТЗ-06:** Objects, Settings, Admin screens

### Тестовые области
- Functional testing (CRUD, navigation, flows)
- Visual regression testing (Chromatic / Percy)
- Accessibility testing (WCAG 2.1 AA)
- Performance testing (Lighthouse, core web vitals)
- Security testing (OWASP, auth, data)
- Cross-browser testing (Chrome, Safari, Firefox)
- Cross-device testing (tablets, mobile fallback)
- Telegram bot integration testing
- Browser fallback testing

### Инструменты & Stack
- **E2E:** Playwright / Cypress
- **Unit:** Jest / Vitest
- **Visual:** Chromatic / Percy
- **Accessibility:** axe-core, Lighthouse, WAVE
- **Performance:** Lighthouse, WebPageTest, DevTools
- **Security:** npm audit, OWASP ZAP (optional)
- **Monitoring:** Sentry, LogRocket (optional)

---

## Текущие риски

| Риск | Вероятность | Влияние | Тестирование |
|------|-------------|--------|--------------|
| **Tablet layout breaks на odd screen sizes** | Средняя | Среднее | Breakpoint matrix (200+ sizes) |
| **Performance регрессия при scroll** | Высокая | Высокое | Lighthouse, DevTools profiling |
| **Accessibility регрессия (contrast, labels)** | Средняя | Среднее | axe-core в CI, WAVE manual |
| **Visual differences across browsers** | Средняя | Среднее | Chromatic / Percy visual tests |
| **Concurrency bugs (request retry, state recovery)** | Средняя | Высокое | E2E tests for retry and conflict scenarios |
| **Mobile fallback broken** | Низкая | Среднее | Mobile breakpoint testing |
| **Telegram bot integration regression** | Низкая | Среднее | Bot integration E2E tests |
| **Security: CSRF, XSS in new forms** | Низкая | Критическое | Security code review + npm audit |

---

## Целевой UX

### Общие QA Принципы
- **Quality gates:** Linter → Unit tests → E2E → Visual regression → Performance → Security
- **Automated testing:** As much as possible (70%+ coverage)
- **Manual testing:** Only high-risk areas and user flows
- **Regression prevention:** Visual tests + snapshot tests for UI changes
- **Performance baseline:** Establish metrics before release
- **Documentation:** All test cases documented in Test Rail or similar

### Definition of Quality
- ✅ **Functional correctness:** All acceptance criteria met
- ✅ **Visual consistency:** No regression across browsers
- ✅ **Performance:** Lighthouse ≥85 on tablet device
- ✅ **Accessibility:** WCAG 2.1 AA level (axe-core 0 violations)
- ✅ **Security:** No critical/high vulnerabilities
- ✅ **User confidence:** 99.9% uptime SLA

---

## Тестовая стратегия

### 1. Unit Tests

#### Scope
- Form validation logic (Zod schemas)
- API response parsing
- State management (Context, Zustand mutations)
- Utility functions (formatters, parsers, calculations)
- Cache invalidation logic
- Retry state preservation after failed requests

#### Coverage Target
- **Critical logic:** 100% coverage
- **Components:** 80% coverage (hooks, handlers)
- **Utils:** 95% coverage

#### Example Test Cases
```typescript
// Form validation
describe('SourceDataForm validation', () => {
  it('should require name field', () => {
    const schema = sourceDataSchema;
    expect(() => schema.parse({ name: '' })).toThrow();
  });
  
  it('should validate address format', () => {
    const result = sourceDataSchema.parse({ 
      name: 'Warehouse',
      address: 'invalid-address'
    });
    expect(result.address).toBeUndefined();
  });
});

// API response parsing
describe('parseInvoiceResponse', () => {
  it('should extract invoice fields correctly', () => {
    const response = { invoice_no: 'INV-001', total: 1000 };
    const parsed = parseInvoiceResponse(response);
    expect(parsed).toEqual({ invoiceNo: 'INV-001', total: 1000 });
  });
});

// Network error handling
describe('mutation retry flow', () => {
  it('should keep form state and allow retry after request failure', async () => {
    render(<MaterialForm />);
    fireEvent.click(screen.getByText(/save/i));
    expect(await screen.findByText(/retry/i)).toBeInTheDocument();
  });
});
```

#### Tools & Config
- **Jest** or **Vitest** with 90%+ coverage threshold
- **@testing-library/react** for component tests
- **Mock data:** Fixtures in `/tests/fixtures/`
- **CI:** Run on every commit

### 2. Integration Tests

#### Scope
- Form submission → API call → Cache update
- Object selection → Data refetch → UI update
- Request failure → Retry → Recovery flow
- Authentication → Admin access control
- Multi-step workflows (import PDF → bind → save)

#### Example Test Cases
```typescript
// Form submission flow
describe('Create Material Flow', () => {
  it('should create material with optimistic update', async () => {
    const { user, queryClient } = setup();
    
    await user.click(screen.getByRole('button', { name: /add material/i }));
    await user.type(screen.getByLabelText(/name/i), 'New Material');
    await user.click(screen.getByRole('button', { name: /save/i }));
    
    expect(screen.getByText('New Material')).toBeInTheDocument();
    await waitFor(() => expect(mockApi.create).toHaveBeenCalled());
  });
});

// Network error retry flow
describe('Network Retry', () => {
  it('should keep the form state and show retry UI when request fails', async () => {
    navigator.onLine = false;
    const { user } = setup();
    
    await user.click(screen.getByRole('button', { name: /save/i }));
    expect(screen.getByText(/нет интернета|сервер недоступен/i)).toBeInTheDocument();
    
    navigator.onLine = true;
    dispatchEvent(new Event('online'));
    
    await user.click(screen.getByRole('button', { name: /retry|повторить/i }));
    await waitFor(() => expect(mockApi.create).toHaveBeenCalled());
  });
});

// RBAC check
describe('Admin Access Control', () => {
  it('should deny non-admin access to /admin', () => {
    const { history } = setup({ user: { role: 'user' } });
    
    history.push('/admin');
    expect(screen.getByText(/access denied/i)).toBeInTheDocument();
  });
});
```

#### Tools
- **@testing-library/react** with async utilities
- **MSW (Mock Service Worker)** for API mocking
- **TanStack Query** test utilities
- **localStorage mocks** where browser auth/settings persistence is involved
- **CI:** Run on every commit

### 3. End-to-End (E2E) Tests

#### Scope
- Critical user journeys (Source data CRUD, Material import, Object switch)
- Cross-device flows (Telegram bot → Browser)
- Error handling and retry logic
- Performance scenarios (large data sets)
- Accessibility interactions (keyboard nav, screen reader)

#### Test Scenarios
```gherkin
# scenarios.feature

Scenario: Create and edit material on tablet
  Given I'm on tablet device (iPad 10")
  And I'm logged in as user
  When I click [+ Add Material] button
  And I fill form: Name = "Кирпич М100", Price = "125"
  And I click [Save] button
  Then material appears in list
  And detail panel shows the material
  When I click [Edit] button
  And I change price to "135"
  And I wait for auto-save
  Then detail shows updated price "135"

Scenario: Import PDF invoice with auto-binding
  Given I'm on Documents screen
  And Materials list contains: "Кирпич М100" (SKU: BR-M100-001)
  When I drag PDF file to import area
  And wait for extraction
  Then preview shows extracted fields
  And line items auto-bind to materials
  When I click [Confirm]
  Then document appears in list
  And materials linked correctly

Scenario: Switch object with unsaved changes
  Given I'm editing material for Object A
  And form has unsaved changes
  When I click current object selector
  And select Object B
  Then confirmation dialog appears: "Save changes?"
  When I click [Save & Switch]
  Then changes saved
  And page shows Object B data
  
Scenario: Admin manages users on tablet
  Given I'm logged in as admin
  When I navigate to /admin/users
  Then users table displays on full width (tablet layout)
  When I search for "John"
  Then results filter in <300ms
  When I click user row
  Then user detail drawer opens
  When I click [Edit]
  Then edit modal appears
  And I can edit name, role
  When I click [Save]
  Then changes persisted
  And table refreshes

Scenario: Document upload retry after network failure
  Given I'm on Documents screen
  And network request fails
  When I drag PDF file to import area
  And click [Upload]
  Then upload is not lost from the current form state
  And shows "Не удалось загрузить. Повторить?"
  When I click [Retry]
  Then upload starts again
  And shows progress

Scenario: 404 page on invalid route
  Given I navigate to /invalid-route
  Then 404 page displayed
  And [Go to Dashboard] button works
  When I click [Contact support]
  Then opens support link
```

#### Test Execution Matrix
```
Devices:
- iPad (12.9", landscape & portrait)
- iPad Mini (7.9")
- Samsung Galaxy Tab S (10.5")
- Pixel Tablet (11")
- Desktop Chrome (1920x1080)

Browsers:
- Chrome 90+
- Safari 14+
- Firefox 88+
- Samsung Internet 14+

OS:
- iOS 14+
- Android 10+
- macOS 11+
- Windows 11

Test types:
- Smoke tests (quick): 15 min
- Regression tests (medium): 45 min
- Full test suite (comprehensive): 2+ hours
```

#### Tools
- **Playwright** or **Cypress** with cross-browser support
- **Page Object Model (POM)** pattern for maintainability
- **Fixtures** for test data setup
- **CI:** Run on staging environment after each build
- **Reporting:** Allure Reports with videos/screenshots
- **Parallelization:** 4-8 workers for faster execution

#### Critical E2E Tests (Must Pass)
1. ✅ Source data CRUD (Create, Read, Update, Delete)
2. ✅ Material import & binding flow
3. ✅ Document upload & processing
4. ✅ Object selector & context switching
5. ✅ Network retry & state preservation after failed requests
6. ✅ Admin user creation & deletion
7. ✅ 404 and access denied error pages
8. ✅ Keyboard navigation (Tab, Enter, Escape)
9. ✅ Form validation & error messages

---

## Breakpoint & Device Matrix

### Tablet Breakpoint Definitions
```css
/* Mobile: < 600px */
@media (max-width: 599px) {
  /* Single column, full-width content, drawer for details */
}

/* Tablet: 600px - 1024px */
@media (min-width: 600px) and (max-width: 1023px) {
  /* Master-detail layout (28%/72%), hamburger menu */
}

/* Desktop: > 1024px */
@media (min-width: 1024px) {
  /* Fixed sidebar, 3-column layout */
}
```

### Test Matrix (Responsive Design)
```
┌─────────────────────────────────────────────────┐
│ Breakpoint  │ Test Devices          │ Priorities│
├─────────────────────────────────────────────────┤
│ Mobile      │ • iPhone 12           │ Medium    │
│ < 600px     │ • iPhone SE           │ (fallback │
│             │ • Pixel 6             │  only)    │
│             │                       │           │
│ Tablet      │ • iPad (12.9") P/L    │ Critical  │
│ 600-1024px  │ • iPad Pro (11") P/L  │ (main)    │
│             │ • iPad Mini (7.9") P/L│           │
│             │ • Galaxy Tab S 10.5"  │           │
│             │ • Pixel Tablet 11"    │           │
│             │                       │           │
│ Desktop     │ • 1920x1080 (Chrome)  │ Low       │
│ > 1024px    │ • 1440x900 (Safari)   │ (future)  │
│             │ • 1280x800 (Firefox)  │           │
└─────────────────────────────────────────────────┘
```

### Landscape vs Portrait Testing
```
iPad 12.9":
  - Portrait:  2048x2732 (master 30% / detail 70%)
  - Landscape: 2732x2048 (master 28% / detail 72%)

iPad Mini:
  - Portrait:  1536x2048 (master 35% / detail 65%)
  - Landscape: 2048x1536 (master 30% / detail 70%)

Galaxy Tab S:
  - Portrait:  1600x2560 (master 32% / detail 68%)
  - Landscape: 2560x1600 (master 28% / detail 72%)
```

### Manual Test Cases (Tablet-specific)
```
Test: Master-Detail Layout
- Device: iPad 12.9" portrait
- Setup: Navigate to /source-data
- Action: Tap material card
- Expected: Detail panel opens on right (min 400px width)
- Verify: 
  ✅ Scroll in master list doesn't affect detail
  ✅ Both panels stay visible
  ✅ Touch interactions work in both panes

Test: Orientation Change
- Device: iPad 12.9"
- Setup: Open detail panel
- Action: Rotate device (portrait → landscape)
- Expected: Layout adjusts smoothly
- Verify:
  ✅ Master panel resizes (30% → 28%)
  ✅ Detail panel expands
  ✅ Content reflows without jumps
  ✅ Scroll position maintained

Test: Large Touch Targets
- Device: Any tablet
- Setup: Navigate to form
- Action: Attempt to tap button
- Expected: Min 44x44px tap target
- Verify:
  ✅ Easy to tap with thumb
  ✅ No accidental clicks nearby
  ✅ Focus visual appears

Test: Table Responsive
- Device: iPad
- Setup: Open admin/users
- Action: View in portrait (600px wide)
- Expected: Table responsive
- Verify:
  ✅ Columns stack or scroll
  ✅ No horizontal overflow
  ✅ Readable on narrow width
```

---

## Telegram & Browser Matrix

### Telegram Integration Points
```
Flow:
User (Telegram) → Bot message → Deep link → Web app
                                        ↓
                        /source-data?object_id=123
                        /admin?user_id=456
                        ↓
                   Browser (web UI)
                   
Response:
Browser → Telegram WebApp API → Haptic / Navigation / Auth
```

### Test Scenarios for Telegram
```
Scenario: Deep link from Telegram bot
- Bot sends message: "Click to manage materials"
- User clicks → deep link: /source/materials?source_id=5
- Expected: App loads with correct source context
- Verify:
  ✅ Object selector shows correct source
  ✅ Materials list filtered by source
  ✅ Haptic feedback on tap

Scenario: Telegram WebApp API integration
- App calls: tg.HapticFeedback.impactOccurred('light')
- Browser fallback: No haptic (graceful degradation)
- Expected: No console errors
- Verify:
  ✅ Haptic works in Telegram (if supported)
  ✅ Fallback animation plays on browser

Scenario: Return to Telegram after action
- User completes action in browser
- App calls: tg.close()
- Expected: Browser closes, returns to Telegram
- Verify:
  ✅ Telegram receives close signal
  ✅ Bot context preserved
```

### Browser Compatibility Matrix
```
┌────────────────────────────────────────┐
│ Browser      │ Version │ Tablet │ Pass │
├────────────────────────────────────────┤
│ Chrome       │ 90+     │ Yes    │ ✅   │
│ Safari       │ 14+     │ Yes    │ ✅   │
│ Firefox      │ 88+     │ Yes    │ ✅   │
│ Samsung Int. │ 14+     │ Yes    │ ✅   │
│ Edge         │ 90+     │ Yes    │ ✅   │
│ Opera        │ 76+     │ Yes    │ ⚠️   │
│ Brave        │ 1.20+   │ Yes    │ ✅   │
│ Vivaldi      │ 4+      │ Yes    │ ⚠️   │
└────────────────────────────────────────┘

Legend:
✅ Fully supported & tested
⚠️  Limited testing (Chromium-based, likely works)
❌ Not supported
```

### Browser-specific Test Cases
```
Chrome (main):
- All E2E tests run
- DevTools profiling
- Performance baseline

Safari (critical):
- iOS WebKit behavior (async focus, touch delays)
- localStorage compatibility and request retry UX
- CSS grid/flex rendering

Firefox:
- Form input types
- CSS custom properties
- request cancellation / retry behavior

Samsung Internet:
- Haptic API support
- Deep linking
- Network recovery UX
```

---

## Regressions Testing

### Visual Regression Testing

#### Setup with Chromatic / Percy
```typescript
// cypress.config.ts
export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    setupNodeEvents(on, config) {
      // Visual regression plugin
      require('@chromatic-com/cypress')(on, config);
    },
  },
});

// Example test
describe('Source Data screen visual regression', () => {
  it('should match snapshot on tablet', () => {
    cy.viewport('ipad-2');
    cy.visit('/source-data');
    cy.percySnapshot('source-data-list');
    
    cy.get('[data-testid="material-card"]').first().click();
    cy.percySnapshot('source-data-detail');
  });
});
```

#### Visual Regression Checks
- **Responsive layouts:** Master-detail breakpoints
- **Color & contrast:** Light/dark themes
- **Typography:** Font rendering across browsers
- **Icons & images:** Scaling and alignment
- **Forms & inputs:** States (focus, hover, active, disabled)
- **Modals & drawers:** Overlays and transitions
- **Error states:** Toast messages, validation
- **Loading states:** Spinners, skeletons
- **Dark mode:** All screens in both themes

#### Percy Configuration
```yaml
# .percy.yaml
version: 2
static:
  cleanUrls: true
  include: 'dist/**'

discovery:
  allowed-hosts:
    - localhost
  network-idle-timeout: 750

snapshot:
  widths:
    - 600   # Tablet portrait
    - 768   # Tablet portrait
    - 1024  # Tablet landscape
    - 1280  # Desktop
  min-height: 1024
  disable-animations: false
```

### Snapshot Testing (Jest)
```typescript
// __tests__/components.snapshot.test.tsx
import { render } from '@testing-library/react';
import { SourceDataCard } from './SourceDataCard';

describe('SourceDataCard snapshots', () => {
  it('should match snapshot for normal state', () => {
    const { container } = render(
      <SourceDataCard data={{ id: 1, name: 'Warehouse' }} />
    );
    expect(container).toMatchSnapshot();
  });

  it('should match snapshot for loading state', () => {
    const { container } = render(
      <SourceDataCard data={null} isLoading={true} />
    );
    expect(container).toMatchSnapshot();
  });

  it('should match snapshot for error state', () => {
    const { container } = render(
      <SourceDataCard data={null} error="Load failed" />
    );
    expect(container).toMatchSnapshot();
  });
});
```

### Manual Visual Regression Checks
```
Checklist for each screen:

Source Data:
- [ ] Card layout (mobile, tablet, desktop)
- [ ] Master-detail panel alignment
- [ ] Search input focus state
- [ ] Loading skeleton
- [ ] Empty state illustration
- [ ] Error message styling
- [ ] Toast notifications
- [ ] Modal dialog styling

Materials:
- [ ] Category collapsible styling
- [ ] Material card thumbnails
- [ ] Price history table
- [ ] Tabs styling
- [ ] Inline edit mode
- [ ] Batch action checkboxes

Documents:
- [ ] Drag-drop zone styling
- [ ] File upload progress
- [ ] Invoice preview table
- [ ] Document type tabs
- [ ] Import error messages

Admin:
- [ ] Sidebar navigation
- [ ] User table columns
- [ ] Pagination controls
- [ ] Bulk action checkboxes
- [ ] Modal forms
```

---

## Performance Testing

### Lighthouse Targets (Tablet Device)
```
Target scores (before release):
- Performance:      ≥ 85
- Accessibility:    ≥ 95
- Best Practices:   ≥ 90
- SEO:              ≥ 90

Acceptable ranges (after release):
- Performance:      75-90 (may vary with network)
- Accessibility:    90+
- Best Practices:   85+
- SEO:              90+
```

### Lighthouse Test Cases
```bash
# Run Lighthouse CI on staging
lhci autorun --config=./lighthouserc.json

# Specific page tests
lighthouse /source-data --form-factor=tablet --output-path=./report.html
lighthouse /source/materials --form-factor=tablet
lighthouse /objects --form-factor=tablet
lighthouse /admin/users --form-factor=tablet
```

### Core Web Vitals (CWV) Monitoring
```
LCP (Largest Contentful Paint):   < 2.5s
FID (First Input Delay):          < 100ms
CLS (Cumulative Layout Shift):    < 0.1
TTFB (Time to First Byte):        < 600ms (API dependent)

Tools:
- web-vitals library
- Chrome DevTools
- Sentry Performance Monitoring
- LogRocket (optional)
```

### Performance Test Scenarios
```typescript
// E2E performance tests
describe('Performance: Source Data screen', () => {
  it('should load list in <2 seconds', () => {
    cy.visit('/source-data', { log: false });
    
    cy.window().then((win) => {
      const navigationTiming = win.performance.timing;
      const loadTime = navigationTiming.loadEventEnd - navigationTiming.navigationStart;
      expect(loadTime).toBeLessThan(2000);
    });
  });

  it('should render 100 cards without jank', () => {
    cy.visit('/source-data');
    cy.get('[data-testid="source-card"]').should('have.length', 100);
    
    // Check FPS during scroll
    cy.window().then((win) => {
      const initialTime = performance.now();
      let frames = 0;
      
      const countFrames = () => {
        frames++;
        if (performance.now() - initialTime < 1000) {
          requestAnimationFrame(countFrames);
        }
      };
      
      countFrames();
      expect(frames).toBeGreaterThan(55); // 60 FPS ≈ 60 frames/sec
    });
  });

  it('should search in <300ms', () => {
    cy.visit('/source-data');
    
    const start = performance.now();
    cy.get('[data-testid="search-input"]').type('warehouse', { delay: 50 });
    cy.get('[data-testid="source-card"]').should('have.length.lessThan', 100);
    
    cy.window().then(() => {
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(300);
    });
  });

  it('should handle virtual scroll with >1000 items', () => {
    cy.visit('/source-data?items=1000');
    cy.get('[data-testid="virtualized-list"]').should('exist');
    
    // Only visible items in DOM
    cy.get('[data-testid="source-card"]').should('have.length.lessThan', 50);
  });
});
```

### Memory Profiling
```bash
# Chrome DevTools: Memory tab
# Record timeline while:
1. Load /source-data
2. Scroll through 500 items
3. Switch objects (trigger cache invalidation)
4. Navigate to different screens
5. Return to source-data

Expected:
- Heap size increase: <50MB
- No heap memory leaks (line should go down after GC)
- Long tasks: < 50ms
```

### Network Profiling
```
Target connection: Slow 4G (simulated)
- 4G downlink: 1.6 Mbps
- 4G uplink: 750 Kbps
- Latency: 40ms

Test scenarios:
- List load time with pagination
- Image lazy-load performance
- API timeout handling
- Retry with exponential backoff
```

---

## Accessibility Testing

### WCAG 2.1 AA Compliance Checklist

#### Perceivable
- [ ] 1.3.1 Info and Relationships: All form labels associated
- [ ] 1.4.3 Contrast (Minimum): 4.5:1 for text, 3:1 for graphics
- [ ] 1.4.5 Images of Text: Not used (vectors instead)
- [ ] 1.4.10 Reflow: No horizontal scroll at 400% zoom

#### Operable
- [ ] 2.1.1 Keyboard: All functionality keyboard accessible
- [ ] 2.1.2 No Keyboard Trap: Focus can move to next element
- [ ] 2.4.3 Focus Order: Logical tab order
- [ ] 2.4.7 Focus Visible: Always visible (outline 2px)
- [ ] 2.5.1 Pointer Gestures: No multi-pointer required

#### Understandable
- [ ] 3.1.1 Language of Page: lang attribute set
- [ ] 3.2.1 On Focus: No unexpected context changes
- [ ] 3.3.1 Error Identification: Error messages near fields
- [ ] 3.3.4 Error Prevention: Confirmation for critical actions

#### Robust
- [ ] 4.1.1 Parsing: Valid HTML (no duplicate IDs)
- [ ] 4.1.2 Name, Role, Value: All interactive elements labeled
- [ ] 4.1.3 Status Messages: Live regions for notifications

### Automated Accessibility Testing
```typescript
// axe-core test example
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

describe('Accessibility: Source Data screen', () => {
  it('should not have axe violations', async () => {
    const { container } = render(<SourceDataScreen />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  // Design system compliance tests
  it('should avoid hardcoded visual values and rely on design-system tokens', () => {
    const { container } = render(<SourceDataScreen />);
    const elements = container.querySelectorAll('[style]');
    
    elements.forEach((el) => {
      const inline = el.getAttribute('style') || '';
      // Should NOT have hardcoded colors or fixed visual values outside approved tokens
      expect(inline).not.toMatch(/#[0-9A-F]{6}/i);
      expect(inline).not.toMatch(/\b(border-radius|gap|padding|margin|box-shadow|height|width):\s*\d+px\b/i);
    });
  });

  it('should have visible focus indicators on all interactive elements', () => {
    const { container } = render(<SourceDataScreen />);
    const interactive = container.querySelectorAll('button, input, [role="button"], [role="link"]');
    
    interactive.forEach((el) => {
      el.focus();
      const styles = window.getComputedStyle(el);
      // Focus visible (outline or box-shadow focus_ring)
      const hasFocusIndicator = 
        styles.outline !== 'none' || 
        styles.boxShadow.includes('3px');
      expect(hasFocusIndicator).toBe(true);
      el.blur();
    });
  });

  it('should meet color contrast ratio 4.5:1 for text', () => {
    const { container } = render(<SourceDataScreen />);
    // Use axe-core or color-contrast checker
    const results = await axe(container, {
      rules: {
        'color-contrast': { enabled: true }
      }
    });
    expect(results.violations.filter(v => v.id === 'color-contrast')).toEqual([]);
  });
});

// Run in CI with coverage
// Target: 0 violations (critical + serious)
// Design System: no hardcoded visual values; colors/sizes/states come from tokens
// Touch targets: All interactive elements ≥ 44px on tablet
```

### Manual Accessibility Testing
```
Test: Screen reader (NVDA / JAWS on Windows, VoiceOver on Mac/iOS)

Source Data screen:
- Tab through all elements
- Verify: Each interactive element has label
- Form inputs: Name, instructions, help text announced
- Buttons: Purpose clear ("Add material", not "Button")
- Cards: Announce title, status, actions available
- Error messages: Announced immediately
- Toast notifications: Announced via aria-live

Materials screen:
- Categories: Collapse/expand announced
- Tabs: Current tab announced
- Dropdowns: Options count announced
- Price history table: Headers associated with cells

Admin users:
- Table: Column headers announced
- Rows: User name, role, status announced
- Pagination: Current page, total pages announced

Test: Keyboard navigation
- Tab: Move to next element
- Shift+Tab: Move to previous element
- Enter: Activate button, submit form
- Escape: Close modal / drawer
- Space: Toggle checkbox, expand/collapse
- Arrow keys: Navigate menu items, select items

Test: Color contrast (WebAIM analyzer)
- Text: 4.5:1 ratio minimum
- Buttons: 3:1 ratio minimum
- Icons: 3:1 ratio minimum
- Dark mode: Same ratios

Test: Zoom & magnification
- Zoom to 200%
- Page remains readable
- No horizontal scroll
- Touch targets still accessible
```

### Accessibility Tools
```
Automated:
- axe DevTools (browser extension)
- Lighthouse (Chrome DevTools)
- WAVE (WebAIM)
- jest-axe (testing library)

Manual:
- NVDA (free, Windows)
- JAWS (paid, Windows)
- VoiceOver (free, Mac/iOS)
- TalkBack (free, Android)

Color contrast:
- WebAIM Contrast Checker
- Chrome DevTools color picker
- Stark (Figma plugin)
```

---

## Security Testing

### Security Checklist

#### Authentication & Authorization
- [ ] Login: Password hashing (bcrypt, argon2)
- [ ] Session: Token expiration (30 min inactivity)
- [ ] RBAC: Admin routes require role check
- [ ] CORS: Configured correctly
- [ ] CSRF: Token validation on state-changing requests
- [ ] Content-Security-Policy: Restrictive headers

#### Input Validation
- [ ] Form inputs: Validated client & server
- [ ] File uploads: Type validation (MIME + magic bytes)
- [ ] Max size: PDF < 10MB, image < 5MB
- [ ] Special chars: Escaped in logs, database
- [ ] SQL injection: Parameterized queries used

#### Data Protection
- [ ] HTTPS: All traffic encrypted
- [ ] Passwords: Never logged, never in localStorage
- [ ] Не менять текущую модель хранения токена в рамках tablet UI без отдельного архитектурного решения
- [ ] API keys: Not exposed in client code
- [ ] PII: Masked in logs (email: ...@example.com)

#### Error Handling
- [ ] 500 errors: No stack traces to client
- [ ] 404 errors: No sensitive info leaked
- [ ] Validation: Generic error messages ("Invalid input")
- [ ] Timeouts: User-friendly messages

#### Dependencies
- [ ] npm audit: No critical vulnerabilities
- [ ] Outdated packages: Update regularly
- [ ] License compliance: Check licenses

### OWASP Top 10 (Web) Coverage
```
A01: Broken Access Control
- [ ] Admin access requires role check
- [ ] Users can't access other user's data
- [ ] Object scope enforced

A02: Cryptographic Failures
- [ ] Passwords hashed (bcrypt)
- [ ] HTTPS enforced
- [ ] Не добавляются новые чувствительные данные в browser storage без отдельного решения

A03: Injection
- [ ] No eval() or innerHTML with user input
- [ ] Parameterized database queries
- [ ] Escaped special characters

A04: Insecure Design
- [ ] Authentication flow designed correctly
- [ ] Сетевые ошибки не приводят к потере пользовательского контекста или повреждению данных формы
- [ ] Error messages don't leak info

A05: Security Misconfiguration
- [ ] Security headers set (CSP, HSTS, X-Frame-Options)
- [ ] Default credentials changed
- [ ] Debug mode off in production

A06: Vulnerable Components
- [ ] npm audit: 0 critical vulnerabilities
- [ ] Dependencies updated regularly
- [ ] Known vulnerabilities patched

A07: Auth Failures
- [ ] Session timeout configured
- [ ] Logout clears all sessions
- [ ] Password reset tokens expire
- [ ] MFA optional or required

A08: Data Integrity Failures
- [ ] Mutations validated server-side
- [ ] Optimistic updates rollback on error
- [ ] Conflict resolution handled

A09: Logging Failures
- [ ] Errors logged with context
- [ ] Sensitive data not logged
- [ ] Logs retained for audit

A10: SSRF/XXE
- [ ] File uploads validated
- [ ] No XXE parsing enabled
- [ ] External URLs not trusted
```

### Security Test Cases
```typescript
// Example tests
describe('Security: Authentication', () => {
  it('should not allow access without valid token', async () => {
    const response = await fetch('/api/materials', {
      headers: { 'Authorization': 'Bearer invalid' }
    });
    expect(response.status).toBe(401);
  });

  it('should expire session after inactivity', async () => {
    // Simulate 35 min of inactivity (30 min timeout)
    jest.useFakeTimers();
    jest.advanceTimersByTime(35 * 60 * 1000);
    
    const response = await fetch('/api/materials');
    expect(response.status).toBe(401);
  });
});

describe('Security: Input validation', () => {
  it('should reject oversized files', async () => {
    const largeFile = new File(['x'.repeat(11 * 1024 * 1024)], 'large.pdf');
    const response = await uploadFile(largeFile);
    expect(response.status).toBe(413);
    expect(response.data.error).toContain('too large');
  });

  it('should escape special characters in logs', () => {
    const userInput = '"><script>alert("XSS")</script>';
    const logged = logUserAction(userInput);
    expect(logged).not.toContain('<script>');
  });
});
```

---

## Rollout Plan

### Phase 1: Internal Testing (Week 1-2)
**Participants:** Dev team + QA

```
Week 1:
- [ ] Feature complete (all AC met)
- [ ] Unit tests: 90%+ coverage
- [ ] Integration tests pass
- [ ] Manual testing on target devices
- [ ] Visual regression baseline captured
- [ ] Performance benchmarks established
- [ ] Security code review completed
- [ ] Accessibility audit (axe-core: 0 violations)

Week 2:
- [ ] E2E tests pass on all browsers
- [ ] Performance targets met (Lighthouse 85+)
- [ ] Keyboard navigation tested
- [ ] Network failure and retry scenarios tested
- [ ] Admin access control verified
- [ ] Error handling tested
- [ ] Edge cases covered
- [ ] Documentation complete
```

### Phase 2: Staging Deployment (Week 3)
**Participants:** Dev team + QA + Product Owner

```
Deploy to staging:
- [ ] Database migrations applied
- [ ] API contracts verified
- [ ] Telegram bot integration tested
- [ ] Deep linking tested
- [ ] Monitoring & alerting configured

Test on staging:
- [ ] Smoke tests pass (15 min)
- [ ] Regression tests pass (45 min)
- [ ] Full test suite pass (2+ hours)
- [ ] Performance profiles within bounds
- [ ] No console errors/warnings
- [ ] Sentry/LogRocket clean (no new errors)
- [ ] User acceptance testing (PO approval)
```

### Phase 3: Canary Rollout (Week 4, 5-10% traffic)
**Participants:** 10% of production users

```
Canary deployment:
- [ ] Feature flagged (5-10% rollout)
- [ ] Monitoring metrics collected
- [ ] Error rate: < 0.1% (below baseline)
- [ ] Performance: Baseline ± 10%
- [ ] User feedback: Positive or neutral
- [ ] No critical issues reported

Monitoring checklist:
- Lighthouse score ≥ 75 (tablet device)
- API response time < 1s (p95)
- Error rate < 0.1% (critical only)
- Sentry/LogRocket: No new patterns
- User engagement: Not decreased
- Crash rate: 0 new crashes related to feature
```

### Phase 4: Full Rollout (Week 6, 100% traffic)
**Participants:** All production users

```
Full deployment:
- [ ] Feature flag removed (or kept for quick rollback)
- [ ] All monitoring active
- [ ] Runbook created for incidents
- [ ] Support team trained

Verification:
- [ ] Performance stable over 24 hours
- [ ] Error rates stable
- [ ] User engagement positive
- [ ] No support tickets about feature
- [ ] Rollback plan ready (if needed)

Post-launch:
- [ ] Collect user feedback (surveys)
- [ ] Monitor key metrics (DAU, feature adoption)
- [ ] Plan improvements for next iteration
```

### Rollback Criteria
```
Automatic rollback if:
- Error rate > 1% (compared to baseline)
- Critical bugs reported by 5+ users
- Performance regression > 20%
- Security vulnerability discovered

Manual rollback if:
- Major incident in dependent systems
- Data corruption detected
- User data loss reported
```

### Release Notes Template
```markdown
## Release: Tablet UI for Source Data, Materials, Documents, Admin

### What's New
- ✨ Responsive master-detail layout for tablet (600-1024px)
- ✨ Object selector in bottom sheet (global context)
- ✨ Material import with PDF invoice support
- ✨ Admin dashboard for users, messages, materials
- ✨ Settings screen (account, appearance, notifications)

### Improvements
- 📈 Search performance: <300ms (debounce)
- 📈 Request recovery: retry UX and state preservation on network failures
- 📈 Accessibility: WCAG 2.1 AA compliance
- 📈 Visual regression: Chromatic tests

### Bug Fixes
- 🐛 [#123] Cache invalidation on object switch
- 🐛 [#456] Dirty-state detection on forms
- 🐛 [#789] Haptic feedback fallback

### Breaking Changes
- None

### Migration Guide
- No database migrations required
- No API changes
- Backward compatible with existing sessions

### Known Issues
- [#1000] PDF import timeout >100MB (workaround: use chunked upload)
- [#1001] Dark mode contrast on Safari < 15

### Support
- [Report issue](https://github.com/.../issues)
- [Documentation](https://docs.../tablet-ui)
- [Telegram support bot](https://t.me/...)

### Performance Impact
- Bundle size: +2.3% (new components)
- Lighthouse score: 87 (tablet device)
- Memory usage: +15MB (cache)
```

---

## Definition of Done

### Code Level
- [ ] Feature branch created from `main`
- [ ] Code follows project style guide (ESLint, Prettier)
- [ ] TypeScript: No `any` types, strict mode enabled
- [ ] Tests: Unit + Integration + E2E
  - Unit: 90%+ coverage
  - E2E: All critical user flows
- [ ] No console errors/warnings (only expected logs)
- [ ] No dead code or unused imports
- [ ] Comments: Only for non-obvious logic
- [ ] Commit messages: Clear and descriptive
- [ ] Ready for code review (self-reviewed first)

### Quality Level
- [ ] Code review: Approved by ≥2 senior devs
- [ ] No merge conflicts (rebased on main)
- [ ] Linter: 0 errors, 0 warnings
- [ ] Test coverage: All AC covered
- [ ] Visual regression: No regressions (Chromatic/Percy)
- [ ] Performance: Lighthouse ≥85 (tablet)
- [ ] Accessibility: WCAG 2.1 AA (axe-core 0 violations)
- [ ] Security: No vulnerabilities (npm audit)

### Documentation Level
- [ ] Component documentation (inline comments)
- [ ] API contracts documented (OpenAPI / Postman)
- [ ] User guide / FAQ (if needed)
- [ ] Release notes prepared
- [ ] Screenshots / demos prepared (if needed)
- [ ] Runbook for incidents (if critical feature)

### Testing Level
- [ ] Unit tests passing: `npm run test`
- [ ] Integration tests passing: `npm run test:integration`
- [ ] E2E tests passing: `npm run test:e2e`
- [ ] Visual regression checked: Chromatic
- [ ] Performance baseline: Lighthouse report
- [ ] Accessibility audit: axe-core report (0 violations)
- [ ] Security: OWASP checklist passed
- [ ] Cross-browser: Chrome, Safari, Firefox ✅
- [ ] Cross-device: iPad, Android tablet ✅
- [ ] Network failure and retry scenarios: Tested ✅
- [ ] Error handling: All edge cases tested ✅
- [ ] **Design System Compliance:**
  - [ ] 0 hardcoded visual values (colors, spacing, radius, shadows, control sizes) вне design-system tokens
  - [ ] All colors/sizes from design-system tokens
  - [ ] CSS variables used (var(--color-primary), etc.)
  - [ ] Dark mode support verified
- [ ] **Touch Target Audit (Tablet):**
  - [ ] All buttons ≥ 44×44px
  - [ ] All form inputs ≥ 44px height
  - [ ] All icon buttons with touch padding ≥ 44px
  - [ ] Table rows ≥ 44px for touch
- [ ] **Interactive States:**
  - [ ] Default, hover, active, focus, disabled for all elements
  - [ ] Visible focus indicators (outline 2px or focus_ring)
  - [ ] Color contrast ≥ 4.5:1 in all themes

### Deployment Level
- [ ] Database migrations prepared (if needed)
- [ ] API contracts finalized
- [ ] Feature flags configured (if needed)
- [ ] Monitoring & alerting set up
- [ ] Runbook for troubleshooting
- [ ] Rollback plan documented
- [ ] Support team trained
- [ ] Status page updated (if needed)

### Post-Launch Level
- [ ] Monitoring metrics collected (24h)
- [ ] Error rate stable (< baseline)
- [ ] Performance stable (within ± 10%)
- [ ] User feedback collected
- [ ] No blocking issues
- [ ] Feature adoption tracked
- [ ] Next iteration planned

---

## Контрольный чек-лист завершения

### Pre-QA
- [ ] Product requirements finalized
- [ ] ТЗ-05, ТЗ-06 documented
- [ ] Design mockups approved
- [ ] API contracts defined
- [ ] Test plan reviewed

### QA Execution
- [ ] Test cases documented (Testrail / Jira)
- [ ] Test data prepared
- [ ] Test environments ready
- [ ] CI/CD pipeline configured
- [ ] Test automation 70%+ automated
- [ ] **Design System Tests:**
  - [ ] Color token audit tests written
  - [ ] Touch target size tests added
  - [ ] Interactive state tests added
  - [ ] Dark mode color tests added
- [ ] **Accessibility Tests:**
  - [ ] axe-core integration in CI
  - [ ] Focus indicator checks added
  - [ ] Color contrast validation added
  - [ ] Manual keyboard navigation tested

### Sign-off
- [ ] Dev lead: Code quality approved
- [ ] QA lead: Testing complete, 0 P1/P2 issues
- [ ] Product owner: Feature meets requirements
- [ ] Security team: Security review passed
- [ ] DevOps: Deployment ready

### Launch
- [ ] Release notes approved
- [ ] Monitoring configured
- [ ] Rollback plan ready
- [ ] Support trained
- [ ] Communication sent to users

---

## Ссылки на связанные документы
- [05-source-data-materials-documents.md](./05-source-data-materials-documents.md) - функциональные требования
- [06-objects-settings-admin.md](./06-objects-settings-admin.md) - требования админ/настроек
- Test Rail / Jira: Test cases tracker
- Chromatic: Visual regression baseline
- Lighthouse CI: Performance tracking
- Sentry: Error monitoring
