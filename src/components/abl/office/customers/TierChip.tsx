export function TierChip({ tier }: { tier: "standard" | "volume" | "key_account" }) {
  const map = {
    standard:    { label: "Standard",    bg: "#F1F4F8", text: "#475569" },
    volume:      { label: "Volume",      bg: "#DBEAFE", text: "#1E40AF" },
    key_account: { label: "Key Account", bg: "#FFEDD5", text: "#9A3412" },
  } as const;
  const s = map[tier] ?? map.standard;
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider"
      style={{ backgroundColor: s.bg, color: s.text }}
    >
      {s.label}
    </span>
  );
}
