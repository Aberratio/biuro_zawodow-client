import { Event, Participant, User, ActivityLog, Organization } from '@/types';

export const mockOrganizations: Organization[] = [
  { id: 'org-1', name: 'SportEvents Pro' },
  { id: 'org-2', name: 'RunPoland' },
];

export const mockEvents: Event[] = [
  { id: 'evt-1', name: 'Bieg Piastowski 10km', date: '2026-04-12', location: 'Gniezno, Park Miejski', organization_id: 'org-1' },
  { id: 'evt-2', name: 'Triathlon Poznań Sprint', date: '2026-05-18', location: 'Poznań, Malta', organization_id: 'org-1' },
  { id: 'evt-3', name: 'Maraton Wrocław', date: '2026-06-07', location: 'Wrocław, Hala Stulecia', organization_id: 'org-2' },
];

const names = [
  'Jan Kowalski', 'Anna Nowak', 'Piotr Wiśniewski', 'Maria Wójcik', 'Tomasz Kamiński',
  'Katarzyna Lewandowska', 'Andrzej Zieliński', 'Małgorzata Szymańska', 'Krzysztof Woźniak', 'Agnieszka Dąbrowska',
  'Michał Kozłowski', 'Joanna Jankowska', 'Marcin Mazur', 'Barbara Krawczyk', 'Paweł Piotrowski',
  'Monika Grabowska', 'Łukasz Nowakowski', 'Ewa Pawłowska', 'Adam Michalski', 'Dorota Adamczyk',
  'Robert Król', 'Magdalena Wieczorek', 'Jakub Jabłoński', 'Aleksandra Majewska', 'Damian Olszewski',
  'Natalia Stępień', 'Grzegorz Malinowski', 'Karolina Jaworska', 'Rafał Dudek', 'Sylwia Urbańska',
];

function generateParticipants(eventId: string, count: number, startBib: number): Participant[] {
  const shuffled = [...names].sort(() => Math.random() - 0.5).slice(0, count);
  return shuffled.map((name, i) => {
    const status = i < Math.floor(count * 0.4) ? 'checked_in' as const : 'pending' as const;
    const packageStatus = status === 'checked_in' && i < Math.floor(count * 0.25) ? 'collected' as const : 'not_collected' as const;
    const emailPart = name.toLowerCase().replace(/\s/g, '.').replace(/ł/g, 'l').replace(/ś/g, 's').replace(/ó/g, 'o').replace(/ż/g, 'z').replace(/ź/g, 'z').replace(/ą/g, 'a').replace(/ę/g, 'e').replace(/ń/g, 'n').replace(/ć/g, 'c');
    return {
      id: `p-${eventId}-${i + 1}`,
      event_id: eventId,
      name,
      email: `${emailPart}@email.pl`,
      bib_number: String(startBib + i),
      qr_code: `QR-${eventId}-${startBib + i}`,
      status,
      package_status: packageStatus,
      email_status: i < Math.floor(count * 0.7) ? 'sent' as const : 'not_sent' as const,
      checked_in_at: status === 'checked_in' ? new Date(Date.now() - Math.random() * 3600000).toISOString() : undefined,
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
  { id: 'u-1', name: 'Admin SportEvents', email: 'admin@sportevents.pl', password: 'demo123', role: 'admin', organization_id: 'org-1', assigned_events: [] },
  { id: 'u-1b', name: 'Admin RunPoland', email: 'admin@runpoland.pl', password: 'demo123', role: 'admin', organization_id: 'org-2', assigned_events: [] },
  { id: 'u-2', name: 'Organizator Gniezno', email: 'org.gniezno@sportevents.pl', password: 'demo123', role: 'editor', organization_id: 'org-1', assigned_events: ['evt-1'] },
  { id: 'u-3', name: 'Organizator Poznań', email: 'org.poznan@sportevents.pl', password: 'demo123', role: 'editor', organization_id: 'org-1', assigned_events: ['evt-2'] },
  { id: 'u-4', name: 'Wolontariusz Skaner 1', email: 'skaner1@sportevents.pl', password: 'demo123', role: 'scanner', organization_id: 'org-1', assigned_events: ['evt-1'] },
  { id: 'u-5', name: 'Wolontariusz Skaner 2', email: 'skaner2@sportevents.pl', password: 'demo123', role: 'scanner', organization_id: 'org-1', assigned_events: ['evt-2'] },
];

export const mockActivityLog: ActivityLog[] = [
  { id: 'log-1', timestamp: new Date(Date.now() - 120000).toISOString(), action: 'Check-in', participant_name: 'Jan Kowalski', user_name: 'Wolontariusz Skaner 1' },
  { id: 'log-2', timestamp: new Date(Date.now() - 300000).toISOString(), action: 'Wydano pakiet', participant_name: 'Anna Nowak', user_name: 'Organizator Gniezno' },
  { id: 'log-3', timestamp: new Date(Date.now() - 600000).toISOString(), action: 'Import CSV', participant_name: undefined, user_name: 'Admin SportEvents' },
  { id: 'log-4', timestamp: new Date(Date.now() - 900000).toISOString(), action: 'Check-in', participant_name: 'Piotr Wiśniewski', user_name: 'Wolontariusz Skaner 2' },
  { id: 'log-5', timestamp: new Date(Date.now() - 1800000).toISOString(), action: 'Wysłano QR', participant_name: 'Maria Wójcik', user_name: 'Super Admin' },
];

export const demoCsvData = [
  { name: 'Nowy Uczestnik 1', email: 'nowy1@email.pl' },
  { name: 'Nowy Uczestnik 2', email: 'nowy2@email.pl' },
  { name: 'Nowy Uczestnik 3', email: 'nowy3@email.pl' },
  { name: 'Nowy Uczestnik 4', email: '' },
  { name: 'Nowy Uczestnik 5', email: 'nowy5@email.pl' },
  { name: 'Jan Kowalski', email: 'jan.kowalski@email.pl' },
];
