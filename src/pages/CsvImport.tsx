import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useData } from '@/contexts/DataContext';
import { useRouteEventContext } from '@/hooks/use-route-event-context';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FieldError } from '@/components/ui/field-error';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertTriangle, ArrowLeft, Check, ChevronDown, FileUp, Info, Loader2, RefreshCcw, Sparkles } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import TableSkeleton from '@/components/skeletons/TableSkeleton';
import { formatEventOfficeWindow } from '@/lib/events';
import { validateRequired } from '@/lib/form-validation';
import { OnlineOnlyNotice } from '@/components/OnlineOnlyNotice';
import { buildEventImportSummaryPath, buildEventPath } from '@/lib/routes';
import { PageHeader } from '@/components/PageHeader';
import { formatParticipantCount } from '@/lib/participants';

type EditableFieldRole = 'ignore' | 'display_name_part' | 'bib_number' | 'custom' | 'important_custom';

interface MappingDraft {
  source_column_name: string;
  alias: string;
  field_role: EditableFieldRole;
}

interface MappingPreviewField {
  source_column_name?: string;
  label: string;
  value: string;
  role: EditableFieldRole | 'email';
}

const IMPORTANT_FIELDS_WARNING_LIMIT = 5;

function getSampleCellValue(sampleRow: Record<string, string> | undefined, columnName: string): string {
  return sampleRow?.[columnName]?.trim() || 'Brak danych w podglądzie';
}

function getPreviewFieldRoleLabel(role: MappingPreviewField['role']): string {
  switch (role) {
    case 'email':
      return 'Email';
    case 'display_name_part':
      return 'Imię i Nazwisko';
    case 'bib_number':
      return 'Numer startowy';
    case 'important_custom':
      return 'Wyróżnij przy odprawie';
    case 'ignore':
      return 'Ignoruj';
    case 'custom':
    default:
      return 'Pole własne';
  }
}

function getPreviewRoleBadgeClassName(role: MappingPreviewField['role']): string {
  switch (role) {
    case 'important_custom':
      return 'border-destructive/35 bg-destructive/10 text-muted-foreground';
    case 'bib_number':
      return 'border-amber-400/60 bg-amber-500/10 text-amber-700';
    case 'display_name_part':
      return 'border-sky-400/60 bg-sky-500/10 text-sky-700';
    case 'ignore':
      return 'border-border/60 bg-muted/60 text-muted-foreground';
    case 'email':
    case 'custom':
    default:
      return 'border-border/60 bg-background/70 text-muted-foreground';
  }
}

function formatAddedParticipantsToast(count: number): string {
  return count === 0 ? 'nie dodano żadnych uczestników' : `dodano ${formatParticipantCount(count)}`;
}

function getMappingFieldCardClassName(fieldRole: EditableFieldRole): string {
  switch (fieldRole) {
    case 'bib_number':
      return 'rounded-lg border border-amber-400/70 bg-amber-500/10 p-3 shadow-[inset_0_0_0_1px_rgba(251,191,36,0.18)]';
    case 'display_name_part':
      return 'rounded-lg border border-sky-400/70 bg-sky-500/10 p-3 shadow-[inset_0_0_0_1px_rgba(56,189,248,0.16)]';
    case 'important_custom':
      return 'rounded-lg border border-destructive/45 bg-destructive/10 p-3 shadow-[inset_0_0_0_1px_hsl(var(--destructive)/0.14)]';
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

function parseCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"') {
      if (quoted && nextChar === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (char === delimiter && !quoted) {
      cells.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
}

function detectCsvDelimiter(lines: string[]): string {
  const candidates = [';', ',', '\t'];
  const sampleLines = lines.slice(0, 10);

  return candidates
    .map(delimiter => ({
      delimiter,
      score: sampleLines.reduce((sum, line) => sum + Math.max(0, parseCsvLine(line, delimiter).length - 1), 0),
    }))
    .sort((left, right) => right.score - left.score)[0]?.delimiter ?? ';';
}

function parseCsvRows(csvContent: string, headers: string[]): Record<string, string>[] {
  const lines = csvContent
    .replace(/^\uFEFF/, '')
    .split(/\r\n|\n|\r/)
    .filter(line => line.trim() !== '');

  if (lines.length < 2 || headers.length === 0) return [];

  const delimiter = detectCsvDelimiter(lines);

  return lines.slice(1).map(line => {
    const values = parseCsvLine(line, delimiter);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
  });
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
    replaceParticipantImport,
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
  const [runningAction, setRunningAction] = useState<'analyze' | 'confirm' | 'run' | 'replace' | ''>('');
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof runParticipantImport>> | null>(null);
  const [replacementPromptOpen, setReplacementPromptOpen] = useState(false);
  const [replacementMode, setReplacementMode] = useState(false);
  const [mappingErrors, setMappingErrors] = useState<{ emailColumn?: string; aliases: Record<string, string>; form?: string }>({ aliases: {} });
  const isOnline = connectionState === 'online';

  useRouteEventContext(routeEventId);

  useEffect(() => {
    if (!analysis || (analysis.has_mapping && !replacementMode)) {
      setMappingDrafts([]);
      return;
    }

    const savedEmailMapping = analysis.mappings.find(mapping => mapping.field_role === 'email');
    const savedEmailColumn = savedEmailMapping && analysis.headers.includes(savedEmailMapping.source_column_name)
      ? savedEmailMapping.source_column_name
      : '';
    const autoEmailColumn = savedEmailColumn || (analysis.email_candidates.length === 1 ? analysis.email_candidates[0].column : selectedEmailColumn);
    setSelectedEmailColumn(autoEmailColumn);
    setMappingDrafts(
      analysis.headers
        .filter(header => header !== autoEmailColumn)
        .map(header => {
          const savedMapping = analysis.mappings.find(mapping => mapping.source_column_name === header && mapping.field_role !== 'email');
          return {
            source_column_name: header,
            alias: savedMapping?.alias ?? header,
            field_role: (savedMapping?.field_role as EditableFieldRole | undefined) ?? 'custom',
          };
        }),
    );
  }, [analysis, replacementMode, selectedEmailColumn]);

  const emailCandidatesCount = analysis?.email_candidates.length ?? 0;
  const multipleEmailCandidates = emailCandidatesCount > 1;
  const hasAutoResolvableEmailColumn = emailCandidatesCount === 1;
  const canRunWithSavedMapping = !!analysis?.has_mapping && (analysis.missing_required_columns?.length ?? 0) === 0;
  const displayNamePartsCount = mappingDrafts.filter(field => field.field_role === 'display_name_part').length;
  const isEditingMapping = Boolean(analysis && (!analysis.has_mapping || replacementMode));
  const shouldWaitForEmailSelection = isEditingMapping && !selectedEmailColumn && !hasAutoResolvableEmailColumn;
  const shouldShowEmailColumnStep = isEditingMapping && (multipleEmailCandidates || (!selectedEmailColumn && !hasAutoResolvableEmailColumn));
  const bibNumberColumn = mappingDrafts.find(field => field.field_role === 'bib_number')?.source_column_name ?? null;
  const mappedBibNumberColumn = isEditingMapping
    ? bibNumberColumn
    : (analysis?.mappings.find(mapping => mapping.field_role === 'bib_number')?.source_column_name ?? null);
  const shouldShowMissingBibNumberNotice = Boolean(analysis && !shouldWaitForEmailSelection && !mappedBibNumberColumn);

  const activeDrafts = useMemo(() => mappingDrafts.filter(field => field.field_role !== 'ignore'), [mappingDrafts]);
  const highlightedDrafts = useMemo(() => mappingDrafts.filter(field => field.field_role === 'important_custom'), [mappingDrafts]);
  const samplePreviewRow = analysis?.sample_rows[0];
  const verificationPreviewFields = useMemo<MappingPreviewField[]>(() => {
    if (!analysis) return [];

    const fields: MappingPreviewField[] = [];
    if (selectedEmailColumn) {
      fields.push({
        source_column_name: selectedEmailColumn,
        label: 'Email',
        value: getSampleCellValue(samplePreviewRow, selectedEmailColumn),
        role: 'email',
      });
    }

    for (const field of mappingDrafts) {
      if (!['display_name_part', 'bib_number', 'important_custom'].includes(field.field_role)) continue;
      fields.push({
        source_column_name: field.source_column_name,
        label: field.alias.trim() || field.source_column_name,
        value: getSampleCellValue(samplePreviewRow, field.source_column_name),
        role: field.field_role,
      });
    }

    return fields;
  }, [analysis, mappingDrafts, samplePreviewRow, selectedEmailColumn]);
  const additionalPreviewFields = useMemo<MappingPreviewField[]>(() => {
    if (!analysis) return [];

    return mappingDrafts
      .filter(field => field.field_role === 'custom')
      .map(field => ({
        source_column_name: field.source_column_name,
        label: field.alias.trim() || field.source_column_name,
        value: getSampleCellValue(samplePreviewRow, field.source_column_name),
        role: field.field_role,
      }));
  }, [analysis, mappingDrafts, samplePreviewRow]);
  const ignoredPreviewFields = useMemo<MappingPreviewField[]>(() => {
    if (!analysis) return [];

    return mappingDrafts
      .filter(field => field.field_role === 'ignore')
      .map(field => ({
        source_column_name: field.source_column_name,
        label: field.alias.trim() || field.source_column_name,
        value: getSampleCellValue(samplePreviewRow, field.source_column_name),
        role: field.field_role,
      }));
  }, [analysis, mappingDrafts, samplePreviewRow]);
  const previewHeaderLabels = useMemo(() => {
    if (!analysis || (analysis.has_mapping && !replacementMode)) {
      return new Map<string, string>();
    }

    return new Map(
      mappingDrafts.map(field => [
        field.source_column_name,
        field.alias.trim() || field.source_column_name,
      ]),
    );
  }, [analysis, mappingDrafts, replacementMode]);
  const previewHeaders = useMemo(() => {
    if (!analysis) return [];
    if (analysis.has_mapping && !replacementMode) return analysis.headers;

    return analysis.headers.filter(header => {
      if (header === selectedEmailColumn) return true;
      const matchingDraft = mappingDrafts.find(field => field.source_column_name === header);
      return matchingDraft ? matchingDraft.field_role !== 'ignore' : true;
    });
  }, [analysis, mappingDrafts, replacementMode, selectedEmailColumn]);

  const handleFilePicked = async (eventValue: ChangeEvent<HTMLInputElement>) => {
    const file = eventValue.target.files?.[0];
    if (!file) return;

    const text = decodeCsvFile(await file.arrayBuffer());
    setFileName(file.name);
    setCsvContent(text);
    setSummary(null);
    setMappingErrors({ aliases: {} });
    setSelectedEmailColumn('');
    setReplacementMode(false);
    setReplacementPromptOpen(false);

    try {
      setRunningAction('analyze');
      const result = await analyzeParticipantImport(eventId, text);
      setAnalysis(result);
      setReplacementPromptOpen(Boolean(result.list_difference?.should_offer_replacement));
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

  const handlePreviewFieldRoleChange = (field: MappingPreviewField, role: EditableFieldRole) => {
    if (!field.source_column_name || field.role === 'email') return;
    if (role === 'bib_number' && bibNumberColumn && bibNumberColumn !== field.source_column_name) return;

    handleFieldChange(field.source_column_name, { field_role: role });
  };

  const renderPreviewFieldTile = (field: MappingPreviewField, previewArea: 'verification' | 'additional' | 'ignored') => {
    const isEmail = field.role === 'email';
    const isHighlighted = field.role === 'important_custom';
    const isIgnored = field.role === 'ignore';
    const tileClassName = `w-full rounded-md border px-3 py-2 text-left transition ${
      isHighlighted
        ? 'border-destructive/45 bg-destructive/10 hover:bg-destructive/15'
        : isIgnored
          ? 'border-border/50 bg-background/50 opacity-75 hover:opacity-100'
          : 'border-border/60 bg-background/70 hover:bg-background/90'
    }`;
    const roleOptions: Array<{ value: EditableFieldRole; label: string }> = [
      { value: 'important_custom', label: 'Wyróżnij przy odprawie' },
      { value: 'custom', label: 'Pole własne' },
      { value: 'display_name_part', label: 'Imię i Nazwisko' },
      { value: 'bib_number', label: 'Numer startowy' },
      { value: 'ignore', label: 'Ignoruj' },
    ];

    return (
      <Popover key={`${previewArea}-${field.role}-${field.source_column_name ?? field.label}`}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={tileClassName}
            aria-label={isEmail ? `Kolumna ${field.label}` : `Zmień typ kolumny ${field.label}`}
          >
            <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{field.label}</span>
            <span className="mt-1 block break-words text-sm font-medium text-foreground">{field.value}</span>
            <span className={`mt-2 inline-flex max-w-full rounded-lg border px-2.5 py-1 text-[11px] font-medium leading-tight ${getPreviewRoleBadgeClassName(field.role)}`}>
              {getPreviewFieldRoleLabel(field.role)}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="center"
          side="bottom"
          sideOffset={8}
          collisionPadding={12}
          className="max-h-[min(22rem,calc(100vh-2rem))] w-[min(18rem,calc(100vw-2rem))] overflow-y-auto p-2"
        >
          <div className="space-y-2">
            <div className="px-2 pb-1 pt-1">
              <p className="text-sm font-semibold">{field.label}</p>
              <p className="mt-0.5 line-clamp-2 break-words text-xs text-muted-foreground">
                {isEmail
                  ? 'Kolumna email służy do rozpoznania uczestnika. Zmień ją w sekcji wyboru kolumny email.'
                  : field.value}
              </p>
            </div>
            {!isEmail && (
              <div className="space-y-1">
                {roleOptions.map(option => {
                  const isCurrentRole = field.role === option.value;
                  const isBibNumberBlocked = option.value === 'bib_number' && Boolean(bibNumberColumn && bibNumberColumn !== field.source_column_name);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={`flex w-full items-center justify-between gap-2 rounded-md border px-2.5 py-2 text-left text-sm transition ${
                        isCurrentRole
                          ? 'border-primary/50 bg-primary/10'
                          : 'border-border/60 bg-background/70 hover:bg-muted/50'
                      } ${isBibNumberBlocked ? 'cursor-not-allowed opacity-50' : ''}`}
                      disabled={isBibNumberBlocked}
                      onClick={() => handlePreviewFieldRoleChange(field, option.value)}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-foreground">{option.label}</span>
                        {isBibNumberBlocked && (
                          <span className="block truncate text-xs text-muted-foreground">Już przypisany</span>
                        )}
                      </span>
                      {isCurrentRole && <Check className="h-4 w-4 shrink-0 text-primary" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  const buildMappingPayload = () => {
    if (!analysis) return null;

    return {
      csv_columns: analysis.headers,
      email_column: selectedEmailColumn,
      fields: activeDrafts.map(field => ({
        source_column_name: field.source_column_name,
        alias: field.alias.trim(),
        field_role: field.field_role as Exclude<EditableFieldRole, 'ignore'>,
        is_active: true,
      })),
    };
  };

  const navigateToImportSummary = (
    result: Awaited<ReturnType<typeof runParticipantImport>>,
    mode: 'append' | 'replace',
  ) => {
    const emailColumn = selectedEmailColumn || analysis?.mappings.find(mapping => mapping.field_role === 'email')?.source_column_name || '';

    navigate(buildEventImportSummaryPath(eventId), {
      state: {
        summary: result,
        headers: analysis?.headers ?? [],
        sourceRows: analysis ? parseCsvRows(csvContent, analysis.headers) : [],
        emailColumn,
        fileName,
        importedAt: new Date().toISOString(),
        mode,
      },
    });
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
      const mappingPayload = buildMappingPayload();
      if (!mappingPayload) return;

      if (replacementMode) {
        setRunningAction('replace');
        const result = await replaceParticipantImport(eventId, csvContent, mappingPayload, (analysis.sent_qr_email_count ?? 0) > 0);
        setSummary(result);
        navigateToImportSummary(result, 'replace');
        toast({ title: `Podmieniono listę i ${formatAddedParticipantsToast(result.created_count)}` });
        return;
      }

      setRunningAction('confirm');
      await confirmParticipantImportMapping(eventId, mappingPayload);

      setRunningAction('run');
      const result = await runParticipantImport(eventId, csvContent);
      setSummary(result);
      navigateToImportSummary(result, 'append');
      toast({ title: result.created_count === 0 ? 'Nie dodano żadnych uczestników' : `Dodano ${formatParticipantCount(result.created_count)}` });
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
      navigateToImportSummary(result, 'append');
      toast({ title: result.created_count === 0 ? 'Nie dodano żadnych uczestników' : `Dodano ${formatParticipantCount(result.created_count)}` });
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

  const participantDifferencePercent = Math.round(((analysis?.list_difference?.participant_difference_ratio ?? 0) * 100));
  const hasSentQrEmails = (analysis?.sent_qr_email_count ?? 0) > 0;

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

      {replacementMode && analysis && (
        <Alert className="border-destructive/40 bg-destructive/10 px-4 py-3 [&>svg]:left-3 [&>svg]:top-3 [&>svg~*]:pl-8">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <AlertTitle className="text-sm">Podmieniasz całą listę uczestników</AlertTitle>
          <AlertDescription className="text-xs text-muted-foreground">
            Import usunie obecną listę uczestników razem z mapowaniem i zapisze ten plik jako nową listę bazową wydarzenia.
            {hasSentQrEmails ? ' Dla tego wydarzenia wysłano już kody QR, więc to ryzykowna operacja.' : ''}
          </AlertDescription>
        </Alert>
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
          {shouldShowEmailColumnStep && (
            <Card className={emailCandidatesCount === 0 ? 'border-destructive/40' : undefined}>
              <CardHeader className="pb-2">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="text-base">Wybierz kolumnę email</CardTitle>
                  {emailCandidatesCount > 0 && (
                    <p className="text-xs text-muted-foreground">{emailCandidatesCount} kandydatów</p>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {emailCandidatesCount === 0 ? (
                  <Alert variant="destructive" className="px-4 py-3">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle className="text-sm">Nie wykryto kolumny email</AlertTitle>
                    <AlertDescription className="text-xs">
                      Import wymaga kolumny z adresem email uczestnika.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <>
                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(14rem,18rem)] md:items-end">
                      <p className="text-sm text-muted-foreground">
                        W pliku znaleziono kilka możliwych kolumn. Wybierz email uczestnika, bo ta wartość rozpoznaje osobę przy imporcie.
                      </p>
                      <div className="space-y-1.5">
                        <Label htmlFor="csv-email-column">Kolumna email</Label>
                        <Select
                          value={selectedEmailColumn}
                          onValueChange={value => {
                            setSelectedEmailColumn(value);
                            setMappingErrors(prev => ({ ...prev, emailColumn: undefined, form: undefined }));
                          }}
                        >
                          <SelectTrigger
                            id="csv-email-column"
                            className="h-9"
                            aria-invalid={Boolean(mappingErrors.emailColumn)}
                            aria-describedby={mappingErrors.emailColumn ? 'csv-email-column-error' : undefined}
                          >
                            <SelectValue placeholder="Wybierz kolumnę" />
                          </SelectTrigger>
                          <SelectContent>
                            {analysis.email_candidates.map(candidate => (
                              <SelectItem key={candidate.column} value={candidate.column}>
                                {candidate.column} ({candidate.matched_count})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FieldError id="csv-email-column-error">{mappingErrors.emailColumn}</FieldError>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {!shouldWaitForEmailSelection && isEditingMapping && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle className="text-base">Mapowanie kolumn</CardTitle>
                    {selectedEmailColumn && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Email: <span className="font-medium text-foreground">{selectedEmailColumn}</span>
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {analysis.headers.length} kolumn, {analysis.row_count} wierszy
                  </p>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-border/60 bg-muted/20 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">Legenda ról</p>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
                          aria-label="Co się stanie z kolumną"
                        >
                          <Info className="h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-[min(28rem,calc(100vw-2rem))] p-0">
                        <div className="border-b px-4 py-3">
                          <p className="text-sm font-semibold">Co się stanie z kolumną</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Każdą kolumnę możesz zapisać w innym miejscu albo pominąć.
                          </p>
                        </div>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[180px]">Wybór</TableHead>
                              <TableHead>Efekt</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            <TableRow>
                              <TableCell className="font-medium">Wyróżnij przy odprawie</TableCell>
                              <TableCell className="text-muted-foreground">Dane zostaną zaimportowane i pokazane wysoko w sekcji danych do weryfikacji.</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell className="font-medium">Pole własne</TableCell>
                              <TableCell className="text-muted-foreground">Dane zostaną zaimportowane, ale trafią niżej do pozostałych danych uczestnika.</TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell className="font-medium">Ignoruj</TableCell>
                              <TableCell className="text-muted-foreground">Kolumna nie zostanie zapisana przy uczestniku.</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-md border border-sky-400/50 bg-sky-500/10 px-3 py-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Imię i Nazwisko</p>
                      <p className="mt-1 text-xs text-muted-foreground">Buduje nazwę uczestnika (zazwyczaj kolumny imię i nazwisko). Wybierz co najmniej jedną taką kolumnę.</p>
                    </div>
                    <div className="rounded-md border border-amber-400/50 bg-amber-500/10 px-3 py-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Numer startowy</p>
                      <p className="mt-1 text-xs text-muted-foreground">Mapuje kolumnę z numerem startowym, jeśli występuje w pliku. Tę rolę można przypisać tylko jednej kolumnie.</p>
                    </div>
                    <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Wyróżnij przy odprawie</p>
                      <p className="mt-1 text-xs text-muted-foreground">Wybierz tylko informacje, które operator musi szybko zobaczyć przy skanowaniu.</p>
                    </div>
                    <div className="rounded-md border border-border/60 bg-background/70 px-3 py-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Pole własne / Ignoruj</p>
                      <p className="mt-1 text-xs text-muted-foreground">Pole własne zapisuje dodatkową wartość w sekcji pozostałych danych. Ignoruj całkowicie pomija kolumnę.</p>
                    </div>
                  </div>
                </div>

                {highlightedDrafts.length > IMPORTANT_FIELDS_WARNING_LIMIT && (
                  <Alert variant="default" className="border-amber-400/50 bg-amber-500/10">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Wybrano dużo danych do wyróżnienia</AlertTitle>
                    <AlertDescription>
                      Przy odprawie najlepiej działa kilka najważniejszych informacji. Pozostałe kolumny nadal możesz zapisać jako pole własne.
                    </AlertDescription>
                  </Alert>
                )}

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
                              <SelectItem value="display_name_part">Imię i Nazwisko</SelectItem>
                              <SelectItem value="bib_number" disabled={Boolean(bibNumberColumn && bibNumberColumn !== field.source_column_name)}>
                                Numer startowy
                              </SelectItem>
                              <SelectItem value="important_custom">Wyróżnij przy odprawie</SelectItem>
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

          {!shouldWaitForEmailSelection && isEditingMapping && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Podgląd uczestnika po imporcie</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 p-4">
                  <p className="text-sm font-semibold text-foreground">Dane do weryfikacji przy odprawie</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Tu trafią dane wyróżnione oraz podstawowe informacje potrzebne przy obsłudze uczestnika.
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {verificationPreviewFields.length > 0 ? verificationPreviewFields.map(field => renderPreviewFieldTile(field, 'verification')) : (
                      <p className="rounded-md border border-dashed bg-background/60 px-3 py-4 text-sm text-muted-foreground sm:col-span-2">
                        Wybierz kolumny, żeby zobaczyć podgląd danych do weryfikacji.
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
                  <p className="text-sm font-semibold text-foreground">Pozostałe dane uczestnika</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Tu trafią pola własne: również są widoczne podczas odprawy, jednak nie są tak wyróżnione jak dane z poprzedniej sekcji. Ignorowane kolumny nie będą tu widoczne wcale.
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {additionalPreviewFields.length > 0 ? additionalPreviewFields.map(field => renderPreviewFieldTile(field, 'additional')) : (
                      <p className="rounded-md border border-dashed bg-background/60 px-3 py-4 text-sm text-muted-foreground sm:col-span-2">
                        Nie wybrano jeszcze pól własnych do pokazania w tej sekcji.
                      </p>
                    )}
                  </div>
                </div>

                <Collapsible className="lg:col-span-2">
                  <div className="rounded-lg border border-border/60 bg-muted/10">
                    <CollapsibleTrigger asChild>
                      <Button type="button" variant="ghost" className="flex w-full justify-between rounded-lg px-4 py-3 text-left whitespace-normal">
                        <span>
                          <span className="block text-sm font-semibold text-foreground">Ignorowane pola</span>
                          <span className="mt-1 block text-xs text-muted-foreground">
                            {ignoredPreviewFields.length > 0
                              ? `${ignoredPreviewFields.length} kolumn nie zostanie zapisanych przy uczestniku.`
                              : 'Żadna kolumna nie jest teraz ignorowana.'}
                          </span>
                        </span>
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="grid gap-2 border-t border-border/60 p-4 sm:grid-cols-2 lg:grid-cols-3">
                        {ignoredPreviewFields.length > 0 ? ignoredPreviewFields.map(field => renderPreviewFieldTile(field, 'ignored')) : (
                          <p className="rounded-md border border-dashed bg-background/60 px-3 py-4 text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
                            Jeśli ustawisz kolumnę jako ignorowaną, pojawi się tutaj i nadal będzie można zmienić jej typ przed importem.
                          </p>
                        )}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              </CardContent>
            </Card>
          )}

          {!shouldWaitForEmailSelection && analysis.has_mapping && !replacementMode && (
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
            <div className="space-y-3">
              {shouldShowMissingBibNumberNotice && (
                <Alert className="border-amber-400/50 bg-amber-500/10">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Nie wybrano pola „Numer startowy”</AlertTitle>
                  <AlertDescription>
                    Jeśli w pliku jest kolumna z numerem startowym, uczestnicy zostaną zaimportowani z pustym numerem startowym.
                    Numer będzie można nadać później, ale ręcznie dla każdego uczestnika osobno.
                  </AlertDescription>
                </Alert>
              )}
              <div className="flex flex-wrap gap-3">
                {isEditingMapping && (
                  <Button onClick={() => handleSaveMappingAndImport()} disabled={runningAction === 'confirm' || runningAction === 'run' || runningAction === 'replace' || !isOnline}>
                    {(runningAction === 'confirm' || runningAction === 'run' || runningAction === 'replace') ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}
                    {replacementMode ? 'Usuń starą listę i importuj nową' : 'Zapisz mapowanie i importuj'}
                  </Button>
                )}
                {analysis.has_mapping && !replacementMode && (
                  <Button onClick={() => handleRunExistingImport()} disabled={!canRunWithSavedMapping || runningAction === 'run' || !isOnline}>
                    {runningAction === 'run' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-1 h-4 w-4" />}
                    Importuj z zapisanym mapowaniem
                  </Button>
                )}
              </div>
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

      <AlertDialog open={replacementPromptOpen} onOpenChange={setReplacementPromptOpen}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Ten CSV wygląda jak inna lista</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Wykryto różnice między zapisaną listą a nowym plikiem.
              </span>
              {analysis?.list_difference?.columns_differ && (
                <span className="block">
                  Różnią się też kolumny CSV względem zapisanego mapowania.
                </span>
              )}
              {hasSentQrEmails && (
                <span className="block font-medium text-destructive">
                  Dla tego wydarzenia wysłano już maile z kodami QR. Usunięcie listy i wgranie nowej może unieważnić wysłane kody dla obecnych uczestników.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:flex sm:flex-col-reverse sm:gap-3">
            <AlertDialogCancel>Zostaw starą listę i dodaj z nowej listy</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setReplacementMode(true);
                setReplacementPromptOpen(false);
              }}
            >
              Usuń starą listę i zastąp nową listą
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
