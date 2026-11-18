"""SIGAE — API (FastAPI).

Correr en tu computadora (dentro de la carpeta backend):
    uvicorn app.main:app --reload
Documentación interactiva:  http://localhost:8000/docs
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.database import cerrar_pool, conexion_sistema
from app.core.errores import registrar_manejadores
from app.routers import administracion, alumno, grupos, materiales, panel, sesion

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def ciclo_de_vida(_: FastAPI):
    yield
    cerrar_pool()


app = FastAPI(
    title="SIGAE API",
    description="Sistema de Gestión de Actividades Extra-Escolares — Instituto Tecnológico de Pachuca",
    version="1.0.0",
    lifespan=ciclo_de_vida,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().lista_cors,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

registrar_manejadores(app)

for r in (sesion, panel, alumno, grupos, materiales, administracion):
    app.include_router(r.router)


@app.get("/api/salud", tags=["Sistema"], summary="¿Está viva la API y conectada a la base?")
def salud():
    with conexion_sistema() as conn:
        conn.execute("select 1")
    return {"estado": "ok", "base_de_datos": "conectada"}
