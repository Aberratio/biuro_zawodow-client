export interface BrowserStorageDiagnostics {
  canPersistSession: boolean;
  sessionStorageAvailable: boolean;
  localStorageAvailable: boolean;
  indexedDbAvailable: boolean;
  warnings: string[];
  blockingError?: string;
}

function canUseWebStorage(storage: Storage | undefined, key: string): boolean {
  if (!storage) return false;

  try {
    storage.setItem(key, "1");
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function canUseIndexedDb(): Promise<boolean> {
  if (typeof indexedDB === "undefined") {
    return Promise.resolve(false);
  }

  return new Promise(resolve => {
    const request = indexedDB.open("biuro-zawodow-storage-check", 1);
    let settled = false;

    const finish = (result: boolean) => {
      if (settled) return;
      settled = true;
      try {
        request.result?.close();
      } catch {
        // Ignore cleanup failures.
      }
      resolve(result);
    };

    request.onsuccess = () => finish(true);
    request.onerror = () => finish(false);
    request.onblocked = () => finish(false);
  });
}

export async function checkBrowserStorage(): Promise<BrowserStorageDiagnostics> {
  const sessionStorageAvailable = canUseWebStorage(window.sessionStorage, "biuro-zawodow-session-check");
  const localStorageAvailable = canUseWebStorage(window.localStorage, "biuro-zawodow-local-check");
  const indexedDbAvailable = await canUseIndexedDb();
  const canPersistSession = sessionStorageAvailable || localStorageAvailable;
  const warnings: string[] = [];

  if (!indexedDbAvailable) {
    warnings.push("Ta przeglądarka blokuje pamięć offline aplikacji. Logowanie może działać, ale tryb offline i skaner mogą być ograniczone.");
  }

  if (!localStorageAvailable && sessionStorageAvailable) {
    warnings.push("Ta przeglądarka nie pozwala zapisać trwałej sesji. Po zamknięciu aplikacji może być wymagane ponowne logowanie.");
  }

  return {
    canPersistSession,
    sessionStorageAvailable,
    localStorageAvailable,
    indexedDbAvailable,
    warnings,
    blockingError: canPersistSession
      ? undefined
      : "Ta przeglądarka blokuje zapis sesji. Wyłącz tryb prywatny albo zezwól stronie na zapisywanie danych i spróbuj ponownie.",
  };
}
