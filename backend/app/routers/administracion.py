"""Administración: periodos, aulas, actividades, usuarios, parámetros, bitácora
y tareas automáticas.

Permisos (se revisan aquí Y en la base de datos con RLS):
  - Administrador: todo.
  - Personal: actividades (crear, editar, estado) y consulta de usuarios,
    periodos y aulas.
"""
from fastapi import APIRouter, Depends, Query

from app.core import supabase
from app.core.database import conexion_usuario
from app.core.errores import ErrorSIGAE
from app.core.seguridad import ADMIN, PERSONAL, UsuarioActual, requiere_rol
from app.schemas import (
    ActividadEntrada,
    AulaEntrada,
    NuevaContrasena,
    ParametroEntrada,
    PeriodoEntrada,
    UsuarioCambios,
    UsuarioNuevo,
)

router = APIRouter(prefix="/api", tags=["Administración"])

solo_admin = requiere_rol(ADMIN)
admin_o_personal = requiere_rol(ADMIN, PERSONAL)


def _uno_o_404(fila, que: str):
    if fila is None:
        raise ErrorSIGAE(404, f"{que} no existe o no tienes permiso para cambiarlo", "SGN04")
    return fila


# ================================================================ periodos
@router.get("/periodos", summary="Lista de periodos")
def periodos(u: UsuarioActual = Depends(admin_o_personal)):
    with conexion_usuario(u.id_auth) as conn:
        return conn.execute(
            """
            select p.*, p.estado::text as estado,
                   (select count(*) from sigae.actividad a where a.id_periodo = p.id_periodo) as actividades
              from sigae.periodo p
             order by p.fecha_hora_inicio desc
            """
        ).fetchall()


@router.post("/periodos", status_code=201, summary="Registrar periodo")
def crear_periodo(body: PeriodoEntrada, u: UsuarioActual = Depends(solo_admin)):
    with conexion_usuario(u.id_auth) as conn:
        return conn.execute(
            """insert into sigae.periodo (nombre, fecha_hora_inicio, fecha_hora_fin)
               values (%s, %s, %s) returning id_periodo""",
            (body.nombre, body.fecha_hora_inicio, body.fecha_hora_fin),
        ).fetchone()


@router.put("/periodos/{id_periodo}", summary="Modificar periodo")
def editar_periodo(id_periodo: int, body: PeriodoEntrada, u: UsuarioActual = Depends(solo_admin)):
    with conexion_usuario(u.id_auth) as conn:
        return _uno_o_404(conn.execute(
            """update sigae.periodo set nombre = %s, fecha_hora_inicio = %s, fecha_hora_fin = %s
                where id_periodo = %s returning id_periodo""",
            (body.nombre, body.fecha_hora_inicio, body.fecha_hora_fin, id_periodo),
        ).fetchone(), "El periodo")


# ================================================================ aulas
@router.get("/aulas", summary="Lista de aulas")
def aulas(u: UsuarioActual = Depends(admin_o_personal)):
    with conexion_usuario(u.id_auth) as conn:
        return conn.execute(
            """select au.*, (select count(*) from sigae.actividad a where a.id_aula = au.id_aula) as actividades
                 from sigae.aula au order by au.nombre"""
        ).fetchall()


@router.post("/aulas", status_code=201, summary="Registrar aula")
def crear_aula(body: AulaEntrada, u: UsuarioActual = Depends(solo_admin)):
    with conexion_usuario(u.id_auth) as conn:
        return conn.execute(
            "insert into sigae.aula (nombre, ubicacion, capacidad) values (%s, %s, %s) returning id_aula",
            (body.nombre, body.ubicacion, body.capacidad),
        ).fetchone()


@router.put("/aulas/{id_aula}", summary="Modificar aula")
def editar_aula(id_aula: int, body: AulaEntrada, u: UsuarioActual = Depends(solo_admin)):
    with conexion_usuario(u.id_auth) as conn:
        return _uno_o_404(conn.execute(
            "update sigae.aula set nombre = %s, ubicacion = %s, capacidad = %s where id_aula = %s returning id_aula",
            (body.nombre, body.ubicacion, body.capacidad, id_aula),
        ).fetchone(), "El aula")


@router.delete("/aulas/{id_aula}", status_code=204, summary="Eliminar aula sin actividades")
def borrar_aula(id_aula: int, u: UsuarioActual = Depends(solo_admin)):
    with conexion_usuario(u.id_auth) as conn:
        _uno_o_404(conn.execute(
            "delete from sigae.aula where id_aula = %s returning id_aula", (id_aula,)
        ).fetchone(), "El aula")


# ================================================================ actividades
@router.get("/actividades", summary="Todas las actividades")
def actividades(u: UsuarioActual = Depends(admin_o_personal)):
    with conexion_usuario(u.id_auth) as conn:
        return conn.execute(
            """
            select a.id_actividad, a.id_periodo, a.id_aula, a.id_responsable, a.nombre, a.descripcion,
                   a.dias, a.hora_inicio, a.hora_fin, a.cupo_maximo, a.estado::text as estado,
                   p.nombre as periodo, au.nombre as aula, r.nombre as responsable,
                   (select count(*) from sigae.inscripcion i
                     where i.id_actividad = a.id_actividad and i.estado = 'Activa') as inscritos
              from sigae.actividad a
              join sigae.periodo p on p.id_periodo = a.id_periodo
              join sigae.aula au on au.id_aula = a.id_aula
              left join sigae.usuario r on r.id_usuario = a.id_responsable
             order by p.fecha_hora_inicio desc, a.nombre
            """
        ).fetchall()


@router.get("/responsables", summary="Usuarios que pueden ser responsables de una actividad")
def responsables(u: UsuarioActual = Depends(admin_o_personal)):
    with conexion_usuario(u.id_auth) as conn:
        return conn.execute(
            """select id_usuario, nombre, rol::text as rol, matricula from sigae.usuario
                where activo and rol in ('Docente', 'Alumno') order by rol, nombre"""
        ).fetchall()


@router.post("/actividades", status_code=201, summary="Crear actividad (queda en Borrador)")
def crear_actividad(body: ActividadEntrada, u: UsuarioActual = Depends(admin_o_personal)):
    with conexion_usuario(u.id_auth) as conn:
        return conn.execute(
            """insert into sigae.actividad (id_periodo, id_aula, id_responsable, nombre, descripcion,
                                            dias, hora_inicio, hora_fin, cupo_maximo)
               values (%s, %s, %s, %s, %s, %s, %s, %s, %s) returning id_actividad""",
            (body.id_periodo, body.id_aula, body.id_responsable, body.nombre, body.descripcion,
             body.dias, body.hora_inicio, body.hora_fin, body.cupo_maximo),
        ).fetchone()


@router.put("/actividades/{id_actividad}", summary="Modificar actividad")
def editar_actividad(id_actividad: int, body: ActividadEntrada, u: UsuarioActual = Depends(admin_o_personal)):
    with conexion_usuario(u.id_auth) as conn:
        return _uno_o_404(conn.execute(
            """update sigae.actividad
                  set id_periodo = %s, id_aula = %s, id_responsable = %s, nombre = %s, descripcion = %s,
                      dias = %s, hora_inicio = %s, hora_fin = %s, cupo_maximo = %s
                where id_actividad = %s returning id_actividad""",
            (body.id_periodo, body.id_aula, body.id_responsable, body.nombre, body.descripcion,
             body.dias, body.hora_inicio, body.hora_fin, body.cupo_maximo, id_actividad),
        ).fetchone(), "La actividad")


@router.post("/actividades/{id_actividad}/desactivar", summary="Desactivar actividad")
def desactivar_actividad(id_actividad: int, u: UsuarioActual = Depends(admin_o_personal)):
    # Los demás estados (Borrador, Activa, Llena, Cerrada) los asigna el sistema.
    with conexion_usuario(u.id_auth) as conn:
        return _uno_o_404(conn.execute(
            """update sigae.actividad set estado = 'Inactiva'
                where id_actividad = %s returning id_actividad, estado::text as estado""",
            (id_actividad,),
        ).fetchone(), "La actividad")


@router.post("/actividades/{id_actividad}/reactivar", summary="Reactivar una actividad desactivada")
def reactivar_actividad(id_actividad: int, u: UsuarioActual = Depends(admin_o_personal)):
    # Vuelve a Activa (periodo activo) o Borrador (periodo programado); la base revisa todo.
    with conexion_usuario(u.id_auth) as conn:
        return _uno_o_404(conn.execute(
            "select id_actividad, estado::text as estado from sigae.reactivar_actividad(%s)", (id_actividad,)
        ).fetchone(), "La actividad")


@router.delete("/actividades/{id_actividad}", status_code=204, summary="Eliminar actividad sin inscripciones")
def borrar_actividad(id_actividad: int, u: UsuarioActual = Depends(admin_o_personal)):
    with conexion_usuario(u.id_auth) as conn:
        _uno_o_404(conn.execute(
            "delete from sigae.actividad where id_actividad = %s returning id_actividad", (id_actividad,)
        ).fetchone(), "La actividad")


# ================================================================ usuarios
@router.get("/usuarios", summary="Lista de usuarios")
def usuarios(u: UsuarioActual = Depends(admin_o_personal)):
    with conexion_usuario(u.id_auth) as conn:
        return conn.execute(
            """select id_usuario, nombre, correo, rol::text as rol, matricula, activo, creado_en
                 from sigae.usuario order by activo desc, rol, nombre"""
        ).fetchall()


@router.post("/usuarios", status_code=201, summary="Registrar usuario (crea su cuenta de acceso)")
def crear_usuario(body: UsuarioNuevo, u: UsuarioActual = Depends(solo_admin)):
    correo = body.correo.lower()
    id_auth = supabase.crear_cuenta(correo, body.contrasena)
    try:
        with conexion_usuario(u.id_auth) as conn:
            return conn.execute(
                """insert into sigae.usuario (id_auth, nombre, correo, rol, matricula, activo)
                   values (%s, %s, %s, %s::sigae.rol_usuario, %s, true) returning id_usuario""",
                (id_auth, body.nombre, correo, body.rol, body.matricula),
            ).fetchone()
    except Exception:
        supabase.borrar_cuenta(id_auth)  # sin registro en SIGAE no debe quedar cuenta suelta
        raise


@router.put("/usuarios/{id_usuario}", summary="Modificar usuario, rol o activar/desactivar")
def editar_usuario(id_usuario: int, body: UsuarioCambios, u: UsuarioActual = Depends(solo_admin)):
    with conexion_usuario(u.id_auth) as conn:
        return _uno_o_404(conn.execute(
            """update sigae.usuario set nombre = %s, rol = %s::sigae.rol_usuario, matricula = %s, activo = %s
                where id_usuario = %s returning id_usuario""",
            (body.nombre, body.rol, body.matricula, body.activo, id_usuario),
        ).fetchone(), "El usuario")


@router.put("/usuarios/{id_usuario}/contrasena", status_code=204, summary="Asignar nueva contraseña")
def contrasena_usuario(id_usuario: int, body: NuevaContrasena, u: UsuarioActual = Depends(solo_admin)):
    with conexion_usuario(u.id_auth) as conn:
        fila = _uno_o_404(conn.execute(
            "select id_auth from sigae.usuario where id_usuario = %s", (id_usuario,)
        ).fetchone(), "El usuario")
    supabase.cambiar_contrasena(str(fila["id_auth"]), body.contrasena)


# ================================================================ parámetros
@router.get("/parametros", summary="Parámetros del sistema")
def parametros(u: UsuarioActual = Depends(admin_o_personal)):
    with conexion_usuario(u.id_auth) as conn:
        return conn.execute(
            """select p.clave, p.valor, p.descripcion, p.actualizado_en, us.nombre as actualizado_por
                 from sigae.parametro_sistema p
                 left join sigae.usuario us on us.id_usuario = p.id_usuario_actualiza
                order by p.clave"""
        ).fetchall()


@router.put("/parametros/{clave}", summary="Cambiar un parámetro")
def editar_parametro(clave: str, body: ParametroEntrada, u: UsuarioActual = Depends(solo_admin)):
    with conexion_usuario(u.id_auth) as conn:
        return _uno_o_404(conn.execute(
            "update sigae.parametro_sistema set valor = %s where clave = %s returning clave, valor",
            (body.valor, clave),
        ).fetchone(), "El parámetro")


# ================================================================ bitácora y tareas
@router.get("/bitacora", summary="Bitácora de cambios (auditoría)")
def bitacora(entidad: str | None = Query(default=None, max_length=50),
             pagina: int = Query(default=1, ge=1), por_pagina: int = Query(default=25, ge=5, le=100),
             u: UsuarioActual = Depends(solo_admin)):
    with conexion_usuario(u.id_auth) as conn:
        total = conn.execute(
            "select count(*) as n from sigae.bitacora where (%s::text is null or entidad = %s)", (entidad, entidad)
        ).fetchone()["n"]
        filas = conn.execute(
            """select b.id_bitacora, b.fecha, b.origen, b.operacion, b.entidad, b.id_registro,
                      b.valores_anteriores, b.valores_nuevos, coalesce(us.nombre, 'Sistema') as usuario
                 from sigae.bitacora b
                 left join sigae.usuario us on us.id_usuario = b.id_usuario
                where (%s::text is null or b.entidad = %s)
                order by b.fecha desc, b.id_bitacora desc
                limit %s offset %s""",
            (entidad, entidad, por_pagina, (pagina - 1) * por_pagina),
        ).fetchall()
        entidades = [r["entidad"] for r in conn.execute(
            "select distinct entidad from sigae.bitacora order by 1").fetchall()]
    return {"total": total, "pagina": pagina, "por_pagina": por_pagina, "entidades": entidades, "registros": filas}


@router.get("/tareas", summary="Últimas ejecuciones de las tareas automáticas")
def tareas(u: UsuarioActual = Depends(solo_admin)):
    with conexion_usuario(u.id_auth) as conn:
        return conn.execute(
            """select id_ejecucion, tarea, inicio, fin, resultado, detalle, error
                 from sigae.ejecucion_tarea order by inicio desc limit 50"""
        ).fetchall()
