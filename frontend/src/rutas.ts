import type { Rol, Usuario } from "./lib/tipos";

export interface ItemMenu {
  a: string;
  texto: string;
  icono: string;
  roles: Rol[];
  responsable?: boolean; // también visible para quien es responsable de una actividad
}

const TODOS: Rol[] = ["Administrador", "Personal", "Docente", "Alumno"];

export const MENU: ItemMenu[] = [
  { a: "/", texto: "Inicio", icono: "inicio", roles: TODOS },
  { a: "/catalogo", texto: "Catálogo", icono: "catalogo", roles: ["Alumno"] },
  { a: "/mis-inscripciones", texto: "Mis inscripciones", icono: "inscripciones", roles: ["Alumno"] },
  { a: "/grupos", texto: "Mis grupos", icono: "grupos", roles: ["Docente"], responsable: true },
  { a: "/actividades", texto: "Actividades", icono: "actividades", roles: ["Administrador", "Personal"] },
  { a: "/periodos", texto: "Periodos", icono: "periodos", roles: ["Administrador", "Personal"] },
  { a: "/aulas", texto: "Aulas", icono: "aulas", roles: ["Administrador", "Personal"] },
  { a: "/usuarios", texto: "Usuarios", icono: "usuarios", roles: ["Administrador", "Personal"] },
  { a: "/parametros", texto: "Parámetros", icono: "parametros", roles: ["Administrador", "Personal"] },
  { a: "/bitacora", texto: "Bitácora", icono: "bitacora", roles: ["Administrador"] },
  { a: "/tareas", texto: "Tareas automáticas", icono: "tareas", roles: ["Administrador"] },
];

export function puedeVer(item: { roles: Rol[]; responsable?: boolean }, u: Usuario) {
  return item.roles.includes(u.rol) || (!!item.responsable && u.es_responsable);
}
