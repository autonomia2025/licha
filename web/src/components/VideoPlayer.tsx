"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Captions,
  CaptionsOff,
  Keyboard,
  Loader2,
  Maximize,
  Minimize,
  Pause,
  Play,
  RectangleHorizontal,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { saveProgress, setCompleted } from "@/app/actions";
import { formatClock } from "@/lib/format";
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
const CC_KEY = "evolve:subtitulos";
const VOL_KEY = "evolve:volumen";
const AUTOPLAY_SECONDS = 8;
const HIDE_AFTER_MS = 2600;

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));

/** Muestra u oculta la primera pista de subtítulos. Devuelve false si no hay pista. */
function setTrackMode(v: HTMLVideoElement | null, on: boolean) {
  const track = v?.textTracks[0];
  if (!track) return false;
  track.mode = on ? "showing" : "hidden";
  return true;
}

/** Sube los subtítulos cuando la barra de controles está visible, para que no queden tapados. */
function liftCues(v: HTMLVideoElement | null, lifted: boolean) {
  const cues = v?.textTracks[0]?.cues;
  if (!cues) return;
  for (let i = 0; i < cues.length; i++) {
    const c = cues[i] as VTTCue;
    c.snapToLines = true;
    c.line = lifted ? -4 : -2;
  }
}

const clock = (s: number) => formatClock(Math.max(0, s) * 1000) || "0:00";

/**
 * Reproductor con controles propios de vidrio: barra de progreso con vista previa del minuto,
 * volumen, subtítulos (CC), velocidad recordada, modo cine, pantalla completa y atajos de teclado.
 * Reanuda donde quedaste, marca la clase al terminar y pasa sola a la siguiente.
 */
export function VideoPlayer({ lessonId, src, poster, subtitles, startAt, path, next }: Props) {
  const { videoRef, setTime, setHasVideo, theater, setTheater } = usePlayer();
  const shell = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const lastSaved = useRef(0);
  const hideTimer = useRef<number | undefined>(undefined);
  const toastTimer = useRef<number | undefined>(undefined);
  const router = useRouter();

  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [cc, setCc] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [speedOpen, setSpeedOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [idle, setIdle] = useState(false);
  const [hover, setHover] = useState<{ x: number; t: number } | null>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const [ended, setEnded] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [help, setHelp] = useState(false);
  const [toast, setToast] = useState<{ text: string; id: number } | null>(null);

  const flash = (text: string) => {
    setToast({ text, id: Date.now() });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 900);
  };

  // Los controles se ocultan solos mientras el video corre y el mouse está quieto.
  const wake = useCallback(() => {
    setIdle(false);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setIdle(true), HIDE_AFTER_MS);
  }, []);

  const store = (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {}
  };

  const applySpeed = (s: number) => {
    if (videoRef.current) videoRef.current.playbackRate = s;
    store(SPEED_KEY, String(s));
  };

  const setCaptions = (on: boolean) => {
    if (!setTrackMode(videoRef.current, on)) return;
    setCc(on);
    store(CC_KEY, on ? "1" : "0");
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  };

  const skip = (d: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration || Infinity, v.currentTime + d));
    flash(`${d > 0 ? "+" : "−"}${Math.abs(d)} s`);
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else shell.current?.requestFullscreen?.().catch(() => videoRef.current?.requestFullscreen?.());
  };

  const timeAt = (clientX: number) => {
    const r = bar.current?.getBoundingClientRect();
    if (!r || !duration) return { x: 0, t: 0 };
    const x = Math.max(0, Math.min(r.width, clientX - r.left));
    return { x, t: (x / r.width) * duration };
  };

  // Eventos del video
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    setHasVideo(true);
    try {
      const saved = Number(localStorage.getItem(SPEED_KEY));
      if (SPEEDS.includes(saved)) v.playbackRate = saved;
      const vol = localStorage.getItem(VOL_KEY);
      if (vol !== null) v.volume = Math.min(1, Math.max(0, Number(vol)));
    } catch {}
    const onMeta = () => {
      setDuration(v.duration || 0);
      if (startAt > 5 && startAt < v.duration - 10) v.currentTime = startAt;
      // Subtítulos: recordados; activados por defecto.
      let wantCc = true;
      try {
        wantCc = localStorage.getItem(CC_KEY) !== "0";
      } catch {}
      const track = v.textTracks[0];
      if (track) {
        track.mode = wantCc ? "showing" : "hidden";
        setCc(wantCc);
      }
    };
    let raf = 0;
    const onTime = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setTime(v.currentTime);
        setCurrent(v.currentTime);
      });
      if (Math.abs(v.currentTime - lastSaved.current) >= 15) {
        lastSaved.current = v.currentTime;
        saveProgress(lessonId, v.currentTime).catch(() => {});
      }
    };
    const onProgress = () => {
      if (v.buffered.length && v.duration) setBuffered(v.buffered.end(v.buffered.length - 1) / v.duration);
    };
    const onPlay = () => {
      setPlaying(true);
      setStarted(true);
      setEnded(false);
    };
    const onPause = () => {
      setPlaying(false);
      saveProgress(lessonId, v.currentTime).catch(() => {});
    };
    const onEnded = () => {
      setPlaying(false);
      setEnded(true);
      if (next) setCountdown(AUTOPLAY_SECONDS);
      setCompleted(lessonId, true, path).then(() => router.refresh()).catch(() => {});
    };
    const onRate = () => setSpeed(v.playbackRate);
    const onVolume = () => {
      setVolume(v.volume);
      setMuted(v.muted);
    };
    const onWaiting = () => setWaiting(true);
    const onPlaying = () => setWaiting(false);
    const handlers: [string, () => void][] = [
      ["loadedmetadata", onMeta],
      ["durationchange", () => setDuration(v.duration || 0)],
      ["timeupdate", onTime],
      ["progress", onProgress],
      ["play", onPlay],
      ["pause", onPause],
      ["ended", onEnded],
      ["ratechange", onRate],
      ["volumechange", onVolume],
      ["waiting", onWaiting],
      ["playing", onPlaying],
      ["canplay", onPlaying],
    ];
    for (const [e, h] of handlers) v.addEventListener(e, h);
    if (v.readyState >= 1) onMeta();
    onRate();
    onVolume();
    return () => {
      cancelAnimationFrame(raf);
      for (const [e, h] of handlers) v.removeEventListener(e, h);
      setHasVideo(false);
    };
  }, [lessonId, startAt, path, router, next, videoRef, setTime, setHasVideo]);

  useEffect(() => {
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  useEffect(() => () => window.clearTimeout(hideTimer.current), []);

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
        togglePlay();
      } else if (k === "arrowleft" || k === "j") {
        e.preventDefault();
        skip(k === "j" ? -10 : -5);
      } else if (k === "arrowright" || k === "l") {
        e.preventDefault();
        skip(k === "l" ? 10 : 5);
      } else if (k === "c") {
        const on = v.textTracks[0]?.mode !== "showing";
        setCaptions(on);
        flash(on ? "Subtítulos activados" : "Subtítulos desactivados");
      } else if (k === "m") {
        v.muted = !v.muted;
        flash(v.muted ? "Silenciado" : "Sonido activado");
      } else if (k === "f") {
        toggleFullscreen();
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
      } else return;
      wake();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [next, router, setTheater, videoRef]);

  // Arrastrar en la barra de progreso
  useEffect(() => {
    if (!scrubbing) return;
    const move = (e: PointerEvent) => {
      const { x, t } = timeAt(e.clientX);
      setHover({ x, t });
      setCurrent(t);
    };
    const up = (e: PointerEvent) => {
      const { t } = timeAt(e.clientX);
      if (videoRef.current) videoRef.current.currentTime = t;
      setScrubbing(false);
      setHover(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrubbing]);

  const pct = duration ? (current / duration) * 100 : 0;
  const showControls = !playing || !idle || speedOpen || scrubbing;

  useEffect(() => {
    liftCues(videoRef.current, showControls);
  }, [showControls, cc, duration, videoRef]);
  const iconBtn =
    "grid size-9 place-items-center rounded-full text-white/85 transition duration-200 hover:bg-white/15 hover:text-white active:scale-90";

  return (
    <div
      ref={shell}
      onPointerMove={wake}
      onPointerLeave={() => playing && setIdle(true)}
      className={`group/player relative isolate overflow-hidden bg-black ring-1 ring-white/10 transition-[border-radius] duration-500 ${
        fullscreen ? "grid place-items-center" : theater ? "sm:rounded-2xl" : "rounded-3xl shadow-[0_40px_100px_-30px_#000]"
      } ${showControls ? "" : "cursor-none"}`}
    >
      <video
        ref={videoRef}
        onClick={() => {
          togglePlay();
          setSpeedOpen(false);
        }}
        onDoubleClick={toggleFullscreen}
        className={`w-full bg-black ${fullscreen ? "max-h-screen" : "aspect-video"} ${theater && !fullscreen ? "max-h-[78vh]" : ""}`}
        playsInline
        preload="metadata"
        poster={poster}
        crossOrigin="anonymous"
      >
        <source src={src} type="video/mp4" />
        {subtitles.map((s) => (
          <track key={s.language} kind="subtitles" src={s.src} srcLang={s.language} label={s.language === "en" ? "English" : s.label} />
        ))}
        Tu navegador no puede reproducir este video.
      </video>

      {/* Botón central */}
      {!playing && !ended ? (
        <button
          onClick={togglePlay}
          aria-label="Reproducir"
          className="absolute left-1/2 top-1/2 grid size-20 -translate-x-1/2 -translate-y-1/2 animate-pop place-items-center rounded-full border border-white/25 bg-white/10 text-white shadow-[inset_0_1px_0_#ffffff40,0_20px_60px_-10px_#000] backdrop-blur-xl transition duration-500 [transition-timing-function:var(--ease-spring)] hover:scale-110 hover:bg-white hover:text-black sm:size-24"
        >
          {!started ? <span className="absolute inset-0 animate-ping rounded-full border border-white/30 [animation-duration:2.4s]" aria-hidden /> : null}
          <Play className="ml-1 size-8 fill-current" aria-hidden />
        </button>
      ) : null}

      {waiting && playing ? (
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <Loader2 className="size-10 animate-spin text-white/80" aria-label="Cargando" />
        </div>
      ) : null}

      {toast ? (
        <div
          key={toast.id}
          className="pointer-events-none absolute left-1/2 top-6 -translate-x-1/2 rounded-full border border-white/15 bg-black/50 px-4 py-1.5 text-sm font-medium text-white backdrop-blur-xl animate-pop"
        >
          {toast.text}
        </div>
      ) : null}

      {/* Controles */}
      <div
        className={`absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-3 pb-2.5 pt-16 transition duration-500 [transition-timing-function:var(--ease-out-expo)] sm:px-4 ${
          showControls ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
        }`}
      >
        {/* Barra de progreso */}
        <div
          ref={bar}
          role="slider"
          aria-label="Progreso del video"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(current)}
          aria-valuetext={`${clock(current)} de ${clock(duration)}`}
          className="group/bar relative flex h-5 cursor-pointer touch-none items-center"
          onPointerMove={(e) => !scrubbing && setHover(timeAt(e.clientX))}
          onPointerLeave={() => !scrubbing && setHover(null)}
          onPointerDown={(e) => {
            e.preventDefault();
            const { x, t } = timeAt(e.clientX);
            setHover({ x, t });
            setCurrent(t);
            setScrubbing(true);
          }}
        >
          <div className={`relative w-full overflow-hidden rounded-full bg-white/20 transition-[height] duration-200 ${scrubbing ? "h-1.5" : "h-1 group-hover/bar:h-1.5"}`}>
            <div className="absolute inset-y-0 left-0 bg-white/30 transition-[width] duration-500" style={{ width: `${buffered * 100}%` }} />
            {hover ? <div className="absolute inset-y-0 left-0 bg-white/25" style={{ width: hover.x }} /> : null}
            <div className="absolute inset-y-0 left-0 rounded-full bg-white shadow-[0_0_12px_#fff]" style={{ width: `${pct}%` }} />
          </div>
          <span
            className={`absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_0_4px_#ffffff33] transition-transform duration-200 ${scrubbing ? "scale-100" : "scale-0 group-hover/bar:scale-100"}`}
            style={{ left: `${pct}%` }}
            aria-hidden
          />
          {hover ? (
            <span
              className="pointer-events-none absolute -top-8 -translate-x-1/2 rounded-full border border-white/15 bg-black/70 px-2 py-0.5 font-mono text-[11px] text-white backdrop-blur-md"
              style={{ left: hover.x }}
            >
              {clock(hover.t)}
            </span>
          ) : null}
        </div>

        <div className="mt-1 flex items-center gap-0.5 sm:gap-1">
          <button onClick={togglePlay} aria-label={playing ? "Pausar" : "Reproducir"} className={iconBtn}>
            {playing ? <Pause className="size-[18px] fill-current" /> : <Play className="ml-0.5 size-[18px] fill-current" />}
          </button>
          <button onClick={() => skip(-10)} aria-label="Retroceder 10 segundos" className={`${iconBtn} hidden sm:grid`}>
            <RotateCcw className="size-[17px]" />
          </button>
          <button onClick={() => skip(10)} aria-label="Avanzar 10 segundos" className={`${iconBtn} hidden sm:grid`}>
            <RotateCw className="size-[17px]" />
          </button>

          <div className="group/vol flex items-center">
            <button
              onClick={() => {
                if (videoRef.current) videoRef.current.muted = !videoRef.current.muted;
              }}
              aria-label={muted ? "Activar sonido" : "Silenciar"}
              className={iconBtn}
            >
              {muted || volume === 0 ? <VolumeX className="size-[18px]" /> : <Volume2 className="size-[18px]" />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              aria-label="Volumen"
              onChange={(e) => {
                const v = videoRef.current;
                if (!v) return;
                v.volume = Number(e.target.value);
                v.muted = v.volume === 0;
                store(VOL_KEY, e.target.value);
              }}
              className="range-glass hidden w-0 opacity-0 transition-all duration-300 group-hover/vol:w-20 group-hover/vol:opacity-100 focus-visible:w-20 focus-visible:opacity-100 sm:block"
              style={{ ["--fill" as string]: `${(muted ? 0 : volume) * 100}%` }}
            />
          </div>

          <span className="ml-2 font-mono text-xs tabular-nums text-white/80">
            {clock(current)} <span className="text-white/40">/ {clock(duration)}</span>
          </span>

          <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
            {subtitles.length ? (
              <button onClick={() => setCaptions(!cc)} aria-label={cc ? "Ocultar subtítulos" : "Mostrar subtítulos"} aria-pressed={cc} className={`${iconBtn} relative`}>
                {cc ? <Captions className="size-[18px]" /> : <CaptionsOff className="size-[18px] opacity-70" />}
                {cc ? <span className="absolute bottom-1 left-1/2 h-0.5 w-3.5 -translate-x-1/2 rounded-full bg-white" aria-hidden /> : null}
              </button>
            ) : null}

            <div className="relative">
              <button
                onClick={() => setSpeedOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={speedOpen}
                aria-label="Velocidad"
                className="h-9 min-w-12 rounded-full px-2.5 font-mono text-xs font-semibold tabular-nums text-white/85 transition duration-200 hover:bg-white/15 hover:text-white active:scale-90"
              >
                {speed}x
              </button>
              {speedOpen ? (
                <div role="menu" className="absolute bottom-12 right-0 flex origin-bottom-right animate-pop flex-col gap-0.5 rounded-2xl border border-white/15 bg-black/70 p-1.5 shadow-2xl backdrop-blur-2xl">
                  {[...SPEEDS].reverse().map((s) => (
                    <button
                      key={s}
                      role="menuitemradio"
                      aria-checked={s === speed}
                      onClick={() => {
                        applySpeed(s);
                        setSpeedOpen(false);
                      }}
                      className={`rounded-xl px-4 py-1.5 text-left font-mono text-xs font-semibold tabular-nums transition ${s === speed ? "bg-white text-black" : "text-white/75 hover:bg-white/10 hover:text-white"}`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <button onClick={() => setHelp(true)} aria-label="Atajos de teclado" className={`${iconBtn} hidden sm:grid`}>
              <Keyboard className="size-[18px]" />
            </button>
            {!fullscreen ? (
              <button onClick={() => setTheater((t) => !t)} aria-label={theater ? "Salir del modo cine" : "Modo cine"} aria-pressed={theater} className={`${iconBtn} hidden lg:grid`}>
                <RectangleHorizontal className={`size-[18px] transition-transform duration-300 ${theater ? "scale-x-125" : ""}`} />
              </button>
            ) : null}
            <button onClick={toggleFullscreen} aria-label={fullscreen ? "Salir de pantalla completa" : "Pantalla completa"} className={iconBtn}>
              {fullscreen ? <Minimize className="size-[18px]" /> : <Maximize className="size-[18px]" />}
            </button>
          </div>
        </div>
      </div>

      {ended ? (
        <div className="absolute inset-0 z-20 grid place-items-center bg-black/60 p-6 backdrop-blur-2xl animate-fade">
          <div className="max-w-sm animate-fade-up text-center">
            <p className="serif text-4xl text-white">¡Clase completada!</p>
            {next ? (
              <>
                <p className="mt-3 text-sm text-muted">Siguiente clase{countdown !== null ? ` en ${countdown} s` : ""}</p>
                <p className="mt-1 text-lg font-semibold tracking-[-0.01em]">{next.title}</p>
                {countdown !== null ? (
                  <div className="mx-auto mt-4 h-1 w-48 overflow-hidden rounded-full bg-white/15">
                    <div className="h-full bg-white transition-[width] duration-1000 ease-linear" style={{ width: `${(countdown / AUTOPLAY_SECONDS) * 100}%` }} />
                  </div>
                ) : null}
                <div className="mt-6 flex items-center justify-center gap-2">
                  <Link href={next.href} className="btn btn-primary group/cta">
                    Continuar <ArrowRight className="size-4 transition-transform duration-300 group-hover/cta:translate-x-0.5" aria-hidden />
                  </Link>
                  {countdown !== null ? (
                    <button onClick={() => setCountdown(null)} className="btn btn-ghost">
                      <X className="size-4" aria-hidden /> Quedarme
                    </button>
                  ) : null}
                </div>
              </>
            ) : (
              <p className="display mt-3 text-3xl">
                Terminaste el <em>curso</em>
              </p>
            )}
            <button
              onClick={() => {
                setEnded(false);
                setCountdown(null);
                if (videoRef.current) {
                  videoRef.current.currentTime = 0;
                  videoRef.current.play().catch(() => {});
                }
              }}
              className="mx-auto mt-4 flex items-center gap-1.5 text-sm text-muted transition hover:text-ink"
            >
              <RotateCcw className="size-3.5" aria-hidden /> Ver de nuevo
            </button>
          </div>
        </div>
      ) : null}

      {help ? (
        <div className="absolute inset-0 z-20 grid place-items-center bg-black/60 p-6 backdrop-blur-2xl animate-fade" onClick={() => setHelp(false)}>
          <div className="w-full max-w-md animate-pop" onClick={(e) => e.stopPropagation()}>
            <p className="serif mb-5 text-3xl text-white">Atajos de teclado</p>
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
            <button onClick={() => setHelp(false)} className="btn btn-ghost mt-6 h-9 text-sm">
              Cerrar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
