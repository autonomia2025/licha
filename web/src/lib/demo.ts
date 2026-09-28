// Datos de ejemplo para el modo demo (sin Supabase). Reproducen la forma real de las tablas
// con títulos del curso Evolve ya traducidos. Ningún archivo de video: se muestran como "Próximamente".
import type { CourseRow, LessonRow, ModuleRow, VideoRow } from "./rows";

const tiptap = (...paras: string[]) =>
  "[v2]" +
  JSON.stringify(
    paras.map((p) =>
      p.startsWith("# ")
        ? { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: p.slice(2) }] }
        : { type: "paragraph", content: [{ type: "text", text: p }] },
    ),
  );

type L = [title: string, titleEs: string, minutes: number, kind?: LessonRow["kind"]];

const plan: {
  id: string;
  slug: string;
  title: string;
  titleEs: string;
  modules: { title: string; titleEs: string; lessons: L[] }[];
}[] = [
  {
    id: "c-start",
    slug: "fc758841",
    title: "👣 Evolve (Start Here)",
    titleEs: "👣 Evolve (Empieza aquí)",
    modules: [
      {
        title: "👋 Start Here",
        titleEs: "👋 Empieza aquí",
        lessons: [
          ["🆕 Start Here: Overview Of Evolve", "🆕 Empieza aquí: visión general de Evolve", 12],
          ["🆕 Win The $100k/Day Award", "🆕 Gana el premio de $100k/día", 1],
          ["90 Seconds Tip to Hit $1m/Month", "Consejo de 90 segundos para llegar a $1M/mes", 1.5],
          ["📌 100+ Winning Ads Document", "📌 Documento con +100 anuncios ganadores", 6],
          ["📌 100+ Hook Templates (From Ads Doc)", "📌 +100 plantillas de ganchos", 4],
          ["📌 13 Winning Static Ad Templates", "📌 13 plantillas de anuncios estáticos ganadores", 5],
          ["📌 Evolve Master Prompt Doc", "📌 Documento de prompts maestros de Evolve", 0, "texto"],
        ],
      },
      {
        title: "🧠 Why Ads Work (Psychology)",
        titleEs: "🧠 Por qué funcionan los anuncios (Psicología)",
        lessons: [
          ["Overview Of Psychology", "Introducción a la psicología", 4],
          ["Market Desires", "Deseos del mercado", 18],
          ["Market Awareness", "Nivel de conciencia del mercado", 19],
          ["Understanding Unaware + Awareness Levels", "Entender los niveles de conciencia", 8],
          ["Market Sophistication", "Sofisticación del mercado", 21],
          ["💥 Action Item: Practicing The Core 3", "💥 Tarea: practica los 3 pilares", 6],
          ["Rule Of 1 - 1 Desire, Avatar, Message", "Regla del 1: un deseo, un avatar, un mensaje", 9],
          ["Market Identification", "Identificación del mercado", 11],
          ["Market Belief", "Creencias del mercado", 10],
        ],
      },
      {
        title: "🔍 What Ads To Make (Research)",
        titleEs: "🔍 Qué anuncios hacer (Investigación)",
        lessons: [
          ["Overview & Self Onboarding", "Introducción y autoevaluación", 7],
          ["💥 Action Item: Self Onboarding", "💥 Tarea: autoevaluación", 0, "texto"],
          ["Getting Ready To Do Research - Part 1", "Prepararse para investigar · Parte 1", 14],
          ["Getting Ready To Do Research - Part 2", "Prepararse para investigar · Parte 2", 16],
          ["Mining Reviews For Angles", "Extraer ángulos de las reseñas", 22],
        ],
      },
      {
        title: "🏃‍♂️ How To Run Ads (Testing)",
        titleEs: "🏃‍♂️ Cómo lanzar anuncios (Testing)",
        lessons: [
          ["Testing Framework Overview", "Marco de testing", 15],
          ["How To Duplicate Ads Into Champions (NEW WAY)", "Cómo duplicar anuncios campeones (nuevo método)", 9, "externo"],
          ["Reading Your Numbers", "Cómo leer tus métricas", 17],
        ],
      },
    ],
  },
  {
    id: "c-copy",
    slug: "9917539c",
    title: "✍️ Evolve Copywriting (NEW)",
    titleEs: "✍️ Copywriting Evolve (nuevo)",
    modules: [
      {
        title: "⚖️ Copywriting Principles",
        titleEs: "⚖️ Principios de copywriting",
        lessons: [
          ["Why Copy Matters", "Por qué importa el copy", 11],
          ["The Big Idea", "La gran idea", 14],
          ["Why you need to write facts", "Por qué debes escribir hechos", 9],
        ],
      },
      {
        title: "🔜 Live Ad Creation",
        titleEs: "🔜 Creación de anuncios en vivo",
        lessons: [
          ["How To Write Video Ads - Part 1", "Cómo escribir anuncios en video · Parte 1", 24],
          ["How To Write Video Ads - Part 2", "Cómo escribir anuncios en video · Parte 2", 27],
        ],
      },
    ],
  },
  {
    id: "c-origins",
    slug: "0d8aaebd",
    title: "Origins Program ($0-$100k/month)",
    titleEs: "Programa Origins ($0 a $100k/mes)",
    modules: [
      {
        title: "🛡️ How To Set Up FB Assets",
        titleEs: "🛡️ Cómo configurar tus activos de Facebook",
        lessons: [
          ["FB Asset Structure to Prevent Getting Rekt", "Estructura de activos para evitar bloqueos", 8, "externo"],
          ["Set Up & Warm Up Your FB Profile", "Configura y calienta tu perfil de Facebook", 0.7],
          ["(Optional) Verify your Business Manager", "(Opcional) Verifica tu Business Manager", 6, "externo"],
        ],
      },
    ],
  },
  { id: "c-finance", slug: "cf68fcb8", title: "💸 Evolve Finance", titleEs: "💸 Finanzas Evolve", modules: [{ title: "Finance Basics", titleEs: "Finanzas básicas", lessons: [["Profit First", "Primero la utilidad", 13], ["Cash Flow", "Flujo de caja", 16]] }] },
  { id: "c-q4", slug: "8327c8c9", title: "💰 Evolve Q4 (2026)", titleEs: "💰 Evolve Q4 (2026)", modules: [{ title: "🏷️ Q4 CRO Sales Optimizations", titleEs: "🏷️ Optimizaciones de conversión para Q4", lessons: [["Overview Of This Section", "Introducción a la sección", 4, "externo"], ["Discount Types Overview", "Tipos de descuento", 7, "externo"]] }] },
  { id: "c-supply", slug: "992407ee", title: "📦 Evolve Supply Chain Program", titleEs: "📦 Programa de cadena de suministro", modules: [{ title: "Supply Chain", titleEs: "Cadena de suministro", lessons: [["Finding Suppliers", "Encontrar proveedores", 19], ["Negotiating MOQs", "Negociar pedidos mínimos", 15]] }] },
  { id: "c-archive", slug: "6619b66c", title: "Evolve - Archive", titleEs: "Evolve · Archivo", modules: [{ title: "📝 How To Make Ads (Old)", titleEs: "📝 Cómo hacer anuncios (anterior)", lessons: [["Additional Resources For Editors", "Recursos adicionales para editores", 1.4]] }, { title: "👣 Random Evolve Modules", titleEs: "👣 Módulos variados", lessons: [["How To Translate Text Accurately", "Cómo traducir textos con precisión", 0.9]] }] },
  { id: "c-podcast", slug: "02e27f05", title: "$100k/Day Podcast", titleEs: "Podcast $100k/día", modules: [{ title: "Podcast", titleEs: "Podcast", lessons: [["Episode 1", "Episodio 1", 48]] }] },
];

export const demoCourses: CourseRow[] = [];
export const demoModules: ModuleRow[] = [];
export const demoLessons: LessonRow[] = [];
export const demoVideos: VideoRow[] = [];
export const demoBodies: Record<string, string> = {};

plan.forEach((c, ci) => {
  demoCourses.push({ id: c.id, slug: c.slug, title: c.title, title_es: c.titleEs, cover_path: null, position: ci + 1 });
  c.modules.forEach((m, mi) => {
    const moduleId = `${c.id}-m${mi + 1}`;
    demoModules.push({ id: moduleId, course_id: c.id, position: mi + 1, title: m.title, title_es: m.titleEs });
    m.lessons.forEach(([title, titleEs, minutes, kind = "video"], li) => {
      const id = `${moduleId}-l${li + 1}`;
      demoLessons.push({
        id,
        course_id: c.id,
        module_id: moduleId,
        position: li + 1,
        title,
        title_es: titleEs,
        kind,
        duration_ms: minutes ? Math.round(minutes * 60000) : null,
        thumbnail_path: null,
        accessible: true,
      });
      if (kind === "video") demoVideos.push({ lesson_id: id, status: "discovered", provider: "skool-mux", external_url: null, storage_path: null });
      if (kind === "externo") demoVideos.push({ lesson_id: id, status: "skipped", provider: "loom", external_url: null, storage_path: null });
    });
  });
});

demoBodies["c-start-m2-l4"] = tiptap(
  "# Prompts",
  "Leveraging the information from the market awareness section of Eugene Schwartz's breakthrough advertising, please provide a headline to sell a YOUR PRODUCT + YOUR ANGLE for each level of awareness.",
  "# Prompt para corregir",
  "It looks like you made a mistake: the unaware headline: INSERT UNAWARE HEADLINE. That is not unaware, it is problem aware because you are mentioning the X problem.",
);
demoBodies["c-start-m1-l2"] = tiptap(
  "Escala a $100k/día, publícalo en #Wins en Discord y recibe tu placa.",
  "Ganadores de $100k/día desde Marrakech.",
);

/** Progreso de ejemplo: primer módulo completo y la clase 2.3 a medias. */
export const demoProgress = [
  ...demoLessons.filter((l) => l.module_id === "c-start-m1").map((l) => ({ lesson_id: l.id, completed_at: "2026-09-20T10:00:00Z", position_s: 0, updated_at: "2026-09-20T10:00:00Z" })),
  { lesson_id: "c-start-m2-l1", completed_at: "2026-09-22T10:00:00Z", position_s: 0, updated_at: "2026-09-22T10:00:00Z" },
  { lesson_id: "c-start-m2-l2", completed_at: "2026-09-23T10:00:00Z", position_s: 0, updated_at: "2026-09-23T10:00:00Z" },
  { lesson_id: "c-start-m2-l3", completed_at: null, position_s: 312, updated_at: "2026-09-27T21:00:00Z" },
];
