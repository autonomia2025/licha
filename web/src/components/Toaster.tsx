"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { AlertCircle, Check, Info, X } from "lucide-react";

/* Notificaciones: toast("Nota guardada") desde cualquier componente cliente. Sin dependencias. */

type Tone = "success" | "error" | "info";
interface Item {
  id: number;
  message: string;
  tone: Tone;
  action?: { label: string; onClick: () => void };
  leaving?: boolean;
}

let items: Item[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
let seq = 0;

function remove(id: number) {
  items = items.map((t) => (t.id === id ? { ...t, leaving: true } : t));
  emit();
  window.setTimeout(() => {
    items = items.filter((t) => t.id !== id);
    emit();
  }, 180);
}

export function toast(message: string, opts: { tone?: Tone; action?: Item["action"] } = {}) {
  const item: Item = { id: ++seq, message, tone: opts.tone ?? "success", action: opts.action };
  // Máximo 3 a la vez: el más antiguo sale primero.
  items = [...items.filter((t) => !t.leaving).slice(-2), item];
  emit();
  return item.id;
}
toast.error = (message: string, action?: Item["action"]) => toast(message, { tone: "error", action });
toast.info = (message: string) => toast(message, { tone: "info" });

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const snapshot = () => items;
const empty: Item[] = [];

export function Toaster() {
  const list = useSyncExternalStore(subscribe, snapshot, () => empty);
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:bottom-2 sm:items-end sm:p-6"
    >
      {list.map((t) => (
        <ToastItem key={t.id} item={t} />
      ))}
    </div>
  );
}

function ToastItem({ item }: { item: Item }) {
  const timer = useRef<number | undefined>(undefined);
  const ms = item.tone === "error" ? 6000 : 3200;
  const arm = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => remove(item.id), ms);
  };
  useEffect(() => {
    arm();
    return () => window.clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const Icon = item.tone === "error" ? AlertCircle : item.tone === "info" ? Info : Check;
  return (
    <div
      role={item.tone === "error" ? "alert" : "status"}
      onPointerEnter={() => window.clearTimeout(timer.current)}
      onPointerLeave={arm}
      className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border border-white/12 bg-neutral-950/80 py-2.5 pl-3 pr-2 text-sm text-ink shadow-[0_20px_50px_-12px_#000,inset_0_1px_0_#ffffff14] backdrop-blur-2xl"
      style={{ animation: item.leaving ? "toast-out 180ms var(--ease-in) forwards" : "toast-in var(--dur-3) var(--ease-out) backwards" }}
    >
      <span
        className={`grid size-6 shrink-0 place-items-center rounded-full ${
          item.tone === "error" ? "bg-red-500/15 text-red-300" : item.tone === "info" ? "bg-white/10 text-white" : "bg-white text-black"
        }`}
        aria-hidden
      >
        <Icon className="size-3.5" strokeWidth={2.5} />
      </span>
      <p className="min-w-0 flex-1 leading-snug">{item.message}</p>
      {item.action ? (
        <button
          onClick={() => {
            item.action?.onClick();
            remove(item.id);
          }}
          className="shrink-0 rounded-full px-3 py-1 text-xs font-semibold text-white transition-colors duration-150 hover:bg-white/10"
        >
          {item.action.label}
        </button>
      ) : null}
      <button onClick={() => remove(item.id)} aria-label="Cerrar aviso" className="icon-btn size-7 shrink-0 text-subtle hover:bg-white/10 hover:text-ink">
        <X className="size-3.5" />
      </button>
    </div>
  );
}
