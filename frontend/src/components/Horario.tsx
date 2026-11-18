import { diasMarcados, hora } from "../lib/formato";

/** Tira de la semana estilo pizarrón del gimnasio: L M X J V S, con los días de la actividad marcados. */
export function TiraDias({ dias, inicio, fin }: { dias: string; inicio: string; fin: string }) {
  const semana = diasMarcados(dias);
  const alguno = semana.some((d) => d.activo);
  return (
    <div className="tira" aria-label={`${dias}, de ${hora(inicio)} a ${hora(fin)}`}>
      {alguno ? (
        <ol className="tira-dias" aria-hidden>
          {semana.map((d) => (
            <li key={d.corto} className={d.activo ? "on" : ""} title={d.largo}>{d.corto}</li>
          ))}
        </ol>
      ) : (
        <span className="tira-texto">{dias}</span>
      )}
      <span className="tira-hora">{hora(inicio)}–{hora(fin)}</span>
    </div>
  );
}

/** Medidor de cupo estilo marcador: cuántos lugares quedan. */
export function Marcador({ inscritos, cupo }: { inscritos: number; cupo: number }) {
  const libres = Math.max(cupo - inscritos, 0);
  const pct = cupo > 0 ? Math.min((inscritos / cupo) * 100, 100) : 0;
  const tono = libres === 0 ? "lleno" : libres <= Math.max(2, cupo * 0.15) ? "pocos" : "";
  return (
    <div className={`marcador ${tono}`}>
      <div className="marcador-cifra">
        <strong>{libres}</strong>
        <span>{libres === 1 ? "lugar libre" : "lugares libres"}</span>
      </div>
      <div className="marcador-barra" role="meter" aria-valuemin={0} aria-valuemax={cupo} aria-valuenow={inscritos}
        aria-label={`${inscritos} de ${cupo} lugares ocupados`}>
        <span style={{ width: `${pct}%` }} />
      </div>
      <small>{inscritos} de {cupo} ocupados</small>
    </div>
  );
}
