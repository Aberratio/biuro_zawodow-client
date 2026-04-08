import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Participant } from '@/types';
import { getParticipantStatusDefinition } from '@/lib/participant-status';

interface ParticipantSearchProps {
  participants: Participant[];
  onSelect: (participant: Participant) => void;
  autoFocus?: boolean;
}

export default function ParticipantSearch({
  participants,
  onSelect,
  autoFocus = true,
}: ParticipantSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoFocus) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [autoFocus]);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const search = useCallback((nextQuery: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!nextQuery.trim()) {
      setResults([]);
      setOpen(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setOpen(true);
    debounceRef.current = setTimeout(() => {
      const q = nextQuery.toLowerCase().trim();
      const response = participants.filter(
        participant =>
          participant.name.toLowerCase().includes(q) ||
          participant.email.toLowerCase().includes(q) ||
          participant.bib_number === q
      );
      setResults(response.slice(0, 5));
      setLoading(false);
    }, 300);
  }, [participants]);

  const handleChange = (value: string) => {
    setQuery(value);
    search(value);
  };

  const handleSelect = (participant: Participant) => {
    setQuery('');
    setResults([]);
    setOpen(false);
    onSelect(participant);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          placeholder="Nazwisko, numer, email..."
          value={query}
          onChange={event => handleChange(event.target.value)}
          onFocus={() => query.trim() && results.length > 0 && setOpen(true)}
          className="h-12 pl-10 text-base font-medium"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {open && (
        <div className="surface-popover absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border">
          {loading && results.length === 0 ? (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Szukam...
            </div>
          ) : results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-muted-foreground">
              Brak wyników
            </div>
          ) : (
            results.map(participant => {
              const status = getParticipantStatusDefinition(participant.status);

              return (
                <button
                  key={participant.id}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-accent active:bg-accent/70 touch-manipulation transition-colors border-b last:border-b-0 border-border/50"
                  onClick={() => handleSelect(participant)}
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{participant.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{participant.email}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <span className="text-sm font-bold tabular-nums text-primary">
                      #{participant.bib_number}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-bold ${
                        status.countsAsCheckedIn
                          ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-300'
                          : 'border-primary/20 bg-primary/10 text-primary'
                      }`}
                      title={status.label}
                    >
                      {status.countsAsCheckedIn ? '✓' : '○'}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
