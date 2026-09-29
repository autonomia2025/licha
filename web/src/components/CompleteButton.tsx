"use client";

import { usePathname, useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { setCompleted } from "@/app/actions";

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
  const [done, setDone] = useOptimistic(completed);
  return (
    <button
      onClick={() =>
        start(async () => {
          const next = !done;
          setDone(next);
          if (next && finishesCourse) celebrate();
          await setCompleted(lessonId, next, path);
          router.refresh();
        })
      }
      disabled={pending}
      aria-pressed={done}
      className={`btn ${done ? "btn-primary" : "btn-ghost"}`}
    >
      <span className={`grid size-5 place-items-center rounded-full transition duration-500 [transition-timing-function:var(--ease-spring)] ${done ? "scale-100 bg-black text-white" : "scale-90 border border-white/40"}`} aria-hidden>
        {done ? (
          <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.5 4.5L19 7.5" strokeDasharray={24} style={{ animation: "check-draw 0.5s var(--ease-out-expo) 0.1s backwards" }} />
          </svg>
        ) : null}
      </span>
      {done ? "Completada" : finishesCourse ? "Completar curso 🎉" : "Marcar como completada"}
    </button>
  );
}
