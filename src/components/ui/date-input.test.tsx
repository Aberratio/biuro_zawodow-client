import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { DateInput } from './date-input';

function ControlledDateInput({ initialValue = '', onValue }: { initialValue?: string; onValue: (value: string) => void }) {
  const [value, setValue] = useState(initialValue);
  return (
    <DateInput
      id="date"
      value={value}
      onChange={next => {
        setValue(next);
        onValue(next);
      }}
    />
  );
}

/** Symuluje wpisywanie znak po znaku — tak jak robi to użytkownik. */
function typeInto(input: HTMLInputElement, keys: string) {
  for (const key of keys) {
    fireEvent.change(input, { target: { value: input.value + key } });
  }
}

describe('DateInput', () => {
  it('accepts a date typed day → month → year and emits ISO only once it is complete', () => {
    const onValue = vi.fn();
    render(<ControlledDateInput onValue={onValue} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;

    typeInto(input, '1205199');
    expect(input.value).toBe('12.05.199');
    expect(onValue).not.toHaveBeenCalled();

    typeInto(input, '0');
    expect(input.value).toBe('12.05.1990');
    expect(onValue).toHaveBeenLastCalledWith('1990-05-12');
  });

  it('clears the value when a complete date is edited back to incomplete', () => {
    const onValue = vi.fn();
    render(<ControlledDateInput initialValue="1990-05-12" onValue={onValue} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '12.05.199' } });

    expect(input.value).toBe('12.05.199');
    expect(onValue).toHaveBeenLastCalledWith('');
  });

  it('marks an incomplete date as invalid after leaving the field', () => {
    render(<ControlledDateInput onValue={() => {}} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;

    typeInto(input, '1205');
    expect(input).not.toHaveAttribute('aria-invalid');
    fireEvent.blur(input);
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });
});
