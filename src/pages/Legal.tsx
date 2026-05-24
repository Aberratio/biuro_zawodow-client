import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Cookie, FileText, Scale, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandWordmark } from "@/components/BrandWordmark";
import { openCookiePreferences } from "@/lib/cookie-consent";

type LegalSection = {
  title: string;
  body: string[];
};

type LegalDocument = {
  title: string;
  lead: string;
  updatedAt: string;
  icon: typeof ShieldCheck;
  sections: LegalSection[];
};

const legalAdminName =
  import.meta.env.VITE_LEGAL_ADMIN_NAME?.trim() || "ZmierzymyCzas.pl";
const legalAdminAddress =
  import.meta.env.VITE_LEGAL_ADMIN_ADDRESS?.trim() ||
  "adres korespondencyjny wskazany w umowie lub panelu kontaktowym administratora";
const legalContactEmail =
  import.meta.env.VITE_LEGAL_CONTACT_EMAIL?.trim() ||
  "kanał kontaktowy wskazany w serwisie zmierzymyczas.pl";

const legalDocuments: Record<string, LegalDocument> = {
  privacy: {
    title: "Polityka prywatności i RODO",
    lead:
      "Informacje o przetwarzaniu danych osobowych użytkowników panelu Biuro Zawodów.",
    updatedAt: "24 maja 2026",
    icon: ShieldCheck,
    sections: [
      {
        title: "Administrator danych",
        body: [
          `Administratorem danych jest ${legalAdminName}, operator usługi udostępniający panel Biuro Zawodów. Adres korespondencyjny: ${legalAdminAddress}.`,
          `Sprawy dotyczące ochrony danych osobowych należy kierować na: ${legalContactEmail}.`,
        ],
      },
      {
        title: "Zakres danych",
        body: [
          "Panel może przetwarzać dane kont użytkowników, organizacji, wydarzeń, uczestników zawodów, zgłoszeń, odpraw, kodów QR, historii importu CSV, logów technicznych i działań administracyjnych.",
          "Zakres danych uczestników zależy od importu i konfiguracji wydarzenia. Może obejmować imię, nazwisko, e-mail, telefon, numer startowy, kategorię, klub, miasto, kraj, status płatności, notatki organizacyjne i dane potrzebne do obsługi biura zawodów.",
        ],
      },
      {
        title: "Cele i podstawy prawne",
        body: [
          "Dane są przetwarzane w celu prowadzenia kont użytkowników, obsługi wydarzeń sportowych, weryfikacji uprawnień, odprawy uczestników, wysyłki kodów QR, bezpieczeństwa aplikacji oraz dokumentowania działań w systemie.",
          "Podstawą przetwarzania jest wykonanie umowy lub działań przed jej zawarciem, obowiązek prawny, prawnie uzasadniony interes administratora polegający na zabezpieczeniu i rozliczalności usługi oraz zgoda tam, gdzie jest wymagana, w szczególności dla analityki i nagrywania sesji.",
        ],
      },
      {
        title: "Mouseflow i analityka",
        body: [
          "Mouseflow jest narzędziem analitycznym do nagrywania sesji, map aktywności i diagnostyki użyteczności. Skrypt Mouseflow w tej aplikacji ładuje się dopiero po wyrażeniu zgody na analitykę.",
          "Aplikacja oznacza pola formularzy jako pomijane w Mouseflow. Przed produkcyjnym użyciem należy dodatkowo skonfigurować maskowanie w panelu Mouseflow, podpisać DPA, ograniczyć retencję nagrań i wykluczyć widoki zawierające dane szczególnie wrażliwe albo zbędne do diagnostyki.",
        ],
      },
      {
        title: "Odbiorcy danych i powierzenie",
        body: [
          "Dane mogą być przekazywane dostawcom hostingu, poczty, utrzymania systemu, narzędzi diagnostycznych i podmiotom wspierającym administratora w realizacji usługi.",
          "Z każdym procesorem, który przetwarza dane osobowe w imieniu administratora, należy zawrzeć umowę powierzenia przetwarzania danych. Dotyczy to także Mouseflow, jeżeli analityka jest aktywna.",
        ],
      },
      {
        title: "Okres przechowywania",
        body: [
          "Dane są przechowywane przez okres niezbędny do realizacji usługi, obsługi wydarzeń, rozliczeń, dochodzenia lub obrony roszczeń oraz spełnienia obowiązków prawnych.",
          "Dane analityczne i nagrania sesji powinny mieć możliwie krótką retencję, dopasowaną do celu diagnostycznego i ustawioną w panelu dostawcy.",
        ],
      },
      {
        title: "Prawa osób",
        body: [
          "Osobie, której dane dotyczą, przysługuje prawo dostępu do danych, sprostowania, usunięcia, ograniczenia przetwarzania, przenoszenia danych, sprzeciwu oraz wycofania zgody bez wpływu na zgodność wcześniejszego przetwarzania.",
          "Osoba, której dane dotyczą, ma prawo wnieść skargę do Prezesa Urzędu Ochrony Danych Osobowych.",
        ],
      },
    ],
  },
  terms: {
    title: "Regulamin aplikacji",
    lead:
      "Zasady korzystania z panelu Biuro Zawodów przez organizatorów, administratorów i operatorów.",
    updatedAt: "24 maja 2026",
    icon: Scale,
    sections: [
      {
        title: "Charakter usługi",
        body: [
          "Biuro Zawodów jest panelem służącym do organizacyjnej obsługi wydarzeń sportowych, w szczególności zarządzania wydarzeniami, uczestnikami, importem CSV, odprawą i wysyłką kodów QR.",
          "Aplikacja jest przeznaczona dla uprawnionych użytkowników. Dostęp wymaga konta i roli nadanej przez administratora lub organizację.",
        ],
      },
      {
        title: "Obowiązki użytkownika",
        body: [
          "Użytkownik powinien korzystać z aplikacji zgodnie z prawem, nadanymi uprawnieniami, instrukcjami administratora oraz zasadą minimalizacji danych.",
          "Zabronione jest udostępnianie konta osobom trzecim, obchodzenie zabezpieczeń, importowanie danych bez podstawy prawnej oraz wykorzystywanie danych uczestników poza celem obsługi wydarzenia.",
        ],
      },
      {
        title: "Dane i odpowiedzialność organizatora",
        body: [
          "Organizator odpowiada za poprawność i legalność danych importowanych do aplikacji oraz za poinformowanie uczestników o przetwarzaniu ich danych, jeżeli działa jako administrator albo współadministrator danych.",
          "Operator aplikacji odpowiada za utrzymanie systemu w zakresie określonym umową lub ustaleniami z organizatorem.",
        ],
      },
      {
        title: "Bezpieczeństwo",
        body: [
          "Użytkownik powinien chronić hasło, wylogowywać się z urządzeń współdzielonych i nie zapisywać danych uczestników poza zatwierdzonymi narzędziami.",
          "Podejrzenie naruszenia bezpieczeństwa należy niezwłocznie zgłosić administratorowi usługi.",
        ],
      },
      {
        title: "Zmiany regulaminu",
        body: [
          "Regulamin może być aktualizowany wraz ze zmianami aplikacji, prawa lub modelu świadczenia usługi. Aktualna wersja jest dostępna w aplikacji.",
        ],
      },
    ],
  },
  cookies: {
    title: "Polityka cookies",
    lead:
      "Informacje o plikach cookies, pamięci lokalnej i zgodach na analitykę.",
    updatedAt: "24 maja 2026",
    icon: Cookie,
    sections: [
      {
        title: "Rodzaje wykorzystywanych technologii",
        body: [
          "Aplikacja używa cookies i pamięci lokalnej przeglądarki do utrzymania sesji, bezpieczeństwa, zapamiętania ustawień interfejsu oraz zapisania decyzji o zgodzie.",
          "Analityka Mouseflow jest opcjonalna. Skrypt ładuje się wyłącznie po wyrażeniu zgody na analitykę i nagrywanie sesji.",
        ],
      },
      {
        title: "Cookies niezbędne",
        body: [
          "Niezbędne cookies są wymagane do działania aplikacji, logowania, zabezpieczenia sesji, zapamiętania stanu panelu bocznego i zapisania preferencji prywatności.",
          "Tych cookies nie można wyłączyć w panelu preferencji, ponieważ bez nich aplikacja nie działałaby prawidłowo.",
        ],
      },
      {
        title: "Analityka Mouseflow",
        body: [
          "Po zgodzie Mouseflow może zapisywać identyfikatory sesji i zbierać informacje o interakcjach w aplikacji w celu diagnozowania problemów UX.",
          "Zgoda jest dobrowolna i może zostać zmieniona w dowolnym momencie. Brak zgody nie ogranicza dostępu do aplikacji.",
        ],
      },
      {
        title: "Zmiana zgody",
        body: [
          "Preferencje można zmienić przyciskiem poniżej albo linkiem w stopce logowania i w panelu bocznym po zalogowaniu.",
        ],
      },
    ],
  },
  dpa: {
    title: "Powierzenie przetwarzania danych",
    lead:
      "Lista kontrolna umów powierzenia i wymagań dla dostawców przetwarzających dane.",
    updatedAt: "24 maja 2026",
    icon: FileText,
    sections: [
      {
        title: "Wymagane umowy",
        body: [
          "Przed produkcyjnym uruchomieniem należy mieć podpisane lub zaakceptowane umowy powierzenia z dostawcami, którzy przetwarzają dane osobowe w imieniu administratora.",
          "Dotyczy to w szczególności hostingu, poczty transakcyjnej, obsługi technicznej, kopii zapasowych i Mouseflow, jeżeli włączona jest analityka.",
        ],
      },
      {
        title: "Minimalne wymagania dla Mouseflow",
        body: [
          "W panelu Mouseflow należy wymusić maskowanie pól formularzy, wykluczyć strony zawierające dane zbędne do diagnozy UX, ustawić retencję nagrań, ograniczyć dostęp użytkowników i udokumentować podstawę prawną zgody.",
          "Klucze projektów Mouseflow powinny być rozdzielone na staging i produkcję przez zmienne VITE_MOUSEFLOW_PROJECT_ID w odpowiednich plikach środowiskowych.",
        ],
      },
      {
        title: "Dokumentacja",
        body: [
          "Administrator powinien prowadzić rejestr czynności przetwarzania lub równoważną dokumentację, uwzględniającą cele, kategorie danych, odbiorców, retencję i środki bezpieczeństwa.",
        ],
      },
    ],
  },
};

const legalLinks = [
  { to: "/legal/privacy", label: "Prywatność i RODO" },
  { to: "/legal/terms", label: "Regulamin" },
  { to: "/legal/cookies", label: "Cookies" },
  { to: "/legal/dpa", label: "Powierzenie danych" },
];

export default function Legal() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const document = slug ? legalDocuments[slug] : null;

  if (!document) {
    return <Navigate to="/legal/privacy" replace />;
  }

  const Icon = document.icon;

  return (
    <main className="min-h-app-viewport bg-[linear-gradient(180deg,hsl(220_18%_5%)_0%,hsl(220_18%_4%)_100%)] px-4 py-6 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-5 rounded-[1.35rem] border border-white/10 bg-white/[0.03] p-5 shadow-[0_24px_70px_hsl(var(--surface-shadow)/0.38)] backdrop-blur-xl sm:p-6">
          <div className="flex items-center">
            <Link to="/login" className="w-fit">
              <BrandWordmark
                className="w-32 sm:w-36"
                imageClassName="h-auto w-full object-contain"
              />
            </Link>
          </div>

          <div className="grid gap-4 md:grid-cols-[auto_1fr] md:items-start">
            <div className="flex h-12 w-12 items-center justify-center rounded-[1rem] border border-[hsl(var(--button-highlight)/0.24)] bg-[hsl(var(--button-highlight)/0.12)] text-[hsl(var(--button-highlight))]">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Aktualizacja: {document.updatedAt}
              </p>
              <h1 className="mt-2 text-3xl font-semibold leading-tight tracking-normal md:text-4xl">
                {document.title}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground md:text-base">
                {document.lead}
              </p>
            </div>
          </div>
        </header>

        <div className="grid gap-5 lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start">
          <aside className="rounded-[1.1rem] border border-white/10 bg-white/[0.025] p-4 lg:sticky lg:top-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/login")}
              className="h-auto w-fit touch-manipulation rounded-full px-1 py-1 text-[0.98rem] font-medium text-[hsl(var(--button-highlight))] hover:bg-transparent hover:text-[hsl(var(--button-highlight))]"
            >
              <ArrowLeft className="mr-1 h-4 w-4" aria-hidden="true" />
              Wróć
            </Button>

            <nav
              className="mt-5 grid gap-1 border-t border-white/10 pt-4"
              aria-label="Dokumenty prawne"
            >
              {legalLinks.map((link) => {
                const isActive = link.to.endsWith(slug ?? "");

                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    aria-current={isActive ? "page" : undefined}
                    className={`rounded-[0.8rem] px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-[hsl(var(--button-highlight)/0.18)] text-foreground shadow-[inset_0_0_0_1px_hsl(var(--button-highlight)/0.22)]"
                        : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </aside>

          <div className="min-w-0 space-y-4">
            <article className="space-y-4">
              {document.sections.map((section) => (
                <section
                  key={section.title}
                  className="rounded-[1.15rem] border border-white/10 bg-[linear-gradient(180deg,hsl(220_12%_10%/0.9),hsl(220_14%_7%/0.9))] p-5 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.04)]"
                >
                  <h2 className="text-xl font-semibold tracking-normal">
                    {section.title}
                  </h2>
                  <div className="mt-3 space-y-3 text-sm leading-7 text-muted-foreground">
                    {section.body.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>
                </section>
              ))}
            </article>

            {slug === "cookies" && (
              <div className="rounded-[1.15rem] border border-[hsl(var(--button-highlight)/0.22)] bg-[hsl(var(--button-highlight)/0.08)] p-5">
                <Button
                  type="button"
                  className="rounded-[0.95rem]"
                  onClick={openCookiePreferences}
                >
                  <Cookie className="h-4 w-4" aria-hidden="true" />
                  Otwórz preferencje cookies
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
