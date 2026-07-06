import type { Participant, ParticipantFieldMapping, ParticipantFieldValidationRules } from '@/types';

export const participantFieldTypeLabels = {
  text: 'Tekst',
  number: 'Liczba',
  date: 'Data',
  select: 'Lista wyboru',
} as const;

export function isConfigurableParticipantMapping(mapping: { field_role: string }): boolean {
  return mapping.field_role === 'custom' || mapping.field_role === 'important_custom';
}

export function getParticipantFieldType(mapping: { field_role: string; field_type?: ParticipantFieldMapping['field_type'] }): NonNullable<ParticipantFieldMapping['field_type']> {
  if (!isConfigurableParticipantMapping(mapping)) return 'text';
  return mapping.field_type ?? 'text';
}

export function getParticipantValidationRules(
  mapping: Pick<ParticipantFieldMapping, 'validation_rules'>,
): NonNullable<ParticipantFieldMapping['validation_rules']> {
  return mapping.validation_rules ?? {};
}

export function parseSelectOptions(value: string): string[] {
  const seen = new Set<string>();
  return value
    .split(/\r\n|\n|\r/)
    .map(option => option.trim())
    .filter(option => {
      if (!option || seen.has(option)) return false;
      seen.add(option);
      return true;
    });
}

export function formatSelectOptions(options: string[] | undefined): string {
  return (options ?? []).join('\n');
}

export function suggestSelectOptionsFromRows(
  rows: Record<string, string>[],
  sourceColumnName: string,
  limit = 50,
): string[] {
  const seen = new Set<string>();
  for (const row of rows) {
    const value = (row[sourceColumnName] ?? '').trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    if (seen.size >= limit) break;
  }
  return [...seen].sort((left, right) => left.localeCompare(right, 'pl-PL'));
}

function formatParticipantDate(year: number, month: number, day: number): string | null {
  if (year < 1900 || year > 2100) return null;
  const date = new Date(year, month - 1, day);
  if (
    Number.isNaN(date.getTime())
    || date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
  ) {
    return null;
  }

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function normalizeParticipantDateValue(value: string, preferredFormat: ParticipantFieldValidationRules['date_format'] | 'auto' = 'auto'): string | null {
  const trimmedValue = value.trim();
  if (!trimmedValue) return null;
  const format = preferredFormat ?? 'auto';

  if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/.test(trimmedValue)) {
    const [year, month, day] = trimmedValue.split(/[-/.]/).map(Number);
    return formatParticipantDate(year, month, day);
  }

  if (/^\d{1,2}[.-]\d{1,2}[.-]\d{4}$/.test(trimmedValue)) {
    const [first, second, year] = trimmedValue.split(/[.-]/).map(Number);
    const [day, month] = format === 'mdy' ? [second, first] : [first, second];
    return formatParticipantDate(year, month, day);
  }

  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmedValue)) {
    const [first, second, year] = trimmedValue.split('/').map(Number);
    if (format === 'dmy') return formatParticipantDate(year, second, first);
    if (format === 'mdy') return formatParticipantDate(year, first, second);
    if (first <= 12 && second <= 12) return null;
    return first > 12
      ? formatParticipantDate(year, second, first)
      : formatParticipantDate(year, first, second);
  }

  if (/^\d{4,5}(?:\.0+)?$/.test(trimmedValue)) {
    const serial = Number.parseInt(trimmedValue, 10);
    const date = new Date(Date.UTC(1899, 11, 30 + serial));
    return formatParticipantDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }

  return null;
}

export function validateParticipantFieldValue(mapping: ParticipantFieldMapping, value: string): string {
  const alias = mapping.alias.trim() || mapping.source_column_name;
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return mapping.is_required ? `Uzupełnij pole: ${alias}.` : '';
  }

  const fieldType = getParticipantFieldType(mapping);
  const rules = getParticipantValidationRules(mapping);

  if (fieldType === 'text') {
    if (typeof rules.min_length === 'number' && trimmedValue.length < rules.min_length) {
      return `Pole ${alias} musi mieć co najmniej ${rules.min_length} znaków.`;
    }
    if (typeof rules.max_length === 'number' && trimmedValue.length > rules.max_length) {
      return `Pole ${alias} może mieć maksymalnie ${rules.max_length} znaków.`;
    }
  }

  if (fieldType === 'number') {
    const numberValue = Number(trimmedValue.replace(',', '.'));
    if (!Number.isFinite(numberValue)) return `Pole ${alias} musi być liczbą.`;
    const min = typeof rules.min === 'number' ? rules.min : Number(rules.min);
    const max = typeof rules.max === 'number' ? rules.max : Number(rules.max);
    if (Number.isFinite(min) && numberValue < min) return `Pole ${alias} musi mieć wartość nie mniejszą niż ${min}.`;
    if (Number.isFinite(max) && numberValue > max) return `Pole ${alias} musi mieć wartość nie większą niż ${max}.`;
  }

  if (fieldType === 'date') {
    const normalizedDate = normalizeParticipantDateValue(trimmedValue, rules.date_format ?? 'auto');
    if (!normalizedDate) {
      return `Pole ${alias} musi być poprawną datą.`;
    }
    if (typeof rules.min === 'string' && rules.min && normalizedDate < rules.min) return `Pole ${alias} nie może być wcześniejsze niż ${rules.min}.`;
    if (typeof rules.max === 'string' && rules.max && normalizedDate > rules.max) return `Pole ${alias} nie może być późniejsze niż ${rules.max}.`;
  }

  if (fieldType === 'select') {
    const options = rules.options ?? [];
    if (!options.includes(trimmedValue)) return `Pole ${alias} musi być jedną z dozwolonych wartości.`;
  }

  return '';
}

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
