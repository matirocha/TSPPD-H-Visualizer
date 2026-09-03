import { SolutionMeta, SolutionData } from '../types/solution';

const API_BASE = '/api';

export async function fetchSolutionsList(): Promise<SolutionMeta[]> {
  const response = await fetch(`${API_BASE}/solutions`);
  if (!response.ok) {
    throw new Error(`Error al listar soluciones: ${response.statusText}`);
  }
  const data = await response.json();
  if (!data.success) {
    throw new Error(data.error || 'Error al obtener soluciones');
  }
  return data.solutions;
}

export async function fetchSolutionDetail(filename: string): Promise<SolutionData> {
  const response = await fetch(`${API_BASE}/solutions/${encodeURIComponent(filename)}`);
  if (!response.ok) {
    throw new Error(`Error al cargar solución ${filename}: ${response.statusText}`);
  }
  const result = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Solución inválida');
  }
  return result.data;
}
