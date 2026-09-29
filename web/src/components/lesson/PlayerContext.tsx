"use client";

import { scrollBehavior } from "@/lib/motion";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";

interface PlayerState {
  videoRef: RefObject<HTMLVideoElement | null>;
  /** Segundo actual del video (se actualiza ~4 veces por segundo) */
  time: number;
  setTime: (t: number) => void;
  hasVideo: boolean;
  setHasVideo: (v: boolean) => void;
  seek: (t: number, play?: boolean) => void;
  theater: boolean;
  setTheater: (v: boolean | ((p: boolean) => boolean)) => void;
}

const Ctx = createContext<PlayerState | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [time, setTime] = useState(0);
  const [hasVideo, setHasVideo] = useState(false);
  const [theater, setTheater] = useState(false);
  const seek = useCallback((t: number, play = true) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, t);
    if (play) v.play().catch(() => {});
    v.scrollIntoView({ behavior: scrollBehavior(), block: "center" });
  }, []);
  return <Ctx.Provider value={{ videoRef, time, setTime, hasVideo, setHasVideo, seek, theater, setTheater }}>{children}</Ctx.Provider>;
}

export function usePlayer() {
  const c = useContext(Ctx);
  if (!c) throw new Error("usePlayer fuera de PlayerProvider");
  return c;
}

/** Distribución de la página de clase: normal (video + temario lateral) o modo cine (video a todo el ancho). */
export function LessonShell({ media, main, sidebar }: { media: ReactNode; main: ReactNode; sidebar: ReactNode }) {
  const { theater } = usePlayer();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    window.scrollTo({ top: 0, behavior: scrollBehavior() });
  }, [theater]);
  // Un único árbol: el video nunca se vuelve a montar al cambiar de modo (no se pierde la reproducción).
  return (
    <div className={`mx-auto grid gap-x-8 gap-y-0 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:grid-rows-[auto_1fr] lg:px-8 lg:py-8 ${theater ? "max-w-[1600px]" : "max-w-7xl"}`}>
      <div className={`min-w-0 ${theater ? "lg:col-span-2" : "lg:col-start-1 lg:row-start-1"}`}>{media}</div>
      <div className="min-w-0 lg:col-start-1 lg:row-start-2">{main}</div>
      <aside className={`mt-8 lg:col-start-2 lg:mt-0 lg:sticky lg:top-24 lg:self-start ${theater ? "lg:row-start-2 lg:mt-6" : "lg:row-start-1 lg:row-span-2"}`}>{sidebar}</aside>
    </div>
  );
}
