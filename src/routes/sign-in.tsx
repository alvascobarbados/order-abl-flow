import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/abl/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/sign-in")({ component: SignInPage });

function SignInPage() {
  const { session, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<"signin" | "forgot">("signin");

  useEffect(() => {
    if (loading) return;
    if (session && profile) navigate({ to: "/" });
  }, [loading, session, profile, navigate]);

  const onSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) toast.error(error.message);
  };

  const onForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSubmitting(false);
    if (error) toast.error(error.message);
    else { toast.success("Password reset email sent."); setMode("signin"); }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden bg-primary p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <Logo className="[&_span:first-child]:text-white [&_span:last-child]:text-white/70" />
        <div>
          <h1 className="text-4xl font-extrabold leading-tight">
            Foodservice supplies,<br/>delivered the same day.
          </h1>
          <p className="mt-4 max-w-md text-sm text-white/70">
            Order from your trusted ABL catalog. Approved orders ship from our Bridgetown warehouse before close of business.
          </p>
        </div>
        <p className="text-xs text-white/50">© ABL Distribution · Bridgetown, Barbados</p>
      </div>

      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden"><Logo /></div>
          <h2 className="text-2xl font-bold tracking-tight text-ink">
            {mode === "signin" ? "Sign in" : "Reset password"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signin"
              ? "Welcome back. Sign in to place an order."
              : "Enter your account email and we'll send a reset link."}
          </p>

          <form onSubmit={mode === "signin" ? onSignIn : onForgot} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} className="mt-1.5 h-11" placeholder="orders@yourcompany.com" />
            </div>
            {mode === "signin" && (
              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="pw">Password</Label>
                  <button type="button" onClick={() => setMode("forgot")} className="text-xs font-medium text-primary hover:underline">
                    Forgot password?
                  </button>
                </div>
                <Input id="pw" type="password" required value={password} onChange={e => setPassword(e.target.value)} className="mt-1.5 h-11" />
              </div>
            )}
            <Button type="submit" disabled={submitting} className="h-11 w-full bg-accent text-accent-foreground hover:bg-accent/90">
              {submitting ? "…" : mode === "signin" ? "Sign in" : "Send reset link"}
            </Button>
            {mode === "forgot" && (
              <button type="button" onClick={() => setMode("signin")} className="block w-full text-center text-sm text-muted-foreground hover:text-ink">
                ← Back to sign in
              </button>
            )}
          </form>

          <div className="mt-8 rounded-lg border border-border bg-secondary/50 p-4 text-xs text-muted-foreground">
            <strong className="font-semibold text-ink">Dev note:</strong> Auth is currently bypassed app-wide. Visit{" "}
            <a href="/" className="font-semibold text-primary hover:underline">the role picker</a> to navigate the app without signing in.
          </div>
        </div>
      </div>
    </div>
  );
}
