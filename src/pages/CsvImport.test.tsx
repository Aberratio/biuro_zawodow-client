import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import CsvImport from '@/pages/CsvImport';
import type { Event } from '@/types';

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

describe('CsvImport page', () => {
  it('allows mapping a column as important data and sends the new role in the payload', async () => {
    const confirmParticipantImportMapping = vi.fn(async () => []);
    const runParticipantImport = vi.fn(async () => ({
      created_count: 1,
      duplicate_count: 0,
      invalid_count: 0,
      invalid_rows: [],
      participants: [],
    }));

    useDataMock.mockReturnValue({
      events: [createEvent()],
      selectedEventId: 'event-1',
      analyzeParticipantImport: vi.fn(async () => ({
        headers: ['Email', 'Uwagi'],
        sample_rows: [{ Email: 'anna@example.com', Uwagi: 'VIP' }],
        email_candidates: [{ column: 'Email', matched_count: 1 }],
        has_mapping: false,
        mappings: [],
        missing_required_columns: [],
        row_count: 1,
      })),
      confirmParticipantImportMapping,
      runParticipantImport,
      isLoading: false,
      connectionState: 'online',
    });

    const { container } = render(
      <MemoryRouter initialEntries={['/events/event-1/import']}>
        <Routes>
          <Route path="/events/:id/import" element={<CsvImport />} />
        </Routes>
      </MemoryRouter>,
    );

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(fileInput).not.toBeNull();

    const file = new File(['Email,Uwagi\nanna@example.com,VIP'], 'uczestnicy.csv', { type: 'text/csv' });
    fireEvent.change(fileInput as HTMLInputElement, { target: { files: [file] } });

    await screen.findByText('Mapowanie kolumn');
    expect(screen.getByText('Ważne dane')).toBeInTheDocument();

    const roleTriggers = screen.getAllByRole('combobox', { name: 'Rola' });
    fireEvent.click(roleTriggers[0]);
    fireEvent.click(await screen.findByText('Ważne dane'));

    fireEvent.click(screen.getByRole('button', { name: 'Zapisz mapowanie i importuj' }));

    await waitFor(() => {
      expect(confirmParticipantImportMapping).toHaveBeenCalledWith('event-1', expect.objectContaining({
        email_column: 'Email',
        fields: [
          expect.objectContaining({
            source_column_name: 'Uwagi',
            field_role: 'important_custom',
          }),
        ],
      }));
    });

    expect(runParticipantImport).toHaveBeenCalledWith('event-1', 'Email,Uwagi\nanna@example.com,VIP');
  });
});
