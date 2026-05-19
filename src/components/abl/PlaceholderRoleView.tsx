import { Logo } from "./Logo";
import { SwitchRoleButton } from "./SwitchRoleButton";

export function PlaceholderRoleView({ title, blurb }: { title: string; blurb: string }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
          <Logo />
          <div className="ml-auto"><SwitchRoleButton /></div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Coming soon
        </div>
        <h1 className="mt-6 text-3xl font-bold tracking-tight text-ink sm:text-4xl">{title}</h1>
        <p className="mt-4 text-sm text-muted-foreground">{blurb}</p>
      </main>
    </div>
  );
}
