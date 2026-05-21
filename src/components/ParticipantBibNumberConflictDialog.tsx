import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatBibNumber } from "@/lib/participants";
import { buildEventParticipantDocumentHref } from "@/lib/routes";
import type { Participant } from "@/types";
import { Loader2, Repeat, Trash2 } from "lucide-react";

function getParticipantInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

interface ParticipantBibNumberConflictDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bibNumber: string;
  conflictingParticipants: Participant[];
  allowDeleteConflicts: boolean;
  isSaving: boolean;
  onResolve: (resolution: "keep_duplicates" | "delete_conflicts") => void | Promise<void>;
}

export function ParticipantBibNumberConflictDialog({
  open,
  onOpenChange,
  bibNumber,
  conflictingParticipants,
  allowDeleteConflicts,
  isSaving,
  onResolve,
}: ParticipantBibNumberConflictDialogProps) {
  const hasSingleBibConflict = conflictingParticipants.length === 1;
  const conflictDeleteButtonLabel = hasSingleBibConflict
    ? "Przenieś numer i usuń poprzedniego uczestnika"
    : "Przenieś numer i usuń poprzednich uczestników";
  const conflictKeepButtonLabel = hasSingleBibConflict
    ? "Zachowaj numer u obu uczestników"
    : "Zachowaj numer u wszystkich uczestników";
  const conflictDescription = hasSingleBibConflict ? (
    <>
      Inny uczestnik ma już przypisany numer{" "}
      <span className="font-semibold text-foreground">
        {formatBibNumber(bibNumber, bibNumber || "bez numeru")}
      </span>
      .
    </>
  ) : (
    <>
      Inni uczestnicy mają już przypisany numer{" "}
      <span className="font-semibold text-foreground">
        {formatBibNumber(bibNumber, bibNumber || "bez numeru")}
      </span>
      .
    </>
  );

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="flex max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] flex-col overflow-hidden p-0 sm:max-w-2xl">
        <AlertDialogHeader className="shrink-0 px-4 pt-4 text-left sm:px-6 sm:pt-6">
          <AlertDialogTitle className="text-lg sm:text-xl">
            Ten numer jest już używany
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm leading-6">
            {conflictDescription}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="themed-scrollbar flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          <div className="space-y-2">
            {conflictingParticipants.map((conflictParticipant) => (
              <div
                key={conflictParticipant.id}
                className="flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="text-xs font-semibold">
                      {getParticipantInitials(conflictParticipant.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">
                      {conflictParticipant.name}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {conflictParticipant.email}
                    </p>
                  </div>
                </div>
                <Button variant="outline" asChild className="w-full sm:w-auto">
                  <a
                    href={buildEventParticipantDocumentHref(
                      conflictParticipant.event_id,
                      conflictParticipant.id,
                    )}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Otwórz profil
                  </a>
                </Button>
              </div>
            ))}
          </div>
        </div>

        <AlertDialogFooter className="!flex-col shrink-0 gap-2 border-t px-4 py-4 sm:px-6">
          <div className="w-full space-y-2 sm:px-1">
            {allowDeleteConflicts && (
              <Button
                className="w-full"
                variant="destructive"
                onClick={() => void onResolve("delete_conflicts")}
                disabled={isSaving}
              >
                {isSaving ? (
                  <Loader2 className="hidden h-4 w-4 animate-spin sm:inline-flex" />
                ) : (
                  <Trash2 className="hidden h-4 w-4 sm:inline-flex" />
                )}
                {conflictDeleteButtonLabel}
              </Button>
            )}

            <Button
              className="w-full"
              onClick={() => void onResolve("keep_duplicates")}
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="hidden h-4 w-4 animate-spin sm:inline-flex" />
              ) : (
                <Repeat className="hidden h-4 w-4 sm:inline-flex" />
              )}
              {conflictKeepButtonLabel}
            </Button>
            <AlertDialogCancel className="mt-0 w-full">Cofnij</AlertDialogCancel>
          </div>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
