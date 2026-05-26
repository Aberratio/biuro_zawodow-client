import { render, screen } from '@testing-library/react';
import { PasswordRequirements } from './PasswordRequirements';

describe('PasswordRequirements', () => {
  it('renders all password rules and marks a strong password as satisfied', () => {
    render(<PasswordRequirements password="StrongPass1!" />);

    expect(screen.getByText('Minimum 10 znaków').closest('li')).toHaveClass('text-emerald-700');
    expect(screen.getByText('Mała litera').closest('li')).toHaveClass('text-emerald-700');
    expect(screen.getByText('Wielka litera').closest('li')).toHaveClass('text-emerald-700');
    expect(screen.getByText('Cyfra').closest('li')).toHaveClass('text-emerald-700');
    expect(screen.getByText('Znak specjalny').closest('li')).toHaveClass('text-emerald-700');
  });

  it('keeps unmet rules visually muted for weak input', () => {
    render(<PasswordRequirements password="short" />);

    expect(screen.getByText('Minimum 10 znaków').closest('li')).toHaveClass('text-muted-foreground');
    expect(screen.getByText('Wielka litera').closest('li')).toHaveClass('text-muted-foreground');
    expect(screen.getByText('Cyfra').closest('li')).toHaveClass('text-muted-foreground');
  });
});
