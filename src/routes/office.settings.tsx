import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@/components/abl/office/settings/SettingsPage";

export const Route = createFileRoute("/office/settings")({
  validateSearch: (s: Record<string, unknown>) => ({
    tab: typeof s.tab === "string" ? s.tab : undefined,
  }),
  component: SettingsPage,
});
