import React from 'react';
import { cn } from '../lib/cn';
import { Loader2 } from 'lucide-react';

interface SolutionPickerProps {
  files: string[];
  selectedFile: string | null;
  onSelect: (file: string) => void;
  loading: boolean;
}

export function SolutionPicker({ files, selectedFile, onSelect, loading }: SolutionPickerProps) {
  const getInstanceName = (file: string) => {
    const base = file.split('/').pop()?.split('\\').pop()?.replace('.json', '') || file;
    return base;
  };

  return (
    <div className="flex items-center gap-3 overflow-hidden">
      {loading && <Loader2 className="w-5 h-5 text-emerald-500 animate-spin shrink-0" />}
      <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pb-2 pt-2 px-1">
        {files.map((file) => {
          const isSelected = file === selectedFile;
          return (
            <button
              key={file}
              onClick={() => onSelect(file)}
              className={cn(
                "whitespace-nowrap px-4 py-2 rounded-xl text-sm font-medium transition-colors",
                isSelected
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-900/20"
                  : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100"
              )}
            >
              {getInstanceName(file)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
