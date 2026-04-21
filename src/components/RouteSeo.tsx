import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const APP_NAME = "Biuro Zawodow";
const DEFAULT_DESCRIPTION =
  "Panel do zarzadzania wydarzeniami sportowymi, uczestnikami, odprawa, importem CSV i obsluga kodow QR.";

type SeoConfig = {
  title: string;
  description: string;
};

function upsertMeta(selector: string, attributes: Record<string, string>) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);

  if (!element) {
    element = document.createElement("meta");
    document.head.appendChild(element);
  }

  Object.entries(attributes).forEach(([key, value]) => {
    element?.setAttribute(key, value);
  });
}

function getSeoConfig(pathname: string): SeoConfig {
  if (pathname === "/login") {
    return {
      title: `Logowanie | ${APP_NAME}`,
      description:
        "Logowanie do panelu Biuro Zawodow dla organizatorow, biura zawodow i operatorow QR.",
    };
  }

  if (pathname === "/reset-password") {
    return {
      title: `Reset hasla | ${APP_NAME}`,
      description:
        "Ustaw nowe haslo i odzyskaj dostep do panelu Biuro Zawodow.",
    };
  }

  if (pathname === "/forgot-password") {
    return {
      title: `Przypomnienie hasla | ${APP_NAME}`,
      description:
        "Wyslij link do resetu hasla i odzyskaj dostep do panelu Biuro Zawodow.",
    };
  }

  if (pathname === "/401") {
    return {
      title: `401 | ${APP_NAME}`,
      description:
        "Logowanie jest wymagane, aby uzyskac dostep do tej czesci panelu.",
    };
  }

  if (pathname === "/403") {
    return {
      title: `403 | ${APP_NAME}`,
      description:
        "Brak uprawnien do wyswietlenia tej sekcji panelu Biuro Zawodow.",
    };
  }

  if (pathname === "/404") {
    return {
      title: `404 | ${APP_NAME}`,
      description:
        "Strona nie istnieje lub zostala przeniesiona do innej czesci aplikacji.",
    };
  }

  if (pathname === "/") {
    return {
      title: `Panel | ${APP_NAME}`,
      description:
        "Panel glowny z podgladem aktywnych, nadchodzacych i zakonczonych wydarzen sportowych.",
    };
  }

  if (pathname.startsWith("/events/") && pathname.includes("/participants/")) {
    return {
      title: `Szczegoly uczestnika | ${APP_NAME}`,
      description:
        "Podglad danych uczestnika, statusu odprawy i operacji powiazanych z kodem QR.",
    };
  }

  if (pathname.startsWith("/events/") && pathname.endsWith("/participants")) {
    return {
      title: `Uczestnicy | ${APP_NAME}`,
      description:
        "Zarzadzanie lista uczestnikow wydarzenia, statusami, pakietami startowymi i odprawa.",
    };
  }

  if (pathname.startsWith("/events/") && pathname.endsWith("/import")) {
    return {
      title: `Import CSV | ${APP_NAME}`,
      description:
        "Import list uczestnikow i mapowanie danych CSV w panelu Biuro Zawodow.",
    };
  }

  if (pathname.startsWith("/events/") && pathname.endsWith("/emails")) {
    return {
      title: `Wysylka e-maili | ${APP_NAME}`,
      description:
        "Masowa wysylka wiadomosci i kodow QR do uczestnikow wybranego wydarzenia.",
    };
  }

  if (pathname.startsWith("/events/")) {
    return {
      title: `Szczegoly wydarzenia | ${APP_NAME}`,
      description:
        "Zarzadzanie szczegolami wydarzenia, uczestnikami, eksportami i komunikacja QR.",
    };
  }

  if (pathname === "/events") {
    return {
      title: `Wydarzenia | ${APP_NAME}`,
      description:
        "Lista wydarzen sportowych z dostepem do edycji, importow i obslugi biura zawodow.",
    };
  }

  if (pathname === "/scanner") {
    return {
      title: `Skaner QR | ${APP_NAME}`,
      description:
        "Skanowanie kodow QR uczestnikow i szybka obsluga odprawy w biurze zawodow.",
    };
  }

  if (pathname === "/scanner-info") {
    return {
      title: `Informacje dla operatora | ${APP_NAME}`,
      description:
        "Informacje o dostepnosci przypisanych wydarzen i pracy operatora QR.",
    };
  }

  if (pathname.startsWith("/organizations/")) {
    return {
      title: `Szczegoly organizacji | ${APP_NAME}`,
      description:
        "Zarzadzanie organizacja, wydarzeniami i limitami w panelu Biuro Zawodow.",
    };
  }

  if (pathname === "/organizations" || pathname === "/users") {
    return {
      title: `Organizacje i uzytkownicy | ${APP_NAME}`,
      description:
        "Zarzadzanie organizacjami, uzytkownikami i uprawnieniami systemowymi.",
    };
  }

  if (pathname === "/profile") {
    return {
      title: `Profil | ${APP_NAME}`,
      description:
        "Ustawienia konta uzytkownika i zmiana hasla w panelu Biuro Zawodow.",
    };
  }

  return {
    title: APP_NAME,
    description: DEFAULT_DESCRIPTION,
  };
}

export function RouteSeo() {
  const location = useLocation();

  useEffect(() => {
    const { title, description } = getSeoConfig(location.pathname);

    document.title = title;

    upsertMeta('meta[name="description"]', {
      name: "description",
      content: description,
    });
    upsertMeta('meta[name="robots"]', {
      name: "robots",
      content: "noindex, nofollow, noarchive",
    });
    upsertMeta('meta[property="og:title"]', {
      property: "og:title",
      content: title,
    });
    upsertMeta('meta[property="og:description"]', {
      property: "og:description",
      content: description,
    });
    upsertMeta('meta[name="twitter:title"]', {
      name: "twitter:title",
      content: title,
    });
    upsertMeta('meta[name="twitter:description"]', {
      name: "twitter:description",
      content: description,
    });
  }, [location.pathname]);

  return null;
}
