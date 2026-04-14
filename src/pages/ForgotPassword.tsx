import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { toast } from "@/hooks/use-toast";
import { validateEmail } from "@/lib/form-validation";

export default function ForgotPassword() {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{
    email?: string;
    form?: string;
  }>({});

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const emailError = validateEmail(email, "Podaj email do resetu.");
    if (emailError) {
      setErrors({ email: emailError });
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      const result = await forgotPassword(email);
      if (!result.ok) {
        const message =
          result.error ?? "Nie udało się wysłać linku resetującego.";
        setErrors({ form: message });
        toast({
          title: "Nie udało się wysłać linku",
          description: message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Sprawdź pocztę",
        description:
          result.message ??
          "Jeśli konto istnieje, wysłaliśmy link do resetu hasła.",
      });
      setEmail("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-app-viewport relative flex flex-col overflow-x-hidden">
      <div className="pointer-events-none absolute inset-0 page-gradient" />
      <div className="pointer-events-none absolute left-[-8rem] top-[-10rem] h-[28rem] w-[28rem] rounded-full bg-primary/12 blur-3xl" />
      <div className="pointer-events-none absolute right-[-6rem] top-[14%] h-[24rem] w-[24rem] rounded-full bg-[hsl(var(--button-highlight)/0.08)] blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-10rem] left-1/2 h-[24rem] w-[42rem] -translate-x-1/2 rounded-full bg-white/5 blur-3xl" />

      <div className="relative z-10 mx-auto flex w-full max-w-xl flex-1 items-start justify-center px-4 py-4 sm:px-6 sm:py-6 lg:items-center lg:px-8">
        <div className="w-full max-w-[30rem]">
          <Card className="overflow-hidden rounded-[1.75rem] border-white/10 bg-[linear-gradient(180deg,hsl(var(--card)/0.96),hsl(var(--background)/0.92))] lg:rounded-[2rem]">
            <CardHeader className="border-b border-white/10 bg-white/[0.03] px-6 pb-5 pt-6 sm:px-7">
              <div className="mb-4">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 text-sm font-medium text-foreground/70 transition-colors hover:text-foreground"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Wróć do logowania
                </Link>
              </div>
              <CardTitle className="text-[1.9rem] tracking-tight">
                Przypomnienie hasła
              </CardTitle>
              <CardDescription className="pt-2 text-sm leading-6 text-muted-foreground">
                Podaj adres email przypisany do konta. Jeśli konto istnieje,
                wyślemy link do ustawienia nowego hasła ważny przez 60 minut.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5 px-6 pb-6 pt-6 sm:px-7">
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <div className="space-y-2">
                  <Label
                    htmlFor="email"
                    className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/65"
                  >
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setErrors((previous) => ({
                        ...previous,
                        email: undefined,
                        form: undefined,
                      }));
                    }}
                    placeholder="email@example.pl"
                    autoComplete="email"
                    required
                    aria-invalid={Boolean(errors.email || errors.form)}
                    aria-describedby={
                      errors.email ? "forgot-password-email-error" : undefined
                    }
                    className="h-12 rounded-2xl border-white/10 bg-black/20 px-4 text-sm"
                  />
                  <FieldError id="forgot-password-email-error">
                    {errors.email}
                  </FieldError>
                </div>

                <FieldError id="forgot-password-form-error">
                  {errors.form}
                </FieldError>

                <Button
                  type="submit"
                  size="lg"
                  className="h-12 w-full rounded-2xl text-sm"
                  disabled={isSubmitting}
                >
                  Wyślij link resetujący
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
