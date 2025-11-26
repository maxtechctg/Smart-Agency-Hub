# Smart Agency Control Hub - Design Guidelines

## Design Approach: Enterprise SaaS System

**Selected Framework**: Hybrid approach drawing from Linear (modern SaaS aesthetics), Notion (flexible data organization), and Material Design (enterprise patterns)

**Rationale**: This is a utility-focused, information-dense business management platform requiring efficiency, scalability, and professional polish. The design prioritizes data clarity, quick navigation, and productive workflows over visual flair.

**Core Principles**:
- Clarity over decoration: Every element serves a functional purpose
- Consistent patterns: Users learn once, apply everywhere
- Information hierarchy: Clear visual structure for complex data
- Responsive efficiency: Mobile-capable, desktop-optimized

---

## Typography System

**Font Stack**: 
- Primary: Inter (via Google Fonts CDN)
- Monospace: JetBrains Mono (for code, IDs, timestamps)

**Scale**:
- Page Headers: text-3xl font-bold (30px)
- Section Headers: text-2xl font-semibold (24px)
- Card/Module Titles: text-lg font-semibold (18px)
- Body Text: text-sm (14px) - primary interface text
- Labels/Meta: text-xs (12px) - timestamps, badges, secondary info
- Table Headers: text-xs font-medium uppercase tracking-wide

---

## Layout & Spacing System

**Spacing Primitives**: Use Tailwind units of **2, 4, 6, 8, 12, 16, 24** for consistent rhythm
- Component padding: p-4 to p-6
- Card spacing: p-6
- Section gaps: gap-6 to gap-8
- Page margins: px-6 lg:px-8
- Vertical rhythm: space-y-6 for form groups, space-y-4 for lists

**Grid System**:
- Dashboard cards: grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6
- Two-column layouts: grid-cols-1 lg:grid-cols-2 gap-8
- Forms: Single column max-w-2xl for readability

**Container Strategy**:
- Full app: Fixed sidebar (w-64) + main content area
- Main content: max-w-7xl mx-auto px-6
- Modals/Forms: max-w-2xl or max-w-4xl depending on complexity

---

## Navigation Architecture

**Top Bar** (h-16, sticky):
- Logo/Company name (left)
- Global search bar (center, max-w-md)
- Notifications icon + User avatar dropdown (right)

**Sidebar** (w-64, fixed left, full-height):
- Module sections with icons (Heroicons)
- Active state: background highlight + border-l-4 accent
- Collapsible sub-menus for complex modules
- Hierarchy: Dashboard → CRM → Projects → Team → Finance → Settings

**Breadcrumbs**: 
- Below top bar: text-sm with separators (›)
- Click to navigate parent levels

---

## Component Library

### Data Display Components

**Cards**:
- Background: distinct from page background
- Border: subtle border
- Rounded corners: rounded-lg
- Padding: p-6
- Shadow: subtle elevation (shadow-sm)
- Header: flex justify-between items-center mb-4

**Tables**:
- Zebra striping for alternating rows
- Hover state on rows
- Sticky header when scrolling
- Actions column (right-aligned)
- Sortable column headers with icons
- Pagination: bottom-right, showing "1-10 of 245"

**Stat Cards** (Dashboard KPIs):
- Icon (top-left, size-8)
- Large number: text-3xl font-bold
- Label: text-sm above number
- Trend indicator: small arrow + percentage
- Layout: 4-column grid on desktop

**Charts**:
- Use Chart.js or Recharts
- Minimal grid lines
- Clear axis labels
- Tooltips on hover
- Consistent sizing: h-64 to h-80

### Input Components

**Form Fields**:
- Label: text-sm font-medium mb-2
- Input: px-4 py-2, rounded-md, border
- Focus state: ring-2 outline-none
- Error state: border-red + text-red-600 error message below
- Help text: text-xs text-gray-600 mt-1

**Buttons**:
- Primary: px-6 py-2.5, rounded-md, font-medium
- Secondary: outlined variant
- Icon buttons: square, p-2
- Sizes: sm (py-1.5 px-3), base (py-2.5 px-6), lg (py-3 px-8)

**Select/Dropdowns**:
- Custom styled (not native)
- Searchable for long lists
- Multi-select with tags for assignment fields

**Date/Time Pickers**:
- Inline calendar dropdown
- Time selection with AM/PM or 24h
- Range selection for reports

### Module-Specific Components

**CRM Contact Cards**:
- Avatar (left)
- Name + role/company
- Status badge (Lead/Client/Active)
- Action buttons (call, email, WhatsApp icons)
- Last contact timestamp

**Project Cards**:
- Project name + client
- Progress bar (completion %)
- Deadline badge
- Assigned team avatars (stacked, max 3 visible + count)
- Status indicator (Planning/Active/Review/Completed)

**Task Lists**:
- Checkbox (left)
- Task title (strikethrough when complete)
- Priority tag (High/Medium/Low)
- Assignee avatar
- Due date
- Expand for checklist sub-items

**Attendance Table**:
- User column with avatar
- Check-in/Check-out times (monospace font)
- Status badges (On-time/Late/Absent)
- Late count column
- Monthly view: calendar grid with color-coded cells

**Invoice Layout**:
- Company header with logo
- Invoice # and date (top-right)
- Bill to/From sections
- Line items table
- Subtotal/Tax/Total (right-aligned)
- Payment status banner
- Action buttons (Send, Download PDF, Mark Paid)

**Chat Interface**:
- Message bubbles (sent: right-aligned, received: left)
- Timestamps: text-xs below messages
- Input: fixed bottom with send button
- File attachment icon
- Project context header (sticky top)

### Navigation Components

**Tabs**:
- Horizontal: border-b, active tab with border-b-2
- Used for: Project details (Overview/Tasks/Files/Chat)

**Filters Panel**:
- Sidebar or collapsible panel
- Filter groups: Status, Date range, Assigned to, Priority
- Clear all button
- Active filter count badge

### Feedback Components

**Badges**:
- Rounded-full, px-3 py-1, text-xs font-medium
- Status variations: Success/Warning/Error/Info
- Count badges: small circle on icons

**Notifications**:
- Toast: Fixed top-right, auto-dismiss
- Bell icon dropdown: scrollable list, max-h-96
- Unread indicator: dot or count badge

**Empty States**:
- Centered icon (size-16)
- Title: text-lg font-semibold
- Description: text-sm
- Primary action button

**Loading States**:
- Skeleton screens for cards/tables
- Spinner for buttons (inline, small)
- Progress bar for uploads

### Modals & Overlays

**Modal Structure**:
- Backdrop: semi-transparent overlay
- Content: max-w-2xl, centered, rounded-lg
- Header: title + close icon (right)
- Body: p-6, scrollable if needed
- Footer: action buttons (right-aligned)

**Slide-over Panels** (for quick actions):
- Fixed right, w-96 to w-[32rem]
- Form inputs or detail views
- Close on backdrop click

---

## Dashboard Layout

**Main Dashboard**:
- KPI cards row: 4-column grid (Total Leads, Active Projects, Team Attendance %, Monthly Revenue)
- Charts row: 2-column (Revenue vs Expense chart, Task completion chart)
- Recent activity feed: 1-column, scrollable
- Quick actions: Floating action button (bottom-right) for common tasks

---

## Responsive Behavior

**Breakpoints**:
- Mobile: Stack all grids to single column, hide sidebar (drawer)
- Tablet: 2-column grids, collapsible sidebar
- Desktop: Full layout with fixed sidebar

**Mobile Adjustments**:
- Bottom navigation for main modules
- Tables: Horizontal scroll or card view
- Modals: Full screen on mobile
- Reduced padding: p-4 instead of p-6

---

## Icons

**Library**: Heroicons (via CDN)
- Navigation: outline style
- Actions: solid style in buttons
- Status indicators: mini size for badges

---

## Accessibility

- Focus indicators: visible ring-2 on all interactive elements
- ARIA labels on icon-only buttons
- Keyboard navigation: Tab order, Enter/Space activation
- Form validation: Clear error messages
- Sufficient contrast ratios (WCAG AA minimum)