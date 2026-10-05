/**
 * Métodos y cómo regenerar: bloque plegable con una línea por método (Gurobi, Algoritmo 2.1
 * e ILS, con parámetros leídos de los archivos), los comandos y la referencia del paper.
 */
import type { ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { fmt } from '../../lib/format';
import { Disclosure } from '../ui';
import type { HeurInstance } from './data';
import { ERDOGAN_REF, HEUR_METHODS, MethodMark } from './methods';

const RUN_DP = 'python notebooks/tsppd_h_alg21_dp.py --customers 5 10 --all-ids';
const RUN_ILS = 'python notebooks/tsppd_h_alg42_ils.py --customers 5 10 --all-ids';

export function MethodNote({ instances }: { instances: HeurInstance[] }) {
  const params = instances.find((x) => x.ils?.params)?.ils?.params;
  const runs = params?.runs;

  return (
    <Disclosure summary="Métodos y cómo regenerar">
      <ul className="space-y-2">
        <Item
          mark={
            <span className="flex gap-1">
              <MethodMark tone="general" size={11} />
              <MethodMark tone="p1" size={11} />
              <MethodMark tone="p2" size={11} />
              <MethodMark tone="p3" size={11} />
            </span>
          }
          title="Gurobi"
        >
          óptimo exacto de ruta y carga (Battarra et al., 2010).
        </Item>
        <Item mark={<MethodMark tone="dp" size={12} />} title={HEUR_METHODS.dp.label}>
          menor manipulación de P3 sobre una ruta fija ({HEUR_METHODS.dp.reference}).
        </Item>
        <Item mark={<MethodMark tone="ils" size={12} />} title={HEUR_METHODS.ils.label}>
          busca la ruta con relocate y 2-opt, evaluada con el Alg. 2.1
          {params ? (
            <>
              {' '}
              (<span className="num text-zinc-300">{fmt(params.nIter, 0)}</span> iter. por dirección
              {runs ? (
                <>
                  , <span className="num text-zinc-300">{fmt(runs, 0)}</span> corridas
                </>
              ) : null}
              )
            </>
          ) : null}
          .
        </Item>
      </ul>

      <p className="mt-4">Regenerar (Outputs/Erdogan2012/) y pulsar recargar:</p>
      <div className="mt-2 space-y-1.5">
        <Command>{RUN_DP}</Command>
        <Command>{RUN_ILS}</Command>
      </div>

      <a
        href={`https://doi.org/${ERDOGAN_REF.doi}`}
        target="_blank"
        rel="noreferrer"
        className="group mt-4 inline-flex items-center gap-1 rounded-md text-[12px] text-zinc-400 transition-colors hover:text-zinc-50"
      >
        Erdoğan et al. (2012) · doi:{ERDOGAN_REF.doi}
        <ArrowUpRight aria-hidden className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        <span className="sr-only">(se abre en una pestaña nueva)</span>
      </a>
    </Disclosure>
  );
}

function Item({ mark, title, children }: { mark: ReactNode; title: string; children: ReactNode }) {
  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {mark}
      <span className="font-medium text-zinc-200">{title}:</span>
      <span>{children}</span>
    </li>
  );
}

function Command({ children }: { children: string }) {
  return (
    <code className="scrollbar-thin block overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 py-1.5 font-mono text-[12px] whitespace-pre text-zinc-300">
      {children}
    </code>
  );
}
