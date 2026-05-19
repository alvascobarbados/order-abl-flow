import type { OrderStatus } from "@/components/abl/OrderStatusBadge";

export type OrderRow = {
  id: string;
  order_number: string | null;
  invoice_number: string | null;
  customer_id: string;
  status: OrderStatus;
  subtotal: number;
  vat_amount: number;
  total: number;
  placed_at: string;
  placed_on_behalf?: boolean;
  approved_at: string | null;
  picking_started_at: string | null;
  packed_at: string | null;
  dispatched_at: string | null;
  delivered_at: string | null;
  invoiced_at: string | null;
  paid_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  rejection_reason: string | null;
  internal_notes: string | null;
  delivery_notes: string | null;
  due_date: string | null;
  driver_name: string | null;
  vehicle_id: string | null;
  eta: string | null;
  delivered_to_name: string | null;
  assigned_picker_name: string | null;
  previous_status: OrderStatus | null;
  approved_by_profile_id: string | null;
  sales_rep_name?: string | null;
};

export type CustomerLite = {
  id: string;
  company_name: string;
  phone: string | null;
  delivery_address: string | null;
  sales_rep_name: string | null;
  payment_terms_days: number;
  credit_limit: number;
};

export const ORDER_SELECT = `
  id, order_number, invoice_number, customer_id, status,
  subtotal, vat_amount, total, placed_at, placed_on_behalf,
  approved_at, picking_started_at, packed_at, dispatched_at,
  delivered_at, invoiced_at, paid_at, cancelled_at,
  cancellation_reason, rejection_reason, internal_notes, delivery_notes,
  due_date, driver_name, vehicle_id, eta, delivered_to_name,
  assigned_picker_name, previous_status, approved_by_profile_id
`;
