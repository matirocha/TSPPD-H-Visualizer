/**
 * Carga del benchmark de tiempos (Outputs/Benchmark/, vía /api/benchmark o el paquete
 * estático solutions/benchmark.json) para la sección «Tiempos».
 *
 * notebooks/tsppd_h_benchmark.py tarda horas y reescribe el consolidado tras cada ejecución,
 * así que con la API en vivo la sección se sondea cada minuto mientras falten registros de la
 * grilla y la pestaña esté visible. Los sondeos no vuelven a `loading` (sin parpadeo) y, si
 * fallan, se conserva el último archivo bueno.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCatalog } from '../../state/SimulationProvider';
import { fetchBenchmark } from '../../lib/api';
import type { BenchmarkFile } from '../../types/benchmark';
import { buildInstances, progressOf } from './aggregate';

/** Intervalo del sondeo automático (ms). */
export const BENCHMARK_POLL_MS = 60_000;

export interface BenchmarkState {
  file: BenchmarkFile | null;
  loading: boolean;
  error: string | null;
  /** Date.now() de la última carga correcta (null hasta la primera). */
  lastLoadedAt: number | null;
  reload: () => void;
  /** true mientras el sondeo automático está activo. */
  live: boolean;
}

type LoadMode = 'initial' | 'manual' | 'poll';

/**
 * ¿Están todas las combinaciones de la grilla (|Vc| × Id × h × método) registradas? Misma regla
 * que el avance de la sección (progressOf): los errores cuentan, porque el script ya terminó con
 * ellos y solo los repite en otra ejecución.
 */
const isComplete = (file: BenchmarkFile | null) => !!file && progressOf(file, buildInstances(file)).complete;

/** Huella barata para no reemplazar el archivo (ni recalcular las tablas) si nada cambió. */
function signatureOf(file: BenchmarkFile | null): string {
  if (!file) return 'null';
  let last = '';
  for (const r of file.records) if (r.finishedAt > last) last = r.finishedAt;
  return `${file.generatedAt}|${file.records.length}|${last}`;
}

const isDocumentVisible = () => typeof document === 'undefined' || document.visibilityState !== 'hidden';

/**
 * Carga al montar y cada vez que el catálogo se recarga (botón de recarga de la barra
 * superior, como useHeuristics); `reload()` fuerza una carga manual.
 */
export function useBenchmark(): BenchmarkState {
  const { source, solutions } = useCatalog();
  const [state, setState] = useState<{
    file: BenchmarkFile | null;
    loading: boolean;
    error: string | null;
    lastLoadedAt: number | null;
    /** Fin del último intento (correcto o no): programa el siguiente sondeo. */
    attemptAt: number | null;
  }>({ file: null, loading: true, error: null, lastLoadedAt: null, attemptAt: null });
  const [visible, setVisible] = useState(isDocumentVisible);

  const aliveRef = useRef(true);
  const seqRef = useRef(0);
  const inflightRef = useRef(0);
  const fileRef = useRef<BenchmarkFile | null>(null);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const load = useCallback(
    async (mode: LoadMode) => {
      if (!source) return;
      // Un sondeo no se encima con otra carga en curso (la que termine reprograma el siguiente).
      if (mode === 'poll' && inflightRef.current > 0) return;
      const id = ++seqRef.current;
      inflightRef.current++;
      if (mode !== 'poll') setState((s) => (s.loading ? s : { ...s, loading: true }));
      try {
        const next = await fetchBenchmark(source);
        if (!aliveRef.current || id !== seqRef.current) return; // respuesta obsoleta
        const now = Date.now();
        const prev = fileRef.current;
        if (mode === 'poll' && next === null && prev) {
          // Sondeo sin datos (archivo bloqueado, servidor reiniciándose…): se conserva el último bueno.
          setState((s) => ({ ...s, loading: false, attemptAt: now }));
          return;
        }
        const file = prev && next && signatureOf(prev) === signatureOf(next) ? prev : next;
        fileRef.current = file;
        setState({ file, loading: false, error: null, lastLoadedAt: now, attemptAt: now });
      } catch (err) {
        if (!aliveRef.current || id !== seqRef.current) return;
        const now = Date.now();
        if (mode === 'poll') {
          setState((s) => ({ ...s, loading: false, attemptAt: now }));
          return;
        }
        setState((s) => ({ ...s, loading: false, error: err instanceof Error ? err.message : String(err), attemptAt: now }));
      } finally {
        inflightRef.current--;
      }
    },
    [source],
  );

  // Al montar y tras cada recarga del catálogo (`solutions` cambia de identidad).
  useEffect(() => {
    if (source) void load('initial');
  }, [source, solutions, load]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onChange = () => setVisible(isDocumentVisible());
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);

  const complete = useMemo(() => isComplete(state.file), [state.file]);
  const live = source === 'api' && visible && !complete && state.lastLoadedAt !== null;

  // Sondeo: un minuto después del último intento; al volver a la pestaña, de inmediato si ya pasó.
  const { attemptAt } = state;
  useEffect(() => {
    if (!live) return;
    const wait = Math.max(0, (attemptAt ?? Date.now()) + BENCHMARK_POLL_MS - Date.now());
    const timer = window.setTimeout(() => void load('poll'), wait);
    return () => window.clearTimeout(timer);
  }, [live, attemptAt, load]);

  const reload = useCallback(() => {
    void load('manual');
  }, [load]);

  return { file: state.file, loading: state.loading, error: state.error, lastLoadedAt: state.lastLoadedAt, reload, live };
}
