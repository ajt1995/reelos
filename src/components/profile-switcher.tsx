import { cn } from "@/lib/utils";
import { useHouseholdProfile, type HouseProfile } from "@/lib/profiles";

export function ProfileSwitcher({ compact = false }: { compact?: boolean }) {
  const { picker, profiles, profile, select } = useHouseholdProfile();
  if (!picker || profiles.length < 2) return null;
  return (
    <div className={cn("flex items-center gap-1", compact && "overflow-x-auto")}>
      {profiles.map((p: HouseProfile) => {
        const on = p.id === profile?.id;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => void select(p.id)}
            className={cn(
              "h-8 shrink-0 rounded-full px-3 text-xs",
              on ? "bg-gold text-gold-fg" : "bg-card-2 text-muted",
            )}
          >
            {p.name}
            {p.kind === "kids" ? " · kids" : ""}
          </button>
        );
      })}
    </div>
  );
}
