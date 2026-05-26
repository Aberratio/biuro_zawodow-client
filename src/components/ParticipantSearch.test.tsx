import { act, fireEvent, render, screen } from '@testing-library/react';
import type { Participant } from '@/types';
import ParticipantSearch from './ParticipantSearch';

const participants: Participant[] = [
  {
    id: 'p-1',
    event_id: 'event-1',
    name: 'Anna Kowalska',
    email: 'anna@example.com',
    bib_number: '101',
    qr_code: 'qr-1',
    status: 'not_checked_in',
    email_status: 'not_sent',
  },
  {
    id: 'p-2',
    event_id: 'event-1',
    name: 'Jan Nowak',
    email: 'jan@example.com',
    bib_number: '202',
    qr_code: 'qr-2',
    status: 'checked_in',
    email_status: 'sent',
  },
];

describe('ParticipantSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('searches by name, email and exact bib number after debounce', () => {
    const onSelect = vi.fn();
    render(<ParticipantSearch participants={participants} onSelect={onSelect} autoFocus={false} />);

    fireEvent.change(screen.getByPlaceholderText('Nazwisko, numer, email...'), {
      target: { value: 'anna' },
    });
    act(() => vi.advanceTimersByTime(300));

    expect(screen.getByText('Anna Kowalska')).toBeInTheDocument();
    expect(screen.queryByText('Jan Nowak')).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Nazwisko, numer, email...'), {
      target: { value: '202' },
    });
    act(() => vi.advanceTimersByTime(300));

    expect(screen.getByText('Jan Nowak')).toBeInTheDocument();
  });

  it('clears search after selecting a participant', () => {
    const onSelect = vi.fn();
    render(<ParticipantSearch participants={participants} onSelect={onSelect} autoFocus={false} />);

    const input = screen.getByPlaceholderText('Nazwisko, numer, email...');
    fireEvent.change(input, { target: { value: 'anna@example.com' } });
    act(() => vi.advanceTimersByTime(300));
    fireEvent.click(screen.getByText('Anna Kowalska'));

    expect(onSelect).toHaveBeenCalledWith(participants[0]);
    expect(input).toHaveValue('');
    expect(screen.queryByText('Anna Kowalska')).not.toBeInTheDocument();
  });
});
