import { memo, useMemo } from 'react';
import katex from 'katex';
import { cn } from '../../lib/cn';

export interface TexProps {
  tex: string;
  /** Modo display de KaTeX (bloque centrado). */
  display?: boolean;
  /**
   * Estilo display (\displaystyle) sin convertir en bloque: sumatorias con
   * límites debajo, pero alineado a la izquierda y en línea con el resto.
   */
  displayStyle?: boolean;
  className?: string;
}

/** Fórmula LaTeX renderizada con KaTeX (memoizada; nunca lanza errores). */
export const Tex = memo(function Tex({ tex, display = false, displayStyle = false, className }: TexProps) {
  const html = useMemo(
    () =>
      katex.renderToString(displayStyle && !display ? `\\displaystyle ${tex}` : tex, {
        throwOnError: false,
        displayMode: display,
        strict: 'ignore',
        output: 'htmlAndMathml',
      }),
    [tex, display, displayStyle],
  );
  if (display) return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
  return <span className={cn('inline-block', className)} dangerouslySetInnerHTML={{ __html: html }} />;
});
