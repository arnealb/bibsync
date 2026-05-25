import type { AuthState } from "@/app/_actions/auth-types";
import { cn } from "@/lib/utils";

/** Inline status message under a form (error or success). */
export function FormMessage({ state }: { state: AuthState }) {
  if (state.status === "idle") return null;

  const isError = state.status === "error";
  return (
    <p
      role={isError ? "alert" : "status"}
      className={cn(
        "rounded-md border px-3 py-2 text-sm",
        isError
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
      )}
    >
      {state.message}
    </p>
  );
}
