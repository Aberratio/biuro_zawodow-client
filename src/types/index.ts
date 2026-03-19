export type Role = 'scanner' | 'editor' | 'admin';

export type ParticipantStatus = 'pending' | 'checked_in';
export type PackageStatus = 'not_collected' | 'collected';
export type EmailStatus = 'not_sent' | 'sent';

export interface Event {
  id: string;
  name: string;
  date: string;
  location: string;
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
  role: Role;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  action: string;
  participant_name?: string;
  user_name?: string;
}
