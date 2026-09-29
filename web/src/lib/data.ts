import "server-only";
import { cache } from "react";
import { createClient, isDemo } from "./supabase/server";
import { demoBodies, demoCourses, demoLessons, demoModules, demoProgress, demoVideos } from "./demo";
import type { CourseRow, LessonRow, ModuleRow, ProgressRow, VideoRow } from "./rows";
import type { Course, Lesson, LessonDetail, Module, ProgressEntry, VideoProvider, Viewer } from "./types";

export { isDemo };

const BUCKET = "course-media";

// ------------------------------------------------------------------ sesión

export const getViewer = cache(async (): Promise<Viewer | null> => {
  if (isDemo) return { email: "alumno@estudiodelicha.demo", name: "Alumno" };
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user?.email) return null;
  const meta = data.user.user_metadata ?? {};
  const name = (meta.full_name || meta.name || data.user.email.split("@")[0]) as string;
  return { email: data.user.email, name: name.split(" ")[0] };
});

/** ¿El usuario está en la lista de alumnos activos? */
export const hasAccess = cache(async (): Promise<boolean> => {
  if (isDemo) return true;
  const supabase = await createClient();
  const { data } = await supabase.rpc("is_student");
  return data === true;
});

// ------------------------------------------------------------------ biblioteca

function buildLibrary(courses: CourseRow[], modules: ModuleRow[], lessons: LessonRow[], videos: VideoRow[]): Course[] {
  const videoBy = new Map(videos.map((v) => [v.lesson_id, v]));
  const out: Course[] = [];
  for (const c of [...courses].sort((a, b) => a.position - b.position)) {
    let number = 0;
    const mods: Module[] = modules
      .filter((m) => m.course_id === c.id)
      .sort((a, b) => a.position - b.position)
      .map((m) => ({
        id: m.id,
        position: m.position,
        title: m.title_es || m.title,
        lessons: lessons
          .filter((l) => l.module_id === m.id && l.accessible)
          .sort((a, b) => a.position - b.position)
          .map((l): Lesson => {
            const v = videoBy.get(l.id);
            return {
              id: l.id,
              courseSlug: c.slug,
              moduleId: m.id,
              position: l.position,
              number: 0,
              title: l.title_es || l.title,
              originalTitle: l.title,
              kind: l.kind,
              durationMs: l.duration_ms,
              thumbnailPath: l.thumbnail_path,
              videoReady: v?.status === "stored" && Boolean(v.storage_path),
              provider: (v?.provider as VideoProvider) ?? null,
              externalUrl: v?.external_url ?? null,
            };
          }),
      }))
      .filter((m) => m.lessons.length > 0);
    mods.forEach((m) => m.lessons.forEach((l) => (l.number = ++number)));
    if (!number) continue; // cursos sin lecciones accesibles no se muestran
    out.push({
      id: c.id,
      slug: c.slug,
      position: c.position,
      title: c.title_es || c.title,
      originalTitle: c.title,
      coverPath: c.cover_path,
      modules: mods,
      lessonCount: number,
      durationMs: mods.reduce((s, m) => s + m.lessons.reduce((t, l) => t + (l.durationMs ?? 0), 0), 0),
    });
  }
  return out;
}

export const getLibrary = cache(async (): Promise<Course[]> => {
  if (isDemo) return buildLibrary(demoCourses, demoModules, demoLessons, demoVideos);
  const supabase = await createClient();
  const [c, m, l, v] = await Promise.all([
    supabase.from("courses").select("id,slug,title,title_es,cover_path,position"),
    supabase.from("course_modules").select("id,course_id,position,title,title_es"),
    supabase.from("lessons").select("id,course_id,module_id,position,title,title_es,kind,duration_ms,thumbnail_path,accessible").limit(5000),
    supabase.from("lesson_videos").select("lesson_id,status,provider,external_url,storage_path").limit(5000),
  ]);
  const err = c.error || m.error || l.error || v.error;
  if (err) throw new Error(`No se pudo cargar el contenido: ${err.message}`);
  return buildLibrary(c.data as CourseRow[], m.data as ModuleRow[], l.data as LessonRow[], v.data as VideoRow[]);
});

export async function getCourse(slug: string): Promise<Course | null> {
  return (await getLibrary()).find((c) => c.slug === slug) ?? null;
}

export const allLessons = (course: Course) => course.modules.flatMap((m) => m.lessons);

export async function getLessonDetail(slug: string, lessonId: string): Promise<LessonDetail | null> {
  const course = await getCourse(slug);
  if (!course) return null;
  const list = allLessons(course);
  const i = list.findIndex((l) => l.id === lessonId);
  if (i < 0) return null;
  const lesson = list[i];
  const lessonModule = course.modules.find((m) => m.id === lesson.moduleId)!;

  if (isDemo) {
    const v = demoVideos.find((x) => x.lesson_id === lesson.id && x.status === "stored");
    return {
      lesson,
      course,
      module: lessonModule,
      bodyRaw: demoBodies[lesson.id] ?? null,
      videoPath: v?.storage_path ?? null,
      subtitles: v ? [{ language: "en", label: "English CC", path: "/demo/clase-demo.vtt", isDefault: false }] : [],
      attachments: [],
      prev: list[i - 1] ?? null,
      next: list[i + 1] ?? null,
    };
  }
  const supabase = await createClient();
  const [body, video, subs, files] = await Promise.all([
    supabase.from("lessons").select("body_raw").eq("id", lessonId).single(),
    supabase.from("lesson_videos").select("storage_path,status").eq("lesson_id", lessonId).maybeSingle(),
    supabase.from("lesson_subtitles").select("language,label,storage_path,is_default,status").eq("lesson_id", lessonId),
    supabase.from("lesson_attachments").select("title,file_name,external_url,storage_path,position").eq("lesson_id", lessonId).order("position"),
  ]);
  return {
    lesson,
    course,
    module: lessonModule,
    bodyRaw: body.data?.body_raw ?? null,
    videoPath: video.data?.status === "stored" ? video.data.storage_path : null,
    subtitles: (subs.data ?? [])
      .filter((s) => s.status === "stored" && s.storage_path)
      .map((s) => ({ language: s.language, label: s.label, path: s.storage_path!, isDefault: s.is_default })),
    attachments: (files.data ?? []).map((f) => ({ title: f.title ?? f.file_name ?? "Archivo", fileName: f.file_name, url: f.external_url })),
    prev: list[i - 1] ?? null,
    next: list[i + 1] ?? null,
  };
}

// ------------------------------------------------------------------ progreso

export const getProgress = cache(async (): Promise<Map<string, ProgressEntry>> => {
  let rows: ProgressRow[];
  if (isDemo) rows = demoProgress;
  else {
    const supabase = await createClient();
    const { data } = await supabase.from("lesson_progress").select("lesson_id,completed_at,position_s,updated_at");
    rows = (data ?? []) as ProgressRow[];
  }
  return new Map(rows.map((r) => [r.lesson_id, { lessonId: r.lesson_id, completed: Boolean(r.completed_at), positionS: r.position_s, updatedAt: r.updated_at }]));
});

export function courseProgress(course: Course, progress: Map<string, ProgressEntry>) {
  const done = allLessons(course).filter((l) => progress.get(l.id)?.completed).length;
  return { done, total: course.lessonCount, pct: course.lessonCount ? Math.round((done / course.lessonCount) * 100) : 0 };
}

/** Lección para "Continuar": la última vista sin terminar o, si no, la siguiente sin completar. */
export async function getContinue(): Promise<{ course: Course; lesson: Lesson; positionS: number } | null> {
  const [library, progress] = await Promise.all([getLibrary(), getProgress()]);
  const entries = [...progress.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  for (const e of entries) {
    for (const course of library) {
      const list = allLessons(course);
      const i = list.findIndex((l) => l.id === e.lessonId);
      if (i < 0) continue;
      if (!e.completed) return { course, lesson: list[i], positionS: e.positionS };
      const next = list.slice(i + 1).find((l) => !progress.get(l.id)?.completed);
      if (next) return { course, lesson: next, positionS: 0 };
    }
  }
  const first = library[0];
  return first ? { course: first, lesson: allLessons(first)[0], positionS: 0 } : null;
}

// ------------------------------------------------------------------ búsqueda

export async function searchLessons(q: string) {
  const term = q.trim().toLowerCase();
  if (term.length < 2) return [];
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  const t = norm(term);
  const library = await getLibrary();
  return library.flatMap((course) =>
    course.modules.flatMap((module) =>
      module.lessons.filter((l) => norm(l.title).includes(t) || norm(l.originalTitle).includes(t)).map((lesson) => ({ course, module, lesson })),
    ),
  );
}

// ------------------------------------------------------------------ archivos

/** URLs firmadas (1 h) para rutas del bucket privado. En demo devuelve un objeto vacío. */
export async function signPaths(paths: (string | null | undefined)[]): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter((p): p is string => Boolean(p)))];
  if (isDemo) return Object.fromEntries(unique.filter((p) => p.startsWith("/demo/")).map((p) => [p, p]));
  if (!unique.length) return {};
  const supabase = await createClient();
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(unique, 3600);
  return Object.fromEntries((data ?? []).flatMap((d) => (d.signedUrl && d.path ? [[d.path, d.signedUrl] as [string, string]] : [])));
}

// ------------------------------------------------------------------ notas

export async function getNotes(lessonId: string): Promise<import("./types").Note[]> {
  if (isDemo) {
    return lessonId === "c-start-m2-l3"
      ? [
          { id: "demo-1", atS: 95, body: "Los 5 niveles de conciencia: unaware → most aware. Adaptar el gancho a cada uno.", createdAt: "2026-09-27T21:00:00Z" },
          { id: "demo-2", atS: 312, body: "Probar un anuncio 'problem aware' para el producto nuevo.", createdAt: "2026-09-27T21:05:00Z" },
        ]
      : [];
  }
  const supabase = await createClient();
  const { data } = await supabase.from("lesson_notes").select("id,at_s,body,created_at").eq("lesson_id", lessonId).order("created_at");
  return (data ?? []).map((n) => ({ id: n.id, atS: n.at_s, body: n.body, createdAt: n.created_at }));
}
