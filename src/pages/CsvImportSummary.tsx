import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CheckCircle2, Download, FileWarning, Loader2, RotateCcw, UploadCloud } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { useRouteEventContext } from '@/hooks/use-route-event-context';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/PageHeader';
import { buildEventImportPath, buildEventPath } from '@/lib/routes';
import TableSkeleton from '@/components/skeletons/TableSkeleton';
import { toast } from '@/hooks/use-toast';

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
  emailColumn?: string;
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

function buildCsvContent(headers: string[], rows: ImportRowIssue[]): string {
  const csvRows = [
    headers,
    ...rows.map(issue => headers.map(header => issue.row?.[header] ?? '')),
  ];
  return csvRows.map(row => row.map(cell => escapeCsvCell(String(cell ?? ''))).join(';')).join('\r\n');
}

function downloadCsv(filename: string, headers: string[], rows: ImportRowIssue[]) {
  const csv = buildCsvContent(headers, rows);
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

function isLikelyEmailColumn(header: string): boolean {
  const normalized = header.toLowerCase().replace(/[\s_-]+/g, '');
  return normalized === 'email' || normalized === 'e-mail' || normalized.includes('email') || normalized.includes('mail');
}

function resolveEmailColumn(explicitColumn: string | undefined, headers: string[], issues: ImportRowIssue[]): string {
  if (explicitColumn && headers.includes(explicitColumn)) return explicitColumn;
  const matchingHeader = headers.find(isLikelyEmailColumn);
  if (matchingHeader) return matchingHeader;

  return headers.find(header => issues.some(issue => (issue.row?.[header] ?? '').includes('@'))) ?? '';
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
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

function IssueTable({
  title,
  description,
  issues,
  headers,
  badgeLabel,
  editableEmailColumn,
  emailErrors = {},
  onEmailChange,
  onSaveIssue,
  savingRowNumbers = {},
  saveDisabled = false,
}: {
  title: string;
  description: string;
  issues: ImportRowIssue[];
  headers: string[];
  badgeLabel: string;
  editableEmailColumn?: string;
  emailErrors?: Record<number, string>;
  onEmailChange?: (rowNumber: number, value: string) => void;
  onSaveIssue?: (issue: ImportRowIssue) => void;
  savingRowNumbers?: Record<number, boolean>;
  saveDisabled?: boolean;
}) {
  if (issues.length === 0) return null;

  const visibleHeaders = editableEmailColumn
    ? headers.filter(header => header !== editableEmailColumn)
    : headers;
  const isEditable = Boolean(editableEmailColumn && onEmailChange);

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
                {isEditable && <TableHead className="min-w-[18rem]">E-mail do poprawy</TableHead>}
                {isEditable && <TableHead className="w-[10rem]">Zapis</TableHead>}
                <TableHead className="min-w-[16rem]">Powód</TableHead>
                {visibleHeaders.map(header => (
                  <TableHead key={header} className="min-w-[10rem]">{header}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {issues.map(issue => (
                <TableRow key={`${title}-${issue.row_number}`}>
                  <TableCell className="font-medium">{issue.row_number}</TableCell>
                  {isEditable && editableEmailColumn && onEmailChange && (
                    <TableCell className="align-top">
                      <div className="min-w-[16rem] space-y-1">
                        <Input
                          type="email"
                          value={issue.row?.[editableEmailColumn] ?? ''}
                          onChange={event => onEmailChange(issue.row_number, event.target.value)}
                          aria-invalid={Boolean(emailErrors[issue.row_number])}
                          className="h-9"
                          placeholder="email@example.com"
                        />
                        {emailErrors[issue.row_number] && (
                          <p className="text-xs text-destructive">{emailErrors[issue.row_number]}</p>
                        )}
                      </div>
                    </TableCell>
                  )}
                  {isEditable && (
                    <TableCell className="align-top">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => onSaveIssue?.(issue)}
                        disabled={saveDisabled || savingRowNumbers[issue.row_number]}
                        className="whitespace-nowrap"
                      >
                        {savingRowNumbers[issue.row_number] ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-1 h-4 w-4" />}
                        Dopisz
                      </Button>
                    </TableCell>
                  )}
                  <TableCell className="max-w-[22rem]">
                    <div className="space-y-1">
                      {issue.reasons.map((reason, index) => (
                        <p key={`${issue.row_number}-${index}`} className="text-sm text-muted-foreground">{reason}</p>
                      ))}
                    </div>
                  </TableCell>
                  {visibleHeaders.map(header => (
                    <TableCell key={`${issue.row_number}-${header}`} className="max-w-[18rem]">
                      <span className="block truncate">{issue.row?.[header] || <span className="text-muted-foreground">-</span>}</span>
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
  const { events, selectedEventId, isLoading, runParticipantImport, connectionState } = useData();
  const eventId = routeEventId || selectedEventId;
  const event = events.find(item => item.id === eventId);
  const state = (location.state ?? {}) as ImportSummaryState;
  const summary = state.summary;
  const [editableInvalidIssues, setEditableInvalidIssues] = useState<ImportRowIssue[]>([]);
  const [emailErrors, setEmailErrors] = useState<Record<number, string>>({});
  const [retryingImport, setRetryingImport] = useState(false);
  const [savingRowNumbers, setSavingRowNumbers] = useState<Record<number, boolean>>({});
  const [importedFixedCount, setImportedFixedCount] = useState(0);

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
    () => collectHeaders(state.headers, editableInvalidIssues),
    [editableInvalidIssues, state.headers],
  );
  const emailColumn = useMemo(
    () => resolveEmailColumn(state.emailColumn, invalidHeaders, editableInvalidIssues),
    [editableInvalidIssues, invalidHeaders, state.emailColumn],
  );
  const canRetryEditedRows = editableInvalidIssues.length > 0 && Boolean(emailColumn) && connectionState === 'online';
  const changedEmailCount = useMemo(
    () => editableInvalidIssues.filter(issue => {
      const originalIssue = invalidIssues.find(item => item.row_number === issue.row_number);
      return (issue.row?.[emailColumn] ?? '') !== (originalIssue?.row?.[emailColumn] ?? '');
    }).length,
    [editableInvalidIssues, emailColumn, invalidIssues],
  );
  const currentInvalidCount = summary ? editableInvalidIssues.length : 0;
  const currentCreatedCount = (summary?.created_count ?? 0) + importedFixedCount;
  const unimportedCount = currentInvalidCount + (summary?.duplicate_count ?? 0);

  useEffect(() => {
    setEditableInvalidIssues(
      invalidIssues.map(issue => ({
        ...issue,
        reasons: [...issue.reasons],
        row: { ...issue.row },
      })),
    );
    setEmailErrors({});
    setImportedFixedCount(0);
  }, [invalidIssues]);

  const handleEmailChange = (rowNumber: number, value: string) => {
    setEditableInvalidIssues(prev => prev.map(issue => (
      issue.row_number === rowNumber
        ? { ...issue, row: { ...issue.row, [emailColumn]: value } }
        : issue
    )));
    setEmailErrors(prev => ({ ...prev, [rowNumber]: '' }));
  };

  const validateIssueEmail = (issue: ImportRowIssue): string => {
    const email = (issue.row?.[emailColumn] ?? '').trim();
    if (!email) return 'Podaj adres e-mail.';
    if (!isValidEmail(email)) return 'Podaj poprawny adres e-mail.';
    return '';
  };

  const applyRetryResultToRows = (
    attemptedIssues: ImportRowIssue[],
    result: Awaited<ReturnType<typeof runParticipantImport>>,
  ) => {
    const failedDetails = [
      ...(result.invalid_row_details ?? []),
      ...(result.duplicate_row_details ?? []),
    ];
    const failedByAttemptIndex = new Map(
      failedDetails.map(detail => [detail.row_number - 2, detail]),
    );
    const remainingIssues = attemptedIssues
      .map((issue, index) => {
        const failedDetail = failedByAttemptIndex.get(index);
        if (!failedDetail) return null;
        return {
          ...issue,
          reasons: failedDetail.reasons.length > 0 ? failedDetail.reasons : issue.reasons,
          row: { ...issue.row, ...failedDetail.row },
        };
      })
      .filter((issue): issue is ImportRowIssue => issue !== null);
    const successfulOriginalRows = new Set(
      attemptedIssues
        .filter((_, index) => !failedByAttemptIndex.has(index))
        .map(issue => issue.row_number),
    );

    setEditableInvalidIssues(previous => [
      ...previous.filter(issue => !attemptedIssues.some(attempted => attempted.row_number === issue.row_number)),
      ...remainingIssues,
    ].sort((left, right) => left.row_number - right.row_number));
    setEmailErrors({});

    if (successfulOriginalRows.size > 0) {
      setImportedFixedCount(previous => previous + successfulOriginalRows.size);
    }
  };

  const handleSaveIssue = async (issue: ImportRowIssue) => {
    if (!emailColumn) {
      toast({ title: 'Nie znaleziono kolumny e-mail', variant: 'destructive' });
      return;
    }

    const validationError = validateIssueEmail(issue);
    if (validationError) {
      setEmailErrors(previous => ({ ...previous, [issue.row_number]: validationError }));
      return;
    }

    try {
      setSavingRowNumbers(previous => ({ ...previous, [issue.row_number]: true }));
      const result = await runParticipantImport(eventId, buildCsvContent(invalidHeaders, [issue]));
      applyRetryResultToRows([issue], result);

      if (result.created_count > 0) {
        toast({ title: 'Zawodnik dopisany do bazy' });
      } else {
        toast({
          title: 'Nie udało się dopisać zawodnika',
          description: result.duplicate_count > 0 ? 'Ten rekord nadal wygląda jak duplikat.' : 'Sprawdź dane w wierszu i spróbuj ponownie.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Nie udało się dopisać zawodnika',
        description: error instanceof Error ? error.message : 'Spróbuj ponownie albo pobierz CSV do poprawy.',
        variant: 'destructive',
      });
    } finally {
      setSavingRowNumbers(previous => ({ ...previous, [issue.row_number]: false }));
    }
  };

  const handleRetryEditedRows = async () => {
    if (!emailColumn) {
      toast({ title: 'Nie znaleziono kolumny e-mail', variant: 'destructive' });
      return;
    }

    const nextErrors = editableInvalidIssues.reduce<Record<number, string>>((accumulator, issue) => {
      const error = validateIssueEmail(issue);
      if (error) accumulator[issue.row_number] = error;
      return accumulator;
    }, {});

    if (Object.values(nextErrors).some(Boolean)) {
      setEmailErrors(nextErrors);
      toast({ title: 'Popraw adresy e-mail przed importem', variant: 'destructive' });
      return;
    }

    try {
      setRetryingImport(true);
      const attemptedIssues = [...editableInvalidIssues];
      const csvContent = buildCsvContent(invalidHeaders, editableInvalidIssues);
      const result = await runParticipantImport(eventId, csvContent);
      applyRetryResultToRows(attemptedIssues, result);
      toast({
        title: `Dopisano ${result.created_count} zawodników do bazy`,
        description: result.invalid_count + result.duplicate_count > 0
          ? `${result.invalid_count + result.duplicate_count} wierszy nadal wymaga poprawy.`
          : undefined,
      });
    } catch (error) {
      toast({
        title: 'Nie udało się zaimportować poprawionych wierszy',
        description: error instanceof Error ? error.message : 'Spróbuj ponownie albo pobierz CSV do poprawy.',
        variant: 'destructive',
      });
    } finally {
      setRetryingImport(false);
    }
  };

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
            editableInvalidIssues.length > 0 ? (
              <>
                <Button onClick={handleRetryEditedRows} disabled={!canRetryEditedRows || retryingImport}>
                  {retryingImport ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-1 h-4 w-4" />}
                  Dopisz poprawione do bazy
                </Button>
                <Button variant="outline" onClick={() => downloadCsv(`do-poprawy-${eventId}.csv`, invalidHeaders, editableInvalidIssues)}>
                  <Download className="mr-1 h-4 w-4" /> Pobierz CSV do poprawy
                </Button>
              </>
            ) : null
          }
        />
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <StatCard label="Zaimportowano" value={currentCreatedCount} tone="success" />
        <StatCard label="Nie zaimportowano" value={unimportedCount} tone={unimportedCount > 0 ? 'warning' : 'default'} />
        <StatCard label="Duplikaty" value={summary.duplicate_count} tone={summary.duplicate_count > 0 ? 'warning' : 'default'} />
        <StatCard label="Błędne wiersze" value={currentInvalidCount} tone={currentInvalidCount > 0 ? 'danger' : 'default'} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Alert className="border-emerald-400/40 bg-emerald-500/10">
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Import zakończony</AlertTitle>
          <AlertDescription>
            Dodano {currentCreatedCount} uczestników. {state.mode === 'replace' ? 'Poprzednia lista została podmieniona.' : 'Nowi uczestnicy zostali dopisani do wydarzenia.'}
          </AlertDescription>
        </Alert>
        {unimportedCount > 0 ? (
          <Alert className="border-amber-400/50 bg-amber-500/10">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Wymagane sprawdzenie danych</AlertTitle>
            <AlertDescription>
              {currentInvalidCount > 0 ? 'Błędne adresy e-mail można poprawić w tabeli poniżej i od razu dopisać zawodnika do bazy. ' : ''}
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

      {editableInvalidIssues.length > 0 && !emailColumn && (
        <Alert className="border-amber-400/50 bg-amber-500/10">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Nie rozpoznano kolumny e-mail</AlertTitle>
          <AlertDescription>
            Możesz nadal pobrać CSV do poprawy. Edycja w tabeli wymaga rozpoznanej kolumny z adresem e-mail.
          </AlertDescription>
        </Alert>
      )}

      {editableInvalidIssues.length > 0 && emailColumn && (
        <Card>
          <CardContent className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium">Poprawianie adresów e-mail w UI</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Edytowana kolumna: <span className="font-medium text-foreground">{emailColumn}</span>.
                {changedEmailCount > 0 ? ` Zmieniono ${changedEmailCount} adresów.` : ' Wprowadź poprawki w tabeli poniżej.'}
              </p>
            </div>
            <Button onClick={handleRetryEditedRows} disabled={!canRetryEditedRows || retryingImport}>
              {retryingImport ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-1 h-4 w-4" />}
              Dopisz wszystkie poprawione
            </Button>
          </CardContent>
        </Card>
      )}

      <IssueTable
        title="Wiersze do poprawy"
        description="Te rekordy nie zostały zaimportowane z powodu brakujących lub nieprawidłowych danych."
        issues={editableInvalidIssues}
        headers={issueHeaders}
        badgeLabel={`${editableInvalidIssues.length} wierszy`}
        editableEmailColumn={emailColumn}
        emailErrors={emailErrors}
        onEmailChange={handleEmailChange}
        onSaveIssue={handleSaveIssue}
        savingRowNumbers={savingRowNumbers}
        saveDisabled={connectionState !== 'online'}
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
