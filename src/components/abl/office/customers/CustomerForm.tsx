import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TierChip } from "./TierChip";
import { formatBBD } from "@/lib/format";
import { Copy, X, Sparkles } from "lucide-react";

const PARISHES = [
  "St. Michael", "Christ Church", "St. James", "St. Peter", "St. Lucy",
  "St. Andrew", "St. Joseph", "St. John", "St. Philip", "St. George", "St. Thomas",
];
const BUSINESS_TYPES = ["Restaurant", "Café", "Hotel", "Bar", "Catering", "Bakery", "Food Truck", "Retail", "Institution", "Other"];
const SOURCES = ["Walk-in", "Referral", "Trade show", "Sales rep", "Website", "Other"];
const SALES_REPS = ["Marlon", "Direct order", "Unassigned"];
const TERMS_OPTIONS = [
  { v: 0, label: "COD (0)" }, { v: 7, label: "Net 7" }, { v: 14, label: "Net 14" },
  { v: 30, label: "Net 30" }, { v: 45, label: "Net 45" }, { v: 60, label: "Net 60" },
];

const FormSchema = z.object({
  company_name: z.string().trim().min(2, "Company name must be 2-100 chars").max(100),
  trading_name: z.string().trim().max(120).optional().or(z.literal("")),
  business_type: z.string().optional().or(z.literal("")),
  pricing_tier: z.enum(["standard", "volume", "key_account"]),
  is_active: z.boolean(),

  contact_full_name: z.string().trim().min(2, "Contact name is required").max(120),
  contact_email: z.string().trim().email("Invalid email"),
  contact_phone: z.string().trim().regex(/^\+1 \(246\) \d{3}-\d{4}$/, "Phone must be +1 (246) XXX-XXXX"),
  contact_job_title: z.string().trim().max(80).optional().or(z.literal("")),

  create_login: z.boolean(),
  login_password: z.string().optional(),

  billing_address: z.string().trim().min(1, "Billing address line 1 required").max(200),
  billing_address_2: z.string().trim().max(200).optional().or(z.literal("")),
  billing_city: z.string().trim().max(80).optional().or(z.literal("")),
  billing_parish: z.string().optional().or(z.literal("")),
  billing_postal: z.string().trim().max(20).optional().or(z.literal("")),

  delivery_same: z.boolean(),
  delivery_address: z.string().trim().max(200).optional().or(z.literal("")),
  delivery_address_2: z.string().trim().max(200).optional().or(z.literal("")),
  delivery_city: z.string().trim().max(80).optional().or(z.literal("")),
  delivery_parish: z.string().optional().or(z.literal("")),
  delivery_postal: z.string().trim().max(20).optional().or(z.literal("")),
  delivery_notes: z.string().trim().max(400).optional().or(z.literal("")),

  credit_limit: z.number().min(0, "Must be ≥ 0"),
  payment_terms_days: z.number().int(),
  opening_balance: z.number(),
  tax_exempt: z.boolean(),
  tax_id: z.string().trim().max(40).optional().or(z.literal("")),

  sales_rep_name: z.string().optional().or(z.literal("")),
  customer_source: z.string().optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type FormValues = z.infer<typeof FormSchema>;

const DEFAULTS: FormValues = {
  company_name: "", trading_name: "", business_type: "", pricing_tier: "standard", is_active: true,
  contact_full_name: "", contact_email: "", contact_phone: "+1 (246) ", contact_job_title: "",
  create_login: false, login_password: "",
  billing_address: "", billing_address_2: "", billing_city: "", billing_parish: "", billing_postal: "",
  delivery_same: true, delivery_address: "", delivery_address_2: "", delivery_city: "", delivery_parish: "", delivery_postal: "",
  delivery_notes: "",
  credit_limit: 0, payment_terms_days: 30, opening_balance: 0, tax_exempt: false, tax_id: "",
  sales_rep_name: "Unassigned", customer_source: "", notes: "",
};

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(-10);
  if (digits.length === 0) return "+1 (246) ";
  const padded = digits.padStart(10, " ").slice(-10);
  const a = padded.slice(0, 3).trim();
  const b = padded.slice(3, 6).trim();
  const c = padded.slice(6, 10).trim();
  // If starts with 246 — strip
  const withoutArea = digits.startsWith("246") ? digits.slice(3) : digits;
  const local = withoutArea.padEnd(7, "").slice(0, 7);
  const p1 = local.slice(0, 3);
  const p2 = local.slice(3, 7);
  if (!p1) return "+1 (246) ";
  if (!p2) return `+1 (246) ${p1}`;
  return `+1 (246) ${p1}-${p2}`;
}

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let p = "";
  for (let i = 0; i < 12; i++) p += chars[Math.floor(Math.random() * chars.length)];
  return p;
}

interface Props {
  initial?: Partial<FormValues> & { id?: string; customer_number?: string | null; existing_contact_email?: string | null };
  mode: "create" | "edit";
}

export function CustomerForm({ initial, mode }: Props) {
  const navigate = useNavigate();
  const [values, setValues] = useState<FormValues>({ ...DEFAULTS, ...(initial ?? {}) } as FormValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const isEdit = mode === "edit";

  const set = <K extends keyof FormValues>(k: K, v: FormValues[K]) =>
    setValues((p) => ({ ...p, [k]: v }));

  const result = useMemo(() => FormSchema.safeParse(values), [values]);
  const liveErrors = useMemo<Record<string, string>>(() => {
    if (result.success) return {};
    const out: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const k = issue.path.join(".");
      if (!out[k]) out[k] = issue.message;
    }
    return out;
  }, [result]);

  const canSubmit = result.success && !saving;

  const submit = async (afterSaveOpenDrawer = false) => {
    const r = FormSchema.safeParse(values);
    if (!r.success) {
      const e: Record<string, string> = {};
      r.error.issues.forEach((i) => (e[i.path.join(".")] = i.message));
      setErrors(e);
      toast.error("Please fix the errors below");
      return;
    }
    setErrors({});
    setSaving(true);

    let contactProfileId: string | null = initial?.id ? (initial as any).contact_profile_id ?? null : null;
    let plainPassword: string | null = null;

    try {
      // Create login if requested and not already linked
      if (values.create_login && !contactProfileId) {
        // Email uniqueness check across profiles
        const { data: existing } = await supabase
          .from("profiles").select("id").eq("email", values.contact_email).maybeSingle();
        if (existing) {
          toast.error("An account with that email already exists. Uncheck 'Create login' or use a different email.");
          setSaving(false);
          return;
        }
        plainPassword = values.login_password && values.login_password.length >= 8 ? values.login_password : generatePassword();
        const newId = crypto.randomUUID();
        const { error: pErr } = await supabase.from("profiles").insert({
          id: newId,
          email: values.contact_email,
          full_name: values.contact_full_name,
          role: "customer",
          phone: values.contact_phone,
        });
        if (pErr) {
          toast.error(`Failed to create login: ${pErr.message}`);
          setSaving(false);
          return;
        }
        contactProfileId = newId;
      }

      const billingFlat = [values.billing_address, values.billing_address_2].filter(Boolean).join("\n");
      const deliveryFlat = values.delivery_same ? billingFlat
        : [values.delivery_address, values.delivery_address_2].filter(Boolean).join("\n");

      const payload: any = {
        company_name: values.company_name.trim(),
        trading_name: values.trading_name || null,
        business_type: values.business_type || null,
        pricing_tier: values.pricing_tier,
        is_active: values.is_active,
        phone: values.contact_phone,
        billing_address: billingFlat || null,
        billing_city: values.billing_city || null,
        billing_parish: values.billing_parish || null,
        billing_postal: values.billing_postal || null,
        delivery_address: deliveryFlat || null,
        delivery_address_same_as_billing: values.delivery_same,
        delivery_city: values.delivery_same ? values.billing_city || null : values.delivery_city || null,
        delivery_parish: values.delivery_same ? values.billing_parish || null : values.delivery_parish || null,
        delivery_postal: values.delivery_same ? values.billing_postal || null : values.delivery_postal || null,
        delivery_notes: values.delivery_notes || null,
        credit_limit: values.credit_limit,
        payment_terms_days: values.payment_terms_days,
        tax_exempt: values.tax_exempt,
        tax_id: values.tax_id || null,
        sales_rep_name: values.sales_rep_name || null,
        customer_source: values.customer_source || null,
        notes: values.notes || null,
        contact_profile_id: contactProfileId,
      };

      if (!isEdit) {
        payload.opening_balance = values.opening_balance;
        payload.current_balance = values.opening_balance;
      }

      let saved;
      if (isEdit && initial?.id) {
        const { data, error } = await supabase
          .from("customers").update(payload).eq("id", initial.id).select().single();
        if (error) throw error;
        saved = data;
      } else {
        const { data, error } = await supabase
          .from("customers").insert(payload).select().single();
        if (error) throw error;
        saved = data;
      }

      if (plainPassword) {
        setGeneratedPassword(plainPassword);
        toast.success("Login created · share password manually for now");
      } else {
        toast.success(isEdit ? "Customer updated" : `Customer ${saved?.customer_number} created`);
        if (afterSaveOpenDrawer && isEdit && initial?.id) {
          navigate({ to: "/office/customers", search: { open: initial.id } as any });
        } else {
          navigate({ to: "/office/customers" });
        }
      }
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="mx-auto max-w-[1200px]">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <button
              onClick={() => navigate({ to: "/office/customers" })}
              className="text-[12px] font-semibold text-[#64748B] hover:text-ink"
            >← Back to customers</button>
            <h1 className="mt-2 text-[24px] font-extrabold text-ink" style={{ letterSpacing: "-0.02em" }}>
              {isEdit ? `Edit ${initial?.company_name ?? "customer"}` : "New customer"}
            </h1>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {isEdit ? "Update customer record. Some fields like opening balance are locked." : "Onboard a new wholesale account."}
            </p>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4 pb-[120px]">
            {/* 1. Company */}
            <Section title="1. Company information">
              <Field label="Company name" error={errors.company_name ?? liveErrors.company_name} required>
                <Input value={values.company_name} onChange={(v) => set("company_name", v)} />
              </Field>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Customer number">
                  <Input value={initial?.customer_number ?? "Auto-generated"} disabled mono />
                </Field>
                <Field label="Trading name / DBA">
                  <Input value={values.trading_name ?? ""} onChange={(v) => set("trading_name", v)} />
                </Field>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Business type">
                  <Select value={values.business_type ?? ""} onChange={(v) => set("business_type", v)} options={[{ value: "", label: "Select…" }, ...BUSINESS_TYPES.map((b) => ({ value: b, label: b }))]} />
                </Field>
                <Field label="Pricing tier">
                  <Select value={values.pricing_tier} onChange={(v) => set("pricing_tier", v as any)} options={[
                    { value: "standard", label: "Standard" },
                    { value: "volume", label: "Volume" },
                    { value: "key_account", label: "Key Account" },
                  ]} />
                </Field>
              </div>
              <Toggle label="Active" checked={values.is_active} onChange={(v) => set("is_active", v)} />
            </Section>

            {/* 2. Primary contact */}
            <Section title="2. Primary contact">
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Full name" error={errors.contact_full_name ?? liveErrors.contact_full_name} required>
                  <Input value={values.contact_full_name} onChange={(v) => set("contact_full_name", v)} />
                </Field>
                <Field label="Job title">
                  <Input value={values.contact_job_title ?? ""} onChange={(v) => set("contact_job_title", v)} placeholder="e.g. Owner" />
                </Field>
                <Field label="Email" error={errors.contact_email ?? liveErrors.contact_email} required>
                  <Input value={values.contact_email} onChange={(v) => set("contact_email", v)} type="email" />
                </Field>
                <Field label="Phone" error={errors.contact_phone ?? liveErrors.contact_phone} required>
                  <Input
                    value={values.contact_phone}
                    mono
                    onChange={(v) => set("contact_phone", formatPhone(v))}
                  />
                </Field>
              </div>
              {!initial?.existing_contact_email && (
                <div className="mt-2 rounded-lg border border-[#E5E9EF] bg-[#FAFBFC] p-3">
                  <Toggle
                    label="Create login for this contact"
                    checked={values.create_login}
                    onChange={(v) => set("create_login", v)}
                  />
                  {values.create_login && (
                    <div className="mt-3 flex items-end gap-2">
                      <Field label="Password (optional — leave blank to auto-generate)">
                        <Input value={values.login_password ?? ""} onChange={(v) => set("login_password", v)} placeholder="Leave blank to generate" />
                      </Field>
                      <button
                        type="button"
                        onClick={() => set("login_password", generatePassword())}
                        className="flex h-9 items-center gap-1 rounded-lg border border-[#E5E9EF] bg-white px-3 text-[12.5px] font-semibold text-ink hover:bg-[#FAFBFC]"
                      >
                        <Sparkles className="h-3.5 w-3.5" /> Generate
                      </button>
                    </div>
                  )}
                </div>
              )}
              {initial?.existing_contact_email && (
                <div className="mt-2 rounded-md bg-[#F1F4F8] px-3 py-2 text-[12px] text-[#64748B]">
                  Linked login: <span className="font-semibold text-ink">{initial.existing_contact_email}</span>
                </div>
              )}
            </Section>

            {/* 3. Addresses */}
            <Section title="3. Addresses">
              <div className="text-[11.5px] font-semibold uppercase tracking-wider text-[#64748B]">Billing</div>
              <Field label="Address line 1" error={errors.billing_address ?? liveErrors.billing_address} required>
                <Input value={values.billing_address} onChange={(v) => set("billing_address", v)} />
              </Field>
              <Field label="Address line 2">
                <Input value={values.billing_address_2 ?? ""} onChange={(v) => set("billing_address_2", v)} />
              </Field>
              <div className="grid gap-3 md:grid-cols-3">
                <Field label="City">
                  <Input value={values.billing_city ?? ""} onChange={(v) => set("billing_city", v)} />
                </Field>
                <Field label="Parish">
                  <Select value={values.billing_parish ?? ""} onChange={(v) => set("billing_parish", v)} options={[{ value: "", label: "Select parish…" }, ...PARISHES.map((p) => ({ value: p, label: p }))]} />
                </Field>
                <Field label="Postal code">
                  <Input value={values.billing_postal ?? ""} onChange={(v) => set("billing_postal", v)} />
                </Field>
              </div>

              <div className="mt-3 border-t border-[#E5E9EF] pt-3">
                <Toggle label="Delivery address same as billing" checked={values.delivery_same} onChange={(v) => set("delivery_same", v)} />
              </div>

              {!values.delivery_same && (
                <div className="mt-3 space-y-3 rounded-lg border border-[#E5E9EF] bg-[#FAFBFC] p-3">
                  <div className="text-[11.5px] font-semibold uppercase tracking-wider text-[#64748B]">Delivery</div>
                  <Field label="Address line 1">
                    <Input value={values.delivery_address ?? ""} onChange={(v) => set("delivery_address", v)} />
                  </Field>
                  <Field label="Address line 2">
                    <Input value={values.delivery_address_2 ?? ""} onChange={(v) => set("delivery_address_2", v)} />
                  </Field>
                  <div className="grid gap-3 md:grid-cols-3">
                    <Field label="City"><Input value={values.delivery_city ?? ""} onChange={(v) => set("delivery_city", v)} /></Field>
                    <Field label="Parish">
                      <Select value={values.delivery_parish ?? ""} onChange={(v) => set("delivery_parish", v)} options={[{ value: "", label: "Select parish…" }, ...PARISHES.map((p) => ({ value: p, label: p }))]} />
                    </Field>
                    <Field label="Postal code"><Input value={values.delivery_postal ?? ""} onChange={(v) => set("delivery_postal", v)} /></Field>
                  </div>
                </div>
              )}

              <Field label="Delivery notes">
                <textarea
                  value={values.delivery_notes ?? ""}
                  onChange={(e) => set("delivery_notes", e.target.value)}
                  rows={2}
                  placeholder="e.g. Use side gate, ring twice"
                  className="w-full rounded-lg border border-[#E5E9EF] bg-white p-2.5 text-[13px] outline-none focus:border-[#0F2540]"
                />
              </Field>
            </Section>

            {/* 4. Terms */}
            <Section title="4. Account terms">
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Credit limit (BBD$)" error={errors.credit_limit ?? liveErrors.credit_limit}>
                  <Input
                    type="number"
                    value={String(values.credit_limit)}
                    onChange={(v) => set("credit_limit", Number(v) || 0)}
                    mono
                  />
                </Field>
                <Field label="Payment terms">
                  <Select
                    value={String(values.payment_terms_days)}
                    onChange={(v) => set("payment_terms_days", Number(v))}
                    options={TERMS_OPTIONS.map((t) => ({ value: String(t.v), label: t.label }))}
                  />
                </Field>
                <Field label={`Opening balance (BBD$)${isEdit ? " · locked" : ""}`}>
                  <Input
                    type="number"
                    value={String(values.opening_balance)}
                    onChange={(v) => set("opening_balance", Number(v) || 0)}
                    disabled={isEdit}
                    mono
                  />
                </Field>
                <div>
                  <Toggle label="Tax exempt" checked={values.tax_exempt} onChange={(v) => set("tax_exempt", v)} />
                  {values.tax_exempt && (
                    <Field label="Tax ID (TIN)" className="mt-2">
                      <Input value={values.tax_id ?? ""} onChange={(v) => set("tax_id", v)} mono />
                    </Field>
                  )}
                </div>
              </div>
              {values.credit_limit === 0 && (
                <p className="mt-1 text-[11.5px] text-[#92400E]">Credit limit of 0 means cash-on-delivery only.</p>
              )}
            </Section>

            {/* 5. Sales */}
            <Section title="5. Sales assignment">
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Assigned sales rep">
                  <Select value={values.sales_rep_name ?? "Unassigned"} onChange={(v) => set("sales_rep_name", v)} options={SALES_REPS.map((r) => ({ value: r, label: r }))} />
                </Field>
                <Field label="How did they find us?">
                  <Select value={values.customer_source ?? ""} onChange={(v) => set("customer_source", v)} options={[{ value: "", label: "Select…" }, ...SOURCES.map((s) => ({ value: s, label: s }))]} />
                </Field>
              </div>
              <Field label="Internal notes (office-only)">
                <textarea
                  value={values.notes ?? ""}
                  onChange={(e) => set("notes", e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-[#E5E9EF] bg-white p-2.5 text-[13px] outline-none focus:border-[#0F2540]"
                />
              </Field>
            </Section>
          </div>

          {/* Right column summary */}
          <aside className="lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-xl border border-[#E5E9EF] bg-card p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">
                {isEdit ? "Edit summary" : "New customer summary"}
              </div>
              <div className="mt-3">
                <div className="text-[16px] font-bold text-ink">
                  {values.company_name || <span className="text-[#94A3B8]">Untitled customer</span>}
                </div>
                <div className="mt-1.5"><TierChip tier={values.pricing_tier} /></div>
              </div>
              <div className="mt-4 space-y-1 border-t border-[#E5E9EF] pt-3 text-[12.5px]">
                <SumRow k="Credit limit" v={formatBBD(values.credit_limit)} />
                <SumRow k="Payment terms" v={values.payment_terms_days === 0 ? "COD" : `Net ${values.payment_terms_days}`} />
                <SumRow k="Contact" v={values.contact_full_name || "—"} />
                <SumRow k="Email" v={values.contact_email || "—"} />
                {values.create_login && <SumRow k="Login" v="Will be created" hl />}
              </div>
              {Object.keys(liveErrors).length > 0 && (
                <div className="mt-4 border-t border-[#E5E9EF] pt-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[#B91C1C]">Validation</div>
                  <ul className="mt-1.5 space-y-0.5 text-[11.5px] text-[#B91C1C]">
                    {Object.entries(liveErrors).slice(0, 6).map(([k, v]) => (
                      <li key={k}>• {v}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* Sticky footer */}
      <div className="fixed bottom-0 left-[240px] right-0 z-40 border-t border-[#E5E9EF] bg-white/95 px-6 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-[1200px] items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => navigate({ to: "/office/customers" })}
            className="rounded-lg border border-[#E5E9EF] bg-white px-4 py-2 text-[13px] font-semibold text-ink hover:bg-[#FAFBFC]"
          >Cancel</button>
          {isEdit && (
            <button
              type="button"
              disabled={!canSubmit}
              onClick={() => submit(true)}
              className="rounded-lg border border-[#0B1A2E] bg-white px-4 py-2 text-[13px] font-semibold text-ink hover:bg-[#FAFBFC] disabled:opacity-50"
            >Save and view</button>
          )}
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => submit(false)}
            className="rounded-lg px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: "#0B1A2E" }}
          >{saving ? "Saving…" : isEdit ? "Save changes" : "Save customer"}</button>
        </div>
      </div>

      {generatedPassword && (
        <PasswordModal
          email={values.contact_email}
          password={generatedPassword}
          onClose={() => { setGeneratedPassword(null); navigate({ to: "/office/customers" }); }}
        />
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[#E5E9EF] bg-card p-5">
      <h2 className="text-[14px] font-bold text-ink">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function Field({
  label, children, error, required, className,
}: { label: string; children: React.ReactNode; error?: string; required?: boolean; className?: string }) {
  return (
    <div className={className}>
      <label className="mb-1 block text-[11.5px] font-semibold text-ink">
        {label}{required && <span className="text-[#B91C1C]"> *</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-[11px] font-medium text-[#B91C1C]">{error}</p>}
    </div>
  );
}

function Input({
  value, onChange, placeholder, type = "text", disabled, mono,
}: {
  value: string; onChange?: (v: string) => void; placeholder?: string;
  type?: string; disabled?: boolean; mono?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={`h-9 w-full rounded-lg border border-[#E5E9EF] bg-white px-2.5 text-[13px] outline-none placeholder:text-[#94A3B8] focus:border-[#0F2540] disabled:bg-[#F1F4F8] disabled:text-[#64748B] ${mono ? "" : ""}`}
    />
  );
}

function Select({
  value, onChange, options,
}: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full rounded-lg border border-[#E5E9EF] bg-white px-2.5 text-[13px] outline-none focus:border-[#0F2540]"
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[13px]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-[#CBD5E1] accent-[#FF6A1A]"
      />
      <span className="text-ink">{label}</span>
    </label>
  );
}

function SumRow({ k, v, hl }: { k: string; v: string; hl?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[#64748B]">{k}</span>
      <span className={`truncate text-right ${hl ? "font-semibold text-[#FF6A1A]" : "text-ink"}`}>{v}</span>
    </div>
  );
}

function PasswordModal({ email, password, onClose }: { email: string; password: string; onClose: () => void }) {
  const copy = () => {
    navigator.clipboard.writeText(password).then(() => toast.success("Password copied"));
  };
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <h4 className="text-[16px] font-bold text-ink">Login created</h4>
          <button onClick={onClose} className="text-[#64748B]"><X className="h-4 w-4" /></button>
        </div>
        <p className="mt-2 text-[13px] text-muted-foreground">
          Share these credentials with the customer manually. They won't be emailed automatically yet.
        </p>
        <div className="mt-4 space-y-2">
          <div className="rounded-lg border border-[#E5E9EF] bg-[#FAFBFC] p-2.5">
            <div className="text-[10.5px] uppercase tracking-wider text-[#64748B]">Email</div>
            <div className="text-[13px] text-ink">{email}</div>
          </div>
          <div className="rounded-lg border border-[#E5E9EF] bg-[#FAFBFC] p-2.5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10.5px] uppercase tracking-wider text-[#64748B]">Password</div>
                <div className="text-[14px] font-semibold text-ink">{password}</div>
              </div>
              <button onClick={copy} className="flex items-center gap-1 rounded-md border border-[#E5E9EF] bg-white px-2 py-1.5 text-[12px] font-semibold text-ink hover:bg-[#FAFBFC]">
                <Copy className="h-3.5 w-3.5" /> Copy
              </button>
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="mt-5 w-full rounded-lg px-4 py-2 text-[13px] font-semibold text-white"
          style={{ backgroundColor: "#0B1A2E" }}
        >Done</button>
      </div>
    </div>
  );
}
