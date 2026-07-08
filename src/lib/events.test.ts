import { describe, expect, it } from 'vitest';
import {
  computeEventOfficeWindowFromLocations,
  getEventOfficeLocationsValidationErrors,
  getEventOfficeValidationErrors,
  getEventOfficeRangeValidationResult,
  isEventCurrentOrUpcoming,
  isEventOfficeStartAtOrAfterNow,
  isValidEventOfficeRange,
  isValidOptionalUrl,
} from '@/lib/events';
import type { Event, EventOfficeLocation } from '@/types';

function createEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: 'event-1',
    name: 'Event 1',
    location: 'Warsaw',
    organization_id: 'org-1',
    office_open_at: '2099-04-12T07:00:00',
    office_close_at: '2099-04-12T15:00:00',
    office_locations: [],
    is_test: false,
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

  it('distinguishes close time earlier than or equal to open time', () => {
    expect(
      getEventOfficeRangeValidationResult('2099-04-12T07:00:00', '2099-04-12T07:00:00'),
    ).toBe('close_not_after_open');
  });

  it('distinguishes office duration shorter than one hour', () => {
    expect(
      getEventOfficeRangeValidationResult('2099-04-12T05:30:00', '2099-04-12T05:31:00'),
    ).toBe('shorter_than_minimum');
  });
});

describe('isEventOfficeStartAtOrAfterNow', () => {
  it('returns true when office opens exactly now', () => {
    expect(
      isEventOfficeStartAtOrAfterNow('2099-04-12T07:00:00', new Date('2099-04-12T07:00:00')),
    ).toBe(true);
  });

  it('returns true when office opens in the current minute', () => {
    expect(
      isEventOfficeStartAtOrAfterNow('2099-04-12T07:00:00', new Date('2099-04-12T07:00:45')),
    ).toBe(true);
  });

  it('returns false when office opens in the past', () => {
    expect(
      isEventOfficeStartAtOrAfterNow('2099-04-12T06:59:00', new Date('2099-04-12T07:00:00')),
    ).toBe(false);
  });
});

describe('getEventOfficeValidationErrors', () => {
  it('rejects a past office open time by default', () => {
    expect(
      getEventOfficeValidationErrors('2000-04-12T07:00:00', '2099-04-12T15:00:00').office_open_at,
    ).toBeTruthy();
  });

  it('allows a past office open time when reopening keeps the original open time', () => {
    expect(
      getEventOfficeValidationErrors('2000-04-12T07:00:00', '2099-04-12T15:00:00', {
        allowPastOpenAt: true,
      }),
    ).toEqual({});
  });
});

describe('isValidOptionalUrl', () => {
  it('accepts an empty value since the field is optional', () => {
    expect(isValidOptionalUrl('')).toBe(true);
    expect(isValidOptionalUrl('   ')).toBe(true);
  });

  it('accepts http and https URLs', () => {
    expect(isValidOptionalUrl('https://maps.google.com/?q=Blonia')).toBe(true);
    expect(isValidOptionalUrl('http://maps.google.com')).toBe(true);
  });

  it('rejects non-http(s) values', () => {
    expect(isValidOptionalUrl('not a url')).toBe(false);
    expect(isValidOptionalUrl('ftp://maps.google.com')).toBe(false);
  });
});

function createLocation(overrides: Partial<EventOfficeLocation> = {}): EventOfficeLocation {
  return {
    name: 'Krakow, Blonia',
    google_maps_url: null,
    hours: [{ opens_at: '2099-04-12T07:00:00', closes_at: '2099-04-12T15:00:00' }],
    ...overrides,
  };
}

describe('computeEventOfficeWindowFromLocations', () => {
  it('returns the earliest open and latest close across all locations and ranges', () => {
    const locations: EventOfficeLocation[] = [
      createLocation({
        hours: [
          { opens_at: '2099-04-12T09:00:00', closes_at: '2099-04-12T12:00:00' },
          { opens_at: '2099-04-13T09:00:00', closes_at: '2099-04-13T12:00:00' },
        ],
      }),
      createLocation({
        name: 'Warszawa',
        hours: [{ opens_at: '2099-04-12T07:00:00', closes_at: '2099-04-14T20:00:00' }],
      }),
    ];

    expect(computeEventOfficeWindowFromLocations(locations)).toEqual({
      opensAt: '2099-04-12T07:00:00',
      closesAt: '2099-04-14T20:00:00',
    });
  });

  it('returns nulls when there are no locations or ranges', () => {
    expect(computeEventOfficeWindowFromLocations([])).toEqual({ opensAt: null, closesAt: null });
    expect(computeEventOfficeWindowFromLocations([createLocation({ hours: [] })])).toEqual({
      opensAt: null,
      closesAt: null,
    });
  });
});

describe('getEventOfficeLocationsValidationErrors', () => {
  it('requires at least one location', () => {
    expect(getEventOfficeLocationsValidationErrors([]).form).toBeTruthy();
  });

  it('requires a name for every location', () => {
    const errors = getEventOfficeLocationsValidationErrors([createLocation({ name: '' })]);
    expect(errors.locations[0]?.name).toBeTruthy();
  });

  it('rejects an invalid google maps link', () => {
    const errors = getEventOfficeLocationsValidationErrors([
      createLocation({ google_maps_url: 'not a url' }),
    ]);
    expect(errors.locations[0]?.google_maps_url).toBeTruthy();
  });

  it('requires at least one hour range per location', () => {
    const errors = getEventOfficeLocationsValidationErrors([createLocation({ hours: [] })]);
    expect(errors.locations[0]?.form).toBeTruthy();
  });

  it('rejects a range where close is not after open', () => {
    const errors = getEventOfficeLocationsValidationErrors([
      createLocation({ hours: [{ opens_at: '2099-04-12T09:00:00', closes_at: '2099-04-12T09:00:00' }] }),
    ]);
    expect(errors.locations[0]?.hours?.[0]?.closes_at).toBeTruthy();
  });

  it('rejects an aggregate window shorter than one hour even when individual ranges are valid close-after-open', () => {
    const errors = getEventOfficeLocationsValidationErrors([
      createLocation({ hours: [{ opens_at: '2099-04-12T09:00:00', closes_at: '2099-04-12T09:30:00' }] }),
    ]);
    expect(errors.form).toBeTruthy();
  });

  it('accepts a fully valid set of locations', () => {
    const errors = getEventOfficeLocationsValidationErrors([createLocation()]);
    expect(errors.form).toBeUndefined();
    expect(errors.locations.every((location) => !location.name && !location.google_maps_url && !location.form)).toBe(true);
  });
});
