import { useState, useEffect, useCallback } from 'react';
import { Solution } from '../types/solution';

export function useSolutionLoader() {
  const [files, setFiles] = useState<string[]>([]);
  const [solution, setSolution] = useState<Solution | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const loadSolution = useCallback(async (filename: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/data/${filename}`);
      if (!res.ok) throw new Error(`Error al cargar el archivo ${filename}`);
      const data = await res.json();
      setSolution(data);
      setSelectedFile(filename);
    } catch (err: any) {
      setError(err.message || 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const fetchIndex = async () => {
      try {
        setLoading(true);
        const res = await fetch('/data/index.json');
        if (!res.ok) throw new Error('Error al cargar la lista de archivos');
        const data = await res.json();
        setFiles(data);
        if (data.length > 0) {
          await loadSolution(data[0]);
        } else {
          setLoading(false);
        }
      } catch (err: any) {
        setError(err.message || 'Error desconocido');
        setLoading(false);
      }
    };
    fetchIndex();
  }, [loadSolution]);

  return { files, solution, loading, error, loadSolution, selectedFile };
}
