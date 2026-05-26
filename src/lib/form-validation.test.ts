import {
  isValidEmailAddress,
  validateEmail,
  validateNonNegativeInteger,
  validatePasswordConfirmation,
  validateRequired,
  validateStrongPassword,
} from './form-validation';

describe('form validation helpers', () => {
  it('validates required, integer and email fields', () => {
    expect(validateRequired('  ', 'required')).toBe('required');
    expect(validateRequired(' value ', 'required')).toBe('');
    expect(validateNonNegativeInteger('0', 'bad')).toBe('');
    expect(validateNonNegativeInteger('-1', 'bad')).toBe('bad');
    expect(validateNonNegativeInteger('1.5', 'bad')).toBe('bad');
    expect(isValidEmailAddress(' user@example.com ')).toBe(true);
    expect(validateEmail('broken@example')).toBe('Podaj poprawny adres email.');
    expect(validateEmail('', 'empty')).toBe('empty');
  });

  it('checks strong password rules in order and confirmation equality', () => {
    expect(validateStrongPassword('')).not.toBe('');
    expect(validateStrongPassword('short')).not.toBe('');
    expect(validateStrongPassword('longpassword1!')).not.toBe('');
    expect(validateStrongPassword('LONGPASSWORD1!')).not.toBe('');
    expect(validateStrongPassword('Longpassword!')).not.toBe('');
    expect(validateStrongPassword('Longpassword1')).not.toBe('');
    expect(validateStrongPassword('Longpassword1!')).toBe('');
    expect(validatePasswordConfirmation('Longpassword1!', '')).not.toBe('');
    expect(validatePasswordConfirmation('Longpassword1!', 'different')).not.toBe('');
    expect(validatePasswordConfirmation('Longpassword1!', 'Longpassword1!')).toBe('');
  });
});
