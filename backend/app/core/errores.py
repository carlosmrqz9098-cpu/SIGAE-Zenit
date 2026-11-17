"""Respuestas de error consistentes.

Todas las respuestas de error tienen la forma:
    {"detalle": "<mensaje para el usuario>", "codigo": "<código>"}

Las funciones de la base lanzan errores con códigos propios:
    SGA01 → no hay sesión válida            → 401
    SGA.. → sin permiso                     → 403
    SGN.. → no existe                       → 404
    SGC.. → choca con una regla de negocio  → 409 (cupo agotado, ya inscrito...)
    SGV.. → dato inválido                   → 422
"""
import logging

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from psycopg import Error as PsycopgError
from psycopg import OperationalError

log = logging.getLogger("sigae")


class ErrorSIGAE(HTTPException):
    def __init__(self, estado: int, detalle: str, codigo: str):
        super().__init__(status_code=estado, detail={"detalle": detalle, "codigo": codigo})


def estado_http(codigo: str | None) -> int:
    if not codigo:
        return 500
    if codigo == "SGA01":
        return 401
    if codigo.startswith("SGA") or codigo == "42501":  # 42501 = permiso denegado (RLS)
        return 403
    if codigo.startswith("SGN"):
        return 404
    if codigo.startswith("SGC") or codigo in ("23505", "23P01", "23503"):
        return 409
    if codigo.startswith("SGV") or codigo.startswith("22") or codigo.startswith("23"):
        return 422
    return 500


_MENSAJES_GENERICOS = {
    "42501": "No tienes permiso para esta operación",
    "23505": "Ya existe un registro con esos datos",
    "23P01": "Las fechas se enciman con otro registro",
    "23503": "El registro está relacionado con otros datos y no se puede cambiar así",
}


def registrar_manejadores(app: FastAPI) -> None:
    @app.exception_handler(HTTPException)
    async def error_http(_: Request, exc: HTTPException) -> JSONResponse:
        if isinstance(exc.detail, dict):
            contenido = exc.detail
        else:
            contenido = {"detalle": str(exc.detail), "codigo": f"HTTP_{exc.status_code}"}
        return JSONResponse(status_code=exc.status_code, content=contenido, headers=exc.headers)

    @app.exception_handler(RequestValidationError)
    async def error_validacion(_: Request, exc: RequestValidationError) -> JSONResponse:
        errores = exc.errors()
        campo = ".".join(str(x) for x in errores[0]["loc"][1:]) if errores else ""
        mensaje = errores[0]["msg"].removeprefix("Value error, ") if errores else "Datos inválidos"
        detalle = f"Revisa el campo «{campo}»: {mensaje}" if campo else mensaje
        return JSONResponse(status_code=422, content={"detalle": detalle, "codigo": "VALIDACION"})

    @app.exception_handler(OperationalError)
    async def error_conexion(_: Request, exc: OperationalError) -> JSONResponse:
        log.exception("Sin conexión con la base de datos")
        return JSONResponse(
            status_code=503,
            content={"detalle": "No hay conexión con la base de datos. Intenta en un momento.", "codigo": "BD_NO_DISPONIBLE"},
        )

    @app.exception_handler(PsycopgError)
    async def error_bd(_: Request, exc: PsycopgError) -> JSONResponse:
        codigo = exc.sqlstate
        estado = estado_http(codigo)
        if estado == 500:
            # El detalle técnico se queda en el registro del servidor, nunca se muestra.
            log.exception("Error de base de datos (%s)", codigo)
            return JSONResponse(
                status_code=500,
                content={"detalle": "Ocurrió un error interno. Intenta de nuevo.", "codigo": "ERROR_INTERNO"},
            )
        if codigo and codigo.startswith("SG"):
            mensaje = exc.diag.message_primary or "Operación no permitida"
        else:
            mensaje = _MENSAJES_GENERICOS.get(codigo or "", exc.diag.message_primary or "Datos inválidos")
        return JSONResponse(status_code=estado, content={"detalle": mensaje, "codigo": codigo})

    @app.exception_handler(Exception)
    async def error_general(_: Request, exc: Exception) -> JSONResponse:
        log.exception("Error no controlado")
        return JSONResponse(
            status_code=500,
            content={"detalle": "Ocurrió un error interno. Intenta de nuevo.", "codigo": "ERROR_INTERNO"},
        )
