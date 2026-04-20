import { CheckCircle2, Circle } from 'lucide-react';

import { cn } from '@/lib/utils';

type PasswordRequirementsProps = {
  password: string;
  className?: string;
};

const passwordRequirements = [
  {
    id: 'length',
    label: 'Minimum 10 znak\u00f3w',
    test: (value: string) => value.length >= 10,
  },
  {
    id: 'lowercase',
    label: 'Ma\u0142a litera',
    test: (value: string) => /[a-z]/.test(value),
  },
  {
    id: 'uppercase',
    label: 'Wielka litera',
    test: (value: string) => /[A-Z]/.test(value),
  },
  {
    id: 'digit',
    label: 'Cyfra',
    test: (value: string) => /\d/.test(value),
  },
  {
    id: 'special',
    label: 'Znak specjalny',
    test: (value: string) => /[^A-Za-z0-9]/.test(value),
  },
] as const;

export function PasswordRequirements({ password, className }: PasswordRequirementsProps) {
  return (
    <div
      className={cn('rounded-xl border border-border/70 bg-muted/30 px-3 py-2.5', className)}
      aria-live="polite"
    >
      <p className="text-xs font-medium text-foreground">{'Has\u0142o musi zawiera\u0107:'}</p>
      <ul className="mt-2 space-y-1.5">
        {passwordRequirements.map(requirement => {
          const isMet = requirement.test(password);

          return (
            <li
              key={requirement.id}
              className={cn(
                'flex items-center gap-2 text-xs transition-colors',
                isMet ? 'text-emerald-700' : 'text-muted-foreground',
              )}
            >
              {isMet ? (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              ) : (
                <Circle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              )}
              <span>{requirement.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
