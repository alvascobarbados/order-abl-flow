export const VAT_RATE = 0.175;

export function formatBBD(n: number): string {
  return `BBD$ ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatPackSize(n: number): string {
  return n.toLocaleString("en-US");
}

// VAT-inclusive split: total includes VAT.
export function splitVatInclusive(total: number) {
  const subtotal = total / (1 + VAT_RATE);
  const vat = total - subtotal;
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    vat: Math.round(vat * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
