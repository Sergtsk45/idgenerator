# ТЗ-06: Экраны Objects, Settings, Admin (Tablet UI)

**Дата:** 2026-03-10  
**Статус:** Draft  
**Версия:** 1.0  
**Аудитория:** Frontend, QA, Product Owner, System Admin  

---

## 📋 Оглавление
1. [Обзор](#обзор)
2. [Текущие риски](#текущие-риски)
3. [Целевой UX](#целевой-ux)
4. [Функциональные требования](#функциональные-требования)
5. [Нефункциональные требования](#нефункциональные-требования)
6. [Edge Cases](#edge-cases)
7. [Acceptance Criteria](#acceptance-criteria)

---

## Обзор

### Scope
Документация requirements для tablet UI служебных экранов:
- **Objects** (`/objects`) - селектор/менеджер объектов (глобальный scope)
- **Settings** (`/settings`) - настройки приложения и пользователя
- **Admin** (`/admin`) - управление пользователями, сообщениями, материалами
- **Admin sub-screens:**
  - `/admin/users` - справочник пользователей
  - `/admin/messages` - логи сообщений/событий
  - `/admin/materials` - управление справочником материалов
- **Fallback** - 404 и ошибки доступа

### Архитектурные предположения
- Global current object в контексте приложения
- Dirty-state при смене объекта (confirmation dialogs)
- Responsive admin layout: sidebar на desktop, hamburger на mobile/tablet
- Object selector через bottom sheet (Telegram UI pattern)
- Role-based access control (RBAC) для админ экранов
- Browser fallback для несуществующих маршрутов
- object-aware query cache и контролируемая инвалидация данных при смене объекта

---

## Текущие риски

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|--------|-----------|
| **Потеря данных при смене объекта** | Средняя | Высокое | Dirty-state detection, unsaved changes warning, auto-save |
| **Unauthorized доступ в админ** | Средняя | Критическое | RBAC checks, auth token validation, backend enforcement |
| **Performance админ табло при >1000 пользователей** | Высокая | Среднее | Pagination, virtualization, filtering/search |
| **Cache несогласованность при multi-user edits** | Средняя | Среднее | Query invalidation on mutation, per-user conflict resolution |
| **Bottom sheet не поддерживается на старых браузерах** | Низкая | Низкое | Fallback modal dialog |
| **Admin layout разлом на odd tablet sizes** | Низкая | Среднее | Strict media queries, 768px breakpoint testing |
| **Logout при смене объекта** | Низкая | Высокое | Session persistence, context preservation |

---

## Целевой UX

### Общие принципы
- **Contextual navigation:** Object selector доступен везде (header / drawer)
- **Confirmation on change:** Dirty-state dialog при попытке смены объекта
- **Responsive sidebar:** Desktop (fixed sidebar), tablet (collapsible), mobile (hamburger)
- **Breadcrumb trail:** Always know where you are
- **Quick access:** Favourites / recent objects pinned
- **Graceful degradation:** 404 и access denied с helpful messages

### Objects Screen (Global Selector)
```
┌────────────────────────────────────┐
│ 🏢 Objects [Search] [+ New]       │  Header
├────────────────────────────────────┤
│ Favourites:                        │
│ ⭐ Main Warehouse                   │  
│ ⭐ Office                           │  
│                                    │
│ Recent:                            │
│ 📍 Склад №5                         │  
│ 📍 Shop Branch                      │  
│                                    │
│ [🔍 Search...]                     │
│ ├─ Category 1                       │
│   ├─ Object 1                       │
│   ├─ Object 2                       │
│ ├─ Category 2                       │
│   └─ Object 3                       │
│                                    │
│ [Switch Object]  [Edit]  [Delete]  │
└────────────────────────────────────┘
```

### Settings Screen
```
┌─────────────────────────────────────┐
│ ⚙️ Settings                         │  Header
├────────────┬──────────────────────┤
│ Menu       │ Detail               │
│            │                      │
│ Account    │ ┌──────────────────┐ │
│ Profile    │ │ Account Settings │ │
│ Appearance │ │ ┌──────────────┐ │ │
│ Sounds     │ │ │ Email:...     │ │ │
│ Sync       │ │ │ Phone:...     │ │ │
│ Quotas     │ │ │ Role: Admin   │ │ │
│ Logs       │ │ └──────────────┘ │ │
│            │ │ [Edit] [Change PW]│ │
│            │ └──────────────────┘ │
│ [Logout]   │                      │
└────────────┴──────────────────────┘
```

### Admin Layout
```
Desktop (>1024px):
┌──────────────────────────────────────┐
│ 🔐 Admin [User logged] [⚙️]         │  Header
├────────┬──────────────────────────┤
│ Sidebar│ Content Area             │
│        │                          │
│ Users  │ ┌────────────────────┐  │
│ Msgs   │ │ Users (Admin)      │  │
│ Mtrls  │ │ [Search] [+ Add]   │  │
│ Logs   │ │                    │  │
│        │ │ [User 1] Status OK │  │
│ [Exit] │ │ [User 2] Status OK │  │
│        │ │ [Load more]        │  │
│        │ └────────────────────┘  │
├────────┴──────────────────────────┤
│ Footer: Server time, Sync status   │
└────────────────────────────────────┘

Tablet (600-1024px):
┌─────────────────────────────────────┐
│ ☰ 🔐 Admin                [⚙️]      │  Header (collapsible)
├─────────────────────────────────────┤
│ Content Area (full width)           │
│ ┌─────────────────────────────────┐ │
│ │ Users (Admin)                   │ │
│ │ [Search] [+ Add] [Filter]       │ │
│ │ ┌───────────┬─────────────┐     │ │
│ │ │ User      │ Status      │     │ │
│ │ ├───────────┼─────────────┤     │ │
│ │ │ User 1    │ Active ✓    │     │ │
│ │ │ User 2    │ Pending     │     │ │
│ │ └───────────┴─────────────┘     │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### Error Pages
```
404 Not Found:
┌────────────────────────────────┐
│ ← Back                         │
├────────────────────────────────┤
│                                │
│       404                      │
│   Page Not Found               │
│                                │
│  The page you're looking for   │
│  doesn't exist or was deleted. │
│                                │
│   [Go to Dashboard]  [Home]    │
│                                │
└────────────────────────────────┘

Access Denied:
┌────────────────────────────────┐
│ ← Back                         │
├────────────────────────────────┤
│                                │
│       🔒                       │
│   Access Denied                │
│                                │
│  You don't have permission to  │
│  view this page.               │
│                                │
│  Contact admin: support@...    │
│                                │
│   [Go to Dashboard]            │
│                                │
└────────────────────────────────┘
```

---

## Функциональные требования

### 1. Objects Screen (`/objects`)

#### 1.1 Object Selector & Context
- **Global State:**
  - Текущий выбранный объект хранится в Context/Zustand
  - Доступен везде через `useCurrentObject()` hook
  - При logout → сбросить текущий объект

- **Object List:**
  - Структурированный по категориям / типам
  - Favourites (pinned) в начале списка
  - Recent objects (last 5)
  - Full list с поиском

- **Bottom Sheet Pattern (Mobile/Tablet):**
  - Tap на текущий объект в header → bottom sheet
  - Swipe down или tap outside → close
  - Search внутри sheet с real-time фильтрацией

#### 1.2 Object Operations
- **Select:**
  - Tap object → set as current
  - Show confirmation if unsaved changes exist
  - Breadcrumb update: "Dashboard > [Object Name]"
  - Refresh page data for new object scope

- **Create:**
  - [+ New] button → modal form
  - Fields: Name (required), Type, Category, Address (optional)
  - Validation: Name unique within user's objects
  - On save → add to list + set as current

- **Edit:**
  - [Edit] button on selected object → modal or inline
  - Allow: Name, Address, Category, Status
  - Auto-save or explicit [Save]
  - Invalidate cache if needed

- **Delete:**
  - [Delete] button → confirmation dialog
  - Warning: "All data associated will be archived"
  - After delete → revert to previous or first object

- **Pin/Unpin:**
  - Star icon on card
  - Pinned objects stay at top
  - Max 5 pinned objects
  - Persistent in user preferences

#### 1.3 Search & Filter
- Real-time search по Name, Address, Type
- Filter by Type (Warehouse, Office, Shop, etc.)
- Filter by Status (Active, Inactive)
- Sort by: Name (A-Z), Recent, Favourite

#### 1.4 Dirty State & Confirmation
- **On object change (if unsaved changes exist):**
  - Show modal: "You have unsaved changes. Save before switching?"
  - Options: [Save & Switch], [Discard & Switch], [Cancel]
  - Auto-save if user chooses save

- **Implementation:**
  - Track dirty state in form/store
  - Check before context update
  - Use beforeUnload event for browser navigation

### 2. Settings Screen (`/settings`)

#### 2.1 Account Settings
- **User Profile:**
  - Display: Email, Phone, Full Name, Role, Avatar
  - [Edit profile] → modal with form
  - Upload avatar (JPEG/PNG, max 5MB)
  - Fields: Name, Phone (optional)
  - Validation: Email format, phone format

- **Security:**
  - [Change password] button → modal
  - Current password required
  - New password with validation:
    - Min 8 chars
    - At least 1 uppercase, 1 digit, 1 special char
    - Confirm password match
  - Success notification + logout & re-login

- **Sessions:**
  - List of active sessions (device, OS, last activity)
  - [Sign out] button for each session
  - "Sign out all other devices" option

#### 2.2 Appearance Settings
- **Theme:**
  - Light / Dark / System (default)
  - Radio buttons or toggle
  - Persist to localStorage

- **Language:**
  - Dropdown with available languages (RU, EN, etc.)
  - Reload app to apply

- **Font Size:**
  - Slider: Small / Normal / Large / Extra large
  - Live preview
  - Persist to localStorage

#### 2.3 Sounds & Notifications
- **Sound Settings:**
  - Toggle: Enable/Disable
  - If enabled, show volume slider (0-100%)
  - Test button to play sample sound

- **Notifications:**
  - Toggle: Browser notifications
  - Toggle: Email notifications
  - Toggle: SMS notifications (if available)
  - Notification frequency: Real-time / Daily digest / Weekly

#### 2.4 Sync Settings
- **Sync Status:**
  - Show current sync mode: Auto / Manual
  - Last sync timestamp
  - Auto-sync frequency: Every 1min / 5min / 15min / 1hr

- **Data Management:**
  - Cache size: Show current size, option to clear
  - [Clear all caches] button with confirmation
  - Export user data button (CSV/JSON)
  - Request data deletion (GDPR)

#### 2.5 Quotas
- **Usage Display:**
  - Storage: X MB / Y MB (progress bar)
  - API calls: X / Y per month
  - Users: X / Y created
  - Objects: X / Y allowed

- **Upgrade:**
  - If near quota → warning banner
  - [Upgrade plan] link

#### 2.6 Logs
- **Activity Logs:**
  - Last login, Last action, Changes made
  - Filterable by action type
  - Exportable as CSV
  - Show timezone

- **API Logs:**
  - Recent API calls, status codes, response times
  - Filterable by status (200, 4xx, 5xx)
  - Max 100 entries, pagination

#### 2.7 Account Deletion
- **Danger Zone:**
  - Red section at bottom
  - [Delete account permanently] button
  - Multi-step confirmation:
    - Type account email to confirm
    - Choose data retention (delete all / archive)
  - Cannot undo

### 3. Admin Screens

#### 3.1 Admin Access & Permissions
- **RBAC Implementation:**
  - Check role on component mount
  - If not Admin / Manager → show "Access denied"
  - Backend validation on all API calls
  - Session validation (token must be valid)

- **Admin Entry Points:**
  - Menu: Admin link (visible only to admins)
  - Breadcrumb: Home > Admin > [Section]

#### 3.2 Admin Layout (Responsive)
```javascript
// Breakpoint logic:
- Desktop (>1024px): Fixed sidebar (200px), collapsible
- Tablet (600-1024px): Hamburger menu, overlay sidebar on click
- Mobile (<600px): Full-width hamburger, drawer
```

**Sidebar Navigation:**
- Users (badge with count)
- Messages (badge with unread/recent)
- Materials
- System Logs (if super-admin)
- [Settings]
- [Exit Admin]

**Header:**
- Breadcrumb or title (Admin > Users)
- Current admin user name
- Logout button

#### 3.3 Admin / Users Screen (`/admin/users`)

**User List Table:**
- Columns: Name, Email, Role, Status, Created date, Actions
- Sortable columns: Name, Created date, Status
- Filterable: By role (Admin, Manager, User), By status (Active, Pending, Inactive)
- Search: by name, email
- Pagination: 25, 50, 100 rows per page

**User Card / Row:**
- Clickable row → drawer with full user details
- Quick actions: Edit, Delete, Reset password, Send message (icon buttons)

**User Details Drawer:**
- Full profile: Name, Email, Phone, Role
- Created date, Last login
- Current status
- Objects assigned (list / count)
- [Edit user] button
- [Delete user] button with confirmation
- [Reset password] button → send reset link via email
- [Send message] button → open message modal

**User CRUD:**
- **Create:**
  - [+ Add user] button → modal form
  - Fields: Email (required), Name, Phone, Role (dropdown), Object assignment
  - Validation: Email unique, Email format
  - On save → generate temp password + send invitation email

- **Update:**
  - [Edit] → modal form
  - Editable: Name, Phone, Role, Assigned objects
  - On save → update + notify user if role changed

- **Delete:**
  - Confirmation dialog: "User will be archived. All data retained."
  - Option: Also delete all user's sessions
  - After delete → remove from list

- **Reset Password:**
  - Generate reset link
  - Send email with link
  - Toast: "Reset link sent to [email]"

#### 3.4 Admin / Messages Screen (`/admin/messages`)

**Message Log Table:**
- Columns: Timestamp, Type (error/warning/info/success), Message, User, Status
- Sortable: Timestamp, Type
- Filterable: By type, By status (read/unread), By user
- Search: in message text
- Pagination: 50, 100, 200 per page

**Message Detail:**
- Click row → drawer
- Show full message text
- Stack trace if error
- Related user info
- Related object info
- [Mark as read] / [Mark as unread]
- [Delete] button

**Bulk Actions:**
- Select messages (checkboxes)
- Bulk: Mark read, Delete, Export
- Progress indicator for bulk operations

#### 3.5 Admin / Materials Screen (`/admin/materials`)

**Material List:**
- Hierarchical categories (collapsible)
- Columns: SKU, Name, Category, Unit, Price, Stock, Status
- Search by SKU/Name
- Filter by Category, Status (Active/Archived)
- Sortable by: Name, Price, Created date

**Material Card / Row:**
- Show thumbnail if exists
- Tap → drawer with details
- Quick action icons: Edit, Delete, Archive, Duplicate

**Material CRUD:**
- **Create:**
  - [+ Add material] button → modal form
  - Fields: Name, Description, SKU, Category, Unit, Price, Image (optional)
  - Validation: SKU unique, Price > 0
  - Success → add to list + refresh search results

- **Update:**
  - [Edit] → modal form
  - All fields editable
  - On save → optimistic update + API call

- **Delete/Archive:**
  - Default: Soft delete (archive)
  - Option: Permanent delete with confirmation
  - Show warning if material used in documents

- **Bulk Actions:**
  - Select multiple materials
  - Bulk edit category, status
  - Bulk delete / archive
  - Progress indicator

**Import Materials:**
- Optional: [Import CSV] button
- CSV format: SKU | Name | Category | Unit | Price
- Preview before import
- Error handling: Show row number + error message
- On success: Add X materials

#### 3.6 System Logs (Optional, for super-admin)
- API logs: endpoint, status, response time, user
- Error logs: timestamp, error message, stack trace, user/object context
- Filterable and exportable

### 4. Error Screens

#### 4.1 404 Not Found
- Simple illustration
- Message: "Page not found"
- [Go to Dashboard] button
- [Contact support] link

#### 4.2 403 Access Denied
- Simple illustration
- Message: "You don't have permission to view this page"
- [Go to Dashboard] button
- Admin contact info (if applicable)

#### 4.3 500 Server Error
- Message: "Something went wrong on our end"
- [Retry] button
- [Report issue] link
- Error code (for support reference)

#### 4.4 Network Error / Offline
- Message: "No internet connection"
- Show last cached page (if available)
- [Retry] button with countdown for auto-retry

#### 4.5 Session Expired
- Message: "Your session has expired"
- Redirect to login after 5s
- [Log in again] button

---

## Нефункциональные требования

### Performance
- **Admin list load:** <2s (even with 1000 users)
- **Search response:** <300ms with debounce
- **Table pagination:** <500ms for page change
- **Sort/filter:** <400ms
- **Scroll smoothness:** 60 FPS for tables

### Responsiveness (Breakpoints)
```
Mobile:   < 600px   (full-width, drawer navigation)
Tablet:   600-1024px (2-column for some screens, hamburger menu)
Desktop:  > 1024px  (fixed sidebar, 3-column)
```

**Tablet-specific:**
- Sidebar hidden by default, hamburger menu in header
- Content uses full width
- Tables responsive: stack columns on narrow layouts
- Touch targets: min 44x44px

### Security
- **RBAC:**
  - Check roles on component mount
  - Validate on every API call
  - Never trust client-side role (backend enforces)
  - Audit trail for admin actions

- **Data Protection:**
  - HTTPS only
  - Не добавлять новые чувствительные данные в browser storage без отдельного решения
  - Passwords never logged
  - Password reset tokens expire in 24h

- **Session Management:**
  - Не менять текущую auth-модель в рамках tablet UI
  - Logout должен очищать текущую браузерную сессию согласно существующей реализации
  - Все tablet-изменения обязаны сохранять совместимость с Telegram auth и browser JWT flow

### Accessibility
- **WCAG 2.1 AA compliance**
- Screen reader support for all tables
- Keyboard navigation: Tab, Enter, Escape
- Focus indicators visible
- Color contrast: 4.5:1 minimum
- Table headers associated with cells
- Skip link to main content

### Caching & Network Failures
- **Cache strategy:**
  - Admin lists: staleTime 10min, cacheTime 60min
  - User data: staleTime 1h, cacheTime 24h
  - Invalidate on mutation
  
- **Сетевые ошибки:**
  - При неудачной загрузке показывать retry-state и не скрывать контекст выбранного раздела
  - При ошибке мутации не терять введённые в форме данные до решения пользователя
  - Не вводить offline queue в рамках текущего ТЗ

### Browser Support
- Chrome 90+
- Safari 14+
- Firefox 88+
- Samsung Internet 14+

---

## Edge Cases

### Object Selection
1. **User has no objects assigned:** 
   - Show "No objects" message
   - [Create new object] button

2. **Object was deleted by another admin:**
   - Current object context cleared
   - Show notification
   - Reset to first available object

3. **User tries to switch object with unsaved changes:**
   - Show confirmation dialog
   - If user cancels → stay on current form

4. **Switching object while API call in progress:**
   - Abort in-flight request
   - Clear form state
   - Load new object data

### Settings
5. **Password change with weak password:**
   - Real-time validation
   - Show requirements check: ✓ 8 chars, ✗ 1 number, ✓ 1 symbol

6. **Avatar upload too large (>5MB):**
   - Show error: "File too large. Max 5MB"
   - Suggest compression

7. **User tries to delete own account:**
   - Warning: "You will be logged out immediately"
   - Confirmation required

### Admin
8. **Deleting user with active sessions:**
   - Warn: "X active sessions will be terminated"
   - Option to keep data archived

9. **Bulk delete 1000 materials:**
   - Show progress dialog
   - Allow cancel (rollback partial deletes)
   - Summary on completion

10. **Admin session expires while editing:**
    - Toast: "Session expired. Please log in again."
    - Redirect to login page

### Error Screens
11. **404 on nested route:** `/admin/users/999/edit`
    - Show 404 page
    - [Go to /admin/users] link

12. **Access denied but user just got promoted:**
    - Cache invalidation on role change
    - Require page refresh or logout/login

13. **Offline and trying to access admin:**
    - If cached data exists → show stale data with warning
    - Else → "Admin requires internet connection"

---

## Acceptance Criteria

### Objects Screen

**AC 1: Object selector доступен везде**
- [ ] Текущий объект показывается в header
- [ ] Tap на текущий объект → bottom sheet
- [ ] Bottom sheet показывает list объектов
- [ ] Search работает в real-time (debounce 300ms)
- [ ] Tap объект → выбирается, sheet закрывается

**AC 2: Object selection с dirty-state**
- [ ] Если есть unsaved changes → показывается confirmation dialog
- [ ] Диалог: "You have unsaved changes. Save before switching?"
- [ ] [Save & Switch] → save + switch
- [ ] [Discard & Switch] → switch без save
- [ ] [Cancel] → stay на текущем объекте

**AC 3: Create / Edit / Delete object**
- [ ] [+ New] button → modal form
- [ ] Валидация: Name required, unique
- [ ] На save → add to list + set as current
- [ ] [Edit] → update object details
- [ ] [Delete] → confirmation, then remove from list

**AC 4: Favourites & Recent**
- [ ] Star icon on objects → pin/unpin
- [ ] Max 5 pinned objects
- [ ] Recent objects last 5, sortable
- [ ] Pinned objects sticky at top

### Settings Screen

**AC 5: Account settings работают**
- [ ] Profile shows: Email, Name, Phone, Role
- [ ] [Edit profile] → modal, update fields
- [ ] Avatar upload works (JPEG/PNG, max 5MB)
- [ ] Success notification

**AC 6: Change password validation**
- [ ] [Change password] → modal
- [ ] Validation: Min 8 chars, 1 upper, 1 digit, 1 special
- [ ] Confirm password match required
- [ ] On success → logout + re-login required

**AC 7: Appearance settings**
- [ ] Theme toggle: Light / Dark / System
- [ ] Settings persist to localStorage
- [ ] Language dropdown, page reloads on change
- [ ] Font size slider: Small / Normal / Large / XL

**AC 8: Sync & Cache settings**
- [ ] Show sync status: Auto / Manual
- [ ] Show last sync timestamp
- [ ] [Clear all caches] button works
- [ ] Quota progress bars show usage

### Admin Screens

**AC 9: Admin access control**
- [ ] Non-admins cannot access /admin → 403 page
- [ ] Admin can access /admin/users, /admin/messages, /admin/materials
- [ ] RBAC checked on component mount and API calls

**AC 10: Admin layout responsive**
- [ ] Desktop (>1024px): Fixed sidebar, content pane
- [ ] Tablet (600-1024px): Hamburger menu, full-width content
- [ ] Mobile (<600px): Drawer navigation on hamburger
- [ ] Menu items: Users, Messages, Materials, Settings, Exit

**AC 11: Users list table**
- [ ] Table columns: Name, Email, Role, Status, Created, Actions
- [ ] Sortable by: Name, Created, Status
- [ ] Filterable by: Role, Status
- [ ] Search by name/email (debounce 300ms)
- [ ] Pagination: 25/50/100 rows

**AC 12: User CRUD**
- [ ] Click row → drawer with user details
- [ ] [+ Add user] → modal form (Email, Name, Role, Objects)
- [ ] Validation: Email unique, Email format
- [ ] On create → send invitation email
- [ ] [Edit] → update user data
- [ ] [Delete] → confirmation, archive user

**AC 13: Messages log table**
- [ ] Columns: Timestamp, Type, Message, User, Status
- [ ] Filterable: By type, By status, By user
- [ ] Search in message text (debounce 300ms)
- [ ] Click row → drawer with full message
- [ ] Bulk actions: Mark read, Delete

**AC 14: Materials CRUD**
- [ ] Hierarchical list with collapsible categories
- [ ] Create: [+ Add material] → form
- [ ] Read: Click → drawer with details
- [ ] Update: [Edit] → modal, save changes
- [ ] Delete: [Delete] → soft delete (archive) by default
- [ ] Bulk edit: Select multiple, bulk change category/status

### Error Pages

**AC 15: 404 page**
- [ ] Shows on non-existent route
- [ ] Message: "Page not found"
- [ ] [Go to Dashboard] button works
- [ ] [Contact support] link present

**AC 16: Access denied (403)**
- [ ] Shows when user lacks permission
- [ ] Message: "You don't have permission"
- [ ] [Go to Dashboard] button works
- [ ] Admin contact info shown

**AC 17: Network error**
- [ ] Shows when no internet connection
- [ ] Message: "No internet connection"
- [ ] [Retry] button works
- [ ] Shows last cached data if available

### Cross-Screen

**AC 18: Responsive layout (tablet)**
- [ ] No horizontal scroll (overflow-x hidden)
- [ ] Touch targets min 44x44px
- [ ] Sidebar hamburger on 600-1024px
- [ ] Master-detail layout where applicable

**AC 19: Accessibility**
- [ ] WCAG 2.1 AA compliance
- [ ] Screen reader: all elements labeled
- [ ] Keyboard nav: Tab/Enter/Escape work
- [ ] Color contrast: 4.5:1 minimum
- [ ] Focus indicators visible

**AC 20: Performance**
- [ ] Admin list load: <2s
- [ ] Search response: <300ms
- [ ] Table pagination: <500ms
- [ ] Scroll FPS: ≥60 on mid-range tablet
- [ ] Memory: <100MB for all caches

---

## Контрольный чек-лист для разработки

- [ ] Object context / store implementation (Zustand / Redux)
- [ ] useCurrentObject() hook created
- [ ] Dirty-state detection in forms
- [ ] Unsaved changes dialog component
- [ ] Settings form components (Account, Appearance, Sync)
- [ ] Admin layout responsive component
- [ ] RBAC middleware / guard components
- [ ] Admin Users table with pagination + filters
- [ ] Admin Messages log table
- [ ] Admin Materials CRUD
- [ ] Error boundary for 404 / 403 screens
- [ ] API contracts for admin endpoints
- [ ] Admin session timeout handler
- [ ] Keyboard navigation tested (Tab, Enter, Escape)
- [ ] Mobile/tablet breakpoint media queries
- [ ] Accessibility audit (axe-core, Lighthouse)
- [ ] Performance profiling (Lighthouse)
- [ ] E2E tests for critical flows (login, object switch, admin CRUD)
- [ ] Visual regression tests

---

## Ссылки на связанные документы
- [05-source-data-materials-documents.md](./05-source-data-materials-documents.md) - экраны data/materials/documents
- [07-qa-rollout.md](./07-qa-rollout.md) - QA стратегия
- API Contracts (in project repo)
- Component library specs
- RBAC specification
