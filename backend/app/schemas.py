"""Formatos de los datos que recibe la API (validación de entrada)."""
from datetime import datetime, time
from typing import Literal

import re
from typing import Annotated

from pydantic import AfterValidator, BaseModel, Field, field_validator, model_validator

_PATRON_CORREO = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _correo(v: str) -> str:
    v = v.strip().lower()
    if not _PATRON_CORREO.match(v):
        raise ValueError("Escribe un correo válido, por ejemplo nombre@pachuca.tecnm.mx")
    return v


# Misma regla que la base de datos (acepta también los correos de prueba @sigae.test)
Correo = Annotated[str, Field(max_length=150), AfterValidator(_correo)]

Rol = Literal["Administrador", "Personal", "Docente", "Alumno"]


class _Base(BaseModel):
    model_config = {"str_strip_whitespace": True}


# ------------------------------------------------------------ sesión
class Login(_Base):
    correo: Correo
    contrasena: str = Field(min_length=1, max_length=200)


class Renovar(_Base):
    refresh_token: str = Field(min_length=1)


# ------------------------------------------------------------ periodos
class PeriodoEntrada(_Base):
    nombre: str = Field(min_length=1, max_length=100)
    fecha_hora_inicio: datetime
    fecha_hora_fin: datetime

    @model_validator(mode="after")
    def _orden(self):
        if self.fecha_hora_fin <= self.fecha_hora_inicio:
            raise ValueError("La fecha de fin debe ser posterior a la de inicio")
        return self


# ------------------------------------------------------------ aulas
class AulaEntrada(_Base):
    nombre: str = Field(min_length=1, max_length=100)
    ubicacion: str | None = Field(default=None, max_length=150)
    capacidad: int = Field(gt=0, le=10000)


# ------------------------------------------------------------ actividades
class ActividadEntrada(_Base):
    id_periodo: int
    id_aula: int
    id_responsable: int
    nombre: str = Field(min_length=1, max_length=150)
    descripcion: str | None = Field(default=None, max_length=500)
    dias: str = Field(min_length=1, max_length=50)
    hora_inicio: time
    hora_fin: time
    cupo_maximo: int = Field(gt=0, le=10000)

    @model_validator(mode="after")
    def _horas(self):
        if self.hora_fin <= self.hora_inicio:
            raise ValueError("La hora de fin debe ser posterior a la de inicio")
        return self


# ------------------------------------------------------------ usuarios
class UsuarioNuevo(_Base):
    nombre: str = Field(min_length=1, max_length=150)
    correo: Correo
    rol: Rol
    matricula: str | None = Field(default=None, max_length=20)
    contrasena: str = Field(min_length=8, max_length=72)

    @model_validator(mode="after")
    def _matricula(self):
        if self.rol == "Alumno" and not self.matricula:
            raise ValueError("Los alumnos necesitan matrícula")
        if self.rol != "Alumno":
            self.matricula = None
        return self


class UsuarioCambios(_Base):
    nombre: str = Field(min_length=1, max_length=150)
    rol: Rol
    matricula: str | None = Field(default=None, max_length=20)
    activo: bool

    @model_validator(mode="after")
    def _matricula(self):
        if self.rol == "Alumno" and not self.matricula:
            raise ValueError("Los alumnos necesitan matrícula")
        if self.rol != "Alumno":
            self.matricula = None
        return self


class NuevaContrasena(_Base):
    contrasena: str = Field(min_length=8, max_length=72)


# ------------------------------------------------------------ parámetros
class ParametroEntrada(_Base):
    valor: str = Field(max_length=100)


# ------------------------------------------------------------ evaluación
class Captura(_Base):
    id_inscripcion: int
    porcentaje_asistencia: float = Field(ge=0, le=100)
    evidencia_cumplida: bool


class CapturaLote(_Base):
    capturas: list[Captura] = Field(min_length=1, max_length=500)


# ------------------------------------------------------------ materiales
TIPOS_PERMITIDOS = {
    "application/pdf": (".pdf",),
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": (".docx",),
    "image/jpeg": (".jpg", ".jpeg"),
    "image/png": (".png",),
}


class SolicitudSubida(_Base):
    nombre: str = Field(min_length=1, max_length=200)
    tipo_mime: str
    tamano_bytes: int = Field(gt=0)

    @field_validator("tipo_mime")
    @classmethod
    def _tipo(cls, v: str) -> str:
        v = v.lower()
        if v not in TIPOS_PERMITIDOS:
            raise ValueError("Formato no permitido. Solo PDF, Word (.docx), JPG y PNG")
        return v

    @model_validator(mode="after")
    def _extension(self):
        if not self.nombre.lower().endswith(TIPOS_PERMITIDOS[self.tipo_mime]):
            raise ValueError("La extensión del archivo no coincide con su tipo")
        return self


class ConfirmarSubida(_Base):
    ruta: str = Field(min_length=1, max_length=300)
    nombre: str = Field(min_length=1, max_length=200)
    tipo_mime: str
