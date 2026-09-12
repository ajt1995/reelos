import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { HOSTNAME } from "@/lib/catalog";
import {
  frontendLabel,
  qualityLabel,
  useReelStore,
} from "@/lib/store";
import { GOOGLE_TV_COPY, TRAKT_FREE_COPY, useHouseholdProfile } from "@/lib/profiles";
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
  const addUser = useReelStore((s) => s.addUser);
  const removeUser = useReelStore((s) => s.removeUser);
  const { profiles, profile, picker, refresh, select, kids } = useHouseholdProfile();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"adult" | "kids">("adult");
  const list = profiles.length ? profiles : users.map((u) => ({ ...u, kind: "adult" as const }));
  return (
    <>
      <p className="text-sm text-muted">
        One box, several people. Continue and likes stay on the profile you tap. A single admin does not
        need a picker.
      </p>
      <ul className="mt-3 space-y-2">
        {list.map((u) => (
          <li key={u.id} className="flex items-center justify-between text-sm">
            <button type="button" className="text-left" onClick={() => void select(u.id)}>
              {u.name}{" "}
              <span className="text-faint">
                {u.role === "admin" ? "admin" : u.kind === "kids" ? "kids" : "member"}
                {profile?.id === u.id ? " · this device" : ""}
              </span>
            </button>
            {u.role !== "admin" && !kids ? (
              <button
                type="button"
                className="text-xs text-danger"
                onClick={() => {
                  void fetch("/api/profiles", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "remove", id: u.id }),
                  }).then(() => {
                    removeUser(u.id);
                    refresh();
                  });
                }}
              >
                Remove
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {kids ? (
        <p className="mt-3 text-sm text-muted">Kids profile cannot add people or open the rest of Settings.</p>
      ) : (
        <form
          className="mt-3 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const n = name.trim();
            if (!n) return;
            addUser(n);
            void fetch("/api/profiles", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "add", name: n, kind }),
            }).then(() => refresh());
            setName("");
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            className="h-10 min-w-0 flex-1 rounded-xl bg-card-2 px-3 text-sm"
          />
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value === "kids" ? "kids" : "adult")}
            className="h-10 rounded-xl bg-card-2 px-3 text-sm"
          >
            <option value="adult">Adult</option>
            <option value="kids">Kids</option>
          </select>
          <Button size="sm" type="submit">
            Add
          </Button>
        </form>
      )}
      <p className="mt-3 text-xs text-faint">
        {picker
          ? "Kids hide adult titles and cannot Request or open Settings. Existing admin stays."
          : "Still one person — add a name when someone else uses this box."}
      </p>
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
    </>
  );
}

export function TastePanel() {
  const { trakt, traktCopy, traktConfigured, refresh, kids } = useHouseholdProfile();
  const [clientId, setClientId] = useState("");
  const [busy, setBusy] = useState("");
  if (kids) {
    return <p className="text-sm text-muted">Kids profile cannot change taste accounts.</p>;
  }
  return (
    <>
      <p className="text-sm font-medium">Google TV</p>
      <p className="mt-1 text-sm text-muted">{GOOGLE_TV_COPY}</p>
      <p className="mt-4 text-sm font-medium">Trakt</p>
      <p className="mt-1 text-sm text-muted">{traktCopy || TRAKT_FREE_COPY}</p>
      {trakt.connected ? (
        <p className="mt-2 text-sm">
          Connected{trakt.username ? ` as ${trakt.username}` : ""}. Local thumbs still win if Trakt is down.
        </p>
      ) : trakt.pending ? (
        <p className="mt-2 text-sm">
          On your phone open {trakt.pending.verificationUrl} and enter{" "}
          <span className="font-mono">{trakt.pending.userCode}</span>.
        </p>
      ) : (
        <p className="mt-2 text-xs text-faint">
          Optional. Create a free app at trakt.tv/oauth/applications. Local like/dislike does not need this.
        </p>
      )}
      <form
        className="mt-3 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void fetch("/api/trakt", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "app", clientId }),
          }).then(() => refresh());
        }}
      >
        <input
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          placeholder={traktConfigured ? "Client ID saved" : "Trakt Client ID (optional)"}
          className="h-10 min-w-0 flex-1 rounded-xl bg-card-2 px-3 font-mono text-sm"
        />
        <Button size="sm" type="submit">
          Save
        </Button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setBusy("start");
            void fetch("/api/trakt", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "start" }),
            })
              .then(() => refresh())
              .finally(() => setBusy(""));
          }}
        >
          {busy === "start" ? "Starting…" : "Connect Trakt"}
        </Button>
        {trakt.pending ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setBusy("poll");
              void fetch("/api/trakt", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "poll" }),
              })
                .then(() => refresh())
                .finally(() => setBusy(""));
            }}
          >
            {busy === "poll" ? "Checking…" : "I entered the code"}
          </Button>
        ) : null}
        {trakt.connected ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              void fetch("/api/trakt", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "disconnect" }),
              }).then(() => refresh());
            }}
          >
            Disconnect
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            void fetch("/api/curator", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ reset: true }),
            }).then(() => refresh());
          }}
        >
          Reset my curator
        </Button>
      </div>
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
