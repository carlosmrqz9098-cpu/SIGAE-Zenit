"""Panel de inicio: indicadores reales según el rol (nada inventado)."""
from fastapi import APIRouter, Depends

from app.core.database import conexion_usuario
from app.core.seguridad import ADMIN, ALUMNO, DOCENTE, PERSONAL, UsuarioActual, get_usuario_actual

router = APIRouter(prefix="/api", tags=["Panel"])


@router.get("/panel", summary="Indicadores del panel de inicio")
def panel(u: UsuarioActual = Depends(get_usuario_actual)):
    with conexion_usuario(u.id_auth) as conn:
        periodo = conn.execute(
            """select nombre, estado::text as estado, fecha_hora_inicio, fecha_hora_fin
                 from sigae.periodo
                order by (estado = 'Activo') desc, (estado = 'Programado') desc, fecha_hora_inicio desc
                limit 1"""
        ).fetchone()
        datos: dict = {"periodo": periodo}

        if u.rol == ALUMNO:
            mis = conn.execute("select * from sigae.mis_inscripciones()").fetchall()
            disponibles = conn.execute(
                "select count(*) as n from sigae.catalogo(null) where lugares_disponibles > 0 and not ya_inscrito and periodo_abierto"
            ).fetchone()["n"]
            datos["indicadores"] = {
                "inscripciones_activas": sum(1 for i in mis if i["estado_inscripcion"] == "Activa"),
                "acreditadas": sum(1 for i in mis if i["estatus_credito"] == "Acreditado"),
                "pendientes": sum(1 for i in mis if i["estatus_credito"] in (None, "Pendiente") and i["estado_inscripcion"] != "Cancelada"),
                "actividades_disponibles": disponibles,
            }
            datos["proximas"] = [i for i in mis if i["estado_inscripcion"] != "Cancelada"][:5]

        if u.rol == DOCENTE or u.es_responsable:
            grupos = conn.execute("select * from sigae.mis_grupos()").fetchall()
            sin_evaluar = conn.execute(
                """select count(*) as n
                     from sigae.inscripcion i
                     join sigae.actividad a on a.id_actividad = i.id_actividad
                     left join sigae.avance_academico av on av.id_inscripcion = i.id_inscripcion
                    where a.id_responsable = sigae.id_usuario_actual()
                      and i.estado = 'Activa' and av.fecha_captura is null"""
            ).fetchone()["n"]
            datos["grupos"] = grupos
            datos["indicadores_docente"] = {
                "grupos": len(grupos),
                "alumnos": sum(g["inscritos"] for g in grupos),
                "sin_captura": sin_evaluar,
            }

        if u.rol in (ADMIN, PERSONAL):
            datos["indicadores"] = conn.execute(
                """select
                     (select count(*) from sigae.usuario where activo and rol = 'Alumno')  as alumnos,
                     (select count(*) from sigae.usuario where activo and rol = 'Docente') as docentes,
                     (select count(*) from sigae.actividad where estado in ('Activa', 'Llena')) as actividades_abiertas,
                     (select count(*) from sigae.actividad where estado = 'Borrador') as borradores,
                     (select count(*) from sigae.inscripcion where estado = 'Activa') as inscripciones_activas,
                     (select count(*) from sigae.avance_academico where estatus_credito = 'Acreditado') as acreditados"""
            ).fetchone()
            datos["actividades"] = conn.execute(
                """select a.id_actividad, a.nombre, a.estado::text as estado, a.cupo_maximo,
                          (select count(*) from sigae.inscripcion i
                            where i.id_actividad = a.id_actividad and i.estado = 'Activa') as inscritos
                     from sigae.actividad a
                     join sigae.periodo p on p.id_periodo = a.id_periodo
                    where a.estado <> 'Inactiva'
                    order by p.fecha_hora_inicio desc, a.nombre limit 8"""
            ).fetchall()
    return datos
