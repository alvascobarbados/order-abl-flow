import { useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

export function Modal({ title, children, onClose, width = 480 }: { title: string; children: ReactNode; onClose: () => void; width?: number }) {
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl"
        style={{ maxWidth: width }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h3 className="text-[15px] font-bold text-ink">{title}</h3>
          <button onClick={onClose} className="text-[20px] leading-none text-muted-foreground hover:text-ink">×</button>
        </header>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export function ModalFooter({ onCancel, onConfirm, confirmLabel, confirmColor = "#0B1A2E", loading, disabled }: {
  onCancel: () => void; onConfirm: () => void; confirmLabel: string; confirmColor?: string; loading?: boolean; disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-end gap-2 border-t border-border bg-secondary/40 px-5 py-3">
      <button onClick={onCancel} className="rounded-md border border-border bg-card px-3 py-1.5 text-[12.5px] font-semibold text-ink hover:bg-secondary">Cancel</button>
      <button
        onClick={onConfirm}
        disabled={loading || disabled}
        className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-50"
        style={{ backgroundColor: confirmColor }}
      >
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {confirmLabel}
      </button>
    </div>
  );
}

export function SimpleConfirm({ title, body, confirmLabel, confirmColor, onConfirm, onCancel, loading }: {
  title: string; body?: ReactNode; confirmLabel: string; confirmColor?: string;
  onConfirm: () => void; onCancel: () => void; loading?: boolean;
}) {
  return (
    <Modal title={title} onClose={onCancel}>
      {body && <div className="px-5 py-4 text-[13px] text-muted-foreground">{body}</div>}
      <ModalFooter onCancel={onCancel} onConfirm={onConfirm} confirmLabel={confirmLabel} confirmColor={confirmColor} loading={loading} />
    </Modal>
  );
}

export function ReasonModal({ title, label, placeholder, confirmLabel, onConfirm, onCancel, loading, warning }: {
  title: string; label: string; placeholder?: string; confirmLabel: string;
  onConfirm: (reason: string) => void; onCancel: () => void; loading?: boolean; warning?: string;
}) {
  const [reason, setReason] = useState("");
  return (
    <Modal title={title} onClose={onCancel}>
      <div className="space-y-3 px-5 py-4">
        {warning && (
          <div className="rounded-md border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-[12px] text-[#B91C1C]">{warning}</div>
        )}
        <div>
          <label className="mb-1 block text-[11.5px] font-semibold uppercase text-muted-foreground" style={{ letterSpacing: "0.06em" }}>{label}</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={placeholder}
            rows={4}
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-[13px] text-ink focus:border-ink focus:outline-none"
            autoFocus
          />
        </div>
      </div>
      <ModalFooter
        onCancel={onCancel}
        onConfirm={() => onConfirm(reason.trim())}
        confirmLabel={confirmLabel}
        confirmColor="#B91C1C"
        loading={loading}
        disabled={!reason.trim()}
      />
    </Modal>
  );
}

export function AssignPickerModal({ defaultName, onConfirm, onCancel, loading }: {
  defaultName?: string; onConfirm: (name: string) => void; onCancel: () => void; loading?: boolean;
}) {
  const [name, setName] = useState(defaultName ?? "");
  return (
    <Modal title="Send to warehouse" onClose={onCancel}>
      <div className="space-y-3 px-5 py-4">
        <p className="text-[13px] text-muted-foreground">Optionally assign a picker. You can leave it unassigned and the warehouse team will pick it up.</p>
        <input
          value={name} onChange={(e) => setName(e.target.value)} placeholder="Picker name (e.g. Andre)"
          className="w-full rounded-md border border-border bg-card px-3 py-2 text-[13px] text-ink focus:border-ink focus:outline-none"
        />
      </div>
      <ModalFooter onCancel={onCancel} onConfirm={() => onConfirm(name.trim())} confirmLabel="Send to warehouse" loading={loading} />
    </Modal>
  );
}

export function AssignDriverModal({ onConfirm, onCancel, loading }: {
  onConfirm: (v: { driver_name: string; vehicle_id: string; eta: string | null }) => void;
  onCancel: () => void; loading?: boolean;
}) {
  const [driver, setDriver] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [eta, setEta] = useState("");
  return (
    <Modal title="Assign to driver" onClose={onCancel}>
      <div className="grid grid-cols-2 gap-3 px-5 py-4">
        <Field label="Driver" full><input value={driver} onChange={(e) => setDriver(e.target.value)} placeholder="e.g. Neal" className={fieldCls} autoFocus /></Field>
        <Field label="Vehicle"><input value={vehicle} onChange={(e) => setVehicle(e.target.value)} placeholder="VAN-04" className={fieldCls} /></Field>
        <Field label="ETA (optional)"><input type="datetime-local" value={eta} onChange={(e) => setEta(e.target.value)} className={fieldCls} /></Field>
      </div>
      <ModalFooter
        onCancel={onCancel}
        onConfirm={() => onConfirm({ driver_name: driver.trim(), vehicle_id: vehicle.trim(), eta: eta ? new Date(eta).toISOString() : null })}
        confirmLabel="Dispatch order"
        disabled={!driver.trim()}
        loading={loading}
      />
    </Modal>
  );
}

export function MarkDeliveredModal({ onConfirm, onCancel, loading }: {
  onConfirm: (v: { delivered_to_name: string }) => void; onCancel: () => void; loading?: boolean;
}) {
  const [name, setName] = useState("");
  return (
    <Modal title="Mark as delivered (manual override)" onClose={onCancel}>
      <div className="space-y-3 px-5 py-4">
        <div className="rounded-md border border-[#FEF3C7] bg-[#FFFBEB] px-3 py-2 text-[12px] text-[#B45309]">
          Drivers normally mark delivered from the field. Use this only for office overrides.
        </div>
        <Field label="Delivered to (name)"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Marco Rodriguez" className={fieldCls} autoFocus /></Field>
      </div>
      <ModalFooter onCancel={onCancel} onConfirm={() => onConfirm({ delivered_to_name: name.trim() || "—" })} confirmLabel="Mark delivered" confirmColor="#10B981" loading={loading} />
    </Modal>
  );
}

export function MarkPaidModal({ amount, onConfirm, onCancel, loading }: {
  amount: number; onConfirm: (v: { method: string; reference: string }) => void; onCancel: () => void; loading?: boolean;
}) {
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  return (
    <Modal title={`Mark as paid · BBD$ ${amount.toFixed(2)}`} onClose={onCancel}>
      <div className="space-y-3 px-5 py-4">
        <p className="text-[12px] text-muted-foreground">This creates a payment fully allocated to this invoice and moves the order to Paid.</p>
        <Field label="Method">
          <select value={method} onChange={(e) => setMethod(e.target.value)} className={fieldCls}>
            <option value="cash">Cash</option><option value="cheque">Cheque</option>
            <option value="bank_transfer">Bank transfer</option><option value="card">Card</option><option value="other">Other</option>
          </select>
        </Field>
        <Field label="Reference (optional)"><input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Cheque #, txn ID, etc." className={fieldCls} /></Field>
      </div>
      <ModalFooter onCancel={onCancel} onConfirm={() => onConfirm({ method, reference: reference.trim() })} confirmLabel="Record payment & mark paid" confirmColor="#10B981" loading={loading} />
    </Modal>
  );
}

const fieldCls = "w-full rounded-md border border-border bg-card px-3 py-1.5 text-[13px] text-ink focus:border-ink focus:outline-none";
function Field({ label, children, full }: { label: string; children: ReactNode; full?: boolean }) {
  return (
    <label className={`block ${full ? "col-span-2" : ""}`}>
      <span className="mb-1 block text-[11.5px] font-semibold uppercase text-muted-foreground" style={{ letterSpacing: "0.06em" }}>{label}</span>
      {children}
    </label>
  );
}
