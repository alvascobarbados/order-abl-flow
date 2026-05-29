import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Search, MoreHorizontal, Building2, ChevronDown, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBBD } from "@/lib/format";
import { TierChip } from "./TierChip";
import { CustomerDetailDrawer } from "./CustomerDetailDrawer";
import { toast } from "sonner";
import { qk } from "@/lib/query-keys";

export type CustomerRow = {
  id: string;
  customer_number: string | null;
  company_name: string;
  trading_name: string | null;
  phone: string | null;
  pricing_tier: "standard" | "volume" | "key_account";
  credit_limit: number;
  current_balance: number;
  payment_terms_days: number;
  is_active: boolean;
  deleted_at: string | null;
  contact_profile_id: string | null;
  billing_address: string | null;
  delivery_address: string | null;
  billing_city: string | null;
  billing_parish: string | null;
  billing_postal: string | null;
  delivery_address_same_as_billing: boolean;
  delivery_city: string | null;
  delivery_parish: string | null;
  delivery_postal: string | null;
  delivery_notes: string | null;
  business_type: string | null;
  opening_balance: number;
  tax_exempt: boolean;
  tax_id: string | null;
  sales_rep_name: string | null;
  customer_source: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type SortKey = "recent" | "az" | "balance_desc" | "available_desc" | "available_asc";

function timeAgo(iso: string | null): string {
  if (!iso) return "Never";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  const days = Math.floor(diff / 86400);
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.floor(days / 30)} mo ago`;
  return `${Math.floor(days / 365)} yr ago`;
}

export function CustomersTable() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [tier, setTier] = useState<"all" | "standard" | "volume" | "key_account">("all");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [sort, setSort] = useState<SortKey>("recent");
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deactivateBlockedId, setDeactivateBlockedId] = useState<string | null>(null);

  const customersQuery = useQuery({
    queryKey: qk.customers(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as CustomerRow[];
    },
    staleTime: 15_000,
    refetchInterval: 60_000,
  });

  const lastOrdersQuery = useQuery({
    queryKey: ["customers-last-orders"] as const,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("customer_id, placed_at")
        .order("placed_at", { ascending: false });
      if (error) throw error;
      const lo: Record<string, string | null> = {};
      (data ?? []).forEach((r) => {
        if (r.customer_id && !(r.customer_id in lo)) lo[r.customer_id] = r.placed_at;
      });
      return lo;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const rows = customersQuery.data ?? [];
  const lastOrders = lastOrdersQuery.data ?? {};
  const isLoading = customersQuery.isLoading;

  const toggleActiveMutation = useMutation({
    mutationFn: async (row: CustomerRow) => {
      if (row.is_active) {
        const { data } = await supabase
          .from("orders")
          .select("id")
          .eq("customer_id", row.id)
          .not("status", "in", "(delivered,cancelled,paid)")
          .limit(1);
        if ((data ?? []).length > 0) {
          throw new Error("__BLOCKED__");
        }
      }
      const { error } = await supabase
        .from("customers")
        .update({ is_active: !row.is_active })
        .eq("id", row.id);
      if (error) throw error;
      return row;
    },
    onMutate: async (row) => {
      await queryClient.cancelQueries({ queryKey: qk.customers() });
      const prev = queryClient.getQueryData<CustomerRow[]>(qk.customers());
      queryClient.setQueryData<CustomerRow[]>(qk.customers(), (old) =>
        (old ?? []).map((r) => (r.id === row.id ? { ...r, is_active: !r.is_active } : r))
      );
      return { prev };
    },
    onSuccess: (row) => {
      toast.success(row.is_active ? "Customer deactivated" : "Customer reactivated");
      queryClient.invalidateQueries({ queryKey: qk.customers() });
      queryClient.invalidateQueries({ queryKey: qk.customerById(row.id) });
    },
    onError: (err: Error, row, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(qk.customers(), ctx.prev);
      if (err.message === "__BLOCKED__") setDeactivateBlockedId(row.id);
      else toast.error(err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (row: CustomerRow) => {
      const { data: ord } = await supabase.from("orders").select("id").eq("customer_id", row.id).limit(1);
      if ((ord ?? []).length > 0) {
        throw new Error("Cannot delete a customer with order history. Deactivate instead.");
      }
      const { error } = await supabase
        .from("customers")
        .update({ deleted_at: new Date().toISOString(), is_active: false })
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Customer archived");
      setDeleteId(null);
      queryClient.invalidateQueries({ queryKey: qk.customers() });
    },
    onError: (err: Error) => {
      toast.error(err.message);
      setDeleteId(null);
    },
  });

  const filtered = useMemo(() => {
    let out = rows;
    const q = search.trim().toLowerCase();
    if (q) {
      out = out.filter((r) =>
        r.company_name.toLowerCase().includes(q) ||
        (r.trading_name ?? "").toLowerCase().includes(q) ||
        (r.phone ?? "").toLowerCase().includes(q) ||
        (r.customer_number ?? "").toLowerCase().includes(q),
      );
    }
    if (tier !== "all") out = out.filter((r) => r.pricing_tier === tier);
    if (status !== "all") out = out.filter((r) => (status === "active" ? r.is_active : !r.is_active));
    const sorted = [...out];
    sorted.sort((a, b) => {
      switch (sort) {
        case "az": return a.company_name.localeCompare(b.company_name);
        case "balance_desc": return Number(b.current_balance) - Number(a.current_balance);
        case "available_desc":
          return (Number(b.credit_limit) - Number(b.current_balance)) - (Number(a.credit_limit) - Number(a.current_balance));
        case "available_asc":
          return (Number(a.credit_limit) - Number(a.current_balance)) - (Number(b.credit_limit) - Number(b.current_balance));
        default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
    return sorted;
  }, [rows, search, tier, status, sort]);

  const counts = useMemo(() => {
    const a = rows.filter((r) => r.is_active).length;
    return { active: a, inactive: rows.length - a, total: rows.length };
  }, [rows]);

  const anyFilter = !!search || tier !== "all" || status !== "all" || sort !== "recent";

  const clearFilters = () => {
    setSearch(""); setTier("all"); setStatus("all"); setSort("recent");
  };

  const handleToggleActive = (row: CustomerRow) => toggleActiveMutation.mutate(row);
  const handleDelete = (row: CustomerRow) => deleteMutation.mutate(row);
  const reload = () => {
    queryClient.invalidateQueries({ queryKey: qk.customers() });
    queryClient.invalidateQueries({ queryKey: ["customers-last-orders"] });
  };

  return (
    <>
      {/* Top bar */}
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <div className="text-[10.5px] uppercase text-muted-foreground" style={{ letterSpacing: "0.12em" }}>
            OPERATIONS · CUSTOMERS
          </div>
          <h1 className="mt-1 text-[24px] font-extrabold text-ink" style={{ letterSpacing: "-0.02em" }}>
            Customers
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {counts.active} active · {counts.inactive} inactive · {counts.total} total
          </p>
        </div>
        <button
          onClick={() => navigate({ to: "/office/customers/new" })}
          className="rounded-lg px-3.5 py-[9px] text-[13px] font-semibold text-white"
          style={{ backgroundColor: "#0B1A2E" }}
        >
          + New customer
        </button>
      </div>

      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div className="relative max-w-[360px] flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by company, contact, or phone..."
            className="h-9 w-full rounded-lg border border-[#E5E9EF] bg-white pl-9 pr-3 text-[13px] outline-none placeholder:text-[#94A3B8] focus:border-[#0F2540]"
          />
        </div>
        <FilterDropdown value={tier} onChange={(v) => setTier(v as any)} options={[
          { value: "all", label: "All tiers" },
          { value: "standard", label: "Standard" },
          { value: "volume", label: "Volume" },
          { value: "key_account", label: "Key Account" },
        ]} />
        <FilterDropdown value={status} onChange={(v) => setStatus(v as any)} options={[
          { value: "all", label: "All" },
          { value: "active", label: "Active only" },
          { value: "inactive", label: "Inactive only" },
        ]} />
        <FilterDropdown value={sort} onChange={(v) => setSort(v as SortKey)} options={[
          { value: "recent", label: "Recently added" },
          { value: "az", label: "Company A→Z" },
          { value: "balance_desc", label: "Highest balance" },
          { value: "available_desc", label: "Highest available credit" },
          { value: "available_asc", label: "Lowest available credit" },
        ]} prefix="Sort: " />
        {anyFilter && (
          <button onClick={clearFilters} className="ml-auto text-[12.5px] font-semibold text-[#0F2540] hover:underline">
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-[#E5E9EF] bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 bg-[#FAFBFC]">
              <tr>
                {["Company", "Contact", "Tier", "Credit limit", "Balance owed", "Available", "Last order", "Status", ""].map((h, i) => (
                  <th
                    key={i}
                    className={`px-3 py-3 text-[10.5px] font-semibold uppercase text-[#64748B] ${i >= 3 && i <= 5 ? "text-right" : "text-left"}`}
                    style={{ letterSpacing: "0.06em" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && rows.length === 0 ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={`sk-${i}`} className="border-t border-[#E5E9EF]">
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} className="px-3 py-3">
                        <div className="h-3 w-full animate-pulse rounded bg-[#F1F4F8]" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <Building2 className="mx-auto h-10 w-10 text-[#CBD5E1]" strokeWidth={1.25} />
                    <div className="mt-3 text-[14px] font-semibold text-ink">No customers match your filters</div>
                    {anyFilter && (
                      <button onClick={clearFilters} className="mt-2 text-[12.5px] font-semibold text-[#FF6A1A] hover:underline">
                        Clear filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : filtered.map((r) => {
                const balance = Number(r.current_balance);
                const available = Number(r.credit_limit) - balance;
                const limitPct = Number(r.credit_limit) > 0 ? available / Number(r.credit_limit) : 1;
                const availClass = available < 0 ? "text-[#B91C1C]" : limitPct < 0.2 ? "text-[#B45309]" : "text-ink";
                return (
                  <tr
                    key={r.id}
                    onClick={() => setDrawerId(r.id)}
                    className="cursor-pointer border-t border-[#E5E9EF] transition hover:bg-[#FAFBFC]"
                  >
                    <td className="px-3 py-3">
                      <div className="font-bold text-ink">{r.company_name}</div>
                      <div className="mt-0.5 font-mono text-[11px] text-[#64748B]">{r.customer_number}</div>
                    </td>
                    <td className="px-3 py-3 text-[12px] text-[#64748B]">
                      {r.phone ? <div className="">{r.phone}</div> : <span className="text-[#94A3B8]">—</span>}
                    </td>
                    <td className="px-3 py-3"><TierChip tier={r.pricing_tier} /></td>
                    <td className="px-3 py-3 text-right text-ink">{formatBBD(Number(r.credit_limit))}</td>
                    <td className={`px-3 py-3 text-right ${balance > 0 ? "font-semibold text-[#B91C1C]" : "text-ink"}`}>
                      {formatBBD(balance)}
                    </td>
                    <td className={`px-3 py-3 text-right font-semibold ${availClass}`}>{formatBBD(available)}</td>
                    <td className="px-3 py-3 text-[12px] text-[#64748B]">{timeAgo(lastOrders[r.id] ?? null)}</td>
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center gap-1.5 text-[12px]">
                        <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: r.is_active ? "#10B981" : "#94A3B8" }} />
                        <span className={r.is_active ? "text-ink" : "text-[#64748B]"}>{r.is_active ? "Active" : "Inactive"}</span>
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <RowMenu
                        open={openMenuId === r.id}
                        onToggle={() => setOpenMenuId(openMenuId === r.id ? null : r.id)}
                        onView={() => { setDrawerId(r.id); setOpenMenuId(null); }}
                        onEdit={() => { navigate({ to: "/office/customers/$id/edit", params: { id: r.id } }); setOpenMenuId(null); }}
                        onPlaceOrder={() => { toast.info("Place order on behalf coming next"); setOpenMenuId(null); }}
                        onToggleActive={() => { handleToggleActive(r); setOpenMenuId(null); }}
                        onDelete={() => { setDeleteId(r.id); setOpenMenuId(null); }}
                        isActive={r.is_active}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {drawerId && (
        <CustomerDetailDrawer
          customerId={drawerId}
          onClose={() => setDrawerId(null)}
          onChanged={reload}
        />
      )}

      {deleteId && (
        <ConfirmModal
          title="Archive this customer?"
          body="This will hide the customer from the list and mark them as inactive. Customers with order history cannot be deleted."
          confirmLabel="Yes, archive"
          danger
          onConfirm={() => {
            const row = rows.find((r) => r.id === deleteId);
            if (row) handleDelete(row);
          }}
          onCancel={() => setDeleteId(null)}
        />
      )}

      {deactivateBlockedId && (
        <ConfirmModal
          title="Cannot deactivate"
          body="This customer has open orders in progress. Wait until they're delivered/cancelled or cancel them first."
          confirmLabel="OK"
          onConfirm={() => setDeactivateBlockedId(null)}
          onCancel={() => setDeactivateBlockedId(null)}
          hideCancel
        />
      )}
    </>
  );
}

function FilterDropdown({
  value, onChange, options, prefix = "",
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  prefix?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const selected = options.find((o) => o.value === value);
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 items-center gap-1.5 rounded-lg border border-[#E5E9EF] bg-white px-3 text-[12.5px] font-semibold text-ink hover:bg-[#FAFBFC]"
      >
        {prefix}{selected?.label}
        <ChevronDown className="h-3 w-3 text-[#64748B]" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 min-w-[180px] rounded-lg border border-[#E5E9EF] bg-white py-1 shadow-lg">
          {options.map((o) => (
            <button
              key={o.value}
              onClick={() => { onChange(o.value); setOpen(false); }}
              className={`block w-full px-3 py-1.5 text-left text-[12.5px] hover:bg-[#FAFBFC] ${o.value === value ? "font-bold text-[#0F2540]" : "text-ink"}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function RowMenu({
  open, onToggle, onView, onEdit, onPlaceOrder, onToggleActive, onDelete, isActive,
}: {
  open: boolean; onToggle: () => void;
  onView: () => void; onEdit: () => void; onPlaceOrder: () => void;
  onToggleActive: () => void; onDelete: () => void; isActive: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) onToggle(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open, onToggle]);
  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={onToggle}
        className="rounded-md p-1.5 text-[#64748B] hover:bg-[#F1F4F8] hover:text-ink"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-[200px] rounded-lg border border-[#E5E9EF] bg-white py-1 text-left shadow-lg">
          <MenuItem onClick={onView}>View details</MenuItem>
          <MenuItem onClick={onEdit}>Edit</MenuItem>
          <MenuItem onClick={onPlaceOrder}>Place order on behalf</MenuItem>
          <MenuItem onClick={onToggleActive}>{isActive ? "Deactivate" : "Reactivate"}</MenuItem>
          <div className="my-1 border-t border-[#E5E9EF]" />
          <MenuItem onClick={onDelete} danger>Archive</MenuItem>
        </div>
      )}
    </div>
  );
}

function MenuItem({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`block w-full px-3 py-1.5 text-left text-[12.5px] hover:bg-[#FAFBFC] ${danger ? "text-[#B91C1C]" : "text-ink"}`}
    >
      {children}
    </button>
  );
}

function ConfirmModal({
  title, body, confirmLabel, onConfirm, onCancel, danger, hideCancel,
}: {
  title: string; body: string; confirmLabel: string;
  onConfirm: () => void; onCancel: () => void; danger?: boolean; hideCancel?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <h4 className="text-[15px] font-bold text-ink">{title}</h4>
          <button onClick={onCancel} className="text-[#64748B] hover:text-ink"><X className="h-4 w-4" /></button>
        </div>
        <p className="mt-2 text-[13px] text-muted-foreground">{body}</p>
        <div className="mt-5 flex justify-end gap-2">
          {!hideCancel && (
            <button onClick={onCancel} className="rounded-md border border-border bg-card px-3 py-2 text-[13px] font-semibold text-ink hover:bg-secondary">Cancel</button>
          )}
          <button
            onClick={onConfirm}
            className={`rounded-md px-3 py-2 text-[13px] font-semibold text-white ${danger ? "bg-[#B91C1C] hover:bg-[#991B1B]" : "bg-[#0B1A2E] hover:bg-[#0F2540]"}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
