"""Materiales de cada actividad, guardados en Supabase Storage (bucket privado).

Subida en 3 pasos, para no pasar el archivo por el backend (Vercel limita el
tamaño de las peticiones):
  1. POST .../materiales/subida   → el backend revisa permiso, tipo y tamaño y
                                    entrega una URL temporal de subida.
  2. El navegador sube el archivo directo a Storage con esa URL.
  3. POST .../materiales          → el backend confirma que el archivo existe,
                                    vuelve a revisar su tamaño y lo registra en
                                    la base (`sigae.registrar_material`).
"""
import re
import uuid

from fastapi import APIRouter, Depends

from app.core import supabase
from app.core.database import conexion_usuario
from app.core.errores import ErrorSIGAE
from app.core.seguridad import UsuarioActual, get_usuario_actual
from app.schemas import ConfirmarSubida, SolicitudSubida

router = APIRouter(prefix="/api", tags=["Materiales"])


def _limite_bytes(conn) -> int:
    fila = conn.execute(
        "select valor from sigae.parametro_sistema where clave = 'tamano_maximo_mb'"
    ).fetchone()
    mb = float(fila["valor"]) if fila and fila["valor"] else 5
    return int(mb * 1024 * 1024)


def _puede_gestionar(conn, id_actividad: int) -> bool:
    return conn.execute("select sigae.puede_gestionar_actividad(%s) as ok", (id_actividad,)).fetchone()["ok"]


def _nombre_seguro(nombre: str) -> str:
    base = re.sub(r"[^A-Za-z0-9._-]+", "_", nombre).strip("._") or "archivo"
    return base[-80:]


@router.get("/actividades/{id_actividad}/materiales", summary="Materiales de una actividad")
def listar(id_actividad: int, usuario: UsuarioActual = Depends(get_usuario_actual)):
    with conexion_usuario(usuario.id_auth) as conn:
        actividad = conn.execute(
            "select nombre from sigae.actividad where id_actividad = %s", (id_actividad,)
        ).fetchone()
        materiales = conn.execute(
            """
            select m.id_material, m.nombre_original, m.tipo_mime, m.tamano_bytes, m.fecha_carga,
                   u.nombre as cargado_por
              from sigae.material m
              left join sigae.usuario u on u.id_usuario = m.id_usuario_carga
             where m.id_actividad = %s
             order by m.fecha_carga desc
            """,
            (id_actividad,),
        ).fetchall()
        puede = _puede_gestionar(conn, id_actividad)
        limite = _limite_bytes(conn)
    if actividad is None and not materiales:
        raise ErrorSIGAE(404, "La actividad no existe o no tienes acceso a ella", "SGN04")
    return {
        "actividad": actividad["nombre"] if actividad else None,
        "puede_gestionar": puede,
        "limite_bytes": limite,
        "materiales": materiales,
    }


@router.post("/actividades/{id_actividad}/materiales/subida", summary="Paso 1: preparar la subida")
def preparar_subida(id_actividad: int, body: SolicitudSubida, usuario: UsuarioActual = Depends(get_usuario_actual)):
    with conexion_usuario(usuario.id_auth) as conn:
        if not _puede_gestionar(conn, id_actividad):
            raise ErrorSIGAE(403, "Solo el responsable, el Personal o el Administrador pueden subir materiales", "SGA03")
        limite = _limite_bytes(conn)
    if body.tamano_bytes > limite:
        raise ErrorSIGAE(422, f"El archivo pesa más de {limite // (1024 * 1024)} MB", "SGV03")
    ruta = f"actividad_{id_actividad}/{uuid.uuid4().hex}_{_nombre_seguro(body.nombre)}"
    return {"ruta": ruta, "url_subida": supabase.url_subida_firmada(ruta)}


@router.post("/actividades/{id_actividad}/materiales", status_code=201, summary="Paso 3: registrar el archivo subido")
def confirmar_subida(id_actividad: int, body: ConfirmarSubida, usuario: UsuarioActual = Depends(get_usuario_actual)):
    if not body.ruta.startswith(f"actividad_{id_actividad}/") or ".." in body.ruta:
        raise ErrorSIGAE(422, "Ruta de archivo inválida", "SGV04")
    info = supabase.info_archivo(body.ruta)
    if info is None:
        raise ErrorSIGAE(422, "El archivo no se terminó de subir. Intenta de nuevo.", "SGV05")
    tamano = int(info.get("size") or info.get("metadata", {}).get("size") or 0)
    try:
        with conexion_usuario(usuario.id_auth) as conn:
            if tamano <= 0 or tamano > _limite_bytes(conn):
                raise ErrorSIGAE(422, "El archivo está vacío o pesa más de lo permitido", "SGV03")
            id_material = conn.execute(
                "select sigae.registrar_material(%s, %s, %s, %s, %s) as id",
                (id_actividad, body.nombre, body.ruta, body.tipo_mime, tamano),
            ).fetchone()["id"]
    except Exception:
        supabase.borrar_archivo(body.ruta)  # no dejar archivos sin registro
        raise
    return {"id_material": id_material}


@router.get("/materiales/{id_material}/descarga", summary="URL temporal para descargar un material")
def descargar(id_material: int, ver: bool = False, usuario: UsuarioActual = Depends(get_usuario_actual)):
    with conexion_usuario(usuario.id_auth) as conn:
        # RLS: solo regresa la fila si el usuario puede verla
        fila = conn.execute(
            "select ruta_archivo, nombre_original from sigae.material where id_material = %s", (id_material,)
        ).fetchone()
    if fila is None:
        raise ErrorSIGAE(404, "El material no existe o no tienes acceso a él", "SGN04")
    return {"url": supabase.url_descarga_firmada(fila["ruta_archivo"], fila["nombre_original"], descargar=not ver)}


@router.delete("/materiales/{id_material}", status_code=204, summary="Eliminar un material")
def eliminar(id_material: int, usuario: UsuarioActual = Depends(get_usuario_actual)):
    with conexion_usuario(usuario.id_auth) as conn:
        ruta = conn.execute("select sigae.eliminar_material(%s) as ruta", (id_material,)).fetchone()["ruta"]
    if ruta:
        supabase.borrar_archivo(ruta)
