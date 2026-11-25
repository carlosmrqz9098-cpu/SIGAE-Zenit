"""Grupos: lista de participantes y captura de asistencia y evidencia.

El docente (o el responsable de la actividad) solo captura métricas. El estatus
del crédito (Acreditado / No acreditado / Pendiente) lo calcula la base de
datos; nadie lo puede escribir a mano.
"""
import json

from fastapi import APIRouter, Depends

from app.core.database import conexion_usuario
from app.core.errores import ErrorSIGAE
from app.core.seguridad import UsuarioActual, get_usuario_actual
from app.schemas import CapturaLote

router = APIRouter(prefix="/api", tags=["Grupos"])


@router.get("/grupos", summary="Actividades de las que soy responsable")
def mis_grupos(usuario: UsuarioActual = Depends(get_usuario_actual)):
    with conexion_usuario(usuario.id_auth) as conn:
        return conn.execute("select * from sigae.mis_grupos()").fetchall()


@router.get("/actividades/{id_actividad}/grupo", summary="Datos de la actividad y lista del grupo")
def grupo(id_actividad: int, usuario: UsuarioActual = Depends(get_usuario_actual)):
    with conexion_usuario(usuario.id_auth) as conn:
        if not conn.execute("select sigae.puede_gestionar_actividad(%s) as ok", (id_actividad,)).fetchone()["ok"]:
            raise ErrorSIGAE(403, "No eres responsable de esta actividad", "SGA03")
        actividad = conn.execute(
            """
            select a.id_actividad, a.nombre, a.descripcion, a.dias, a.hora_inicio, a.hora_fin,
                   a.cupo_maximo, a.estado::text as estado, au.nombre as aula, p.nombre as periodo,
                   p.estado::text as estado_periodo, r.nombre as responsable,
                   (select ps.valor from sigae.parametro_sistema ps
                     where ps.clave = 'asistencia_minima') as asistencia_minima
              from sigae.actividad a
              join sigae.aula au on au.id_aula = a.id_aula
              join sigae.periodo p on p.id_periodo = a.id_periodo
              left join sigae.usuario r on r.id_usuario = a.id_responsable
             where a.id_actividad = %s
            """,
            (id_actividad,),
        ).fetchone()
        if actividad is None:
            raise ErrorSIGAE(404, "La actividad no existe", "SGN04")
        lista = conn.execute("select * from sigae.lista_grupo(%s)", (id_actividad,)).fetchall()
    return {"actividad": actividad, "lista": lista}


@router.put("/actividades/{id_actividad}/metricas", summary="Guardar asistencia y evidencia del grupo")
def guardar_metricas(id_actividad: int, body: CapturaLote, usuario: UsuarioActual = Depends(get_usuario_actual)):
    capturas = [c.model_dump() for c in body.capturas]
    with conexion_usuario(usuario.id_auth) as conn:
        validas = {
            f["id_inscripcion"]
            for f in conn.execute(
                "select id_inscripcion from sigae.inscripcion where id_actividad = %s", (id_actividad,)
            ).fetchall()
        }
        if any(c["id_inscripcion"] not in validas for c in capturas):
            raise ErrorSIGAE(422, "Hay alumnos que no pertenecen a esta actividad", "SGV02")
        resultados = conn.execute(
            "select * from sigae.guardar_metricas_lote(%s::jsonb)", (json.dumps(capturas),)
        ).fetchall()
    return {
        "guardados": sum(1 for r in resultados if r["guardado"]),
        "con_error": sum(1 for r in resultados if not r["guardado"]),
        "resultados": resultados,
    }
