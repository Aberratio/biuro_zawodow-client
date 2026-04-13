import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FieldError } from '@/components/ui/field-error';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, FileUp, Loader2, Mail, RefreshCcw, Sparkles } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import TableSkeleton from '@/components/skeletons/TableSkeleton';
import { formatEventOfficeWindow } from '@/lib/events';
import { validateRequired } from '@/lib/form-validation';
import { ParticipantFieldMapping } from '@/types';

type EditableFieldRole = 'ignore' | 'display_name_part' | 'bib_number' | 'custom';

interface MappingDraft {
  source_column_name: string;
  alias: string;
  field_role: EditableFieldRole;
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
  const { id: routeEventId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    events,
    selectedEventId,
    setSelectedEventId,
    analyzeParticipantImport,
    confirmParticipantImportMapping,
    runParticipantImport,
    getParticipantFieldMappings,
    isLoading,
  } = useData();
  const eventId = routeEventId ?? selectedEventId;
  const event = events.find(item => item.id === eventId);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [fileName, setFileName] = useState('');
  const [csvContent, setCsvContent] = useState('');
  const [analysis, setAnalysis] = useState<Awaited<ReturnType<typeof analyzeParticipantImport>> | null>(null);
  const [selectedEmailColumn, setSelectedEmailColumn] = useState('');
  const [mappingDrafts, setMappingDrafts] = useState<MappingDraft[]>([]);
  const [runningAction, setRunningAction] = useState<'analyze' | 'confirm' | 'run' | ''>('');
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof runParticipantImport>> | null>(null);
  const [mappingErrors, setMappingErrors] = useState<{ emailColumn?: string; aliases: Record<string, string>; form?: string }>({ aliases: {} });
  const [savedMappings, setSavedMappings] = useState<ParticipantFieldMapping[]>([]);
  const [savedMappingsLoading, setSavedMappingsLoading] = useState(false);

  useEffect(() => {
    if (routeEventId) {
      setSelectedEventId(routeEventId);
    }
  }, [routeEventId, setSelectedEventId]);

  useEffect(() => {
    if (!eventId) {
      setSavedMappings([]);
      return;
    }

    setSavedMappingsLoading(true);
    getParticipantFieldMappings(eventId)
      .then(data => setSavedMappings(data.filter(mapping => mapping.is_active)))
      .catch(() => setSavedMappings([]))
      .finally(() => setSavedMappingsLoading(false));
  }, [eventId, getParticipantFieldMappings]);

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
        }))
    );
  }, [analysis, selectedEmailColumn]);

  const multipleEmailCandidates = (analysis?.email_candidates.length ?? 0) > 1;
  const canRunWithSavedMapping = !!analysis?.has_mapping && (analysis.missing_required_columns?.length ?? 0) === 0;
  const displayNamePartsCount = mappingDrafts.filter(field => field.field_role === 'display_name_part').length;
  const hasSavedMapping = savedMappings.length > 0;

  const activeDrafts = useMemo(() => mappingDrafts.filter(field => field.field_role !== 'ignore'), [mappingDrafts]);
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
  if (!event) return <div className="text-center py-12 text-muted-foreground">Nie znaleziono wydarzenia</div>;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate(`/events/${eventId}`)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Wróć do wydarzenia
          </Button>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight mt-2">Import CSV</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Wydarzenie: <span className="font-medium text-foreground">{event.name}</span>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Biuro zawodów: {formatEventOfficeWindow(event)}
          </p>
        </div>
      </div>

      <Card className="border-dashed">
        <CardContent className="py-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium text-sm">Załaduj plik CSV do analizy</p>
            <p className="text-xs text-muted-foreground mt-1">
              System usunie puste kolumny, wykryje kolumny email i użyje zapisanego mapowania wydarzenia, jeśli już istnieje.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFilePicked} />
            <Button onClick={() => fileInputRef.current?.click()} disabled={runningAction === 'analyze'}>
              {runningAction === 'analyze' ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileUp className="h-4 w-4 mr-1" />}
              Wybierz plik
            </Button>
            {fileName && <span className="text-xs text-muted-foreground max-w-52 truncate">{fileName}</span>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mapowanie wydarzenia</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm">
            <span className="text-muted-foreground">Status: </span>
            <span className="font-medium">
              {savedMappingsLoading ? 'Ładowanie…' : hasSavedMapping ? 'Gotowe' : 'Brak zapisanego mapowania'}
            </span>
          </p>
          {hasSavedMapping && (
            <div className="flex flex-wrap gap-2">
              {savedMappings.map(mapping => (
                <Badge key={`${mapping.source_column_name}-${mapping.alias}`} variant="outline">
                  {mapping.source_column_name} → {mapping.alias} ({mapping.field_role})
                </Badge>
              ))}
            </div>
          )}
          {!savedMappingsLoading && !hasSavedMapping && (
            <p className="text-sm text-muted-foreground">
              Pierwszy import dla tego wydarzenia pozwoli zapisać mapowanie kolumn.
            </p>
          )}
        </CardContent>
      </Card>

      {analysis && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">Kolumny po czyszczeniu</p>
                <p className="text-2xl font-bold mt-1">{analysis.headers.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">Wiersze danych</p>
                <p className="text-2xl font-bold mt-1">{analysis.row_count}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">Tryb importu</p>
                <p className="text-sm font-semibold mt-2">{analysis.has_mapping ? 'Użycie zapisanego mapowania' : 'Pierwsze mapowanie dla wydarzenia'}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Kolumny email</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {analysis.email_candidates.map(candidate => (
                  <Badge key={candidate.column} variant="secondary" className="gap-1">
                    <Mail className="h-3 w-3" /> {candidate.column} ({candidate.matched_count})
                  </Badge>
                ))}
              </div>
              {!analysis.has_mapping && multipleEmailCandidates && (
                <div className="max-w-sm">
                  <Label htmlFor="csv-email-column">Wskaż kolumnę email użytkownika</Label>
                  <Select
                    value={selectedEmailColumn}
                    onValueChange={value => {
                      setSelectedEmailColumn(value);
                      setMappingErrors(prev => ({ ...prev, emailColumn: undefined, form: undefined }));
                    }}
                  >
                    <SelectTrigger
                      id="csv-email-column"
                      className="mt-2"
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
                  <FieldError id="csv-email-column-error" className="mt-2">{mappingErrors.emailColumn}</FieldError>
                </div>
              )}
              {!analysis.has_mapping && !multipleEmailCandidates && selectedEmailColumn && (
                <p className="text-sm text-muted-foreground">
                  Kolumna email została wybrana automatycznie: <span className="font-medium text-foreground">{selectedEmailColumn}</span>
                </p>
              )}
            </CardContent>
          </Card>

          {!analysis.has_mapping && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Mapowanie kolumn</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Dla każdej istotnej kolumny wpisz alias i przypisz rolę. Przynajmniej jedna kolumna musi budować nazwę uczestnika.
                </p>
                <div className="space-y-3">
                  {mappingDrafts.map((field, index) => (
                    <div key={field.source_column_name} className="grid gap-3 md:grid-cols-[1.2fr_1fr_1fr] items-end border rounded-lg p-3">
                      <div>
                        <Label htmlFor={`csv-source-column-${index}`}>Nazwa w CSV</Label>
                        <Input id={`csv-source-column-${index}`} value={field.source_column_name} disabled className="mt-2" />
                      </div>
                      <div>
                        <Label htmlFor={`csv-alias-${index}`}>Alias</Label>
                        <Input
                          id={`csv-alias-${index}`}
                          value={field.alias}
                          onChange={eventValue => handleFieldChange(field.source_column_name, { alias: eventValue.target.value })}
                          className="mt-2"
                          required={field.field_role !== 'ignore'}
                          aria-invalid={Boolean(mappingErrors.aliases[field.source_column_name])}
                          aria-describedby={mappingErrors.aliases[field.source_column_name] ? `csv-alias-${index}-error` : undefined}
                        />
                        <FieldError id={`csv-alias-${index}-error`} className="mt-2">{mappingErrors.aliases[field.source_column_name]}</FieldError>
                      </div>
                      <div>
                        <Label htmlFor={`csv-role-${index}`}>Rola</Label>
                        <Select
                          value={field.field_role}
                          onValueChange={value => handleFieldChange(field.source_column_name, { field_role: value as EditableFieldRole })}
                        >
                          <SelectTrigger id={`csv-role-${index}`} className="mt-2">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ignore">Ignoruj</SelectItem>
                            <SelectItem value="display_name_part">Część nazwy</SelectItem>
                            <SelectItem value="bib_number">Numer startowy</SelectItem>
                            <SelectItem value="custom">Pole własne</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>
                <FieldError id="csv-mapping-form-error">{mappingErrors.form}</FieldError>
              </CardContent>
            </Card>
          )}

          {analysis.has_mapping && (
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

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Podgląd danych</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {previewHeaders.map(header => (
                      <TableHead key={header}>{header}</TableHead>
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

          <div className="flex flex-wrap gap-3">
            {!analysis.has_mapping && (
              <Button onClick={handleSaveMappingAndImport} disabled={runningAction === 'confirm' || runningAction === 'run'}>
                {(runningAction === 'confirm' || runningAction === 'run') ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
                Zapisz mapowanie i importuj
              </Button>
            )}
            {analysis.has_mapping && (
              <Button onClick={handleRunExistingImport} disabled={!canRunWithSavedMapping || runningAction === 'run'}>
                {runningAction === 'run' ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCcw className="h-4 w-4 mr-1" />}
                Importuj z zapisanym mapowaniem
              </Button>
            )}
          </div>

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
    </div>
  );
}
