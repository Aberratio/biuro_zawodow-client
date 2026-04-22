# biuro_zawodow-client

React + Vite frontend for the `biuro_zawodow` system. It connects to the PHP API, shows role aware navigation, and supports race office workflows such as participant handling, QR scanning, CSV import, QR email sending and event level exports.

## Stack

- React 18
- TypeScript
- Vite
- React Router
- TanStack Query
- Tailwind CSS
- Radix UI
- Vitest

## Main features

- login, session restore and password reset flow
- role aware UI for:
  - `superadmin`
  - `admin`
  - `editor`
  - `scanner`
- main panel with sections for:
  - currently open events
  - upcoming events
  - recently finished events
- organizations view with improved card based navigation
- event details with:
  - edit and delete
  - participant CSV export
  - event logs CSV export
  - QR email sending
- participant management with:
  - manual add
  - package reassignment
  - QR preview
  - single QR email send
  - delete
- CSV import flow with analysis, column mapping and import run
- QR scanner flow for assigned and currently open events

## Requirements

- Node.js 18+
- npm
- running backend API from `../biuro_zawodow-api`

## Environment

Create `.env` from `.env.example`:

```powershell
cd biuro_zawodow-client
Copy-Item .env.example .env
```

Default value:

```env
VITE_API_URL=http://localhost:8080
```

If the backend runs on another origin, update `VITE_API_URL`.

## Quick start

```powershell
cd biuro_zawodow-client
npm install
npm run dev
```

Default frontend URL:

```text
http://localhost:5173
```

The Vite dev server is configured with:

- port `5173`
- `strictPort: true`
- host `::`

## Available scripts

```powershell
npm run dev
npm run build
npm run build:dev
npm run preview
npm run lint
npm run test
npm run test:watch
```

## App structure

Important files and directories:

- `src/App.tsx` - routing
- `src/contexts/AuthContext.tsx` - auth, token/session handling
- `src/contexts/DataContext.tsx` - bootstrap loading and API mutations
- `src/pages/` - top level screens
- `src/components/` - shared UI
- `src/test/` and `src/**/*.test.tsx` - tests

## Routes

Main application routes:

- `/` - panel
- `/events`
- `/events/:id`
- `/events/:id/import`
- `/events/:id/participants`
- `/events/:id/participants/:participantId`
- `/scanner`
- `/scanner-info`
- `/events/:id/emails`
- `/organizations`
- `/organizations/:id`
- `/organizations/:id/archived-events`
- `/profile`
- `/login`
- `/reset-password`

Scanner specific behavior:

- scanners without currently available assignments are redirected to `/scanner-info`
- scanners can use `/scanner` and `/events/:id/participants` only when they have at least one assigned event with an open race office window

## Role behavior

- `superadmin` sees all organizations and all events
- `admin` sees all organizations and their events
- `editor` sees only their own organization and its events
- `scanner` sees only assigned events while the race office is open

The frontend still relies on server side authorization and filtered bootstrap data from the API.

## API integration

The app talks to the backend defined by `VITE_API_URL`. The main integration points are:

- auth:
  - `POST /auth/login`
  - `GET /auth/me`
  - `POST /auth/forgot-password`
  - `POST /auth/reset-password`
  - `POST /auth/change-password`
- bootstrap:
  - `GET /bootstrap`
- event workflows:
  - create, update and delete events
  - CSV import analyze/confirm/run
  - QR email bulk sending
  - participant and activity log CSV export
- participant workflows:
  - update status
  - reassign package
  - QR preview
  - single QR email send
  - QR scan
  - delete
- organization workflows:
  - create, update, delete
  - event limit update
- user workflows:
  - create
  - role change
  - scanner event assignments
  - delete

## Local development notes

- Auth user and token are stored in `sessionStorage`.
- Selected event context is persisted per user.
- The frontend expects the backend Swagger/OpenAPI and runtime endpoints to stay in sync.

## Testing

The repo already contains frontend tests, for example:

- `src/contexts/DataContext.test.tsx`
- `src/test/example.test.ts`

Run:

```powershell
npm run test
```

## Build

Production build:

```powershell
npm run build
```

Preview the built app locally:

```powershell
npm run preview
```

If the production build is hosted under Apache or XAMPP with `BrowserRouter`, keep the generated `.htaccess` from `public/.htaccess` next to `index.html`. Without that rewrite, refreshing deep routes such as `/events/:id`, `/events/:id/participants/:participantId`, `/organizations/:id`, or `/profile` will return the server `404` instead of booting the SPA.
