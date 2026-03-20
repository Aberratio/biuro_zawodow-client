

# Scanner: Confirmation Modals, Undo Check-in, Mobile Header

## Changes

### 1. Add `undoCheckIn` to MockDataContext
- New function that sets participant status back to `pending` and clears `checked_in_at`
- Add to context interface and provider

### 2. Scanner page (`Scanner.tsx`) — Search confirmation modal
- When user selects participant from autocomplete, do NOT auto check-in
- Instead, open a confirmation dialog showing: name, bib number, email, status, package status
- If participant is `pending`: show "Potwierdź odprawę" button + "Anuluj"
- If participant is `checked_in`: show "Już odprawiony" message, no check-in button
- After confirmation: run check-in, show success overlay, add to recent

### 3. Scanner page — Undo check-in ("Cofnij odprawę")
- In the detail card, when participant is `checked_in`, show a destructive "Cofnij odprawę" button (smaller, outline/destructive style)
- Clicking opens a separate warning dialog: name, bib, warning text, destructive "Tak, cofnij odprawę" button + "Anuluj"
- After confirm: call `undoCheckIn`, toast, update recent scans

### 4. QR scan behavior
- QR scan with auto check-in ON: keeps current fast behavior (auto check-in, success screen, no modal)
- QR scan with auto check-in OFF: opens the same confirmation modal as manual search

### 5. Mobile header (`Layout.tsx`)
- On mobile (below `md`): show only event selector + sidebar trigger (hamburger)
- Hide organization badge and role badge on mobile

### Files to modify
- `src/contexts/MockDataContext.tsx` — add `undoCheckIn`
- `src/pages/Scanner.tsx` — add confirmation dialog, undo dialog, change search select flow
- `src/components/Layout.tsx` — hide badges on mobile

