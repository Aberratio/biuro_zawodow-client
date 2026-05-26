import {
  getParticipantStatusDefinition,
  normalizeParticipantStatus,
  participantCountsAsCheckedIn,
} from './participant-status';

describe('participant status helpers', () => {
  it('normalizes legacy and invalid statuses to not checked in', () => {
    expect(normalizeParticipantStatus('checked_in')).toBe('checked_in');
    expect(normalizeParticipantStatus('checked_in_not_starting')).toBe('checked_in_not_starting');
    expect(normalizeParticipantStatus('pending')).toBe('not_checked_in');
    expect(normalizeParticipantStatus('unknown')).toBe('not_checked_in');
    expect(normalizeParticipantStatus(null)).toBe('not_checked_in');
  });

  it('marks both checked-in statuses as counted attendance', () => {
    expect(participantCountsAsCheckedIn({ status: 'not_checked_in' })).toBe(false);
    expect(participantCountsAsCheckedIn({ status: 'checked_in' })).toBe(true);
    expect(participantCountsAsCheckedIn({ status: 'checked_in_not_starting' })).toBe(true);
    expect(getParticipantStatusDefinition('bad').code).toBe('not_checked_in');
  });
});
