import { RefreshCcw, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';

function formatSyncTimestamp(value: string | null): string {
  if (!value) {
    return 'brak synchronizacji';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(parsed);
}

export function ConnectionBanner() {
  const { sessionState } = useAuth();
  const { connectionState, lastSyncAt, snapshotSource, pendingMutationCount, refreshData, isLoading, scannerMode } = useData();

  if (connectionState === 'online' && sessionState === 'online' && pendingMutationCount === 0) {
    return null;
  }

  const offlineCachedSession = sessionState === 'offline_cached';
  const usingCachedSnapshot = snapshotSource === 'cache';
  const isOffline = connectionState === 'offline';
  const showReadOnly = scannerMode === 'read_only';
  const toneClasses = isOffline
    ? 'border-amber-500/30 bg-amber-500/10 text-amber-900'
    : 'border-sky-500/30 bg-sky-500/10 text-sky-900';

  return (
    <div className={`mx-4 mt-4 rounded-2xl border px-4 py-3 text-sm sm:mx-5 lg:mx-6 ${toneClasses}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-semibold">
            {isOffline ? <WifiOff className="h-4 w-4" /> : <Wifi className="h-4 w-4" />}
            {showReadOnly
              ? 'Tryb odczytu z pamięci lokalnej'
              : pendingMutationCount > 0
                ? 'Część zmian czeka na synchronizację'
                : 'Aplikacja pracuje na danych z pamięci lokalnej'}
          </div>
          <p className="mt-1 text-xs leading-5 text-current/80">
            {offlineCachedSession && 'Sesja została utrzymana lokalnie mimo braku połączenia. '}
            {usingCachedSnapshot && `Ostatni snapshot: ${formatSyncTimestamp(lastSyncAt)}. `}
            {pendingMutationCount > 0 && `W kolejce oczekuje ${pendingMutationCount} zmian statusu. `}
            {showReadOnly && 'Dalsze zapisy są tymczasowo zablokowane, aby nie pracować na zbyt starych danych.'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refreshData()} disabled={isLoading} className="w-full lg:w-auto">
          <RefreshCcw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Odśwież dane
        </Button>
      </div>
    </div>
  );
}
