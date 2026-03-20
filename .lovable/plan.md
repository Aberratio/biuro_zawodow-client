

## Updated Role Model

Current state: Scanner has minimal access, Editor can edit participants, Admin has full access. Events page is admin-only.

**New role hierarchy per user's clarification:**

- **Admin** — platform owner, sees ALL events, all data, full management
- **Editor** — event organizer, manages THEIR events (participants, import CSV, email sending, user management for their events). Essentially admin-scoped to assigned events.
- **Scanner** — field worker for an editor, only scans QR and searches participants within assigned event

### Changes needed

**1. Sidebar navigation (`AppSidebar.tsx`)**
- Give Editor access to: Wydarzenia, Import CSV, Wysyłka QR, Użytkownicy (same as admin)
- Scanner stays: Dashboard, Uczestnicy, Skaner QR

**2. Dashboard (`Dashboard.tsx`)**
- Editor gets the same rich dashboard as Admin, but filtered to their events (selected event context)
- Scanner stays with the simple single-event view

**3. Pages access adjustments**
- `Events.tsx` — accessible by Editor (sees only their assigned events) and Admin (sees all)
- `EventDetails.tsx` — accessible by Editor + Admin
- `CsvImport.tsx` — accessible by Editor + Admin
- `EmailSending.tsx` — accessible by Editor + Admin
- `UserManagement.tsx` — accessible by Editor (manages scanners for their events) + Admin (manages everyone)
- `ParticipantDetails.tsx` — Editor can edit (already works via `canEdit` check)

**4. Data model update (`types/index.ts`, `mockData.ts`, `MockDataContext.tsx`)**
- Add `assigned_events: string[]` to `User` type so editors are linked to specific events
- Update mock users to reflect: 1 admin, 1-2 editors each with assigned events, 2-3 scanners
- Editor's data is filtered to their assigned events throughout the app

**5. Role labels update**
- Editor label: "Edytor" → "Organizator" (optional, matches the concept better)

### Files to modify
- `src/types/index.ts` — add `assigned_events` to User
- `src/data/mockData.ts` — update mock users
- `src/contexts/MockDataContext.tsx` — add event-scoped filtering helpers
- `src/components/AppSidebar.tsx` — update role access for nav items
- `src/pages/Dashboard.tsx` — editor gets admin-like dashboard scoped to their events
- `src/pages/Events.tsx` — allow editor access, filter by assigned events
- `src/pages/UserManagement.tsx` — editor can manage scanners
- `src/pages/CsvImport.tsx`, `src/pages/EmailSending.tsx` — allow editor access

