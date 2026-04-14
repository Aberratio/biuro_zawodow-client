import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { toast } from "@/hooks/use-toast";
import { validateEmail, validateRequired } from "@/lib/form-validation";

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    form?: string;
  }>({});
  const currentYear = new Date().getFullYear();
  const copyrightYears = currentYear > 2026 ? `2026-${currentYear}` : "2026";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = {
      email: validateEmail(email),
      password: validateRequired(password, "Podaj hasło."),
    };

    if (nextErrors.email || nextErrors.password) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      const ok = await login(email, password);
      if (!ok) {
        setErrors({ form: "Nieprawidłowy email lub hasło." });
        toast({
          title: "Błąd logowania",
          description: "Nieprawidłowy email lub hasło.",
          variant: "destructive",
        });
      }
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
              <CardTitle className="text-[1.9rem] tracking-tight">
                Logowanie
              </CardTitle>
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
                    placeholder="email@gmail.com"
                    autoComplete="email"
                    required
                    aria-invalid={Boolean(errors.email || errors.form)}
                    aria-describedby={
                      errors.email ? "login-email-error" : undefined
                    }
                    className="h-12 rounded-2xl border-white/10 bg-black/20 px-4 text-sm"
                  />
                  <FieldError id="login-email-error">{errors.email}</FieldError>
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="password"
                    className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/65"
                  >
                    Hasło
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setErrors((previous) => ({
                        ...previous,
                        password: undefined,
                        form: undefined,
                      }));
                    }}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                    aria-invalid={Boolean(errors.password || errors.form)}
                    aria-describedby={
                      errors.password ? "login-password-error" : undefined
                    }
                    className="h-12 rounded-2xl border-white/10 bg-black/20 px-4 text-sm"
                  />
                  <FieldError id="login-password-error">
                    {errors.password}
                  </FieldError>
                </div>

                <FieldError id="login-form-error">{errors.form}</FieldError>

                <Button
                  type="submit"
                  size="lg"
                  className="h-12 w-full rounded-2xl text-sm"
                  disabled={isSubmitting}
                >
                  Zaloguj
                </Button>

                <div className="flex justify-end">
                  <Link
                    to="/forgot-password"
                    className="text-sm font-medium text-foreground/72 transition-colors hover:text-[hsl(var(--button-highlight))] hover:underline underline-offset-4"
                  >
                    Zapomniałeś hasła?
                  </Link>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>

      <footer className="pb-safe-bottom relative z-10 mx-auto w-full max-w-7xl px-4 pt-2 text-center text-xs leading-6 text-muted-foreground sm:px-6 lg:px-8">
        <p>
          © {copyrightYears}{" "}
          <a
            href="https://webcodesign.pl"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-primary transition-colors hover:text-primary/80"
          >
            webcodesign.pl
          </a>
          . Strona jest częścią aplikacji{" "}
          <a
            href="https://zmierzymyczas.pl"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-foreground/90 underline decoration-primary/30 underline-offset-4 transition-colors hover:text-foreground"
          >
            zmierzymyczas.pl
          </a>
          , gdzie znajdują się wszystkie informacje oraz kontakt z
          właścicielami.
        </p>
      </footer>
    </div>
  );
}
