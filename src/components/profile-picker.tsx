import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { Wordmark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { ProfileWizard } from "@/components/profile-wizard";
import { isHouseOwner } from "@/lib/household-profile";
import { useReelStore } from "@/lib/store";
import type { HouseholdUser } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ProfilePicker() {
  const users = useReelStore((s) => s.users);
  const hydrateProfiles = useReelStore((s) => s.hydrateProfiles);
  const setActiveProfile = useReelStore((s) => s.setActiveProfile);
  const [adding, setAdding] = useState(false);
  const [picked, setPicked] = useState<HouseholdUser | null>(null);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void hydrateProfiles();
  }, [hydrateProfiles]);

  if (adding) {
    return (
      <ProfileWizard
        onBack={() => setAdding(false)}
        onDone={() => {
          setAdding(false);
        }}
      />
    );
  }

  const signIn = async (profile: HouseholdUser, password: string) => {
    setErr("");
    setBusy(true);
    try {
      const r = await fetch("/api/profiles/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: profile.id,
          jellyfinUser: profile.jellyfinUser || profile.name,
          jellyfinPassword: password,
        }),
      });
      const j = (await r.json()) as { ok?: boolean; error?: string; session?: HouseholdUser; taste?: { likes: string[]; dislikes: string[] } };
      if (!j.ok || !j.session) {
        setErr(j.error || "Jellyfin username or PIN does not match");
        setBusy(false);
        return;
      }
      setActiveProfile(j.session, j.taste);
    } catch (e) {
      setErr(String(e));
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-dvh overflow-hidden bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-[-8rem] size-[28rem] rounded-full bg-gold/10 blur-[90px]"
      />
      <header className="flex items-center justify-between px-6 py-5 md:px-10">
        <Wordmark markClassName="size-7" />
      </header>
      <div className="mx-auto w-full max-w-3xl px-6 pb-16 pt-4 md:px-8">
        <div className="mb-8 rise">
          <p className="mb-2 font-display text-xs tracking-[0.22em] text-gold uppercase">This house</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">Who is watching?</h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted">
            ReelOS signs in as your Jellyfin user, not the owner&apos;s. Likes stay on this profile. Trakt is optional.
          </p>
        </div>
        <div className="grid gap-3">
          {users.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => {
                setPicked(u);
                setPin("");
                setErr("");
              }}
              className={cn(
                "relative w-full rounded-2xl p-5 text-left shadow-[var(--shadow-border)]",
                picked?.id === u.id ? "bg-gold/8 shadow-[var(--shadow-gold)]" : "bg-card",
              )}
            >
              <p className="font-display text-lg font-medium">{u.name}</p>
              <p className="mt-1 text-sm text-muted">
                {isHouseOwner(u.role) ? "Owner" : "Member"}
                {u.jellyfinUser ? ` · ${u.jellyfinUser}` : ""}
              </p>
            </button>
          ))}
        </div>
        {picked ? (
          <form
            className="mt-5"
            onSubmit={(e) => {
              e.preventDefault();
              void signIn(picked, pin);
            }}
          >
            <label className="block">
              <span className="text-sm text-muted">Jellyfin password or PIN</span>
              <input
                type="password"
                autoComplete="current-password"
                className="mt-2 h-12 w-full rounded-xl bg-card px-4 shadow-[var(--shadow-border)]"
                placeholder="Your Jellyfin PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
              />
            </label>
            <Button className="mt-3" type="submit" disabled={pin.length < 4 || busy}>
              {busy ? <LoaderCircle className="size-4 animate-spin" /> : null}
              Continue as {picked.name}
            </Button>
          </form>
        ) : null}
        {err ? <p className="mt-3 text-sm text-danger">{err}</p> : null}
        <Button className="mt-8" variant="ghost" onClick={() => setAdding(true)}>
          Add a profile
        </Button>
        <p className="mt-2 text-sm text-faint">Two questions. Age, then their Jellyfin login. Not the 7-step house wizard.</p>
      </div>
    </div>
  );
}
