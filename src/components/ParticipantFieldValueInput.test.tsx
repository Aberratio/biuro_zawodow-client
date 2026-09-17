import { render, screen } from '@testing-library/react';
import type { ParticipantFieldMapping } from '@/types';
import { ParticipantFieldValueInput } from './ParticipantFieldValueInput';

const dateMapping: ParticipantFieldMapping = {
  source_column_name: 'Data urodzenia',
  alias: 'Data urodzenia',
  field_role: 'custom',
  field_type: 'date',
  display_order: 1,
  is_required: false,
  is_active: true,
};

describe('ParticipantFieldValueInput (date)', () => {
  it('keeps a partially typed year so typing day, month, year in order does not clear the field', () => {
    // Przy wpisywaniu roku cyfra po cyfrze przeglądarka zgłasza np. "0001-05-12".
    render(<ParticipantFieldValueInput id="birth" mapping={dateMapping} value="0001-05-12" onChange={() => {}} />);

    expect(screen.getByDisplayValue('0001-05-12')).toBeInTheDocument();
    expect(screen.queryByText(/Nierozpoznana wartość/)).not.toBeInTheDocument();
  });

  it('shows imported values in other formats normalized to ISO', () => {
    render(<ParticipantFieldValueInput id="birth" mapping={dateMapping} value="12.05.1990" onChange={() => {}} />);

    expect(screen.getByDisplayValue('1990-05-12')).toBeInTheDocument();
  });

  it('flags values that cannot be interpreted as a date', () => {
    render(<ParticipantFieldValueInput id="birth" mapping={dateMapping} value="wczoraj" onChange={() => {}} />);

    expect(screen.getByText('wczoraj')).toBeInTheDocument();
  });
});
