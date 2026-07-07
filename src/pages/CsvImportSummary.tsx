import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CheckCircle2, Download, FileWarning, Loader2, Pencil, RotateCcw, Trash2, UploadCloud } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FieldError } from '@/components/ui/field-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/PageHeader';
import { ParticipantFieldValueInput } from '@/components/ParticipantFieldValueInput';
import { buildEventImportPath, buildEventPath } from '@/lib/routes';
import TableSkeleton from '@/components/skeletons/TableSkeleton';
import { toast } from '@/hooks/use-toast';
import { formatParticipantCount } from '@/lib/participants';
import { PARTICIPANT_EMAIL_MAX_LENGTH, validateParticipantFieldValue } from '@/lib/participant-fields';
import { isValidEmailAddress } from '@/lib/form-validation';
import type { ParticipantFieldMapping } from '@/types';

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
  sourceRows?: Record<string, string>[];
  mappings?: ParticipantFieldMapping[];
  analysis?: {
    headers: string[];
    sample_rows: Record<string, string>[];
    email_candidates: { column: string; matched_count: number }[];
    has_mapping: boolean;
    has_baseline_import: boolean;
    mappings: ParticipantFieldMapping[];
    missing_required_columns: string[];
    row_count: number;
    existing_participant_count: number;
    sent_qr_email_count: number;
    list_difference: {
      columns_differ: boolean;
      missing_columns: string[];
      extra_columns: string[];
      participant_difference_ratio: number;
      should_offer_replacement: boolean;
    };
  };
  csvContent?: string;
  emailColumn?: string;
  fileName?: string;
  importedAt?: string;
  mode?: 'append' | 'replace';
}

type FieldValidationErrors = Record<string, string>;
type RowValidationErrors = Record<number, FieldValidationErrors>;

function getSourceRow(sourceRows: Record<string, string>[] | undefined, rowNumber: number): Record<string, string> {
  return sourceRows?.[rowNumber - 2] ?? {};
}

function getIssueRows(
  details: ImportRowIssue[] | undefined,
  rowNumbers: number[] | undefined,
  sourceRows?: Record<string, string>[],
): ImportRowIssue[] {
  if (details && details.length > 0) {
    return details.map(issue => ({
      ...issue,
      row: {
        ...getSourceRow(sourceRows, issue.row_number),
        ...(issue.row ?? {}),
      },
    }));
  }
  return (rowNumbers ?? []).map(rowNumber => ({
    row_number: rowNumber,
    reasons: ['Wiersz nie spełnił wymagań importu.'],
    row: getSourceRow(sourceRows, rowNumber),
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

function buildImportSuccessDescription(createdCount: number, mode: ImportSummaryState['mode']): string {
  const createdSentence = createdCount === 0
    ? 'Nie dodano żadnych uczestników.'
    : `Dodano ${formatParticipantCount(createdCount)}.`;

  if (mode === 'replace') {
    return `${createdSentence} Poprzednia lista została podmieniona.`;
  }

  if (createdCount === 0) {
    return `${createdSentence} Lista wydarzenia nie została uzupełniona nowymi rekordami.`;
  }

  return `${createdSentence} ${createdCount === 1 ? 'Nowy uczestnik został dopisany do wydarzenia.' : 'Nowi uczestnicy zostali dopisani do wydarzenia.'}`;
}

function findMappingForHeader(mappings: ParticipantFieldMapping[], header: string): ParticipantFieldMapping | undefined {
  return mappings.find(mapping => mapping.source_column_name === header && mapping.is_active);
}

function getIssueFieldErrors(
  issue: ImportRowIssue,
  headers: string[],
  mappings: ParticipantFieldMapping[],
  emailColumn: string,
): FieldValidationErrors {
  const errors: FieldValidationErrors = {};

  if (emailColumn) {
    const email = (issue.row?.[emailColumn] ?? '').trim();
    if (!email) {
      errors[emailColumn] = 'Podaj adres e-mail.';
    } else if (email.length > PARTICIPANT_EMAIL_MAX_LENGTH) {
      errors[emailColumn] = `Adres e-mail może mieć maksymalnie ${PARTICIPANT_EMAIL_MAX_LENGTH} znaków.`;
    } else if (!isValidEmailAddress(email)) {
      errors[emailColumn] = 'Podaj poprawny adres e-mail.';
    }
  }

  headers.forEach(header => {
    if (header === emailColumn) return;
    const mapping = findMappingForHeader(mappings, header);
    if (!mapping || mapping.field_role === 'email') return;

    const error = validateParticipantFieldValue(mapping, issue.row?.[header] ?? '');
    if (error) errors[header] = error;
  });

  return errors;
}

function getIssueReasonFieldHints(
  issue: ImportRowIssue,
  headers: string[],
  mappings: ParticipantFieldMapping[],
  emailColumn: string,
): FieldValidationErrors {
  const hints: FieldValidationErrors = {};
  const fieldNames = headers.map(header => ({
    header,
    matches: [
      header,
      findMappingForHeader(mappings, header)?.alias,
      header === emailColumn ? 'email' : '',
      header === emailColumn ? 'e-mail' : '',
    ].filter(Boolean).map(value => value.toLowerCase()),
  }));

  issue.reasons.forEach(reason => {
    const normalizedReason = reason.toLowerCase();
    const quotedValues = Array.from(reason.matchAll(/"([^"]+)"/g))
      .map(match => match[1]?.toLowerCase())
      .filter(Boolean);
    const matchingField = fieldNames.find(field => (
      field.matches.some(match => quotedValues.includes(match) || normalizedReason.includes(match))
    ));

    if (matchingField && !hints[matchingField.header]) {
      hints[matchingField.header] = reason;
    }
  });

  return hints;
}

function buildRowValidationErrors(
  issues: ImportRowIssue[],
  headers: string[],
  mappings: ParticipantFieldMapping[],
  emailColumn: string,
): RowValidationErrors {
  return issues.reduce<RowValidationErrors>((accumulator, issue) => {
    accumulator[issue.row_number] = getIssueFieldErrors(issue, headers, mappings, emailColumn);
    return accumulator;
  }, {});
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
  onFieldChange,
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
  onFieldChange?: (rowNumber: number, header: string, value: string) => void;
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
                    <TableCell key={`${issue.row_number}-${header}`} className="max-w-[18rem] align-top">
                      {isEditable && onFieldChange ? (
                        <Input
                          value={issue.row?.[header] ?? ''}
                          onChange={event => onFieldChange(issue.row_number, header, event.target.value)}
                          className="h-9 min-w-[10rem]"
                        />
                      ) : (
                        <span className="block truncate">{issue.row?.[header] || <span className="text-muted-foreground">-</span>}</span>
                      )}
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

function IssueSummaryTable({
  title,
  description,
  issues,
  headers,
  badgeLabel,
  emailColumn,
  fieldErrors = {},
  onEditIssue,
  savingRowNumbers = {},
}: {
  title: string;
  description: string;
  issues: ImportRowIssue[];
  headers: string[];
  badgeLabel: string;
  emailColumn?: string;
  fieldErrors?: RowValidationErrors;
  onEditIssue?: (issue: ImportRowIssue) => void;
  savingRowNumbers?: Record<number, boolean>;
}) {
  if (issues.length === 0) return null;

  const previewHeaders = headers.filter(header => header !== emailColumn).slice(0, 3);
  const isEditable = Boolean(onEditIssue);

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
        <div className="max-h-[34rem] overflow-x-auto overflow-y-auto rounded-lg border">
          <Table className="min-w-[56rem]">
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead className="w-24">Wiersz</TableHead>
                {emailColumn && <TableHead className="min-w-[15rem]">E-mail</TableHead>}
                <TableHead className="min-w-[18rem]">Problem</TableHead>
                <TableHead className="min-w-[18rem]">Podgląd</TableHead>
                {isEditable && <TableHead className="w-[11rem] text-right">Akcja</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {issues.map(issue => {
                const rowErrors = fieldErrors[issue.row_number] ?? {};
                const errorCount = Object.values(rowErrors).filter(Boolean).length;

                return (
                  <TableRow key={`${title}-${issue.row_number}`}>
                    <TableCell className="font-medium">{issue.row_number}</TableCell>
                    {emailColumn && (
                      <TableCell className="max-w-[18rem] align-top">
                        <span className="block truncate">{issue.row?.[emailColumn] || <span className="text-muted-foreground">-</span>}</span>
                        {rowErrors[emailColumn] && (
                          <p className="mt-1 text-xs text-destructive">{rowErrors[emailColumn]}</p>
                        )}
                      </TableCell>
                    )}
                    <TableCell className="max-w-[24rem] align-top">
                      <div className="space-y-1">
                        {errorCount > 0 && <Badge variant="destructive">{errorCount} pól do poprawy</Badge>}
                        {issue.reasons.slice(0, 2).map((reason, index) => (
                          <p key={`${issue.row_number}-${index}`} className="line-clamp-2 text-sm text-muted-foreground">{reason}</p>
                        ))}
                        {issue.reasons.length > 2 && (
                          <p className="text-xs text-muted-foreground">+ {issue.reasons.length - 2} więcej w edycji</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[22rem] align-top">
                      <div className="space-y-1 text-sm">
                        {previewHeaders.length === 0 ? (
                          <span className="text-muted-foreground">Brak dodatkowych pól</span>
                        ) : previewHeaders.map(header => (
                          <p key={`${issue.row_number}-${header}`} className="truncate">
                            <span className="font-medium">{header}:</span>{' '}
                            <span className="text-muted-foreground">{issue.row?.[header] || '-'}</span>
                          </p>
                        ))}
                      </div>
                    </TableCell>
                    {isEditable && (
                      <TableCell className="align-top text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => onEditIssue?.(issue)}
                          disabled={savingRowNumbers[issue.row_number]}
                          className="whitespace-nowrap"
                        >
                          {savingRowNumbers[issue.row_number] ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Pencil className="mr-1 h-4 w-4" />}
                          Edytuj
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function ParticipantIssueEditorDialog({
  issue,
  headers,
  emailColumn,
  mappings,
  fieldErrors,
  saving,
  saveDisabled,
  onOpenChange,
  onFieldChange,
  onSaveIssue,
}: {
  issue: ImportRowIssue | null;
  headers: string[];
  emailColumn: string;
  mappings: ParticipantFieldMapping[];
  fieldErrors: FieldValidationErrors;
  saving: boolean;
  saveDisabled: boolean;
  onOpenChange: (open: boolean) => void;
  onFieldChange: (rowNumber: number, header: string, value: string) => void;
  onSaveIssue: (issue: ImportRowIssue) => void;
}) {
  const reasonHints = useMemo(
    () => issue ? getIssueReasonFieldHints(issue, headers, mappings, emailColumn) : {},
    [emailColumn, headers, issue, mappings],
  );

  return (
    <Dialog open={Boolean(issue)} onOpenChange={onOpenChange}>
      {issue && (
        <DialogContent className="max-h-[min(42rem,calc(100vh-2rem))] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edycja uczestnika z wiersza {issue.row_number}</DialogTitle>
            <DialogDescription>
              Popraw pola oznaczone błędem i dopisz uczestnika do bazy.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {issue.reasons.length > 0 && (
              <div className="rounded-md border border-amber-400/45 bg-amber-500/10 px-3 py-2">
                <p className="text-sm font-medium">Błędy wskazane przez import</p>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {issue.reasons.map((reason, index) => (
                    <li key={`${issue.row_number}-reason-${index}`}>{reason}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              {headers.map(header => {
                const inputId = `import-row-${issue.row_number}-${header}`;
                const validationError = fieldErrors[header];
                const importHint = reasonHints[header];
                const describedBy = validationError ? `${inputId}-error` : importHint ? `${inputId}-hint` : undefined;
                const mapping = header === emailColumn ? undefined : findMappingForHeader(mappings, header);

                return (
                  <div key={`${issue.row_number}-${header}`} className="space-y-1.5">
                    <Label htmlFor={inputId} className="flex items-center justify-between gap-2">
                      <span className="truncate">{header}</span>
                      {header === emailColumn && <Badge variant="secondary">e-mail</Badge>}
                    </Label>
                    {mapping && mapping.field_role !== 'email' ? (
                      <ParticipantFieldValueInput
                        id={inputId}
                        mapping={mapping}
                        value={issue.row?.[header] ?? ''}
                        onChange={value => onFieldChange(issue.row_number, header, value)}
                        invalid={Boolean(validationError)}
                        describedBy={describedBy}
                      />
                    ) : (
                      <Input
                        id={inputId}
                        type={header === emailColumn ? 'email' : 'text'}
                        value={issue.row?.[header] ?? ''}
                        onChange={event => onFieldChange(issue.row_number, header, event.target.value)}
                        aria-invalid={Boolean(validationError)}
                        aria-describedby={describedBy}
                        placeholder={header === emailColumn ? 'email@example.com' : undefined}
                      />
                    )}
                    <FieldError id={`${inputId}-error`}>{validationError}</FieldError>
                    {!validationError && importHint && (
                      <p id={`${inputId}-hint`} className="text-xs text-amber-700">
                        Powód z importu: {importHint}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Zamknij
            </Button>
            <Button type="button" onClick={() => onSaveIssue(issue)} disabled={saveDisabled || saving}>
              {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-1 h-4 w-4" />}
              Dopisz
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}

export default function CsvImportSummary() {
  const { id: routeEventId = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { events, selectedEventId, isLoading, runParticipantImport, resetEventParticipantList, connectionState } = useData();
  const eventId = routeEventId || selectedEventId;
  const event = events.find(item => item.id === eventId);
  const state = (location.state ?? {}) as ImportSummaryState;
  const summary = state.summary;
  const [editableInvalidIssues, setEditableInvalidIssues] = useState<ImportRowIssue[]>([]);
  const [retryingImport, setRetryingImport] = useState(false);
  const [savingRowNumbers, setSavingRowNumbers] = useState<Record<number, boolean>>({});
  const [importedFixedCount, setImportedFixedCount] = useState(0);
  const [editingRowNumber, setEditingRowNumber] = useState<number | null>(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetRequiresQrConfirm, setResetRequiresQrConfirm] = useState(false);
  const [resetSaving, setResetSaving] = useState(false);

  useRouteEventContext(routeEventId);

  const invalidIssues = useMemo(
    () => getIssueRows(summary?.invalid_row_details, summary?.invalid_rows, state.sourceRows),
    [state.sourceRows, summary?.invalid_row_details, summary?.invalid_rows],
  );
  const duplicateIssues = useMemo(
    () => getIssueRows(summary?.duplicate_row_details, [], state.sourceRows),
    [state.sourceRows, summary?.duplicate_row_details],
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
  const summaryMappings = useMemo(() => state.mappings ?? [], [state.mappings]);
  const rowValidationErrors = useMemo(
    () => buildRowValidationErrors(editableInvalidIssues, invalidHeaders, summaryMappings, emailColumn),
    [editableInvalidIssues, emailColumn, invalidHeaders, summaryMappings],
  );
  const editingIssue = editingRowNumber === null
    ? null
    : editableInvalidIssues.find(issue => issue.row_number === editingRowNumber) ?? null;
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
    setImportedFixedCount(0);
    setEditingRowNumber(null);
  }, [invalidIssues]);

  const handleFieldChange = (rowNumber: number, header: string, value: string) => {
    setEditableInvalidIssues(prev => prev.map(issue => (
      issue.row_number === rowNumber
        ? { ...issue, row: { ...issue.row, [header]: value } }
        : issue
    )));
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

    if (successfulOriginalRows.size > 0) {
      setImportedFixedCount(previous => previous + successfulOriginalRows.size);
    }
  };

  const handleSaveIssue = async (issue: ImportRowIssue) => {
    if (!emailColumn) {
      toast({ title: 'Nie znaleziono kolumny e-mail', variant: 'destructive' });
      return;
    }

    const validationErrors = getIssueFieldErrors(issue, invalidHeaders, summaryMappings, emailColumn);
    if (Object.values(validationErrors).some(Boolean)) {
      toast({ title: 'Popraw błędne pola uczestnika', variant: 'destructive' });
      return;
    }

    try {
      setSavingRowNumbers(previous => ({ ...previous, [issue.row_number]: true }));
      const result = await runParticipantImport(eventId, buildCsvContent(invalidHeaders, [issue]));
      applyRetryResultToRows([issue], result);

      if (result.created_count > 0) {
        setEditingRowNumber(null);
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

    const nextErrors = editableInvalidIssues.reduce<RowValidationErrors>((accumulator, issue) => {
      const errors = getIssueFieldErrors(issue, invalidHeaders, summaryMappings, emailColumn);
      if (Object.values(errors).some(Boolean)) accumulator[issue.row_number] = errors;
      return accumulator;
    }, {});

    if (Object.values(nextErrors).some(rowErrors => Object.values(rowErrors).some(Boolean))) {
      toast({ title: 'Popraw błędne pola przed importem', variant: 'destructive' });
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

  const handleReturnToValidationSettings = () => {
    const restoredAnalysis = state.analysis ?? {
      headers: state.headers ?? [],
      sample_rows: (state.sourceRows ?? []).slice(0, 5),
      email_candidates: state.emailColumn ? [{ column: state.emailColumn, matched_count: state.sourceRows?.length ?? 0 }] : [],
      has_mapping: false,
      has_baseline_import: false,
      mappings: state.mappings ?? [],
      missing_required_columns: [],
      row_count: state.sourceRows?.length ?? 0,
      existing_participant_count: 0,
      sent_qr_email_count: 0,
      list_difference: {
        columns_differ: false,
        missing_columns: [],
        extra_columns: [],
        participant_difference_ratio: 0,
        should_offer_replacement: false,
      },
    };

    navigate(buildEventImportPath(eventId), {
      state: {
        restoreImport: true,
        csvContent: state.csvContent,
        fileName: state.fileName,
        analysis: restoredAnalysis,
        selectedEmailColumn: state.emailColumn,
        replacementMode: state.mode === 'replace',
        validationPanelsOpen: true,
      },
    });
  };

  const handleResetParticipantList = async () => {
    setResetSaving(true);
    const result = await resetEventParticipantList(eventId, resetRequiresQrConfirm);
    setResetSaving(false);

    if (!result.ok) {
      if (result.qrEmailsSent) {
        setResetRequiresQrConfirm(true);
        toast({
          title: 'Potwierdź usunięcie po wysyłce QR',
          description: 'Dla tego wydarzenia wysłano już maile z kodami QR. Potwierdź operację ponownie w oknie.',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Nie udało się usunąć listy',
        description: result.error,
        variant: 'destructive',
      });
      return;
    }

    setResetDialogOpen(false);
    setResetRequiresQrConfirm(false);
    toast({
      title: 'Usunięto listę uczestników',
      description: `Usunięto ${result.deleted_participant_count} uczestników i ${result.deleted_mapping_count} mapowań.`,
    });
    navigate(buildEventPath(eventId));
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
          className="sm:flex-col lg:flex-row"
          headingClassName="break-words"
          actionsClassName="w-full sm:flex-row lg:w-auto"
          description={
            <>
              <p>Wydarzenie: <span className="font-medium text-foreground">{event.name}</span></p>
              {state.fileName && <p className="mt-1 text-xs">Plik: {state.fileName}</p>}
            </>
          }
          actions={
            <>
              <Button
                variant="outline"
                onClick={handleReturnToValidationSettings}
                className="w-full justify-center sm:w-auto"
              >
                <RotateCcw className="mr-1 h-4 w-4" /> Wróć do ustawień walidacji
              </Button>
              {editableInvalidIssues.length > 0 && (
                <>
                <Button
                  onClick={handleRetryEditedRows}
                  disabled={!canRetryEditedRows || retryingImport}
                  className="w-full justify-center sm:w-auto"
                >
                  {retryingImport ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-1 h-4 w-4" />}
                  Dopisz poprawione do bazy
                </Button>
                <Button
                  variant="outline"
                  onClick={() => downloadCsv(`do-poprawy-${eventId}.csv`, invalidHeaders, editableInvalidIssues)}
                  className="w-full justify-center sm:w-auto"
                >
                  <Download className="mr-1 h-4 w-4" /> Pobierz CSV do poprawy
                </Button>
                </>
              )}
              <Button
                variant="outline"
                onClick={() => {
                  setResetRequiresQrConfirm(false);
                  setResetDialogOpen(true);
                }}
                disabled={connectionState !== 'online' || resetSaving}
                className="w-full justify-center border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive sm:w-auto"
              >
                <Trash2 className="mr-1 h-4 w-4" /> Usuń całą listę
              </Button>
            </>
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
            {buildImportSuccessDescription(currentCreatedCount, state.mode)}
          </AlertDescription>
        </Alert>
        {unimportedCount > 0 ? (
          <Alert className="border-amber-400/50 bg-amber-500/10">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Wymagane sprawdzenie danych</AlertTitle>
            <AlertDescription>
              {currentInvalidCount > 0 ? 'Błędne dane można poprawić w tabeli poniżej i od razu dopisać zawodnika do bazy. ' : ''}
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
              <p className="text-sm font-medium">Poprawianie danych w UI</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Możesz poprawić dowolną kolumnę w tabeli poniżej, w tym e-mail (<span className="font-medium text-foreground">{emailColumn}</span>).
                {changedEmailCount > 0 ? ` Zmieniono ${changedEmailCount} adresów e-mail.` : ' Wprowadź poprawki w tabeli poniżej.'}
              </p>
            </div>
            <Button onClick={handleRetryEditedRows} disabled={!canRetryEditedRows || retryingImport}>
              {retryingImport ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-1 h-4 w-4" />}
              Dopisz wszystkie poprawione
            </Button>
          </CardContent>
        </Card>
      )}

      <IssueSummaryTable
        title="Wiersze do poprawy"
        description="Te rekordy nie zostały zaimportowane z powodu brakujących lub nieprawidłowych danych."
        issues={editableInvalidIssues}
        headers={invalidHeaders}
        badgeLabel={`${editableInvalidIssues.length} wierszy`}
        emailColumn={emailColumn}
        fieldErrors={rowValidationErrors}
        onEditIssue={issue => setEditingRowNumber(issue.row_number)}
        savingRowNumbers={savingRowNumbers}
      />

      <ParticipantIssueEditorDialog
        issue={editingIssue}
        headers={invalidHeaders}
        emailColumn={emailColumn}
        mappings={summaryMappings}
        fieldErrors={editingIssue ? rowValidationErrors[editingIssue.row_number] ?? {} : {}}
        saving={editingIssue ? Boolean(savingRowNumbers[editingIssue.row_number]) : false}
        saveDisabled={connectionState !== 'online'}
        onOpenChange={open => {
          if (!open) setEditingRowNumber(null);
        }}
        onFieldChange={handleFieldChange}
        onSaveIssue={issue => {
          void handleSaveIssue(issue);
        }}
      />

      <IssueSummaryTable
        title="Pominięte duplikaty"
        description="Te rekordy nie zostały dodane, bo odpowiadają uczestnikom już istniejącym w tym wydarzeniu."
        issues={duplicateIssues}
        headers={issueHeaders}
        badgeLabel={`${duplicateIssues.length} wierszy`}
        emailColumn={emailColumn}
      />

      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Usunąć całą listę uczestników?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Ta operacja usunie wszystkich uczestników tego wydarzenia razem z mapowaniem CSV, bazą importu i logami zmian uczestników.
              </span>
              {resetRequiresQrConfirm && (
                <span className="block font-medium text-destructive">
                  Serwer wymaga dodatkowego potwierdzenia. Kliknij przycisk usunięcia jeszcze raz, jeśli na pewno chcesz kontynuować.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetSaving}>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={resetSaving}
              onClick={(event) => {
                event.preventDefault();
                void handleResetParticipantList();
              }}
            >
              {resetSaving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1 h-4 w-4" />}
              Usuń listę i mapowanie
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={() => navigate(buildEventImportPath(eventId))}>
          <RotateCcw className="mr-1 h-4 w-4" /> Wgraj kolejny CSV
        </Button>
        <Button onClick={() => navigate(buildEventPath(eventId))}>Przejdź do wydarzenia</Button>
      </div>
    </div>
  );
}
