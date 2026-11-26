"""Autenticación y roles.

1. El frontend manda el token de la sesión:  Authorization: Bearer <token>
2. Supabase Auth confirma que el token es válido y de quién es.
3. Se busca al usuario en `sigae.usuario` para conocer su rol.
Ocultar botones en el frontend no protege nada: cada endpoint revisa aquí
el rol, y además la base de datos vuelve a revisar con RLS.
"""
import time
from dataclasses import dataclass
from threading import Lock

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core import supabase
from app.core.database import conexion_usuario
from app.core.errores import ErrorSIGAE

_bearer = HTTPBearer(auto_error=False)

ADMIN, PERSONAL, DOCENTE, ALUMNO = "Administrador", "Personal", "Docente", "Alumno"

# Caché corta de tokens ya validados para no preguntar a Supabase en cada clic.
_cache: dict[str, tuple[float, str]] = {}
_cache_lock = Lock()
_CACHE_SEG = 60


@dataclass
class UsuarioActual:
    id_auth: str
    id_usuario: int
    nombre: str
    correo: str
    rol: str
    matricula: str | None
    activo: bool
    es_responsable: bool
    sexo: str | None = None


def _no_autorizado(detalle: str = "Inicia sesión para continuar") -> ErrorSIGAE:
    return ErrorSIGAE(401, detalle, "SGA01")


def id_auth_del_token(token: str) -> str:
    ahora = time.monotonic()
    with _cache_lock:
        guardado = _cache.get(token)
        if guardado and guardado[0] > ahora:
            return guardado[1]
    datos = supabase.usuario_del_token(token)
    if not datos or "id" not in datos:
        raise _no_autorizado("Tu sesión expiró. Vuelve a iniciar sesión.")
    with _cache_lock:
        if len(_cache) > 2000:
            _cache.clear()
        _cache[token] = (ahora + _CACHE_SEG, datos["id"])
    return datos["id"]


def olvidar_token(token: str) -> None:
    with _cache_lock:
        _cache.pop(token, None)
        _cache_usuarios.pop(token, None)


def cargar_usuario(id_auth: str) -> UsuarioActual | None:
    with conexion_usuario(id_auth) as conn:
        fila = conn.execute(
            """
            select u.id_usuario, u.nombre, u.correo, u.rol::text as rol, u.matricula, u.activo, u.sexo,
                   exists (select 1 from sigae.actividad a
                            where a.id_responsable = u.id_usuario and a.estado <> 'Inactiva') as es_responsable
              from sigae.usuario u
             where u.id_usuario = sigae.id_usuario_actual()
            """
        ).fetchone()
    return UsuarioActual(id_auth=id_auth, **fila) if fila else None


def get_token(cred: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> str:
    if cred is None or not cred.credentials:
        raise _no_autorizado()
    return cred.credentials


_cache_usuarios: dict[str, tuple[float, UsuarioActual]] = {}
_USUARIO_SEG = 30


def olvidar_usuario(id_auth: str) -> None:
    """Borra de la caché los datos del usuario (p. ej. después de cambiar su sexo)."""
    with _cache_lock:
        for token in [t for t, (_, u) in _cache_usuarios.items() if u.id_auth == id_auth]:
            _cache_usuarios.pop(token, None)


def get_usuario_actual(token: str = Depends(get_token)) -> UsuarioActual:
    ahora = time.monotonic()
    with _cache_lock:
        guardado = _cache_usuarios.get(token)
    if guardado and guardado[0] > ahora:
        return guardado[1]
    usuario = cargar_usuario(id_auth_del_token(token))
    if usuario is not None:
        with _cache_lock:
            if len(_cache_usuarios) > 2000:
                _cache_usuarios.clear()
            _cache_usuarios[token] = (ahora + _USUARIO_SEG, usuario)
    if usuario is None:
        raise ErrorSIGAE(403, "Tu cuenta no está activa en SIGAE. Acude a Servicios Extra-Escolares.", "SGA02")
    return usuario


def requiere_rol(*roles: str):
    """Uso:  usuario: UsuarioActual = Depends(requiere_rol(ADMIN, PERSONAL))"""

    def _verificar(usuario: UsuarioActual = Depends(get_usuario_actual)) -> UsuarioActual:
        if usuario.rol not in roles:
            raise ErrorSIGAE(403, "No tienes permiso para esta sección", "SGA03")
        return usuario

    return _verificar
