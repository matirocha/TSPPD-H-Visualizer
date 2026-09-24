import { lazy, Suspense } from 'react';
import { MotionConfig } from 'motion/react';
import { useCatalog, SimulationProvider } from './state/SimulationProvider';
import { UIProvider } from './state/UIProvider';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { TopBar } from './components/TopBar';
import { MetricsBento } from './components/MetricsBento';
import { RouteMap } from './components/RouteMap';
import { StopPanel } from './components/StopPanel';
import { CargoBay } from './components/CargoBay';
import { Transport } from './components/Transport';
import { Ledger } from './components/Ledger';
import { Compare } from './components/Compare';
import { InstanceData } from './components/InstanceData';
import { MiniDock } from './components/MiniDock';
import { Explorer } from './components/Explorer';
import { CommandPalette } from './components/CommandPalette';
import { ShortcutsDialog } from './components/ShortcutsDialog';
import { Footer } from './components/Footer';
import { ErrorBanner, LoadingStage } from './components/StatusScreens';

// KaTeX (fuentes + CSS) solo se descarga cuando se monta la sección del modelo.
const Formulation = lazy(() => import('./components/Formulation').then((m) => ({ default: m.Formulation })));

/** Luz ambiental (patrón Aurora): tenues destellos α (cálido) y β (frío) desenfocados. */
function Aurora() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      <div className="absolute -top-48 -left-40 h-[520px] w-[720px] rounded-full bg-alpha/[0.07] blur-[120px]" />
      <div className="absolute -top-56 right-[-10%] h-[520px] w-[760px] rounded-full bg-beta/[0.06] blur-[130px]" />
      <div className="absolute top-[38%] left-1/2 h-[380px] w-[900px] -translate-x-1/2 rounded-full bg-zinc-100/[0.025] blur-[140px]" />
      <div className="grid-dots absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_70%)]" />
    </div>
  );
}

/** Atajos globales en una hoja: su suscripción a la reproducción no re-renderiza la página. */
function KeyboardShortcuts() {
  useKeyboardShortcuts();
  return null;
}

function Shell() {
  // Solo catálogo/solución: la reproducción (sub-pasos, estado) no re-renderiza el armazón.
  const { solution, error } = useCatalog();

  return (
    <div className="relative min-h-dvh overflow-x-clip">
      <KeyboardShortcuts />
      <Aurora />
      <TopBar />
      <main className="relative z-10 mx-auto w-full max-w-[1600px] px-4 pb-28 sm:px-6 lg:px-8">
        {error && <ErrorBanner />}
        {!solution ? (
          <LoadingStage />
        ) : (
          <>
            <section id="simulador" aria-label="Simulador" className="space-y-4 pt-5 lg:pt-6">
              <MetricsBento />
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
                <div className="min-w-0 xl:col-span-7">
                  <RouteMap />
                </div>
                <div className="min-w-0 xl:col-span-5">
                  <StopPanel />
                </div>
              </div>
              <CargoBay />
              <Transport />
            </section>
            <section id="bitacora" className="scroll-mt-20 pt-24">
              <Ledger />
            </section>
            <section id="comparativa" className="scroll-mt-20 pt-24">
              <Compare />
            </section>
            <section id="modelo" className="scroll-mt-20 pt-24">
              <Suspense fallback={<div className="surface h-[640px] animate-pulse" aria-busy="true" />}>
                <Formulation />
              </Suspense>
            </section>
            <section id="datos" className="scroll-mt-20 pt-24">
              <InstanceData />
            </section>
          </>
        )}
      </main>
      <Footer />
      <MiniDock />
      <Explorer />
      <CommandPalette />
      <ShortcutsDialog />
    </div>
  );
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <SimulationProvider>
        <UIProvider>
          <Shell />
        </UIProvider>
      </SimulationProvider>
    </MotionConfig>
  );
}
