"use client";

import { usePathname, useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { Check } from "lucide-react";
import { setCompleted } from "@/app/actions";

export function CompleteButton({ lessonId, completed }: { lessonId: string; completed: boolean }) {
  const path = usePathname();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [done, setDone] = useOptimistic(completed);
  return (
    <button
      onClick={() =>
        start(async () => {
          setDone(!done);
          await setCompleted(lessonId, !done, path);
          router.refresh();
        })
      }
      disabled={pending}
      aria-pressed={done}
      className={`btn ${done ? "border border-success/30 bg-success/10 text-success hover:bg-success/15" : "btn-ghost"}`}
    >
      <Check className="size-4" strokeWidth={done ? 3 : 2} aria-hidden />
      {done ? "Completada" : "Marcar como completada"}
    </button>
  );
}
