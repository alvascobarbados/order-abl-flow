import { Banknote, FileText, Building2, CreditCard, StickyNote, Plus } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type PaymentMethod = "cash" | "cheque" | "bank_transfer" | "card" | "credit_note" | "other";
export type PaymentStatus = "pending" | "cleared" | "bounced" | "cancelled";

export const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: LucideIcon }[] = [
  { value: "cash",          label: "Cash",          icon: Banknote },
  { value: "cheque",        label: "Cheque",        icon: FileText },
  { value: "bank_transfer", label: "Bank Transfer", icon: Building2 },
  { value: "card",          label: "Card",          icon: CreditCard },
  { value: "credit_note",   label: "Credit Note",   icon: StickyNote },
  { value: "other",         label: "Other",         icon: Plus },
];

export const PAYMENT_METHOD_MAP: Record<PaymentMethod, { label: string; icon: LucideIcon }> =
  Object.fromEntries(PAYMENT_METHODS.map((m) => [m.value, { label: m.label, icon: m.icon }])) as any;

export function referenceLabel(m: PaymentMethod): { label: string; required: boolean } {
  switch (m) {
    case "cash":          return { label: "Receipt number (optional)", required: false };
    case "cheque":        return { label: "Cheque number", required: true };
    case "bank_transfer": return { label: "Transaction reference", required: false };
    case "card":          return { label: "Authorization code (optional)", required: false };
    case "credit_note":   return { label: "Credit note number", required: false };
    default:              return { label: "Reference (optional)", required: false };
  }
}

export function defaultStatusForMethod(m: PaymentMethod): PaymentStatus {
  return (m === "cheque" || m === "bank_transfer") ? "pending" : "cleared";
}

export const STATUS_STYLE: Record<PaymentStatus, { label: string; bg: string; fg: string; pulse?: boolean; strike?: boolean }> = {
  cleared:   { label: "Cleared",   bg: "#D1FAE5", fg: "#047857" },
  pending:   { label: "Pending",   bg: "#FEF3C7", fg: "#B45309", pulse: true },
  bounced:   { label: "Bounced",   bg: "#FEE2E2", fg: "#B91C1C" },
  cancelled: { label: "Cancelled", bg: "#F1F4F8", fg: "#64748B", strike: true },
};
