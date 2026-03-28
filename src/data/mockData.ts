import { Event, Participant, User, ActivityLog, Organization } from '@/types';

export const mockOrganizations: Organization[] = [
  { id: 'org-1', name: 'SportEvents Pro', event_limit: 4, admin_user_id: 'u-1', admin_user_name: 'Admin SportEvents' },
  { id: 'org-2', name: 'RunPoland', event_limit: 2, admin_user_id: 'u-1b', admin_user_name: 'Admin RunPoland' },
];

export const mockEvents: Event[] = [
  { id: 'evt-1', name: 'Bieg Piastowski 10km', date: '2026-04-12', location: 'Gniezno, Park Miejski', organization_id: 'org-1', office_open_at: '2026-03-28T07:00:00', office_close_at: '2026-03-28T18:00:00' },
  { id: 'evt-2', name: 'Triathlon Poznan Sprint', date: '2026-05-18', location: 'Poznan, Malta', organization_id: 'org-1', office_open_at: '2026-05-18T06:30:00', office_close_at: '2026-05-18T14:30:00' },
  { id: 'evt-3', name: 'Maraton Wroclaw', date: '2026-06-07', location: 'Wroclaw, Hala Stulecia', organization_id: 'org-2', office_open_at: '2026-06-07T05:30:00', office_close_at: '2026-06-07T16:00:00' },
];

const names = [
  'Jan Kowalski', 'Anna Nowak', 'Piotr Wisniewski', 'Maria Wojcik', 'Tomasz Kaminski',
  'Katarzyna Lewandowska', 'Andrzej Zielinski', 'Malgorzata Szymanska', 'Krzysztof Wozniak', 'Agnieszka Dabrowska',
  'Michal Kozlowski', 'Joanna Jankowska', 'Marcin Mazur', 'Barbara Krawczyk', 'Pawel Piotrowski',
  'Monika Grabowska', 'Lukasz Nowakowski', 'Ewa Pawlowska', 'Adam Michalski', 'Dorota Adamczyk',
  'Robert Krol', 'Magdalena Wieczorek', 'Jakub Jablonski', 'Aleksandra Majewska', 'Damian Olszewski',
  'Natalia Stepien', 'Grzegorz Malinowski', 'Karolina Jaworska', 'Rafal Dudek', 'Sylwia Urbanska',
];

function generateParticipants(eventId: string, count: number, startBib: number): Participant[] {
  const shuffled = [...names].sort(() => Math.random() - 0.5).slice(0, count);
  return shuffled.map((name, i) => {
    const status = i < Math.floor(count * 0.2)
      ? 'checked_in_not_starting' as const
      : i < Math.floor(count * 0.4)
        ? 'checked_in' as const
        : 'not_checked_in' as const;
    const emailPart = name.toLowerCase().replace(/\s/g, '.');

    return {
      id: `p-${eventId}-${i + 1}`,
      event_id: eventId,
      name,
      email: `${emailPart}@email.pl`,
      bib_number: String(startBib + i),
      qr_code: `QR-${eventId}-${startBib + i}`,
      status,
      email_status: i < Math.floor(count * 0.7) ? 'sent' as const : 'not_sent' as const,
      checked_in_at: status === 'not_checked_in' ? undefined : new Date(Date.now() - Math.random() * 3600000).toISOString(),
    };
  });
}

export const mockParticipants: Participant[] = [
  ...generateParticipants('evt-1', 12, 100),
  ...generateParticipants('evt-2', 10, 200),
  ...generateParticipants('evt-3', 8, 300),
];

export const mockUsers: User[] = [
  { id: 'u-0', name: 'Super Admin', email: 'super@biurozawodow.pl', password: 'demo123', role: 'superadmin', assigned_events: [] },
  { id: 'u-1', name: 'Admin SportEvents', email: 'admin@sportevents.pl', password: 'demo123', role: 'admin', organization_ids: ['org-1'], assigned_events: [] },
  { id: 'u-1b', name: 'Admin RunPoland', email: 'admin@runpoland.pl', password: 'demo123', role: 'admin', organization_ids: ['org-2'], assigned_events: [] },
  { id: 'u-2', name: 'Organizator Gniezno', email: 'org.gniezno@sportevents.pl', password: 'demo123', role: 'editor', organization_id: 'org-1', assigned_events: [] },
  { id: 'u-3', name: 'Organizator Poznan', email: 'org.poznan@sportevents.pl', password: 'demo123', role: 'editor', organization_id: 'org-1', assigned_events: [] },
  { id: 'u-4', name: 'Wolontariusz Skaner 1', email: 'skaner1@sportevents.pl', password: 'demo123', role: 'scanner', organization_id: 'org-1', assigned_events: ['evt-1'] },
  { id: 'u-5', name: 'Wolontariusz Skaner 2', email: 'skaner2@sportevents.pl', password: 'demo123', role: 'scanner', organization_id: 'org-1', assigned_events: ['evt-2'] },
];

export const mockActivityLog: ActivityLog[] = [
  { id: 'log-1', timestamp: new Date(Date.now() - 120000).toISOString(), action: 'Check-in', participant_name: 'Jan Kowalski', user_name: 'Wolontariusz Skaner 1' },
  { id: 'log-2', timestamp: new Date(Date.now() - 300000).toISOString(), action: 'Wydano pakiet', participant_name: 'Anna Nowak', user_name: 'Organizator Gniezno' },
  { id: 'log-3', timestamp: new Date(Date.now() - 600000).toISOString(), action: 'Import CSV', participant_name: undefined, user_name: 'Admin SportEvents' },
  { id: 'log-4', timestamp: new Date(Date.now() - 900000).toISOString(), action: 'Check-in', participant_name: 'Piotr Wisniewski', user_name: 'Wolontariusz Skaner 2' },
  { id: 'log-5', timestamp: new Date(Date.now() - 1800000).toISOString(), action: 'Wyslano QR', participant_name: 'Maria Wojcik', user_name: 'Super Admin' },
];

export const demoCsvData = [
  { name: 'Nowy Uczestnik 1', email: 'nowy1@email.pl' },
  { name: 'Nowy Uczestnik 2', email: 'nowy2@email.pl' },
  { name: 'Nowy Uczestnik 3', email: 'nowy3@email.pl' },
  { name: 'Nowy Uczestnik 4', email: '' },
  { name: 'Nowy Uczestnik 5', email: 'nowy5@email.pl' },
  { name: 'Jan Kowalski', email: 'jan.kowalski@email.pl' },
];
