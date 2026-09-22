import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Clapperboard,
  Coffee,
  Compass,
  Flame,
  Heart,
  LoaderCircle,
  Popcorn,
  Shield,
  Smile,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useReelStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const VIBES = [
  {
    id: "cinema",
    label: "Cinema Night",
    desc: "Blockbusters, high-octane action & sci-fi spectacles",
    icon: Popcorn,
    vibeChoice: "bleeding_edge",
  },
  {
    id: "cozy",
    label: "Cozy Binge",
    desc: "Comedies, sitcoms, procedural mysteries & feel-good TV",
    icon: Coffee,
    vibeChoice: "comfort",
  },
  {
    id: "mindbender",
    label: "Mind-Benders",
    desc: "Psychological thrillers, twists, cult classics & cerebral fiction",
    icon: Sparkles,
    vibeChoice: "hidden_gems",
  },
  {
    id: "family",
    label: "Family & Animation",
    desc: "Pixar, Studio Ghibli, adventure & animated gems",
    icon: Smile,
    vibeChoice: "comfort",
  },
];

export function GuestJoinView() {
  const navigate = useNavigate();
  const [nickname, setNickname] = useState("");
  const [selectedVibe, setSelectedVibe] = useState("cinema");
  const [ratingFloor, setRatingFloor] = useState<"chill" | "all">("all");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNick = nickname.trim() || "Guest";
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/guest/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: cleanNick,
          vibe: selectedVibe,
          ratingFloor,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to join session");
      }

      // Update client store state
      const resident = data.resident;
      if (resident) {
        useReelStore.getState().patchResident("res-guest", {
          name: resident.name,
          tasteVibe: resident.tasteVibe,
          expiresAt: resident.expiresAt,
        });
        useReelStore.getState().setActiveResident("res-guest");
      }

      // Ensure app is in running phase for guest
      useReelStore.getState().openReelOS();

      // Navigate to Discover
      await navigate({ to: "/discover" });
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-dvh bg-[#090B0E] text-slate-100 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden font-sans">
      {/* Background glow effects */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -left-40 size-96 rounded-full bg-amber-500/10 blur-[120px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -right-40 size-96 rounded-full bg-sky-500/10 blur-[120px]"
      />

      <div className="w-full max-w-md relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex size-14 items-center justify-center rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 mb-4 shadow-lg shadow-amber-500/10">
            <Popcorn className="size-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Guest Fast-Join
          </h1>
          <p className="mt-1.5 text-xs text-slate-400">
            Join the living room session in 3 seconds. Your pass automatically expires in 12 hours.
          </p>
        </div>

        {/* Join Card */}
        <form
          onSubmit={handleJoin}
          className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 sm:p-8 space-y-6 shadow-2xl"
        >
          {error ? (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
              {error}
            </div>
          ) : null}

          {/* Question 1: Nickname */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              1. Your Nickname
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="e.g. Sarah, Alex, Movie Squad"
              maxLength={24}
              className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 transition-colors"
            />
          </div>

          {/* Question 2: Tonight's Vibe */}
          <div className="space-y-2.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              2. What&apos;s Tonight&apos;s Vibe?
            </label>
            <div className="grid grid-cols-1 gap-2.5">
              {VIBES.map((v) => {
                const Icon = v.icon;
                const isSelected = selectedVibe === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setSelectedVibe(v.id)}
                    className={cn(
                      "flex items-center gap-3.5 rounded-2xl border p-3.5 text-left transition-all cursor-pointer",
                      isSelected
                        ? "border-amber-500/60 bg-amber-500/15 shadow-md shadow-amber-500/10"
                        : "border-white/10 bg-white/[0.02] hover:bg-white/5 hover:border-white/20"
                    )}
                  >
                    <div
                      className={cn(
                        "flex size-10 items-center justify-center rounded-xl shrink-0 transition-colors",
                        isSelected
                          ? "bg-amber-400 text-slate-950 font-bold"
                          : "bg-white/5 text-slate-400"
                      )}
                    >
                      <Icon className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={cn("text-xs font-semibold", isSelected ? "text-amber-300" : "text-white")}>
                        {v.label}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">{v.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Question 3: Rating Floor */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              3. Content Filter
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRatingFloor("chill")}
                className={cn(
                  "rounded-xl border p-3 text-center transition-all cursor-pointer",
                  ratingFloor === "chill"
                    ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300 font-semibold"
                    : "border-white/10 bg-white/[0.02] text-slate-400 hover:bg-white/5"
                )}
              >
                <div className="text-xs font-medium">🌿 Keep it Chill</div>
                <div className="text-[10px] text-slate-500 mt-0.5">PG-13 / Family friendly</div>
              </button>
              <button
                type="button"
                onClick={() => setRatingFloor("all")}
                className={cn(
                  "rounded-xl border p-3 text-center transition-all cursor-pointer",
                  ratingFloor === "all"
                    ? "border-amber-500/50 bg-amber-500/15 text-amber-300 font-semibold"
                    : "border-white/10 bg-white/[0.02] text-slate-400 hover:bg-white/5"
                )}
              >
                <div className="text-xs font-medium">🔥 Anything Goes</div>
                <div className="text-[10px] text-slate-500 mt-0.5">R-rated / Full library</div>
              </button>
            </div>
          </div>

          {/* Submit Action */}
          <Button
            type="submit"
            disabled={submitting}
            variant="gold"
            className="w-full h-12 rounded-xl text-sm font-bold shadow-lg shadow-amber-500/20"
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <LoaderCircle className="size-4 animate-spin" />
                Preparing Vibe Feed...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Sparkles className="size-4" />
                Join Living Room Feed
              </span>
            )}
          </Button>

          <p className="text-[11px] text-center text-slate-500">
            🔒 No account or password required. Session prunes automatically after 12 hours.
          </p>
        </form>
      </div>
    </div>
  );
}
