import { useEffect, useState } from 'react';
import TruckVisualizer from './TruckVisualizer';
import { Package, Truck, Database } from 'lucide-react';
import { motion } from 'motion/react';

export default function App() {
  const [outputFiles, setOutputFiles] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [solutionData, setSolutionData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/outputs')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setOutputFiles(data);
          if (data.length > 0) {
            setSelectedFile(data[0]);
          }
        }
      })
      .catch(err => console.error("Error loading outputs:", err));
  }, []);

  useEffect(() => {
    if (selectedFile) {
      setLoading(true);
      fetch(`/api/outputs/${encodeURIComponent(selectedFile)}`)
        .then(res => res.json())
        .then(data => {
          setSolutionData(data);
          setLoading(false);
        })
        .catch(err => {
          console.error("Error loading file:", err);
          setLoading(false);
        });
    }
  }, [selectedFile]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-emerald-500/30 font-sans">
      
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20">
              <Truck className="text-emerald-400" size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">TSPPD-H Visualizer</h1>
              <div className="text-xs text-zinc-400 font-medium tracking-wider uppercase">LIFO Routing Analytics</div>
            </div>
          </div>
          
          {/* File Selector */}
          <div className="flex items-center gap-3 bg-zinc-950 border border-zinc-800 rounded-xl p-1 shadow-sm">
            <div className="pl-3 pr-2 py-2 text-zinc-500">
              <Database size={18} />
            </div>
            <select
              value={selectedFile || ''}
              onChange={(e) => setSelectedFile(e.target.value)}
              className="bg-transparent border-none text-zinc-200 text-sm font-medium focus:ring-0 cursor-pointer outline-none pr-4 py-2 appearance-none"
              style={{ WebkitAppearance: 'none' }}
            >
              {outputFiles.length === 0 ? (
                <option>Cargando outputs...</option>
              ) : (
                outputFiles.map(f => (
                  <option key={f} value={f} className="bg-zinc-900 text-zinc-100">{f}</option>
                ))
              )}
            </select>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        {loading ? (
          <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
            <motion.div 
              animate={{ rotate: 360 }} 
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            >
              <Package className="text-emerald-500" size={32} />
            </motion.div>
            <div className="text-zinc-500 font-medium animate-pulse">Cargando solución...</div>
          </div>
        ) : solutionData ? (
          <TruckVisualizer solution={solutionData} />
        ) : (
          <div className="h-[60vh] flex flex-col items-center justify-center">
            <div className="text-zinc-500 font-medium">No se pudo cargar la solución.</div>
          </div>
        )}
      </main>

    </div>
  );
}
