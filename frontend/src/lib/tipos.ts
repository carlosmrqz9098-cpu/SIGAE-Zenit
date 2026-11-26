export type Rol = "Administrador" | "Personal" | "Docente" | "Alumno";

export interface Usuario {
  id_usuario: number;
  nombre: string;
  correo: string;
  rol: Rol;
  matricula: string | null;
  sexo?: Sexo | null;
  es_responsable: boolean;
}

export type Sexo = "Hombre" | "Mujer";
export type DirigidaA = "Mixta" | "Varonil" | "Femenil";

export type EstadoActividad = "Borrador" | "Activa" | "Llena" | "Cerrada" | "Inactiva";
export type EstatusCredito = "Pendiente" | "Acreditado" | "No acreditado";

export interface ActividadCatalogo {
  id_actividad: number;
  nombre: string;
  descripcion: string | null;
  dias: string;
  hora_inicio: string;
  hora_fin: string;
  aula: string;
  ubicacion: string | null;
  responsable: string | null;
  cupo_maximo: number;
  inscritos: number;
  lugares_disponibles: number;
  estado: EstadoActividad;
  periodo_abierto: boolean;
  ya_inscrito: boolean;
  dirigida_a?: DirigidaA;
}

export interface MiInscripcion {
  id_inscripcion: number;
  id_actividad: number;
  actividad: string;
  dias: string;
  hora_inicio: string;
  hora_fin: string;
  aula: string;
  ubicacion: string | null;
  responsable: string | null;
  estado_inscripcion: "Activa" | "Cancelada" | "Evaluada";
  porcentaje_asistencia: number | null;
  evidencia_cumplida: boolean | null;
  estatus_credito: EstatusCredito | null;
  puede_darse_de_baja: boolean;
}

export interface Grupo {
  id_actividad: number;
  nombre: string;
  dias: string;
  hora_inicio: string;
  hora_fin: string;
  aula: string;
  estado: EstadoActividad;
  inscritos: number;
  cupo_maximo: number;
}
