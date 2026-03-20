

# Przebudowa Skanera QR — Real Camera + Autocomplete

## Overview

Replace the mock scanner buttons with a real QR code scanning library and replace the simple search input with a debounced autocomplete dropdown. Keep all existing logic (auto check-in, success/error screens, recent scans, package handling).

## Key Changes

### 1. Add `html5-qrcode` library
- Install `html5-qrcode` npm package
- It works entirely in the browser, no backend needed
- Renders camera feed into a div, fires callback on successful decode

### 2. QR Scanner Component (`src/components/QrScannerView.tsx`)
- Wrap `html5-qrcode`'s `Html5Qrcode` class in a React component
- Handle camera permission states: requesting, active, denied/error
- On scan success: call parent callback with decoded string
- On camera error: show fallback message "Użyj wyszukiwania ręcznego"
- Cleanup scanner on unmount
- Aspect ratio ~4:3 for mobile camera feed

### 3. Autocomplete Search (`src/components/ParticipantSearch.tsx`)
- Input with debounce (300ms via `setTimeout`)
- Simulated API call: `searchParticipants(query)` returns `Promise<Participant[]>` with 300-500ms delay
- Shows loading spinner "Szukam..."
- Dropdown with max 5 results showing: name, bib number, status badge
- Large touch targets (min 48px height per result)
- Click result → selects participant
- Empty state: "Brak wyników"
- Close dropdown on blur/selection

### 4. Scanner Page Rebuild (`src/pages/Scanner.tsx`)
- **Remove**: "Poprawny skan" and "Błędny skan" buttons entirely
- **Layout order**: Header → Autocomplete search → Camera scanner → Participant card → Recent scans
- **QR scan handler**: match decoded value against `participant.qr_code` in event participants → call existing `handleSuccess` logic
- **Keep intact**: auto check-in toggle, success/error fullscreen overlays, detail card with check-in/package buttons, recent scans section

### 5. Camera States UI
- Requesting permission: pulsing camera icon + "Uruchamiam kamerę..."
- Active: live camera feed with corner markers overlay
- Denied/error: icon + "Brak dostępu do kamery" + "Użyj wyszukiwania ręcznego"
- No camera (desktop): same fallback message

## Files

| Action | File |
|--------|------|
| Create | `src/components/QrScannerView.tsx` |
| Create | `src/components/ParticipantSearch.tsx` |
| Rewrite | `src/pages/Scanner.tsx` |
| Install | `html5-qrcode` package |

## Technical Notes
- `html5-qrcode` uses `Html5Qrcode` class — start/stop must be managed with `useEffect` cleanup
- Debounce implemented with `useRef` + `setTimeout`, no extra library needed
- Autocomplete dropdown positioned absolutely below input, z-indexed above camera
- Search matches on: `name`, `email`, `bib_number` (case-insensitive partial match)

