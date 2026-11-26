"""Catálogo de actividades e inscripciones del alumno.

La inscripción la hace la función `sigae.inscribir`, que bloquea la fila de la
actividad (FOR UPDATE): dos alumnos nunca se llevan el mismo último lugar.
"""
from fastapi import APIRouter, Depends, Query

from app.core.database import conexion_usuario
from app.core.seguridad import ALUMNO, UsuarioActual, get_usuario_actual, olvidar_usuario, requiere_rol
from app.schemas import MiSexo

router = APIRouter(prefix="/api", tags=["Alumno"])


@router.get("/catalogo", summary="Actividades del periodo con lugares disponibles")
def catalogo(buscar: str | None = Query(default=None, max_length=100),
             usuario: UsuarioActual = Depends(get_usuario_actual)):
    with conexion_usuario(usuario.id_auth) as conn:
        return conn.execute("select * from sigae.catalogo(%s)", (buscar or None,)).fetchall()


@router.get("/inscripciones", summary="Mis inscripciones y mi estatus de crédito")
def mis_inscripciones(usuario: UsuarioActual = Depends(requiere_rol(ALUMNO))):
    with conexion_usuario(usuario.id_auth) as conn:
        return conn.execute("select * from sigae.mis_inscripciones()").fetchall()


@router.post("/actividades/{id_actividad}/inscripcion", status_code=201, summary="Inscribirme a una actividad")
def inscribir(id_actividad: int, usuario: UsuarioActual = Depends(requiere_rol(ALUMNO))):
    with conexion_usuario(usuario.id_auth) as conn:
        return conn.execute("select * from sigae.inscribir(%s)", (id_actividad,)).fetchone()


@router.delete("/inscripciones/{id_inscripcion}", summary="Darme de baja de una actividad")
def cancelar(id_inscripcion: int, usuario: UsuarioActual = Depends(requiere_rol(ALUMNO))):
    with conexion_usuario(usuario.id_auth) as conn:
        return conn.execute("select * from sigae.cancelar_inscripcion(%s)", (id_inscripcion,)).fetchone()


@router.put("/mi-sexo", status_code=204, summary="Indicar si soy hombre o mujer (una sola vez)")
def poner_mi_sexo(body: MiSexo, usuario: UsuarioActual = Depends(requiere_rol(ALUMNO))):
    with conexion_usuario(usuario.id_auth) as conn:
        conn.execute("select sigae.poner_mi_sexo(%s)", (body.sexo,))
    olvidar_usuario(usuario.id_auth)
