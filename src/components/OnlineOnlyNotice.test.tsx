import { render, screen } from '@testing-library/react';
import { OnlineOnlyNotice } from './OnlineOnlyNotice';

describe('OnlineOnlyNotice', () => {
  it('renders the default title, description and extra class name', () => {
    const { container } = render(<OnlineOnlyNotice description="Połącz się z serwerem." className="extra-class" />);

    expect(screen.getByText(/Operacje administracyjne/)).toBeInTheDocument();
    expect(screen.getByText('Połącz się z serwerem.')).toBeInTheDocument();
    expect(container.firstElementChild).toHaveClass('extra-class');
  });

  it('allows overriding the title', () => {
    render(<OnlineOnlyNotice title="Brak sieci" description="Spróbuj ponownie później." />);

    expect(screen.getByText('Brak sieci')).toBeInTheDocument();
  });
});
