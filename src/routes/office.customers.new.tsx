import { createFileRoute } from "@tanstack/react-router";
import { CustomerForm } from "@/components/abl/office/customers/CustomerForm";

export const Route = createFileRoute("/office/customers/new")({
  component: () => <CustomerForm mode="create" />,
});
