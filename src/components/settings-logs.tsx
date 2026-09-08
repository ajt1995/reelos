import { useEffect, useRef, useState } from "react";
import { LoaderCircle, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Row } from "@/components/settings-ui";

export function LogsRow({ open, onClick }: { open: boolean; onClick: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [text, setText] = useState("");
  const [token, setToken] = useState("");
  const [ghSet, setGhSet] = useState(false);
  const loaded = useRef(false);

  const grab = async () => {
    const r = await fetch("/api/logs", { cache: "no-store", signal: AbortSignal.timeout(45000) });
    const j = (await r.json()) as { ok?: boolean; text?: string; error?: string };
    if (!j.text) throw new Error(j.error || "No logs");
    return j.text;
  };

  const load = async () => {
    setBusy(true);
    setMsg("Collecting…");
    try {
      const t = await grab();
      setText(t);
      loaded.current = true;
      setMsg(`${t.split("\n").length} lines`);
      const g = await fetch("/api/bugs/github", { cache: "no-store" }).then((r) => r.json()) as { set?: boolean };
      setGhSet(Boolean(g.set));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Collect failed");
    }
    setBusy(false);
  };

  useEffect(() => {
    if (open && !loaded.current && !busy) void load();
  }, [open]);

  const copy = async () => {
    setBusy(true);
    try {
      const t = text || (await grab());
      if (!text) setText(t);
      await navigator.clipboard.writeText(t);
      setMsg("Copied. Paste that here.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Copy failed");
    }
    setBusy(false);
  };

  const download = async () => {
    setBusy(true);
    try {
      const t = text || (await grab());
      if (!text) setText(t);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([t], { type: "text/plain" }));
      a.download = "reelos-house.txt";
      a.click();
      setMsg("Downloaded reelos-house.txt");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Download failed");
    }
    setBusy(false);
  };

  return (
    <Row icon={ScrollText} title="Logs" hint={msg || "Last hour on this box"} open={open} onClick={onClick}>
      <p className="text-sm text-muted">
        On-screen dump from this machine. Keys stripped. Copy and paste here — not a screenshot.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => void load()} disabled={busy}>
          {busy ? <LoaderCircle className="size-4 animate-spin" /> : null}
          Refresh
        </Button>
        <Button size="sm" variant="ghost" onClick={() => void copy()} disabled={busy}>
          Copy
        </Button>
        <Button size="sm" variant="ghost" onClick={() => void download()} disabled={busy}>
          Download
        </Button>
      </div>
      <p className="mt-4 text-sm text-muted">
        GitHub token so failed Applies open an issue on ajt1995/reelos. Stays on this box. Not in the ISO.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <input
          type="password"
          autoComplete="off"
          placeholder={ghSet ? "Token saved — paste to replace" : "ghp_… issues write"}
          value={token}
          onChange={(e) => setToken(e.target.value)}
          className="min-w-[12rem] flex-1 rounded-xl bg-raised px-3 py-2 text-sm"
        />
        <Button
          size="sm"
          onClick={() => {
            void fetch("/api/bugs/github", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token }),
            })
              .then((r) => r.json())
              .then((j: { set?: boolean }) => {
                setGhSet(Boolean(j.set));
                setToken("");
                setMsg(j.set ? "GitHub reports on" : "GitHub reports off");
              });
          }}
        >
          Save
        </Button>
      </div>
      {text ? (
        <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-raised p-3 font-mono text-[11px] leading-4 text-muted">
          {text}
        </pre>
      ) : (
        <p className="mt-3 text-sm text-faint">{busy ? "Collecting from the box…" : "Open this row to load."}</p>
      )}
    </Row>
  );
}
