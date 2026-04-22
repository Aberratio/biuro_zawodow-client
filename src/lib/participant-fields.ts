import type { Participant, ParticipantFieldMapping } from '@/types';

export function getActiveParticipantMappings(mappings: ParticipantFieldMapping[]): ParticipantFieldMapping[] {
  return mappings.filter(mapping => mapping.is_active && mapping.field_role !== 'email');
}

export function buildEmptyParticipantFieldValues(mappings: ParticipantFieldMapping[]): Record<string, string> {
  return getActiveParticipantMappings(mappings).reduce<Record<string, string>>((acc, mapping) => {
    acc[mapping.alias] = '';
    return acc;
  }, {});
}

export function buildParticipantFieldValues(
  mappings: ParticipantFieldMapping[],
  participant?: Participant
): Record<string, string> {
  const values = buildEmptyParticipantFieldValues(mappings);
  const participantName = typeof participant?.name === 'string' ? participant.name : '';
  const nameParts = participantName.trim() ? participantName.trim().split(/\s+/).filter(Boolean) : [];
  let displayNameIndex = 0;

  for (const mapping of getActiveParticipantMappings(mappings)) {
    if (mapping.field_role === 'bib_number') {
      values[mapping.alias] = participant?.bib_number ?? values[mapping.alias];
      continue;
    }

    if (participant?.custom_fields?.[mapping.alias]) {
      values[mapping.alias] = participant.custom_fields[mapping.alias];
      continue;
    }

    if (mapping.field_role === 'display_name_part' && displayNameIndex < nameParts.length) {
      values[mapping.alias] = nameParts[displayNameIndex] ?? '';
      displayNameIndex += 1;
    }
  }

  return values;
}
