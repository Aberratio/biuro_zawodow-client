import type {
  ActivityLog,
  Event,
  Organization,
  Participant,
  ParticipantFieldMapping,
  User,
} from "@/types";

export function createTestUser(overrides: Partial<User> = {}): User {
  const role = overrides.role ?? "admin";

  return {
    id: `${role}-1`,
    name: role === "superadmin" ? "Super Admin" : "Admin",
    email: `${role}@example.com`,
    password: "",
    role,
    assigned_events: [],
    ...overrides,
  };
}

export function createTestOrganization(
  overrides: Partial<Organization> = {},
): Organization {
  return {
    id: "org-1",
    name: "Organizacja Testowa",
    event_limit: 5,
    ...overrides,
  };
}

export function createTestEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: "event-1",
    name: "Bieg Miejski",
    location: "Warszawa",
    organization_id: "org-1",
    office_open_at: "2099-04-12T07:00:00",
    office_close_at: "2099-04-12T15:00:00",
    is_test: false,
    ...overrides,
  };
}

export function createTestParticipant(
  overrides: Partial<Participant> = {},
): Participant {
  return {
    id: "p-1",
    event_id: "event-1",
    name: "Anna Kowalska",
    email: "anna@example.com",
    bib_number: "101",
    qr_code: "QR-101",
    status: "not_checked_in",
    email_status: "not_sent",
    custom_fields: {},
    important_field_aliases: [],
    sync_state: "synced",
    ...overrides,
  };
}

export function createTestParticipantMapping(
  overrides: Partial<ParticipantFieldMapping> = {},
): ParticipantFieldMapping {
  return {
    source_column_name: "city",
    alias: "Miasto",
    field_role: "custom",
    field_type: "text",
    validation_rules: {},
    display_order: 1,
    is_required: false,
    is_active: true,
    ...overrides,
  };
}

export function createTestActivityLog(
  overrides: Partial<ActivityLog> = {},
): ActivityLog {
  return {
    id: "log-1",
    event_id: "event-1",
    participant_id: "1",
    timestamp: "2099-04-12T10:00:00.000Z",
    action: "Wysłano kod QR",
    participant_name: "Anna Kowalska",
    user_name: "Admin",
    ...overrides,
  };
}
