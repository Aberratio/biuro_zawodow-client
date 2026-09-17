import * as React from "react";
import { pl } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";

import { dateToIso, formatIsoAsPolishDate, isoToDate, maskPolishDateInput, parsePolishDate } from "@/lib/polish-date";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Natywny <input type="date"> bierze format z języka przeglądarki (np. MM/DD/YYYY w angielskim Chrome)
// i nie da się tego wymusić. Użytkownicy aplikacji to Polacy, więc pole zawsze pokazuje DD.MM.RRRR,
// a na zewnątrz — tak jak natywny input — wymienia wartość w formacie ISO RRRR-MM-DD (albo "").

interface DateInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "min" | "max"> {
  /** Data w formacie RRRR-MM-DD albo "". */
  value: string;
  /** Wywoływane z RRRR-MM-DD, gdy wpisana data jest pełna i poprawna, albo z "", gdy nie jest. */
  onChange: (value: string) => void;
  min?: string;
  max?: string;
}

export const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  ({ value, onChange, min, max, className, disabled, onBlur, placeholder = "DD.MM.RRRR", ...inputProps }, ref) => {
    const [text, setText] = React.useState(() => formatIsoAsPolishDate(value));
    const [open, setOpen] = React.useState(false);
    const [touched, setTouched] = React.useState(false);

    // Zmiana wartości z zewnątrz (reset formularza, inny uczestnik) nadpisuje tekst — ale nie w trakcie
    // wpisywania, gdy niepełny tekst odpowiada pustej wartości.
    React.useEffect(() => {
      setText(current => (parsePolishDate(current) === value ? current : formatIsoAsPolishDate(value)));
    }, [value]);

    const emit = (nextText: string) => {
      setText(nextText);
      const nextValue = parsePolishDate(nextText);
      if (nextValue !== value) onChange(nextValue);
    };

    const selectedDate = isoToDate(value) ?? undefined;
    const minDate = min ? isoToDate(min) ?? undefined : undefined;
    const maxDate = max ? isoToDate(max) ?? undefined : undefined;
    const currentYear = new Date().getFullYear();
    const isIncomplete = touched && text !== "" && parsePolishDate(text) === "";

    return (
      <div className="relative w-full">
        <input
          ref={ref}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder={placeholder}
          maxLength={10}
          value={text}
          disabled={disabled}
          onChange={event => {
            setTouched(false);
            emit(maskPolishDateInput(event.target.value));
          }}
          onBlur={event => {
            setTouched(true);
            onBlur?.(event);
          }}
          className={cn(
            "surface-field flex h-10 w-full rounded-xl border py-2 pl-3 pr-10 text-base tabular-nums ring-offset-background placeholder:text-muted-foreground/80 outline-none focus:outline-none focus:ring-2 focus:ring-ring/70 focus:ring-offset-1 aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/30 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            className,
          )}
          {...inputProps}
          aria-invalid={inputProps["aria-invalid"] || isIncomplete || undefined}
        />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              aria-label="Otwórz kalendarz"
              className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-xl text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CalendarIcon className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" collisionPadding={16} className="w-auto p-0">
            <Calendar
              mode="single"
              locale={pl}
              selected={selectedDate}
              defaultMonth={selectedDate ?? maxDate ?? undefined}
              onSelect={date => {
                emit(date ? formatIsoAsPolishDate(dateToIso(date)) : "");
                setOpen(false);
              }}
              disabled={[...(minDate ? [{ before: minDate }] : []), ...(maxDate ? [{ after: maxDate }] : [])]}
              captionLayout="dropdown-buttons"
              fromYear={minDate?.getFullYear() ?? 1900}
              toYear={maxDate?.getFullYear() ?? currentYear + 10}
              initialFocus
              classNames={{
                caption_label: "flex items-center gap-1 text-sm font-medium",
                caption_dropdowns: "flex items-center gap-3",
                dropdown_month: "relative inline-flex items-center",
                dropdown_year: "relative inline-flex items-center",
                // Rozwinięta lista to natywny <select>: bez ciemnego color-scheme przeglądarka rysuje jasne tło
                // pod białym tekstem odziedziczonym z motywu.
                dropdown:
                  "absolute inset-0 z-10 w-full cursor-pointer bg-popover text-popover-foreground opacity-0 [color-scheme:dark] [&_option]:bg-popover [&_option]:text-popover-foreground",
                dropdown_icon: "h-3 w-3",
                vhidden: "sr-only",
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
    );
  },
);
DateInput.displayName = "DateInput";
