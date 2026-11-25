# SIGAE-Zenit

**Sistema de Gestión de Actividades Extra-Escolares** del Instituto Tecnológico de Pachuca.
Sustituye las hojas y carpetas de Servicios Extra-Escolares: periodos, actividades, cupos, inscripciones, asistencia, evidencias, acreditación del crédito y materiales.

Equipo Zenit: Carlos Márquez Corona, Ángel Gabriel Márquez Meneses, Iván Alejandro Hernández Portillo, Ricardo Ambriz Ríos e Iker Andoni Del Toro Mireles.

## Cómo está armado

| Parte | Tecnología | Dónde vive |
|---|---|---|
| Frontend | React + TypeScript (Vite) | `frontend/` → Vercel |
| Backend (API) | Python + FastAPI | `backend/` → Vercel |
| Base de datos | PostgreSQL (esquema privado `sigae`) | Supabase |
| Inicio de sesión | Supabase Auth | Supabase |
| Materiales | Supabase Storage (bucket privado `materiales`) | Supabase |
| Tareas automáticas | pg_cron (RF-008 cada minuto, RF-009 a las 00:05) | Supabase |

El navegador **nunca** habla directo con la base. Todo pasa por el backend, que actúa "como el usuario" para que la base aplique sus permisos (RLS) y sus reglas (cupo con bloqueo, acreditación automática, etc.).

## Roles

| Rol | Qué puede hacer |
|---|---|
| Alumno | Ver el catálogo, inscribirse, darse de baja, ver su avance y descargar materiales |
| Docente | Ver sus grupos, capturar asistencia y evidencia, subir materiales |
| Personal | Crear y editar actividades; consultar periodos, aulas, usuarios y parámetros |
| Administrador | Todo lo anterior, más periodos, aulas, usuarios, parámetros, bitácora y tareas |

Un alumno que es responsable de una actividad también ve "Mis grupos".

## Correr el proyecto en tu computadora

Necesitas **Python 3.11 o más nuevo**, **Node.js 20 o más nuevo** y las claves de Supabase (pídelas al equipo; nunca se suben a GitHub).

### 1. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # en Windows  (en Mac/Linux: source .venv/bin/activate)
pip install -r requirements.txt
copy .env.example .env          # en Mac/Linux: cp .env.example .env
```

Abre `backend/.env` y llena los valores (cada línea explica de dónde sale). Después:

```bash
uvicorn app.main:app --reload
```

Comprueba en el navegador: `http://localhost:8000/api/salud` debe decir `"base_de_datos": "conectada"`.
La documentación de todos los endpoints está en `http://localhost:8000/docs`.

### 2. Frontend (en otra terminal)

```bash
cd frontend
npm install
npm run dev
```

Abre `http://localhost:5173`. En desarrollo no hace falta `.env`: Vite manda `/api` al backend del puerto 8000.

### Cuentas de prueba

Usuarios ficticios con dominio `@sigae.test` (contraseña en el documento de la base de datos): `admin@`, `docente1@`, `docente2@`, `alumno1@` … `alumno5@`.

## Publicar en Vercel

Se crean **dos proyectos** en Vercel conectados a este repositorio:

1. **Backend** — *Root Directory*: `backend`. En *Environment Variables* pon las mismas de `.env`, pero en `DATABASE_URL` usa el **Transaction pooler** (puerto 6543) y en `CORS_ORIGINS` la dirección del frontend (por ejemplo `https://sigae.tudominio.com`). Dominio: `api.tudominio.com`.
2. **Frontend** — *Root Directory*: `frontend`, *Framework*: Vite. Variable `VITE_API_URL` = dirección del backend (por ejemplo `https://api.tudominio.com`). Dominio: `tudominio.com`.

## Forma de trabajo (Git)

Nunca se trabaja directo en `main` ni en `qa`.

1. Trae lo nuevo de `qa`.
2. Crea tu rama `feature/lo-que-haces` desde `qa`.
3. Commit y push seguido.
4. Pull request hacia `qa`. Cuando `qa` está probado, se junta a `main`.

## Lo que falta o hay que decidir

- **Respaldo externo** y **prueba de carga (RNF-004)**: pendientes.
- **Decisiones INC** por aprobar (INC-02, 03, 07, 09, 10, 12, 13 y 16), por ejemplo validar el 80 % de asistencia y los 5 MB con Servicios Extra-Escolares.
- **Documento SIGAE**: actualizarlo para que diga pg_cron (en lugar de APScheduler), Supabase Storage (en lugar de volumen local) y publicación en Vercel.
