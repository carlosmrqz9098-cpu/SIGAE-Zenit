import type { ComponentType } from "react";
import { Marco } from "./components/Marco";
import { Cargando, ProveedorAvisos, Vacio } from "./components/ui";
import { coincide, Enlace, Enrutador, useRuta } from "./lib/router";
import { ProveedorSesion, useSesion } from "./lib/sesion";
import type { Rol } from "./lib/tipos";
import { puedeVer } from "./rutas";

import { Actividades } from "./pages/Actividades";
import { Aulas } from "./pages/Aulas";
import { Bitacora } from "./pages/Bitacora";
import { Catalogo } from "./pages/Catalogo";
import { Grupo } from "./pages/Grupo";
import { Inicio } from "./pages/Inicio";
import { Login } from "./pages/Login";
import { Materiales } from "./pages/Materiales";
import { MisGrupos } from "./pages/MisGrupos";
import { MisInscripciones } from "./pages/MisInscripciones";
import { Parametros } from "./pages/Parametros";
import { Periodos } from "./pages/Periodos";
import { Tareas } from "./pages/Tareas";
import { Usuarios } from "./pages/Usuarios";

const TODOS: Rol[] = ["Administrador", "Personal", "Docente", "Alumno"];
const GESTION: Rol[] = ["Administrador", "Personal"];

type Pagina = ComponentType<{ params: Record<string, string> }>;
const RUTAS: { patron: string; pagina: Pagina; roles: Rol[]; responsable?: boolean }[] = [
  { patron: "/", pagina: Inicio, roles: TODOS },
  { patron: "/catalogo", pagina: Catalogo, roles: ["Alumno"] },
  { patron: "/mis-inscripciones", pagina: MisInscripciones, roles: ["Alumno"] },
  { patron: "/actividades/:id/materiales", pagina: Materiales, roles: TODOS },
  { patron: "/grupos", pagina: MisGrupos, roles: ["Docente"], responsable: true },
  { patron: "/grupos/:id", pagina: Grupo, roles: ["Docente", ...GESTION], responsable: true },
  { patron: "/actividades", pagina: Actividades, roles: GESTION },
  { patron: "/periodos", pagina: Periodos, roles: GESTION },
  { patron: "/aulas", pagina: Aulas, roles: GESTION },
  { patron: "/usuarios", pagina: Usuarios, roles: GESTION },
  { patron: "/parametros", pagina: Parametros, roles: GESTION },
  { patron: "/bitacora", pagina: Bitacora, roles: ["Administrador"] },
  { patron: "/tareas", pagina: Tareas, roles: ["Administrador"] },
];

function Contenido() {
  const { usuario, cargando } = useSesion();
  const { ruta } = useRuta();
  if (cargando) return <Cargando texto="Abriendo SIGAE…" />;
  if (!usuario) return <Login />;

  for (const r of RUTAS) {
    const params = coincide(r.patron, ruta);
    if (!params) continue;
    const Pagina = r.pagina;
    return (
      <Marco>
        {puedeVer(r, usuario) ? (
          <Pagina params={params} />
        ) : (
          <Vacio titulo="No tienes acceso a esta sección" texto="Tu rol no tiene permiso para ver esta página."
            accion={<Enlace a="/" className="btn btn-secundario">Volver al inicio</Enlace>} />
        )}
      </Marco>
    );
  }
  return (
    <Marco>
      <Vacio titulo="Esta página no existe" texto="Revisa la dirección o regresa al inicio."
        accion={<Enlace a="/" className="btn btn-secundario">Volver al inicio</Enlace>} />
    </Marco>
  );
}

export function App() {
  return (
    <Enrutador>
      <ProveedorAvisos>
        <ProveedorSesion>
          <Contenido />
        </ProveedorSesion>
      </ProveedorAvisos>
    </Enrutador>
  );
}
