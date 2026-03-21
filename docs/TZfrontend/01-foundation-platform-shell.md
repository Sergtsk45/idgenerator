# Foundation: Platform Shell & Architecture Requirements

**Дата**: 2026-03-10  
**Статус**: Draft  
**Версия**: 1.0

---

## 1. Breakpoints & Responsive Strategy

### Tailwind Breakpoints (Updated)

```javascript
// tailwind.config.ts
export default {
  theme: {
    extend: {
      screens: {
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
        '2xl': '1536px',
      },
    },
  },
};
```

### Breakpoint Mapping

| Breakpoint | Device Type | Width Range | Orientation | Use Case |
|-----------|-----------|-----------|-----------|----------|
| < sm (< 640px) | Small mobile | - | portrait | iPhone SE, old Android |
| sm (640px+) | Mobile | 640-768px | portrait | iPhone 12, 13, 14 |
| md (768px+) | Tablet start | 768-1024px | portrait | iPad mini, iPad (7th gen) |
| lg (1024px+) | Tablet standard | 1024-1280px | landscape, portrait | iPad Air, iPad Pro 11" |
| xl (1280px+) | Large tablet | 1280-1536px | landscape | iPad Pro 12.9" |
| 2xl (1536px+) | Desktop | 1536px+ | - | Desktop browsers |

### Mobile-First Principle

```css
/* BAD: Desktop-first (DON'T DO THIS) */
.container { width: 100%; }
@media (max-width: 768px) { .container { width: 100%; } }

/* GOOD: Mobile-first (DO THIS) */
.container { width: 100%; }           /* mobile default */
@media (min-width: 768px) { ... }     /* md and up */
@media (min-width: 1024px) { ... }    /* lg and up */
```

### Utility Usage (Tailwind)

```jsx
// Responsive utilities — используй Tailwind, НЕ media queries в компонентах!

// GOOD: Tailwind responsive
<div className="p-4 md:p-6 lg:p-8">Content</div>
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">...</div>
<div className="hidden lg:block">Sidebar</div>

// BAD: Manual media queries в CSS
.container { @media (min-width: 1024px) { ... } }
```

---

## 1.5 Design System Integration (Обязательное требование)

**Все визуальные значения компонентов tablet UI должны браться из Design System**. Design System находится в папке `docs/TZfrontend/design-system-12.03.2026-design-system/` и содержит:

### Что регулируется Design System

- 🎨 **Цвета** (primary, secondary, backgrounds, borders, text) — ТОЛЬКО через design-system tokens, запрет на hardcoded цвета
- 📐 **Размеры и Spacing** (padding, margin, gap, width, height) — ТОЛЬКО design-system tokens
- 🔲 **Border Radius** (для карточек, кнопок, input) — design-system values
- 📏 **Typography** (font-size, font-weight, line-height) — design-system typography tokens
- 👆 **Touch Targets** — минимум **44px+** для всех interactive controls (проектное правило accessibility; design-system может содержать 40px как нижнюю границу токенов, но размер hit area контролов не должен быть ниже 44px)
- ✨ **Shadows & Elevation** — design-system shadow tokens
- ⏱️ **Animations & Transitions** — design-system timing functions

### Что остается отдельным инфраструктурным слоем

- Safe-area и Telegram-specific tokens (`--tg-theme-*`)
- Platform-specific adjustments (iOS/Android viewport handling)
- Breakpoint-based layout structure

### Как применять Design System

1. **В CSS/Tailwind**: используйте CSS переменные из `design-system-12.03.2026-design-system.css`
2. **В компонентах**: все hardcoded цвета, размеры, spacing нужно заменить на design-system tokens
3. **В Tailwind config**: может потребоваться extend tailwind с design-system values
4. **Mapping к shell компонентам**:
   - **Header**: background, text color, border, padding из design-system
   - **Sidebar**: background, border color, text color, padding из design-system
   - **Cards**: background, border, shadow, padding из design-system
   - **Buttons**: background, text color, hover state, padding, border-radius из design-system
   - **Forms**: input background, border, focus state, label color из design-system
   - **Badges**: background, text, padding из design-system
   - **Tables**: header background, row hover, border color, spacing из design-system

### Code Review Rules

✅ **Обязательно**:
- Все новые компоненты должны использовать design-system tokens
- CSS переменные должны быть определены в design-system
- Touchable элементы: минимальный hit area **44px** по обеим осям (W × H)

❌ **Запрещено**:
- Hit area интерактивных элементов < 44px (нарушает accessibility guidelines)
- Hardcoded цвета (кроме Telegram theme fallback с явным комментарием)
- Hardcoded размеры spacing (только design-system tokens)
- Hardcoded border-radius (только design-system tokens)

---

## 2. Responsive Tokens & Typography

### Font Sizes (Responsive)

```css
/* client/src/index.css — добавить в @layer base */
:root {
  /* Mobile first */
  --font-xs: 0.75rem;    /* 12px */
  --font-sm: 0.875rem;   /* 14px */
  --font-base: 1rem;     /* 16px */
  --font-lg: 1.125rem;   /* 18px */
  --font-xl: 1.25rem;    /* 20px */
  --font-2xl: 1.5rem;    /* 24px */
}

/* Tailwind utilities for responsive font */
@layer utilities {
  .text-h1 {
    @apply text-2xl md:text-3xl lg:text-4xl font-bold leading-tight;
  }
  .text-h2 {
    @apply text-xl md:text-2xl lg:text-3xl font-semibold;
  }
  .text-body {
    @apply text-base md:text-lg leading-relaxed;
  }
  .text-caption {
    @apply text-xs md:text-sm text-muted-foreground;
  }
}
```

### Spacing & Sizing (Responsive)

```jsx
// GOOD: Responsive spacing
<div className="px-4 md:px-6 lg:px-8 py-3 md:py-4 lg:py-6">
  Content with adaptive padding
</div>

// Gap in grids/flex
<div className="grid gap-3 md:gap-4 lg:gap-6">
  {items.map(item => <Card key={item.id} {...item} />)}
</div>

// Component width
<div className="w-full md:max-w-2xl lg:max-w-4xl mx-auto">
  Centered container
</div>
```

### Safe-area & Viewport Adjustments

```css
/* client/src/index.css */
:root {
  --safe-area-top: max(0px, env(safe-area-inset-top));
  --safe-area-right: max(0px, env(safe-area-inset-right));
  --safe-area-bottom: max(0px, env(safe-area-inset-bottom));
  --safe-area-left: max(0px, env(safe-area-inset-left));
}

@layer utilities {
  .pt-safe { padding-top: var(--safe-area-top); }
  .pb-safe { padding-bottom: var(--safe-area-bottom); }
  .pl-safe { padding-left: var(--safe-area-left); }
  .pr-safe { padding-right: var(--safe-area-right); }
}
```

```jsx
// Usage
<header className="pt-safe">Header with notch support</header>
<nav className="pb-safe">Bottom nav with home indicator</nav>
```

### Viewport Meta Tag (client/index.html)

```html
<meta name="viewport" content="
  width=device-width,
  initial-scale=1.0,
  maximum-scale=1.0,
  user-scalable=no,
  viewport-fit=cover
">
```

---

## 3. Shell Architecture

### Layout Structure

#### Mobile (< md / < 768px)
```
┌─────────────────────────┐ ← Header (sticky, h-14)
│  Menu │ Title │ Action  │
├─────────────────────────┤
│                         │
│  Content (pb-24)        │
│                         │
├─────────────────────────┤ ← BottomNav (fixed, h-16 + pb-safe)
│ Works │ Schedule │ Acts │
└─────────────────────────┘
```

#### Tablet (md / 768px - lg / 1024px)
```
┌─────────────────────────────────────────┐ ← Header (sticky)
│  Menu │ Title │ Search │ Action         │
├──────────────────────────────────────────┤
│                                          │
│  Content (full width, md:pb-0)           │
│                                          │
└──────────────────────────────────────────┘
(BottomNav hidden, navigation in Header or top tabs)
```

#### Tablet with Sidebar (lg / 1024px+)
```
┌────────────────────────────────────────────────────┐ ← Header
│  Brand │ Title │ Search │ Telegram User │ Settings │
├──────────┬──────────────────────────────────────────┤
│ Sidebar  │                                          │
│ --------        Content (lg:pl-64)                 │
│ Works    │                                          │
│ Schedule │                                          │
│ Acts     │                                          │
│ --------        │                                   │
│ Settings │      │                                   │
│ Objects  │                                          │
└──────────┴──────────────────────────────────────────┘
```

### Header Component (Responsive)

```jsx
// client/src/components/Header.tsx (updated)

export function Header({ title, subtitle, ...props }) {
  // Mobile / Tablet: Hamburger + center title
  // lg+: Logo + title + right actions (no hamburger)
  
  return (
    <header className="sticky top-0 z-40 bg-background border-b pt-safe">
      <div className="flex h-14 md:h-16 lg:h-20 items-center px-4 md:px-6 lg:px-8">
        
        {/* Left: Logo or Hamburger */}
        <div className="flex items-center gap-2">
          <button className="lg:hidden">
            {/* Hamburger for mobile/tablet */}
          </button>
          <div className="hidden lg:block">
            {/* Logo for lg+ */}
          </div>
        </div>
        
        {/* Center: Title */}
        <div className="flex-1 text-center mx-2">
          <h1 className="text-base md:text-lg lg:text-xl font-semibold">{title}</h1>
          {subtitle && <p className="text-xs md:text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        
        {/* Right: Actions */}
        <div className="flex items-center gap-1 md:gap-2">
          {/* Actions responsive */}
        </div>
        
      </div>
    </header>
  );
}
```

### Bottom Navigation (Mobile-only)

```jsx
// client/src/components/BottomNav.tsx

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 md:hidden z-50 bg-background border-t pb-safe">
      <div className="flex justify-around h-16">
        {navItems.map(item => <NavItem key={item.href} {...item} />)}
      </div>
    </nav>
  );
}
```

### Sidebar Component (Tablet lg+)

```jsx
// client/src/components/Sidebar.tsx (new)

export function Sidebar() {
  return (
    <aside className="hidden lg:block fixed left-0 top-20 bottom-0 w-64 bg-card border-r overflow-y-auto">
      <nav className="p-4 space-y-1">
        {/* Navigation items */}
        <NavLink href="/works" icon={ClipboardList}>Работы (ВОР)</NavLink>
        <NavLink href="/schedule" icon={CalendarRange}>График</NavLink>
        <NavLink href="/acts" icon={FileCheck}>Акты</NavLink>
        <NavLink href="/worklog" icon={MessageSquare}>Журнал</NavLink>
        <NavLink href="/source-data" icon={FolderOpen}>Исходные</NavLink>
        <Separator className="my-4" />
        <NavLink href="/objects" icon={Map}>Объекты</NavLink>
        <NavLink href="/settings" icon={Settings}>Настройки</NavLink>
      </nav>
    </aside>
  );
}
```

### Main Layout (App.tsx)

```jsx
// client/src/App.tsx (updated)

function AppLayout() {
  return (
    <div className="flex flex-col h-screen">
      <Header title={pageTitle} subtitle={subtitle} />
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />  {/* hidden by default, visible lg+ */}
        
        <main className="flex-1 overflow-y-auto lg:ml-64">
          <div className="md:max-w-full lg:max-w-full px-0 md:px-4 lg:px-6">
            <Routes>
              {/* routes */}
            </Routes>
          </div>
          <div className="md:hidden pb-16" />  {/* Space for BottomNav */}
        </main>
      </div>
      
      <BottomNav />  {/* hidden by default, visible < md */}
    </div>
  );
}
```

---

## 4. Navigation Patterns

### Mobile Navigation (< md / < 768px)
- **Primary**: BottomNav (5 tabs fixed bottom)
- **Secondary**: Hamburger menu (Sheet) in Header
- **Pattern**: Tab bar + Hamburger

### Tablet Navigation (md - lg / 768px - 1024px)
- **Primary**: Horizontal tabs in Header or below Header
- **Secondary**: Hamburger menu (Sheet) or dropdown in Header
- **Pattern**: Tab bar + optional hamburger

### Desktop Navigation (lg+ / 1024px+)
- **Primary**: Sidebar (left, fixed, sticky)
- **Secondary**: Top navigation bar (Header)
- **Pattern**: Sidebar + Header

### Navigation Implementation

```jsx
// Conditional rendering based on breakpoint

export function Navigation() {
  const isMobile = window.innerWidth < 768;
  const isTablet = window.innerWidth >= 768 && window.innerWidth < 1024;
  const isDesktop = window.innerWidth >= 1024;
  
  // Use Tailwind hidden/block utilities instead!
  // No manual breakpoint checks in code
}

// GOOD: Use Tailwind utilities
<nav className="hidden md:flex">Desktop nav</nav>
<nav className="md:hidden">Mobile nav</nav>
```

---

## 5. Header & BottomNav Detailed Specs

### Header (Responsive)

| Property | Mobile | Tablet (md) | Tablet lg | Desktop (xl+) |
|----------|--------|-----------|----------|---------------|
| Height | 56px (h-14) | 56px | 64px (h-16) | 80px (h-20) |
| Position | sticky | sticky | sticky | sticky |
| z-index | 40 | 40 | 40 | 40 |
| Layout | hamburger + title + 1 action | title + 2 actions | title + logo + 3 actions | logo + title + 4+ actions |
| Padding | 1rem (4) | 1.5rem (6) | 2rem (8) | 2rem (8) |
| Background | var(--background) | var(--background) | var(--background) | var(--background) |
| Border-bottom | 1px | 1px | 1px | 1px |
| Safe-area-top | var(--safe-area-top) | var(--safe-area-top) | var(--safe-area-top) | var(--safe-area-top) |

### BottomNav (Mobile-only)

| Property | Value |
|----------|-------|
| Position | fixed bottom-0 |
| Height | 64px (h-16) |
| z-index | 50 |
| Width | 100% |
| Layout | flex, 5 equal tabs |
| Padding-bottom | var(--safe-area-bottom) — для iPad home indicator |
| Background | var(--background) |
| Border-top | 1px |
| Visibility | < md (hidden on md+) |

---

## 6. Dialogs, Sheets & Modals

### Responsive Dialog Behavior

#### Mobile (< md)
```
┌─────────────────────────┐
│ ╳ Title        [Button] │ ← Close button top-right
├─────────────────────────┤
│ Content (fullscreen)    │
│                         │
│                         │
├─────────────────────────┤
│ [Cancel] [OK]           │ ← Actions bottom (sticky)
└─────────────────────────┘
```

#### Tablet (lg+)
```
┌───────────────────────────────────────┐
│ ┌───────────────────────────────────┐ │
│ │ ╳ Dialog Title                    │ │
│ ├───────────────────────────────────┤ │
│ │ Content (centered, 80% width)     │ │
│ │                                   │ │
│ ├───────────────────────────────────┤ │
│ │ [Cancel] [OK]                     │ │ ← Sticky bottom
│ └───────────────────────────────────┘ │
└───────────────────────────────────────┘
```

### Implementation Pattern

```jsx
// client/src/components/ui/dialog.tsx (updated)

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-background/80" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        // Mobile: fullscreen
        "fixed inset-0 md:inset-auto",
        "md:rounded-lg",
        // Tablet: centered, max-width
        "md:left-[50%] md:top-[50%] md:translate-x-[-50%] md:translate-y-[-50%]",
        "md:w-full md:max-w-lg",
        // z-index
        "z-50",
        // Styling
        "border bg-background shadow-lg duration-200",
        className
      )}
      {...props}
    />
  </DialogPrimitive.Portal>
));
```

### Sheet (Slide-out Panel)

```jsx
// Sheets are always fullscreen on mobile, modal on tablet+

<Sheet>
  <SheetTrigger>Open</SheetTrigger>
  <SheetContent className="md:w-96">
    {/* Mobile: slides from bottom (or side) fullscreen */}
    {/* Tablet: slides from side, fixed width (e.g., 384px) */}
    Content
  </SheetContent>
</Sheet>
```

---

## 7. Telegram MiniApp Integration

### MainButton & BackButton (Telegram Header)

Telegram MiniApp API предоставляет две кнопки в header приложения:

```
┌─────────────────────────────────────────────┐
│ ◀ Back │ App Title │ [MainButton]           │ ← Telegram header
├─────────────────────────────────────────────┤
│ [Our Header / Navigation]                   │
├─────────────────────────────────────────────┤
│ Content                                     │
└─────────────────────────────────────────────┘
```

### MainButton Usage

```jsx
// client/src/hooks/useTelegramMainButton.ts (existing)

export function useTelegramMainButton(config: MainButtonConfig) {
  useEffect(() => {
    if (!window.TelegramWebApp) return;
    
    const btn = window.TelegramWebApp.MainButton;
    btn.setText(config.text);
    btn.setParams({ is_visible: config.isVisible, is_active: config.isActive });
    btn.onClick(config.onClick);
    
    return () => btn.hide();
  }, [config]);
}

// Usage in component
function ScheduleScreen() {
  useTelegramMainButton({
    text: 'Создать график',
    isVisible: true,
    isActive: true,
    onClick: () => createSchedule(),
  });
}
```

### BackButton Usage

```jsx
// client/src/hooks/useTelegramBackButton.ts (existing or create)

export function useTelegramBackButton(onBack?: () => void) {
  useEffect(() => {
    if (!window.TelegramWebApp) return;
    
    const btn = window.TelegramWebApp.BackButton;
    if (onBack) {
      btn.show();
      btn.onClick(onBack);
    } else {
      btn.hide();
    }
    
    return () => btn.hide();
  }, [onBack]);
}

// Usage
function DetailScreen() {
  const navigate = useNavigate();
  useTelegramBackButton(() => navigate(-1));
}
```

### Keyboard & Safe-area

```jsx
// Telegram WebApp keyboard events

useEffect(() => {
  const handleViewportChange = () => {
    // Keyboard appears/disappears
    const viewportHeight = window.visualViewport.height;
    // Adjust fixed elements' bottom position
    setKeyboardHeight(window.innerHeight - viewportHeight);
  };
  
  window.visualViewport.addEventListener('resize', handleViewportChange);
  return () => window.visualViewport.removeEventListener('resize', handleViewportChange);
}, []);

// Adjust fixed footer position
<div className="fixed bottom-0 left-0 right-0" style={{
  bottom: `calc(var(--safe-area-bottom) + ${keyboardHeight}px)`
}}>
  Input form
</div>
```

### Fullscreen Support

```jsx
// Telegram fullscreen mode

useEffect(() => {
  if (window.TelegramWebApp) {
    window.TelegramWebApp.expand(); // Expand to fullscreen
  }
}, []);
```

### Theme Variables

```css
/* CSS variables set by Telegram */
:root {
  --tg-theme-bg-color: #ffffff;
  --tg-theme-text-color: #000000;
  --tg-theme-hint-color: #999999;
  --tg-theme-link-color: #3390ec;
  --tg-theme-button-color: #3390ec;
  --tg-theme-button-text-color: #ffffff;
  --tg-theme-secondary-bg-color: #f4f4f5;
  --tg-theme-destructive-text-color: #ef4444;
}
```

```jsx
// Usage in React
<TelegramThemeProvider>
  <App />
</TelegramThemeProvider>

// TelegramThemeProvider updates :root variables based on WebApp.themeParams
```

---

## 8. State Management Rules (Object-Aware)

### Query Cache Architecture

```
QueryClient
├── messages (by objectId)
├── works (by objectId)
├── schedules (by objectId)
├── acts (by objectId)
├── materials (global + by objectId)
├── currentObject (signal state)
└── user (auth state)
```

### Object Switching Flow

```
User clicks object → setCurrentObject(objectId)
    ↓
Invalidate all object-scoped queries
    ↓
queries refetch with new objectId
    ↓
UI updates with new data
```

### Implementation Pattern

```typescript
// current object хранится серверно, UI синхронизируется через query cache
export function useTabletObjectSwitch() {
  const queryClient = useQueryClient();
  const selectObject = useSelectObject();

  return async (objectId: string) => {
    await selectObject.mutateAsync(objectId);

    // После подтверждённой смены объекта UI обязан обновить object-scoped данные
    await queryClient.invalidateQueries();
  };
}

// Для tablet UI дополнительно нужен guard на несохранённые изменения
function handleObjectSwitch(nextObjectId: string) {
  if (formIsDirty) {
    openConfirmDialog({
      title: 'Сменить объект?',
      description: 'Несохранённые изменения будут потеряны.',
      onConfirm: () => switchObject(nextObjectId),
    });
    return;
  }

  switchObject(nextObjectId);
}
```

### Object-Aware Query Hooks

```typescript
// All queries must be aware of currentObjectId

export const useMessages = () => {
  const { data: currentObject } = useCurrentObject();
  
  return useQuery({
    queryKey: ['messages', currentObject?.id],
    queryFn: async () => {
      const response = await fetch(`/api/messages?objectId=${currentObject?.id}`);
      return response.json();
    },
    enabled: !!currentObject?.id, // don't fetch if no object selected
  });
};

export const useWorks = () => {
  const { data: currentObject } = useCurrentObject();
  
  return useQuery({
    queryKey: ['works', currentObject?.id],
    queryFn: async () => {
      const response = await fetch(`/api/works?objectId=${currentObject?.id}`);
      return response.json();
    },
    enabled: !!currentObject?.id,
  });
};
```

---

## 9. Tables & Complex Data Views

### Table Pattern (Responsive)

#### Mobile (horizontal scroll)
```
┌──────────────────┐
│ Name │ Date │... │ ← Sticky left column
├──────────────────┤
│ Work1│ 2026-01... │ ← Horizontal scroll
│ Work2│ 2026-01... │
└──────────────────┘
```

#### Tablet (full table)
```
┌─────────────────────────────────────────────────────┐
│ Name      │ Date       │ Status │ Qty │ Materials  │
├─────────────────────────────────────────────────────┤
│ Work 1    │ 2026-01-01 │ Done   │ 100 │ Brick...   │
│ Work 2    │ 2026-01-02 │ In Prog│ 50  │ Cement...  │
└─────────────────────────────────────────────────────┘
```

### Implementation

```jsx
// client/src/pages/Works.tsx (updated)

export function Works() {
  const { data: works = [] } = useWorks();
  const [searchTerm, setSearchTerm] = useState('');
  
  return (
    <>
      <Header title="Работы" showSearch={true} />
      
      {/* Search */}
      <div className="px-4 py-3 md:px-6 lg:px-8">
        <Input
          placeholder="Поиск..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="md:max-w-sm"
        />
      </div>
      
      {/* Table */}
      <div className="overflow-x-auto md:overflow-x-visible px-4 md:px-6 lg:px-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted">
              <th className="sticky left-0 px-3 py-2 text-left bg-muted">Название</th>
              <th className="px-3 py-2 text-left">Дата</th>
              <th className="px-3 py-2 text-right">Объём</th>
              <th className="px-3 py-2 text-left md:hidden">...</th>
              <th className="hidden md:table-cell px-3 py-2 text-left">Статус</th>
              <th className="hidden lg:table-cell px-3 py-2 text-left">Ответственный</th>
            </tr>
          </thead>
          <tbody>
            {works.map(work => (
              <tr key={work.id} className="border-b hover:bg-muted/50">
                <td className="sticky left-0 px-3 py-2 bg-background">{work.name}</td>
                <td className="px-3 py-2">{formatDate(work.date)}</td>
                <td className="px-3 py-2 text-right">{work.quantity}</td>
                <td className="px-3 py-2 text-center md:hidden">
                  <Button variant="ghost" size="sm">⋮</Button>
                </td>
                <td className="hidden md:table-cell px-3 py-2">{work.status}</td>
                <td className="hidden lg:table-cell px-3 py-2">{work.responsible}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <BottomNav />
    </>
  );
}
```

### Virtual Scrolling (для больших таблиц)

```jsx
// Tables > 500 rows: использовать TanStack Virtual

import { useVirtualizer } from '@tanstack/react-virtual';

export function LargeTable({ data }) {
  const parentRef = useRef(null);
  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40, // row height ~40px
  });
  
  return (
    <div ref={parentRef} className="h-[600px] overflow-auto">
      <table>
        <thead>
          {/* sticky header */}
        </thead>
        <tbody style={{
          height: `${virtualizer.getTotalSize()}px`,
        }}>
          {virtualizer.getVirtualItems().map(virtualItem => (
            <tr key={virtualItem.key} data-index={virtualItem.index} style={{
              transform: `translateY(${virtualItem.start}px)`,
            }}>
              {/* row content */}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

---

## 10. Gantt Chart (Schedule) - Tablet Optimization

### Responsive Gantt Layout

#### Mobile
```
┌────────────────────┐
│ Tasks (scroll) │
├────────────────────┤
│ Timeline (scroll →) │
└────────────────────┘
```

#### Tablet (lg+)
```
┌──────────────────────────────────────────────────┐
│ Tasks (sticky left) │ Timeline (scroll →)        │
├──────────────────────────────────────────────────┤
│                     │                            │
│ Task list panel     │ Gantt chart panel (zoom)   │
│ (sticky top)        │                            │
│                     │ Task details (below)       │
└──────────────────────────────────────────────────┘
```

### Implementation Strategy

```jsx
// client/src/pages/Schedule.tsx (updated)

export function Schedule() {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState('month'); // month, week, day
  
  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full">
      {/* Left: Task List (sticky on lg+) */}
      <div className="lg:w-64 lg:sticky lg:top-20 lg:overflow-y-auto lg:border-r">
        <TaskList
          selectedId={selectedTaskId}
          onSelect={setSelectedTaskId}
        />
      </div>
      
      {/* Right: Gantt Chart */}
      <div className="flex-1 flex flex-col">
        <div className="flex gap-2 pb-2">
          <Button
            variant={zoomLevel === 'day' ? 'default' : 'outline'}
            onClick={() => setZoomLevel('day')}
            size="sm"
          >
            День
          </Button>
          <Button
            variant={zoomLevel === 'week' ? 'default' : 'outline'}
            onClick={() => setZoomLevel('week')}
            size="sm"
          >
            Неделя
          </Button>
          <Button
            variant={zoomLevel === 'month' ? 'default' : 'outline'}
            onClick={() => setZoomLevel('month')}
            size="sm"
          >
            Месяц
          </Button>
        </div>
        
        {/* Gantt Chart */}
        <div className="flex-1 overflow-x-auto">
          <GanttChart
            tasks={tasks}
            selectedTaskId={selectedTaskId}
            zoomLevel={zoomLevel}
          />
        </div>
        
        {/* Task Details (below on mobile, side on lg+) */}
        {selectedTaskId && (
          <div className="mt-4 lg:mt-0 p-4 border-t lg:border-l bg-muted/50">
            <TaskDetails taskId={selectedTaskId} />
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## 11. Performance Budgets

### Metrics (Web Vitals)

| Metric | Target (Mobile) | Target (Tablet) | Threshold |
|--------|----------------|----------------|-----------|
| LCP (Largest Contentful Paint) | < 2.5s | < 1.5s | 3s / 2s |
| FID (First Input Delay) | < 100ms | < 100ms | 300ms |
| CLS (Cumulative Layout Shift) | < 0.1 | < 0.1 | 0.25 |

### Bundle Size

| Part | Current | Target | Delta |
|------|---------|--------|-------|
| Initial JS | ~150KB | ~160KB | +10KB |
| CSS | ~40KB | ~50KB | +10KB |
| Vendor (deps) | ~200KB | ~200KB | 0KB |
| **Total** | **~390KB** | **~410KB** | **+20KB (5%)** |

### Load Time Targets

| Network | LCP | FCP | TTFB |
|---------|-----|-----|------|
| 4G | 2.5s | 1.0s | 0.8s |
| WiFi | 1.5s | 0.8s | 0.3s |
| 3G | 4.5s | 1.8s | 1.2s |

### Optimization Techniques

1. **Code Splitting** — Route-based dynamic imports (Vite)
2. **Tree Shaking** — Remove unused Tailwind utilities
3. **Lazy Loading** — Images, heavy components (Gantt, Tables)
4. **Virtual Scrolling** — Tables > 500 rows
5. **CSS Purging** — Tailwind purge config
6. **Image Optimization** — WebP, lazy-load

---

## 12. Accessibility (WCAG 2.1 Level AA)

### Keyboard Navigation

| Key | Action | Context |
|-----|--------|---------|
| Tab | Move focus to next element | All |
| Shift+Tab | Move focus to previous | All |
| Enter | Activate button / submit form | Buttons, Forms |
| Escape | Close dialog / cancel | Dialogs, Modals |
| Space | Toggle checkbox / expand collapsible | Checkboxes, Collapsible |
| Arrow Up/Down | Navigate list items | Lists, Tables |
| Arrow Left/Right | Navigate tabs / carousel | Tabs, Carousel |

### Focus Management

```jsx
// Dialog opens: focus trap inside
// Dialog closes: focus returns to trigger button

<Dialog onOpenChange={(open) => {
  if (!open) {
    // Return focus to trigger
    triggerRef.current?.focus();
  }
}}>
  <DialogContent ref={contentRef}>
    {/* Focus trap inside dialog */}
  </DialogContent>
</Dialog>
```

### ARIA Attributes

```jsx
// Semantic HTML + ARIA

<button aria-label="Close dialog" onClick={onClose}>
  ×
</button>

<div role="tablist" aria-label="Navigation">
  <button role="tab" aria-selected={active} aria-controls={`panel-${id}`}>
    Tab
  </button>
  <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`}>
    Content
  </div>
</div>

<table>
  <thead>
    <tr>
      <th scope="col">Name</th>
      <th scope="col">Date</th>
    </tr>
  </thead>
</table>

<form aria-describedby="error-message">
  <input />
  <span id="error-message">Error text</span>
</form>
```

### Color Contrast

- Text on background: ≥ 4.5:1 (WCAG AA)
- Large text (18pt+): ≥ 3:1
- UI components (borders): ≥ 3:1

```css
/* Check in DevTools: Rendering → Emulate CSS Media Feature prefers-color-scheme */
:root {
  /* Light: high contrast */
  --foreground: 222 47% 11%;     /* ~#0a0f26, Luminance ~0.08 */
  --background: 210 20% 98%;     /* ~#f5f7fc, Luminance ~0.97 */
  /* Contrast ratio: (0.97 + 0.05) / (0.08 + 0.05) = 7.26 (AAA) */
}

.dark {
  /* Dark: high contrast */
  --foreground: 210 40% 98%;     /* ~#f1f5fa */
  --background: 222.2 84% 4.9%;  /* ~#0d1117 */
  /* Contrast ratio: similar */
}
```

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 13. Telemetry & Error Tracking (Adaptation-specific)

### Metrics to Track

```javascript
// Send to analytics / error tracking

// 1. Breakpoint changes
window.addEventListener('resize', () => {
  const breakpoint = getCurrentBreakpoint();
  analytics.event('breakpoint_change', { breakpoint });
});

// 2. Orientation changes
window.addEventListener('orientationchange', () => {
  const orientation = window.orientation;
  analytics.event('orientation_change', { orientation });
});

// 3. Keyboard visibility (iOS)
window.visualViewport?.addEventListener('resize', () => {
  const keyboardHeight = window.innerHeight - window.visualViewport.height;
  if (keyboardHeight > 0) {
    analytics.event('keyboard_shown', { height: keyboardHeight });
  }
});

// 4. Safe-area changes
window.addEventListener('resize', () => {
  const safeArea = {
    top: CSS.env('safe-area-inset-top'),
    bottom: CSS.env('safe-area-inset-bottom'),
    left: CSS.env('safe-area-inset-left'),
    right: CSS.env('safe-area-inset-right'),
  };
  if (safeArea changed) analytics.event('safe_area_change', safeArea);
});

// 5. Errors during adaptation
try {
  // adaptation-specific code
} catch (error) {
  analytics.error('tablet_adaptation_error', {
    component: 'ScheduleGantt',
    breakpoint: getCurrentBreakpoint(),
    error: error.message,
  });
}
```

### Error Types to Track

- ResizeObserver errors
- VirtualScroller errors
- SafeArea calculation errors
- Keyboard event errors
- Orientation lock errors
- Memory leaks (navigation-specific)

---

## 14. Testing & Quality Assurance

### Device Matrix

| Device | OS | Browser | Breakpoint | Orientation |
|--------|-----|---------|-----------|-------------|
| iPhone SE | iOS 16 | Safari | < sm | Portrait |
| iPhone 14 | iOS 17 | Safari, Chrome | sm | Portrait, Landscape |
| iPad (7th gen) | iPadOS 16 | Safari | md | Portrait, Landscape |
| iPad Air | iPadOS 17 | Safari, Chrome | lg | Portrait, Landscape |
| iPad Pro 12.9" | iPadOS 17 | Safari | xl | Portrait, Landscape |
| Pixel 6 | Android 13 | Chrome | sm | Portrait, Landscape |
| Pixel Tablet | Android 13 | Chrome | lg | Portrait, Landscape |
| Samsung Galaxy Tab S9 | Android 13 | Samsung Internet | lg, xl | Portrait, Landscape |

### Test Scenarios

1. **Navigation**: Navigate between all screens on each breakpoint
2. **Object Switching**: Switch objects, verify query invalidation
3. **Dialogs**: Open/close dialogs on each breakpoint, test fullscreen vs modal
4. **Forms**: Submit forms, test validation on each breakpoint
5. **Tables**: Scroll horizontally (mobile), view full table (tablet)
6. **Gantt**: Zoom in/out, select tasks, edit on each breakpoint
7. **Telegram Integration**: Test MainButton, BackButton, safe-area on iPad
8. **Performance**: Lighthouse audit on each breakpoint
9. **Accessibility**: Keyboard navigation, screen reader on each breakpoint

---

## 15. Acceptance Criteria (Foundation Phase 1)

Shell считается **готовой** если:

- ✅ Мобильные (< 768px): BottomNav + Header + Hamburger работают (без регрессии)
- ✅ Планшеты (md+): Header адаптируется
- ✅ Планшеты (lg+): Sidebar видна и функциональна
- ✅ Safe-area корректна на iPad (notch, home indicator)
- ✅ Landscape rotation работает без issues
- ✅ Keyboard navigation работает везде
- ✅ Colors контраст ≥ 4.5:1
- ✅ Lighthouse Performance ≥ 85
- ✅ LCP < 2.5s (mobile), < 1.5s (tablet)
- ✅ FID < 100ms везде
- ✅ CLS < 0.1 везде
- ✅ Cross-browser tested (Chrome, Safari, Firefox)
- ✅ Docs обновлены (responsive patterns, breakpoints)

---

## Conclusion

Этот документ задаёт архитектурный фундамент для tablet UI адаптации. Всё построено на **mobile-first принципе**, использует **Tailwind responsive utilities**, и фокусируется на **performance, accessibility, и Telegram интеграции**.

**Next Steps**:
1. Обновить `tailwind.config.ts` breakpoints
2. Обновить `client/src/index.css` responsive tokens
3. Начать Phase 1: Shell (Header, BottomNav, Sidebar)
4. Тестировать на реальных device
