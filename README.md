# biuro_zawodow-client

React + Vite frontend for the `biuro_zawodow` race-office system. It connects to the PHP API and provides role-aware navigation for event check-in, participant management, QR scanning, CSV import, QR email sending and event exports.

## Stack

React 18, TypeScript, Vite, React Router, TanStack Query, Tailwind CSS, Radix UI, Vitest.

## Features

- Login, session restore and password reset
- Role-aware UI for `superadmin`, `admin`, `editor`, `scanner`
- Panel with open, upcoming and recently finished events
- Organizations view with card-based navigation
- Event details: edit, delete, participant/log CSV export, QR email sending
- Participant management: manual add, package reassignment, QR preview, single QR email send, delete
- CSV import flow: analyze, map columns, run import
- QR scanner flow for assigned and currently open events

## Requirements

- Node.js 18+, npm
- Running backend API from `../biuro_zawodow-api`

## Setup

```powershell
cd biuro_zawodow-client
Copy-Item .env.example .env
npm install
npm run dev
```

Frontend runs at `http://localhost:5173` (dev server uses `strictPort: true`).

## Environment

`.env` variables:

```env
VITE_API_URL=http://localhost:8080
```

Update `VITE_API_URL` if the backend runs on another origin.

## Scripts

```powershell
npm run dev         # start dev server
npm run build        # production build
npm run build:dev    # dev-mode build
npm run preview      # preview production build
npm run lint          # lint
npm run test          # run tests
npm run test:watch   # watch tests
```

## Structure

- `src/App.tsx` - routing
- `src/contexts/AuthContext.tsx` - auth, token/session handling
- `src/contexts/DataContext.tsx` - bootstrap loading and API mutations
- `src/pages/` - top-level screens
- `src/components/` - shared UI
- `src/test/`, `src/**/*.test.tsx` - tests

## Roles

- `superadmin` - all organizations and events
- `admin` - all organizations and their events
- `editor` - only their own organization and its events
- `scanner` - only assigned events while the race office is open

Scanners without an open assignment are redirected to `/scanner-info`. The frontend UI reflects these rules, but authorization and data filtering are enforced server-side.

## API integration

The app talks to the backend at `VITE_API_URL` for auth, bootstrap, event, participant, organization and user management workflows. Auth user/token are stored in `sessionStorage`; the frontend expects the backend's Swagger/OpenAPI contract and runtime endpoints to stay in sync.

## Testing

```powershell
npm run test
```

Example tests: `src/contexts/DataContext.test.tsx`, `src/test/example.test.ts`.

## Deployment

Production build uses hash-based routing (`npm run build`), so refreshing nested routes (e.g. `/#/events/:id/participants/:participantId`) doesn't require server-side SPA rewrites. A generated `.htaccess` is still included in `dist/` for environments that prefer clean URLs via server rewrites, though it isn't required by default.
