import { fireEvent, render, screen } from '@testing-library/react';
import { SuccessActionDialog } from './SuccessActionDialog';

describe('SuccessActionDialog', () => {
  it('renders actions only when open and calls the selected callbacks', () => {
    const onPrimaryAction = vi.fn();
    const onSecondaryAction = vi.fn();

    render(
      <SuccessActionDialog
        open
        onOpenChange={vi.fn()}
        title="Gotowe"
        description="Operacja zakończona."
        primaryLabel="Dodaj kolejny"
        secondaryLabel="Wróć"
        onPrimaryAction={onPrimaryAction}
        onSecondaryAction={onSecondaryAction}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Dodaj kolejny' }));
    fireEvent.click(screen.getByRole('button', { name: 'Wróć' }));

    expect(onPrimaryAction).toHaveBeenCalledTimes(1);
    expect(onSecondaryAction).toHaveBeenCalledTimes(1);
  });

  it('does not render dialog content while closed', () => {
    render(
      <SuccessActionDialog
        open={false}
        onOpenChange={vi.fn()}
        title="Gotowe"
        description="Operacja zakończona."
        primaryLabel="Dodaj kolejny"
        secondaryLabel="Wróć"
        onPrimaryAction={vi.fn()}
        onSecondaryAction={vi.fn()}
      />,
    );

    expect(screen.queryByText('Gotowe')).not.toBeInTheDocument();
  });
});
