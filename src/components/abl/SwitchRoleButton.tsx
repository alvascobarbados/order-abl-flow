import { useNavigate } from "@tanstack/react-router";
import { Repeat } from "lucide-react";
import { useRole } from "@/hooks/use-role";

export function SwitchRoleButton({ className = "" }: { className?: string }) {
  const { signOut } = useRole();
  const navigate = useNavigate();
  const handle = async () => {
    await signOut();
    navigate({ to: "/" });
  };
  return (
    <button
      type="button"
      onClick={handle}
      className={`inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-ink shadow-sm hover:bg-secondary ${className}`}
    >
      <Repeat className="h-3.5 w-3.5" /> Switch role
    </button>
  );
}
