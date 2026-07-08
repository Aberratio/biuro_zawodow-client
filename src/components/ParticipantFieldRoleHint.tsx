import { Badge } from "@/components/ui/badge";
import type { ParticipantFieldRole } from "@/types";

const roleDescriptions: Record<
  ParticipantFieldRole,
  { badge: string; description: string }
> = {
  email: {
    badge: "Pole specjalne: email",
    description:
      "Adres identyfikuje uczestnika i pomaga ograniczać duplikaty.",
  },
  display_name_part: {
    badge: "Pole specjalne: nazwa",
    description:
      "Ta wartość składa się na nazwę uczestnika widoczną na liście i w szczegółach.",
  },
  bib_number: {
    badge: "Pole specjalne: numer",
    description:
      "Ta wartość trafia do numeru startowego i powinna być unikalna w wydarzeniu.",
  },
  payment_status: {
    badge: "Pole specjalne: opłata",
    description:
      "TAK oznacza opłacony pakiet, a pusta wartość oznacza brak opłaty.",
  },
  important_custom: {
    badge: "Pole specjalne: odprawa",
    description:
      "Ta wartość będzie wyróżniona przy odprawie i skanowaniu uczestnika.",
  },
  custom: {
    badge: "Pole dodatkowe",
    description:
      "Ta wartość trafia do pozostałych danych zapisanych przy uczestniku.",
  },
};

type ParticipantFieldRoleHintProps = {
  id: string;
  role: ParticipantFieldRole;
  isRequired: boolean;
};

export function ParticipantFieldRoleHint({
  id,
  role,
  isRequired,
}: ParticipantFieldRoleHintProps) {
  const roleDescription = roleDescriptions[role];

  return (
    <div className="mt-2 space-y-1" id={id}>
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="outline" className="bg-card/70">
          {roleDescription.badge}
        </Badge>
        <Badge variant={isRequired ? "destructive" : "secondary"}>
          {isRequired ? "Obowiązkowe" : "Opcjonalne"}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        {roleDescription.description}
      </p>
    </div>
  );
}
