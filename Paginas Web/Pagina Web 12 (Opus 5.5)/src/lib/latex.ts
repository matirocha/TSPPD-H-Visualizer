/**
 * Envoltorio común de las tablas que se copian a LaTeX (secciones «Tiempos» y «Metaheurísticas»).
 * Lo copiado se pega tal cual en un proyecto vacío de Overleaf o dentro de un documento ajeno (p. ej.,
 * la plantilla por defecto de Overleaf, que no carga booktabs), así que no puede depender del preámbulo:
 *  · texSnippet: si aún no hay \documentclass, arma su propio documento y lo cierra al final;
 *  · texTable trae reglas de reserva: sin booktabs, \toprule/\midrule/\bottomrule → \hline y
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
export function texTable(o: { setup?: string[]; caption: string; label: string; spec: string; rows: string[]; continued?: boolean }): string {
  return [
    ...(o.continued ? [`% Continuación de la tabla ${o.label}.`] : []),
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

/**
 * Lo que copia «Copiar LaTeX»: las tablas entre un encabezado y un cierre que las hacen compilar
 * pegadas tal cual en cualquiera de los dos sitios:
 *  · dentro de un documento (entre \begin{document} y \end{document}): ya hay \documentclass, así que
 *    el encabezado no hace nada y quedan solo las tablas;
 *  · en un proyecto vacío de Overleaf: el encabezado arma un documento (article en español, booktabs,
 *    graphicx, márgenes de 2,5 cm) y el cierre lo termina si lo que sigue es el fin del archivo
 *    (\everyeof lo marca) o solo líneas en blanco; si sigue otra tabla pegada, la deja pasar y la
 *    cierra la última.
 * Que ya hay documento se sabe porque \documentclass pasa a ser \@twoclasseserror tras cargar la
 * clase (y ambos \@notprerr tras \begin{document}).
 */
export function texSnippet(section: string, tables: string[]): string {
  return [
    `% Tabla generada por la Página Web 12 (sección «${section}»). Pégala tal cual dentro de tu documento`,
    '% (entre \\begin{document} y \\end{document}; se ve mejor con \\usepackage{booktabs,graphicx}) o en un',
    '% proyecto vacío de Overleaf, donde arma su propio documento (ahí puedes pegar varias tablas seguidas).',
    '% Si ya hay documento, solo van las tablas; si no, se arma uno que \\TablaTSPPDfin cierra al final.',
    '\\makeatletter',
    '\\ifx\\documentclass\\@twoclasseserror',
    '  \\ifdefined\\TablaTSPPDfin\\else\\let\\TablaTSPPDfin\\relax\\fi',
    '\\else',
    '  \\documentclass{article}',
    '  \\usepackage[T1]{fontenc}\\usepackage{lmodern}\\usepackage[spanish,es-tabla]{babel}',
    '  \\usepackage[margin=2.5cm]{geometry}\\usepackage{booktabs,graphicx}',
    '  \\def\\TablaTSPPDfin{\\everyeof{\\TablaTSPPDeof}\\futurelet\\TablaTSPPDsig\\TablaTSPPDver}',
    '  \\def\\TablaTSPPDver{\\ifx\\TablaTSPPDsig\\par\\expandafter\\TablaTSPPDpar\\else\\ifx\\TablaTSPPDsig\\TablaTSPPDeof\\else\\everyeof{}\\fi\\fi}',
    '  \\long\\def\\TablaTSPPDpar\\par{\\futurelet\\TablaTSPPDsig\\TablaTSPPDver}',
    '  \\def\\TablaTSPPDeof{\\everyeof{}\\end{document}}',
    '  \\begin{document}',
    '\\fi',
    '\\makeatother',
    ...tables,
    '\\TablaTSPPDfin',
    '',
  ].join('\n');
}
