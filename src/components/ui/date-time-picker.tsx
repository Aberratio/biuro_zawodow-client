import * as React from "react";
import { CalendarIcon, Clock3 } from "lucide-react";
import { pl } from "date-fns/locale";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface DateTimePickerProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange" | "type" | "value"> {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?:T| )(\d{2}):(\d{2})/;
const TIME_PATTERN = /^\d{2}:\d{2}$/;

function padDatePart(value: number): string {
  return String(value).padStart(2, "0");
}

function parseDateTimeValue(value: string): { date?: Date; time: string } {
  const match = value.match(DATE_TIME_PATTERN);
  if (!match) return { time: "08:00" };

  const [, rawYear, rawMonth, rawDay, rawHour, rawMinute] = match;
  const year = Number(rawYear);
  const month = Number(rawMonth);
  const day = Number(rawDay);
  const date = new Date(year, month - 1, day);

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return { time: `${rawHour}:${rawMinute}` };
  }

  return { date, time: `${rawHour}:${rawMinute}` };
}

function formatDateTimeValue(date: Date, time: string): string {
  return [
    date.getFullYear(),
    padDatePart(date.getMonth() + 1),
    padDatePart(date.getDate()),
  ].join("-") + `T${time}`;
}

function formatDisplayValue(value: string): string {
  const { date, time } = parseDateTimeValue(value);
  if (!date) return "";

  const [hours, minutes] = time.split(":").map(Number);
  const displayDate = new Date(date);
  displayDate.setHours(hours || 0, minutes || 0, 0, 0);

  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(displayDate);
}

export function DateTimePicker({
  value,
  onChange,
  placeholder = "Wybierz datę i godzinę",
  className,
  disabled,
  ...triggerProps
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [draftDate, setDraftDate] = React.useState<Date | undefined>(() => parseDateTimeValue(value).date);
  const [draftTime, setDraftTime] = React.useState(() => parseDateTimeValue(value).time);
  const timeInputId = React.useId();
  const displayValue = value ? formatDisplayValue(value) : "";
  const canSave = Boolean(draftDate) && TIME_PATTERN.test(draftTime);

  const resetDraft = React.useCallback(() => {
    const nextDraft = parseDateTimeValue(value);
    setDraftDate(nextDraft.date);
    setDraftTime(nextDraft.time);
  }, [value]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      resetDraft();
    }
    setOpen(nextOpen);
  };

  const handleToday = () => {
    setDraftDate(new Date());
  };

  const handleClear = () => {
    onChange("");
    setOpen(false);
  };

  const handleSave = () => {
    if (!draftDate) return;
    onChange(formatDateTimeValue(draftDate, draftTime));
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-10 w-full justify-start rounded-xl px-3 text-left font-normal aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-destructive/30",
            !displayValue && "text-muted-foreground",
            className,
          )}
          {...triggerProps}
        >
          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          <span className="truncate">{displayValue || placeholder}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(calc(100vw-2rem),22rem)] p-0">
        <Calendar
          mode="single"
          selected={draftDate}
          onSelect={setDraftDate}
          locale={pl}
          initialFocus
        />
        <div className="space-y-3 border-t border-border p-3">
          <div className="space-y-2">
            <label htmlFor={timeInputId} className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Godzina
            </label>
            <div className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-muted-foreground" />
              <Input
                id={timeInputId}
                type="time"
                value={draftTime}
                onChange={(event) => setDraftTime(event.target.value)}
                className="h-9"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={handleClear}>
                Wyczyść
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={handleToday}>
                Dzisiaj
              </Button>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Anuluj
              </Button>
              <Button type="button" size="sm" onClick={handleSave} disabled={!canSave}>
                Zapisz
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
