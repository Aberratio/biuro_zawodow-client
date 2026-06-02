import { FormEvent, ReactNode, useState } from "react";
import { LockKeyhole } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getStagingGatePassword, isStagingGateEnabled } from "@/lib/staging-gate";

const STAGING_GATE_STORAGE_KEY = "staging_gate_unlocked";

function readUnlocked(): boolean {
  try {
    return window.sessionStorage.getItem(STAGING_GATE_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function saveUnlocked(): void {
  try {
    window.sessionStorage.setItem(STAGING_GATE_STORAGE_KEY, "true");
  } catch {
    // Keep the in-memory unlock active when sessionStorage is unavailable.
  }
}

export function StagingGate({ children }: { children: ReactNode }) {
  const expectedPassword = getStagingGatePassword(import.meta.env);
  const [password, setPassword] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(readUnlocked);
  const [hasError, setHasError] = useState(false);

  if (!isStagingGateEnabled(import.meta.env) || isUnlocked) {
    return <>{children}</>;
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (password === expectedPassword) {
      saveUnlocked();
      setIsUnlocked(true);
      return;
    }

    setHasError(true);
    setPassword("");
  };

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md items-center justify-center">
        <Card className="w-full rounded-xl">
          <CardHeader className="space-y-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border bg-secondary text-secondary-foreground">
              <LockKeyhole className="h-5 w-5" aria-hidden="true" />
            </div>
            <CardTitle className="text-xl">Dostep do stagingu</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="staging-password">Haslo</Label>
                <Input
                  id="staging-password"
                  autoFocus
                  autoComplete="current-password"
                  type="password"
                  value={password}
                  aria-invalid={hasError}
                  aria-describedby={hasError ? "staging-password-error" : undefined}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setHasError(false);
                  }}
                />
                {hasError ? (
                  <p id="staging-password-error" className="text-sm text-destructive">
                    Nieprawidlowe haslo.
                  </p>
                ) : null}
              </div>
              <Button className="w-full" type="submit">
                Wejdz
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
