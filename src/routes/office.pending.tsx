import { createFileRoute } from "@tanstack/react-router";
import { OfficeComingSoon } from "@/components/abl/office/OfficeComingSoon";

export const Route = createFileRoute("/office/pending")({
  component: () => <OfficeComingSoon title="Pending Approval" blurb="Dedicated full-page queue for reviewing every order awaiting approval, with bulk actions and filters." />,
});
