import { Fragment, useState } from "react";
import { Boton, CajaError, Cargando, Encabezado, Vacio } from "../components/ui";
import { fechaHora } from "../lib/formato";
import { useCarga } from "../lib/useCarga";

interface Registro {
  id_bitacora: number; fecha: string; origen: string; operacion: string; entidad: string; id_registro: string | null;
  valores_anteriores: Record<string, unknown> | null; valores_nuevos: Record<string, unknown> | null; usuario: string;
}
interface Respuesta { total: number; pagina: number; por_pagina: number; entidades: string[]; registros: Registro[] }

const VERBO: Record<string, string> = { INSERT: "Registró", UPDATE: "Modificó", DELETE: "Eliminó" };

function diferencias(r: Registro) {
  const antes = r.valores_anteriores ?? {};
  const despues = r.valores_nuevos ?? {};
  const claves = Array.from(new Set([...Object.keys(antes), ...Object.keys(despues)]));
  return claves.filter((k) => JSON.stringify(antes[k]) !== JSON.stringify(despues[k])).map((k) => ({ k, antes: antes[k], despues: despues[k] }));
}

const mostrar = (v: unknown) => (v === null || v === undefined ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));

export function Bitacora() {
  const [entidad, setEntidad] = useState("");
  const [pagina, setPagina] = useState(1);
  const [abierto, setAbierto] = useState<number | null>(null);
  const { datos, error, cargando, recargar } = useCarga<Respuesta>(`/api/bitacora?pagina=${pagina}${entidad ? `&entidad=${encodeURIComponent(entidad)}` : ""}`);
  const paginas = datos ? Math.max(1, Math.ceil(datos.total / datos.por_pagina)) : 1;

  return (
    <>
      <Encabezado titulo="Bitácora" texto="Registro de todos los cambios importantes. Nadie lo puede modificar ni borrar." />
      <div className="filtros">
        <select value={entidad} onChange={(e) => { setEntidad(e.target.value); setPagina(1); }} aria-label="Filtrar por tabla">
          <option value="">Todas las tablas</option>
          {datos?.entidades.map((e) => <option key={e}>{e}</option>)}
        </select>
        {datos && <span className="texto-suave">{datos.total} registros</span>}
      </div>
      {cargando && !datos && <Cargando />}
      {error && <CajaError mensaje={error} reintentar={recargar} />}
      {datos && datos.registros.length === 0 && <Vacio titulo="Sin registros" />}
      {datos && datos.registros.length > 0 && (
        <div className="tabla-envoltura" aria-busy={cargando}>
          <table className="tabla">
            <thead><tr><th scope="col">Fecha</th><th scope="col">Quién</th><th scope="col">Qué pasó</th><th scope="col"><span className="sr">Detalle</span></th></tr></thead>
            <tbody>
              {datos.registros.map((r) => {
                const cambios = diferencias(r);
                return (
                  <Fragment key={r.id_bitacora}>
                    <tr>
                      <td data-col="Fecha">{fechaHora(r.fecha)}</td>
                      <td data-col="Quién">{r.usuario}{r.origen === "sistema" ? <span className="texto-suave"> (automático)</span> : null}</td>
                      <td data-col="Qué pasó">{VERBO[r.operacion] ?? r.operacion} en <strong>{r.entidad}</strong>{r.id_registro ? ` #${r.id_registro}` : ""}</td>
                      <td className="acciones-fila">
                        {cambios.length > 0 && (
                          <button className="btn btn-fantasma btn-chico" aria-expanded={abierto === r.id_bitacora}
                            onClick={() => setAbierto(abierto === r.id_bitacora ? null : r.id_bitacora)}>
                            {abierto === r.id_bitacora ? "Ocultar" : `${cambios.length} ${cambios.length === 1 ? "campo" : "campos"}`}
                          </button>
                        )}
                      </td>
                    </tr>
                    {abierto === r.id_bitacora && (
                      <tr className="detalle">
                        <td colSpan={4}>
                          <dl className="cambios">
                            {cambios.map((c) => (
                              <div key={c.k}><dt>{c.k}</dt><dd><del>{mostrar(c.antes)}</del><ins>{mostrar(c.despues)}</ins></dd></div>
                            ))}
                          </dl>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {datos && paginas > 1 && (
        <nav className="paginacion" aria-label="Páginas">
          <Boton variante="secundario" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>Anterior</Boton>
          <span>Página {pagina} de {paginas}</span>
          <Boton variante="secundario" disabled={pagina >= paginas} onClick={() => setPagina(pagina + 1)}>Siguiente</Boton>
        </nav>
      )}
    </>
  );
}
