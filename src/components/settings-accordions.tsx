import { useEffect, useState } from "react";
import { Check, KeyRound, LoaderCircle, Lock, Plus, UserCheck, X, Cloud, HardDrive, Layers, Download, Upload, Usb, Sparkles, Sliders, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HOSTNAME } from "@/lib/catalog";
import {
  frontendLabel,
  qualityLabel,
  useReelStore,
  type HouseholdResident,
} from "@/lib/store";
import { ResidentAvatar } from "@/components/profile-switcher";
import { showToast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { Toggle, persistUi } from "@/components/settings-ui";
import { StorageSettings } from "@/components/storage-settings";

export function LibraryPanel() {
  const answers = useReelStore((s) => s.answers);
  const patchIntent = useReelStore((s) => s.patchIntent);
  const booksOn = useReelStore((s) => s.settings.betaChannel);
  const [booksKey, setBooksKey] = useState("");
  const [booksKeySaved, setBooksKeySaved] = useState("");
  const [sanitizeBusy, setSanitizeBusy] = useState(false);
  const [sanitizeStatus, setSanitizeStatus] = useState<string | null>(null);
  const [savingIntentKey, setSavingIntentKey] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/intent", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ ok?: boolean; intent?: Record<string, boolean> }>)
      .then((data) => {
        if (data.ok && data.intent) {
          patchIntent(data.intent);
        }
      })
      .catch(() => {});
  }, [patchIntent]);

  const handleToggleIntent = async (k: "movies" | "tv" | "anime" | "kids" | "music", label: string) => {
    if (savingIntentKey) return;
    const currentVal = Boolean(answers.intent[k]);
    const nextVal = !currentVal;
    patchIntent({ [k]: nextVal });
    setSavingIntentKey(k);
    try {
      const res = await fetch("/api/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: { ...answers.intent, [k]: nextVal } }),
      });
      const data = (await res.json()) as { ok?: boolean; intent?: Record<string, boolean>; error?: string };
      if (data.ok) {
        showToast(`${label} collection ${nextVal ? "enabled" : "disabled"}`, "success");
      } else {
        patchIntent({ [k]: currentVal });
        showToast(data.error || `Failed to update ${label}`, "error");
      }
    } catch {
      patchIntent({ [k]: currentVal });
      showToast(`Network error updating ${label}`, "error");
    } finally {
      setSavingIntentKey(null);
    }
  };

  const handleSanitize = async () => {
    setSanitizeBusy(true);
    setSanitizeStatus(null);
    try {
      const res = await fetch("/api/library/sanitize", { method: "POST" });
      const data = (await res.json()) as { ok?: boolean; sanitized?: number; detail?: string | unknown[]; error?: string };
      if (!data.ok) {
        setSanitizeStatus(data.error || "Sanitize failed");
      } else if (data.sanitized && data.sanitized > 0) {
        setSanitizeStatus(`Sanitized ${data.sanitized} title${data.sanitized === 1 ? "" : "s"}.`);
        useReelStore.getState().hydrateShelf({ limit: 24, force: true });
      } else {
        setSanitizeStatus(typeof data.detail === "string" ? data.detail : "Library is clean — no scene release suffixes found.");
      }
    } catch (e) {
      setSanitizeStatus(String(e));
    } finally {
      setSanitizeBusy(false);
    }
  };
  useEffect(() => {
    if (!booksOn) return;
    void fetch("/api/settings", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ googleBooksApiKey?: string }>)
      .then((j) => setBooksKey(j.googleBooksApiKey || ""))
      .catch(() => {});
  }, [booksOn]);
  return (
    <>
      <p className="text-sm text-muted">Collections installed from your wizard answers.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {(
          [
            ["movies", "Movies"],
            ["tv", "TV"],
            ["anime", "Anime"],
            ["kids", "Kids"],
            ["music", "Music"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            disabled={savingIntentKey !== null}
            onClick={() => void handleToggleIntent(k, label)}
            className={cn(
              "min-h-[44px] rounded-full px-4 text-sm font-medium transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none flex items-center gap-1.5",
              answers.intent[k] ? "bg-gold text-gold-fg shadow-sm" : "bg-card-2 text-muted hover:text-foreground hover:bg-card-2/80",
              savingIntentKey === k && "opacity-75 cursor-not-allowed",
            )}
          >
            {savingIntentKey === k ? (
              <LoaderCircle className="size-3.5 animate-spin" />
            ) : null}
            <span>{label}</span>
          </button>
        ))}
      </div>
      {booksOn ? (
        <div className="mt-4">
          <p className="text-sm font-medium">Google Books API key</p>
          <p className="mt-1 text-xs text-muted">
            Optional. Metadata, previews, and buy links — not a novel fetcher. A key cannot download Hunger Games onto
            this box. Licensed titles are buy / borrow / sideload.
          </p>
          <form
            className="mt-2 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              persistUi({ googleBooksApiKey: booksKey.trim() });
              setBooksKeySaved(booksKey.trim() ? "saved" : "cleared");
            }}
          >
            <input
              type="password"
              autoComplete="off"
              value={booksKey}
              onChange={(e) => setBooksKey(e.target.value)}
              placeholder="AIza… (optional)"
              className="h-10 min-w-0 flex-1 rounded-xl bg-card-2 px-3 font-mono text-sm"
            />
            <Button size="sm" type="submit">
              Save
            </Button>
          </form>
          {booksKeySaved ? <p className="mt-1 text-xs text-muted">Key {booksKeySaved}.</p> : null}
        </div>
      ) : null}
      <div className="mt-5 border-t border-border pt-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">Sanitize Titles</p>
            <p className="text-xs text-muted">
              Clean technical tags from movie and TV display titles for a clean cinema look.
            </p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="mt-2 shrink-0 sm:mt-0"
            disabled={sanitizeBusy}
            onClick={() => void handleSanitize()}
          >
            {sanitizeBusy ? (
              <span className="flex items-center gap-1.5">
                <LoaderCircle className="size-3.5 animate-spin" />
                Sanitizing…
              </span>
            ) : (
              "Sanitize Titles"
            )}
          </Button>
        </div>
        {sanitizeStatus ? <p className="mt-2 text-xs text-gold">{sanitizeStatus}</p> : null}
      </div>
    </>
  );
}

export function QualityPanel() {
  const answers = useReelStore((s) => s.answers);
  const patchAnswers = useReelStore((s) => s.patchAnswers);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  useEffect(() => {
    void fetch("/api/quality", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ ok?: boolean; quality?: "1080p" | "hybrid" | "4k" | "custom"; wanted?: "1080p" | "hybrid" | "4k" | "custom" }>)
      .then((data) => {
        const q = data.quality || data.wanted;
        if (q && q !== answers.quality) {
          patchAnswers({ quality: q });
        }
      })
      .catch(() => {});
  }, [answers.quality, patchAnswers]);

  const handleSelect = async (q: "1080p" | "hybrid" | "4k") => {
    if (saving || answers.quality === q) return;
    const prev = answers.quality;
    patchAnswers({ quality: q });
    setSaving(true);
    setSavedMsg("");
    try {
      const res = await fetch("/api/quality", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quality: q }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        quality?: "1080p" | "hybrid" | "4k" | "custom";
        wanted?: "1080p" | "hybrid" | "4k" | "custom";
        error?: string;
      };
      if (data.ok) {
        const finalQ = data.quality || data.wanted || q;
        patchAnswers({ quality: finalQ });
        showToast(`Quality floor set to ${qualityLabel[finalQ]}`, "success");
        setSavedMsg(`Saved: ${qualityLabel[finalQ]}`);
        setTimeout(() => setSavedMsg(""), 3500);
      } else {
        patchAnswers({ quality: prev });
        showToast(data.error || "Failed to update quality", "error");
        setSavedMsg(data.error || "Failed to save");
      }
    } catch {
      patchAnswers({ quality: prev });
      showToast("Network error updating quality", "error");
      setSavedMsg("Network error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <p className="text-sm text-muted">
        New requests use this floor. Hybrid grabs 1080 and 4K and keeps both — it does not replace the 1080.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {(["1080p", "hybrid", "4k"] as const).map((q) => (
          <button
            key={q}
            type="button"
            disabled={saving}
            onClick={() => void handleSelect(q)}
            className={cn(
              "h-9 rounded-full px-4 text-sm font-medium transition-all cursor-pointer",
              answers.quality === q
                ? "bg-gold text-gold-fg shadow-sm"
                : "bg-card-2 text-muted hover:text-foreground hover:bg-card-2/80",
              saving && "opacity-75 cursor-not-allowed",
            )}
          >
            {saving && answers.quality === q ? (
              <span className="flex items-center gap-1.5">
                <LoaderCircle className="size-3.5 animate-spin" />
                {qualityLabel[q]}
              </span>
            ) : (
              qualityLabel[q]
            )}
          </button>
        ))}
        {savedMsg ? (
          <span className="ml-2 flex items-center gap-1 text-xs text-gold animate-fadeIn">
            <Check className="size-3.5" />
            {savedMsg}
          </span>
        ) : null}
      </div>
    </>
  );
}

export function UsersPanel() {
  const residents = useReelStore((s) => s.residents);
  const activeResidentId = useReelStore((s) => s.activeResidentId);
  const setActiveResident = useReelStore((s) => s.setActiveResident);
  const addResident = useReelStore((s) => s.addResident);
  const patchResident = useReelStore((s) => s.patchResident);
  const removeResident = useReelStore((s) => s.removeResident);
  const settings = useReelStore((s) => s.settings);
  const patchSettings = useReelStore((s) => s.patchSettings);
  const users = useReelStore((s) => s.users);

  const [newName, setNewName] = useState("");
  const [newAvatar, setNewAvatar] = useState("clapperboard");
  const [newIsKids, setNewIsKids] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [pinPromptResident, setPinPromptResident] = useState<HouseholdResident | null>(null);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);

  const handleSwitch = (r: HouseholdResident) => {
    if (r.id === activeResidentId) return;
    if (r.pin) {
      setPinPromptResident(r);
      setPinInput("");
      setPinError(false);
      return;
    }
    setActiveResident(r.id);
    if (r.isKids) {
      showToast(`👶 Switched to ${r.name} (Kids Sandbox)`, "info");
    } else {
      showToast(`Switched to ${r.name}`, "success");
    }
  };

  const handlePinSubmit = () => {
    if (!pinPromptResident) return;
    if (pinInput === pinPromptResident.pin) {
      setActiveResident(pinPromptResident.id);
      if (pinPromptResident.isKids) {
        showToast(`👶 Switched to ${pinPromptResident.name} (Kids Sandbox)`, "info");
      } else {
        showToast(`Unlocked and switched to ${pinPromptResident.name}`, "success");
      }
      setPinPromptResident(null);
      setPinInput("");
      setPinError(false);
    } else {
      setPinError(true);
      setPinInput("");
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    addResident(newName.trim(), newAvatar, undefined, newIsKids);
    showToast(`Added profile for ${newName.trim()}`, "success");
    setNewName("");
    setNewIsKids(false);
    setShowAddForm(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">
          Household Profiles ({residents.length})
        </p>
        {!showAddForm ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowAddForm(true)}
            className="h-7 text-xs text-gold hover:text-gold-bright gap-1"
          >
            <Plus className="size-3.5" />
            Add Member
          </Button>
        ) : null}
      </div>

      <div className="space-y-2">
        {residents.map((r) => {
          const isActive = r.id === activeResidentId;
          return (
            <div
              key={r.id}
              className={cn(
                "flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border p-3.5 transition-all",
                isActive
                  ? "border-gold/50 bg-gold/10 shadow-sm"
                  : "border-border bg-card-2"
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <ResidentAvatar avatar={r.avatar} className="size-8 text-xs shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-foreground truncate">{r.name}</span>
                    {isActive ? (
                      <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[9px] font-bold text-gold">
                        ACTIVE
                      </span>
                    ) : null}
                    {r.isKids ? (
                      <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[9px] font-semibold text-blue-400">
                        Kids Sandbox
                      </span>
                    ) : null}
                    {r.isGuest ? (
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] text-muted">
                        Guest
                      </span>
                    ) : null}
                    {r.pin ? (
                      <span className="flex items-center gap-1 text-[10px] text-muted" title="Protected by 4-digit PIN">
                        <Lock className="size-3" /> PIN
                      </span>
                    ) : null}
                  </div>
                  <p className="text-[11px] text-muted mt-0.5">
                    {r.isGuest
                      ? "Ephemeral session · No persistent history"
                      : `${r.watchlist?.length || 0} saved in watchlist`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                {!isActive ? (
                  <Button
                    size="sm"
                    variant="gold"
                    onClick={() => handleSwitch(r)}
                    className="h-8 gap-1.5 text-xs font-semibold"
                  >
                    <UserCheck className="size-3.5" />
                    Switch to Profile
                  </Button>
                ) : (
                  <span className="flex items-center gap-1 text-xs font-medium text-gold px-2.5 py-1 rounded-lg bg-gold/10">
                    <Check className="size-3.5" /> Current Profile
                  </span>
                )}

                {!r.isGuest && (
                  <button
                    type="button"
                    onClick={() => {
                      patchResident(r.id, { isKids: !r.isKids });
                      showToast(
                        !r.isKids
                          ? `Set ${r.name} to Kids Sandbox`
                          : `Disabled Kids Sandbox for ${r.name}`,
                        "info"
                      );
                    }}
                    className={cn(
                      "h-8 px-2.5 rounded-lg border text-xs font-medium transition-all",
                      r.isKids
                        ? "border-blue-500/40 bg-blue-500/10 text-blue-400"
                        : "border-border text-muted hover:text-foreground"
                    )}
                    title="Toggle Kids Sandbox Mode"
                  >
                    {r.isKids ? "Kids: On" : "Kids: Off"}
                  </button>
                )}

                {!isActive && r.id !== (residents[0]?.id ?? "res-primary") && (
                  <button
                    type="button"
                    className="text-xs text-danger/80 hover:text-danger px-1.5 py-1 cursor-pointer"
                    onClick={() => {
                      removeResident(r.id);
                      showToast(`Removed profile ${r.name}`, "info");
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* PIN Verification Modal */}
      {pinPromptResident ? (
        <div className="rounded-2xl border border-gold/40 bg-card p-4 space-y-3 rise shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <KeyRound className="size-4 text-gold" />
              <span className="text-xs font-semibold text-foreground">
                Enter PIN for {pinPromptResident.name}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setPinPromptResident(null)}
              className="text-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="flex gap-2">
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              value={pinInput}
              onChange={(e) => {
                setPinError(false);
                setPinInput(e.target.value.replace(/\D/g, ""));
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handlePinSubmit();
              }}
              placeholder="••••"
              className={cn(
                "h-9 flex-1 rounded-xl bg-card-2 px-3 text-center font-mono text-base tracking-[0.3em]",
                pinError && "border border-danger text-danger"
              )}
              autoFocus
            />
            <Button size="sm" variant="gold" onClick={handlePinSubmit} disabled={pinInput.length < 4}>
              Unlock
            </Button>
          </div>
          {pinError ? <p className="text-xs text-danger">Incorrect PIN</p> : null}
        </div>
      ) : null}

      {/* Add Member Form */}
      {showAddForm ? (
        <form onSubmit={handleCreate} className="rounded-2xl border border-border bg-card p-4 space-y-3 rise">
          <p className="text-xs font-semibold text-foreground">Add New Household Member</p>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Profile name (e.g. Grandma, Office TV)"
            className="h-9 w-full rounded-xl bg-card-2 px-3 text-xs"
            autoFocus
          />
          <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
            <span className="text-xs text-muted">Avatar:</span>
            <div className="flex gap-1.5">
              {["clapperboard", "film", "tv", "sparkles", "shield", "popcorn"].map((av) => (
                <button
                  key={av}
                  type="button"
                  onClick={() => setNewAvatar(av)}
                  className={cn(
                    "rounded-lg p-1.5 transition-all",
                    newAvatar === av ? "bg-gold text-gold-fg shadow-sm" : "text-muted hover:text-foreground"
                  )}
                >
                  <ResidentAvatar avatar={av} className="size-4 text-[10px]" />
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={newIsKids}
              onChange={(e) => setNewIsKids(e.target.checked)}
              className="rounded border-border"
            />
            <span>Enable Kids Sandbox (filter out mature content)</span>
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <Button size="sm" variant="ghost" type="button" onClick={() => setShowAddForm(false)}>
              Cancel
            </Button>
            <Button size="sm" variant="gold" type="submit" disabled={!newName.trim()}>
              Save Profile
            </Button>
          </div>
        </form>
      ) : null}

      {/* Global Auto-Approve requests toggle */}
      <div className="border-t border-border pt-4">
        <label className="flex items-center justify-between text-sm">
          <span>
            Auto-approve household requests
            <p className="text-xs text-muted mt-0.5">Allow all residents to trigger downloads immediately.</p>
          </span>
          <Toggle
            on={settings.autoApprove}
            onChange={(v) => {
              patchSettings({ autoApprove: v });
              persistUi({ autoApprove: v });
            }}
          />
        </label>
      </div>

      {/* Appliance OS Account subsection */}
      {users.length > 0 ? (
        <div className="border-t border-border pt-3">
          <p className="text-[11px] font-semibold text-muted uppercase tracking-wider">
            Appliance Operating System Account
          </p>
          <div className="mt-2 flex items-center justify-between rounded-xl bg-card-2 px-3 py-2 text-xs">
            <span className="font-mono text-foreground">{users[0]?.name || "reelos"}</span>
            <span className="text-faint">{users[0]?.role || "admin"}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function AccessPanel({ lan }: { lan: string }) {
  const answers = useReelStore((s) => s.answers);
  return (
    <>
      <p className="font-mono text-sm">
        {HOSTNAME}
        <span className="ml-3 text-muted">{lan || "no LAN yet"}</span>
      </p>
      <p className="mt-2 text-sm text-muted">Watching: {frontendLabel[answers.frontend]}</p>
    </>
  );
}

export function NotesPanel() {
  const settings = useReelStore((s) => s.settings);
  const patchSettings = useReelStore((s) => s.patchSettings);
  return (
    <>
      <label className="flex items-center justify-between text-sm">
        When a title becomes available
        <Toggle
          on={settings.notifyAvailable}
          onChange={(v) => {
            patchSettings({ notifyAvailable: v });
            persistUi({ notifyAvailable: v });
            if (v && typeof Notification !== "undefined") void Notification.requestPermission();
          }}
        />
      </label>
      <label className="mt-3 flex items-center justify-between text-sm">
        When a request fails
        <Toggle
          on={settings.notifyFailed}
          onChange={(v) => {
            patchSettings({ notifyFailed: v });
            persistUi({ notifyFailed: v });
            if (v && typeof Notification !== "undefined") void Notification.requestPermission();
          }}
        />
      </label>
    </>
  );
}


export function MediaStrategyPanel() {
  return <StorageSettings />;
}

export function PassportBackupPanel() {
  const [usbDrives, setUsbDrives] = useState<Array<{ name: string; path: string; size: string; isUsb?: boolean }>>([]);
  const [googleStatus, setGoogleStatus] = useState<{ linked?: boolean; accountEmail?: string | null }>({ linked: false });
  const [selectedUsb, setSelectedUsb] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    void fetch("/api/disks/usb", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ drives?: typeof usbDrives }>)
      .then((data) => {
        const d = data.drives || [];
        setUsbDrives(d);
        if (d.length > 0 && d[0]?.path) setSelectedUsb(d[0].path);
      })
      .catch(() => {});

    void fetch("/api/passport/google-status", { cache: "no-store" })
      .then((r) => r.json() as Promise<typeof googleStatus>)
      .then((data) => setGoogleStatus(data))
      .catch(() => {});
  }, []);

  const handleExportPassport = () => {
    window.open("/api/passport/export", "_blank");
  };

  const handleImportPassport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setMsg("");
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const res = await fetch("/api/passport/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.ok) {
        const count = data.restored?.profilesCount ?? 0;
        setMsg(`✓ Passport restored! Restored ${count} profiles.`);
        showToast(`Passport restored (${count} profiles)`, "success");
        setTimeout(() => window.location.reload(), 2000);
      } else {
        setMsg(data.error || "Failed to import passport");
        showToast(data.error || "Failed to import passport", "error");
      }
    } catch (err) {
      setMsg("Invalid passport JSON file");
      showToast("Invalid passport JSON file", "error");
    } finally {
      setBusy(false);
    }
  };

  const handleMakeThumbStick = async () => {
    if (!selectedUsb) {
      setMsg("Please select an attached USB drive");
      showToast("Please select an attached USB drive", "info");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/passport/usb-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usbMountPath: selectedUsb }),
      });
      const data = await res.json();
      if (data.ok) {
        setMsg("✓ Portable ReelOS Stick Ready! Double-click reelos-setup.bat on any PC.");
        showToast("Portable ReelOS Stick ready!", "success");
      } else {
        setMsg(data.error || "Failed to write to USB");
        showToast(data.error || "Failed to write to USB", "error");
      }
    } catch (err) {
      setMsg("Failed to configure USB stick");
      showToast("Failed to configure USB stick", "error");
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleSync = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/passport/google-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "primary@gmail.com" }),
      });
      const data = await res.json();
      if (data.ok) {
        setGoogleStatus({ linked: true, accountEmail: data.accountEmail });
        setMsg("✓ Synced passport with Google Drive!");
        showToast("Synced passport with Google Drive!", "success");
      } else {
        setMsg(data.error || "Google sync failed");
        showToast(data.error || "Google sync failed", "error");
      }
    } catch {
      setMsg("Google sync failed");
      showToast("Google sync failed", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">
        Your Passport carries this profile's taste, collections, and reading progress. It excludes passcodes, streaming keys, and other people's private information. Open the destination profile before importing it.
      </p>

      {/* 1. Passport Backup Download & Restore */}
      <div className="rounded-xl border border-border bg-card/40 p-4 space-y-3">
        <span className="font-display text-xs font-semibold text-foreground uppercase tracking-wider">
          Personal Passport
        </span>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button variant="gold" size="sm" onClick={handleExportPassport} className="gap-1.5">
            <Download className="size-3.5" />
            Download Passport (.json)
          </Button>
          <label className="cursor-pointer">
            <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium border border-border bg-card hover:bg-card-2 text-foreground transition-colors">
              <Upload className="size-3.5" />
              Restore from Passport File
            </span>
            <input type="file" accept=".json" onChange={handleImportPassport} className="hidden" />
          </label>
        </div>
      </div>

      {/* 2. Media Server on a Thumb Stick */}
      <div className="rounded-xl border border-border bg-card/40 p-4 space-y-3">
        <span className="font-display text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Usb className="size-3.5 text-gold" />
          Passport on USB
        </span>
        <p className="text-xs text-muted leading-relaxed">
          The household owner can export a personal Passport to a selected USB drive. This does not install ReelOS or copy movies; destination setup and source access are still required.
        </p>

        {usbDrives.length > 0 ? (
          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
            <select
              value={selectedUsb}
              onChange={(e) => setSelectedUsb(e.target.value)}
              className="h-9 rounded-lg bg-card px-3 text-xs border border-border text-foreground"
            >
              {usbDrives.map((d) => (
                <option key={d.path} value={d.path}>
                  {d.name} ({d.size}) · {d.path}
                </option>
              ))}
            </select>
            <Button variant="ghost" size="sm" disabled={busy} onClick={handleMakeThumbStick} className="border border-gold/40 text-gold-bright gap-1.5">
              <Sparkles className="size-3.5" />
              Make Portable ReelOS Stick
            </Button>
          </div>
        ) : (
          <p className="text-xs text-faint">
            Plug a USB thumb stick into this computer to configure a portable stick.
          </p>
        )}
      </div>

      {/* 3. Google Drive Cloud Sync */}
      <div className="rounded-xl border border-border bg-card/40 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-display text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Cloud className="size-3.5 text-live" />
            Google Drive Cloud Sync
          </span>
          <span className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-semibold",
            googleStatus.linked ? "bg-success/20 text-success" : "bg-muted/20 text-muted"
          )}>
            {googleStatus.linked ? "Cloud Synced" : "Not Linked"}
          </span>
        </div>
        <p className="text-xs text-muted">
          {googleStatus.linked
            ? `Linked with ${googleStatus.accountEmail || "Google Account"}. Automatic cloud snapshots active.`
            : "Google Drive backup is not connected in this build. Use a downloaded Passport for personal transfers."}
        </p>
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={handleGoogleSync}
          className="border border-border text-xs gap-1.5"
        >
          <RefreshCw className={cn("size-3", busy && "animate-spin")} />
          {googleStatus.linked ? "Backup to Google Drive Now" : "Link Google Drive"}
        </Button>
      </div>

      {msg ? <p className="text-xs text-gold-bright">{msg}</p> : null}
    </div>
  );
}

export function FeedbackPanel() {
  const [type, setType] = useState<"bug" | "feature" | "praise">("feature");
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setSubmitting(true);
    setStatus(null);
    try {
      const res = await fetch("/api/feedback/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, message, contact }),
      });
      const data = await res.json();
      if (data.ok) {
        setStatus(`✓ Feedback received (Ref: #${data.feedback?.id?.slice(0, 8) || "ok"}). Thank you for helping build ReelOS!`);
        showToast("Thank you for your feedback!", "success");
        setMessage("");
      } else {
        setStatus(data.error || "Failed to send feedback");
        showToast(data.error || "Failed to send feedback", "error");
      }
    } catch (err) {
      setStatus("Error sending feedback");
      showToast("Error sending feedback", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-xs">
      <p className="text-muted leading-relaxed">
        Send ideas, report unexpected behaviors, or tell the developer what you love. Your feedback helps make ReelOS better for everyone.
      </p>

      <div className="flex gap-2">
        {(
          [
            ["feature", "Feature Idea", Sparkles],
            ["bug", "Bug Report", HardDrive],
            ["praise", "Praise / Note", UserCheck],
          ] as const
        ).map(([t, label, Icon]) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={cn(
              "flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-medium transition-all cursor-pointer",
              type === t
                ? "bg-gold text-gold-fg font-semibold shadow-sm"
                : "border border-border bg-card text-muted hover:text-foreground"
            )}
          >
            <Icon className="size-3.5" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-muted uppercase tracking-wider">
          Your Note
        </label>
        <textarea
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Describe what you noticed or what feature would make your experience even better..."
          required
          className="w-full rounded-xl border border-border bg-card p-3 text-xs text-foreground placeholder-muted focus:border-gold focus:outline-none"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-muted uppercase tracking-wider">
          Contact / Email (Optional)
        </label>
        <input
          type="text"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="e.g. resident@example.com or Discord handle"
          className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground placeholder-muted focus:border-gold focus:outline-none"
        />
      </div>

      <Button
        type="submit"
        size="sm"
        variant="gold"
        disabled={submitting || !message.trim()}
        className="font-semibold text-xs h-8 gap-1.5"
      >
        {submitting ? <LoaderCircle className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
        Submit Feedback
      </Button>

      {status ? (
        <p className={cn("text-xs font-medium", status.startsWith("✓") ? "text-emerald-400" : "text-rose-400")}>
          {status}
        </p>
      ) : null}
    </form>
  );
}
