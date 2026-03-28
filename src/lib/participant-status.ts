import type { Participant, ParticipantStatus } from '@/types';

type BadgeVariant = 'default' | 'secondary' | 'outline';

export interface ParticipantStatusDefinition {
  code: ParticipantStatus;
  label: string;
  shortLabel: string;
  description?: string;
  badgeVariant: BadgeVariant;
  countsAsCheckedIn: boolean;
}

export const PARTICIPANT_STATUS_DEFINITIONS: ParticipantStatusDefinition[] = [
  {
    code: 'not_checked_in',
    label: 'Nieodprawiony',
    shortLabel: 'Nieodprawiony',
    badgeVariant: 'secondary',
    countsAsCheckedIn: false,
  },
  {
    code: 'checked_in',
    label: 'Odprawiony',
    shortLabel: 'Odprawiony',
    badgeVariant: 'default',
    countsAsCheckedIn: true,
  },
  {
    code: 'checked_in_not_starting',
    label: 'Odprawiony bez startu',
    shortLabel: 'Bez startu',
    description: 'Pakiet odebrany, uczestnik nie wystartuje.',
    badgeVariant: 'outline',
    countsAsCheckedIn: true,
  },
];

export const PARTICIPANT_STATUS_MAP = Object.fromEntries(
  PARTICIPANT_STATUS_DEFINITIONS.map(status => [status.code, status])
) as Record<ParticipantStatus, ParticipantStatusDefinition>;

export function normalizeParticipantStatus(status: string | null | undefined): ParticipantStatus {
  switch (status) {
    case 'checked_in':
    case 'checked_in_not_starting':
    case 'not_checked_in':
      return status;
    case 'pending':
    case '':
    case null:
    case undefined:
      return 'not_checked_in';
    default:
      return 'not_checked_in';
  }
}

export function getParticipantStatusDefinition(status: string | null | undefined): ParticipantStatusDefinition {
  return PARTICIPANT_STATUS_MAP[normalizeParticipantStatus(status)];
}

export function participantCountsAsCheckedIn(participant: Pick<Participant, 'status'>): boolean {
  return getParticipantStatusDefinition(participant.status).countsAsCheckedIn;
}
