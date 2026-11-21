"""Pruebas de los códigos de error (no necesitan base de datos).

Revisan que cada código que lanza la base o el backend se convierta en el
código HTTP correcto y que las respuestas de error tengan siempre la forma
{"detalle": ..., "codigo": ...}.
"""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.errores import ErrorSIGAE, estado_http, registrar_manejadores
from app.schemas import Login


@pytest.mark.parametrize(
    ("codigo", "esperado"),
    [
        ("SGA01", 401),  # no hay sesión válida
        ("SGA02", 403),  # cuenta sin permiso
        ("SGA03", 403),  # rol sin permiso
        ("42501", 403),  # PostgreSQL negó el acceso (RLS)
        ("SGN04", 404),  # la actividad no existe
        ("SGC01", 409),  # cupo agotado
        ("SGC02", 409),  # ya inscrito en esta actividad
        ("SGC06", 409),  # ya inscrito en otra actividad del periodo
        ("23505", 409),  # registro duplicado
        ("23P01", 409),  # periodos que se enciman
        ("SGV01", 422),  # dato inválido
        ("22P02", 422),  # texto que no es número
        ("XX000", 500),  # error desconocido
        (None, 500),     # sin código
    ],
)
def test_codigo_de_error_a_http(codigo, esperado):
    assert estado_http(codigo) == esperado


# --------------------------------------------------------------- app mínima
def _app_de_prueba() -> FastAPI:
    app = FastAPI()
    registrar_manejadores(app)

    @app.get("/cupo-agotado")
    def cupo_agotado():
        raise ErrorSIGAE(409, "El cupo se ha agotado para esta actividad", "SGC01")

    @app.get("/sin-sesion")
    def sin_sesion():
        raise ErrorSIGAE(401, "Tu sesión expiró. Vuelve a iniciar sesión.", "SGA01")

    @app.post("/login")
    def login(body: Login):
        return {"correo": body.correo}

    @app.get("/falla-interna")
    def falla_interna():
        raise RuntimeError("detalle técnico que nunca debe verse")

    return app


cliente = TestClient(_app_de_prueba(), raise_server_exceptions=False)


def test_error_de_regla_de_negocio_regresa_409_con_detalle_y_codigo():
    r = cliente.get("/cupo-agotado")
    assert r.status_code == 409
    assert r.json() == {"detalle": "El cupo se ha agotado para esta actividad", "codigo": "SGC01"}


def test_sesion_expirada_regresa_401():
    r = cliente.get("/sin-sesion")
    assert r.status_code == 401
    assert r.json()["codigo"] == "SGA01"


def test_correo_invalido_regresa_422_con_mensaje_claro():
    r = cliente.post("/login", json={"correo": "esto-no-es-un-correo", "contrasena": "x"})
    assert r.status_code == 422
    datos = r.json()
    assert datos["codigo"] == "VALIDACION"
    assert "correo" in datos["detalle"]


def test_error_interno_no_muestra_detalles_tecnicos():
    r = cliente.get("/falla-interna")
    assert r.status_code == 500
    assert r.json() == {"detalle": "Ocurrió un error interno. Intenta de nuevo.", "codigo": "ERROR_INTERNO"}
    assert "técnico" not in r.text
