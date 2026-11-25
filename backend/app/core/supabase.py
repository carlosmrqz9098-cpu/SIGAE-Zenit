"""Llamadas a los servicios de Supabase (Auth y Storage) por HTTP.

- Con la llave publicable: iniciar sesión, renovar sesión, validar tokens.
- Con la llave secreta (solo backend): crear cuentas y manejar archivos.
"""
from urllib.parse import quote

import logging

import httpx

from app.core.config import get_settings
from app.core.errores import ErrorSIGAE

_cliente = httpx.Client(timeout=15)
log = logging.getLogger("sigae.supabase")


def _publicable() -> dict[str, str]:
    return {"apikey": get_settings().supabase_publishable_key}


def _secreta() -> dict[str, str]:
    # Llave "service_role" (formato JWT, empieza con eyJ...). Storage la exige en Authorization.
    k = get_settings().supabase_secret_key
    return {"apikey": k, "Authorization": f"Bearer {k}"}


def _llamar(metodo: str, ruta: str, **kwargs) -> httpx.Response:
    try:
        return _cliente.request(metodo, f"{get_settings().url}{ruta}", **kwargs)
    except httpx.HTTPError as exc:
        raise ErrorSIGAE(503, "No se pudo conectar con Supabase. Intenta en un momento.", "SUPABASE_NO_DISPONIBLE") from exc


# ---------------------------------------------------------------- Auth
def iniciar_sesion(correo: str, contrasena: str) -> dict | None:
    """Regresa la sesión (tokens) o None si el correo o la contraseña no son correctos."""
    r = _llamar("POST", "/auth/v1/token?grant_type=password", headers=_publicable(),
                json={"email": correo, "password": contrasena})
    if r.status_code == 200:
        return r.json()
    if r.status_code in (400, 401):
        return None
    raise ErrorSIGAE(503, "El servicio de inicio de sesión no respondió. Intenta en un momento.", "AUTH_NO_DISPONIBLE")


def renovar_sesion(refresh_token: str) -> dict | None:
    r = _llamar("POST", "/auth/v1/token?grant_type=refresh_token", headers=_publicable(),
                json={"refresh_token": refresh_token})
    return r.json() if r.status_code == 200 else None


def cerrar_sesion(access_token: str) -> None:
    _llamar("POST", "/auth/v1/logout", headers={**_publicable(), "Authorization": f"Bearer {access_token}"})


def usuario_del_token(access_token: str) -> dict | None:
    r = _llamar("GET", "/auth/v1/user", headers={**_publicable(), "Authorization": f"Bearer {access_token}"})
    return r.json() if r.status_code == 200 else None


def crear_cuenta(correo: str, contrasena: str) -> str:
    """Crea la cuenta en Supabase Auth (confirmada) y regresa su id."""
    r = _llamar("POST", "/auth/v1/admin/users", headers=_secreta(),
                json={"email": correo, "password": contrasena, "email_confirm": True})
    if r.status_code in (200, 201):
        return r.json()["id"]
    if r.status_code == 422:
        raise ErrorSIGAE(409, "Ya existe una cuenta con ese correo o la contraseña es muy débil", "CUENTA_INVALIDA")
    raise ErrorSIGAE(502, "No se pudo crear la cuenta en Supabase Auth", "AUTH_ERROR")


def borrar_cuenta(id_auth: str) -> None:
    _llamar("DELETE", f"/auth/v1/admin/users/{id_auth}", headers=_secreta())


def cambiar_contrasena(id_auth: str, contrasena: str) -> None:
    r = _llamar("PUT", f"/auth/v1/admin/users/{id_auth}", headers=_secreta(), json={"password": contrasena})
    if r.status_code != 200:
        raise ErrorSIGAE(422, "No se pudo cambiar la contraseña (mínimo 8 caracteres)", "AUTH_ERROR")


# ---------------------------------------------------------------- Storage
def _bucket() -> str:
    return get_settings().storage_bucket


def url_subida_firmada(ruta: str) -> str:
    """URL temporal para que el navegador suba el archivo directo a Storage."""
    r = _llamar("POST", f"/storage/v1/object/upload/sign/{_bucket()}/{ruta}", headers=_secreta(), json={})
    if r.status_code != 200:
        log.error("Storage upload/sign %s: %s", r.status_code, r.text[:300])
        raise ErrorSIGAE(502, "No se pudo preparar la subida del archivo", "STORAGE_ERROR")
    return f"{get_settings().url}/storage/v1{r.json()['url']}"


def info_archivo(ruta: str) -> dict | None:
    r = _llamar("GET", f"/storage/v1/object/info/{_bucket()}/{ruta}", headers=_secreta())
    return r.json() if r.status_code == 200 else None


def url_descarga_firmada(ruta: str, nombre: str, segundos: int = 300, descargar: bool = True) -> str:
    r = _llamar("POST", f"/storage/v1/object/sign/{_bucket()}/{ruta}", headers=_secreta(),
                json={"expiresIn": segundos})
    if r.status_code != 200:
        raise ErrorSIGAE(404, "El archivo ya no está disponible", "STORAGE_NO_ENCONTRADO")
    firmado = r.json().get("signedURL") or r.json().get("signedUrl")
    if not descargar:  # para verlo en el navegador (PDF e imágenes)
        return f"{get_settings().url}/storage/v1{firmado}"
    separador = "&" if "?" in firmado else "?"
    return f"{get_settings().url}/storage/v1{firmado}{separador}download={quote(nombre)}"


def borrar_archivo(ruta: str) -> None:
    _llamar("DELETE", f"/storage/v1/object/{_bucket()}", headers=_secreta(), json={"prefixes": [ruta]})
