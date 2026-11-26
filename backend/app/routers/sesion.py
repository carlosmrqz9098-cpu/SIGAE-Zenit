"""Inicio y cierre de sesión (con bloqueo por intentos fallidos, RNF-007)."""
from fastapi import APIRouter, Depends

from app.core import supabase
from app.core.database import conexion_sistema
from app.core.errores import ErrorSIGAE
from app.core.seguridad import UsuarioActual, cargar_usuario, get_token, get_usuario_actual, olvidar_token
from app.schemas import Login, Renovar

router = APIRouter(prefix="/api/auth", tags=["Sesión"])


def _publico(u: UsuarioActual) -> dict:
    return {
        "id_usuario": u.id_usuario,
        "nombre": u.nombre,
        "correo": u.correo,
        "rol": u.rol,
        "matricula": u.matricula,
        "sexo": u.sexo,
        "es_responsable": u.es_responsable,
    }


def _sesion(datos: dict) -> dict:
    return {
        "access_token": datos["access_token"],
        "refresh_token": datos["refresh_token"],
        "expires_at": datos.get("expires_at"),
    }


@router.post("/login", summary="Iniciar sesión")
def login(body: Login):
    correo = body.correo.lower()
    with conexion_sistema() as conn:
        bloqueada = conn.execute("select sigae.cuenta_bloqueada(%s) as b", (correo,)).fetchone()["b"]
    if bloqueada:
        raise ErrorSIGAE(423, "Cuenta bloqueada por 5 intentos fallidos. Espera 15 minutos e intenta de nuevo.", "CUENTA_BLOQUEADA")

    datos = supabase.iniciar_sesion(correo, body.contrasena)
    if datos is None:
        with conexion_sistema() as conn:
            quedo_bloqueada = conn.execute(
                "select sigae.registrar_intento_acceso(%s, false) as b", (correo,)
            ).fetchone()["b"]
        if quedo_bloqueada:
            raise ErrorSIGAE(423, "Cuenta bloqueada por 5 intentos fallidos. Espera 15 minutos e intenta de nuevo.", "CUENTA_BLOQUEADA")
        raise ErrorSIGAE(401, "Correo o contraseña incorrectos", "CREDENCIALES")

    usuario = cargar_usuario(datos["user"]["id"])
    if usuario is None:
        # Contraseña correcta pero la cuenta no está activa (p. ej. alumno que el admin aún no acepta).
        # No se registra como entrada exitosa: así sigue apareciendo "Por aceptar" en Usuarios.
        supabase.cerrar_sesion(datos["access_token"])
        raise ErrorSIGAE(403, "Tu cuenta no está activa. Si te acabas de registrar, Servicios Extra-Escolares debe aceptarla primero.", "SGA02")
    with conexion_sistema() as conn:
        conn.execute("select sigae.registrar_intento_acceso(%s, true)", (correo,))
    return {"sesion": _sesion(datos), "usuario": _publico(usuario)}


@router.post("/renovar", summary="Renovar la sesión antes de que expire")
def renovar(body: Renovar):
    datos = supabase.renovar_sesion(body.refresh_token)
    if datos is None:
        raise ErrorSIGAE(401, "Tu sesión expiró. Vuelve a iniciar sesión.", "SGA01")
    return {"sesion": _sesion(datos)}


@router.post("/logout", status_code=204, summary="Cerrar sesión")
def logout(token: str = Depends(get_token)):
    olvidar_token(token)
    supabase.cerrar_sesion(token)


@router.get("/me", summary="Datos del usuario que inició sesión")
def yo(usuario: UsuarioActual = Depends(get_usuario_actual)):
    return _publico(usuario)
