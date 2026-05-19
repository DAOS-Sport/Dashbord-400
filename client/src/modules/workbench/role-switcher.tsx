import { useLocation } from "wouter";
import type { WorkbenchRole } from "@shared/auth/me";
import { roleHomePath } from "@shared/auth/me";
import { cn } from "@/lib/utils";
import { useAuthMe } from "@/shared/auth/session";

const roleOrder: readonly WorkbenchRole[] = ["employee", "lifeguard", "supervisor", "system"];

export function RoleSwitcher({ compact = false, visualActiveRole }: { compact?: boolean; visualActiveRole?: WorkbenchRole }) {
  const [, setLocation] = useLocation();
  const { data: session } = useAuthMe();

  if (!session || session.grantedRoles.length <= 1) return null;
  const activeRole = visualActiveRole ?? session.activeRole;

  const goRole = (role: WorkbenchRole) => {
    setLocation(roleHomePath[role]);
  };

  return (
    <div className={cn("flex min-w-0 items-center gap-2", compact ? "max-w-full" : "flex-wrap justify-end")}>
      <div className={cn("flex min-w-0 rounded-[8px] border border-[#dfe7ef] bg-white p-1 shadow-sm", compact && "w-full")}>
        {roleOrder
          .filter((role) => session.grantedRoles.includes(role))
          .map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => goRole(role)}
              className={cn(
                "min-h-8 min-w-0 rounded-[6px] px-3 text-[12px] font-black transition",
                compact && "flex-1 px-2 text-[11px]",
                activeRole === role ? "bg-[#0d2a50] text-white" : "text-[#536175] hover:bg-[#f2f6fa]",
              )}
            >
              /{role.toUpperCase()}
            </button>
          ))}
      </div>
    </div>
  );
}
