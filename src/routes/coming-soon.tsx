import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Logo } from "@/components/abl/Logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/coming-soon")({ component: ComingSoon });

function ComingSoon() {
  const { profile, signOut } = useAuth();
  return (
    <div className="grid min-h-screen place-items-center bg-background px-6">
      <div className="max-w-lg text-center">
        <Logo className="mx-auto items-center" />
        <h1 className="mt-8 text-3xl font-bold tracking-tight text-ink">This view is coming soon</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Hi {profile?.full_name ?? "there"} — the {profile?.role ?? "staff"} dashboard is still in development. The customer storefront is the only view live today.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Button asChild variant="outline"><Link to="/login">Switch account</Link></Button>
          <Button onClick={signOut} className="bg-primary hover:bg-primary-dark">Sign out</Button>
        </div>
      </div>
    </div>
  );
}
