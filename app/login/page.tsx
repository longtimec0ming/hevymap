"use client";

// Password entry form for the optional access gate (PLAN.md §3). Only
// reachable when ACCESS_PASSWORD is set — see proxy.ts. Renders as its own
// minimal page rather than through AppShell's nav/sync (the user isn't
// authenticated yet, so there's nothing to sync or navigate to).

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

// `from` comes from the URL (set by proxy.ts, but also directly forgeable
// by anyone linking to /login?from=...), so it must be constrained to a
// same-origin relative path before it's used for a client-side redirect —
// otherwise a crafted link could send a user who just entered their
// password on to an external site. Only a single leading "/" is accepted;
// "//evil.com" and "https://evil.com" (protocol-relative / absolute) are
// rejected.
function getSafeRedirect(from: string | null): string {
  if (from && from.startsWith("/") && !from.startsWith("//")) return from;
  return "/";
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Incorrect password.");
        setSubmitting(false);
        return;
      }

      router.push(getSafeRedirect(searchParams.get("from")));
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm border-border/70">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex size-10 items-center justify-center rounded-md bg-brand text-brand-foreground">
            <Lock className="size-5" strokeWidth={1.75} />
          </div>
          <CardTitle className="text-lg">HevyMap is locked</CardTitle>
          <p className="text-sm text-muted-foreground">Enter the access password to continue.</p>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoFocus
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-invalid={error ? true : undefined}
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={submitting || password.length === 0}>
              {submitting ? "Checking…" : "Unlock"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
