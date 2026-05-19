import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Phone, AlertTriangle, Camera, MapPinOff, PhoneCall, Wrench, UserX, PackageX } from "lucide-react";
import type { ReactNode } from "react";

export type HelpAction =
  | "not_here" | "refused" | "damaged" | "wrong_address"
  | "call_customer" | "call_dispatch" | "vehicle_issue";

export function HelpDrawer({
  open, onOpenChange, customerPhone, customerName, deliveryNotes, onAction,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  customerPhone?: string | null;
  customerName?: string;
  deliveryNotes?: string | null;
  onAction: (a: HelpAction) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[90vh] overflow-y-auto rounded-t-3xl p-0">
        <SheetHeader className="border-b border-[#E5E9EF] p-5">
          <SheetTitle className="text-[18px] font-extrabold text-ink">Need help?</SheetTitle>
          <p className="text-[12.5px] text-muted-foreground">Pick an action — dispatch will be notified where relevant.</p>
        </SheetHeader>
        <div className="grid grid-cols-1 gap-2 p-4">
          <Row icon={<UserX className="h-5 w-5" />} label="Customer not here" hint="Reschedule or leave at door" onClick={() => onAction("not_here")} />
          <Row icon={<PackageX className="h-5 w-5" />} label="Refused delivery" hint="Returns to warehouse" danger onClick={() => onAction("refused")} />
          <Row icon={<Camera className="h-5 w-5" />} label="Damaged in transit" hint="Capture photo + items" onClick={() => onAction("damaged")} />
          <Row icon={<MapPinOff className="h-5 w-5" />} label="Wrong address / can't find" onClick={() => onAction("wrong_address")} />
          <Row icon={<Phone className="h-5 w-5" />} label={`Call ${customerName ?? "customer"}`} hint={customerPhone ?? "No number on file"} onClick={() => onAction("call_customer")} />
          <Row icon={<PhoneCall className="h-5 w-5" />} label="Call dispatch / office" hint="(246) 555-0100" onClick={() => onAction("call_dispatch")} />
          <Row icon={<Wrench className="h-5 w-5" />} label="Report vehicle issue" onClick={() => onAction("vehicle_issue")} />
        </div>
        {deliveryNotes && (
          <div className="mx-4 mb-5 rounded-xl bg-[#FFFBEB] p-3 text-[12.5px] text-[#92400E]">
            <div className="mb-0.5 flex items-center gap-1 font-bold uppercase tracking-wider text-[10.5px]">
              <AlertTriangle className="h-3 w-3" /> Delivery notes
            </div>
            {deliveryNotes}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Row({ icon, label, hint, danger, onClick }: { icon: ReactNode; label: string; hint?: string; danger?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex items-center gap-3 rounded-xl border bg-white p-4 text-left transition hover:bg-[#FAFBFC] ${
        danger ? "border-[#FECACA]" : "border-[#E5E9EF]"
      }`}>
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${danger ? "bg-[#FEE2E2] text-[#B91C1C]" : "bg-[#F1F4F8] text-ink"}`}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className={`text-[14.5px] font-bold ${danger ? "text-[#B91C1C]" : "text-ink"}`}>{label}</div>
        {hint && <div className="text-[11.5px] text-muted-foreground">{hint}</div>}
      </div>
    </button>
  );
}
