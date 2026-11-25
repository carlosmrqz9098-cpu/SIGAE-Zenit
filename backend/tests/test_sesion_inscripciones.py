"""Pruebas de sesión expirada y de los mensajes de inscripción (no necesitan base de datos).

- Sesión: se usa la dependencia real `get_usuario_actual`. Supabase se reemplaza por una
  función falsa que dice "este token ya no sirve", como pasa cuando la sesión expira.
- Inscripciones: se simula el error que lanza la función `sigae.inscribir` de la base
  (mismo código y mismo mensaje) y se revisa que llegue al usuario tal cual, en español,
  con el código HTTP correcto.
"""
from types import SimpleNamespace

import psycopg
import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.core import supabase
from app.core.errores import registrar_manejadores
from app.core.seguridad import UsuarioActual, get_usuario_actual


def error_de_la_base(codigo: str, mensaje: str) -> psycopg.Error:
    """Crea un error igual al que manda PostgreSQL con `raise exception ... using errcode`."""
    clase = type(
        f"Error_{codigo}",
        (psycopg.Error,),
        {"sqlstate": codigo, "diag": property(lambda self: SimpleNamespace(message_primary=mensaje))},
    )
    return clase(mensaje)


def _app_de_prueba() -> FastAPI:
    app = FastAPI()
    registrar_manejadores(app)

    @app.get("/privado")
    def privado(usuario: UsuarioActual = Depends(get_usuario_actual)):
        return {"hola": usuario.nombre}

    @app.post("/inscribir/{codigo}")
    def inscribir(codigo: str):
        mensajes = {
            "SGC01": "El cupo se ha agotado para esta actividad",
            "SGC02": "Ya estás inscrito en esta actividad",
            "SGC03": "Inscripciones cerradas",
            "SGC06": "Ya estás inscrito en otra actividad de este periodo. Solo puedes tomar una por periodo",
        }
        raise error_de_la_base(codigo, mensajes[codigo])

    @app.post("/falla-bd")
    def falla_bd():
        raise error_de_la_base("XX000", "detalle técnico de PostgreSQL")

    return app


cliente = TestClient(_app_de_prueba(), raise_server_exceptions=False)


# ------------------------------------------------------------------ sesión
def test_sin_token_pide_iniciar_sesion():
    r = cliente.get("/privado")
    assert r.status_code == 401
    assert r.json() == {"detalle": "Inicia sesión para continuar", "codigo": "SGA01"}


@pytest.mark.parametrize("token", ["token-que-ya-expiro", "esto-no-es-un-token"])
def test_sesion_expirada_o_token_invalido_regresa_401(monkeypatch, token):
    # Supabase responde que el token ya no es válido
    monkeypatch.setattr(supabase, "usuario_del_token", lambda _token: None)
    r = cliente.get("/privado", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401
    assert r.json() == {"detalle": "Tu sesión expiró. Vuelve a iniciar sesión.", "codigo": "SGA01"}


# ------------------------------------------------------------------ inscripciones
@pytest.mark.parametrize(
    ("codigo", "mensaje"),
    [
        ("SGC01", "El cupo se ha agotado para esta actividad"),
        ("SGC02", "Ya estás inscrito en esta actividad"),
        ("SGC03", "Inscripciones cerradas"),
        ("SGC06", "Ya estás inscrito en otra actividad de este periodo. Solo puedes tomar una por periodo"),
    ],
)
def test_inscripcion_rechazada_regresa_409_con_mensaje_en_espanol(codigo, mensaje):
    r = cliente.post(f"/inscribir/{codigo}")
    assert r.status_code == 409
    assert r.json() == {"detalle": mensaje, "codigo": codigo}


def test_error_desconocido_de_la_base_no_muestra_detalles_tecnicos():
    r = cliente.post("/falla-bd")
    assert r.status_code == 500
    assert r.json()["codigo"] == "ERROR_INTERNO"
    assert "PostgreSQL" not in r.text
