import React, { useState } from "react";
import { SolutionSummary, SolutionData } from "@/types/tsppd";
import { X, RefreshCw, FileText, Upload, Check, Search, Sparkles, Navigation, Layers, Info } from "lucide-react";

interface SolutionSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  solutions: SolutionSummary[];
  selectedFilename: string;
  onSelectSolution: (filename: string) => void;
  onUploadCustomFile: (data: SolutionData, filename: string) => void;
  onRefresh: () => void;
  loading: boolean;
}

export const SolutionSelector: React.FC<SolutionSelectorProps> = ({
  isOpen,
  onClose,
  solutions,
  selectedFilename,
  onSelectSolution,
  onUploadCustomFile,
  onRefresh,
  loading,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [dragActive, setDragActive] = useState(false);

  if (!isOpen) return null;

  const filteredSolutions = solutions.filter((s) => {
    const term = searchTerm.toLowerCase();
    return (
      s.filename.toLowerCase().includes(term) ||
      `id ${s.instanceId}`.includes(term) ||
      `id${s.instanceId}`.includes(term) ||
      `${s.numCustomers} clientes`.includes(term)
    );
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    readFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) readFile(file);
  };

  const readFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed: SolutionData = JSON.parse(text);
        if (parsed.tour && parsed.nodes && parsed.steps) {
          onUploadCustomFile(parsed, file.name);
          onClose();
        } else {
          alert("El archivo no tiene el formato válido de solución TSPPD-H.");
        }
      } catch (err: any) {
        alert("Error al leer el archivo JSON/.txt: " + err.message);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-700/80 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Seleccionar Solución Óptima
                <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-normal">
                  Carpeta Outputs/
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Selecciona una de las instancias resueltas con Gurobi o sube un archivo .txt personalizado
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              disabled={loading}
              className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-all active:scale-95 disabled:opacity-50"
              title="Refrescar lista de Outputs"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-cyan-400" : ""}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-all active:scale-95"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search & Upload bar */}
        <div className="p-4 border-b border-zinc-800/80 bg-zinc-900/50 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Buscar por ID, clientes o nombre (ej: ID 1, ID 5)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
            />
          </div>

          {/* File Upload Button */}
          <label className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-medium cursor-pointer transition-all active:scale-95">
            <Upload className="w-4 h-4" />
            <span>Cargar archivo .txt</span>
            <input type="file" accept=".txt,.json" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>

        {/* Drag & Drop Area & Solutions Grid */}
        <div
          className="p-5 overflow-y-auto flex-1 space-y-4"
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
        >
          {dragActive && (
            <div className="border-2 border-dashed border-cyan-400 bg-cyan-500/10 rounded-xl p-8 text-center animate-pulse">
              <Upload className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-cyan-200">Suelta el archivo .txt aquí para visualizarlo</p>
            </div>
          )}

          {filteredSolutions.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">
              <Info className="w-8 h-8 mx-auto mb-2 text-zinc-600" />
              <p className="text-sm font-medium">No se encontraron soluciones que coincidan con la búsqueda.</p>
              <p className="text-xs text-zinc-600 mt-1">Asegúrate de que existan archivos .txt en la carpeta Outputs/</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredSolutions.map((sol) => {
                const isSelected = sol.filename === selectedFilename;
                return (
                  <div
                    key={sol.filename}
                    onClick={() => {
                      onSelectSolution(sol.filename);
                      onClose();
                    }}
                    className={`p-4 rounded-xl border transition-all cursor-pointer relative group flex flex-col justify-between gap-3 ${
                      isSelected
                        ? "bg-cyan-950/30 border-cyan-500/60 shadow-lg shadow-cyan-950/50 ring-1 ring-cyan-500/50"
                        : "bg-zinc-950/60 hover:bg-zinc-800/60 border-zinc-800 hover:border-zinc-700"
                    }`}
                  >
                    {/* Top Row: Title and Badges */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                            Instancia ID {sol.instanceId || "?"}
                          </span>
                          <span className="text-xs text-zinc-400 font-medium">
                            {sol.numCustomers} Clientes · h={sol.h}
                          </span>
                        </div>
                        <h3 className="text-sm font-semibold text-zinc-100 mt-1 font-mono group-hover:text-cyan-300 transition-colors">
                          {sol.filename}
                        </h3>
                      </div>

                      {isSelected && (
                        <div className="p-1 rounded-full bg-cyan-500 text-zinc-950">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      )}
                    </div>

                    {/* Stats Row */}
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-zinc-800/80 text-center">
                      <div className="bg-zinc-900/80 p-2 rounded-lg border border-zinc-800">
                        <span className="text-[10px] text-emerald-400 block font-medium flex items-center justify-center gap-1">
                          <Sparkles className="w-2.5 h-2.5" /> F. Objetivo
                        </span>
                        <span className="font-mono text-xs font-bold text-zinc-100">
                          {sol.objectiveValue.toFixed(2)}
                        </span>
                      </div>

                      <div className="bg-zinc-900/80 p-2 rounded-lg border border-zinc-800">
                        <span className="text-[10px] text-amber-400 block font-medium flex items-center justify-center gap-1">
                          <Navigation className="w-2.5 h-2.5" /> Ruteo
                        </span>
                        <span className="font-mono text-xs font-bold text-zinc-100">
                          {sol.totalDistance}
                        </span>
                      </div>

                      <div className="bg-zinc-900/80 p-2 rounded-lg border border-zinc-800">
                        <span className="text-[10px] text-purple-400 block font-medium flex items-center justify-center gap-1">
                          <Layers className="w-2.5 h-2.5" /> Handling
                        </span>
                        <span className="font-mono text-xs font-bold text-zinc-100">
                          {sol.handlingCost.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950/60 flex items-center justify-between text-xs text-zinc-400">
          <span>
            Mostrando <strong>{filteredSolutions.length}</strong> de <strong>{solutions.length}</strong> soluciones
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
