import { Navigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useHouseholdProfile } from "@/lib/profiles";

/** Kids profile cannot open Request or Settings. Adult/admin still can. */
export function KidsLock({ children }: { children: ReactNode }) {
  const { kids, profile } = useHouseholdProfile();
  if (profile && kids) return <Navigate to="/" />;
  return children;
}
