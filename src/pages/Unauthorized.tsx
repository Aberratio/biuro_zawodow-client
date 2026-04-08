import { DoorClosed, KeyRound } from "lucide-react";
import { StatusPage } from "@/components/StatusPage";

export default function Unauthorized() {
  return (
    <StatusPage
      code="401"
      eyebrow="Najpierw Logowanie"
      title="Ta bramka otwiera się dopiero po zalogowaniu"
      description="Sesja wygasła albo próbujesz wejść tam, gdzie aplikacja oczekuje aktywnego konta. Bez identyfikatora nawet najszybszy zawodnik tu nie przebiegnie."
      hint="Wróć do strony głównej aplikacji i zaloguj się ponownie. Jeżeli potrzebujesz danych kontaktowych lub informacji o systemie, znajdziesz je na zmierzymyczas.pl."
      primaryLabel="Przejdź do logowania"
      primaryTo="/login"
      icon={
        <div className="relative">
          <DoorClosed className="h-8 w-8" />
          <KeyRound className="absolute -bottom-2 -right-2 h-4 w-4 text-primary-foreground/85" />
        </div>
      }
    />
  );
}
