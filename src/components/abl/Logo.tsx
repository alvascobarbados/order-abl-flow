export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-col leading-none ${className}`}>
      <span className="text-2xl font-extrabold tracking-tight text-primary">ABL</span>
      <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground">DISTRIBUTION</span>
    </div>
  );
}
