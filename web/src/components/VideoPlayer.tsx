"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, RotateCcw } from "lucide-react";
import { saveProgress, setCompleted } from "@/app/actions";

interface Props {
  lessonId: string;
  src: string;
  poster?: string;
  subtitles: { src: string; language: string; label: string }[];
  startAt: number;
  path: string;
  next: { href: string; title: string } | null;
}

/** Reproductor nativo: subtítulos con el botón CC del navegador, reanuda donde quedaste y marca la clase al terminar. */
export function VideoPlayer({ lessonId, src, poster, subtitles, startAt, path, next }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const lastSaved = useRef(0);
  const [ended, setEnded] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const onMeta = () => {
      if (startAt > 5 && startAt < v.duration - 10) v.currentTime = startAt;
    };
    const onTime = () => {
      if (Math.abs(v.currentTime - lastSaved.current) >= 15) {
        lastSaved.current = v.currentTime;
        saveProgress(lessonId, v.currentTime).catch(() => {});
      }
    };
    const onPause = () => saveProgress(lessonId, v.currentTime).catch(() => {});
    const onEnded = () => {
      setEnded(true);
      setCompleted(lessonId, true, path).then(() => router.refresh()).catch(() => {});
    };
    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("pause", onPause);
    v.addEventListener("ended", onEnded);
    return () => {
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("ended", onEnded);
    };
  }, [lessonId, startAt, path, router]);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-black shadow-2xl ring-1 ring-line">
      <video ref={ref} className="aspect-video w-full bg-black" controls playsInline preload="metadata" poster={poster} crossOrigin="anonymous" controlsList="nodownload">
        <source src={src} type="video/mp4" />
        {subtitles.map((s) => (
          <track key={s.language} kind="subtitles" src={s.src} srcLang={s.language} label={s.language === "en" ? "English" : s.label} />
        ))}
        Tu navegador no puede reproducir este video.
      </video>
      {ended ? (
        <div className="absolute inset-0 grid place-items-center bg-black/80 p-6 backdrop-blur-sm animate-fade-up">
          <div className="max-w-sm text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-success">¡Clase completada!</p>
            {next ? (
              <>
                <p className="mt-3 text-sm text-muted">Siguiente clase</p>
                <p className="mt-1 text-lg font-semibold">{next.title}</p>
                <Link href={next.href} className="btn btn-primary mt-6">
                  Continuar <ArrowRight className="size-4" aria-hidden />
                </Link>
              </>
            ) : (
              <p className="mt-3 text-lg font-semibold">Terminaste el curso 🎉</p>
            )}
            <button
              onClick={() => {
                setEnded(false);
                if (ref.current) {
                  ref.current.currentTime = 0;
                  ref.current.play();
                }
              }}
              className="mx-auto mt-4 flex items-center gap-1.5 text-sm text-muted hover:text-ink"
            >
              <RotateCcw className="size-3.5" aria-hidden /> Ver de nuevo
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
