import { describe, expect, it } from 'vitest';
import {
  isEventCurrentOrUpcoming,
  isEventOfficeStartAtOrAfterNow,
  isValidEventOfficeRange,
} from '@/lib/events';
import type { Event } from '@/types';

function createEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: 'event-1',
    name: 'Event 1',
    location: 'Warsaw',
    organization_id: 'org-1',
    office_open_at: '2099-04-12T07:00:00',
    office_close_at: '2099-04-12T15:00:00',
    ...overrides,
  };
}

describe('isEventCurrentOrUpcoming', () => {
  it('returns true for an event that has not closed yet', () => {
    expect(
      isEventCurrentOrUpcoming(
        createEvent({ office_close_at: '2099-04-12T15:00:00' }),
        new Date('2099-04-12T10:00:00'),
      ),
    ).toBe(true);
  });

  it('returns false for a finished event', () => {
    expect(
      isEventCurrentOrUpcoming(
        createEvent({ office_close_at: '2099-04-12T09:00:00' }),
        new Date('2099-04-12T10:00:00'),
      ),
    ).toBe(false);
  });
});

describe('isValidEventOfficeRange', () => {
  it('returns true when office stays open for at least one hour', () => {
    expect(isValidEventOfficeRange('2099-04-12T07:00:00', '2099-04-12T08:00:00')).toBe(true);
  });

  it('returns false when office stays open for less than one hour', () => {
    expect(isValidEventOfficeRange('2099-04-12T07:00:00', '2099-04-12T07:59:00')).toBe(false);
  });
});

describe('isEventOfficeStartAtOrAfterNow', () => {
  it('returns true when office opens exactly now', () => {
    expect(
      isEventOfficeStartAtOrAfterNow('2099-04-12T07:00:00', new Date('2099-04-12T07:00:00')),
    ).toBe(true);
  });

  it('returns false when office opens in the past', () => {
    expect(
      isEventOfficeStartAtOrAfterNow('2099-04-12T06:59:00', new Date('2099-04-12T07:00:00')),
    ).toBe(false);
  });
});
