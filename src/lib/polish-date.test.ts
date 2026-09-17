import { formatIsoAsPolishDate, maskPolishDateInput, maskTimeInput, parsePolishDate, TIME_PATTERN } from './polish-date';

describe('polish-date', () => {
  it('masks digits into DD.MM.RRRR', () => {
    expect(maskPolishDateInput('1')).toBe('1');
    expect(maskPolishDateInput('12')).toBe('12');
    expect(maskPolishDateInput('120')).toBe('12.0');
    expect(maskPolishDateInput('12051990')).toBe('12.05.1990');
    expect(maskPolishDateInput('12.05.19901')).toBe('12.05.1990');
    expect(maskPolishDateInput('1.5.1990')).toBe('01.05.1990');
    expect(maskPolishDateInput('1990-05-12')).toBe('12.05.1990');
  });

  it('parses only complete, existing dates', () => {
    expect(parsePolishDate('12.05.1990')).toBe('1990-05-12');
    expect(parsePolishDate('12.05.199')).toBe('');
    expect(parsePolishDate('31.02.2020')).toBe('');
    expect(formatIsoAsPolishDate('2020-02-29')).toBe('29.02.2020');
    expect(formatIsoAsPolishDate('nie-data')).toBe('');
  });

  it('masks and validates 24h time as GG:MM', () => {
    expect(maskTimeInput('1')).toBe('1');
    expect(maskTimeInput('183')).toBe('18:3');
    expect(maskTimeInput('1830')).toBe('18:30');
    expect(maskTimeInput('8:05')).toBe('08:05');
    expect(TIME_PATTERN.test('23:59')).toBe(true);
    expect(TIME_PATTERN.test('24:00')).toBe(false);
    expect(TIME_PATTERN.test('18:3')).toBe(false);
  });
});
