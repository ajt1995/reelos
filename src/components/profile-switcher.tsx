import { useState } from "react";
import {
  Check,
  ChevronDown,
  Clapperboard,
  Copy,
  Film,
  Flame,
  KeyRound,
  Lock,
  Plus,
  QrCode,
  Shield,
  Sparkles,
  Tv,
  User,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { QrCodeSvg } from "@/components/ui/qr-code-svg";
import { showToast } from "@/lib/toast";
import { useReelStore, type HouseholdResident } from "@/lib/store";
import { cn } from "@/lib/utils";
import { LuxuryPinInput } from "@/components/luxury-pin-input";

const AVATAR_MAP: Record<string, typeof Clapperboard> = {
  clapperboard: Clapperboard,
  film: Film,
  tv: Tv,
  sparkles: Sparkles,
  shield: Shield,
  popcorn: Flame,
  flame: Flame,
  default: User,
};

export function ResidentAvatar({
  avatar,
  className,
}: {
  avatar?: string;
  className?: string;
}) {
  const Icon = AVATAR_MAP[avatar || "default"] ?? AVATAR_MAP.default;
  return (
    <span
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold border border-gold/30",
        className,
      )}
    >
      <Icon className="size-4" />
    </span>
  );
}

export function ProfileSwitcher({
  compact = false,
}: {
  compact?: boolean;
}) {
  const residents = useReelStore((s) => s.residents);
  const activeId = useReelStore((s) => s.activeResidentId);
  const setActiveResident = useReelStore((s) => s.setActiveResident);
  const addResident = useReelStore((s) => s.addResident);
  const houseName = useReelStore((s) => s.houseName);

  const [open, setOpen] = useState(false);
  const [pinTarget, setPinTarget] = useState<HouseholdResident | null>(null);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);
  const [showInviteQr, setShowInviteQr] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAvatar, setNewAvatar] = useState("clapperboard");
  const [newIsKids, setNewIsKids] = useState(false);
  const [copied, setCopied] = useState(false);

  const active =
    residents.find((r) => r.id === activeId) ??
    residents[0] ?? { id: "guest", name: "Guest", avatar: "popcorn" };

  const handleSelect = (r: HouseholdResident) => {
    if (r.id === activeId) {
      setOpen(false);
      return;
    }
    if (r.pin) {
      setPinTarget(r);
      setPinInput("");
      setPinError(false);
      return;
    }
    if (active.isKids && !r.isKids) {
      const parentWithPin = residents.find((p) => !p.isKids && p.pin);
      if (parentWithPin?.pin) {
        setPinTarget({ ...r, pin: parentWithPin.pin });
        setPinInput("");
        setPinError(false);
        return;
      }
    }
    setActiveResident(r.id);
    setOpen(false);
    if (r.isKids) {
      showToast(`👶 Switched to ${r.name} (Kids Sandbox)`, "info");
    } else {
      showToast(`Switched to ${r.name}`, "success");
    }
  };

  const handlePinSubmit = () => {
    if (!pinTarget) return;
    if (pinInput === pinTarget.pin) {
      setActiveResident(pinTarget.id);
      if (pinTarget.isKids) {
        showToast(`👶 Switched to ${pinTarget.name} (Kids Sandbox)`, "info");
      } else {
        showToast(`Unlocked and switched to ${pinTarget.name}`, "success");
      }
      setPinTarget(null);
      setOpen(false);
      setPinInput("");
      setPinError(false);
    } else {
      setPinError(true);
      setPinInput("");
    }
  };

  const handleCreate = () => {
    if (!newName.trim()) return;
    addResident(newName.trim(), newAvatar, undefined, newIsKids);
    showToast(`Added profile for ${newName.trim()}${newIsKids ? " (Kids Sandbox)" : ""}`, "success");
    setNewName("");
    setNewIsKids(false);
    setAdding(false);
  };

  const hostname =
    typeof window !== "undefined" ? window.location.hostname : "reelos.local";
  const port =
    typeof window !== "undefined" && window.location.port
      ? `:${window.location.port}`
      : ":8080";
  const inviteUrl = `http://${hostname}${port}`;

  const copyInvite = () => {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="relative">
      {/* Switcher Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-2 rounded-full border border-border bg-card/70 text-xs font-medium text-foreground transition-all hover:bg-card hover:border-border-strong active:scale-95 cursor-pointer",
          compact
            ? "p-1.5 sm:px-2.5 sm:py-1.5 min-h-[38px] min-w-[38px] sm:min-h-[36px]"
            : "px-3 py-1.5 min-h-[44px]",
        )}
        title={`Active Profile: ${active.name}`}
      >
        <ResidentAvatar avatar={active.avatar} className="size-6 text-xs shrink-0" />
        <span className={cn("max-w-[100px] truncate font-display font-medium", compact && "hidden sm:inline")}>
          {active.name}
        </span>
        {active.isGuest ? (
          <span className={cn("rounded-full bg-gold/15 px-1.5 py-0.2 text-[9px] font-semibold text-gold", compact && "hidden sm:inline")}>
            Guest
          </span>
        ) : null}
        <ChevronDown className={cn("size-3.5 text-muted shrink-0", compact && "hidden sm:inline")} />
      </button>

      {/* Dropdown Menu */}
      {open ? (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => {
              setOpen(false);
              setAdding(false);
              setPinTarget(null);
            }}
          />
          <div className="fixed inset-x-4 top-16 z-50 mx-auto max-w-sm sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-72 origin-top-right rounded-2xl border border-border bg-raised/95 p-3 shadow-2xl backdrop-blur-2xl rise">
            <div className="flex items-center justify-between border-b border-border pb-2.5 px-2">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted">
                  Profiles
                </p>
                <p className="truncate text-xs font-semibold text-foreground">
                  {houseName || "ReelOS House"}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowInviteQr(true)}
                className="h-7 gap-1 rounded-lg px-2 text-[11px] text-gold hover:text-gold-bright"
              >
                <QrCode className="size-3.5" />
                Invite
              </Button>
            </div>

            {/* Resident list */}
            <div className="mt-2 space-y-1">
              {residents.map((r) => {
                const isActive = r.id === activeId;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => handleSelect(r)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left transition-all",
                      isActive
                        ? "bg-gold/15 text-foreground font-semibold border border-gold/30"
                        : "hover:bg-card text-muted hover:text-foreground",
                    )}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <ResidentAvatar avatar={r.avatar} className="size-6" />
                      <span className="truncate text-xs">{r.name}</span>
                      {r.isKids ? (
                        <span className="rounded bg-gold/20 px-1.5 py-0.2 text-[9px] font-bold text-gold">
                          Kids
                        </span>
                      ) : null}
                      {r.isGuest ? (
                        <span className="text-[10px] text-muted">(Guest)</span>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {r.pin ? <Lock className="size-3 text-muted" /> : null}
                      {isActive ? (
                        <Check className="size-3.5 text-gold" strokeWidth={3} />
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Add Resident Form */}
            {adding ? (
              <div className="mt-2 rounded-xl border border-border bg-card p-2.5 space-y-2">
                <input
                  type="text"
                  placeholder="New profile name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="h-8 w-full rounded-lg bg-raised px-2.5 text-xs text-foreground placeholder:text-faint"
                  autoFocus
                />
                <div className="flex justify-between gap-1">
                  {["clapperboard", "film", "tv", "sparkles", "popcorn"].map((av) => (
                    <button
                      key={av}
                      type="button"
                      onClick={() => setNewAvatar(av)}
                      className={cn(
                        "rounded-lg p-1.5",
                        newAvatar === av ? "bg-gold text-gold-fg" : "text-muted",
                      )}
                    >
                      <ResidentAvatar avatar={av} className="size-5" />
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setNewIsKids(!newIsKids)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg border px-2 py-1.5 text-xs transition-all",
                    newIsKids
                      ? "border-gold/50 bg-gold/15 text-gold font-semibold"
                      : "border-border/60 bg-raised/50 text-muted hover:text-foreground",
                  )}
                >
                  <span className="flex items-center gap-1.5">
                    <span>👶</span>
                    <span>Kids Sandbox Profile</span>
                  </span>
                  <span className="text-[10px] uppercase font-bold">
                    {newIsKids ? "ON" : "OFF"}
                  </span>
                </button>
                <div className="flex justify-end gap-1.5 pt-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setAdding(false)}
                    className="h-7 text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    variant="gold"
                    onClick={handleCreate}
                    disabled={!newName.trim()}
                    className="h-7 text-xs"
                  >
                    Add
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="mt-2 flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs text-muted hover:bg-card hover:text-foreground transition-all"
              >
                <Plus className="size-3.5" />
                Add Household Member
              </button>
            )}
          </div>
        </>
      ) : null}

      {/* PIN Verification Modal */}
      {pinTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xl px-4 py-8 overflow-y-auto overscroll-contain">
          <div className="reelos-luxury-card relative w-full max-w-sm rounded-[2rem] p-6 sm:p-8 space-y-5 rise my-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-2xl bg-gold/15 text-gold border border-gold/30 shadow-[0_0_12px_rgba(245,197,24,0.2)]">
                  <KeyRound className="size-4" />
                </div>
                <div>
                  <h3 className="font-display text-base font-semibold text-foreground">
                    {pinTarget.name}
                  </h3>
                  <p className="text-[11px] text-muted">Passcode Required</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPinTarget(null)}
                className="flex size-8 items-center justify-center rounded-full text-muted hover:text-foreground hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <p className="text-xs text-muted/90 text-center leading-relaxed">
              Enter the 4-digit security passcode to switch into this resident profile.
            </p>

            <div className="py-2">
              <LuxuryPinInput
                value={pinInput}
                onChange={(val) => {
                  setPinError(false);
                  setPinInput(val);
                }}
                error={pinError}
                length={4}
                autoFocus
                onComplete={() => handlePinSubmit()}
              />
            </div>

            {pinError ? (
              <p className="text-center text-xs font-medium text-danger animate-pulse">Incorrect passcode</p>
            ) : null}

            <div className="flex gap-2.5 pt-1">
              <Button
                variant="ghost"
                onClick={() => setPinTarget(null)}
                className="flex-1 rounded-2xl min-h-12 border border-white/10 text-white/70 hover:text-white hover:bg-white/10"
              >
                Cancel
              </Button>
              <Button
                variant="gold"
                onClick={handlePinSubmit}
                disabled={pinInput.length < 4}
                className="flex-1 rounded-2xl min-h-12 font-bold bg-gradient-to-r from-gold to-gold-bright text-black shadow-lg shadow-gold/20"
              >
                Unlock
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Invite Friend QR Modal */}
      {showInviteQr ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md px-4">
          <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-5 text-center rise">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <QrCode className="size-5 text-gold" />
                <h3 className="font-display text-base font-semibold text-foreground">
                  Invite Friend to ReelOS
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowInviteQr(false)}
                className="text-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <p className="text-xs text-muted">
              Scan with phone camera or enter this address on your device to stream instantly as Guest.
            </p>

            {/* Real scannable QR Code */}
            <div className="mx-auto flex flex-col items-center justify-center rounded-2xl bg-white p-3.5 shadow-xl ring-4 ring-gold/20">
              <QrCodeSvg value={inviteUrl} size={168} />
            </div>

            <div className="rounded-xl border border-border bg-raised p-3 flex items-center justify-between gap-2">
              <p className="truncate font-mono text-xs text-foreground">
                {inviteUrl}
              </p>
              <Button
                size="sm"
                variant="ghost"
                onClick={copyInvite}
                className="h-8 gap-1 rounded-lg px-2 text-xs"
              >
                {copied ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>

            <p className="text-[11px] text-faint">
              Guests enjoy an ephemeral sandbox that leaves resident continue-watching untouched.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

