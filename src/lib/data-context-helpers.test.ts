import { describe, expect, it } from 'vitest';
import { mapApiParticipantToUi } from '@/lib/data-context-helpers';

describe('mapApiParticipantToUi', () => {
  it('normalizes malformed participant payloads into safe UI data', () => {
    const participant = mapApiParticipantToUi({
      id: 12,
      event_id: null,
      first_name: '  Anna ',
      last_name: undefined as never,
      display_name: null,
      email: 42 as never,
      bib_number: 101 as never,
      qr_code: false as never,
      status: 'unexpected_status' as never,
      email_status: 'unexpected_email_status' as never,
      checked_in_at: 0 as never,
      custom_fields: {
        team: '  Fast Club ',
        lap: 3,
        broken: null,
      } as never,
      important_field_aliases: [' team ', 'lap', '', 'team'] as never,
    }, 'event-1');

    expect(participant).toEqual({
      id: 'p-12',
      event_id: 'event-1',
      name: 'Anna',
      email: '42',
      bib_number: '101',
      qr_code: 'false',
      status: 'not_checked_in',
      email_status: 'not_sent',
      payment_status: 'unknown',
      checked_in_at: '0',
      custom_fields: {
        team: 'Fast Club',
        lap: '3',
        broken: '',
      },
      important_field_aliases: ['team', 'lap'],
      sync_state: 'synced',
      sync_error: undefined,
    });
  });

  it('preserves already-normalized participant names from cached snapshots', () => {
    const participant = mapApiParticipantToUi({
      id: 'p-1',
      event_id: 'event-1',
      name: 'Anna Test',
      email: 'anna@example.com',
      bib_number: '101',
      qr_code: 'QR-101',
      status: 'checked_in',
      email_status: 'sent',
      checked_in_at: '2099-04-12T09:00:00.000Z',
      custom_fields: {
        city: 'Warsaw',
      },
      important_field_aliases: ['city'],
    }, '');

    expect(participant.name).toBe('Anna Test');
    expect(participant.id).toBe('p-1');
    expect(participant.custom_fields).toEqual({ city: 'Warsaw' });
    expect(participant.important_field_aliases).toEqual(['city']);
    expect(participant.status).toBe('checked_in');
    expect(participant.email_status).toBe('sent');
  });
});
