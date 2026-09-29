import type { LucideIcon } from "lucide-react";

/** Estado vacío: icono sutil, título, explicación breve y (opcional) una acción. */
export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  className = "",
}: {
  icon: LucideIcon;
  title: React.ReactNode;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex animate-fade-up flex-col items-center px-6 py-12 text-center ${className}`}>
      <span className="grid size-12 place-items-center rounded-full border border-white/10 bg-white/[0.05] text-muted shadow-[inset_0_1px_0_#ffffff14]" aria-hidden>
        <Icon className="size-5" />
      </span>
      <p className="mt-4 text-base font-semibold tracking-[-0.01em] text-ink">{title}</p>
      {children ? <div className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted">{children}</div> : null}
      {action ? <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{action}</div> : null}
    </div>
  );
}
