import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  getParticipantFieldType,
  getParticipantValidationRules,
  normalizeParticipantDateValue,
  normalizeParticipantPaymentFieldValue,
} from '@/lib/participant-fields';
import type { ParticipantFieldMapping } from '@/types';

const EMPTY_SELECT_VALUE = '__empty';

interface ParticipantFieldValueInputProps {
  id: string;
  mapping: ParticipantFieldMapping;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  required?: boolean;
  invalid?: boolean;
  describedBy?: string;
}

function UnrecognizedValueHint({ value }: { value: string }) {
  return (
    <p className="mt-1 text-xs text-muted-foreground">
      Nierozpoznana wartość: <span className="font-medium text-foreground">{value}</span>
    </p>
  );
}

export function ParticipantFieldValueInput({
  id,
  mapping,
  value,
  onChange,
  className,
  required,
  invalid,
  describedBy,
}: ParticipantFieldValueInputProps) {
  const fieldType = getParticipantFieldType(mapping);
  const rules = getParticipantValidationRules(mapping);

  if (mapping.field_role === 'payment_status') {
    return (
      <Select
        value={normalizeParticipantPaymentFieldValue(value)}
        onValueChange={next => onChange(next === 'paid' ? 'TAK' : next === 'unpaid' ? '' : 'unknown')}
      >
        <SelectTrigger
          id={id}
          className={className}
          aria-invalid={invalid}
          aria-describedby={describedBy}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="paid">Opłacony</SelectItem>
          <SelectItem value="unpaid">Nieopłacony</SelectItem>
          <SelectItem value="unknown">Nieznany</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  if (fieldType === 'select') {
    const options = rules.options ?? [];
    const hasUnknownValue = Boolean(value) && !options.includes(value);

    return (
      <Select
        value={value || EMPTY_SELECT_VALUE}
        onValueChange={next => onChange(next === EMPTY_SELECT_VALUE ? '' : next)}
      >
        <SelectTrigger
          id={id}
          className={className}
          aria-invalid={invalid}
          aria-describedby={describedBy}
        >
          <SelectValue placeholder="Wybierz wartość" />
        </SelectTrigger>
        <SelectContent>
          {!mapping.is_required && <SelectItem value={EMPTY_SELECT_VALUE}>Brak wartości</SelectItem>}
          {hasUnknownValue && (
            <SelectItem value={value} disabled>
              {value} (spoza listy)
            </SelectItem>
          )}
          {options.map(option => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (fieldType === 'date') {
    const normalizedDate = normalizeParticipantDateValue(value, rules.date_format ?? 'auto');
    // Podczas wpisywania roku cyfra po cyfrze przeglądarka zgłasza np. "0001-05-12". Taka wartość
    // nie przechodzi normalizacji (rok < 1900), ale nie wolno jej zastąpić pustym stringiem —
    // React wyczyściłby wtedy całe pole i nie dałoby się wpisać daty w kolejności dzień → miesiąc → rok.
    const isNativeDateValue = /^\d{4}-\d{2}-\d{2}$/.test(value);
    const inputValue = normalizedDate ?? (isNativeDateValue ? value : '');

    return (
      <>
        <Input
          id={id}
          type="date"
          min={typeof rules.min === 'string' ? rules.min : undefined}
          max={typeof rules.max === 'string' ? rules.max : undefined}
          value={inputValue}
          onChange={event => onChange(event.target.value)}
          className={className}
          required={required}
          aria-invalid={invalid}
          aria-describedby={describedBy}
        />
        {value.trim() !== '' && !inputValue && <UnrecognizedValueHint value={value} />}
      </>
    );
  }

  if (fieldType === 'number') {
    const displayValue = value.replace(',', '.').trim();
    const isDisplayable = displayValue === '' || /^-?\d*(?:\.\d*)?$/.test(displayValue);

    return (
      <>
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          min={rules.min}
          max={rules.max}
          value={isDisplayable ? displayValue : ''}
          onChange={event => onChange(event.target.value)}
          className={className}
          required={required}
          aria-invalid={invalid}
          aria-describedby={describedBy}
        />
        {!isDisplayable && <UnrecognizedValueHint value={value} />}
      </>
    );
  }

  return (
    <Input
      id={id}
      value={value}
      onChange={event => onChange(event.target.value)}
      maxLength={rules.max_length}
      className={className}
      required={required}
      aria-invalid={invalid}
      aria-describedby={describedBy}
    />
  );
}
