export type Role = 'superadmin' | 'admin' | 'editor' | 'scanner';

export type ParticipantStatus = 'pending' | 'checked_in';
export type PackageStatus = 'not_collected' | 'collected';
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
}

export interface Participant {
  id: string;
  event_id: string;
  name: string;
  email: string;
  bib_number: string;
  qr_code: string;
  status: ParticipantStatus;
  package_status: PackageStatus;
  email_status: EmailStatus;
  checked_in_at?: string;
  custom_fields?: Record<string, string>;
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
