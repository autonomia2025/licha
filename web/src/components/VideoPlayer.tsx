"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Gauge, Keyboard, Maximize2, Minimize2, RotateCcw, X } from "lucide-react";
import { saveProgress, setCompleted } from "@/app/actions";
import { usePlayer } from "./lesson/PlayerContext";

interface Props {
  lessonId: string;
  src: string;
  poster?: string;
  subtitles: { src: string; language: string; label: string }[];
  startAt: number;
  path: string;
  next: { href: string; title: string } | null;
}

const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];
const SPEED_KEY = "evolve:velocidad";
const AUTOPLAY_SECONDS = 8;

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));

/**
 * Reproductor: subtítulos (CC), velocidad recordada, atajos de teclado, modo cine,
 * reanuda donde quedaste, marca la clase al terminar y pasa sola a la siguiente.
 */
export function VideoPlayer({ lessonId, src, poster, subtitles, startAt, path, next }: Props) {
  const { videoRef, setTime, setHasVideo, theater, setTheater } = usePlayer();
  const lastSaved = useRef(0);
  const [ended, setEnded] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [speed, setSpeed] = useState(1);
  const [speedOpen, setSpeedOpen] = useState(false);
  const [help, setHelp] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const router = useRouter();
  const toastTimer = useRef<number | undefined>(undefined);

  const flash = (msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 900);
  };

  const applySpeed = (s: number) => {
    setSpeed(s);
    if (videoRef.current) videoRef.current.playbackRate = s;
    try {
      localStorage.setItem(SPEED_KEY, String(s));
    } catch {}
  };

  // Eventos del video
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    setHasVideo(true);
    try {
      const saved = Number(localStorage.getItem(SPEED_KEY));
      // El evento "ratechange" actualiza el estado de la velocidad.
      if (SPEEDS.includes(saved)) v.playbackRate = saved;
    } catch {}
    const onMeta = () => {
      if (startAt > 5 && startAt < v.duration - 10) v.currentTime = startAt;
    };
    let raf = 0;
    const onTime = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setTime(v.currentTime));
      if (Math.abs(v.currentTime - lastSaved.current) >= 15) {
        lastSaved.current = v.currentTime;
        saveProgress(lessonId, v.currentTime).catch(() => {});
      }
    };
    const onPause = () => saveProgress(lessonId, v.currentTime).catch(() => {});
    const onEnded = () => {
      setEnded(true);
      if (next) setCountdown(AUTOPLAY_SECONDS);
      setCompleted(lessonId, true, path).then(() => router.refresh()).catch(() => {});
    };
    const onRate = () => setSpeed(v.playbackRate);
    v.addEventListener("ratechange", onRate);
    if (v.playbackRate !== 1) onRate();
    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("pause", onPause);
    v.addEventListener("ended", onEnded);
    return () => {
      cancelAnimationFrame(raf);
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("ended", onEnded);
      v.removeEventListener("ratechange", onRate);
      setHasVideo(false);
    };
  }, [lessonId, startAt, path, router, next, videoRef, setTime, setHasVideo]);

  // Cuenta regresiva para pasar a la siguiente clase
  useEffect(() => {
    if (countdown === null || !next) return;
    if (countdown <= 0) {
      router.push(next.href);
      return;
    }
    const t = window.setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 1000);
    return () => window.clearTimeout(t);
  }, [countdown, next, router]);

  // Atajos de teclado
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const v = videoRef.current;
      if (!v || isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === " " || k === "k") {
        e.preventDefault();
        if (v.paused) v.play();
        else v.pause();
      } else if (k === "arrowleft" || k === "j") {
        e.preventDefault();
        v.currentTime = Math.max(0, v.currentTime - (k === "j" ? 10 : 5));
        flash(`−${k === "j" ? 10 : 5} s`);
      } else if (k === "arrowright" || k === "l") {
        e.preventDefault();
        v.currentTime = Math.min(v.duration || Infinity, v.currentTime + (k === "l" ? 10 : 5));
        flash(`+${k === "l" ? 10 : 5} s`);
      } else if (k === "c") {
        const track = v.textTracks[0];
        if (track) {
          track.mode = track.mode === "showing" ? "hidden" : "showing";
          flash(track.mode === "showing" ? "Subtítulos activados" : "Subtítulos desactivados");
        }
      } else if (k === "m") {
        v.muted = !v.muted;
        flash(v.muted ? "Silenciado" : "Sonido activado");
      } else if (k === "f") {
        if (document.fullscreenElement) document.exitFullscreen();
        else v.requestFullscreen?.();
      } else if (k === "t") {
        setTheater((t) => !t);
      } else if (k === "n" && next) {
        router.push(next.href);
      } else if (e.key === ">" || e.key === "<") {
        const i = SPEEDS.indexOf(v.playbackRate);
        const s = SPEEDS[Math.max(0, Math.min(SPEEDS.length - 1, (i < 0 ? 1 : i) + (e.key === ">" ? 1 : -1)))];
        applySpeed(s);
        flash(`Velocidad ${s}x`);
      } else if (e.key === "?") {
        setHelp((h) => !h);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [next, router, setTheater, videoRef]);

  return (
    <div className="space-y-2">
      <div className={`relative overflow-hidden bg-black ring-1 ring-white/10 transition-[border-radius] duration-500 ${theater ? "sm:rounded-2xl" : "rounded-3xl shadow-[0_40px_100px_-30px_#000]"}`}>
        <video
          ref={videoRef}
          className={`aspect-video w-full bg-black ${theater ? "max-h-[78vh]" : ""}`}
          controls
          playsInline
          preload="metadata"
          poster={poster}
          crossOrigin="anonymous"
          controlsList="nodownload noplaybackrate"
        >
          <source src={src} type="video/mp4" />
          {subtitles.map((s) => (
            <track key={s.language} kind="subtitles" src={s.src} srcLang={s.language} label={s.language === "en" ? "English" : s.label} />
          ))}
          Tu navegador no puede reproducir este video.
        </video>

        {toast ? (
          <div className="pointer-events-none absolute left-1/2 top-6 -translate-x-1/2 rounded-full border border-white/15 bg-black/50 px-4 py-1.5 text-sm font-medium text-white backdrop-blur-xl animate-pop">{toast}</div>
        ) : null}

        {ended ? (
          <div className="absolute inset-0 grid place-items-center bg-black/60 p-6 backdrop-blur-2xl animate-fade">
            <div className="max-w-sm text-center">
              <p className="serif text-3xl text-white">¡Clase completada!</p>
              {next ? (
                <>
                  <p className="mt-3 text-sm text-muted">Siguiente clase{countdown !== null ? ` en ${countdown} s` : ""}</p>
                  <p className="mt-1 text-lg font-semibold">{next.title}</p>
                  {countdown !== null ? (
                    <div className="mx-auto mt-4 h-1 w-48 overflow-hidden rounded-full bg-white/15">
                      <div className="h-full bg-white transition-[width] duration-1000 ease-linear" style={{ width: `${(countdown / AUTOPLAY_SECONDS) * 100}%` }} />
                    </div>
                  ) : null}
                  <div className="mt-6 flex items-center justify-center gap-2">
                    <Link href={next.href} className="btn btn-primary">
                      Continuar <ArrowRight className="size-4" aria-hidden />
                    </Link>
                    {countdown !== null ? (
                      <button onClick={() => setCountdown(null)} className="btn btn-ghost">
                        <X className="size-4" aria-hidden /> Quedarme
                      </button>
                    ) : null}
                  </div>
                </>
              ) : (
                <p className="display mt-3 text-3xl">Terminaste el <em>curso</em></p>
              )}
              <button
                onClick={() => {
                  setEnded(false);
                  setCountdown(null);
                  if (videoRef.current) {
                    videoRef.current.currentTime = 0;
                    videoRef.current.play();
                  }
                }}
                className="mx-auto mt-4 flex items-center gap-1.5 text-sm text-muted hover:text-ink"
              >
                <RotateCcw className="size-3.5" aria-hidden /> Ver de nuevo
              </button>
            </div>
          </div>
        ) : null}

        {help ? (
          <div className="absolute inset-0 grid place-items-center bg-black/60 p-6 backdrop-blur-2xl animate-fade" onClick={() => setHelp(false)}>
            <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <p className="mb-4 text-sm font-semibold uppercase tracking-[0.16em] text-muted">Atajos de teclado</p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 text-sm">
                {[
                  ["Espacio / K", "Reproducir / pausar"],
                  ["← →", "Retroceder / avanzar 5 s"],
                  ["J  L", "Retroceder / avanzar 10 s"],
                  ["C", "Subtítulos"],
                  ["< >", "Velocidad"],
                  ["T", "Modo cine"],
                  ["F", "Pantalla completa"],
                  ["M", "Silenciar"],
                  ["N", "Siguiente clase"],
                ].map(([k, d]) => (
                  <div key={k} className="contents">
                    <dt>
                      <kbd className="rounded-full border border-white/15 bg-white/[0.06] px-2 py-0.5 font-mono text-xs text-ink">{k}</kbd>
                    </dt>
                    <dd className="text-muted">{d}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        ) : null}
      </div>

      {/* Barra de controles extra */}
      <div className={`flex items-center justify-end gap-1.5 ${theater ? "px-4 sm:px-0" : ""}`}>
        <div className="relative">
          <button onClick={() => setSpeedOpen((o) => !o)} className="chip h-8 cursor-pointer hover:text-ink" aria-haspopup="menu" aria-expanded={speedOpen}>
            <Gauge className="size-3.5" aria-hidden /> {speed}x
          </button>
          {speedOpen ? (
            <div role="menu" className="glass absolute bottom-10 right-0 z-20 flex gap-1 rounded-full bg-neutral-950/80 p-1.5 animate-pop">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  role="menuitemradio"
                  aria-checked={s === speed}
                  onClick={() => {
                    applySpeed(s);
                    setSpeedOpen(false);
                  }}
                  className={`rounded-full px-2.5 py-1.5 text-xs font-semibold tabular-nums transition ${s === speed ? "bg-white text-black" : "text-muted hover:bg-white/10 hover:text-ink"}`}
                >
                  {s}x
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <button onClick={() => setTheater((t) => !t)} className="chip h-8 cursor-pointer hover:text-ink" title="Modo cine (T)">
          {theater ? <Minimize2 className="size-3.5" aria-hidden /> : <Maximize2 className="size-3.5" aria-hidden />}
          {theater ? "Salir del modo cine" : "Modo cine"}
        </button>
        <button onClick={() => setHelp(true)} className="chip hidden h-8 cursor-pointer hover:text-ink sm:inline-flex" title="Atajos (?)">
          <Keyboard className="size-3.5" aria-hidden /> Atajos
        </button>
      </div>
    </div>
  );
}
