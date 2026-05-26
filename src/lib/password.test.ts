import { generateStrongPassword } from './password';

describe('generateStrongPassword', () => {
  it('returns at least the requested length and includes every required character group', () => {
    const password = generateStrongPassword(20);

    expect(password).toHaveLength(20);
    expect(password).toMatch(/[A-Z]/);
    expect(password).toMatch(/[a-z]/);
    expect(password).toMatch(/\d/);
    expect(password).toMatch(/[^A-Za-z0-9]/);
  });

  it('keeps the minimum generated password strong even for too small requested length', () => {
    const password = generateStrongPassword(2);

    expect(password).toHaveLength(4);
    expect(password).toMatch(/[A-Z]/);
    expect(password).toMatch(/[a-z]/);
    expect(password).toMatch(/\d/);
    expect(password).toMatch(/[^A-Za-z0-9]/);
  });
});
