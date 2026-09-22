import React, { useEffect, useState } from "react";
import { FlaskConical, BookOpen, Terminal, Radio, ShieldAlert } from "lucide-react";
import { showToast } from "@/lib/toast";
import { cn } from "@/lib/utils";

function Switch({
  checked,
  onCheckedChange,
  disabled,
}: {
  checked: boolean;
  onCheckedChange: (val: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-amber-500" : "bg-white/15"
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out",
          checked ? "translate-x-5" : "translate-x-0"
        )}
      />
    </button>
  );
}

interface ShadowSettings {
  annasArchiveEnabled: boolean;
  directSshEnabled: boolean;
  customTrackersEnabled: boolean;
}

const DEFAULT_SETTINGS: ShadowSettings = {
  annasArchiveEnabled: false,
  directSshEnabled: false,
  customTrackersEnabled: false,
};

export function ShadowLabPanel() {
  const [settings, setSettings] = useState<ShadowSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings/shadow-lab")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && data.settings) {
          setSettings(data.settings);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = async (key: keyof ShadowSettings, value: boolean) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    setSaving(true);
    try {
      const res = await fetch("/api/settings/shadow-lab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast(
          key === "annasArchiveEnabled"
            ? value
              ? "Anna's Archive Mirror Enabled"
              : "Anna's Archive Mirror Disabled"
            : "Shadow Lab settings saved",
          "success"
        );
      } else {
        showToast(data.error || "Failed to save shadow setting", "error");
        setSettings(settings);
      }
    } catch (e) {
      showToast("Network error updating shadow setting", "error");
      setSettings(settings);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 text-xs text-muted">
        Loading Shadow Lab configuration...
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-b from-amber-500/10 to-transparent p-5 space-y-4 shadow-sm mt-4">
      <div className="flex items-center justify-between border-b border-amber-500/20 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
            <FlaskConical className="size-4.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-sm font-semibold text-foreground">
                Shadow Lab (7-Tap Developer Mode)
              </h3>
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-mono font-medium text-amber-300">
                Experimental
              </span>
            </div>
            <p className="text-xs text-muted">
              Standing opt-in directive: Legal OPDS by default. Underground search mirrors are strictly opt-in.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3 pt-1">
        {/* Anna's Archive Toggle */}
        <div className="flex items-center justify-between rounded-xl bg-card/60 p-3.5 border border-border/60">
          <div className="flex items-start gap-3">
            <BookOpen className="size-4.5 text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-foreground">Anna's Archive Mirror</p>
              <p className="text-[11px] text-muted leading-relaxed">
                Query underground MD5 shadow catalogs for rare books and academic texts alongside public domain OPDS.
              </p>
            </div>
          </div>
          <Switch
            checked={settings.annasArchiveEnabled}
            onCheckedChange={(val: boolean) => handleToggle("annasArchiveEnabled", val)}
            disabled={saving}
          />
        </div>

        {/* Custom Trackers Toggle */}
        <div className="flex items-center justify-between rounded-xl bg-card/60 p-3.5 border border-border/60">
          <div className="flex items-start gap-3">
            <Radio className="size-4.5 text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-foreground">Custom source endpoints</p>
              <p className="text-[11px] text-muted leading-relaxed">
                Allow owner-configured source endpoints from the private household package. ReelOS does not add any by default.
              </p>
            </div>
          </div>
          <Switch
            checked={settings.customTrackersEnabled}
            onCheckedChange={(val: boolean) => handleToggle("customTrackersEnabled", val)}
            disabled={saving}
          />
        </div>

        {/* Direct SSH Toggle */}
        <div className="flex items-center justify-between rounded-xl bg-card/60 p-3.5 border border-border/60">
          <div className="flex items-start gap-3">
            <Terminal className="size-4.5 text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-foreground">Direct Root Shell / Port 22</p>
              <p className="text-[11px] text-muted leading-relaxed">
                Expose appliance SSH listener on LAN for deep Linux debugging and manual systemd repair.
              </p>
            </div>
          </div>
          <Switch
            checked={settings.directSshEnabled}
            onCheckedChange={(val: boolean) => handleToggle("directSshEnabled", val)}
            disabled={saving}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300/90 border border-amber-500/20">
        <ShieldAlert className="size-3.5 shrink-0" />
        <span>Settings take effect immediately and persist in <code>/var/lib/reelos/shadow-lab.json</code>.</span>
      </div>
    </div>
  );
}
