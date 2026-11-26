"""Crear cuenta de alumno y recuperar contraseña con un código de 6 números.

Supabase Auth manda los correos (Gmail configurado en Auth > SMTP) y guarda los códigos.
- Solo alumnos y solo correos @pachuca.tecnm.mx. A los docentes los da de alta el admin.
- El alumno confirma su correo y queda pendiente hasta que el admin lo acepte en Usuarios.
"""
import re

from fastapi import APIRouter

from app.core import supabase
from app.core.database import conexion_sistema
from app.core.errores import ErrorSIGAE
from app.schemas import (
    DOMINIO_ITP,
    ConfirmarCodigo,
    NuevaContrasenaConCodigo,
    Registro,
    SoloCorreo,
)

router = APIRouter(prefix="/api/auth", tags=["Registro y contraseña"])

_CODIGO_MALO = ErrorSIGAE(400, "El código no es correcto o ya venció. Revisa tu correo o pide uno nuevo.", "CODIGO_INVALIDO")
_NOMBRE = re.compile(r"^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+( [A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)*$")


@router.post("/registro", status_code=202, summary="Crear cuenta de alumno: manda un código al correo")
def registro(body: Registro):
    with conexion_sistema() as conn:
        if conn.execute("select 1 from sigae.usuario where lower(correo) = %s", (body.correo,)).fetchone():
            raise ErrorSIGAE(409, "Ya hay una cuenta con ese correo. Inicia sesión o recupera tu contraseña.", "CORREO_EXISTE")
        if conn.execute("select 1 from sigae.usuario where matricula = %s", (body.matricula,)).fetchone():
            raise ErrorSIGAE(409, "Esa matrícula ya tiene una cuenta. Si es tuya, recupera tu contraseña.", "MATRICULA_EXISTE")
    supabase.registrar(body.correo, body.contrasena,
                       {"nombre": body.nombre_completo, "rol": "Alumno", "matricula": body.matricula, "sexo": body.sexo})
    return {"mensaje": f"Te enviamos un código de 6 números a {body.correo}."}


@router.post("/registro/reenviar", status_code=202, summary="Mandar otra vez el código de registro")
def reenviar(body: SoloCorreo):
    supabase.reenviar_codigo_registro(body.correo)
    return {"mensaje": "Si tu registro está pendiente, te llegará un código nuevo."}


def _datos_validos(usuario: dict) -> tuple[str, str, str | None]:
    """Vuelve a revisar los datos guardados al registrarse (nadie debe poder ponerse otro rol)."""
    meta = usuario.get("user_metadata") or {}
    correo = (usuario.get("email") or "").lower()
    nombre, rol, matricula = str(meta.get("nombre") or ""), meta.get("rol"), meta.get("matricula")
    sexo = meta.get("sexo") if meta.get("sexo") in ("Hombre", "Mujer") else None
    ok = (correo.endswith(DOMINIO_ITP) and rol == "Alumno" and _NOMBRE.match(nombre)
          and isinstance(matricula, str) and re.fullmatch(r"\d{8}", matricula))
    if not ok:
        raise ErrorSIGAE(422, "Los datos del registro no son válidos. Vuelve a registrarte.", "REGISTRO_INVALIDO")
    return nombre, matricula, sexo


@router.post("/registro/confirmar", summary="Confirmar el correo; la cuenta queda pendiente de que el admin la acepte")
def confirmar(body: ConfirmarCodigo):
    datos = supabase.verificar_codigo(body.correo, body.codigo, ("signup", "email"))
    if datos is None:
        raise _CODIGO_MALO
    usuario, token = datos["user"], datos["access_token"]
    try:
        nombre, matricula, sexo = _datos_validos(usuario)
        with conexion_sistema() as conn:
            ya = conn.execute("select rol::text as rol, activo from sigae.usuario where id_auth = %s",
                              (usuario["id"],)).fetchone()
            if ya is None:
                conn.execute(
                    """insert into sigae.usuario (id_auth, nombre, correo, rol, matricula, sexo, activo)
                       values (%s, %s, %s, 'Alumno', %s, %s, false)""",
                    (usuario["id"], nombre, usuario["email"].lower(), matricula, sexo),
                )
                ya = {"rol": "Alumno", "activo": False}
    except Exception:
        supabase.cerrar_sesion(token)
        raise
    supabase.cerrar_sesion(token)
    return {"rol": ya["rol"], "pendiente": not ya["activo"]}


@router.post("/recuperar", status_code=202, summary="Olvidé mi contraseña: manda un código al correo")
def recuperar(body: SoloCorreo):
    supabase.pedir_codigo_recuperacion(body.correo)
    # Mismo mensaje exista o no la cuenta, para no revelar qué correos están registrados.
    return {"mensaje": "Si ese correo tiene cuenta en SIGAE, te llegará un código de 6 números."}


@router.post("/recuperar/confirmar", status_code=204, summary="Poner contraseña nueva con el código del correo")
def recuperar_confirmar(body: NuevaContrasenaConCodigo):
    datos = supabase.verificar_codigo(body.correo, body.codigo, ("recovery",))
    if datos is None:
        raise _CODIGO_MALO
    token = datos["access_token"]
    try:
        supabase.nueva_contrasena_con_sesion(token, body.contrasena)
    finally:
        supabase.cerrar_sesion(token)
    with conexion_sistema() as conn:
        # Si estaba bloqueada por intentos, se desbloquea (solo cuentas ya aceptadas:
        # así un alumno pendiente sigue apareciendo como "por aceptar").
        conn.execute(
            """select sigae.registrar_intento_acceso(%s, true)
                where exists (select 1 from sigae.usuario where lower(correo) = %s and activo)""",
            (body.correo, body.correo),
        )
