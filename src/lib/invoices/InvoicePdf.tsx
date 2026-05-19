import { Document, Page, View, Text, Image, StyleSheet, Font } from "@react-pdf/renderer";

import JakartaReg from "@/assets/fonts/PlusJakartaSans-Regular.ttf?url";
import JakartaBold from "@/assets/fonts/PlusJakartaSans-Bold.ttf?url";
import MonoReg from "@/assets/fonts/JetBrainsMono-Regular.ttf?url";
import MonoBold from "@/assets/fonts/JetBrainsMono-Bold.ttf?url";

// Register brand fonts once at module load. Safe to call multiple times.
let fontsRegistered = false;
function ensureFonts() {
  if (fontsRegistered) return;
  try {
    Font.register({
      family: "Jakarta",
      fonts: [
        { src: JakartaReg, fontWeight: 400 },
        { src: JakartaBold, fontWeight: 700 },
      ],
    });
    Font.register({
      family: "Mono",
      fonts: [
        { src: MonoReg, fontWeight: 400 },
        { src: MonoBold, fontWeight: 700 },
      ],
    });
    fontsRegistered = true;
  } catch {
    /* react-pdf will fall back to Helvetica if registration fails */
  }
}
ensureFonts();

export type InvoiceCompany = {
  company_name: string;
  company_address: string;
  company_phone: string;
  company_email: string;
  bank_name: string | null;
  bank_account: string | null;
  bank_branch: string | null;
  vat_rate: number;
};

export type InvoiceData = {
  invoice_number: string;
  order_number: string | null;
  invoiced_at: string | null;
  due_date: string | null;
  delivered_at: string | null;
  placed_at: string | null;
  subtotal: number;
  vat_amount: number;
  total: number;
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
    contact_email?: string | null;
  };
  items: {
    sku: string;
    name: string;
    pack_size: number | null;
    pack_unit: string | null;
    quantity: number;
    unit_price: number;
    line_total: number;
  }[];
  qrDataUrl: string;
  company: InvoiceCompany;
};

const NAVY = "#0F2540";
const INK = "#0B1A2E";
const MUTED = "#6B7280";
const BORDER = "#E5E9EF";
const ROW_ALT = "#FAFBFC";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 9.5, color: INK, fontFamily: "Jakarta" },
  headerRow: { flexDirection: "row", justifyContent: "space-between" },
  brand: { width: "55%" },
  brandTitle: { fontSize: 22, fontWeight: 700, color: NAVY, letterSpacing: 0.5 },
  brandSub: { fontSize: 9, color: MUTED, marginTop: 2 },
  brandMeta: { fontSize: 9, color: INK, marginTop: 10, lineHeight: 1.4 },
  invoiceBlock: { width: "42%", alignItems: "flex-end" },
  invoiceWord: { fontSize: 28, fontWeight: 700, color: NAVY, letterSpacing: 1 },
  invoiceNo: { fontFamily: "Mono", fontSize: 13, fontWeight: 700, marginTop: 4, color: INK },
  invMeta: { fontSize: 9, color: MUTED, marginTop: 8, textAlign: "right", lineHeight: 1.4 },
  dividerNavy: { height: 1, backgroundColor: NAVY, marginTop: 14, marginBottom: 14 },

  qrWrap: { position: "absolute", top: 40, right: 40, width: 110, alignItems: "center" },
  qrLabel: { fontSize: 7, color: MUTED, marginBottom: 3, textTransform: "uppercase", letterSpacing: 1 },
  qrImage: { width: 100, height: 100 },
  qrFallback: { fontFamily: "Mono", fontSize: 8, marginTop: 4, color: INK },

  twoCol: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  billBlock: { width: "55%" },
  miniLabel: { fontFamily: "Mono", fontSize: 7.5, color: MUTED, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 },
  custName: { fontSize: 13, fontWeight: 700, color: INK },
  custLine: { fontSize: 9.5, color: INK, marginTop: 1.5, lineHeight: 1.35 },
  custMono: { fontFamily: "Mono", fontSize: 9, color: MUTED, marginTop: 4 },

  detailsBar: { flexDirection: "row", backgroundColor: ROW_ALT, marginTop: 18, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 4 },
  detailsCell: { flex: 1, paddingHorizontal: 4 },
  detailsLabel: { fontFamily: "Mono", fontSize: 7, color: MUTED, textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 },
  detailsValue: { fontSize: 9.5, fontWeight: 700, color: INK },

  table: { marginTop: 16, borderWidth: 1, borderColor: BORDER, borderRadius: 3 },
  thead: { flexDirection: "row", backgroundColor: NAVY, paddingVertical: 7, paddingHorizontal: 6 },
  th: { color: "#FFFFFF", fontSize: 8.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 },
  tr: { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 6, borderTopWidth: 0.5, borderTopColor: BORDER },
  trAlt: { backgroundColor: ROW_ALT },
  td: { fontSize: 9.5, color: INK },
  cSku: { width: "13%", fontFamily: "Mono", fontSize: 8.5 },
  cDesc: { width: "37%" },
  cPack: { width: "16%", fontSize: 8.5, color: MUTED },
  cQty: { width: "8%", textAlign: "right", fontFamily: "Mono" },
  cPrice: { width: "13%", textAlign: "right", fontFamily: "Mono" },
  cTotal: { width: "13%", textAlign: "right", fontFamily: "Mono", fontWeight: 700 },

  bottomRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 18 },
  paySide: { width: "55%" },
  payHeader: { fontFamily: "Mono", fontSize: 8, color: MUTED, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 },
  payLine: { fontSize: 9, color: INK, marginTop: 1.5, lineHeight: 1.4 },

  totals: { width: "40%", alignSelf: "flex-end" },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  totalsLabel: { fontSize: 10, color: MUTED },
  totalsValue: { fontFamily: "Mono", fontSize: 10, color: INK },
  totalsDueRow: { flexDirection: "row", justifyContent: "space-between", paddingTop: 8, marginTop: 6, borderTopWidth: 2, borderTopColor: NAVY },
  totalsDueLabel: { fontSize: 12, fontWeight: 700, color: NAVY },
  totalsDueValue: { fontFamily: "Mono", fontSize: 18, fontWeight: 700, color: NAVY },

  footer: { position: "absolute", bottom: 30, left: 40, right: 40, paddingTop: 10, borderTopWidth: 0.5, borderTopColor: BORDER, flexDirection: "row", justifyContent: "space-between" },
  footerLeft: { fontSize: 8, color: MUTED },
  footerRight: { fontSize: 8, color: MUTED },
});

function fmtMoney(n: number): string {
  return "BBD$ " + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  try { return new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); } catch { return "—"; }
}

/** Single A4 page representing one invoice. Exported so bulk-print can stack
 *  many invoices in one Document. */
export function InvoicePage({ data }: { data: InvoiceData }) {
  const billLines = [
    [data.customer.billing_city, data.customer.billing_parish].filter(Boolean).join(", "),
    data.customer.billing_postal,
  ].filter(Boolean);
  const co = data.company;
  const vatLabel = `VAT (${Number(co.vat_rate ?? 17.5)}% included)`;
  const bankLine = co.bank_name
    ? `Bank: ${co.bank_name}${co.bank_account ? ` · Account: ${co.bank_account}` : ""}${co.bank_branch ? ` · Branch: ${co.bank_branch}` : ""}`
    : "Bank details available on request";

  return (
    <Page size="A4" style={styles.page}>
      {/* QR top-right */}
      <View style={styles.qrWrap}>
        <Text style={styles.qrLabel}>Driver scan</Text>
        {data.qrDataUrl ? <Image src={data.qrDataUrl} style={styles.qrImage} /> : null}
        <Text style={styles.qrFallback}>{data.invoice_number}</Text>
      </View>

      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.brand}>
          <Text style={styles.brandTitle}>{(co.company_name || "ABL DISTRIBUTION").toUpperCase()}</Text>
          <Text style={styles.brandSub}>Foodservice Supply · Barbados</Text>
          <Text style={styles.brandMeta}>
            {co.company_address}{"\n"}
            {co.company_phone} · {co.company_email}
          </Text>
        </View>
        <View style={styles.invoiceBlock}>
          <Text style={styles.invoiceWord}>INVOICE</Text>
          <Text style={styles.invoiceNo}>{data.invoice_number}</Text>
          <Text style={styles.invMeta}>
            Invoice date: {fmtDate(data.invoiced_at)}{"\n"}
            Due date: {fmtDate(data.due_date)}
          </Text>
        </View>
      </View>

      <View style={styles.dividerNavy} />

      {/* Bill to */}
      <View style={styles.twoCol}>
        <View style={styles.billBlock}>
          <Text style={styles.miniLabel}>Bill to</Text>
          <Text style={styles.custName}>{data.customer.company_name}</Text>
          {data.customer.billing_address ? <Text style={styles.custLine}>{data.customer.billing_address}</Text> : null}
          {billLines.length > 0 ? <Text style={styles.custLine}>{billLines.join(" · ")}</Text> : null}
          {data.customer.phone ? <Text style={styles.custLine}>{data.customer.phone}</Text> : null}
          {data.customer.contact_email ? <Text style={styles.custLine}>{data.customer.contact_email}</Text> : null}
          {data.customer.customer_number ? <Text style={styles.custMono}>{data.customer.customer_number}</Text> : null}
        </View>
      </View>

      {/* Details bar */}
      <View style={styles.detailsBar}>
        <View style={styles.detailsCell}><Text style={styles.detailsLabel}>Order #</Text><Text style={styles.detailsValue}>{data.order_number ?? "—"}</Text></View>
        <View style={styles.detailsCell}><Text style={styles.detailsLabel}>Order date</Text><Text style={styles.detailsValue}>{fmtDate(data.placed_at)}</Text></View>
        <View style={styles.detailsCell}><Text style={styles.detailsLabel}>Delivery date</Text><Text style={styles.detailsValue}>{fmtDate(data.delivered_at)}</Text></View>
        <View style={styles.detailsCell}><Text style={styles.detailsLabel}>Terms</Text><Text style={styles.detailsValue}>Net {data.customer.payment_terms_days ?? 30}</Text></View>
        <View style={styles.detailsCell}><Text style={styles.detailsLabel}>Sales rep</Text><Text style={styles.detailsValue}>{data.customer.sales_rep_name ?? "—"}</Text></View>
      </View>

      {/* Items table */}
      <View style={styles.table}>
        <View style={styles.thead}>
          <Text style={[styles.th, styles.cSku]}>SKU</Text>
          <Text style={[styles.th, styles.cDesc]}>Description</Text>
          <Text style={[styles.th, styles.cPack]}>Pack</Text>
          <Text style={[styles.th, styles.cQty]}>Qty</Text>
          <Text style={[styles.th, styles.cPrice]}>Unit</Text>
          <Text style={[styles.th, styles.cTotal]}>Total</Text>
        </View>
        {data.items.map((it, i) => (
          <View key={i} style={[styles.tr, i % 2 === 1 ? styles.trAlt : {}]}>
            <Text style={[styles.td, styles.cSku]}>{it.sku}</Text>
            <Text style={[styles.td, styles.cDesc]}>{it.name}</Text>
            <Text style={[styles.td, styles.cPack]}>{it.pack_size ? `${it.pack_size} / ${it.pack_unit ?? "case"}` : (it.pack_unit ?? "—")}</Text>
            <Text style={[styles.td, styles.cQty]}>{it.quantity}</Text>
            <Text style={[styles.td, styles.cPrice]}>{fmtMoney(it.unit_price)}</Text>
            <Text style={[styles.td, styles.cTotal]}>{fmtMoney(it.line_total)}</Text>
          </View>
        ))}
      </View>

      {/* Bottom: payment info + totals */}
      <View style={styles.bottomRow}>
        <View style={styles.paySide}>
          <Text style={styles.payHeader}>Payment information</Text>
          <Text style={styles.payLine}>Payment due: {fmtDate(data.due_date)}</Text>
          <Text style={styles.payLine}>Methods: Cash · Cheque · Bank Transfer</Text>
          <Text style={styles.payLine}>{bankLine}</Text>
          <Text style={styles.payLine}>Please reference invoice number on all payments</Text>
        </View>
        <View style={styles.totals}>
          <View style={styles.totalsRow}><Text style={styles.totalsLabel}>Subtotal</Text><Text style={styles.totalsValue}>{fmtMoney(data.subtotal)}</Text></View>
          <View style={styles.totalsRow}><Text style={styles.totalsLabel}>{vatLabel}</Text><Text style={styles.totalsValue}>{fmtMoney(data.vat_amount)}</Text></View>
          <View style={styles.totalsDueRow}><Text style={styles.totalsDueLabel}>Total due</Text><Text style={styles.totalsDueValue}>{fmtMoney(data.total)}</Text></View>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer} fixed>
        <Text style={styles.footerLeft}>Thank you for your business · Questions? {co.company_email}</Text>
        <Text style={styles.footerRight} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
      </View>
    </Page>
  );
}

/** Single-invoice Document. */
export function InvoicePdf({ data }: { data: InvoiceData }) {
  return (
    <Document title={`Invoice ${data.invoice_number}`} author={data.company.company_name}>
      <InvoicePage data={data} />
    </Document>
  );
}

/** Many invoices stacked into one printable Document. */
export function InvoiceBatchPdf({ invoices }: { invoices: InvoiceData[] }) {
  return (
    <Document title={`Invoices (${invoices.length})`} author={invoices[0]?.company.company_name ?? "ABL Distribution"}>
      {invoices.map((d) => <InvoicePage key={d.invoice_number} data={d} />)}
    </Document>
  );
}
