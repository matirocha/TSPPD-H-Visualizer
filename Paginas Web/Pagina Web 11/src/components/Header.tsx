import React, { useRef } from "react";
import { SolutionData, SolutionFileSummary } from "../types/tsppd";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { 
  Truck, 
  FolderOpen, 
  Upload, 
  RefreshCw, 
  HelpCircle,
  FileText,
  Layers
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription
} from "./ui/dialog";

interface HeaderProps {
  currentSolution: SolutionData | null;
  solutionsList: SolutionFileSummary[];
  selectedFilename: string;
  onSelectSolution: (filename: string) => void;
  onUploadSolution: (data: SolutionData, filename: string) => void;
  onRefreshList: () => void;
  isLoading: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentSolution,
  solutionsList,
  selectedFilename,
  onSelectSolution,
  onUploadSolution,
  onRefreshList,
  isLoading,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed: SolutionData = JSON.parse(text);
        if (!parsed.tour || !parsed.steps || !parsed.nodes) {
          alert("El archivo no tiene el formato esperado de solución TSPPD-H.");
          return;
        }
        onUploadSolution(parsed, file.name);
      } catch (err) {
        alert("Error al parsear el archivo JSON/TXT: " + err);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-3 sm:px-6">
        {/* Brand & Title */}
        <div className="flex items-center space-x-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 text-emerald-400 shadow-inner">
            <Truck className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-bold tracking-tight text-white sm:text-lg">
                TSPPD-H Visualizer
              </h1>
              <Badge variant="default" className="text-[10px] px-1.5 py-0 uppercase tracking-wider font-mono">
                Gurobi Opt
              </Badge>
            </div>
            <p className="text-xs text-zinc-400 hidden sm:block">
              Simulación cinemática LIFO y despacho óptimo con pickup, delivery y handling
            </p>
          </div>
        </div>

        {/* Action Controls & Solution Selector */}
        <div className="flex items-center space-x-2.5">
          {/* Solution Selector Dropdown */}
          <div className="flex items-center space-x-1.5 bg-zinc-900 border border-zinc-800 rounded-lg p-1">
            <FolderOpen className="h-4 w-4 text-emerald-400 ml-2" />
            <select
              value={selectedFilename}
              onChange={(e) => onSelectSolution(e.target.value)}
              className="bg-transparent text-xs text-zinc-200 font-medium focus:outline-none pr-3 py-1 cursor-pointer"
            >
              {solutionsList.map((item) => (
                <option key={item.filename} value={item.filename} className="bg-zinc-900 text-zinc-200">
                  {item.filename.replace('.txt', '')} (ID:{item.instanceId}, Z:{item.objectiveValue})
                </option>
              ))}
            </select>
          </div>

          {/* Refresh Solutions Button */}
          <Button
            variant="outline"
            size="iconSm"
            onClick={onRefreshList}
            disabled={isLoading}
            title="Recargar soluciones de la carpeta Outputs"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-zinc-400 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
          </Button>

          {/* Upload Custom File */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".txt,.json"
            className="hidden"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="hidden md:flex text-xs h-8 space-x-1.5"
            title="Cargar solución externa (.txt / .json)"
          >
            <Upload className="h-3.5 w-3.5 text-cyan-400" />
            <span>Cargar Solución</span>
          </Button>

          {/* Mathematical Model Info Modal */}
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="iconSm" title="Información del Modelo TSPPD-H">
                <HelpCircle className="h-4 w-4 text-zinc-400 hover:text-zinc-200" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <div className="flex items-center space-x-2">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                    <Layers className="h-5 w-5" />
                  </div>
                  <div>
                    <DialogTitle>Modelo Matemático TSPPD-H</DialogTitle>
                    <DialogDescription>
                      Traveling Salesman Problem with Pickup and Delivery and Handling
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4 text-xs text-zinc-300 mt-2 leading-relaxed">
                <div className="rounded-lg bg-zinc-950 p-3 border border-zinc-800 space-y-1">
                  <span className="font-semibold text-emerald-400">1. Política LIFO (Last-In-First-Out)</span>
                  <p className="text-zinc-400">
                    El vehículo posee una única puerta trasera. Las mercancías recolectadas se colocan en ranuras accesibles por la compuerta.
                  </p>
                </div>

                <div className="rounded-lg bg-zinc-950 p-3 border border-zinc-800 space-y-1">
                  <span className="font-semibold text-rose-400">2. Mercancías α (Entrega) y β (Recolección)</span>
                  <p className="text-zinc-400">
                    - <strong className="text-rose-400">Tipo α (Alpha):</strong> Se cargan en el depósito y deben entregarse a los clientes correspondientes.<br/>
                    - <strong className="text-cyan-400">Tipo β (Beta):</strong> Se recolectan en los clientes para llevarlas al depósito.
                  </p>
                </div>

                <div className="rounded-lg bg-zinc-950 p-3 border border-zinc-800 space-y-1">
                  <span className="font-semibold text-amber-400">3. Manipulación / Handling Conflict</span>
                  <p className="text-zinc-400">
                    Si al llegar a un cliente se debe entregar mercancía α pero cajas β recolectadas previamente bloquean la compuerta trasera, 
                    las cajas β deben descargarse temporalmente y volverse a cargar. Cada movimiento incurre en un costo unitario <code className="text-amber-300 font-mono">h</code>.
                  </p>
                </div>

                <div className="rounded-lg bg-zinc-950 p-3 border border-zinc-800 space-y-1">
                  <span className="font-semibold text-zinc-200">4. Función Objetivo Z</span>
                  <p className="text-zinc-400 font-mono">
                    Min Z = Costo_Ruteo(Distancia) + Costo_Handling(h × operaciones)
                  </p>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </header>
  );
};
