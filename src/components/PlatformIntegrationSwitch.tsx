import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { isApiResponseError } from "@/lib/api";
import {
  PLATFORM_INTEGRATION_MODES,
  describePlatformIntegrationMode,
  getPlatformIntegrationMode,
  savePlatformIntegrationMode,
  type PlatformIntegrationMode,
} from "@/lib/platform-connection";

/** Superadmin switch for who may use the ZmierzymyCzas platform integration. */
export function PlatformIntegrationSwitch() {
  const { getAuthHeaders } = useAuth();
  const [mode, setMode] = useState<PlatformIntegrationMode | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setMode(await getPlatformIntegrationMode(getAuthHeaders()));
    } catch {
      setLoadError("Nie udało się wczytać ustawienia integracji z platformą.");
    }
    // Load once on mount; getAuthHeaders changes identity on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleChange = async (value: string) => {
    const next = value as PlatformIntegrationMode;
    if (next === mode) return;
    setIsSaving(true);
    try {
      setMode(await savePlatformIntegrationMode(getAuthHeaders(true), next));
      toast({
        title: `Integracja z platformą: ${describePlatformIntegrationMode(next).label.toLowerCase()}`,
      });
    } catch (error) {
      toast({
        title: "Nie udało się zmienić ustawienia",
        description: isApiResponseError(error) ? error.message : undefined,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardContent className="space-y-3 p-4 sm:p-5">
        <div>
          <p className="font-medium">Integracja z platformą Zmierzymy Czas</p>
          <p className="text-sm text-muted-foreground">
            Kto może łączyć wydarzenia z platformą i importować uczestników.
          </p>
        </div>

        {loadError ? (
          <div className="flex flex-wrap items-center gap-3">
            <p
              role="alert"
              className="flex items-start gap-2 text-sm text-destructive"
            >
              <AlertCircle
                className="mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
              />
              {loadError}
            </p>
            <Button variant="outline" size="sm" onClick={() => void load()}>
              Spróbuj ponownie
            </Button>
          </div>
        ) : mode === null ? (
          <p
            className="flex items-center gap-2 text-sm text-muted-foreground"
            role="status"
          >
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Wczytywanie…
          </p>
        ) : (
          <RadioGroup
            value={mode}
            onValueChange={(value) => void handleChange(value)}
            disabled={isSaving}
            aria-label="Dostępność integracji z platformą"
            className="gap-3"
          >
            {PLATFORM_INTEGRATION_MODES.map((option) => {
              const { label, description } =
                describePlatformIntegrationMode(option);
              const id = `platform-integration-mode-${option}`;
              return (
                <div key={option} className="flex items-start gap-3">
                  <RadioGroupItem value={option} id={id} className="mt-0.5" />
                  <div className="space-y-0.5">
                    <Label htmlFor={id}>{label}</Label>
                    <p className="text-sm text-muted-foreground">
                      {description}
                    </p>
                  </div>
                </div>
              );
            })}
          </RadioGroup>
        )}
      </CardContent>
    </Card>
  );
}
