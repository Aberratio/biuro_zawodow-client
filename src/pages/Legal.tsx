import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Cookie, FileText, Scale, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandWordmark } from "@/components/BrandWordmark";
import { openCookiePreferences } from "@/lib/cookie-consent";
import { cn } from "@/lib/utils";

type LegalSection = {
  title: string;
  body: LegalBlock[];
};

type LegalBlock = string | { items: string[] };

type LegalDocument = {
  title: string;
  lead: string;
  updatedAt: string;
  icon: typeof ShieldCheck;
  sections: LegalSection[];
};

const legalDocuments: Record<string, LegalDocument> = {
  privacy: {
    title: "Polityka Prywatności",
    lead: "Zasady przetwarzania danych osobowych użytkowników biura zawodów.",
    updatedAt: "26 maja 2026 r.",
    icon: ShieldCheck,
    sections: [
      {
        title: "1. Informacje podstawowe",
        body: [
          "Niniejsza Polityka Prywatności określa zasady przetwarzania danych osobowych użytkowników serwisu internetowego www.zmierzymyczas.pl",
          "Administratorem danych osobowych jest:",
          "Dobre Czasy s.c.\nul. Morcinka 43\n45-531 Opole\nPolska",
          "Kontakt w sprawach związanych z ochroną danych osobowych:\nE-mail: biuro@zmierzymyczas.pl\nTelefon: 501 146 066, 604 429 349",
          "Administrator dokłada szczególnej staranności w celu ochrony prywatności użytkowników oraz bezpieczeństwa przekazywanych danych osobowych.",
        ],
      },
      {
        title: "2. Zakres zbieranych danych",
        body: [
          "W zależności od celu korzystania z serwisu możemy przetwarzać następujące dane:",
          {
            items: [
              "imię i nazwisko,",
              "adres e-mail,",
              "numer telefonu,",
              "data urodzenia,",
              "płeć,",
              "miejscowość,",
              "klub sportowy,",
              "numer startowy,",
              "wyniki sportowe,",
              "dane dotyczące płatności,",
              "adres IP,",
              "dane zapisywane w plikach cookies,",
              "dane techniczne dotyczące urządzenia i przeglądarki.",
            ],
          },
          "Podanie danych jest dobrowolne, jednak w niektórych przypadkach niezbędne do realizacji usługi, w szczególności zapisów na wydarzenia sportowe.",
        ],
      },
      {
        title: "3. Cele i podstawy prawne przetwarzania danych",
        body: [
          "Dane osobowe przetwarzane są zgodnie z Rozporządzeniem Parlamentu Europejskiego i Rady (UE) 2016/679 (RODO).",
          "Dane przetwarzamy w następujących celach:",
          "a) Realizacja zapisów na wydarzenia sportowe",
          "Podstawa prawna: art. 6 ust. 1 lit. b RODO – wykonanie umowy.",
          "Obejmuje m.in.:",
          {
            items: [
              "rejestrację uczestników,",
              "prowadzenie list startowych,",
              "pomiar czasu,",
              "publikację wyników,",
              "kontakt organizacyjny,",
              "obsługę płatności.",
            ],
          },
          "b) Realizacja obowiązków prawnych",
          "Podstawa prawna: art. 6 ust. 1 lit. c RODO.",
          "Dotyczy to m.in. obowiązków księgowych i podatkowych.",
          "c) Marketing własnych usług",
          "Podstawa prawna: art. 6 ust. 1 lit. f RODO – prawnie uzasadniony interes administratora.",
          "Obejmuje m.in.:",
          {
            items: [
              "wysyłkę informacji o wydarzeniach,",
              "publikację materiałów promocyjnych,",
              "prowadzenie statystyk i analiz.",
            ],
          },
          "d) Zgoda użytkownika",
          "Podstawa prawna: art. 6 ust. 1 lit. a RODO.",
          "Dotyczy działań wymagających odrębnej zgody, np. marketingu partnerów lub zapisów do newslettera.",
          "Zgodę można wycofać w dowolnym momencie.",
        ],
      },
      {
        title: "4. Publikacja wyników sportowych i wizerunku",
        body: [
          "W związku z organizacją wydarzeń sportowych Administrator może publikować:",
          {
            items: [
              "listy startowe,",
              "wyniki zawodów,",
              "galerie zdjęć,",
              "materiały video,",
              "relacje z wydarzeń.",
            ],
          },
          "Publikowane dane mogą obejmować:",
          {
            items: [
              "imię i nazwisko,",
              "miejscowość,",
              "klub,",
              "kategorię wiekową,",
              "osiągnięty wynik,",
              "wizerunek utrwalony podczas wydarzenia.",
            ],
          },
          "Publikacja wyników i relacji stanowi uzasadniony interes administratora związany z organizacją wydarzeń sportowych.",
        ],
      },
      {
        title: "5. Odbiorcy danych",
        body: [
          "Dane mogą być przekazywane podmiotom współpracującym z Administratorem wyłącznie w zakresie niezbędnym do realizacji usług, w szczególności:",
          {
            items: [
              "organizatorom wydarzeń sportowych,",
              "operatorom płatności,",
              "dostawcom hostingu,",
              "firmom świadczącym usługi IT,",
              "podmiotom obsługującym mailing,",
              "firmom księgowym,",
              "podmiotom odpowiedzialnym za pomiar czasu.",
            ],
          },
          "Dane mogą zostać udostępnione również uprawnionym organom publicznym, jeśli wymagają tego przepisy prawa.",
        ],
      },
      {
        title: "6. Okres przechowywania danych",
        body: [
          "Dane będą przechowywane:",
          {
            items: [
              "przez okres niezbędny do realizacji usług,",
              "przez okres wymagany przepisami prawa,",
              "do momentu przedawnienia roszczeń,",
              "do czasu wycofania zgody – w przypadku danych przetwarzanych na podstawie zgody.",
            ],
          },
          "Wyniki sportowe mogą być przechowywane bezterminowo ze względu na historyczny i archiwalny charakter danych sportowych.",
        ],
      },
      {
        title: "7. Prawa użytkownika",
        body: [
          "Każdej osobie, której dane dotyczą, przysługuje prawo do:",
          {
            items: [
              "dostępu do danych,",
              "sprostowania danych,",
              "usunięcia danych,",
              "ograniczenia przetwarzania,",
              "przenoszenia danych,",
              "wniesienia sprzeciwu wobec przetwarzania,",
              "cofnięcia zgody,",
              "wniesienia skargi do Prezesa Urzędu Ochrony Danych Osobowych.",
            ],
          },
          "Kontakt w sprawach dotyczących realizacji praw użytkownika: biuro@zmierzymyczas.pl",
        ],
      },
      {
        title: "8. Pliki cookies",
        body: [
          "Serwis wykorzystuje pliki cookies oraz podobne technologie w celu:",
          {
            items: [
              "prawidłowego działania strony,",
              "utrzymania sesji użytkownika,",
              "prowadzenia statystyk,",
              "poprawy jakości usług,",
              "działań marketingowych.",
            ],
          },
          "Cookies mogą być wykorzystywane przez:",
          {
            items: [
              "narzędzie Smartlook do analityki i nagrywania sesji po uzyskaniu zgody użytkownika,",
              "inne narzędzia analityczne i marketingowe, jeżeli zostaną wdrożone w serwisie.",
            ],
          },
          "Użytkownik może samodzielnie zarządzać ustawieniami cookies w swojej przeglądarce.",
          "Jeżeli serwis korzysta z banera zgód cookies, użytkownik może zmienić swoje preferencje w dowolnym momencie.",
        ],
      },
      {
        title: "9. Profilowanie",
        body: [
          "Dane użytkowników mogą być przetwarzane w sposób zautomatyzowany, w tym profilowane, wyłącznie w zakresie niezbędnym do działań marketingowych oraz statystycznych.",
          "Profilowanie nie wywołuje skutków prawnych wobec użytkownika.",
        ],
      },
      {
        title: "10. Bezpieczeństwo danych",
        body: [
          "Administrator stosuje odpowiednie środki techniczne i organizacyjne zapewniające ochronę przetwarzanych danych osobowych odpowiednią do zagrożeń oraz kategorii danych objętych ochroną.",
        ],
      },
      {
        title: "11. Linki do innych stron",
        body: [
          "Serwis może zawierać odnośniki do innych stron internetowych. Administrator nie odpowiada za zasady prywatności obowiązujące na tych stronach.",
        ],
      },
      {
        title: "12. Zmiany polityki prywatności",
        body: [
          "Administrator zastrzega sobie prawo do wprowadzania zmian w niniejszej Polityce Prywatności.",
          "Aktualna wersja dokumentu jest zawsze dostępna na stronie: www.zmierzymyczas.pl",
        ],
      },
      {
        title: "13. Data obowiązywania",
        body: [
          "Polityka Prywatności obowiązuje od dnia: 26 maja 2026 r.",
        ],
      },
    ],
  },
  terms: {
    title: "Regulamin",
    lead:
      "Regulamin świadczenia usług drogą elektroniczną dla systemu biura zawodów.",
    updatedAt: "26 maja 2026 r.",
    icon: Scale,
    sections: [
      {
        title: "§1. Postanowienia ogólne",
        body: [
          "Niniejszy Regulamin określa zasady korzystania z internetowego systemu obsługi biura zawodów udostępnianego przez Dobre Czasy s.c.",
          "System służy do obsługi wydarzeń sportowych, w szczególności:",
          {
            items: [
              "zarządzania biurem zawodów,",
              "weryfikacji uczestników,",
              "wydawania pakietów startowych,",
              "obsługi kodów QR,",
              "zarządzania listami startowymi,",
              "obsługi zapisów,",
              "kontroli wydanych pakietów,",
              "prowadzenia odpraw i rejestracji uczestników,",
              "komunikacji organizacyjnej związanej z wydarzeniem sportowym.",
            ],
          },
          "Regulamin stanowi regulamin świadczenia usług drogą elektroniczną w rozumieniu ustawy z dnia 18 lipca 2002 r. o świadczeniu usług drogą elektroniczną.",
          "Korzystanie z Systemu oznacza akceptację niniejszego Regulaminu.",
        ],
      },
      {
        title: "§2. Dane Usługodawcy",
        body: [
          "Usługodawcą i operatorem Systemu jest:",
          "DOBRE CZASY SPÓŁKA CYWILNA SŁAWOMIR SMOLIŃSKI, KRZYSZTOF DRUSZCZ\nul. Gustawa Morcinka 43\n45-531 Opole\nNIP: 7543099101\nREGON: 362696290",
          "Kontakt:",
          "e-mail: BIURO@ZMIERZMYCZAS.PL\ntel.: 501 146 066 / 604 429 349",
        ],
      },
      {
        title: "§3. Definicje",
        body: [
          "Użyte w Regulaminie określenia oznaczają:",
          {
            items: [
              "System – internetowa platforma biura zawodów dostępna pod adresem biuro.zmierzymyczas.pl;",
              "Usługodawca – Dobre Czasy s.c.;",
              "Organizator – podmiot korzystający z Systemu w celu obsługi wydarzenia sportowego;",
              "Operator Biura – osoba upoważniona przez Organizatora do korzystania z Systemu;",
              "Uczestnik – osoba zgłoszona do udziału w wydarzeniu sportowym;",
              "Kod QR – indywidualny kod identyfikacyjny przypisany uczestnikowi;",
              "Wydarzenie – impreza sportowa obsługiwana za pomocą Systemu;",
              "Konto – indywidualny dostęp do Systemu zabezpieczony loginem i hasłem.",
            ],
          },
        ],
      },
      {
        title: "§4. Zakres świadczonych usług",
        body: [
          "System umożliwia:",
          {
            items: [
              "obsługę biura zawodów,",
              "rejestrację uczestników,",
              "skanowanie kodów QR,",
              "weryfikację danych uczestników,",
              "oznaczanie wydanych pakietów startowych,",
              "kontrolę statusu uczestnika,",
              "eksport danych,",
              "obsługę wielu wydarzeń sportowych,",
              "zarządzanie operatorami biura,",
              "generowanie list i raportów.",
            ],
          },
          "Usługodawca może rozwijać funkcjonalności Systemu bez konieczności zmiany Regulaminu, o ile nie wpływa to na prawa użytkowników.",
          "System może być czasowo niedostępny z przyczyn technicznych, serwisowych lub bezpieczeństwa.",
        ],
      },
      {
        title: "§5. Warunki korzystania z Systemu",
        body: [
          "Korzystanie z Systemu wymaga:",
          {
            items: [
              "dostępu do Internetu,",
              "aktualnej przeglądarki internetowej,",
              "urządzenia umożliwiającego odczyt kodów QR (w przypadku korzystania z funkcji skanowania).",
            ],
          },
          "Organizator zobowiązany jest:",
          {
            items: [
              "podawać prawdziwe dane,",
              "zabezpieczać dane logowania,",
              "korzystać z Systemu zgodnie z prawem,",
              "nie udostępniać kont osobom nieuprawnionym.",
            ],
          },
          "Zabrania się:",
          {
            items: [
              "podejmowania prób ingerencji w działanie Systemu,",
              "kopiowania lub modyfikowania Systemu bez zgody Usługodawcy,",
              "wykorzystywania Systemu do działań niezgodnych z prawem.",
            ],
          },
        ],
      },
      {
        title: "§6. Kody QR i bezpieczeństwo identyfikacji",
        body: [
          "Każdy kod QR przypisany jest indywidualnie do konkretnego uczestnika.",
          "Organizator odpowiada za prawidłową weryfikację uczestnika podczas wydawania pakietu startowego.",
          "Zeskanowanie kodu QR może skutkować:",
          {
            items: [
              "oznaczeniem uczestnika jako zweryfikowanego,",
              "potwierdzeniem odbioru pakietu,",
              "zmianą statusu uczestnika w Systemie.",
            ],
          },
          "Usługodawca nie odpowiada za błędy wynikające z:",
          {
            items: [
              "przekazania kodu QR osobom trzecim,",
              "błędnej obsługi przez Organizatora,",
              "działania urządzeń zewnętrznych,",
              "braku dostępu do Internetu po stronie Organizatora.",
            ],
          },
          "Organizator zobowiązany jest do ochrony danych uczestników zgodnie z obowiązującymi przepisami prawa, w szczególności RODO.",
        ],
      },
      {
        title: "§7. Dane osobowe i RODO",
        body: [
          "Administratorem danych osobowych uczestników jest Organizator wydarzenia sportowego.",
          "Dobre Czasy s.c. działa jako podmiot przetwarzający dane na podstawie art. 28 RODO, w zakresie niezbędnym do świadczenia usług Systemu.",
          "Szczegółowe zasady przetwarzania danych określa Polityka Prywatności dostępna w Serwisie.",
          "Organizator zobowiązany jest posiadać odpowiednie podstawy prawne do przetwarzania danych uczestników.",
        ],
      },
      {
        title: "§8. Odpowiedzialność",
        body: [
          "Usługodawca dokłada należytej staranności w celu zapewnienia prawidłowego działania Systemu.",
          "Usługodawca nie ponosi odpowiedzialności za:",
          {
            items: [
              "przerwy wynikające z działania siły wyższej,",
              "problemy po stronie dostawców Internetu,",
              "błędne dane wprowadzone przez Organizatora,",
              "szkody wynikające z nieprawidłowego korzystania z Systemu,",
              "utratę danych wynikającą z działań osób nieuprawnionych po stronie Organizatora.",
            ],
          },
          "Organizator odpowiada za:",
          {
            items: [
              "poprawność danych uczestników,",
              "zgodność wydarzenia z obowiązującymi przepisami,",
              "legalność przetwarzania danych,",
              "prawidłowość procesu wydawania pakietów.",
            ],
          },
        ],
      },
      {
        title: "§9. Reklamacje",
        body: [
          "Reklamacje dotyczące działania Systemu można składać:",
          {
            items: ["mailowo na adres: BIURO@ZMIERZMYCZAS.PL"],
          },
          "Reklamacja powinna zawierać:",
          {
            items: [
              "dane zgłaszającego,",
              "opis problemu,",
              "datę wystąpienia problemu,",
              "nazwę wydarzenia.",
            ],
          },
          "Reklamacje rozpatrywane są w terminie do 14 dni roboczych.",
        ],
      },
      {
        title: "§10. Prawa autorskie",
        body: [
          "System, jego wygląd, kod źródłowy, funkcjonalności oraz materiały graficzne podlegają ochronie prawnej.",
          "Zabrania się kopiowania, rozpowszechniania lub wykorzystywania elementów Systemu bez zgody Usługodawcy.",
        ],
      },
      {
        title: "§11. Postanowienia końcowe",
        body: [
          "W sprawach nieuregulowanych Regulaminem zastosowanie mają przepisy:",
          {
            items: [
              "Kodeksu cywilnego,",
              "ustawy o świadczeniu usług drogą elektroniczną,",
              "ustawy o prawach konsumenta,",
              "RODO,",
              "innych właściwych przepisów prawa polskiego.",
            ],
          },
          "Regulamin dostępny jest nieodpłatnie w formie elektronicznej.",
          "Usługodawca zastrzega sobie prawo do zmiany Regulaminu z ważnych przyczyn prawnych, technicznych lub organizacyjnych.",
          "Zmiany Regulaminu publikowane będą w Systemie przed wejściem ich w życie.",
          "Regulamin obowiązuje od dnia: 26 maja 2026 r.",
        ],
      },
    ],
  },
  cookies: {
    title: "Polityka Cookies",
    lead: "Zasady wykorzystywania plików cookies w systemie biura zawodów.",
    updatedAt: "29 maja 2026 r.",
    icon: Cookie,
    sections: [
      {
        title: "§1. Informacje ogólne",
        body: [
          "1. Niniejsza Polityka Cookies określa zasady wykorzystywania plików cookies oraz podobnych technologii w serwisie:",
          "biuro.zmierzymyczas.pl",
          "2. Administratorem serwisu jest:",
          "DOBRE CZASY SPÓŁKA CYWILNA SŁAWOMIR SMOLIŃSKI, KRZYSZTOF DRUSZCZ\nul. Gustawa Morcinka 43\n45-531 Opole\nNIP: 7543099101\nREGON: 362696290",
          "Kontakt:",
          {
            items: ["BIURO@ZMIERZMYCZAS.PL", "501 146 066", "604 429 349"],
          },
        ],
      },
      {
        title: "§2. Czym są pliki cookies",
        body: [
          "1. Cookies to niewielkie pliki tekstowe zapisywane na urządzeniu użytkownika podczas korzystania ze strony internetowej.",
          "2. Cookies umożliwiają m.in.:",
          {
            items: [
              "prawidłowe działanie serwisu,",
              "utrzymanie sesji logowania,",
              "zwiększenie bezpieczeństwa,",
              "zapamiętywanie ustawień użytkownika,",
              "poprawę wydajności systemu.",
            ],
          },
        ],
      },
      {
        title: "§3. Rodzaje wykorzystywanych cookies",
        body: [
          "Serwis może wykorzystywać:",
          "a) Cookies niezbędne",
          "Są wymagane do prawidłowego działania systemu biura zawodów, w szczególności:",
          {
            items: [
              "logowania,",
              "utrzymania sesji,",
              "autoryzacji użytkownika,",
              "zabezpieczeń systemowych.",
            ],
          },
          "Bez tych plików korzystanie z systemu może być niemożliwe.",
          "b) Cookies funkcjonalne",
          "Pozwalają zapamiętać ustawienia użytkownika oraz usprawniają korzystanie z serwisu.",
          "c) Cookies analityczne",
          "Po wyrażeniu zgody serwis może uruchamiać Smartlook w celu analizy sposobu korzystania z panelu, wykrywania problemów technicznych i poprawy jakości obsługi.",
          {
            items: [
              "SL_C_23361dd035530_SID i SL_L_23361dd035530_SID - identyfikacja sesji, użytkownika i projektu Smartlook,",
              "SL_C_23361dd035530_DOMAIN - tymczasowe wykrycie domeny bazowej,",
              "SMARTLOOK_LS_QUEUED_CHUNKS - lokalne przechowanie danych oczekujących na wysłanie do Smartlook.",
            ],
          },
          "Pola formularzy i elementy oznaczone jako wrażliwe są maskowane przed nagrywaniem. Smartlook jest uruchamiany z regionem EU dopiero po wyrażeniu zgody na analitykę.",
          "d) Cookies bezpieczeństwa",
          "Wykorzystywane są do:",
          {
            items: [
              "ochrony przed nieautoryzowanym dostępem,",
              "wykrywania nadużyć,",
              "zabezpieczenia kont użytkowników.",
            ],
          },
        ],
      },
      {
        title: "§4. Zarządzanie cookies",
        body: [
          "1. Użytkownik może samodzielnie zarządzać ustawieniami cookies poprzez ustawienia swojej przeglądarki internetowej.",
          "2. Ograniczenie stosowania cookies może wpłynąć na działanie niektórych funkcji systemu.",
          "3. Szczegółowe informacje dotyczące zarządzania cookies dostępne są w ustawieniach przeglądarki internetowej użytkownika.",
        ],
      },
      {
        title: "§5. Dane osobowe",
        body: [
          "1. Pliki cookies mogą zawierać dane umożliwiające identyfikację użytkownika wyłącznie w zakresie niezbędnym do działania systemu.",
          "2. Szczegółowe informacje dotyczące przetwarzania danych osobowych znajdują się w Polityce Prywatności serwisu.",
        ],
      },
      {
        title: "§6. Zmiany polityki cookies",
        body: [
          "1. Administrator zastrzega sobie prawo do zmiany niniejszej Polityki Cookies.",
          "2. Aktualna wersja dokumentu publikowana jest w serwisie.",
          "3. Polityka Cookies obowiązuje od dnia: 26 maja 2026 r.",
        ],
      },
    ],
  },
  dpa: {
    title: "RODO",
    lead: "Umowa powierzenia przetwarzania danych osobowych.",
    updatedAt: "26 maja 2026 r.",
    icon: FileText,
    sections: [
      {
        title: "§1. Strony umowy",
        body: [
          "Umowa zawarta pomiędzy:",
          "Administratorem danych:",
          "Organizatorem wydarzenia sportowego korzystającym z systemu biuro.zmierzymyczas.pl",
          "a",
          "Podmiotem przetwarzającym:",
          "DOBRE CZASY SPÓŁKA CYWILNA SŁAWOMIR SMOLIŃSKI, KRZYSZTOF DRUSZCZ\nul. Gustawa Morcinka 43\n45-531 Opole\nNIP: 7543099101\nREGON: 362696290",
          "zwanym dalej „Procesorem”.",
        ],
      },
      {
        title: "§2. Przedmiot umowy",
        body: [
          "1. Administrator powierza Procesorowi przetwarzanie danych osobowych uczestników wydarzeń sportowych w zakresie niezbędnym do świadczenia usług systemu biura zawodów.",
          "2. Powierzenie obejmuje dane przetwarzane w systemie:",
          "biuro.zmierzymyczas.pl",
        ],
      },
      {
        title: "§3. Zakres i cel przetwarzania",
        body: [
          "1. Dane przetwarzane są wyłącznie w celu:",
          {
            items: [
              "obsługi biura zawodów,",
              "identyfikacji uczestników,",
              "obsługi kodów QR,",
              "wydawania pakietów startowych,",
              "prowadzenia list startowych,",
              "obsługi wyników i klasyfikacji,",
              "komunikacji organizacyjnej.",
            ],
          },
          "2. Zakres danych może obejmować:",
          {
            items: [
              "imię i nazwisko,",
              "adres e-mail,",
              "numer telefonu,",
              "miejscowość,",
              "klub sportowy,",
              "datę urodzenia,",
              "płeć,",
              "wyniki sportowe,",
              "identyfikatory uczestników,",
              "dane związane z uczestnictwem w wydarzeniu.",
            ],
          },
        ],
      },
      {
        title: "§4. Obowiązki Procesora",
        body: [
          "Procesor zobowiązuje się do:",
          {
            items: [
              "przetwarzania danych wyłącznie na udokumentowane polecenie Administratora,",
              "zapewnienia poufności danych,",
              "stosowania odpowiednich środków technicznych i organizacyjnych,",
              "zabezpieczenia danych przed utratą, zniszczeniem lub nieuprawnionym dostępem,",
              "dopuszczania do danych wyłącznie osób upoważnionych,",
              "wspierania Administratora w realizacji obowiązków wynikających z RODO.",
            ],
          },
        ],
      },
      {
        title: "§5. Podpowierzenie danych",
        body: [
          "1. Procesor może korzystać z podwykonawców świadczących usługi:",
          {
            items: [
              "hostingowe,",
              "informatyczne,",
              "serwerowe,",
              "związane z utrzymaniem systemu.",
            ],
          },
          "2. Procesor odpowiada za działania podwykonawców jak za własne.",
        ],
      },
      {
        title: "§6. Czas obowiązywania",
        body: [
          "1. Umowa obowiązuje przez okres korzystania z systemu biuro.zmierzymyczas.pl.",
          "2. Po zakończeniu współpracy dane mogą zostać usunięte lub zanonimizowane zgodnie z obowiązującymi przepisami prawa oraz polityką retencji danych.",
        ],
      },
      {
        title: "§7. Kontrola i odpowiedzialność",
        body: [
          "1. Administrator ma prawo zwrócić się do Procesora o informacje dotyczące sposobu przetwarzania danych.",
          "2. Procesor odpowiada za przetwarzanie danych zgodnie z obowiązującymi przepisami prawa.",
        ],
      },
      {
        title: "§8. Postanowienia końcowe",
        body: [
          "1. W sprawach nieuregulowanych zastosowanie mają przepisy RODO oraz prawa polskiego.",
          "2. Umowa stanowi integralną część korzystania z systemu biuro.zmierzymyczas.pl.",
          "3. Dokument obowiązuje od dnia: 26 maja 2026 r.",
        ],
      },
    ],
  },
};

const legalLinks = [
  { to: "/legal/privacy", label: "Polityka Prywatności" },
  { to: "/legal/terms", label: "Regulamin" },
  { to: "/legal/cookies", label: "Cookies" },
  { to: "/legal/dpa", label: "RODO" },
];

function getLegalParagraphClass(value: string) {
  const text = value.trim();
  const hasLineBreak = value.includes("\n");
  const isSubheading = /^[a-d]\)\s/.test(text);
  const isIntroLabel = text.endsWith(":");
  const isNumberedPoint = /^\d+\.\s/.test(text);

  return cn(
    "whitespace-pre-line text-[0.95rem] leading-7",
    hasLineBreak
      ? "rounded-[0.85rem] border border-white/10 bg-white/[0.035] px-4 py-3 font-medium text-foreground/85 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.04)]"
      : "text-foreground/72",
    isIntroLabel &&
      !hasLineBreak &&
      "pt-2 font-semibold text-foreground/90",
    isSubheading &&
      "mt-5 rounded-[0.75rem] bg-[hsl(var(--button-highlight)/0.1)] px-3 py-2 font-semibold text-foreground",
    isNumberedPoint &&
      "border-l border-[hsl(var(--button-highlight)/0.22)] pl-4",
  );
}

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

          <div className="min-w-0 space-y-5">
            <article className="space-y-5">
              {document.sections.map((section) => (
                <section
                  key={section.title}
                  className="overflow-hidden rounded-[1.15rem] border border-white/10 bg-[linear-gradient(180deg,hsl(220_12%_10%/0.92),hsl(220_14%_7%/0.92))] shadow-[inset_0_1px_0_hsl(var(--foreground)/0.04),0_18px_44px_hsl(var(--surface-shadow)/0.2)]"
                >
                  <div className="border-b border-white/10 bg-white/[0.025] px-5 py-4 sm:px-6">
                    <h2 className="text-xl font-semibold leading-snug tracking-normal text-foreground">
                      {section.title}
                    </h2>
                  </div>
                  <div className="space-y-4 px-5 py-5 sm:px-6">
                    {section.body.map((block, index) =>
                      typeof block === "string" ? (
                        <p
                          key={`${section.title}-${index}`}
                          className={getLegalParagraphClass(block)}
                        >
                          {block}
                        </p>
                      ) : (
                        <ul
                          key={`${section.title}-${index}`}
                          className="ml-2 list-disc space-y-2 border-l border-[hsl(var(--button-highlight)/0.24)] py-1 pl-8 marker:text-[hsl(var(--button-highlight))] sm:ml-4 sm:pl-9"
                        >
                          {block.items.map((item) => (
                            <li
                              key={item}
                              className="pl-1 text-[0.95rem] leading-7 text-foreground/76"
                            >
                              {item}
                            </li>
                          ))}
                        </ul>
                      ),
                    )}
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
