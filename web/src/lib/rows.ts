// Forma de las filas tal como vienen de Supabase (ver supabase/migrations).
export interface CourseRow {
  id: string;
  slug: string;
  title: string;
  title_es: string | null;
  cover_path: string | null;
  position: number;
}
export interface ModuleRow {
  id: string;
  course_id: string;
  position: number;
  title: string;
  title_es: string | null;
}
export interface LessonRow {
  id: string;
  course_id: string;
  module_id: string;
  position: number;
  title: string;
  title_es: string | null;
  kind: "video" | "texto" | "externo";
  duration_ms: number | null;
  thumbnail_path: string | null;
  accessible: boolean;
}
export interface VideoRow {
  lesson_id: string;
  status: string;
  provider: string | null;
  external_url: string | null;
  storage_path: string | null;
}
export interface ProgressRow {
  lesson_id: string;
  completed_at: string | null;
  position_s: number;
  updated_at: string;
}
