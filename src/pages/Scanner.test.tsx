import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Scanner from '@/pages/Scanner';
import ParticipantDetails from '@/pages/ParticipantDetails';
import type { Event, Participant, ParticipantFieldMapping, User } from '@/types';

const useDataMock = vi.fn();

vi.mock('@/contexts/DataContext', () => ({
  useData: () => useDataMock(),
}));

vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}));

vi.mock('@/hooks/use-route-event-context', () => ({
  useRouteEventContext: vi.fn(),
}));

vi.mock('@/components/ParticipantBibNumberConflictDialog', () => ({
  ParticipantBibNumberConflictDialog: () => null,
}));

vi.mock('@/components/ParticipantSearch', () => ({
  default: ({ autoFocus }: { autoFocus?: boolean }) => (
    <div>
      <label htmlFor="scanner-search">Szukaj uczestnika</label>
      <input id="scanner-search" aria-label="Szukaj uczestnika" autoFocus={autoFocus} />
    </div>
  ),
}));

vi.mock('@/components/QrScannerView', () => ({
  default: ({ onScan, paused }: { onScan: (decodedText: string) => void; paused?: boolean }) => (
    paused
      ? null
      : (
          <button type="button" onClick={() => onScan('QR-1')}>
            Zasymuluj skan
          </button>
        )
  ),
}));

function createEvent(): Event {
  return {
    id: 'event-1',
    name: 'Bieg Miejski',
    location: 'Warszawa',
    organization_id: 'org-1',
    office_open_at: '2099-04-12T07:00:00',
    office_close_at: '2099-04-12T15:00:00',
  };
}

function createParticipant(bibNumber = ''): Participant {
  return {
    id: 'p-1',
    event_id: 'event-1',
    name: 'Anna Kowalska',
    email: 'anna@example.com',
    bib_number: bibNumber,
    qr_code: 'QR-1',
    status: 'not_checked_in',
    email_status: 'not_sent',
    custom_fields: {
      miasto: 'Warszawa',
    },
  };
}

function createMappings(): ParticipantFieldMapping[] {
  return [
    {
      source_column_name: 'first_name',
      alias: 'Imię',
      field_role: 'display_name_part',
      display_order: 0,
      is_required: false,
      is_active: true,
    },
    {
      source_column_name: 'last_name',
      alias: 'Nazwisko',
      field_role: 'display_name_part',
      display_order: 1,
      is_required: false,
      is_active: true,
    },
    {
      source_column_name: 'city',
      alias: 'Miasto',
      field_role: 'custom',
      display_order: 2,
      is_required: false,
      is_active: true,
    },
  ];
}

function createDataState(role: User['role'], bibNumber = '') {
  const event = createEvent();
  const participant = createParticipant(bibNumber);

  return {
    participants: [participant],
    events: [event],
    activityLog: [],
    selectedEventId: event.id,
    selectedOrganizationId: event.organization_id,
    updateParticipantStatus: vi.fn(async () => ({ ok: true })),
    updateParticipantBibNumber: vi.fn(async () => ({ ok: true })),
    updateParticipantDetails: vi.fn(async () => ({ ok: true })),
    currentRole: role,
    scanParticipantQr: vi.fn(async () => ({
      ok: true,
      data: {
        participant,
        event,
        access: { allowed: true },
      },
    })),
    isLoading: false,
    visibleEvents: [event],
    connectionState: 'online',
    pendingMutationCount: 0,
    scannerMode: 'online',
    getParticipantFieldMappings: vi.fn(async () => createMappings()),
    sendParticipantQrEmail: vi.fn(async () => ({ ok: true })),
    deleteParticipant: vi.fn(async () => ({ ok: true })),
    getParticipantQrPreview: vi.fn(async () => ({
      participant,
      event,
      qr_code_svg_data_uri: 'data:image/svg+xml;base64,PHN2Zy8+',
      qr_code_image_url: 'https://example.com/qr.svg',
    })),
  };
}

function renderPages() {
  render(
    <MemoryRouter initialEntries={['/scanner']}>
      <Routes>
        <Route path="/scanner" element={<Scanner />} />
        <Route path="/events/:id/participants/:participantId" element={<ParticipantDetails />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Scanner page', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2099-04-12T10:00:00'));
    useDataMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows inline bib number editing for roles above plain scanner and hides scan controls in detail view', async () => {
    const dataState = createDataState('scanner_plus', '0');
    useDataMock.mockReturnValue(dataState);

    renderPages();

    expect(screen.getByRole('textbox', { name: 'Szukaj uczestnika' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Zasymuluj skan' }));

    await screen.findByText('Dane do weryfikacji');

    expect(screen.queryByRole('textbox', { name: 'Szukaj uczestnika' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Zasymuluj skan' })).not.toBeInTheDocument();

    const bibNumberInput = screen.getByRole('textbox', { name: 'Numer startowy' });
    expect(bibNumberInput).toHaveValue('');

    fireEvent.change(bibNumberInput, { target: { value: '123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz numer' }));

    await waitFor(() => {
      expect(dataState.updateParticipantBibNumber).toHaveBeenCalledWith('p-1', '123');
    });
  });

  it('does not expose inline participant editing for the plain scanner role', async () => {
    useDataMock.mockReturnValue(createDataState('scanner', ''));

    renderPages();

    fireEvent.click(screen.getByRole('button', { name: 'Zasymuluj skan' }));
    await screen.findByText('Dane do weryfikacji');

    expect(screen.queryByRole('textbox', { name: 'Numer startowy' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edytuj dane uczestnika' })).not.toBeInTheDocument();
    expect(screen.getAllByText('Do uzupełnienia').length).toBeGreaterThan(0);
  });

  it('opens participant edit dialog immediately after navigating from scanner edit action', async () => {
    useDataMock.mockReturnValue(createDataState('scanner_plus', ''));

    renderPages();

    fireEvent.click(screen.getByRole('button', { name: 'Zasymuluj skan' }));
    await screen.findByRole('button', { name: 'Edytuj dane uczestnika' });

    fireEvent.click(screen.getByRole('button', { name: 'Edytuj dane uczestnika' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Edytuj dane uczestnika' })).toBeInTheDocument();
    expect(within(dialog).getByRole('textbox', { name: 'Email' })).toHaveValue('anna@example.com');
  });
});
