"""Conexión con PostgreSQL de Supabase.

El esquema `sigae` es privado (no se expone por la Data API), así que el
backend se conecta directo a PostgreSQL. Para que RLS y las funciones de la
base sepan QUIÉN hace cada operación, cada petición abre una transacción
"como el usuario": cambia al rol `authenticated` y le pasa su id de Supabase
Auth, igual que lo hace Supabase internamente. Las reglas de negocio viven en
la base; aquí no se repiten.
"""
import json
from collections.abc import Iterator
from contextlib import contextmanager

from psycopg import Connection
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from app.core.config import get_settings

_pool: ConnectionPool | None = None


def _pool_activo() -> ConnectionPool:
    global _pool
    if _pool is None:
        _pool = ConnectionPool(
            conninfo=get_settings().database_url,
            min_size=1,
            max_size=5,
            # prepare_threshold=None: necesario con el "Transaction pooler" de Supabase
            kwargs={"row_factory": dict_row, "prepare_threshold": None, "connect_timeout": 10},
            open=True,
        )
    return _pool


def cerrar_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None


@contextmanager
def conexion_usuario(id_auth: str) -> Iterator[Connection]:
    """Transacción que actúa como el usuario que inició sesión (respeta RLS)."""
    claims = json.dumps({"sub": id_auth, "role": "authenticated"})
    with _pool_activo().connection() as conn:
        with conn.transaction():
            # Una sola ida a la base: usuario + rol, solo para esta transacción
            conn.execute(
                "select set_config('request.jwt.claims', %s, true), set_config('role', 'authenticated', true)",
                (claims,),
            )
            yield conn


@contextmanager
def conexion_sistema() -> Iterator[Connection]:
    """Transacción del propio sistema (sin usuario). Solo para el control de acceso."""
    with _pool_activo().connection() as conn:
        with conn.transaction():
            yield conn
