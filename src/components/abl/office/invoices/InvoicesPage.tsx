import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { formatBBD, formatDate } from "@/lib/format";
import { TabbedShell } from "../TabbedShell";

type Row = {
  id: string;
  order_number: string | null;
  invoice_number: string | null;
  customer_id: string;
  status: string;
  total: number;
  invoiced_at: string | null;
  paid_at: string | null;
  due_date: Date | null;
  paid_so_far: number;
  balance: number;
  days_overdue: number;
  customer_name: string;
};

type Tab = "outstanding" | "overdue" | "paid" | "all";

export function InvoicesPage() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { tab?: Tab };
  const [tab, setTab] = useState<Tab>(search.tab ?? "outstanding");
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    (async () => {
      const [{ data: orders }, { data: customers }, { data: allocs }] = await Promise.all([
        supabase.from("orders").select("id, order_number, invoice_number, customer_id, status, total, invoiced_at, paid_at").not("invoice_number", "is", null),
        supabase.from("customers").select("id, company_name, payment_terms_days"),
        supabase.from("payment_allocations").select("order_id, amount, payment:payments!inner(status)"),
      ]);
      const custMap: Record<string, any> = {};
      (customers ?? []).forEach((c: any) => (custMap[c.id] = c));
      const paidMap: Record<string, number> = {};
      (allocs ?? []).forEach((a: any) => {
        if (a.payment?.status === "cleared" && a.order_id) {
          paidMap[a.order_id] = (paidMap[a.order_id] ?? 0) + Number(a.amount);
        }
      });
      const today = Date.now();
      const out: Row[] = (orders ?? []).map((o: any) => {
        const cust = custMap[o.customer_id] ?? {};
        const terms = cust.payment_terms_days ?? 30;
        const due = o.invoiced_at ? new Date(new Date(o.invoiced_at).getTime() + terms * 86_400_000) : null;
        const paid = paidMap[o.id] ?? 0;
        const balance = Math.max(0, Number(o.total) - paid);
        const days = due ? Math.floor((today - due.getTime()) / 86_400_000) : 0;
        return {
          id: o.id, order_number: o.order_number, invoice_number: o.invoice_number,
          customer_id: o.customer_id, status: o.status, total: Number(o.total),
          invoiced_at: o.invoiced_at, paid_at: o.paid_at,
          due_date: due, paid_so_far: paid, balance,
          days_overdue: days > 0 && balance > 0 ? days : 0,
          customer_name: cust.company_name ?? "—",
        };
      });
      setRows(out);
    })();
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const outstanding = r.status === "invoiced" && r.balance > 0.001;
      if (tab === "outstanding") return outstanding;
      if (tab === "overdue") return outstanding && r.days_overdue > 0;
      if (tab === "paid") return r.status === "paid" || r.balance <= 0.001;
      return true;
    }).sort((a, b) => (b.invoiced_at ?? "").localeCompare(a.invoiced_at ?? ""));
  }, [rows, tab]);

  const counts = useMemo(() => ({
    outstanding: rows.filter((r) => r.status === "invoiced" && r.balance > 0.001).length,
    overdue: rows.filter((r) => r.status === "invoiced" && r.balance > 0.001 && r.days_overdue > 0).length,
    paid: rows.filter((r) => r.status === "paid" || r.balance <= 0.001).length,
    all: rows.length,
  }), [rows]);

  return (
    <TabbedShell
      eyebrow="FINANCIAL · INVOICES"
      title="Invoices"
      blurb="Track invoiced orders, balances, and overdue accounts receivable."
      tabs={[
        { key: "outstanding", label: "Outstanding", count: counts.outstanding },
        { key: "overdue", label: "Overdue", count: counts.overdue },
        { key: "paid", label: "Paid", count: counts.paid },
        { key: "all", label: "All", count: counts.all },
      ]}
      activeKey={tab}
      onTabChange={(k) => {
        setTab(k as Tab);
        navigate({ to: "/office/invoices", search: { tab: k } as any, replace: true });
      }}
    >
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center text-[13px] text-muted-foreground">
          Nothing in this view.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-[12.5px]">
            <thead className="bg-secondary text-left text-[10.5px] uppercase text-muted-foreground" style={{ letterSpacing: "0.06em" }}>
              <tr>
                <th className="px-3 py-2.5">Invoice #</th>
                <th className="px-3 py-2.5">Order #</th>
                <th className="px-3 py-2.5">Customer</th>
                <th className="px-3 py-2.5">Invoice date</th>
                <th className="px-3 py-2.5">Due date</th>
                <th className="px-3 py-2.5 text-right">Total</th>
                <th className="px-3 py-2.5 text-right">Paid</th>
                <th className="px-3 py-2.5 text-right">Balance</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5 text-right">Days overdue</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="cursor-pointer border-t border-border hover:bg-secondary/40">
                  <td className="px-3 py-2.5 font-mono font-semibold text-ink">{r.invoice_number}</td>
                  <td className="px-3 py-2.5 font-mono text-muted-foreground">{r.order_number}</td>
                  <td className="px-3 py-2.5 font-semibold text-ink">{r.customer_name}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{formatDate(r.invoiced_at)}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{r.due_date ? formatDate(r.due_date) : "—"}</td>
                  <td className="px-3 py-2.5 text-right font-mono">{formatBBD(r.total)}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-[#047857]">{formatBBD(r.paid_so_far)}</td>
                  <td className="px-3 py-2.5 text-right font-mono font-semibold text-ink">{formatBBD(r.balance)}</td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10.5px] font-semibold text-ink">
                      {r.status === "paid" || r.balance <= 0.001 ? "Paid" : r.days_overdue > 0 ? "Overdue" : "Outstanding"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {r.days_overdue > 0 ? (
                      <span className="font-mono font-bold text-[#B91C1C]">{r.days_overdue}d</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </TabbedShell>
  );
}
