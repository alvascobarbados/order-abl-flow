import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import QRCode from "qrcode";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { formatBBD, formatDate } from "@/lib/format";

type Props = {
  orderId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
};

type InvoicePreview = {
  invoice_number: string | null;
  order_number: string | null;
  invoiced_at: string | null;
  due_date: string | null;
  delivered_at: string | null;
  placed_at: string | null;
  subtotal: number;
  vat_amount: number;
  total: number;
  invoice_qr_code_data: string | null;
  customer: {
    customer_number: string | null;
    company_name: string;
    billing_address: string | null;
    billing_city: string | null;
    billing_parish: string | null;
    billing_postal: string | null;
    phone: string | null;
    payment_terms_days: number | null;
    sales_rep_name: string | null;
  } | null;
  items: {
    quantity: number;
    unit_price_at_order: number;
    line_total: number;
    product: { sku: string; name: string; pack_size: number | null; pack_unit: string | null } | null;
  }[];
};

type Settings = {
  company_name: string; company_address: string; company_phone: string; company_email: string;
  bank_name: string | null; bank_account: string | null; bank_branch: string | null; vat_rate: number;
};

async function loadInvoice(orderId: string): Promise<{ inv: InvoicePreview; settings: Settings }> {
  const [{ data: order, error: oerr }, { data: items, error: ierr }, { data: settings, error: serr }] = await Promise.all([
    supabase.from("orders")
      .select(`
        invoice_number, order_number, invoiced_at, due_date, delivered_at, placed_at,
        subtotal, vat_amount, total, invoice_qr_code_data,
        customer:customers(customer_number, company_name, billing_address, billing_city, billing_parish, billing_postal, phone, payment_terms_days, sales_rep_name)
      `)
      .eq("id", orderId).maybeSingle(),
    supabase.from("order_items")
      .select("quantity, unit_price_at_order, line_total, product:products(sku, name, pack_size, pack_unit)")
      .eq("order_id", orderId),
    supabase.from("system_settings")
      .select("company_name, company_address, company_phone, company_email, bank_name, bank_account, bank_branch, vat_rate")
      .eq("id", 1).maybeSingle(),
  ]);
  if (oerr) throw oerr;
  if (ierr) throw ierr;
  if (serr) throw serr;
  if (!order) throw new Error("Invoice not found");

  return {
    inv: { ...(order as any), items: (items ?? []) as any },
    settings: (settings ?? {
      company_name: "ABL Distribution", company_address: "Bridgetown, Barbados",
      company_phone: "", company_email: "", bank_name: null, bank_account: null, bank_branch: null, vat_rate: 17.5,
    }) as Settings,
  };
}

export function InvoicePreviewDrawer({ orderId, open, onOpenChange }: Props) {
  const { data, isPending, error } = useQuery({
    queryKey: ["warehouse-invoice-preview", orderId],
    queryFn: () => loadInvoice(orderId!),
    enabled: !!orderId && open,
    staleTime: 30_000,
  });

  const [qrUrl, setQrUrl] = useState<string>("");
  useEffect(() => {
    const code = data?.inv.invoice_qr_code_data || data?.inv.invoice_number;
    if (!code) { setQrUrl(""); return; }
    QRCode.toDataURL(code, {
      errorCorrectionLevel: "H", margin: 1, width: 200,
      color: { dark: "#0F2540", light: "#FFFFFF" },
    }).then(setQrUrl).catch(() => setQrUrl(""));
  }, [data?.inv.invoice_qr_code_data, data?.inv.invoice_number]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-[860px] overflow-y-auto sm:max-w-[860px] p-0">
        <SheetHeader className="border-b border-[#E5E9EF] bg-white px-6 py-4">
          <SheetTitle className="text-[16px] font-bold text-ink">Invoice preview</SheetTitle>
        </SheetHeader>

        {isPending && <div className="p-8 text-sm text-muted-foreground">Loading invoice…</div>}
        {error && <div className="p-8 text-sm text-[#B91C1C]">Failed to load invoice: {(error as Error).message}</div>}

        {data && (
          <div className="bg-[#F5F7FA] p-6">
            <article className="mx-auto max-w-[760px] rounded-md bg-white p-8 text-[#0B1A2E] shadow-sm" style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
              <InvoiceBody inv={data.inv} settings={data.settings} qrUrl={qrUrl} />
            </article>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function InvoiceBody({ inv, settings, qrUrl }: { inv: InvoicePreview; settings: Settings; qrUrl: string }) {
  const c = inv.customer;
  const cityLine = [c?.billing_city, c?.billing_parish].filter(Boolean).join(", ");
  const bankLine = settings.bank_name
    ? `Bank: ${settings.bank_name}${settings.bank_account ? ` · Account: ${settings.bank_account}` : ""}${settings.bank_branch ? ` · Branch: ${settings.bank_branch}` : ""}`
    : "Bank details available on request";
  const vatLabel = `VAT (${Number(settings.vat_rate ?? 17.5)}% included)`;

  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between gap-6">
        <div className="flex-1">
          <h1 className="text-[22px] font-bold tracking-wide text-[#0F2540]">{(settings.company_name || "ABL DISTRIBUTION").toUpperCase()}</h1>
          <div className="mt-0.5 text-[11px] text-muted-foreground">Foodservice Supply · Barbados</div>
          <div className="mt-3 whitespace-pre-line text-[11px] leading-snug text-ink">
            {settings.company_address}{"\n"}
            {settings.company_phone}{settings.company_email ? ` · ${settings.company_email}` : ""}
          </div>
        </div>
        <div className="flex flex-col items-end">
          <div className="text-[28px] font-bold tracking-wider text-[#0F2540]">INVOICE</div>
          <div className="mt-1 font-mono text-[14px] font-bold text-ink">{inv.invoice_number ?? "—"}</div>
          <div className="mt-2 text-right text-[11px] leading-snug text-muted-foreground">
            Invoice date: {formatDate(inv.invoiced_at)}<br />
            Due date: {formatDate(inv.due_date)}
          </div>
          {qrUrl && (
            <div className="mt-3 flex flex-col items-center">
              <div className="text-[8px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Driver scan</div>
              <img src={qrUrl} alt="invoice qr" className="mt-1 h-[100px] w-[100px]" />
              <div className="mt-1 font-mono text-[9px] text-ink">{inv.invoice_number}</div>
            </div>
          )}
        </div>
      </div>

      <div className="my-4 h-[1px] bg-[#0F2540]" />

      {/* Bill to */}
      <div>
        <div className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Bill to</div>
        <div className="mt-1 text-[15px] font-bold text-ink">{c?.company_name ?? "—"}</div>
        {c?.billing_address && <div className="mt-1 text-[12px] text-ink">{c.billing_address}</div>}
        {cityLine && <div className="text-[12px] text-ink">{cityLine}{c?.billing_postal ? ` · ${c.billing_postal}` : ""}</div>}
        {c?.phone && <div className="text-[12px] text-ink">{c.phone}</div>}
        {c?.customer_number && <div className="mt-1 font-mono text-[11px] text-muted-foreground">{c.customer_number}</div>}
      </div>

      {/* Details bar */}
      <div className="mt-5 grid grid-cols-5 gap-2 rounded bg-[#FAFBFC] px-3 py-2.5">
        <DetailCell label="Order #" value={inv.order_number ?? "—"} />
        <DetailCell label="Order date" value={formatDate(inv.placed_at)} />
        <DetailCell label="Delivery" value={formatDate(inv.delivered_at)} />
        <DetailCell label="Terms" value={`Net ${c?.payment_terms_days ?? 30}`} />
        <DetailCell label="Sales rep" value={c?.sales_rep_name ?? "—"} />
      </div>

      {/* Items */}
      <div className="mt-5 overflow-hidden rounded border border-[#E5E9EF]">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="bg-[#0F2540] text-white">
              <th className="px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wider">SKU</th>
              <th className="px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wider">Description</th>
              <th className="px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wider">Pack</th>
              <th className="px-2 py-2 text-right text-[10px] font-bold uppercase tracking-wider">Qty</th>
              <th className="px-2 py-2 text-right text-[10px] font-bold uppercase tracking-wider">Unit</th>
              <th className="px-2 py-2 text-right text-[10px] font-bold uppercase tracking-wider">Total</th>
            </tr>
          </thead>
          <tbody>
            {inv.items.map((it, i) => (
              <tr key={i} className={i % 2 === 1 ? "bg-[#FAFBFC]" : ""}>
                <td className="px-2 py-1.5 font-mono text-[11px]">{it.product?.sku ?? "—"}</td>
                <td className="px-2 py-1.5">{it.product?.name ?? "—"}</td>
                <td className="px-2 py-1.5 text-[11px] text-muted-foreground">
                  {it.product?.pack_size ? `${it.product.pack_size} / ${it.product.pack_unit ?? "case"}` : (it.product?.pack_unit ?? "—")}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">{it.quantity}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{formatBBD(Number(it.unit_price_at_order))}</td>
                <td className="px-2 py-1.5 text-right font-bold tabular-nums">{formatBBD(Number(it.line_total))}</td>
              </tr>
            ))}
            {inv.items.length === 0 && (
              <tr><td colSpan={6} className="px-2 py-4 text-center text-[11px] text-muted-foreground">No items</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Bottom */}
      <div className="mt-5 flex justify-between gap-6">
        <div className="w-[55%]">
          <div className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Payment information</div>
          <div className="mt-1 text-[11px] leading-relaxed text-ink">
            Payment due: {formatDate(inv.due_date)}<br />
            Methods: Cash · Cheque · Bank Transfer<br />
            {bankLine}<br />
            Please reference invoice number on all payments
          </div>
        </div>
        <div className="w-[40%] self-end">
          <div className="flex justify-between py-1 text-[12px]">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular-nums">{formatBBD(Number(inv.subtotal))}</span>
          </div>
          <div className="flex justify-between py-1 text-[12px]">
            <span className="text-muted-foreground">{vatLabel}</span>
            <span className="tabular-nums">{formatBBD(Number(inv.vat_amount))}</span>
          </div>
          <div className="mt-2 flex justify-between border-t-2 border-[#0F2540] pt-2">
            <span className="text-[13px] font-bold text-[#0F2540]">Total due</span>
            <span className="text-[18px] font-bold tabular-nums text-[#0F2540]">{formatBBD(Number(inv.total))}</span>
          </div>
        </div>
      </div>

      <div className="mt-6 border-t border-[#E5E9EF] pt-3 text-[10px] text-muted-foreground">
        Thank you for your business{settings.company_email ? ` · Questions? ${settings.company_email}` : ""}
      </div>
    </>
  );
}

function DetailCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[8px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-[12px] font-bold text-ink">{value}</div>
    </div>
  );
}
