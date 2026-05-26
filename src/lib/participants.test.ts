import { formatBibNumber, formatParticipantCount } from './participants';

describe('participant formatting helpers', () => {
  it('formats bib numbers with fallback for empty values', () => {
    expect(formatBibNumber(' 42 ')).toBe('#42');
    expect(formatBibNumber('')).toBe('Brak numeru');
    expect(formatBibNumber(null, 'N/A')).toBe('N/A');
  });

  it('uses singular wording only for one participant', () => {
    expect(formatParticipantCount(0)).toContain('0');
    expect(formatParticipantCount(1)).toBe('1 uczestnika');
    expect(formatParticipantCount(2)).toContain('2');
  });
});
