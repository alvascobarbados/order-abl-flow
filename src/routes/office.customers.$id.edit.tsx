import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CustomerForm, type FormValues } from "@/components/abl/office/customers/CustomerForm";

export const Route = createFileRoute("/office/customers/$id/edit")({
  component: EditCustomerPage,
});

function EditCustomerPage() {
  const { id } = useParams({ from: "/office/customers/$id/edit" });
  const [loaded, setLoaded] = useState<
    | (Partial<FormValues> & { id: string; customer_number: string | null; company_name: string; existing_contact_email: string | null })
    | null
  >(null);

  useEffect(() => {
    (async () => {
      const { data: c } = await supabase.from("customers").select("*").eq("id", id).maybeSingle();
      if (!c) return;
      let contactEmail: string | null = null;
      let contactName = "";
      let contactPhone = "+1 (246) ";
      if ((c as any).contact_profile_id) {
        const { data: p } = await supabase
          .from("profiles").select("email, full_name, phone").eq("id", (c as any).contact_profile_id).maybeSingle();
        contactEmail = (p as any)?.email ?? null;
        contactName = (p as any)?.full_name ?? "";
        contactPhone = (p as any)?.phone ?? (c as any).phone ?? "+1 (246) ";
      }
      setLoaded({
        id: c.id,
        customer_number: (c as any).customer_number,
        company_name: c.company_name,
        existing_contact_email: contactEmail,
        trading_name: (c as any).trading_name ?? "",
        business_type: (c as any).business_type ?? "",
        pricing_tier: (c as any).pricing_tier,
        is_active: (c as any).is_active,
        contact_full_name: contactName,
        contact_email: contactEmail ?? "",
        contact_phone: contactPhone || (c as any).phone || "+1 (246) ",
        contact_job_title: "",
        create_login: false,
        login_password: "",
        billing_address: (c as any).billing_address ?? "",
        billing_address_2: "",
        billing_city: (c as any).billing_city ?? "",
        billing_parish: (c as any).billing_parish ?? "",
        billing_postal: (c as any).billing_postal ?? "",
        delivery_same: (c as any).delivery_address_same_as_billing ?? true,
        delivery_address: (c as any).delivery_address ?? "",
        delivery_address_2: "",
        delivery_city: (c as any).delivery_city ?? "",
        delivery_parish: (c as any).delivery_parish ?? "",
        delivery_postal: (c as any).delivery_postal ?? "",
        delivery_notes: (c as any).delivery_notes ?? "",
        credit_limit: Number((c as any).credit_limit),
        payment_terms_days: (c as any).payment_terms_days,
        opening_balance: Number((c as any).opening_balance ?? 0),
        tax_exempt: (c as any).tax_exempt ?? false,
        tax_id: (c as any).tax_id ?? "",
        sales_rep_name: (c as any).sales_rep_name ?? "Unassigned",
        customer_source: (c as any).customer_source ?? "",
        notes: (c as any).notes ?? "",
      });
    })();
  }, [id]);

  if (!loaded) return <div className="p-8 text-[13px] text-muted-foreground">Loading customer…</div>;
  return <CustomerForm mode="edit" initial={loaded} />;
}
