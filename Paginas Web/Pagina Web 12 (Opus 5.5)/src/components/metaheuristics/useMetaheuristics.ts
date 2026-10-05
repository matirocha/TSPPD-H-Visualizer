/**
 * Carga del benchmark de metaheurísticas y de las cifras del paper (Outputs/BenchmarkErdogan2012/,
 * vía /api/metaheuristics o el paquete estático solutions/metaheuristics.json) para la sección
 * «Metaheurísticas». Mismo esquema que useBenchmark: con la API en vivo se sondea cada minuto
 * mientras falten ejecuciones de la grilla y la pestaña esté visible; los sondeos no vuelven a
 * `loading` y, si fallan, se conserva lo último bueno.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCatalog } from '../../state/SimulationProvider';
import { fetchMetaheuristics } from '../../lib/api';
import type { ItsNrandFile, MetaFile, PaperFile } from '../../types/metaheuristics';
import { progressOf } from './aggregate';

export const METAHEURISTICS_POLL_MS = 60_000;

export interface MetaheuristicsState {
  file: MetaFile | null;
  paper: PaperFile | null;
  /** Experimento de sensibilidad del ITS exacto a Nrand (its_nrand.json), si existe. */
  itsNrand: ItsNrandFile | null;
  loading: boolean;
  error: string | null;
  lastLoadedAt: number | null;
  reload: () => void;
  /** true mientras el sondeo automático está activo. */
  live: boolean;
}

type LoadMode = 'initial' | 'manual' | 'poll';

function signatureOf(file: MetaFile | null): string {
  if (!file) return 'null';
  let last = '';
  for (const r of file.records) if (r.finishedAt > last) last = r.finishedAt;
  return `${file.generatedAt}|${file.records.length}|${last}`;
}

const isDocumentVisible = () => typeof document === 'undefined' || document.visibilityState !== 'hidden';

export function useMetaheuristics(): MetaheuristicsState {
  const { source, solutions } = useCatalog();
  const [state, setState] = useState<{
    file: MetaFile | null;
    paper: PaperFile | null;
    itsNrand: ItsNrandFile | null;
    loading: boolean;
    error: string | null;
    lastLoadedAt: number | null;
    attemptAt: number | null;
  }>({ file: null, paper: null, itsNrand: null, loading: true, error: null, lastLoadedAt: null, attemptAt: null });
  const [visible, setVisible] = useState(isDocumentVisible);

  const aliveRef = useRef(true);
  const seqRef = useRef(0);
  const inflightRef = useRef(0);
  const fileRef = useRef<MetaFile | null>(null);
  const paperRef = useRef<PaperFile | null>(null);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const load = useCallback(
    async (mode: LoadMode) => {
      if (!source) return;
      if (mode === 'poll' && inflightRef.current > 0) return;
      const id = ++seqRef.current;
      inflightRef.current++;
      if (mode !== 'poll') setState((s) => (s.loading ? s : { ...s, loading: true }));
      try {
        const next = await fetchMetaheuristics(source);
        if (!aliveRef.current || id !== seqRef.current) return;
        const now = Date.now();
        if (mode === 'poll' && next.data === null && fileRef.current) {
          setState((s) => ({ ...s, loading: false, attemptAt: now }));
          return;
        }
        const prev = fileRef.current;
        const file = prev && next.data && signatureOf(prev) === signatureOf(next.data) ? prev : next.data;
        const paper = next.paper ?? paperRef.current;
        fileRef.current = file;
        paperRef.current = paper;
        setState((s) => ({
          file,
          paper,
          itsNrand: next.itsNrand ?? s.itsNrand,
          loading: false,
          error: null,
          lastLoadedAt: now,
          attemptAt: now,
        }));
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

  useEffect(() => {
    if (source) void load('initial');
  }, [source, solutions, load]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onChange = () => setVisible(isDocumentVisible());
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);

  const complete = useMemo(() => !!state.file && progressOf(state.file).complete, [state.file]);
  const live = source === 'api' && visible && !complete && state.lastLoadedAt !== null;

  const { attemptAt } = state;
  useEffect(() => {
    if (!live) return;
    const wait = Math.max(0, (attemptAt ?? Date.now()) + METAHEURISTICS_POLL_MS - Date.now());
    const timer = window.setTimeout(() => void load('poll'), wait);
    return () => window.clearTimeout(timer);
  }, [live, attemptAt, load]);

  const reload = useCallback(() => {
    void load('manual');
  }, [load]);

  return {
    file: state.file,
    paper: state.paper,
    itsNrand: state.itsNrand,
    loading: state.loading,
    error: state.error,
    lastLoadedAt: state.lastLoadedAt,
    reload,
    live,
  };
}
