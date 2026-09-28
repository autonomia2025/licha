export type LessonKind = "video" | "texto" | "externo";
export type VideoProvider = "skool-mux" | "loom" | "youtube" | "vimeo" | "other";

export interface Lesson {
  id: string;
  courseSlug: string;
  moduleId: string;
  /** Posición dentro del módulo (1..n) */
  position: number;
  /** Número correlativo dentro del curso (1..n), para mostrar "Clase 12" */
  number: number;
  title: string;
  originalTitle: string;
  kind: LessonKind;
  durationMs: number | null;
  thumbnailPath: string | null;
  /** El video ya está en nuestro almacenamiento y se puede reproducir */
  videoReady: boolean;
  provider: VideoProvider | null;
  externalUrl: string | null;
}

export interface Module {
  id: string;
  position: number;
  title: string;
  lessons: Lesson[];
}

export interface Course {
  id: string;
  slug: string;
  position: number;
  title: string;
  originalTitle: string;
  coverPath: string | null;
  modules: Module[];
  lessonCount: number;
  durationMs: number;
}

export interface LessonDetail {
  lesson: Lesson;
  course: Course;
  module: Module;
  bodyRaw: string | null;
  videoPath: string | null;
  subtitles: { language: string; label: string; path: string; isDefault: boolean }[];
  attachments: { title: string; fileName: string | null; url: string | null }[];
  prev: Lesson | null;
  next: Lesson | null;
}

export interface ProgressEntry {
  lessonId: string;
  completed: boolean;
  positionS: number;
  updatedAt: string;
}

export interface Viewer {
  email: string;
  name: string;
}

export interface Note {
  id: string;
  atS: number | null;
  body: string;
  createdAt: string;
}
