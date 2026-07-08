export type Role = 'superadmin' | 'admin' | 'editor' | 'scanner' | 'scanner_plus';

export type ParticipantStatus = 'not_checked_in' | 'checked_in' | 'checked_in_not_starting';
export type EmailStatus = 'not_sent' | 'sent';
export type PaymentStatus = 'unknown' | 'paid' | 'unpaid';
export type ParticipantSyncState = 'synced' | 'pending_sync' | 'requires_review';
export type ConnectionState = 'online' | 'degraded' | 'offline';
export type SnapshotSource = 'network' | 'cache' | 'none';
export type ScannerMode = 'online' | 'offline_queue' | 'read_only';
export type SessionState = 'online' | 'offline_cached' | 'expired';
export type ServiceWorkerState = 'unsupported' | 'checking' | 'ready' | 'unavailable';

export interface AppDiagnostics {
  sessionStorageAvailable: boolean;
  localStorageAvailable: boolean;
  indexedDbAvailable: boolean;
  canPersistSession: boolean;
  serviceWorkerState: ServiceWorkerState;
  warnings: string[];
}

export interface Organization {
  id: string;
  name: string;
  logo?: string;
  event_limit: number;
}

export interface EventOfficeHourRange {
  id?: string;
  opens_at: string;
  closes_at: string;
}

export interface EventOfficeLocation {
  id?: string;
  name: string;
  google_maps_url?: string | null;
  hours: EventOfficeHourRange[];
}

export interface Event {
  id: string;
  name: string;
  location: string;
  organization_id: string;
  office_open_at: string;
  office_close_at: string;
  office_locations: EventOfficeLocation[];
  is_test: boolean;
  archived_at?: string | null;
  deleted_at?: string | null;
}

export interface Participant {
  id: string;
  event_id: string;
  name: string;
  email: string;
  bib_number: string;
  qr_code: string;
  status: ParticipantStatus;
  email_status: EmailStatus;
  payment_status: PaymentStatus;
  checked_in_at?: string;
  custom_fields?: Record<string, string>;
  important_field_aliases?: string[];
  sync_state?: ParticipantSyncState;
  sync_error?: string;
}

export type QrDeliveryEffectiveStatus =
  | 'pending'
  | 'processing'
  | 'retry'
  | 'sent'
  | 'failed'
  | 'bounced'
  | 'suppressed'
  | 'unknown';

export interface QrEmailDelivery {
  email_id: string;
  status: string;
  effective_status: QrDeliveryEffectiveStatus;
  is_batch: boolean;
  batch_id: string | null;
  sent_at: string | null;
  created_at: string | null;
  last_error: string | null;
  send_count: number;
}

export interface QrEmailDeliveryParticipant {
  participant_id: number;
  name: string;
  email: string;
  bib_number: string;
  local_email_status: EmailStatus;
  delivery: QrEmailDelivery | null;
}

export interface QrEmailDeliverySummary {
  participants_total: number;
  sent: number;
  queued: number;
  failed: number;
  bounced: number;
  unknown: number;
  no_data: number;
}

export interface QrEmailDeliveryReport {
  event_id: string;
  generated_at: string;
  mailer_available: boolean;
  mailer_error: string | null;
  summary: QrEmailDeliverySummary;
  participants: QrEmailDeliveryParticipant[];
}

export interface ParticipantQrPreview {
  participant: Participant;
  event: Event;
  qr_code_svg_data_uri: string;
  qr_code_image_url: string;
}

export interface ParticipantScanResult {
  participant: Participant;
  event: Event;
  access: {
    allowed: boolean;
  };
}

export type ParticipantFieldRole = 'email' | 'display_name_part' | 'bib_number' | 'payment_status' | 'custom' | 'important_custom';
export type ParticipantFieldType = 'text' | 'number' | 'date' | 'select';

export interface ParticipantFieldValidationRules {
  min_length?: number;
  max_length?: number;
  min?: number | string;
  max?: number | string;
  date_format?: 'dmy' | 'mdy' | 'ymd';
  options?: string[];
}

export interface ParticipantFieldMapping {
  source_column_name: string;
  alias: string;
  field_role: ParticipantFieldRole;
  field_type?: ParticipantFieldType;
  validation_rules?: ParticipantFieldValidationRules;
  display_order: number;
  is_required: boolean;
  is_active: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: Role;
  organization_id?: string;
  assigned_events: string[];
}

export interface ActivityLog {
  id: string;
  event_id?: string;
  participant_id?: string;
  timestamp: string;
  action: string;
  participant_name?: string;
  user_name?: string;
}
