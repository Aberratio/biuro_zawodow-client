import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import CsvImportSummary from '@/pages/CsvImportSummary';
import type { Event } from '@/types';

const useDataMock = vi.fn();

vi.mock('@/contexts/DataContext', () => ({
  useData: () => useDataMock(),
}));

vi.mock('@/hooks/use-route-event-context', () => ({
  useRouteEventContext: vi.fn(),
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

function renderSummaryState(state: Record<string, unknown>) {
  useDataMock.mockReturnValue({
    events: [createEvent()],
    selectedEventId: 'event-1',
    isLoading: false,
    runParticipantImport: vi.fn(),
    connectionState: 'online',
  });

  render(
    <MemoryRouter
      initialEntries={[{
        pathname: '/events/event-1/import/summary',
        state,
      }]}
    >
      <Routes>
        <Route path="/events/:id/import/summary" element={<CsvImportSummary />} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderSummary(createdCount: number, mode: 'append' | 'replace' = 'append') {
  renderSummaryState({
    summary: {
      created_count: createdCount,
      duplicate_count: 0,
      invalid_count: 0,
      invalid_rows: [],
    },
    headers: ['Email'],
    emailColumn: 'Email',
    fileName: 'uczestnicy.csv',
    mode,
  });
}

describe('CsvImportSummary page', () => {
  it('does not say that new participants were appended when the import added none', () => {
    renderSummary(0);

    expect(screen.getByText('Nie dodano żadnych uczestników. Lista wydarzenia nie została uzupełniona nowymi rekordami.')).toBeInTheDocument();
    expect(screen.queryByText(/Nowi uczestnicy zostali dopisani/)).not.toBeInTheDocument();
  });

  it('uses the singular participant wording for one added participant', () => {
    renderSummary(1);

    expect(screen.getByText('Dodano 1 uczestnika. Nowy uczestnik został dopisany do wydarzenia.')).toBeInTheDocument();
  });

  it('keeps the plural participant wording for multiple added participants', () => {
    renderSummary(3);

    expect(screen.getByText('Dodano 3 uczestników. Nowi uczestnicy zostali dopisani do wydarzenia.')).toBeInTheDocument();
  });
  it('shows source CSV row values for invalid rows when API returns only row numbers', () => {
    renderSummaryState({
      summary: {
        created_count: 0,
        duplicate_count: 0,
        invalid_count: 1,
        invalid_rows: [2],
      },
      headers: ['Email', 'Imie', 'Klub'],
      sourceRows: [{ Email: 'bad-email', Imie: 'Jan', Klub: 'ABC' }],
      emailColumn: 'Email',
      fileName: 'uczestnicy.csv',
      mode: 'append',
    });

    expect(screen.getByDisplayValue('bad-email')).toBeInTheDocument();
    expect(screen.getByText('Jan')).toBeInTheDocument();
    expect(screen.getByText('ABC')).toBeInTheDocument();
  });
});
