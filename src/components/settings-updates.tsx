import { Check, LoaderCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { catchupLocksHome } from "@/lib/library-catchup";
import { CHANNEL, SHIPPED_VERSION, UPDATE_NOTES, useReelStore } from "@/lib/store";
import { displayVersion, notesForVersion, stripVersionPrefix } from "@/lib/update-notes";
import { Row, Toggle, persistUi } from "@/components/settings-ui";

function Changelog({ title, version, lines }: { title: string; version?: string | null; lines: string[] }) {
  if (!lines.length) return null;
  return (
    <div className="mt-4">
      <p className="text-sm font-medium">
        {title}
        {version ? <span className="ml-2 font-mono text-muted">{version}</span> : null}
      </p>
      <ul className="mt-2 space-y-1.5 text-sm text-muted">
        {lines.map((n) => (
          <li key={n}>· {stripVersionPrefix(n)}</li>
        ))}
      </ul>
    </div>
  );
}

export function UpdatesRow({ open, onClick }: { open: boolean; onClick: () => void }) {
  const update = useReelStore((s) => s.update);
  const libraryCatchup = useReelStore((s) => s.libraryCatchup);
  const autoUpdate = useReelStore((s) => s.settings.autoUpdate);
  const stackImages = useReelStore((s) => s.settings.stackImages);
  const betaChannel = useReelStore((s) => s.settings.betaChannel);
  const patchSettings = useReelStore((s) => s.patchSettings);
  const checkForUpdate = useReelStore((s) => s.checkForUpdate);
  const startUpdate = useReelStore((s) => s.startUpdate);

  const installed = displayVersion(update.current, SHIPPED_VERSION);
  const thisNotes = notesForVersion(UPDATE_NOTES, installed);
  const pending = update.status === "available" ? update.notes : [];

  const hint =
    update.status === "applying"
      ? `Applying ${update.target ?? ""}`
      : catchupLocksHome(libraryCatchup) || libraryCatchup.status === "backoff"
        ? libraryCatchup.message || "Library catching up"
        : update.status === "available"
        ? `${update.target} is ready`
        : update.status === "checking"
          ? betaChannel
            ? "Checking the beta channel"
            : "Checking the stable channel"
          : update.status === "current"
            ? `${installed} · up to date`
            : `${installed} · ${betaChannel ? "beta" : CHANNEL}`;

  return (
    <Row icon={RefreshCw} title="Updates" hint={hint} open={open} onClick={onClick}>
      <p className="font-mono text-sm">
        Installed {installed}
        {update.status === "available" && update.target ? (
          <span className="ml-3 text-muted">available {update.target}</span>
        ) : (
          <span className="ml-3 text-muted">{betaChannel ? "beta" : CHANNEL}</span>
        )}
      </p>
      <p className="mt-2 text-sm text-muted">
        {update.status === "applying"
          ? "An Apply is running — phone, CLI, or both. Full-screen splash stays until browse and request work. Do not tap Apply again."
          : catchupLocksHome(libraryCatchup) || libraryCatchup.status === "backoff"
            ? "The update is on this box. Library catch-up is still importing dumps — folder skips and timeouts are here, not a stuck Apply. Request still works."
            : "Host patches from Ubuntu, ReelOS from GitHub. Stack images stay frozen unless you flip the toggle. Libraries stay put."}
      </p>
      {catchupLocksHome(libraryCatchup) || libraryCatchup.status === "backoff" ? (
        <p className="mt-2 text-sm">
          {libraryCatchup.message || "Library catching up"}
          {libraryCatchup.folder && libraryCatchup.total
            ? ` · folder ${libraryCatchup.folder} of ${libraryCatchup.total}`
            : null}
        </p>
      ) : null}
      {update.status === "error" && update.notes[0] ? (
        <p className="mt-2 text-sm text-danger">{update.notes[0].slice(0, 180)}</p>
      ) : null}

      {update.status === "applying" ? (
        <ol className="mt-4 space-y-2">
          {update.steps.map((s) => (
            <li key={s.id} className="flex items-start gap-2 text-sm">
              {s.status === "done" ? (
                <Check className="mt-0.5 size-3.5 text-gold" strokeWidth={3} />
              ) : s.status === "running" ? (
                <LoaderCircle className="mt-0.5 size-3.5 animate-spin text-gold" />
              ) : (
                <span className="mt-1.5 size-1.5 rounded-full bg-faint/40" />
              )}
              <span>
                <span className={s.status === "pending" ? "text-faint" : ""}>{s.label}</span>
                {s.log ? (
                  <span className="mt-0.5 block font-mono text-[11px] text-faint">{s.log}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <>
          <Changelog title="This install" version={installed} lines={thisNotes} />
          <Changelog title="This update" version={update.target} lines={pending} />
        </>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={checkForUpdate}
          disabled={update.status === "checking" || update.status === "applying"}
        >
          {update.status === "checking" ? <LoaderCircle className="size-4 animate-spin" /> : null}
          Check
        </Button>
        {update.status === "available" ? (
          <Button size="sm" onClick={startUpdate}>
            {update.rollback ? `Roll back to ${update.target}` : `Apply ${update.target}`}
          </Button>
        ) : null}
      </div>

      <label className="mt-4 flex items-center justify-between text-sm">
        Check the stable channel daily
        <Toggle
          on={autoUpdate}
          onChange={(v) => {
            patchSettings({ autoUpdate: v });
            persistUi({ autoUpdate: v });
          }}
        />
      </label>
      <label className="mt-3 flex items-center justify-between text-sm">
        Also pull Jellyfin / engine images
        <Toggle
          on={stackImages}
          onChange={(v) => {
            patchSettings({ stackImages: v });
            persistUi({ stackImages: v });
          }}
        />
      </label>
      <label className="mt-3 flex items-center justify-between text-sm">
        Beta channel
        <Toggle
          on={betaChannel}
          onChange={(v) => {
            patchSettings({ betaChannel: v });
            persistUi({ betaChannel: v });
          }}
        />
      </label>
      <p className="mt-2 text-xs text-muted">
        Off by default. On 1.2.50.50, Beta turns on Arena chrome and Books in place — no second 2.0.0 Apply.
        Off rolls those back (Kavita stops, Books routes 404) without wiping movies/TV. Check stays on
        1.2.50.x while Arena is in-tree. A 4GB house may struggle with Kavita RAM.
      </p>
      {update.rollback && update.status === "available" ? (
        <p className="mt-2 text-xs text-muted">
          Roll back returns this box to {update.target}. Libraries stay. Arena chrome and Books leave when Beta is off.
        </p>
      ) : null}
    </Row>
  );
}
