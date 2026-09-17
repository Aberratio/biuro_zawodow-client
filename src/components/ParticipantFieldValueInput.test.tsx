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
  it('shows stored and imported dates in Polish DD.MM.RRRR format', () => {
    const { rerender } = render(
      <ParticipantFieldValueInput id="birth" mapping={dateMapping} value="1990-05-12" onChange={() => {}} />,
    );
    expect(screen.getByDisplayValue('12.05.1990')).toBeInTheDocument();

    rerender(<ParticipantFieldValueInput id="birth" mapping={dateMapping} value="3.7.1985" onChange={() => {}} />);
    expect(screen.getByDisplayValue('03.07.1985')).toBeInTheDocument();
  });

  it('flags values that cannot be interpreted as a date', () => {
    render(<ParticipantFieldValueInput id="birth" mapping={dateMapping} value="wczoraj" onChange={() => {}} />);

    expect(screen.getByText('wczoraj')).toBeInTheDocument();
  });
});
