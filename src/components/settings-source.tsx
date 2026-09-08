import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { adapterProfile } from "@/lib/adapter";
import { sourceLabel, useReelStore } from "@/lib/store";
import { formatWhen } from "@/lib/utils";

export function SourcePanel() {
  const answers = useReelStore((s) => s.answers);
  const adapter = useReelStore((s) => s.adapter);
  const pingAdapter = useReelStore((s) => s.pingAdapter);
  const profile = adapterProfile(answers.source, answers.frontend);
  return (
    <div>
      <p className="font-mono text-sm">
        {profile.name}
        <span className="ml-3 text-muted">{profile.api}</span>
      </p>
      <p className="mt-2 text-sm text-muted">{profile.blurb}</p>
      <dl className="mt-4 grid gap-2 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Provider</dt>
          <dd>{sourceLabel[answers.source]}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Account</dt>
          <dd>
            {adapter.account}
            {adapter.daysLeft ? ` · ${adapter.daysLeft}d` : ""}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Mount</dt>
          <dd className="font-mono text-xs">{adapter.mount}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Key</dt>
          <dd className="font-mono text-xs">
            {answers.source === "local-vpn"
              ? "None"
              : answers.apiKey
                ? `••••${answers.apiKey.slice(-4)}`
                : "Missing"}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Cache / transfer</dt>
          <dd>
            {adapter.cacheHits} / {adapter.transfers}
          </dd>
        </div>
      </dl>
      <div className="mt-4 flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={pingAdapter}>
          Ping
        </Button>
        <Link to="/engine/$id" params={{ id: "downloads" }} className="text-sm text-gold">
          Open adapter
        </Link>
        <span className="text-xs text-faint">
          {adapter.status === "healthy"
            ? `${adapter.pingMs}ms · ${adapter.lastPing ? formatWhen(adapter.lastPing) : "never"}`
            : "Offline"}
        </span>
      </div>
    </div>
  );
}
