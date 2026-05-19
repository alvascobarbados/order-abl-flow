import type { ReactNode } from "react";

export type ShellTab = {
  key: string;
  label: string;
  count?: number;
  muted?: boolean;
};

export function TabbedShell({
  eyebrow, title, blurb, tabs, activeKey, onTabChange, children,
}: {
  eyebrow: string;
  title: string;
  blurb?: string;
  tabs: ShellTab[];
  activeKey: string;
  onTabChange: (key: string) => void;
  children: ReactNode;
}) {
  return (
    <>
      <div className="mb-5">
        <div className="text-[10.5px] uppercase text-muted-foreground" style={{ letterSpacing: "0.12em" }}>
          {eyebrow}
        </div>
        <h1 className="mt-1 text-[24px] font-extrabold text-ink" style={{ letterSpacing: "-0.02em" }}>
          {title}
        </h1>
        {blurb && <p className="mt-1 text-[13px] text-muted-foreground">{blurb}</p>}
      </div>

      <div className="sticky top-0 z-20 -mx-6 mb-5 border-b border-border bg-background/95 px-6 py-3 backdrop-blur">
        <div className="flex flex-wrap gap-1.5">
          {tabs.map((t) => {
            const active = activeKey === t.key;
            return (
              <button
                key={t.key}
                onClick={() => onTabChange(t.key)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition ${
                  active
                    ? "bg-[#0B1A2E] text-white"
                    : t.muted
                      ? "border border-border bg-card text-muted-foreground/70 hover:text-ink"
                      : "border border-border bg-card text-[#64748B] hover:text-ink"
                }`}
              >
                <span>{t.label}</span>
                {t.count !== undefined && (
                  <span className={`text-[10.5px] ${active ? "text-white/70" : "text-muted-foreground"}`}>
                    ({t.count})
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {children}
    </>
  );
}

export function PlaceholderPanel({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
      <div className="text-[15px] font-bold text-ink">{title}</div>
      <p className="mx-auto mt-2 max-w-md text-[13px] text-muted-foreground">{body}</p>
    </div>
  );
}
