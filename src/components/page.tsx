import { cn } from "@/lib/utils";

export function Page({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("page-enter px-5 pb-12 pt-2 md:px-10 md:pt-8", className)}>{children}</div>;
}

export function PageTitle({
  kicker,
  children,
  sub,
}: {
  kicker?: string;
  children: React.ReactNode;
  sub?: string;
}) {
  return (
    <header>
      {kicker ? (
        <p className="font-display text-[11px] tracking-[0.28em] text-cyan uppercase">{kicker}</p>
      ) : null}
      <h1 className="font-display text-3xl font-semibold tracking-tight text-balance">{children}</h1>
      {sub ? <p className="mt-2 max-w-xl text-sm text-muted">{sub}</p> : null}
    </header>
  );
}
