"""Pruebas de crear cuenta y recuperar contraseña (sin Supabase ni base de datos reales).

Supabase y la base se reemplazan por funciones falsas para revisar las reglas:
solo correos del Tec, solo letras en el nombre, matrícula de 8 números, nadie se
pone otro rol (solo alumnos), la cuenta queda pendiente hasta que el admin la acepte
y los códigos malos se rechazan.
"""
from contextlib import contextmanager

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.core.errores import registrar_manejadores
from app.routers import registro
from app.schemas import NuevaContrasenaConCodigo, Registro

BUENO = {
    "nombres": "José Ángel",
    "apellidos": "Núñez Ruiz",
    "correo": "L21200123@pachuca.tecnm.mx",
    "matricula": "21200123",
    "contrasena": "Futbol2026",
}


# ------------------------------------------------------------------ formulario
def test_registro_correcto_se_acepta():
    r = Registro(**BUENO)
    assert r.nombre_completo == "José Ángel Núñez Ruiz"
    assert r.correo == "l21200123@pachuca.tecnm.mx"


@pytest.mark.parametrize("cambio, mensaje", [
    ({"nombres": "Juan2"}, "solo letras"),
    ({"apellidos": "Pérez_López"}, "solo letras"),
    ({"correo": "juan@gmail.com"}, "pachuca.tecnm.mx"),
    ({"matricula": "2120012"}, "8 números"),
    ({"matricula": "C2120012"}, "8 números"),
    ({"matricula": "abcdefgh"}, "8 números"),
    ({"contrasena": "soloLetras"}, "una letra y un número"),
    ({"contrasena": "12345678"}, "una letra y un número"),
    ({"contrasena": "a1"}, "at least 8"),
])
def test_registro_con_datos_malos_se_rechaza(cambio, mensaje):
    with pytest.raises(ValidationError, match=mensaje):
        Registro(**{**BUENO, **cambio})


def test_codigo_debe_ser_de_6_numeros():
    base = {"correo": "a@pachuca.tecnm.mx", "contrasena": "Nueva2026"}
    assert NuevaContrasenaConCodigo(**base, codigo="123 456").codigo == "123456"
    with pytest.raises(ValidationError, match="6 números"):
        NuevaContrasenaConCodigo(**base, codigo="12345a")


# ------------------------------------------------------------------ endpoints
class _ConexionFalsa:
    def __init__(self):
        self.insertados = []
        self.existentes = set()

    def execute(self, sql, params=()):
        filas = []
        if sql.strip().startswith("insert into sigae.usuario"):
            self.insertados.append(params)
        elif "where id_auth" in sql:
            filas = []
        elif "from sigae.usuario" in sql and params and params[0] in self.existentes:
            filas = [{"x": 1}]
        return _Resultado(filas)


class _Resultado:
    def __init__(self, filas):
        self.filas = filas

    def fetchone(self):
        return self.filas[0] if self.filas else None


@pytest.fixture
def entorno(monkeypatch):
    conn = _ConexionFalsa()
    llamadas = {"cerradas": 0, "registradas": []}

    @contextmanager
    def conexion():
        yield conn

    monkeypatch.setattr(registro, "conexion_sistema", conexion)
    monkeypatch.setattr(registro.supabase, "registrar", lambda c, p, d: llamadas["registradas"].append((c, d)))
    monkeypatch.setattr(registro.supabase, "cerrar_sesion", lambda t: llamadas.__setitem__("cerradas", llamadas["cerradas"] + 1))
    monkeypatch.setattr(registro.supabase, "pedir_codigo_recuperacion", lambda c: None)

    app = FastAPI()
    registrar_manejadores(app)
    app.include_router(registro.router)
    return TestClient(app, raise_server_exceptions=False), conn, llamadas, monkeypatch


def _sesion_con(meta, correo="l21200123@pachuca.tecnm.mx"):
    return {"access_token": "tok", "user": {"id": "uuid-1", "email": correo, "user_metadata": meta}}


def test_registro_manda_codigo(entorno):
    cliente, _, llamadas, _ = entorno
    r = cliente.post("/api/auth/registro", json=BUENO)
    assert r.status_code == 202
    assert llamadas["registradas"][0][1] == {"nombre": "José Ángel Núñez Ruiz", "rol": "Alumno", "matricula": "21200123"}


def test_correo_ya_registrado_no_manda_codigo(entorno):
    cliente, conn, llamadas, _ = entorno
    conn.existentes.add("l21200123@pachuca.tecnm.mx")
    r = cliente.post("/api/auth/registro", json=BUENO)
    assert r.status_code == 409 and r.json()["codigo"] == "CORREO_EXISTE"
    assert llamadas["registradas"] == []


def test_alumno_confirmado_queda_pendiente_de_aceptar(entorno):
    cliente, conn, llamadas, mp = entorno
    meta = {"nombre": "José Ángel Núñez Ruiz", "rol": "Alumno", "matricula": "21200123"}
    mp.setattr(registro.supabase, "verificar_codigo", lambda c, k, t: _sesion_con(meta))
    r = cliente.post("/api/auth/registro/confirmar", json={"correo": BUENO["correo"], "codigo": "123456"})
    assert r.status_code == 200 and r.json() == {"rol": "Alumno", "pendiente": True}
    assert conn.insertados[0][1:] == ("José Ángel Núñez Ruiz", "l21200123@pachuca.tecnm.mx", "21200123")
    assert llamadas["cerradas"] == 1


@pytest.mark.parametrize("rol", ["Docente", "Administrador", "Personal"])
def test_nadie_se_registra_con_otro_rol(entorno, rol):
    cliente, conn, llamadas, mp = entorno
    meta = {"nombre": "Laura Ruiz", "rol": rol, "matricula": None}
    mp.setattr(registro.supabase, "verificar_codigo", lambda c, k, t: _sesion_con(meta))
    r = cliente.post("/api/auth/registro/confirmar", json={"correo": BUENO["correo"], "codigo": "123456"})
    assert r.status_code == 422
    assert conn.insertados == [] and llamadas["cerradas"] == 1


def test_codigo_incorrecto_se_rechaza(entorno):
    cliente, conn, _, mp = entorno
    mp.setattr(registro.supabase, "verificar_codigo", lambda c, k, t: None)
    r = cliente.post("/api/auth/registro/confirmar", json={"correo": BUENO["correo"], "codigo": "000000"})
    assert r.status_code == 400 and r.json()["codigo"] == "CODIGO_INVALIDO"
    assert conn.insertados == []


def test_recuperar_responde_igual_exista_o_no_el_correo(entorno):
    cliente, *_ = entorno
    r = cliente.post("/api/auth/recuperar", json={"correo": "nadie@pachuca.tecnm.mx"})
    assert r.status_code == 202 and "Si ese correo tiene cuenta" in r.json()["mensaje"]
