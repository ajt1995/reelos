import { Link } from "@tanstack/react-router";
import { ArrowLeft, Clock3 } from "lucide-react";

export function LaterReleaseView({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl items-center px-5 py-16 md:px-10">
      <section className="w-full rounded-[2rem] border border-white/8 bg-card/55 p-7 shadow-[var(--shadow-border)] backdrop-blur-xl md:p-10">
        <span className="grid size-12 place-items-center rounded-full bg-white/7 text-gold">
          <Clock3 className="size-5" aria-hidden="true" />
        </span>
        <p className="mt-7 text-xs font-semibold uppercase tracking-[.18em] text-gold">Later release</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight md:text-5xl">{title}</h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-muted">{detail}</p>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-muted">
          Nothing has been applied or simulated on this device.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/settings/advanced" className="inline-flex min-h-12 items-center rounded-full bg-white px-6 text-sm font-semibold text-black">
            See feature status
          </Link>
          <Link to="/settings" className="inline-flex min-h-12 items-center gap-2 rounded-full border border-white/12 px-5 text-sm text-foreground/85">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Settings
          </Link>
        </div>
      </section>
    </main>
  );
}
