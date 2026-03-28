export type Role = 'superadmin' | 'admin' | 'editor' | 'scanner';

export type ParticipantStatus = 'not_checked_in' | 'checked_in' | 'checked_in_not_starting';
export type EmailStatus = 'not_sent' | 'sent';

export interface Organization {
  id: string;
  name: string;
  logo?: string;
  event_limit: number;
  admin_user_id?: string;
  admin_user_name?: string;
}

export interface Event {
  id: string;
  name: string;
  date: string;
  location: string;
  organization_id: string;
  office_open_at: string;
  office_close_at: string;
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
  organization_ids?: string[];
  assigned_events: string[];
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  action: string;
  participant_name?: string;
  user_name?: string;
}
