import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const APP_NAME = "Biuro Zawodów";
const DEFAULT_DESCRIPTION =
  "Panel do zarządzania wydarzeniami sportowymi, uczestnikami, odprawą, importem CSV i obsługą kodów QR.";

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
      description: "Logowanie do panelu Biuro Zawodów dla organizatorów, biura zawodów i operatorów QR.",
    };
  }

  if (pathname === "/reset-password") {
    return {
      title: `Reset hasła | ${APP_NAME}`,
      description: "Ustaw nowe hasło i odzyskaj dostęp do panelu Biuro Zawodów.",
    };
  }

  if (pathname === "/forgot-password") {
    return {
      title: `Przypomnienie hasła | ${APP_NAME}`,
      description: "Wyślij link do resetu hasła i odzyskaj dostęp do panelu Biuro Zawodów.",
    };
  }

  if (pathname === "/401") {
    return {
      title: `401 | ${APP_NAME}`,
      description: "Logowanie jest wymagane, aby uzyskać dostęp do tej części panelu.",
    };
  }

  if (pathname === "/403") {
    return {
      title: `403 | ${APP_NAME}`,
      description: "Brak uprawnień do wyświetlenia tej sekcji panelu Biuro Zawodów.",
    };
  }

  if (pathname === "/404") {
    return {
      title: `404 | ${APP_NAME}`,
      description: "Strona nie istnieje lub została przeniesiona do innej części aplikacji.",
    };
  }

  if (pathname === "/") {
    return {
      title: `Panel | ${APP_NAME}`,
      description: "Panel główny z podglądem aktywnych, nadchodzących i zakończonych wydarzeń sportowych.",
    };
  }

  if (pathname.startsWith("/events/") && pathname.endsWith("/import")) {
    return {
      title: `Import CSV | ${APP_NAME}`,
      description: "Import list uczestników i mapowanie danych CSV w panelu Biuro Zawodów.",
    };
  }

  if (pathname.startsWith("/events/")) {
    return {
      title: `Szczegóły wydarzenia | ${APP_NAME}`,
      description: "Zarządzanie szczegółami wydarzenia, uczestnikami, eksportami i komunikacją QR.",
    };
  }

  if (pathname === "/events") {
    return {
      title: `Wydarzenia | ${APP_NAME}`,
      description: "Lista wydarzeń sportowych z dostępem do edycji, importów i obsługi biura zawodów.",
    };
  }

  if (pathname.startsWith("/participants/")) {
    return {
      title: `Szczegóły uczestnika | ${APP_NAME}`,
      description: "Podgląd danych uczestnika, statusu odprawy i operacji powiązanych z kodem QR.",
    };
  }

  if (pathname === "/participants") {
    return {
      title: `Uczestnicy | ${APP_NAME}`,
      description: "Zarządzanie listą uczestników, statusami, pakietami startowymi i odprawą.",
    };
  }

  if (pathname === "/scanner") {
    return {
      title: `Skaner QR | ${APP_NAME}`,
      description: "Skanowanie kodów QR uczestników i szybka obsługa odprawy w biurze zawodów.",
    };
  }

  if (pathname === "/scanner-info") {
    return {
      title: `Informacje dla operatora | ${APP_NAME}`,
      description: "Informacje o dostępności przypisanych wydarzeń i pracy operatora QR.",
    };
  }

  if (pathname === "/emails") {
    return {
      title: `Wysyłka e-maili | ${APP_NAME}`,
      description: "Masowa wysyłka wiadomości i kodów QR do uczestników wydarzeń.",
    };
  }

  if (pathname.startsWith("/organizations/")) {
    return {
      title: `Szczegóły organizacji | ${APP_NAME}`,
      description: "Zarządzanie organizacją, wydarzeniami i limitami w panelu Biuro Zawodów.",
    };
  }

  if (pathname === "/organizations" || pathname === "/users") {
    return {
      title: `Organizacje i użytkownicy | ${APP_NAME}`,
      description: "Zarządzanie organizacjami, użytkownikami i uprawnieniami systemowymi.",
    };
  }

  if (pathname === "/profile") {
    return {
      title: `Profil | ${APP_NAME}`,
      description: "Ustawienia konta użytkownika i zmiana hasła w panelu Biuro Zawodów.",
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

    upsertMeta('meta[name="description"]', { name: "description", content: description });
    upsertMeta('meta[name="robots"]', { name: "robots", content: "noindex, nofollow, noarchive" });
    upsertMeta('meta[property="og:title"]', { property: "og:title", content: title });
    upsertMeta('meta[property="og:description"]', { property: "og:description", content: description });
    upsertMeta('meta[name="twitter:title"]', { name: "twitter:title", content: title });
    upsertMeta('meta[name="twitter:description"]', { name: "twitter:description", content: description });
  }, [location.pathname]);

  return null;
}
