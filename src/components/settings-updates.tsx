import { Check, LoaderCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CHANNEL, useReelStore } from "@/lib/store";
import { Row, Toggle, persistUi } from "@/components/settings-ui";

export function UpdatesRow({ open, onClick }: { open: boolean; onClick: () => void }) {
  const update = useReelStore((s) => s.update);
  const autoUpdate = useReelStore((s) => s.settings.autoUpdate);
  const stackImages = useReelStore((s) => s.settings.stackImages);
  const patchSettings = useReelStore((s) => s.patchSettings);
  const checkForUpdate = useReelStore((s) => s.checkForUpdate);
  const startUpdate = useReelStore((s) => s.startUpdate);

  const hint =
    update.status === "applying"
      ? `Applying ${update.target ?? ""}`
      : update.status === "available"
        ? `${update.target} is ready`
        : update.status === "checking"
          ? "Checking the stable channel"
          : update.status === "current"
            ? `${update.current} · up to date`
            : `${update.current} · ${CHANNEL}`;

  return (
    <Row icon={RefreshCw} title="Updates" hint={hint} open={open} onClick={onClick}>
      <p className="font-mono text-sm">
        Installed {update.current}
        {update.status === "available" && update.target ? (
          <span className="ml-3 text-muted">available {update.target}</span>
        ) : (
          <span className="ml-3 text-muted">{CHANNEL}</span>
        )}
      </p>
      <p className="mt-2 text-sm text-muted">
        Host patches from Ubuntu, ReelOS from GitHub. Stack images stay frozen unless you flip the toggle. Libraries stay put.
      </p>
      {update.status === "error" && update.notes[0] ? (
        <p className="mt-2 text-sm text-danger">{update.notes[0].slice(0, 180)}</p>
      ) : null}

      {update.status === "available" ? (
        <ul className="mt-4 space-y-1.5 text-sm text-muted">
          {update.notes.map((n) => (
            <li key={n}>· {n}</li>
          ))}
        </ul>
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
                <span className={s.status === "pending" ? "text-faint" : "">{s.label}</span>
                {s.log ? (
                  <span className="mt-0.5 block font-mono text-[11px] text-faint">{s.log}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ol>
      ) : null}

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
            Apply {update.target}
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
    </Row>
  );
}
