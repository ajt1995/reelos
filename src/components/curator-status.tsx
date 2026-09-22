interface CuratorStatusProps {
  loading: boolean;
  saving: boolean;
  error: string | null;
  retry(): void;
}

/** Reloads saved taste only; repeating a failed vote remains an explicit choice. */
export function CuratorStatus({ loading, saving, error, retry }: CuratorStatusProps) {
  if (!loading && !saving && !error) return null;
  const busy = loading || saving;
  return (
    <div
      role={error ? "alert" : "status"}
      aria-atomic="true"
      className="my-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm"
    >
      <div>
        <p>{error || (loading ? "Loading your saved taste…" : "Saving your choice…")}</p>
        {error ? <p className="mt-1 text-muted">To retry a choice that was not saved, select it again.</p> : null}
      </div>
      {error ? (
        <button
          type="button"
          onClick={retry}
          disabled={busy}
          className="min-h-[48px] min-w-[48px] rounded-xl border border-border px-4 py-3 font-semibold text-gold hover:bg-gold/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:cursor-wait disabled:opacity-60"
        >
          {loading ? "Loading taste…" : "Retry loading taste"}
        </button>
      ) : null}
    </div>
  );
}
