import { ExternalLink, Plus, Trash2 } from "lucide-react";
import type { EventOfficeHourRange, EventOfficeLocation } from "@/types";
import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import {
  formatEventOfficeHourRangeWithWeekday,
  toLocalDateTimeValue,
  type EventOfficeLocationsValidationErrors,
} from "@/lib/events";

interface EventOfficeLocationsEditorProps {
  idPrefix: string;
  locations: EventOfficeLocation[];
  onChange: (locations: EventOfficeLocation[]) => void;
  errors?: EventOfficeLocationsValidationErrors;
  disabled?: boolean;
}

function createEmptyRange(): EventOfficeHourRange {
  return { opens_at: "", closes_at: "" };
}

export function createEmptyEventOfficeLocation(): EventOfficeLocation {
  return { name: "", google_maps_url: "", hours: [createEmptyRange()] };
}

interface ComputedOfficeRangeSummary {
  key: string;
  label: string;
}

function buildComputedOfficeRangeSummaries(locations: EventOfficeLocation[]): ComputedOfficeRangeSummary[] {
  const showLocationName = locations.length > 1;

  return locations
    .flatMap((location, locationIndex) =>
      location.hours.map((range, rangeIndex) => {
        const label = formatEventOfficeHourRangeWithWeekday(range);
        if (!label) return null;

        return {
          key: `${locationIndex}-${rangeIndex}`,
          sortKey: toLocalDateTimeValue(range.opens_at),
          label: showLocationName ? `${location.name || "Lokalizacja"} — ${label}` : label,
        };
      }),
    )
    .filter((summary): summary is ComputedOfficeRangeSummary & { sortKey: string } => summary !== null)
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey));
}

export function EventOfficeLocationsEditor({
  idPrefix,
  locations,
  onChange,
  errors,
  disabled = false,
}: EventOfficeLocationsEditorProps) {
  const updateLocation = (index: number, patch: Partial<EventOfficeLocation>) => {
    onChange(locations.map((location, i) => (i === index ? { ...location, ...patch } : location)));
  };

  const removeLocation = (index: number) => {
    onChange(locations.filter((_, i) => i !== index));
  };

  const addLocation = () => {
    onChange([...locations, createEmptyEventOfficeLocation()]);
  };

  const updateRange = (locationIndex: number, rangeIndex: number, patch: Partial<EventOfficeHourRange>) => {
    onChange(
      locations.map((location, i) =>
        i === locationIndex
          ? { ...location, hours: location.hours.map((range, j) => (j === rangeIndex ? { ...range, ...patch } : range)) }
          : location,
      ),
    );
  };

  const removeRange = (locationIndex: number, rangeIndex: number) => {
    onChange(
      locations.map((location, i) =>
        i === locationIndex ? { ...location, hours: location.hours.filter((_, j) => j !== rangeIndex) } : location,
      ),
    );
  };

  const addRange = (locationIndex: number) => {
    onChange(
      locations.map((location, i) =>
        i === locationIndex ? { ...location, hours: [...location.hours, createEmptyRange()] } : location,
      ),
    );
  };

  const computedRangeSummaries = buildComputedOfficeRangeSummaries(locations);

  return (
    <div className="space-y-4">
      <div>
        <Label>Lokalizacje biura zawodów</Label>
        <FieldError id={`${idPrefix}-office-locations-error`} className="mt-2">
          {errors?.form}
        </FieldError>
      </div>

      {locations.map((location, locationIndex) => {
        const locationErrors = errors?.locations[locationIndex];

        return (
          <div
            key={locationIndex}
            className="space-y-3 rounded-xl border border-border p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 space-y-2">
                <Label htmlFor={`${idPrefix}-office-location-${locationIndex}-name`}>
                  Nazwa lokalizacji
                </Label>
                <Input
                  id={`${idPrefix}-office-location-${locationIndex}-name`}
                  value={location.name}
                  disabled={disabled}
                  onChange={(event) => updateLocation(locationIndex, { name: event.target.value })}
                  placeholder="np. Kraków, Błonia"
                  aria-invalid={Boolean(locationErrors?.name)}
                  aria-describedby={
                    locationErrors?.name ? `${idPrefix}-office-location-${locationIndex}-name-error` : undefined
                  }
                />
                <FieldError id={`${idPrefix}-office-location-${locationIndex}-name-error`}>
                  {locationErrors?.name}
                </FieldError>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={disabled}
                onClick={() => removeLocation(locationIndex)}
                aria-label="Usuń lokalizację"
                className="mt-6 shrink-0 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div>
              <Label htmlFor={`${idPrefix}-office-location-${locationIndex}-maps-url`}>
                Link do Google Maps (opcjonalnie)
              </Label>
              <div className="relative">
                <Input
                  id={`${idPrefix}-office-location-${locationIndex}-maps-url`}
                  value={location.google_maps_url ?? ""}
                  disabled={disabled}
                  onChange={(event) => updateLocation(locationIndex, { google_maps_url: event.target.value })}
                  placeholder="https://maps.google.com/..."
                  aria-invalid={Boolean(locationErrors?.google_maps_url)}
                  aria-describedby={
                    locationErrors?.google_maps_url
                      ? `${idPrefix}-office-location-${locationIndex}-maps-url-error`
                      : undefined
                  }
                />
                {location.google_maps_url && (
                  <a
                    href={location.google_maps_url}
                    target="_blank"
                    rel="noreferrer"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label="Otwórz link do Google Maps"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>
              <FieldError id={`${idPrefix}-office-location-${locationIndex}-maps-url-error`}>
                {locationErrors?.google_maps_url}
              </FieldError>
            </div>

            <div className="space-y-3">
              <Label>Zakresy godzin otwarcia</Label>
              {location.hours.map((range, rangeIndex) => {
                const rangeErrors = locationErrors?.hours?.[rangeIndex];

                return (
                  <div key={rangeIndex} className="flex flex-col gap-2 sm:flex-row sm:items-start">
                    <div className="flex-1">
                      <DateTimePicker
                        id={`${idPrefix}-office-location-${locationIndex}-range-${rangeIndex}-open`}
                        value={range.opens_at}
                        disabled={disabled}
                        onChange={(value) => updateRange(locationIndex, rangeIndex, { opens_at: value })}
                        placeholder="Otwarcie"
                        aria-invalid={Boolean(rangeErrors?.opens_at)}
                      />
                      <FieldError
                        id={`${idPrefix}-office-location-${locationIndex}-range-${rangeIndex}-open-error`}
                        className="mt-1"
                        reserveSpace
                      >
                        {rangeErrors?.opens_at}
                      </FieldError>
                    </div>
                    <div className="flex-1">
                      <DateTimePicker
                        id={`${idPrefix}-office-location-${locationIndex}-range-${rangeIndex}-close`}
                        value={range.closes_at}
                        disabled={disabled}
                        onChange={(value) => updateRange(locationIndex, rangeIndex, { closes_at: value })}
                        placeholder="Zamknięcie"
                        aria-invalid={Boolean(rangeErrors?.closes_at)}
                      />
                      <FieldError
                        id={`${idPrefix}-office-location-${locationIndex}-range-${rangeIndex}-close-error`}
                        className="mt-1"
                        reserveSpace
                      >
                        {rangeErrors?.closes_at}
                      </FieldError>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={disabled}
                      onClick={() => removeRange(locationIndex, rangeIndex)}
                      aria-label="Usuń zakres godzin"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
              <FieldError id={`${idPrefix}-office-location-${locationIndex}-form-error`}>
                {locationErrors?.form}
              </FieldError>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={() => addRange(locationIndex)}
              >
                <Plus className="h-4 w-4" />
                Dodaj zakres godzin
              </Button>
            </div>
          </div>
        );
      })}

      <Button type="button" variant="outline" disabled={disabled} onClick={addLocation}>
        <Plus className="h-4 w-4" />
        Dodaj lokalizację
      </Button>

      <div className="text-sm text-muted-foreground">
        <p>Godziny otwarcia biura:</p>
        {computedRangeSummaries.length === 0 ? (
          <p className="font-medium text-foreground">Uzupełnij lokalizacje i godziny, aby zobaczyć podsumowanie</p>
        ) : (
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            {computedRangeSummaries.map((summary) => (
              <li key={summary.key} className="font-medium text-foreground">
                {summary.label}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
