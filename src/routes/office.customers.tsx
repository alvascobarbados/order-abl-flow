import { createFileRoute } from "@tanstack/react-router";
import { CustomersTable } from "@/components/abl/office/customers/CustomersTable";

export const Route = createFileRoute("/office/customers")({
  component: CustomersTable,
});
