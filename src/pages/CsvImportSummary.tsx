import { useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CheckCircle2, Download, FileWarning, RotateCcw } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { useRouteEventContext } from '@/hooks/use-route-event-context';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/PageHeader';
import { buildEventImportPath, buildEventPath } from '@/lib/routes';
import TableSkeleton from '@/components/skeletons/TableSkeleton';

interface ImportRowIssue {
  row_number: number;
  reasons: string[];
  row: Record<string, string>;
  matched_by?: string;
}

interface ImportSummaryState {
  summary?: {
    created_count: number;
    duplicate_count: number;
    invalid_count: number;
    invalid_rows: number[];
    invalid_row_details?: ImportRowIssue[];
    duplicate_row_details?: ImportRowIssue[];
    reset?: Record<string, unknown>;
  };
  headers?: string[];
  fileName?: string;
  importedAt?: string;
  mode?: 'append' | 'replace';
}

function getIssueRows(details: ImportRowIssue[] | undefined, rowNumbers: number[] | undefined): ImportRowIssue[] {
  if (details && details.length > 0) return details;
  return (rowNumbers ?? []).map(rowNumber => ({
    row_number: rowNumber,
    reasons: ['Wiersz nie spełnił wymagań importu.'],
    row: {},
  }));
}

function collectHeaders(headers: string[] | undefined, issues: ImportRowIssue[]): string[] {
  const ordered = new Set((headers ?? []).filter(Boolean));
  issues.forEach(issue => {
    Object.keys(issue.row ?? {}).forEach(header => ordered.add(header));
  });
  return Array.from(ordered);
}

function escapeCsvCell(value: string): string {
  if (!/[;"\r\n]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, headers: string[], rows: ImportRowIssue[]) {
  const csvRows = [
    headers,
    ...rows.map(issue => headers.map(header => issue.row?.[header] ?? '')),
  ];
  const csv = csvRows.map(row => row.map(cell => escapeCsvCell(String(cell ?? ''))).join(';')).join('\r\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function StatCard({ label, value, tone = 'default' }: { label: string; value: number; tone?: 'default' | 'success' | 'warning' | 'danger' }) {
  const toneClassName = {
    default: 'border-border/70 bg-card',
    success: 'border-emerald-400/40 bg-emerald-500/10',
    warning: 'border-amber-400/45 bg-amber-500/10',
    danger: 'border-destructive/40 bg-destructive/10',
  }[tone];

  return (
    <div className={`rounded-lg border px-4 py-3 ${toneClassName}`}>
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function IssueTable({ title, description, issues, headers, badgeLabel }: { title: string; description: string; issues: ImportRowIssue[]; headers: string[]; badgeLabel: string }) {
  if (issues.length === 0) return null;

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
          <Badge variant="secondary">{badgeLabel}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="max-h-[34rem] overflow-auto rounded-lg border">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead className="w-24">Wiersz</TableHead>
                <TableHead className="min-w-[16rem]">Powód</TableHead>
                {headers.map(header => (
                  <TableHead key={header} className="min-w-[10rem]">{header}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {issues.map(issue => (
                <TableRow key={`${title}-${issue.row_number}`}>
                  <TableCell className="font-medium">{issue.row_number}</TableCell>
                  <TableCell className="max-w-[22rem]">
                    <div className="space-y-1">
                      {issue.reasons.map((reason, index) => (
                        <p key={`${issue.row_number}-${index}`} className="text-sm text-muted-foreground">{reason}</p>
                      ))}
                    </div>
                  </TableCell>
                  {headers.map(header => (
                    <TableCell key={`${issue.row_number}-${header}`} className="max-w-[18rem] truncate">
                      {issue.row?.[header] || <span className="text-muted-foreground">-</span>}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CsvImportSummary() {
  const { id: routeEventId = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { events, selectedEventId, isLoading } = useData();
  const eventId = routeEventId || selectedEventId;
  const event = events.find(item => item.id === eventId);
  const state = (location.state ?? {}) as ImportSummaryState;
  const summary = state.summary;

  useRouteEventContext(routeEventId);

  const invalidIssues = useMemo(
    () => getIssueRows(summary?.invalid_row_details, summary?.invalid_rows),
    [summary?.invalid_row_details, summary?.invalid_rows],
  );
  const duplicateIssues = useMemo(
    () => getIssueRows(summary?.duplicate_row_details, []),
    [summary?.duplicate_row_details],
  );
  const issueHeaders = useMemo(
    () => collectHeaders(state.headers, [...invalidIssues, ...duplicateIssues]),
    [duplicateIssues, invalidIssues, state.headers],
  );
  const invalidHeaders = useMemo(
    () => collectHeaders(state.headers, invalidIssues),
    [invalidIssues, state.headers],
  );
  const unimportedCount = (summary?.invalid_count ?? 0) + (summary?.duplicate_count ?? 0);

  if (isLoading) return <TableSkeleton rows={5} cols={4} subtitle="" />;
  if (!event) return <div className="py-12 text-center text-muted-foreground">Nie znaleziono wydarzenia</div>;

  if (!summary) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(buildEventImportPath(eventId))} className="w-fit rounded-full px-1 text-[0.98rem] font-medium text-[hsl(var(--button-highlight))] hover:bg-transparent hover:text-[hsl(var(--button-highlight))]">
          <ArrowLeft className="mr-1 h-4 w-4" /> Wróć do importu
        </Button>
        <PageHeader title="Podsumowanie importu CSV" description={`Wydarzenie: ${event.name}`} />
        <Alert>
          <FileWarning className="h-4 w-4" />
          <AlertTitle>Brak danych podsumowania</AlertTitle>
          <AlertDescription>Podsumowanie jest dostępne bezpośrednio po imporcie pliku CSV.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(buildEventPath(eventId))} className="w-fit rounded-full px-1 text-[0.98rem] font-medium text-[hsl(var(--button-highlight))] hover:bg-transparent hover:text-[hsl(var(--button-highlight))]">
          <ArrowLeft className="mr-1 h-4 w-4" /> Wróć do wydarzenia
        </Button>
        <PageHeader
          title="Podsumowanie importu CSV"
          description={
            <>
              <p>Wydarzenie: <span className="font-medium text-foreground">{event.name}</span></p>
              {state.fileName && <p className="mt-1 text-xs">Plik: {state.fileName}</p>}
            </>
          }
          actions={
            invalidIssues.length > 0 ? (
              <Button onClick={() => downloadCsv(`do-poprawy-${eventId}.csv`, invalidHeaders, invalidIssues)}>
                <Download className="mr-1 h-4 w-4" /> Pobierz CSV do poprawy
              </Button>
            ) : null
          }
        />
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <StatCard label="Zaimportowano" value={summary.created_count} tone="success" />
        <StatCard label="Nie zaimportowano" value={unimportedCount} tone={unimportedCount > 0 ? 'warning' : 'default'} />
        <StatCard label="Duplikaty" value={summary.duplicate_count} tone={summary.duplicate_count > 0 ? 'warning' : 'default'} />
        <StatCard label="Błędne wiersze" value={summary.invalid_count} tone={summary.invalid_count > 0 ? 'danger' : 'default'} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Alert className="border-emerald-400/40 bg-emerald-500/10">
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Import zakończony</AlertTitle>
          <AlertDescription>
            Dodano {summary.created_count} uczestników. {state.mode === 'replace' ? 'Poprzednia lista została podmieniona.' : 'Nowi uczestnicy zostali dopisani do wydarzenia.'}
          </AlertDescription>
        </Alert>
        {unimportedCount > 0 ? (
          <Alert className="border-amber-400/50 bg-amber-500/10">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Wymagane sprawdzenie danych</AlertTitle>
            <AlertDescription>
              {summary.invalid_count > 0 ? 'Błędne wiersze można pobrać jako CSV, poprawić i wgrać ponownie. ' : ''}
              {summary.duplicate_count > 0 ? 'Duplikaty pominięto, bo pasują do uczestników już zapisanych w wydarzeniu.' : ''}
            </AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Bez pominiętych wierszy</AlertTitle>
            <AlertDescription>Nie wykryto duplikatów ani błędnych rekordów.</AlertDescription>
          </Alert>
        )}
      </div>

      <IssueTable
        title="Wiersze do poprawy"
        description="Te rekordy nie zostały zaimportowane z powodu brakujących lub nieprawidłowych danych."
        issues={invalidIssues}
        headers={issueHeaders}
        badgeLabel={`${invalidIssues.length} wierszy`}
      />

      <IssueTable
        title="Pominięte duplikaty"
        description="Te rekordy nie zostały dodane, bo odpowiadają uczestnikom już istniejącym w tym wydarzeniu."
        issues={duplicateIssues}
        headers={issueHeaders}
        badgeLabel={`${duplicateIssues.length} wierszy`}
      />

      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={() => navigate(buildEventImportPath(eventId))}>
          <RotateCcw className="mr-1 h-4 w-4" /> Wgraj kolejny CSV
        </Button>
        <Button onClick={() => navigate(buildEventPath(eventId))}>Przejdź do wydarzenia</Button>
      </div>
    </div>
  );
}
