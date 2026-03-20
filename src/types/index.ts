export type Role = 'superadmin' | 'admin' | 'editor' | 'scanner';

export type ParticipantStatus = 'pending' | 'checked_in';
export type PackageStatus = 'not_collected' | 'collected';
export type EmailStatus = 'not_sent' | 'sent';

export interface Organization {
  id: string;
  name: string;
  logo?: string;
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
  timestamp: string;
  action: string;
  participant_name?: string;
  user_name?: string;
}
