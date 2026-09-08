import { useEffect, useRef, useState } from "react";
import { LoaderCircle, SquareTerminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Row } from "@/components/settings-ui";

export function TerminalRow({ open, onClick }: { open: boolean; onClick: () => void }) {
  const [cmd, setCmd] = useState("");
  const [out, setOut] = useState("");
  const [running, setRunning] = useState(false);
  const [cwd, setCwd] = useState("/home/reelos");
  const pre = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (pre.current) pre.current.scrollTop = pre.current.scrollHeight;
  }, [out]);

  useEffect(() => {
    if (!running) return;
    let stop = false;
    const tick = async () => {
      while (!stop) {
        const r = await fetch("/api/terminal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }).then((x) => x.json());
        if (stop) return;
        setOut(r.output || "");
        setRunning(Boolean(r.running));
        if (r.cwd) setCwd(r.cwd);
        if (!r.running) return;
        await new Promise((res) => setTimeout(res, 700));
      }
    };
    void tick();
    return () => {
      stop = true;
    };
  }, [running]);

  const run = async () => {
    const command = cmd.trim();
    if (!command || running) return;
    setRunning(true);
    const r = await fetch("/api/terminal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command }),
    }).then((x) => x.json());
    setOut(r.output || "");
    setRunning(Boolean(r.running));
    if (r.cwd) setCwd(r.cwd);
  };

  const kill = async () => {
    const r = await fetch("/api/terminal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kill: true }),
    }).then((x) => x.json());
    setOut(r.output || "");
    setRunning(Boolean(r.running));
  };

  return (
    <Row
      icon={SquareTerminal}
      title="Terminal"
      hint={running ? "Running on this box" : "Paste a command · runs here"}
      open={open}
      onClick={onClick}
    >
      <p className="text-sm text-muted">
        This is the box. Paste from your phone. You are already root — skip sudo.
      </p>
      <p className="mt-1 font-mono text-[11px] text-faint">{cwd}</p>
      <textarea
        value={cmd}
        onChange={(e) => setCmd(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void run();
          }
        }}
        spellCheck={false}
        placeholder={"curl -fsSL …\nbash /tmp/reelos-update.sh apply"}
        className="mt-3 min-h-[96px] w-full resize-y rounded-xl bg-[#07080a] px-3 py-2.5 font-mono text-[12px] leading-relaxed text-[#d4e0c8] shadow-[inset_0_0_0_1px_rgb(255_255_255/0.06)]"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => void run()} disabled={!cmd.trim() || running}>
          {running ? <LoaderCircle className="size-4 animate-spin" /> : null}
          Run
        </Button>
        {running ? (
          <Button size="sm" variant="danger" onClick={() => void kill()}>
            Stop
          </Button>
        ) : null}
        {out ? (
          <Button size="sm" variant="ghost" onClick={() => setOut("")}>
            Clear
          </Button>
        ) : null}
      </div>
      <pre
        ref={pre}
        className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-[#07080a] px-3 py-2.5 font-mono text-[11px] leading-relaxed text-[#9ccc7c]"
      >
        {out || "output lands here"}
      </pre>
    </Row>
  );
}
