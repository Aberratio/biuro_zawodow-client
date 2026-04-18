export type Role = 'superadmin' | 'admin' | 'editor' | 'scanner' | 'scanner_plus';

export type ParticipantStatus = 'not_checked_in' | 'checked_in' | 'checked_in_not_starting';
export type EmailStatus = 'not_sent' | 'sent';
export type ParticipantSyncState = 'synced' | 'pending_sync' | 'requires_review';
export type ConnectionState = 'online' | 'degraded' | 'offline';
export type SnapshotSource = 'network' | 'cache' | 'none';
export type ScannerMode = 'online' | 'offline_queue' | 'read_only';
export type SessionState = 'online' | 'offline_cached' | 'expired';

export interface Organization {
  id: string;
  name: string;
  logo?: string;
  event_limit: number;
}

export interface Event {
  id: string;
  name: string;
  location: string;
  organization_id: string;
  office_open_at: string;
  office_close_at: string;
  archived_at?: string | null;
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
  checked_in_at?: string;
  custom_fields?: Record<string, string>;
  sync_state?: ParticipantSyncState;
  sync_error?: string;
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

export type ParticipantFieldRole = 'email' | 'display_name_part' | 'bib_number' | 'custom';

export interface ParticipantFieldMapping {
  source_column_name: string;
  alias: string;
  field_role: ParticipantFieldRole;
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
