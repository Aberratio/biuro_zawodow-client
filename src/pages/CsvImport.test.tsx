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

function createCsvFile(content: string, name: string): File {
  const file = new File([content], name, { type: 'text/csv' });
  Object.defineProperty(file, 'arrayBuffer', {
    value: async () => new TextEncoder().encode(content).buffer,
  });
  return file;
}

describe('CsvImport page', () => {
  it('skips the email selection step when there is only one email candidate', async () => {
    useDataMock.mockReturnValue({
      events: [createEvent()],
      selectedEventId: 'event-1',
      analyzeParticipantImport: vi.fn(async () => ({
        headers: ['Email', 'Imie'],
        sample_rows: [{ Email: 'anna@example.com', Imie: 'Anna' }],
        email_candidates: [{ column: 'Email', matched_count: 1 }],
        has_mapping: false,
        has_baseline_import: false,
        mappings: [
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
      confirmParticipantImportMapping: vi.fn(),
      runParticipantImport: vi.fn(),
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

    const file = createCsvFile('Email,Imie\nanna@example.com,Anna', 'uczestnicy.csv');
    fireEvent.change(fileInput as HTMLInputElement, { target: { files: [file] } });

    await screen.findByText('Mapowanie kolumn');

    expect(screen.queryByRole('heading', { name: 'Wybierz kolumnę email' })).not.toBeInTheDocument();
    expect(await screen.findByText(/Email:/)).toBeInTheDocument();
  });

  it('shows a compact email selection step when there are multiple email candidates', async () => {
    useDataMock.mockReturnValue({
      events: [createEvent()],
      selectedEventId: 'event-1',
      analyzeParticipantImport: vi.fn(async () => ({
        headers: ['Email', 'Email opiekuna', 'Imie'],
        sample_rows: [{ Email: 'anna@example.com', 'Email opiekuna': 'opiekun@example.com', Imie: 'Anna' }],
        email_candidates: [
          { column: 'Email', matched_count: 1 },
          { column: 'Email opiekuna', matched_count: 1 },
        ],
        has_mapping: false,
        has_baseline_import: false,
        mappings: [
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
      confirmParticipantImportMapping: vi.fn(),
      runParticipantImport: vi.fn(),
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

    const file = createCsvFile('Email,Email opiekuna,Imie\nanna@example.com,opiekun@example.com,Anna', 'uczestnicy.csv');
    fireEvent.change(fileInput as HTMLInputElement, { target: { files: [file] } });

    await screen.findByRole('heading', { name: 'Wybierz kolumnę email' });

    expect(screen.getByText('2 kandydatów')).toBeInTheDocument();
    expect(screen.getByLabelText('Kolumna email')).toBeInTheDocument();
    expect(screen.queryByText('Jak wybrać kolumnę email')).not.toBeInTheDocument();
  });

  it('shows a visible warning when no column is mapped as bib_number before import', async () => {
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
        headers: ['Email', 'Imie', 'Numer startowy'],
        sample_rows: [{ Email: 'anna@example.com', Imie: 'Anna', 'Numer startowy': '101' }],
        email_candidates: [{ column: 'Email', matched_count: 1 }],
        has_mapping: false,
        has_baseline_import: false,
        mappings: [
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

    const file = createCsvFile('Email,Imie,Numer startowy\nanna@example.com,Anna,101', 'uczestnicy.csv');
    fireEvent.change(fileInput as HTMLInputElement, { target: { files: [file] } });

    await screen.findByText('Mapowanie kolumn');
    expect(screen.getByText('Nie wybrano pola „Numer startowy”')).toBeInTheDocument();
    expect(screen.getByText(/Numer będzie można nadać później, ale ręcznie dla każdego uczestnika osobno/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Zapisz mapowanie i importuj' }));

    await waitFor(() => {
      expect(confirmParticipantImportMapping).toHaveBeenCalledWith('event-1', expect.objectContaining({
        fields: expect.arrayContaining([
          expect.objectContaining({
            source_column_name: 'Numer startowy',
            field_role: 'custom',
          }),
        ]),
      }));
    });
  });

  it('keeps the missing bib number warning visible when a likely bib number column is mapped as custom', async () => {
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
        headers: ['Email', 'Imie', 'Numer startowy'],
        sample_rows: [{ Email: 'anna@example.com', Imie: 'Anna', 'Numer startowy': '101' }],
        email_candidates: [{ column: 'Email', matched_count: 1 }],
        has_mapping: false,
        has_baseline_import: false,
        mappings: [
          {
            source_column_name: 'Imie',
            alias: 'Imię',
            field_role: 'display_name_part',
            display_order: 1,
            is_required: true,
            is_active: true,
          },
          {
            source_column_name: 'Numer startowy',
            alias: 'Numer startowy',
            field_role: 'custom',
            display_order: 2,
            is_required: false,
            is_active: true,
          },
        ],
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

    const file = createCsvFile('Email,Imie,Numer startowy\nanna@example.com,Anna,101', 'uczestnicy.csv');
    fireEvent.change(fileInput as HTMLInputElement, { target: { files: [file] } });

    await screen.findByText('Mapowanie kolumn');
    expect(screen.getByText('Nie wybrano pola „Numer startowy”')).toBeInTheDocument();
    expect(screen.getByText(/Numer będzie można nadać później, ale ręcznie dla każdego uczestnika osobno/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Zapisz mapowanie i importuj' }));

    await waitFor(() => {
      expect(confirmParticipantImportMapping).toHaveBeenCalledWith('event-1', expect.objectContaining({
        fields: expect.arrayContaining([
          expect.objectContaining({
            source_column_name: 'Numer startowy',
            field_role: 'custom',
          }),
        ]),
      }));
    });
  });

  it('shows a visible warning before importing with a saved mapping when no column is mapped as bib_number', async () => {
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
        headers: ['Email', 'Imie', 'Numer startowy'],
        sample_rows: [{ Email: 'anna@example.com', Imie: 'Anna', 'Numer startowy': '101' }],
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
          {
            source_column_name: 'Numer startowy',
            alias: 'Numer startowy',
            field_role: 'custom',
            display_order: 2,
            is_required: false,
            is_active: true,
          },
        ],
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
      confirmParticipantImportMapping: vi.fn(),
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

    const file = createCsvFile('Email,Imie,Numer startowy\nanna@example.com,Anna,101', 'uczestnicy.csv');
    fireEvent.change(fileInput as HTMLInputElement, { target: { files: [file] } });

    await screen.findByText('Dopasowanie mapowania do pliku');
    expect(screen.getByText('Nie wybrano pola „Numer startowy”')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Importuj z zapisanym mapowaniem' }));

    await waitFor(() => {
      expect(runParticipantImport).toHaveBeenCalledWith('event-1', 'Email,Imie,Numer startowy\nanna@example.com,Anna,101');
    });
  });

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
        headers: ['Email', 'Imie', 'Uwagi'],
        sample_rows: [{ Email: 'anna@example.com', Imie: 'Anna', Uwagi: 'VIP' }],
        email_candidates: [{ column: 'Email', matched_count: 1 }],
        has_mapping: false,
        has_baseline_import: false,
        mappings: [
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

    const file = createCsvFile('Email,Imie,Uwagi\nanna@example.com,Anna,VIP', 'uczestnicy.csv');
    fireEvent.change(fileInput as HTMLInputElement, { target: { files: [file] } });

    await screen.findByText('Mapowanie kolumn');
    expect(screen.getByText('Podgląd uczestnika po imporcie')).toBeInTheDocument();
    expect(screen.queryByText('Co się stanie z kolumną')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Co się stanie z kolumną' }));
    expect(screen.getByText('Co się stanie z kolumną')).toBeInTheDocument();
    expect(screen.getAllByText('Wyróżnij przy odprawie').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Zmień typ kolumny Uwagi' }));
    const importantRoleChoices = await screen.findAllByText('Wyróżnij przy odprawie');
    fireEvent.click(importantRoleChoices[importantRoleChoices.length - 1]);

    fireEvent.click(screen.getByRole('button', { name: 'Zapisz mapowanie i importuj' }));

    await waitFor(() => {
      expect(confirmParticipantImportMapping).toHaveBeenCalledWith('event-1', expect.objectContaining({
        email_column: 'Email',
        fields: expect.arrayContaining([
          expect.objectContaining({
            source_column_name: 'Uwagi',
            field_role: 'important_custom',
          }),
        ]),
      }));
    });

    expect(runParticipantImport).toHaveBeenCalledWith('event-1', 'Email,Imie,Uwagi\nanna@example.com,Anna,VIP');
  });

  it('configures required select validation and suggests options from CSV values', async () => {
    const confirmParticipantImportMapping = vi.fn(async () => []);
    const runParticipantImport = vi.fn(async () => ({
      created_count: 2,
      duplicate_count: 0,
      invalid_count: 0,
      invalid_rows: [],
      participants: [],
    }));

    useDataMock.mockReturnValue({
      events: [createEvent()],
      selectedEventId: 'event-1',
      analyzeParticipantImport: vi.fn(async () => ({
        headers: ['Email', 'Imie', 'Dystans'],
        sample_rows: [
          { Email: 'anna@example.com', Imie: 'Anna', Dystans: '5K' },
          { Email: 'jan@example.com', Imie: 'Jan', Dystans: '10K' },
        ],
        email_candidates: [{ column: 'Email', matched_count: 2 }],
        has_mapping: false,
        has_baseline_import: false,
        mappings: [
          {
            source_column_name: 'Imie',
            alias: 'ImiÄ™',
            field_role: 'display_name_part',
            display_order: 1,
            is_required: true,
            is_active: true,
          },
        ],
        missing_required_columns: [],
        row_count: 2,
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

    const file = createCsvFile('Email,Imie,Dystans\nanna@example.com,Anna,5K\njan@example.com,Jan,10K', 'uczestnicy.csv');
    fireEvent.change(fileInput as HTMLInputElement, { target: { files: [file] } });

    await screen.findByText('Mapowanie kolumn');
    fireEvent.click(screen.getByRole('button', { name: /Walidacja i typ pola/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Pole obligatoryjne' }));
    fireEvent.click(screen.getByRole('combobox', { name: 'Typ pola' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Lista wyboru' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zasugeruj z kolumny' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Opcje listy, po jednej w linii')).toHaveValue('10K\n5K');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Zapisz mapowanie i importuj' }));

    await waitFor(() => {
      expect(confirmParticipantImportMapping).toHaveBeenCalledWith('event-1', expect.objectContaining({
        fields: expect.arrayContaining([
          expect.objectContaining({
            source_column_name: 'Dystans',
            field_role: 'custom',
            field_type: 'select',
            is_required: true,
            validation_rules: { options: ['10K', '5K'] },
          }),
        ]),
      }));
    });
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

    const file = createCsvFile('Email,Imie\nnowa@example.com,Nowa', 'nowa-lista.csv');
    fireEvent.change(fileInput as HTMLInputElement, { target: { files: [file] } });

    await screen.findByText('Ten CSV wygląda jak inna lista');
    fireEvent.click(screen.getByRole('button', { name: 'Usuń starą listę i importuj nową' }));

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
