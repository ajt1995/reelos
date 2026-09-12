import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { HOSTNAME } from "@/lib/catalog";
import {
  OWNER_PERMISSION_TOGGLES,
  isHouseOwner,
} from "@/lib/household-profile";
import {
  frontendLabel,
  qualityLabel,
  useReelStore,
} from "@/lib/store";
import { cn } from "@/lib/utils";
import { Toggle, persistUi } from "@/components/settings-ui";
import { DisksPanel } from "@/components/settings-panels";

export function LibraryPanel() {
  const answers = useReelStore((s) => s.answers);
  const patchIntent = useReelStore((s) => s.patchIntent);
  const booksOn = useReelStore((s) => s.settings.betaChannel);
  const [booksKey, setBooksKey] = useState("");
  const [booksKeySaved, setBooksKeySaved] = useState("");
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
            onClick={() => {
              const next = { [k]: !answers.intent[k] };
              patchIntent(next);
              void fetch("/api/intent", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ intent: { ...answers.intent, ...next } }),
              });
            }}
            className={cn(
              "h-9 rounded-full px-4 text-sm",
              answers.intent[k] ? "bg-gold text-gold-fg" : "bg-card-2 text-muted",
            )}
          >
            {label}
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
      <DisksPanel />
    </>
  );
}

export function QualityPanel() {
  const answers = useReelStore((s) => s.answers);
  const patchAnswers = useReelStore((s) => s.patchAnswers);
  return (
    <>
      <p className="text-sm text-muted">
        New requests use this floor. Hybrid grabs 1080 and 4K and keeps both — it does not replace the 1080.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {(["1080p", "hybrid", "4k"] as const).map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => {
              patchAnswers({ quality: q });
              void fetch("/api/quality", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ quality: q }),
              });
            }}
            className={cn(
              "h-9 rounded-full px-4 text-sm",
              answers.quality === q ? "bg-gold text-gold-fg" : "bg-card-2 text-muted",
            )}
          >
            {qualityLabel[q]}
          </button>
        ))}
      </div>
    </>
  );
}

export function UsersPanel() {
  const users = useReelStore((s) => s.users);
  const settings = useReelStore((s) => s.settings);
  const patchSettings = useReelStore((s) => s.patchSettings);
  const patchUser = useReelStore((s) => s.patchUser);
  const removeUser = useReelStore((s) => s.removeUser);
  const signOutProfile = useReelStore((s) => s.signOutProfile);
  const activeId = useReelStore((s) => s.activeProfileId);
  const me = users.find((u) => u.id === activeId);
  const owner = isHouseOwner(me?.role);
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <>
      <p className="text-sm text-muted">
        Each person has their own 1–2 question setup. ReelOS uses that Jellyfin user. The owner sets roles here.
      </p>
      <ul className="mt-3 space-y-2">
        {users.map((u) => {
          const perms = u.permissions;
          return (
            <li key={u.id} className="rounded-xl bg-card-2 px-3 py-2">
              <button
                type="button"
                className="flex w-full items-center justify-between text-left text-sm"
                onClick={() => setOpenId(openId === u.id ? null : u.id)}
              >
                <span>
                  {u.name}{" "}
                  <span className="text-faint">{isHouseOwner(u.role) ? "owner" : "member"}</span>
                  {u.id === activeId ? <span className="ml-2 text-gold">this phone</span> : null}
                </span>
                <span className="text-xs text-muted">{u.jellyfinUser || u.name}</span>
              </button>
              {openId === u.id ? (
                <div className="mt-2 border-t border-border pt-2">
                  {owner ? (
                    <>
                      {OWNER_PERMISSION_TOGGLES.map((t) => (
                        <label key={t.id} className="mt-2 flex items-center justify-between gap-3 text-sm">
                          <span>
                            {t.label}
                            <span className="mt-0.5 block text-xs text-faint">{t.hint}</span>
                          </span>
                          <Toggle
                            on={Boolean(perms?.[t.id])}
                            onChange={(v) => patchUser(u.id, { [t.id]: v })}
                          />
                        </label>
                      ))}
                      {!isHouseOwner(u.role) ? (
                        <button
                          type="button"
                          className="mt-3 text-xs text-danger"
                          onClick={() => {
                            void fetch(`/api/profiles/${encodeURIComponent(u.id)}`, { method: "DELETE" }).then(() =>
                              removeUser(u.id),
                            );
                          }}
                        >
                          Remove
                        </button>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-xs text-muted">Only the owner can change roles and permissions.</p>
                  )}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {owner ? (
        <p className="mt-3 text-sm text-muted">
          Add someone from the profile picker — two questions, not the house wizard.
        </p>
      ) : null}
      <Button className="mt-3" size="sm" variant="ghost" onClick={() => signOutProfile()}>
        Switch profile
      </Button>
      {owner ? (
        <label className="mt-4 flex items-center justify-between text-sm">
          Auto-approve requests
          <Toggle
            on={settings.autoApprove}
            onChange={(v) => {
              patchSettings({ autoApprove: v });
              persistUi({ autoApprove: v });
            }}
          />
        </label>
      ) : null}
    </>
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
