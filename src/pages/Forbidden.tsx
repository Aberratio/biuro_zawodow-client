import { Ban, ShieldAlert } from "lucide-react";
import { StatusPage } from "@/components/StatusPage";

export default function Forbidden() {
  return (
    <StatusPage
      code="403"
      eyebrow="Dostęp Zablokowany"
      title="Tutaj wpuszczamy tylko z odpowiednią opaską"
      description="Masz ważny bilet do aplikacji, ale nie do tej konkretnej sekcji. To miejsce jest poza zakresem Twojej roli albo przypisanego wydarzenia."
      hint="Jeśli uważasz, że to pomyłka, sprawdź przypisania organizacji lub wydarzeń. W razie czego kontakt do właścicieli znajdziesz na zmierzymyczas.pl."
      icon={
        <div className="relative">
          <ShieldAlert className="h-8 w-8" />
          <Ban className="absolute -bottom-2 -right-2 h-4 w-4 text-primary-foreground/85" />
        </div>
      }
    />
  );
}
