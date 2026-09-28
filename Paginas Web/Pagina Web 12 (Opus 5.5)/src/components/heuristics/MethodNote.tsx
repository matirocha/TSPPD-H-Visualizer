/**
 * Qué se compara: una explicación breve de cada método (Gurobi, Algoritmo 2.1 e ILS) con
 * sus parámetros leídos de los archivos, y los comandos para regenerar los resultados.
 */
import type { ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { fmt } from '../../lib/format';
import { SpotlightCard } from '../ui';
import type { HeurInstance } from './data';
import { ERDOGAN_REF, HEUR_METHODS, MethodMark } from './methods';

const RUN_DP = 'python notebooks/tsppd_h_alg21_dp.py --customers 5 10 --all-ids';
const RUN_ILS = 'python notebooks/tsppd_h_alg42_ils.py --customers 5 10 --all-ids';

export function MethodNote({ instances }: { instances: HeurInstance[] }) {
  const params = instances.find((x) => x.ils?.params)?.ils?.params;
  const runs = params?.runs;

  return (
    <SpotlightCard className="p-5 sm:p-6">
      <p className="eyebrow">Qué se compara</p>
      <h3 className="mt-1.5 text-lg font-semibold tracking-tight text-zinc-50">Tres formas de obtener el costo</h3>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
        <Item
          mark={
            <span className="flex gap-1">
              <MethodMark tone="general" size={11} />
              <MethodMark tone="p1" size={11} />
              <MethodMark tone="p2" size={11} />
              <MethodMark tone="p3" size={11} />
            </span>
          }
          title="Gurobi · modelos exactos"
          subtitle="Battarra et al. (2010)"
        >
          Resuelven de forma óptima la ruta y la carga a la vez: el Modelo General acomoda la carga libremente; la Política 1 deja las β en la
          compuerta, la 2 al fondo y la 3 elige entre ambas en cada cliente.
        </Item>
        <Item mark={<MethodMark tone="dp" size={12} />} title={HEUR_METHODS.dp.label} subtitle={`${HEUR_METHODS.dp.reference} · ${HEUR_METHODS.dp.script}`}>
          No busca rutas: recibe una ruta fija y calcula, con programación dinámica, la menor manipulación posible de la Política 3 (Política 1 o 2
          en cada cliente).
        </Item>
        <Item mark={<MethodMark tone="ils" size={12} />} title={HEUR_METHODS.ils.label} subtitle={`${HEUR_METHODS.ils.reference} · ${HEUR_METHODS.ils.script}`}>
          Busca la ruta: parte de un tour TSP, lo perturba al azar y lo mejora con movimientos relocate y 2-opt, midiendo cada ruta con el
          Algoritmo 2.1
          {params ? (
            <>
              {' '}
              (<span className="num text-zinc-300">{fmt(params.nIter, 0)}</span> iteraciones por dirección
              {runs ? (
                <>
                  , <span className="num text-zinc-300">{fmt(runs, 0)}</span> corridas por instancia
                </>
              ) : null}
              )
            </>
          ) : null}
          .
        </Item>
      </div>

      <div className="mt-5 flex flex-col gap-3 border-t border-zinc-800/70 pt-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-[12px] text-zinc-500">Para regenerar los resultados (Outputs/Erdogan2012/) y luego pulsar recargar:</p>
          <div className="mt-2 space-y-1.5">
            <Command>{RUN_DP}</Command>
            <Command>{RUN_ILS}</Command>
          </div>
        </div>
        <a
          href={`https://doi.org/${ERDOGAN_REF.doi}`}
          target="_blank"
          rel="noreferrer"
          className="group inline-flex shrink-0 items-center gap-1 self-start rounded-md text-[12px] text-zinc-400 transition-colors hover:text-zinc-50 lg:self-auto"
        >
          Erdoğan et al. (2012) · doi:{ERDOGAN_REF.doi}
          <ArrowUpRight aria-hidden className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          <span className="sr-only">(se abre en una pestaña nueva)</span>
        </a>
      </div>
    </SpotlightCard>
  );
}

function Item({ mark, title, subtitle, children }: { mark: ReactNode; title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/30 p-4">
      <p className="flex items-center gap-2 text-[13.5px] font-medium text-zinc-100">
        {mark}
        {title}
      </p>
      <p className="mt-0.5 font-mono text-[11px] break-all text-zinc-500">{subtitle}</p>
      <p className="mt-2.5 text-[13px] leading-relaxed text-pretty text-zinc-400">{children}</p>
    </div>
  );
}

function Command({ children }: { children: string }) {
  return (
    <code className="scrollbar-thin block overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 py-1.5 font-mono text-[12px] whitespace-pre text-zinc-300">
      {children}
    </code>
  );
}
