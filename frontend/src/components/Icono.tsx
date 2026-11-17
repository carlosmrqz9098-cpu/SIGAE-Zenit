// Íconos de línea propios (sin librerías). Trazo de 1.8 px.
const RUTAS: Record<string, string> = {
  inicio: "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  catalogo: "M4 5h16M4 12h16M4 19h10",
  inscripciones: "M7 3h10a1 1 0 0 1 1 1v17l-6-3-6 3V4a1 1 0 0 1 1-1z",
  grupos: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 12 0v1M16 3.5a4 4 0 0 1 0 7.5M22 21v-1a6 6 0 0 0-4-5.6",
  actividades: "M4 4h16v16H4zM4 9h16M9 4v16",
  periodos: "M3 6h18v15H3zM3 10h18M8 3v5M16 3v5",
  aulas: "M3 21V8l9-5 9 5v13M9 21v-6h6v6",
  usuarios: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21v-1a8 8 0 0 1 16 0v1",
  parametros: "M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4",
  bitacora: "M5 3h11l3 3v15H5zM9 9h6M9 13h6M9 17h4",
  tareas: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  salir: "M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l5-5-5-5M15 12H3",
  buscar: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.5-4.5",
  mas: "M12 5v14M5 12h14",
  cerrar: "M6 6l12 12M18 6L6 18",
  descargar: "M12 4v11M7 10l5 5 5-5M5 20h14",
  subir: "M12 20V9M7 14l5-5 5 5M5 4h14",
  borrar: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  editar: "M4 20h4L19 9l-4-4L4 16zM14 6l4 4",
  archivo: "M6 3h8l4 4v14H6zM14 3v4h4",
  lugar: "M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  reloj: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  persona: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM5 21a7 7 0 0 1 14 0",
  check: "M5 12.5l4.5 4.5L19 7",
  menu: "M4 7h16M4 12h16M4 17h16",
  alerta: "M12 3l10 18H2zM12 10v5M12 18v.01",
  materiales: "M4 5a2 2 0 0 1 2-2h5l2 3h7a1 1 0 0 1 1 1v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z",
  bloquear: "M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4",
};

export function Icono({ nombre, tam = 20, className }: { nombre: string; tam?: number; className?: string }) {
  return (
    <svg
      width={tam}
      height={tam}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={RUTAS[nombre] ?? ""} />
    </svg>
  );
}
