

# Login Screen + Organization Model + Superadmin

## New Role Hierarchy

```text
superadmin (platform-wide)
  └── admin (per organization)
       └── editor (per events within org)
            └── scanner (field staff)
```

## Changes

### 1. Data Model (`src/types/index.ts`)
- Add `Organization` type: `{ id, name, logo? }`
- Add `superadmin` to `Role` type
- Add `organization_id` to `User` and `Event`
- Add `password` to `User` (mock-only, plaintext for demo)

### 2. Mock Data (`src/data/mockData.ts`)
- Add 2 organizations: "SportEvents Pro", "RunPoland"
- Add superadmin user (access to everything)
- Assign existing admin/editors/scanners to organizations
- Add mock passwords for all users
- Display demo credentials on login page:

| Role | Email | Password |
|------|-------|----------|
| Superadmin | super@biurozawodow.pl | demo123 |
| Admin | admin@sportevents.pl | demo123 |
| Organizator | org.gniezno@sportevents.pl | demo123 |
| Skaner | skaner1@sportevents.pl | demo123 |

### 3. Auth Context (`src/contexts/AuthContext.tsx`)
- New context wrapping the app
- State: `loggedInUser | null`
- `login(email, password)` — validates against mock users
- `logout()` — clears state
- `isAuthenticated` boolean
- Persists to `sessionStorage` (survives refresh)

### 4. Login Page (`src/pages/Login.tsx`)
- Clean centered login form (email + password)
- Below form: collapsible "Demo credentials" card showing all test accounts
- Error toast on invalid credentials
- Redirects to `/` on success

### 5. App Routing (`src/App.tsx`)
- Wrap routes with `AuthProvider`
- If not authenticated → show Login page
- Remove role switcher from sidebar (role comes from logged-in user)
- Replace `MockDataProvider`'s role detection with auth user

### 6. MockDataContext Updates
- Remove `setCurrentRole` — role is now determined by `AuthContext.loggedInUser`
- `currentUser` comes from auth context
- `visibleEvents` filters by `organization_id` for admin, then by `assigned_events` for editor/scanner
- Superadmin sees all organizations and all events

### 7. Sidebar (`AppSidebar.tsx`)
- Remove demo role switcher from footer
- Add logout button in footer
- Show current user name + role badge
- Superadmin gets extra "Organizacje" nav item (simple list view)
- Add `superadmin` to nav item role arrays (same access as admin + org management)

### 8. User Management (`UserManagement.tsx`)
- Admin can create editors and scanners within their org
- Editor can create scanners (existing logic, already works)
- Superadmin can create admins for any organization
- New user form gets password field (mock)
- Filter visible users by organization_id

### 9. New Page: Organizations (`src/pages/Organizations.tsx`)
- Superadmin-only view
- Simple list of organizations with event counts
- Ability to switch org context    

### Files to create
- `src/contexts    /AuthContext.tsx`
- `src/pages/Login.tsx`
- `src/pages/Organizations.tsx`

### Files to modify
- `src/types/index.ts`
- `src/data/mockData.ts`
- `src/contexts/MockDataContext.tsx`
- `src/App.tsx`
- `src/components/AppSidebar.tsx`
- `src/components/Layout.tsx`
- `src/pages/UserManagement.tsx`

