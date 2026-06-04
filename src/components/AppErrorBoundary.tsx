import { Component, type ErrorInfo, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { captureFrontendException } from "@/lib/sentry";

type Props = { children: ReactNode };
type State = { hasError: boolean };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    captureFrontendException(error, { component_stack: info.componentStack });
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
        <section className="max-w-md space-y-4 rounded-xl border bg-card p-6 text-center shadow-sm">
          <h1 className="text-xl font-semibold">Wystąpił błąd aplikacji</h1>
          <p className="text-sm text-muted-foreground">
            Zdarzenie zostało zapisane. Odśwież stronę, aby kontynuować.
          </p>
          <Button type="button" onClick={() => window.location.reload()}>
            Odśwież stronę
          </Button>
        </section>
      </main>
    );
  }
}
