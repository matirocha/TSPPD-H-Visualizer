import React from "react";
import { StepDef, SolutionData } from "../types/tsppd";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { 
  FileText, 
  HelpCircle, 
  AlertTriangle, 
  CheckCircle, 
  ArrowRight, 
  TrendingDown, 
  Coins 
} from "lucide-react";

interface ExplanationCardProps {
  currentStep: StepDef;
  currentStepIndex: number;
  totalSteps: number;
  solution: SolutionData;
}

export const ExplanationCard: React.FC<ExplanationCardProps> = ({
  currentStep,
  currentStepIndex,
  totalSteps,
  solution,
}) => {
  const hasHandling = currentStep.handlingCount > 0;

  return (
    <Card className="bg-zinc-900/60 border-zinc-800/80 shadow-md flex flex-col justify-between">
      <CardHeader className="p-4 pb-2 border-b border-zinc-800/60 bg-zinc-950/40 flex flex-row items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-400">
            <FileText className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-sm">Explicación Operativa y Matemática del Paso</CardTitle>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="text-xs font-mono">
            Etapa {currentStepIndex + 1} de {totalSteps}
          </Badge>
          {hasHandling ? (
            <Badge variant="amber" className="text-xs flex items-center space-x-1">
              <AlertTriangle className="h-3 w-3 mr-1" />
              <span>Handling Activo</span>
            </Badge>
          ) : (
            <Badge variant="default" className="text-xs flex items-center space-x-1">
              <CheckCircle className="h-3 w-3 mr-1" />
              <span>Sin Conflicto</span>
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-3">
        {/* Texto de explicación en lenguaje natural del modelo con HTML estilizado */}
        <div 
          className="rounded-lg bg-zinc-950/90 border border-zinc-800/80 p-3.5 text-xs text-zinc-300 leading-relaxed font-sans shadow-inner [&_strong]:text-white [&_strong]:font-semibold"
          dangerouslySetInnerHTML={{ __html: currentStep.explanation }}
        />

        {/* Desglose de Impacto en Función Objetivo Z */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          {/* Costo de este viaje */}
          <div className="rounded-lg bg-zinc-950/50 border border-zinc-800 p-2.5 space-y-1">
            <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold block">
              Costo de Ruteo
            </span>
            <div className="flex items-baseline space-x-1">
              <span className="text-base font-bold font-mono text-blue-400">
                +{currentStep.distance}
              </span>
              <span className="text-[10px] text-zinc-500">km</span>
            </div>
            <span className="text-[10px] text-zinc-400 block">
              Arco c({currentStep.from}, {currentStep.to})
            </span>
          </div>

          {/* Costo de Handling en este nodo */}
          <div className={`rounded-lg p-2.5 space-y-1 border ${
            hasHandling 
              ? 'bg-amber-950/20 border-amber-500/40' 
              : 'bg-zinc-950/50 border-zinc-800'
          }`}>
            <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold block">
              Costo Handling (h={solution.h})
            </span>
            <div className="flex items-baseline space-x-1">
              <span className={`text-base font-bold font-mono ${hasHandling ? 'text-amber-400' : 'text-zinc-500'}`}>
                +{currentStep.handlingCost.toFixed(2)}
              </span>
              <span className="text-[10px] text-zinc-500">penalidad</span>
            </div>
            <span className="text-[10px] text-zinc-400 block">
              {currentStep.handlingCount} ops × {solution.h}
            </span>
          </div>

          {/* Saldo de Carga en este paso */}
          <div className="rounded-lg bg-zinc-950/50 border border-zinc-800 p-2.5 space-y-1">
            <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold block">
              Balanza Neta de Carga
            </span>
            <div className="flex items-baseline space-x-1 text-xs font-mono">
              <span className="text-rose-400">-{currentStep.deliverA} α</span>
              <span className="text-zinc-500">|</span>
              <span className="text-cyan-400">+{currentStep.pickupB} β</span>
            </div>
            <span className="text-[10px] text-zinc-400 block font-mono">
              En camión: {currentStep.aOnTruck + currentStep.bOnTruck}/{solution.capacity}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
