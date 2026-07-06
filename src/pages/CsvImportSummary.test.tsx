import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  const runParticipantImport = vi.fn().mockResolvedValue({
    created_count: 0,
    duplicate_count: 0,
    invalid_count: 0,
    invalid_rows: [],
    invalid_row_details: [],
    duplicate_row_details: [],
    participants: [],
  });

  useDataMock.mockReturnValue({
    events: [createEvent()],
    selectedEventId: 'event-1',
    isLoading: false,
    runParticipantImport,
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

  return { runParticipantImport };
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

    fireEvent.click(screen.getByRole('button', { name: /^Edytuj$/ }));

    expect(screen.getByDisplayValue('bad-email')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Jan')).toBeInTheDocument();
    expect(screen.getByDisplayValue('ABC')).toBeInTheDocument();
  });

  it('uses the full source row when saving an invalid row with a corrected email', async () => {
    const { runParticipantImport } = renderSummaryState({
      summary: {
        created_count: 0,
        duplicate_count: 0,
        invalid_count: 1,
        invalid_rows: [2],
        invalid_row_details: [{
          row_number: 2,
          reasons: ['Brak adresu e-mail w kolumnie "Email".'],
          row: { Email: '' },
        }],
      },
      headers: ['Email', 'Imie', 'Nazwisko', 'Klub'],
      sourceRows: [{ Email: '', Imie: 'Jan', Nazwisko: 'Kowalski', Klub: 'ABC' }],
      emailColumn: 'Email',
      fileName: 'uczestnicy.csv',
      mode: 'append',
    });

    fireEvent.click(screen.getByRole('button', { name: /^Edytuj$/ }));

    expect(screen.getByDisplayValue('Jan')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Kowalski')).toBeInTheDocument();
    expect(screen.getByDisplayValue('ABC')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('email@example.com'), {
      target: { value: 'jan@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Dopisz$/ }));

    await waitFor(() => expect(runParticipantImport).toHaveBeenCalled());
    expect(runParticipantImport).toHaveBeenCalledWith(
      'event-1',
      'Email;Imie;Nazwisko;Klub\r\njan@example.com;Jan;Kowalski;ABC',
    );
  });

  it('lets a non-email column be corrected when the email was already valid', async () => {
    const { runParticipantImport } = renderSummaryState({
      summary: {
        created_count: 0,
        duplicate_count: 0,
        invalid_count: 1,
        invalid_rows: [2],
        invalid_row_details: [{
          row_number: 2,
          reasons: ['Pole "Klub" jest wymagane.'],
          row: { Email: 'jan@example.com', Imie: 'Jan', Nazwisko: 'Kowalski', Klub: '' },
        }],
      },
      headers: ['Email', 'Imie', 'Nazwisko', 'Klub'],
      sourceRows: [{ Email: 'jan@example.com', Imie: 'Jan', Nazwisko: 'Kowalski', Klub: '' }],
      emailColumn: 'Email',
      fileName: 'uczestnicy.csv',
      mode: 'append',
    });

    fireEvent.click(screen.getByRole('button', { name: /^Edytuj$/ }));

    expect(screen.getByDisplayValue('jan@example.com')).toBeInTheDocument();

    const klubInput = screen.getAllByRole('textbox').find(input => (input as HTMLInputElement).value === '');
    expect(klubInput).toBeDefined();
    fireEvent.change(klubInput!, { target: { value: 'AZS' } });
    fireEvent.click(screen.getByRole('button', { name: /^Dopisz$/ }));

    await waitFor(() => expect(runParticipantImport).toHaveBeenCalled());
    expect(runParticipantImport).toHaveBeenCalledWith(
      'event-1',
      'Email;Imie;Nazwisko;Klub\r\njan@example.com;Jan;Kowalski;AZS',
    );
  });

  it('validates mapped participant fields in the edit modal before saving', () => {
    const { runParticipantImport } = renderSummaryState({
      summary: {
        created_count: 0,
        duplicate_count: 0,
        invalid_count: 1,
        invalid_rows: [2],
        invalid_row_details: [{
          row_number: 2,
          reasons: ['Pole "Category" jest wymagane.'],
          row: { Email: 'jan@example.com', Category: '' },
        }],
      },
      headers: ['Email', 'Category'],
      sourceRows: [{ Email: 'jan@example.com', Category: '' }],
      mappings: [
        { source_column_name: 'Email', alias: 'Email', field_role: 'email', display_order: 1, is_required: true, is_active: true },
        { source_column_name: 'Category', alias: 'Category', field_role: 'custom', display_order: 2, is_required: true, is_active: true, field_type: 'text', validation_rules: {} },
      ],
      emailColumn: 'Email',
      fileName: 'uczestnicy.csv',
      mode: 'append',
    });

    fireEvent.click(screen.getByRole('button', { name: /^Edytuj$/ }));

    expect(screen.getByText(/Category\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Dopisz$/ }));

    expect(runParticipantImport).not.toHaveBeenCalled();
  });
});
