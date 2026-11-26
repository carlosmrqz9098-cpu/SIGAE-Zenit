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
Sexo = Literal["Hombre", "Mujer"]
DirigidaA = Literal["Mixta", "Varonil", "Femenil"]


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
    dirigida_a: DirigidaA = "Mixta"

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
    sexo: Sexo | None = None
    contrasena: str = Field(min_length=8, max_length=72)

    @model_validator(mode="after")
    def _matricula(self):
        if self.rol == "Alumno" and not self.matricula:
            raise ValueError("Los alumnos necesitan matrícula")
        if self.rol != "Alumno":
            self.sexo = None
            self.matricula = None
        return self


class UsuarioCambios(_Base):
    nombre: str = Field(min_length=1, max_length=150)
    rol: Rol
    matricula: str | None = Field(default=None, max_length=20)
    sexo: Sexo | None = None
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


# ------------------------------------------------------------ registro y recuperar contraseña
DOMINIO_ITP = "@pachuca.tecnm.mx"
_PATRON_NOMBRE = re.compile(r"^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+( [A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)*$")
_PATRON_MATRICULA = re.compile(r"^\d{8}$")
_PATRON_CODIGO = re.compile(r"^\d{6}$")


def _solo_letras(v: str) -> str:
    v = " ".join(v.split())  # quita espacios dobles
    if not _PATRON_NOMBRE.match(v):
        raise ValueError("Usa solo letras (se permiten acentos, ñ y espacios)")
    return v


def _correo_itp(v: str) -> str:
    if not v.endswith(DOMINIO_ITP):
        raise ValueError("Usa tu correo institucional que termina en @pachuca.tecnm.mx")
    return v


def _contrasena_segura(v: str) -> str:
    if not re.search(r"[A-Za-z]", v) or not re.search(r"\d", v):
        raise ValueError("La contraseña debe tener al menos una letra y un número")
    return v


def _codigo(v: str) -> str:
    v = v.replace(" ", "")
    if not _PATRON_CODIGO.match(v):
        raise ValueError("El código son 6 números")
    return v


Nombres = Annotated[str, Field(min_length=2, max_length=70), AfterValidator(_solo_letras)]
CorreoITP = Annotated[Correo, AfterValidator(_correo_itp)]
ContrasenaSegura = Annotated[str, Field(min_length=8, max_length=72), AfterValidator(_contrasena_segura)]
Codigo = Annotated[str, Field(max_length=10), AfterValidator(_codigo)]


def _matricula_alumno(v: str) -> str:
    if not _PATRON_MATRICULA.match(v):
        raise ValueError("La matrícula son 8 números, por ejemplo 21200123")
    return v


Matricula = Annotated[str, Field(max_length=20), AfterValidator(_matricula_alumno)]


class Registro(_Base):
    """Solo alumnos se registran solos; a los docentes los da de alta el admin."""
    nombres: Nombres
    apellidos: Nombres
    correo: CorreoITP
    matricula: Matricula
    sexo: Sexo
    contrasena: ContrasenaSegura

    @property
    def nombre_completo(self) -> str:
        return f"{self.nombres} {self.apellidos}"


class SoloCorreo(_Base):
    correo: Correo


class ConfirmarCodigo(_Base):
    correo: Correo
    codigo: Codigo


class NuevaContrasenaConCodigo(_Base):
    correo: Correo
    codigo: Codigo
    contrasena: ContrasenaSegura


class MiSexo(_Base):
    sexo: Sexo
