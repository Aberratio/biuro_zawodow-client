

# Biuro Zawodów Online — MVP Frontend Plan

## Overview
Complete React frontend for sports event check-in management with mock data, role-based access (scanner/editor/admin), and full user flow simulation.

## Architecture
- **Routing**: React Router with sidebar navigation
- **State**: React context for global state (participants, events, users, current role)
- **Data**: Rich mock data (~30 participants, 3 events, 3 users) with various statuses
- **Design**: Following the design brief — Inter font, shadow-based cards, high-contrast utility badges, large touch targets

## Pages & Components

### 1. Layout & Navigation
- Sidebar with role-aware nav items (scanner sees only Scanner + Participants)
- Role switcher at bottom of sidebar (demo mode)
- Global toast notifications

### 2. Dashboard (`/`)
- **Admin**: Event count, participant count, checked-in today, recent activity timeline, event list
- **Scanner/Editor**: Single event focus, big "Open Scanner" button, checked-in counter, recent scans list

### 3. Events (`/events`)
- Admin-only event list with progress bars
- "Create Event" modal with form
- Click → Event details

### 4. Event Details (`/events/:id`)
- Event info, stats, participant breakdown chart
- Quick actions: open scanner, view participants

### 5. Participants (`/participants`)
- Full table: name, email, bib, status, package status
- Search, filter (status, package), sort
- Click row → participant details

### 6. Participant Details (`/participants/:id`)
- Full data display, status badges, mock timeline history
- **Editor/Admin**: Edit form, status change buttons, "Transfer package" modal

### 7. QR Scanner (`/scanner`) — **Priority #1**
- Large mock camera viewfinder with scanning animation
- "Simulate valid scan" / "Simulate error" buttons
- Manual search input field
- Scan result: slide-up sheet with name, bib, status, large action buttons (Check-in / Issue package)
- Already checked-in: clear green confirmation message
- Recent scans section below scanner

### 8. CSV Import (`/import`)
- Drag & drop zone with format instructions
- "Load demo data" button that populates preview table
- Validation display (missing emails, duplicates highlighted)
- Summary + "Import" button → updates global state

### 9. User Management (`/users`)
- Admin-only user table with roles
- Add user modal, change role dropdown, delete with confirmation
- Mock invitation toast

### 10. QR Email Sending (`/emails`)
- Email template preview with QR placeholder
- Participant list with sent/pending status
- "Send to all" button → progress simulation → toast
- Sent counter

## Data Layer
- `MockDataContext` with React Context providing all state + actions
- Actions: checkIn, collectPackage, addParticipant, updateParticipant, importCSV, createEvent, addUser, removeUser, changeRole, simulateSendEmails
- Realistic Polish mock data for sports events

## UX Details
- Loading skeletons on view transitions
- Empty states with illustrations for empty lists
- Form validation with inline errors
- Toast notifications for all actions
- `tabular-nums` on all numeric displays
- 48-64px touch targets on scanner action buttons
- Smooth transitions (150ms cubic-bezier)

