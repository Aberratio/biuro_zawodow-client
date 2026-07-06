import type { Participant, ParticipantFieldMapping } from '@/types';
import {
  buildEmptyParticipantFieldValues,
  buildParticipantFieldValues,
  formatSelectOptions,
  getActiveParticipantMappings,
  getParticipantFieldType,
  getParticipantValidationRules,
  normalizeParticipantDateValue,
  parseSelectOptions,
  suggestSelectOptionsFromRows,
  validateParticipantFieldValue,
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

  it('validates required, text, number, date and select mapping rules', () => {
    expect(validateParticipantFieldValue({
      ...mappings[4],
      is_required: true,
    }, '')).toBe('Uzupełnij pole: Miasto.');

    expect(validateParticipantFieldValue({
      ...mappings[4],
      field_type: 'text',
      validation_rules: { min_length: 3, max_length: 5 },
    }, 'Wa')).toBe('Pole Miasto musi mieć co najmniej 3 znaków.');
    expect(validateParticipantFieldValue({
      ...mappings[4],
      field_type: 'text',
      validation_rules: { min_length: 3, max_length: 5 },
    }, 'Warszawa')).toBe('Pole Miasto może mieć maksymalnie 5 znaków.');

    expect(validateParticipantFieldValue({
      ...mappings[4],
      field_type: 'number',
      validation_rules: { min: 10, max: 20 },
    }, 'abc')).toBe('Pole Miasto musi być liczbą.');
    expect(validateParticipantFieldValue({
      ...mappings[4],
      field_type: 'number',
      validation_rules: { min: 10, max: 20 },
    }, '9')).toBe('Pole Miasto musi mieć wartość nie mniejszą niż 10.');
    expect(validateParticipantFieldValue({
      ...mappings[4],
      field_type: 'number',
      validation_rules: { min: 10, max: 20 },
    }, '21')).toBe('Pole Miasto musi mieć wartość nie większą niż 20.');

    expect(validateParticipantFieldValue({
      ...mappings[4],
      field_type: 'date',
      validation_rules: { min: '2026-01-01', max: '2026-12-31' },
    }, '2025-12-31')).toBe('Pole Miasto nie może być wcześniejsze niż 2026-01-01.');
    expect(validateParticipantFieldValue({
      ...mappings[4],
      field_type: 'date',
      validation_rules: { min: '2026-01-01', max: '2026-12-31' },
    }, '2027-01-01')).toBe('Pole Miasto nie może być późniejsze niż 2026-12-31.');

    expect(validateParticipantFieldValue({
      ...mappings[4],
      field_type: 'select',
      validation_rules: { options: ['5K', '10K'] },
    }, 'Maraton')).toBe('Pole Miasto musi być jedną z dozwolonych wartości.');
    expect(validateParticipantFieldValue({
      ...mappings[4],
      field_type: 'select',
      validation_rules: { options: ['5K', '10K'] },
    }, '10K')).toBe('');
  });

  it('normalizes field type defaults and select options', () => {
    expect(getParticipantFieldType(mappings[0])).toBe('text');
    expect(getParticipantFieldType({ ...mappings[4], field_type: 'select' })).toBe('select');
    expect(getParticipantValidationRules({ ...mappings[4], validation_rules: { options: ['A'] } })).toEqual({ options: ['A'] });
    expect(parseSelectOptions(' 5K \n10K\n5K\n\n')).toEqual(['5K', '10K']);
    expect(formatSelectOptions(['5K', '10K'])).toBe('5K\n10K');
    expect(suggestSelectOptionsFromRows([
      { Dystans: '10K' },
      { Dystans: '5K' },
      { Dystans: '10K' },
      { Dystans: '' },
    ], 'Dystans')).toEqual(['10K', '5K'].sort((left, right) => left.localeCompare(right, 'pl-PL')));
  });

  it('normalizes participant date values from common CSV formats', () => {
    expect(normalizeParticipantDateValue('2026-7-6')).toBe('2026-07-06');
    expect(normalizeParticipantDateValue('06.07.2026')).toBe('2026-07-06');
    expect(normalizeParticipantDateValue('6-7-2026')).toBe('2026-07-06');
    expect(normalizeParticipantDateValue('13/07/2026')).toBe('2026-07-13');
    expect(normalizeParticipantDateValue('07/13/2026')).toBe('2026-07-13');
    expect(normalizeParticipantDateValue('06/07/2026', 'dmy')).toBe('2026-07-06');
    expect(normalizeParticipantDateValue('06/07/2026', 'mdy')).toBe('2026-06-07');
    expect(normalizeParticipantDateValue('46109')).toBe('2026-03-28');
    expect(normalizeParticipantDateValue('06/07/2026')).toBeNull();
    expect(validateParticipantFieldValue({
      ...mappings[4],
      field_type: 'date',
      validation_rules: { min: '2026-01-01', max: '2026-12-31' },
    }, '06.07.2026')).toBe('');
  });
});
