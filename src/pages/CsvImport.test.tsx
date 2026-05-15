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
        has_baseline_import: false,
        mappings: [],
        missing_required_columns: [],
        row_count: 1,
        existing_participant_count: 0,
        sent_qr_email_count: 0,
        list_difference: {
          columns_differ: false,
          missing_columns: [],
          extra_columns: [],
          participant_difference_ratio: 0,
          should_offer_replacement: false,
        },
      })),
      confirmParticipantImportMapping,
      runParticipantImport,
      replaceParticipantImport: vi.fn(),
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

  it('offers replacing the saved list when analysis detects a different CSV', async () => {
    const replaceParticipantImport = vi.fn(async () => ({
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
        headers: ['Email', 'Imie'],
        sample_rows: [{ Email: 'nowa@example.com', Imie: 'Nowa' }],
        email_candidates: [{ column: 'Email', matched_count: 1 }],
        has_mapping: true,
        has_baseline_import: true,
        mappings: [
          {
            source_column_name: 'Email',
            alias: 'Email',
            field_role: 'email',
            display_order: 0,
            is_required: true,
            is_active: true,
          },
          {
            source_column_name: 'Imie',
            alias: 'Imię',
            field_role: 'display_name_part',
            display_order: 1,
            is_required: true,
            is_active: true,
          },
        ],
        missing_required_columns: [],
        row_count: 1,
        existing_participant_count: 10,
        sent_qr_email_count: 2,
        list_difference: {
          columns_differ: false,
          missing_columns: [],
          extra_columns: [],
          participant_difference_ratio: 0.7,
          should_offer_replacement: true,
        },
      })),
      confirmParticipantImportMapping: vi.fn(),
      runParticipantImport: vi.fn(),
      replaceParticipantImport,
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

    const file = new File(['Email,Imie\nnowa@example.com,Nowa'], 'nowa-lista.csv', { type: 'text/csv' });
    fireEvent.change(fileInput as HTMLInputElement, { target: { files: [file] } });

    await screen.findByText('Ten CSV wygląda jak inna lista');
    fireEvent.click(screen.getByRole('button', { name: 'Usuń starą i wgraj nową' }));

    await screen.findByText('Mapowanie kolumn');
    fireEvent.click(screen.getByRole('button', { name: 'Usuń starą listę i importuj nową' }));

    await waitFor(() => {
      expect(replaceParticipantImport).toHaveBeenCalledWith(
        'event-1',
        'Email,Imie\nnowa@example.com,Nowa',
        expect.objectContaining({ email_column: 'Email' }),
        true,
      );
    });
  });
});
