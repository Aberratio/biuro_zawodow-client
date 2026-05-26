import type { Participant, ParticipantFieldMapping } from '@/types';
import {
  buildEmptyParticipantFieldValues,
  buildParticipantFieldValues,
  getActiveParticipantMappings,
} from './participant-fields';

const mappings: ParticipantFieldMapping[] = [
  { source_column_name: 'Email', alias: 'Email', field_role: 'email', display_order: 1, is_required: true, is_active: true },
  { source_column_name: 'Imie', alias: 'Imie', field_role: 'display_name_part', display_order: 2, is_required: true, is_active: true },
  { source_column_name: 'Nazwisko', alias: 'Nazwisko', field_role: 'display_name_part', display_order: 3, is_required: true, is_active: true },
  { source_column_name: 'Numer', alias: 'Numer', field_role: 'bib_number', display_order: 4, is_required: false, is_active: true },
  { source_column_name: 'Miasto', alias: 'Miasto', field_role: 'custom', display_order: 5, is_required: false, is_active: true },
  { source_column_name: 'Hidden', alias: 'Hidden', field_role: 'custom', display_order: 6, is_required: false, is_active: false },
];

describe('participant field helpers', () => {
  it('excludes email and inactive mappings from editable participant values', () => {
    expect(getActiveParticipantMappings(mappings).map(mapping => mapping.alias)).toEqual([
      'Imie',
      'Nazwisko',
      'Numer',
      'Miasto',
    ]);
    expect(buildEmptyParticipantFieldValues(mappings)).toEqual({
      Imie: '',
      Nazwisko: '',
      Numer: '',
      Miasto: '',
    });
  });

  it('derives display name parts, bib number and custom fields from a participant', () => {
    const participant: Participant = {
      id: 'p-1',
      event_id: 'event-1',
      name: 'Anna Maria Test',
      email: 'anna@example.com',
      bib_number: '101',
      qr_code: 'qr-1',
      status: 'not_checked_in',
      email_status: 'not_sent',
      custom_fields: { Miasto: 'Warszawa' },
    };

    expect(buildParticipantFieldValues(mappings, participant)).toEqual({
      Imie: 'Anna',
      Nazwisko: 'Maria',
      Numer: '101',
      Miasto: 'Warszawa',
    });
  });
});
