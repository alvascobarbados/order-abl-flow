import { Link } from "@tanstack/react-router";
import { Repeat } from "lucide-react";
import { useRole } from "@/hooks/use-role";

export function SwitchRoleButton({ className = "" }: { className?: string }) {
  const { setRole } = useRole();
  return (
    <Link
      to="/"
      onClick={() => setRole(null)}
      className={`inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-ink shadow-sm hover:bg-secondary ${className}`}
    >
      <Repeat className="h-3.5 w-3.5" /> Switch role
    </Link>
  );
}
