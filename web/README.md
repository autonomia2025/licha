# Evolve · Área de alumnos

App web (Next.js 16 + Supabase) para ver los cursos migrados desde Skool: todo en español, tema oscuro
con la marca Evolve, reproductor con subtítulos (CC), progreso por alumno y búsqueda.

## Pantallas

| Ruta | Qué muestra |
|---|---|
| `/ingresar` | Login con correo y contraseña; recuperar contraseña por correo |
| `/` | Saludo, **Continuar viendo**, estadísticas y tus cursos |
| `/cursos` | Biblioteca completa en el orden del programa |
| `/cursos/[curso]` | Portada, progreso y temario por módulos |
| `/cursos/[curso]/[clase]` | Video con CC (o Loom/YouTube/Vimeo, o lectura), descripción, recursos, temario lateral, anterior/siguiente, marcar como completada |
| `/buscar` | Búsqueda de clases en español o por título original |

Las clases cuyo video aún no se migró muestran **"Próximamente"** con su texto disponible, así la app se puede
publicar mientras los videos se suben por partes.

## Correr en local

```bash
npm install
npm run dev              # modo demo (sin .env.local)
cp .env.example .env.local && npm run dev   # conectado a Supabase
```

## Dar acceso a un alumno

1. Supabase → **Authentication → Users → Add user** (correo + contraseña, o "Send invitation").
2. Supabase → **SQL Editor**:
   ```sql
   insert into public.student_access (email, full_name) values ('alumno@correo.com', 'Nombre Apellido');
   ```
   Para quitar el acceso: `update public.student_access set active = false where email = 'alumno@correo.com';`

Quien inicie sesión sin estar en la lista ve "Tu cuenta aún no tiene acceso". Los videos y miniaturas están en un
bucket privado y solo se entregan con URLs firmadas de 1 hora a alumnos activos.

## Publicar (Vercel)

Importar el repositorio en Vercel con **Root Directory = `web`** y las dos variables de `.env.example`.
En Supabase → Authentication → URL Configuration, agregar la URL del sitio y `https://<sitio>/auth/confirmar`
como Redirect URL.
