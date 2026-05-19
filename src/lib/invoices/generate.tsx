import QRCode from "qrcode";
import { pdf } from "@react-pdf/renderer";
import { supabase } from "@/integrations/supabase/client";
import { InvoicePdf, InvoiceBatchPdf, type InvoiceData, type InvoiceCompany } from "./InvoicePdf";
import { toast } from "sonner";

type GenerateOpts = { regenerate?: boolean };

const DEFAULT_COMPANY: InvoiceCompany = {
  company_name: "ABL Distribution",
  company_address: "Bridgetown, Barbados",
  company_phone: "+1 (246) XXX-XXXX",
  company_email: "orders@alvascodistribution.com",
  bank_name: null,
  bank_account: null,
  bank_branch: null,
  vat_rate: 17.5,
};

let companyCache: { value: InvoiceCompany; at: number } | null = null;
async function getCompany(): Promise<InvoiceCompany> {
  if (companyCache && Date.now() - companyCache.at < 60_000) return companyCache.value;
  const { data } = await supabase
    .from("system_settings")
    .select("company_name, company_address, company_phone, company_email, bank_name, bank_account, bank_branch, vat_rate")
    .eq("id", 1)
    .maybeSingle();
  const value: InvoiceCompany = data
    ? {
        company_name: (data as any).company_name ?? DEFAULT_COMPANY.company_name,
        company_address: (data as any).company_address ?? DEFAULT_COMPANY.company_address,
        company_phone: (data as any).company_phone ?? DEFAULT_COMPANY.company_phone,
        company_email: (data as any).company_email ?? DEFAULT_COMPANY.company_email,
        bank_name: (data as any).bank_name ?? null,
        bank_account: (data as any).bank_account ?? null,
        bank_branch: (data as any).bank_branch ?? null,
        vat_rate: Number((data as any).vat_rate ?? 17.5),
      }
    : DEFAULT_COMPANY;
  companyCache = { value, at: Date.now() };
  return value;
}

async function fetchInvoiceData(orderId: string, company: InvoiceCompany): Promise<InvoiceData> {
  const { data: o, error } = await supabase
    .from("orders")
    .select(`
      id, order_number, invoice_number, invoiced_at, due_date, delivered_at, placed_at,
      subtotal, vat_amount, total,
      customer:customers(customer_number, company_name, billing_address, billing_city, billing_parish, billing_postal, phone, payment_terms_days, sales_rep_name, contact_profile_id),
      items:order_items(quantity, unit_price_at_order, line_total, product:products(sku, name, pack_size, pack_unit))
    `)
    .eq("id", orderId)
    .single();
  if (error || !o) throw new Error(error?.message || "Order not found");
  if (!o.invoice_number) throw new Error("Order is not yet invoiced");

  let contactEmail: string | null = null;
  const cpId = (o.customer as any)?.contact_profile_id;
  if (cpId) {
    const { data: p } = await supabase.from("profiles").select("email").eq("id", cpId).maybeSingle();
    contactEmail = (p as any)?.email ?? null;
  }

  return {
    invoice_number: o.invoice_number,
    order_number: o.order_number,
    invoiced_at: o.invoiced_at,
    due_date: o.due_date,
    delivered_at: o.delivered_at,
    placed_at: o.placed_at,
    subtotal: Number(o.subtotal),
    vat_amount: Number(o.vat_amount),
    total: Number(o.total),
    customer: {
      customer_number: (o.customer as any)?.customer_number ?? null,
      company_name: (o.customer as any)?.company_name ?? "—",
      billing_address: (o.customer as any)?.billing_address ?? null,
      billing_city: (o.customer as any)?.billing_city ?? null,
      billing_parish: (o.customer as any)?.billing_parish ?? null,
      billing_postal: (o.customer as any)?.billing_postal ?? null,
      phone: (o.customer as any)?.phone ?? null,
      payment_terms_days: (o.customer as any)?.payment_terms_days ?? null,
      sales_rep_name: (o.customer as any)?.sales_rep_name ?? null,
      contact_email: contactEmail,
    },
    items: ((o.items ?? []) as any[]).map((it) => ({
      sku: it.product?.sku ?? "—",
      name: it.product?.name ?? "Item",
      pack_size: it.product?.pack_size ?? null,
      pack_unit: it.product?.pack_unit ?? null,
      quantity: Number(it.quantity),
      unit_price: Number(it.unit_price_at_order),
      line_total: Number(it.line_total),
    })),
    qrDataUrl: "",
    company,
  };
}

async function makeQr(invoiceNumber: string): Promise<string> {
  return QRCode.toDataURL(invoiceNumber, {
    errorCorrectionLevel: "H",
    margin: 1,
    width: 240,
    color: { dark: "#0F2540", light: "#FFFFFF" },
  });
}

export async function getOrGenerateInvoicePdf(orderId: string, opts: GenerateOpts = {}): Promise<string> {
  const { data: existing } = await supabase.from("orders")
    .select("invoice_number, invoice_pdf_url")
    .eq("id", orderId).maybeSingle();
  if (!existing?.invoice_number) throw new Error("Order is not yet invoiced");
  if (existing.invoice_pdf_url && !opts.regenerate) return existing.invoice_pdf_url;

  const company = await getCompany();
  const data = await fetchInvoiceData(orderId, company);
  data.qrDataUrl = await makeQr(data.invoice_number);

  const blob = await pdf(<InvoicePdf data={data} />).toBlob();
  const path = `${data.invoice_number}.pdf`;
  const up = await supabase.storage.from("invoices").upload(path, blob, {
    contentType: "application/pdf", upsert: true,
  });
  if (up.error) throw up.error;

  const { data: pub } = supabase.storage.from("invoices").getPublicUrl(path);
  const url = `${pub.publicUrl}?v=${Date.now()}`;
  await supabase.from("orders").update({
    invoice_pdf_url: url,
    invoice_pdf_generated_at: new Date().toISOString(),
  }).eq("id", orderId);
  return url;
}

export async function openInvoicePdf(orderId: string, opts: { regenerate?: boolean; print?: boolean } = {}) {
  const tab = window.open("about:blank", "_blank");
  try {
    const url = await getOrGenerateInvoicePdf(orderId, { regenerate: opts.regenerate });
    if (tab) {
      tab.location.href = url;
      if (opts.print) {
        setTimeout(() => { try { tab.focus(); tab.print(); } catch {} }, 1200);
      }
    } else {
      window.location.href = url;
    }
    return url;
  } catch (e: any) {
    tab?.close();
    toast.error(e?.message ?? "Could not open invoice");
    throw e;
  }
}

/** Build one Document containing every invoice and open the print dialog. */
export async function printInvoicesBulk(orderIds: string[]): Promise<void> {
  if (orderIds.length === 0) return;
  const tab = window.open("about:blank", "_blank");
  try {
    const company = await getCompany();
    const datas: InvoiceData[] = [];
    for (const id of orderIds) {
      try {
        const data = await fetchInvoiceData(id, company);
        data.qrDataUrl = await makeQr(data.invoice_number);
        datas.push(data);
      } catch (e: any) {
        toast.warning(`Skipped ${id.slice(0, 8)}: ${e?.message ?? "no invoice"}`);
      }
    }
    if (!datas.length) {
      tab?.close();
      toast.error("No invoiced orders in selection");
      return;
    }
    const blob = await pdf(<InvoiceBatchPdf invoices={datas} />).toBlob();
    const url = URL.createObjectURL(blob);
    if (tab) {
      tab.location.href = url;
      setTimeout(() => { try { tab.focus(); tab.print(); } catch {} }, 1200);
    } else {
      window.location.href = url;
    }
    toast.success(`${datas.length} invoice${datas.length === 1 ? "" : "s"} ready to print`);
  } catch (e: any) {
    tab?.close();
    toast.error(e?.message ?? "Bulk print failed");
  }
}

/** Find packed/invoiced/delivered/paid orders with an invoice number but no
 *  PDF, then loop through them generating + uploading. */
export async function backfillMissingInvoicePdfs(
  onProgress?: (done: number, total: number, label: string) => void,
): Promise<{ generated: number; failed: number }> {
  const { data: rows, error } = await supabase.from("orders")
    .select("id, order_number, invoice_number, invoice_pdf_url")
    .not("invoice_number", "is", null)
    .is("invoice_pdf_url", null)
    .order("invoiced_at", { ascending: true });
  if (error) throw error;
  const list = (rows ?? []) as Array<{ id: string; order_number: string | null; invoice_number: string }>;
  if (!list.length) return { generated: 0, failed: 0 };

  let done = 0, generated = 0, failed = 0;
  for (const r of list) {
    onProgress?.(done, list.length, r.invoice_number ?? r.order_number ?? "");
    try {
      await getOrGenerateInvoicePdf(r.id, { regenerate: true });
      generated++;
    } catch (e: any) {
      failed++;
      // Surface but don't stop the run.
      // eslint-disable-next-line no-console
      console.warn(`Backfill ${r.invoice_number}:`, e?.message ?? e);
    }
    done++;
  }
  onProgress?.(done, list.length, "done");
  return { generated, failed };
}
