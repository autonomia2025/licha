"use client";

import { usePathname, useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { Check } from "lucide-react";
import { setCompleted } from "@/app/actions";

async function celebrate() {
  const confetti = (await import("canvas-confetti")).default;
  const colors = ["#7c6cff", "#9a8cff", "#f5f5f4", "#34d399"];
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
      className={`btn ${done ? "border border-success/30 bg-success/10 text-success hover:bg-success/15" : "btn-ghost"}`}
    >
      <Check className="size-4" strokeWidth={done ? 3 : 2} aria-hidden />
      {done ? "Completada" : finishesCourse ? "Completar curso 🎉" : "Marcar como completada"}
    </button>
  );
}
