"use client";

import { usePathname, useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { setCompleted } from "@/app/actions";
import { SwapLabel } from "./BtnContent";
import { toast } from "./Toaster";

async function celebrate() {
  const confetti = (await import("canvas-confetti")).default;
  const colors = ["#ffffff", "#e5e5e5", "#a3a3a3", "#737373"];
  confetti({ particleCount: 140, spread: 80, startVelocity: 45, origin: { y: 0.7 }, colors });
  setTimeout(() => confetti({ particleCount: 80, angle: 60, spread: 60, origin: { x: 0, y: 0.8 }, colors }), 250);
  setTimeout(() => confetti({ particleCount: 80, angle: 120, spread: 60, origin: { x: 1, y: 0.8 }, colors }), 400);
}

export function CompleteButton({ lessonId, completed, finishesCourse = false }: { lessonId: string; completed: boolean; finishesCourse?: boolean }) {
  const path = usePathname();
  const router = useRouter();
  const [pending, start] = useTransition();
  // Optimista: el cambio se ve al instante; si el guardado falla se revierte y se avisa.
  const [done, setDone] = useOptimistic(completed);
  const toggle = () =>
    start(async () => {
      const next = !done;
      setDone(next);
      if (next && finishesCourse) celebrate();
      const ok = await setCompleted(lessonId, next, path).catch(() => false);
      if (!ok) {
        toast.error(next ? "No pudimos marcar la clase como completada." : "No pudimos desmarcar la clase.", { label: "Reintentar", onClick: toggle });
        return;
      }
      router.refresh();
    });
  const label = done ? 0 : finishesCourse ? 2 : 1;
  return (
    <button onClick={toggle} aria-busy={pending} aria-pressed={done} className={`btn ${done ? "btn-primary" : "btn-ghost"}`}>
      <span
        className={`grid size-5 place-items-center rounded-full transition-[background-color,transform,border-color] duration-200 ${done ? "scale-100 bg-black text-white" : "scale-90 border border-white/40"}`}
        aria-hidden
      >
        {done ? (
          <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.5 4.5L19 7.5" strokeDasharray={24} style={{ animation: "check-draw 260ms var(--ease-out) 60ms backwards" }} />
          </svg>
        ) : null}
      </span>
      <SwapLabel active={label} labels={["Completada", "Marcar como completada", "Completar curso 🎉"]} />
    </button>
  );
}
