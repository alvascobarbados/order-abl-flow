export function OfficeComingSoon({ title, blurb }: { title: string; blurb: string }) {
  return (
    <>
      <div className="mb-6">
        <div className="font-mono text-[10.5px] uppercase text-muted-foreground" style={{ letterSpacing: "0.12em" }}>
          OPERATIONS · {title.toUpperCase()}
        </div>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="text-[24px] font-extrabold text-ink" style={{ letterSpacing: "-0.02em" }}>
            {title}
          </h1>
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
            style={{ backgroundColor: "#FFEFE0", color: "#9A3412", letterSpacing: "0.06em" }}
          >
            Coming soon
          </span>
        </div>
        <p className="mt-2 max-w-2xl text-[13px] text-muted-foreground">{blurb}</p>
      </div>

      <div className="rounded-xl border border-dashed border-border bg-card p-16 text-center">
        <div className="font-mono text-[11px] uppercase text-muted-foreground" style={{ letterSpacing: "0.16em" }}>
          Under construction
        </div>
        <p className="mt-3 text-[13px] text-muted-foreground">
          We'll wire this page up in an upcoming build. Use the sidebar to navigate to other areas.
        </p>
      </div>
    </>
  );
}
