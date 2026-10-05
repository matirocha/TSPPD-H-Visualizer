/**
 * Envoltorio común de las tablas que se copian a LaTeX (secciones «Tiempos» y «Metaheurísticas»).
 * La tabla se pega en un documento ajeno (p. ej., la plantilla por defecto de Overleaf, que no carga
 * booktabs), así que no puede depender del preámbulo:
 *  · trae reglas de reserva: sin booktabs, \toprule/\midrule/\bottomrule → \hline y
 *    \cmidrule(lr){a-b} → \cline{a-b}; sin graphicx, \resizebox deja la tabla sin escalar;
 *  · se reduce al ancho de línea solo si no cabe (nunca se agranda), así que tampoco se sale del margen.
 * Con booktabs y graphicx cargados las reservas no cambian nada, y quedan locales al entorno table.
 */

const TEX_SPECIAL: Record<string, string> = {
  '\\': '\\textbackslash{}',
  '{': '\\{',
  '}': '\\}',
  $: '\\$',
  '&': '\\&',
  '#': '\\#',
  '%': '\\%',
  _: '\\_',
  '^': '\\textasciicircum{}',
  '~': '\\textasciitilde{}',
};

/** Texto libre que viene de los datos (CPU, runtime) con los caracteres especiales de LaTeX escapados. */
export const texText = (s: string): string => s.replace(/[\\{}$&#%_^~]/g, (c) => TEX_SPECIAL[c]);

const FALLBACKS = [
  '% Reserva por si el preámbulo no carga booktabs o graphicx (si los carga, no cambia nada).',
  '\\providecommand{\\toprule}{\\hline}\\providecommand{\\midrule}{\\hline}\\providecommand{\\bottomrule}{\\hline}%',
  '\\ifdefined\\cmidrule\\else\\def\\cmidrule(#1)#2{\\cline{#2}}\\fi',
  '\\providecommand{\\resizebox}[3]{#3}%',
];

/**
 * Tabla flotante lista para pegar: `setup` va tras \centering (tamaño de letra, \tabcolsep) y `rows`
 * es el cuerpo del tabular, de \toprule a \bottomrule. Con `continued` es la continuación de la
 * tabla con esa etiqueta: en vez de caption lleva «Tabla N (continuación)», sin número propio ni
 * entrada en el índice de tablas (\tablename sigue al idioma: «Cuadro» con babel spanish).
 */
export function texTable(o: {
  section: string;
  setup?: string[];
  caption: string;
  label: string;
  spec: string;
  rows: string[];
  continued?: boolean;
}): string {
  return [
    o.continued
      ? `% Continuación de la tabla ${o.label}.`
      : `% Tabla generada por la Página Web 12 (sección «${o.section}»). Se ve mejor con \\usepackage{booktabs,graphicx}, pero compila sin ellos.`,
    '\\begin{table}[htbp]',
    ...FALLBACKS,
    '\\centering',
    ...(o.setup ?? []),
    ...(o.continued
      ? [`{\\normalsize \\tablename~\\ref{${o.label}} (continuación)\\par}`, '\\vspace{\\abovecaptionskip}']
      : [`\\caption{${o.caption}}`, `\\label{${o.label}}`]),
    '\\resizebox{\\ifdim\\width>\\linewidth\\linewidth\\else\\width\\fi}{!}{%',
    `\\begin{tabular}{${o.spec}}`,
    ...o.rows,
    '\\end{tabular}%',
    '}',
    '\\end{table}',
    '',
  ].join('\n');
}
