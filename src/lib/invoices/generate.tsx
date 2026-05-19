import QRCode from "qrcode";
import { pdf } from "@react-pdf/renderer";
import { supabase } from "@/integrations/supabase/client";
import { InvoicePdf, type InvoiceData } from "./InvoicePdf";
import { toast } from "sonner";

type GenerateOpts = { regenerate?: boolean };

async function fetchInvoiceData(orderId: string): Promise<InvoiceData> {
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
  };
}

export async function getOrGenerateInvoicePdf(orderId: string, opts: GenerateOpts = {}): Promise<string> {
  const { data: existing } = await supabase.from("orders")
    .select("invoice_number, invoice_pdf_url")
    .eq("id", orderId).maybeSingle();
  if (!existing?.invoice_number) throw new Error("Order is not yet invoiced");
  if (existing.invoice_pdf_url && !opts.regenerate) return existing.invoice_pdf_url;

  const data = await fetchInvoiceData(orderId);
  data.qrDataUrl = await QRCode.toDataURL(data.invoice_number, {
    errorCorrectionLevel: "H",
    margin: 1,
    width: 240,
    color: { dark: "#0F2540", light: "#FFFFFF" },
  });

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
