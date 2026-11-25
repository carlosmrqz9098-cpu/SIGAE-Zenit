"""Pruebas de los formularios: la API debe rechazar los datos malos
antes de llegar a la base de datos (no necesitan base de datos)."""
import pytest
from pydantic import ValidationError

from app.schemas import (
    ActividadEntrada,
    AulaEntrada,
    Captura,
    Login,
    PeriodoEntrada,
    SolicitudSubida,
    UsuarioNuevo,
)

ACTIVIDAD_BUENA = {
    "id_periodo": 1,
    "id_aula": 1,
    "id_responsable": 1,
    "nombre": "Fútbol Varonil",
    "dias": "L,X,V",
    "hora_inicio": "16:00",
    "hora_fin": "18:00",
    "cupo_maximo": 25,
}


# ------------------------------------------------------------- correo
def test_correo_valido_se_acepta_y_se_guarda_en_minusculas():
    datos = Login(correo="  Alumno1@SIGAE.test ", contrasena="secreta")
    assert datos.correo == "alumno1@sigae.test"


@pytest.mark.parametrize("correo", ["sin-arroba.com", "nombre@", "@pachuca.tecnm.mx", "con espacio@itp.mx"])
def test_correo_invalido_se_rechaza(correo):
    with pytest.raises(ValidationError, match="correo válido"):
        Login(correo=correo, contrasena="secreta")


# ------------------------------------------------------------- horarios y fechas
def test_actividad_con_horario_correcto_se_acepta():
    assert ActividadEntrada(**ACTIVIDAD_BUENA).cupo_maximo == 25


def test_hora_de_fin_antes_que_la_de_inicio_se_rechaza():
    datos = {**ACTIVIDAD_BUENA, "hora_inicio": "18:00", "hora_fin": "16:00"}
    with pytest.raises(ValidationError, match="hora de fin debe ser posterior"):
        ActividadEntrada(**datos)


def test_cupo_en_cero_se_rechaza():
    with pytest.raises(ValidationError):
        ActividadEntrada(**{**ACTIVIDAD_BUENA, "cupo_maximo": 0})


def test_periodo_que_termina_antes_de_empezar_se_rechaza():
    with pytest.raises(ValidationError, match="fecha de fin debe ser posterior"):
        PeriodoEntrada(
            nombre="Agosto-Diciembre 2026",
            fecha_hora_inicio="2026-12-01T08:00:00-06:00",
            fecha_hora_fin="2026-08-01T08:00:00-06:00",
        )


def test_aula_sin_capacidad_se_rechaza():
    with pytest.raises(ValidationError):
        AulaEntrada(nombre="Gimnasio", capacidad=0)


# ------------------------------------------------------------- usuarios
def test_alumno_sin_matricula_se_rechaza():
    with pytest.raises(ValidationError, match="necesitan matrícula"):
        UsuarioNuevo(nombre="Alumno Nuevo", correo="nuevo@sigae.test", rol="Alumno", contrasena="Segura-2026")


def test_docente_no_guarda_matricula():
    u = UsuarioNuevo(
        nombre="Docente Nuevo", correo="docente@sigae.test", rol="Docente", matricula="123", contrasena="Segura-2026"
    )
    assert u.matricula is None


def test_contrasena_corta_se_rechaza():
    with pytest.raises(ValidationError):
        UsuarioNuevo(nombre="Ana", correo="ana@sigae.test", rol="Docente", contrasena="corta")


# ------------------------------------------------------------- asistencia
@pytest.mark.parametrize("porcentaje", [-1, 101])
def test_asistencia_fuera_de_0_a_100_se_rechaza(porcentaje):
    with pytest.raises(ValidationError):
        Captura(id_inscripcion=1, porcentaje_asistencia=porcentaje, evidencia_cumplida=True)


# ------------------------------------------------------------- archivos
@pytest.mark.parametrize(
    ("nombre", "tipo"),
    [
        ("reglamento.pdf", "application/pdf"),
        ("lista.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
        ("cancha.jpg", "image/jpeg"),
        ("horario.png", "image/png"),
    ],
)
def test_formatos_permitidos_se_aceptan(nombre, tipo):
    assert SolicitudSubida(nombre=nombre, tipo_mime=tipo, tamano_bytes=1000).tipo_mime == tipo


def test_archivo_exe_se_rechaza():
    with pytest.raises(ValidationError, match="Formato no permitido"):
        SolicitudSubida(nombre="virus.exe", tipo_mime="application/x-msdownload", tamano_bytes=1000)


def test_extension_que_no_coincide_con_el_tipo_se_rechaza():
    with pytest.raises(ValidationError, match="no coincide"):
        SolicitudSubida(nombre="programa.exe", tipo_mime="application/pdf", tamano_bytes=1000)
