import { describe, expect, it } from 'vitest';
import {
  computeEventOfficeWindowFromLocations,
  formatEventOfficeHourRangeWithWeekday,
  formatEventOfficeLocationRanges,
  formatEventOfficeSchedule,
  formatEventOfficeWindow,
  getCurrentEventOfficeHourRange,
  getEventOfficeLocationsValidationErrors,
  getFirstEventOfficeHourRange,
  getLastEventOfficeHourRange,
  getNextEventOfficeHourRange,
  getEventOfficeValidationErrors,
  getEventOfficeRangeValidationResult,
  isEventCurrentOrUpcoming,
  isEventOfficeOpen,
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

describe('isEventOfficeOpen', () => {
  it('treats multi-day office hours with an overnight gap as closed between days', () => {
    const event = createEvent({
      office_locations: [
        {
          name: 'Krakow, Blonia',
          google_maps_url: null,
          hours: [
            { opens_at: '2099-09-11T15:00:00', closes_at: '2099-09-11T19:00:00' },
            { opens_at: '2099-09-12T07:00:00', closes_at: '2099-09-12T10:00:00' },
          ],
        },
      ],
    });

    expect(isEventOfficeOpen(event, new Date('2099-09-11T16:00:00'))).toBe(true);
    expect(isEventOfficeOpen(event, new Date('2099-09-12T08:00:00'))).toBe(true);
    expect(isEventOfficeOpen(event, new Date('2099-09-11T23:00:00'))).toBe(false);
    expect(isEventOfficeOpen(event, new Date('2099-09-12T11:00:00'))).toBe(false);
  });

  it('returns false when there are no office locations', () => {
    expect(isEventOfficeOpen(createEvent({ office_locations: [] }), new Date('2099-04-12T10:00:00'))).toBe(false);
  });
});

describe('formatEventOfficeWindow', () => {
  it('formats a same-day window with a single date', () => {
    expect(
      formatEventOfficeWindow({
        office_open_at: '2099-04-12T07:00:00',
        office_close_at: '2099-04-12T15:00:00',
      }),
    ).toBe('12.04.2099, 07:00 - 15:00');
  });

  it('shows both dates when the window spans multiple days', () => {
    expect(
      formatEventOfficeWindow({
        office_open_at: '2099-09-11T15:00:00',
        office_close_at: '2099-09-12T10:00:00',
      }),
    ).toBe('11.09.2099, 15:00 - 12.09.2099, 10:00');
  });
});

describe('office hour range lookups', () => {
  const multiDayEvent = createEvent({
    office_open_at: '2099-09-11T15:00:00',
    office_close_at: '2099-09-12T10:00:00',
    office_locations: [
      {
        name: 'Krakow, Blonia',
        google_maps_url: null,
        hours: [
          { opens_at: '2099-09-11T15:00:00', closes_at: '2099-09-11T19:00:00' },
          { opens_at: '2099-09-12T07:00:00', closes_at: '2099-09-12T10:00:00' },
        ],
      },
    ],
  });

  it('returns the range the office is currently open in', () => {
    expect(getCurrentEventOfficeHourRange(multiDayEvent, new Date('2099-09-11T16:00:00'))?.closesAt).toEqual(
      new Date('2099-09-11T19:00:00'),
    );
  });

  it('returns no current range during the night between two days', () => {
    expect(getCurrentEventOfficeHourRange(multiDayEvent, new Date('2099-09-11T23:00:00'))).toBeNull();
  });

  it('points at the next morning during the night between two days', () => {
    expect(getNextEventOfficeHourRange(multiDayEvent, new Date('2099-09-11T23:00:00'))?.opensAt).toEqual(
      new Date('2099-09-12T07:00:00'),
    );
  });

  it('has no next range once the last range is over', () => {
    expect(getNextEventOfficeHourRange(multiDayEvent, new Date('2099-09-12T11:00:00'))).toBeNull();
  });

  it('exposes the first and the last range of the event', () => {
    expect(getFirstEventOfficeHourRange(multiDayEvent)?.opensAt).toEqual(new Date('2099-09-11T15:00:00'));
    expect(getLastEventOfficeHourRange(multiDayEvent)?.closesAt).toEqual(new Date('2099-09-12T10:00:00'));
    expect(getFirstEventOfficeHourRange(createEvent({ office_locations: [] }))).toBeNull();
    expect(getLastEventOfficeHourRange(createEvent({ office_locations: [] }))).toBeNull();
  });
});

describe('formatEventOfficeHourRangeWithWeekday', () => {
  it('shows the weekday and a single date for a range inside one day', () => {
    expect(
      formatEventOfficeHourRangeWithWeekday({
        opens_at: '2099-09-11T15:00:00',
        closes_at: '2099-09-11T19:00:00',
      }),
    ).toBe('Pt 11.09, 15:00 - 19:00');
  });

  it('repeats the day when a single range crosses midnight', () => {
    expect(
      formatEventOfficeHourRangeWithWeekday({
        opens_at: '2099-09-11T22:00:00',
        closes_at: '2099-09-12T02:00:00',
      }),
    ).toBe('Pt 11.09, 22:00 - Sob 12.09, 02:00');
  });

  it('adds the year when asked for it', () => {
    expect(
      formatEventOfficeHourRangeWithWeekday(
        { opens_at: '2099-09-11T15:00:00', closes_at: '2099-09-11T19:00:00' },
        { withYear: true },
      ),
    ).toBe('Pt 11.09.2099, 15:00 - 19:00');
  });

  it('returns null for an unparsable range', () => {
    expect(formatEventOfficeHourRangeWithWeekday({ opens_at: '', closes_at: '' })).toBeNull();
  });
});

describe('formatEventOfficeSchedule', () => {
  it('lists every real range instead of one overnight window', () => {
    const event = createEvent({
      office_open_at: '2099-09-11T15:00:00',
      office_close_at: '2099-09-12T10:00:00',
      office_locations: [
        {
          name: 'Krakow, Blonia',
          google_maps_url: null,
          hours: [
            { opens_at: '2099-09-12T07:00:00', closes_at: '2099-09-12T10:00:00' },
            { opens_at: '2099-09-11T15:00:00', closes_at: '2099-09-11T19:00:00' },
          ],
        },
      ],
    });

    expect(formatEventOfficeSchedule(event)).toBe(
      'Pt 11.09.2099, 15:00 - 19:00 • Sob 12.09.2099, 07:00 - 10:00',
    );
  });

  it('shows an hour range shared by two locations only once', () => {
    const hours = [{ opens_at: '2099-09-11T15:00:00', closes_at: '2099-09-11T19:00:00' }];
    const event = createEvent({
      office_locations: [
        { name: 'Krakow, Blonia', google_maps_url: null, hours },
        { name: 'Warszawa', google_maps_url: null, hours },
      ],
    });

    expect(formatEventOfficeSchedule(event)).toBe('Pt 11.09.2099, 15:00 - 19:00');
  });

  it('falls back to the aggregate window when an event has no office locations', () => {
    expect(
      formatEventOfficeSchedule(
        createEvent({
          office_open_at: '2099-04-12T07:00:00',
          office_close_at: '2099-04-12T15:00:00',
          office_locations: [],
        }),
      ),
    ).toBe('12.04.2099, 07:00 - 15:00');
  });
});

describe('formatEventOfficeLocationRanges', () => {
  it('formats each range of a location on its own', () => {
    expect(
      formatEventOfficeLocationRanges({
        hours: [
          { opens_at: '2099-09-11T15:00:00', closes_at: '2099-09-11T19:00:00' },
          { opens_at: '2099-09-12T07:00:00', closes_at: '2099-09-12T10:00:00' },
        ],
      }),
    ).toEqual(['Pt 11.09.2099, 15:00 - 19:00', 'Sob 12.09.2099, 07:00 - 10:00']);
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

  it('rejects a range shorter than one hour', () => {
    const errors = getEventOfficeLocationsValidationErrors([
      createLocation({ hours: [{ opens_at: '2099-04-12T09:00:00', closes_at: '2099-04-12T09:30:00' }] }),
    ]);
    expect(errors.locations[0]?.hours?.[0]?.closes_at).toBeTruthy();
  });

  it('rejects a too-short range even when the aggregate span across days is long', () => {
    const errors = getEventOfficeLocationsValidationErrors([
      createLocation({
        hours: [
          { opens_at: '2099-04-12T15:00:00', closes_at: '2099-04-12T19:00:00' },
          { opens_at: '2099-04-13T07:00:00', closes_at: '2099-04-13T07:30:00' },
        ],
      }),
    ]);
    expect(errors.locations[0]?.hours?.[0]).toEqual({});
    expect(errors.locations[0]?.hours?.[1]?.closes_at).toBeTruthy();
  });

  it('accepts a valid multi-day event with a gap between days', () => {
    const errors = getEventOfficeLocationsValidationErrors([
      createLocation({
        hours: [
          { opens_at: '2099-04-12T15:00:00', closes_at: '2099-04-12T19:00:00' },
          { opens_at: '2099-04-13T07:00:00', closes_at: '2099-04-13T10:00:00' },
        ],
      }),
    ]);
    expect(errors.form).toBeUndefined();
    expect(errors.locations[0]?.hours?.every((range) => !range.opens_at && !range.closes_at)).toBe(true);
  });

  it('accepts a fully valid set of locations', () => {
    const errors = getEventOfficeLocationsValidationErrors([createLocation()]);
    expect(errors.form).toBeUndefined();
    expect(errors.locations.every((location) => !location.name && !location.google_maps_url && !location.form)).toBe(true);
  });
});
