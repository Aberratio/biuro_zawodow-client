import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useData } from '@/contexts/DataContext';
import { useRouteEventContext } from '@/hooks/use-route-event-context';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SuccessActionDialog } from '@/components/SuccessActionDialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FieldError } from '@/components/ui/field-error';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, FileUp, Info, Loader2, Mail, RefreshCcw, Sparkles } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import TableSkeleton from '@/components/skeletons/TableSkeleton';
import { formatEventOfficeWindow } from '@/lib/events';
import { validateRequired } from '@/lib/form-validation';
import { OnlineOnlyNotice } from '@/components/OnlineOnlyNotice';
import { buildEventPath } from '@/lib/routes';
import { PageHeader } from '@/components/PageHeader';

type EditableFieldRole = 'ignore' | 'display_name_part' | 'bib_number' | 'custom' | 'important_custom';

interface MappingDraft {
  source_column_name: string;
  alias: string;
  field_role: EditableFieldRole;
}

function getMappingFieldCardClassName(fieldRole: EditableFieldRole): string {
  switch (fieldRole) {
    case 'bib_number':
      return 'rounded-lg border border-amber-400/70 bg-amber-500/10 p-3 shadow-[inset_0_0_0_1px_rgba(251,191,36,0.18)]';
    case 'display_name_part':
      return 'rounded-lg border border-sky-400/70 bg-sky-500/10 p-3 shadow-[inset_0_0_0_1px_rgba(56,189,248,0.16)]';
    case 'important_custom':
      return 'rounded-lg border border-rose-400/70 bg-rose-500/10 p-3 shadow-[inset_0_0_0_1px_rgba(251,113,133,0.16)]';
    case 'ignore':
      return 'rounded-lg border border-border/50 bg-card/35 p-3 opacity-60';
    case 'custom':
    default:
      return 'rounded-lg border border-border/60 bg-card/60 p-3';
  }
}

function decodeCsvFile(buffer: ArrayBuffer): string {
  const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
  try {
    return utf8Decoder.decode(buffer);
  } catch {
    // Many Polish CSV exports still use Central European encodings.
  }

  const candidateEncodings = ['windows-1250', 'iso-8859-2'] as const;
  let bestText = '';
  let bestScore = Number.POSITIVE_INFINITY;

  for (const encoding of candidateEncodings) {
    try {
      const text = new TextDecoder(encoding).decode(buffer);
      const replacementCount = (text.match(/\uFFFD/g) ?? []).length;
      if (replacementCount < bestScore) {
        bestScore = replacementCount;
        bestText = text;
      }
    } catch {
      // Ignore unsupported decoder candidates.
    }
  }

  if (bestText !== '') {
    return bestText;
  }

  return new TextDecoder().decode(buffer);
}

export default function CsvImport() {
  const { id: routeEventId = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    events,
    selectedEventId,
    analyzeParticipantImport,
    confirmParticipantImportMapping,
    runParticipantImport,
    isLoading,
    connectionState,
  } = useData();
  const eventId = routeEventId || selectedEventId;
  const event = events.find(item => item.id === eventId);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [fileName, setFileName] = useState('');
  const [csvContent, setCsvContent] = useState('');
  const [analysis, setAnalysis] = useState<Awaited<ReturnType<typeof analyzeParticipantImport>> | null>(null);
  const [selectedEmailColumn, setSelectedEmailColumn] = useState('');
  const [mappingDrafts, setMappingDrafts] = useState<MappingDraft[]>([]);
  const [runningAction, setRunningAction] = useState<'analyze' | 'confirm' | 'run' | ''>('');
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof runParticipantImport>> | null>(null);
  const [importSuccessOpen, setImportSuccessOpen] = useState(false);
  const [mappingErrors, setMappingErrors] = useState<{ emailColumn?: string; aliases: Record<string, string>; form?: string }>({ aliases: {} });
  const isOnline = connectionState === 'online';

  useRouteEventContext(routeEventId);

  useEffect(() => {
    if (!analysis || analysis.has_mapping) {
      setMappingDrafts([]);
      return;
    }

    const autoEmailColumn = analysis.email_candidates.length === 1 ? analysis.email_candidates[0].column : selectedEmailColumn;
    setSelectedEmailColumn(autoEmailColumn);
    setMappingDrafts(
      analysis.headers
        .filter(header => header !== autoEmailColumn)
        .map(header => ({
          source_column_name: header,
          alias: header,
          field_role: 'custom',
        })),
    );
  }, [analysis, selectedEmailColumn]);

  const multipleEmailCandidates = (analysis?.email_candidates.length ?? 0) > 1;
  const canRunWithSavedMapping = !!analysis?.has_mapping && (analysis.missing_required_columns?.length ?? 0) === 0;
  const displayNamePartsCount = mappingDrafts.filter(field => field.field_role === 'display_name_part').length;
  const shouldWaitForEmailSelection = !analysis?.has_mapping && multipleEmailCandidates && !selectedEmailColumn;
  const bibNumberColumn = mappingDrafts.find(field => field.field_role === 'bib_number')?.source_column_name ?? null;

  const activeDrafts = useMemo(() => mappingDrafts.filter(field => field.field_role !== 'ignore'), [mappingDrafts]);
  const previewHeaderLabels = useMemo(() => {
    if (!analysis || analysis.has_mapping) {
      return new Map<string, string>();
    }

    return new Map(
      mappingDrafts.map(field => [
        field.source_column_name,
        field.alias.trim() || field.source_column_name,
      ]),
    );
  }, [analysis, mappingDrafts]);
  const previewHeaders = useMemo(() => {
    if (!analysis) return [];
    if (analysis.has_mapping) return analysis.headers;

    return analysis.headers.filter(header => {
      if (header === selectedEmailColumn) return true;
      const matchingDraft = mappingDrafts.find(field => field.source_column_name === header);
      return matchingDraft ? matchingDraft.field_role !== 'ignore' : true;
    });
  }, [analysis, mappingDrafts, selectedEmailColumn]);

  const handleFilePicked = async (eventValue: ChangeEvent<HTMLInputElement>) => {
    const file = eventValue.target.files?.[0];
    if (!file) return;

    const text = decodeCsvFile(await file.arrayBuffer());
    setFileName(file.name);
    setCsvContent(text);
    setSummary(null);
    setMappingErrors({ aliases: {} });

    try {
      setRunningAction('analyze');
      const result = await analyzeParticipantImport(eventId, text);
      setAnalysis(result);
      toast({ title: 'CSV przeanalizowany', description: `Wykryto ${result.headers.length} kolumn i ${result.row_count} wierszy.` });
    } catch (error) {
      setAnalysis(null);
      toast({
        title: 'Nie udało się przeanalizować pliku',
        description: error instanceof Error ? error.message : 'Wystąpił błąd podczas analizy CSV.',
        variant: 'destructive',
      });
    } finally {
      setRunningAction('');
    }
  };

  const handleFieldChange = (sourceColumnName: string, patch: Partial<MappingDraft>) => {
    setMappingDrafts(prev => prev.map(field => field.source_column_name === sourceColumnName ? { ...field, ...patch } : field));
    setMappingErrors(prev => ({
      ...prev,
      aliases: { ...prev.aliases, [sourceColumnName]: '' },
      form: undefined,
    }));
  };

  const handleSaveMappingAndImport = async () => {
    if (!analysis) return;
    if (!selectedEmailColumn) {
      setMappingErrors(prev => ({ ...prev, emailColumn: 'Wybierz kolumnę email.' }));
      toast({ title: 'Wybierz kolumnę email', variant: 'destructive' });
      return;
    }
    if (displayNamePartsCount === 0) {
      setMappingErrors(prev => ({ ...prev, form: 'Wskaż przynajmniej jedną część nazwy uczestnika.' }));
      toast({ title: 'Wskaż przynajmniej jedną część nazwy uczestnika', variant: 'destructive' });
      return;
    }
    const aliasErrors = activeDrafts.reduce<Record<string, string>>((accumulator, field) => {
      const error = validateRequired(field.alias, 'Alias jest wymagany.');
      if (error) accumulator[field.source_column_name] = error;
      return accumulator;
    }, {});
    if (Object.values(aliasErrors).some(Boolean)) {
      setMappingErrors({ aliases: aliasErrors });
      toast({ title: 'Uzupełnij aliasy aktywnych kolumn', variant: 'destructive' });
      return;
    }

    try {
      setMappingErrors({ aliases: {} });
      setRunningAction('confirm');
      await confirmParticipantImportMapping(eventId, {
        csv_columns: analysis.headers,
        email_column: selectedEmailColumn,
        fields: activeDrafts.map(field => ({
          source_column_name: field.source_column_name,
          alias: field.alias.trim(),
          field_role: field.field_role as Exclude<EditableFieldRole, 'ignore'>,
          is_active: true,
        })),
      });

      setRunningAction('run');
      const result = await runParticipantImport(eventId, csvContent);
      setSummary(result);
      setImportSuccessOpen(true);
      toast({ title: `Dodano ${result.created_count} uczestników` });
    } catch (error) {
      setMappingErrors({
        aliases: {},
        form: error instanceof Error ? error.message : 'Nie udało się zapisać mapowania lub zaimportować danych.',
      });
      toast({
        title: 'Import nie powiódł się',
        description: error instanceof Error ? error.message : 'Nie udało się zapisać mapowania lub zaimportować danych.',
        variant: 'destructive',
      });
    } finally {
      setRunningAction('');
    }
  };

  const handleRunExistingImport = async () => {
    try {
      setRunningAction('run');
      const result = await runParticipantImport(eventId, csvContent);
      setSummary(result);
      setImportSuccessOpen(true);
      toast({ title: `Dodano ${result.created_count} uczestników` });
    } catch (error) {
      toast({
        title: 'Import nie powiódł się',
        description: error instanceof Error ? error.message : 'Nie udało się zaimportować danych.',
        variant: 'destructive',
      });
    } finally {
      setRunningAction('');
    }
  };

  if (isLoading) return <TableSkeleton rows={5} cols={4} subtitle="" />;
  if (!event) return <div className="py-12 text-center text-muted-foreground">Nie znaleziono wydarzenia</div>;

  const importSuccessDescription = summary
    ? `Import uczestników zakończył się pomyślnie. Dodano ${summary.created_count} uczestników, pominięto ${summary.duplicate_count} duplikatów, a ${summary.invalid_count} wierszy oznaczono jako nieprawidłowe.`
    : '';

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="space-y-6">
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(buildEventPath(eventId))}
            className="w-fit touch-manipulation rounded-full px-1 text-[0.98rem] font-medium text-[hsl(var(--button-highlight))] hover:bg-transparent hover:text-[hsl(var(--button-highlight))]"
          >
            <ArrowLeft className="mr-1 h-4 w-4" /> Wróć do wydarzenia
          </Button>
        </div>
        <PageHeader
          title="Import CSV"
          description={
            <>
              <p>
                Wydarzenie: <span className="font-medium text-foreground">{event.name}</span>
              </p>
              <p className="mt-1 text-xs">
                Biuro zawodów: {formatEventOfficeWindow(event)}
              </p>
            </>
          }
        />
      </div>

      {!isOnline && (
        <OnlineOnlyNotice description="Analiza CSV, zapis mapowania i sam import wymagają aktywnego połączenia z serwerem. W trybie offline pozostaje tylko podgląd ostatnich danych." />
      )}

      <Card className="border-dashed">
        <CardContent className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">Załaduj plik CSV do analizy</p>
            <p className="mt-1 text-xs text-muted-foreground">
              System usunie puste kolumny, wykryje kolumny email i użyje zapisanego mapowania, jeśli już istnieje.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFilePicked} />
            <Button onClick={() => fileInputRef.current?.click()} disabled={runningAction === 'analyze' || !isOnline}>
              {runningAction === 'analyze' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileUp className="mr-1 h-4 w-4" />}
              Wybierz plik
            </Button>
            {fileName && <span className="max-w-52 truncate text-xs text-muted-foreground">{fileName}</span>}
          </div>
        </CardContent>
      </Card>

      {analysis && (
        <>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <CardTitle className="text-base">Kolumny email</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Wykryto {analysis.headers.length} kolumn i {analysis.row_count} wierszy.
                </p>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="border-border/60 bg-muted/30 px-4 py-3 [&>svg]:left-3 [&>svg]:top-3 [&>svg~*]:pl-8">
                <Info className="h-4 w-4" />
                <AlertTitle className="text-sm">Jak wybrać kolumnę email</AlertTitle>
                <AlertDescription className="text-xs text-muted-foreground">
                  Wskaż kolumnę z adresem email uczestnika. Ta wartość służy do rozpoznania osoby i ograniczania duplikatów podczas importu.
                </AlertDescription>
              </Alert>

              <div className="flex flex-wrap gap-2">
                {analysis.email_candidates.map(candidate => (
                  <Badge key={candidate.column} variant="secondary" className="gap-1 rounded-full px-3 py-1">
                    <Mail className="h-3 w-3" /> {candidate.column} ({candidate.matched_count})
                  </Badge>
                ))}
              </div>

              {!analysis.has_mapping && multipleEmailCandidates && (
                <div className="max-w-md space-y-2">
                  <Label htmlFor="csv-email-column">Wybierz kolumnę z emailem uczestnika</Label>
                  <Select
                    value={selectedEmailColumn}
                    onValueChange={value => {
                      setSelectedEmailColumn(value);
                      setMappingErrors(prev => ({ ...prev, emailColumn: undefined, form: undefined }));
                    }}
                  >
                    <SelectTrigger
                      id="csv-email-column"
                      className="h-10"
                      aria-invalid={Boolean(mappingErrors.emailColumn)}
                      aria-describedby={mappingErrors.emailColumn ? 'csv-email-column-error' : undefined}
                    >
                      <SelectValue placeholder="Wybierz kolumnę email" />
                    </SelectTrigger>
                    <SelectContent>
                      {analysis.email_candidates.map(candidate => (
                        <SelectItem key={candidate.column} value={candidate.column}>{candidate.column}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError id="csv-email-column-error">{mappingErrors.emailColumn}</FieldError>
                </div>
              )}

              {!analysis.has_mapping && !multipleEmailCandidates && selectedEmailColumn && (
                <p className="text-sm text-muted-foreground">
                  Kolumna email została wybrana automatycznie: <span className="font-medium text-foreground">{selectedEmailColumn}</span>
                </p>
              )}
            </CardContent>
          </Card>

          {!shouldWaitForEmailSelection && !analysis.has_mapping && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Mapowanie kolumn</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-border/60 bg-muted/20 px-4 py-3">
                  <p className="text-sm font-medium">Legenda ról</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-md border border-sky-400/50 bg-sky-500/10 px-3 py-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Część nazwy</p>
                      <p className="mt-1 text-xs text-muted-foreground">Buduje nazwę uczestnika (zazwyczaj kolumny imię i nazwisko). Wybierz co najmniej jedną taką kolumnę.</p>
                    </div>
                    <div className="rounded-md border border-amber-400/50 bg-amber-500/10 px-3 py-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Numer startowy</p>
                      <p className="mt-1 text-xs text-muted-foreground">Mapuje kolumnę z numerem startowym, jeśli występuje w pliku. Tę rolę można przypisać tylko jednej kolumnie.</p>
                    </div>
                    <div className="rounded-md border border-rose-400/50 bg-rose-500/10 px-3 py-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Ważne dane</p>
                      <p className="mt-1 text-xs text-muted-foreground">Wyróżnia dodatkowe informacje, które będą szczególnie widoczne podczas odprawy uczestnika.</p>
                    </div>
                    <div className="rounded-md border border-border/60 bg-background/70 px-3 py-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Pole własne / Ignoruj</p>
                      <p className="mt-1 text-xs text-muted-foreground">Pole własne zapisuje dodatkową wartość w sekcji pozostałych danych. Ignoruj całkowicie pomija kolumnę.</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {mappingDrafts.map((field, index) => (
                    <div
                      key={field.source_column_name}
                      className={getMappingFieldCardClassName(field.field_role)}
                    >
                      <div className="grid gap-3 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.95fr)_220px] md:items-end">
                        <div className="space-y-1.5">
                          <Label htmlFor={`csv-source-column-${index}`}>Kolumna CSV</Label>
                          <Input
                            id={`csv-source-column-${index}`}
                            value={field.source_column_name}
                            disabled
                            className="h-9 bg-muted/40"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`csv-alias-${index}`}>Alias w systemie</Label>
                          <Input
                            id={`csv-alias-${index}`}
                            value={field.alias}
                            onChange={eventValue => handleFieldChange(field.source_column_name, { alias: eventValue.target.value })}
                            className="h-9"
                            required={field.field_role !== 'ignore'}
                            aria-invalid={Boolean(mappingErrors.aliases[field.source_column_name])}
                            aria-describedby={mappingErrors.aliases[field.source_column_name] ? `csv-alias-${index}-error` : undefined}
                          />
                          <FieldError id={`csv-alias-${index}-error`}>{mappingErrors.aliases[field.source_column_name]}</FieldError>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`csv-role-${index}`}>Rola</Label>
                          <Select
                            value={field.field_role}
                            onValueChange={value => handleFieldChange(field.source_column_name, { field_role: value as EditableFieldRole })}
                          >
                            <SelectTrigger id={`csv-role-${index}`} className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ignore">Ignoruj</SelectItem>
                              <SelectItem value="display_name_part">Część nazwy</SelectItem>
                              <SelectItem value="bib_number" disabled={Boolean(bibNumberColumn && bibNumberColumn !== field.source_column_name)}>
                                Numer startowy
                              </SelectItem>
                              <SelectItem value="important_custom">Ważne dane</SelectItem>
                              <SelectItem value="custom">Pole własne</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <FieldError id="csv-mapping-form-error">{mappingErrors.form}</FieldError>
              </CardContent>
            </Card>
          )}

          {!shouldWaitForEmailSelection && analysis.has_mapping && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Dopasowanie mapowania do pliku</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {analysis.missing_required_columns.length > 0 ? (
                  <p className="text-sm text-destructive">
                    Plik nie zawiera wymaganych kolumn z zapisanego mapowania: {analysis.missing_required_columns.join(', ')}.
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Ten plik pasuje do zapisanego mapowania i może zostać zaimportowany bez ponownej konfiguracji.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {!shouldWaitForEmailSelection && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Podgląd danych (5 pierwszych wierszy)</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {previewHeaders.map(header => (
                        <TableHead key={header}>{previewHeaderLabels.get(header) ?? header}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analysis.sample_rows.map((row, index) => (
                      <TableRow key={index}>
                        {previewHeaders.map(header => (
                          <TableCell key={`${index}-${header}`}>{row[header] || <span className="text-muted-foreground">-</span>}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {!shouldWaitForEmailSelection && (
            <div className="flex flex-wrap gap-3">
              {!analysis.has_mapping && (
                <Button onClick={handleSaveMappingAndImport} disabled={runningAction === 'confirm' || runningAction === 'run' || !isOnline}>
                  {(runningAction === 'confirm' || runningAction === 'run') ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}
                  Zapisz mapowanie i importuj
                </Button>
              )}
              {analysis.has_mapping && (
                <Button onClick={handleRunExistingImport} disabled={!canRunWithSavedMapping || runningAction === 'run' || !isOnline}>
                  {runningAction === 'run' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-1 h-4 w-4" />}
                  Importuj z zapisanym mapowaniem
                </Button>
              )}
            </div>
          )}

          {summary && (
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="text-base">Podsumowanie importu</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>Dodano: <span className="font-semibold">{summary.created_count}</span></p>
                <p>Pominięto jako duplikaty: <span className="font-semibold">{summary.duplicate_count}</span></p>
                <p>Pominięto jako błędne: <span className="font-semibold">{summary.invalid_count}</span></p>
                {summary.invalid_rows.length > 0 && (
                  <p>Wiersze błędne: <span className="font-semibold">{summary.invalid_rows.join(', ')}</span></p>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      <SuccessActionDialog
        open={importSuccessOpen}
        onOpenChange={setImportSuccessOpen}
        title="Import CSV zakończony pomyślnie"
        description={importSuccessDescription}
        primaryLabel="Przejdź do wydarzenia"
        secondaryLabel="Zostań na tej stronie"
        onPrimaryAction={() => {
          setImportSuccessOpen(false);
          navigate(buildEventPath(eventId));
        }}
        onSecondaryAction={() => setImportSuccessOpen(false)}
      />
    </div>
  );
}
