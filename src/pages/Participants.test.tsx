import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import Participants from '@/pages/Participants';
import { createTestParticipantMapping } from '@/test/factories';

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

describe('Participants page', () => {
  it('allows removing an empty saved participant list after a fully invalid CSV import', async () => {
    const resetEventParticipantList = vi.fn(async () => ({
      ok: true,
      deleted_participant_count: 0,
      deleted_mapping_count: 1,
      deleted_baseline_record_count: 0,
      deleted_change_log_count: 0,
    }));

    useDataMock.mockReturnValue({
      participants: [],
      selectedEventId: 'event-1',
      currentRole: 'admin',
      isLoading: false,
      getParticipantFieldMappingsState: vi.fn(async () => ({
        has_mapping: true,
        has_baseline_import: false,
        mappings: [createTestParticipantMapping()],
      })),
      addParticipantManually: vi.fn(),
      resetEventParticipantList,
      connectionState: 'online',
      refreshData: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/events/event-1/participants']}>
        <Routes>
          <Route path="/events/:id/participants" element={<Participants />} />
        </Routes>
      </MemoryRouter>,
    );

    const resetButton = await screen.findByRole('button', { name: /Usuń listę/i });
    fireEvent.click(resetButton);
    fireEvent.click(screen.getByRole('button', { name: /Usuń listę i mapowanie/i }));

    await waitFor(() => {
      expect(resetEventParticipantList).toHaveBeenCalledWith('event-1', false);
    });
  });
});
