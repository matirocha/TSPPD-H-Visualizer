/**
 * Las explicaciones del solver vienen como HTML con colores inline (#ef4444 para α,
 * #06b6d4 para β). Se reescriben a clases del sistema de diseño y se descarta
 * cualquier etiqueta o atributo fuera de la lista blanca.
 */
const ALLOWED = new Set(['STRONG', 'B', 'EM', 'I', 'SPAN', 'BR', 'SUB', 'SUP', 'CODE']);

function toneFromStyle(style: string): string | null {
  const s = style.toLowerCase().replace(/\s/g, '');
  if (s.includes('#ef4444') || s.includes('#f43f5e') || s.includes('#fb923c')) return 'text-alpha font-semibold';
  if (s.includes('#06b6d4') || s.includes('#22d3ee') || s.includes('#0ea5e9')) return 'text-beta font-semibold';
  if (s.includes('#f59e0b') || s.includes('#fbbf24')) return 'text-handling font-semibold';
  return null;
}

/** Emojis y selectores de variación (p. ej. "⚠️") que traen algunas explicaciones. */
const EMOJI = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}]\s*/gu;

export function sanitizeExplanation(html: string): string {
  const clean = html.replace(EMOJI, '');
  if (typeof DOMParser === 'undefined') return clean.replace(/<[^>]*>/g, '');
  const doc = new DOMParser().parseFromString(`<div>${clean}</div>`, 'text/html');
  const root = doc.body.firstElementChild as HTMLElement;

  const walk = (el: Element) => {
    for (const child of [...el.children]) {
      walk(child);
      if (!ALLOWED.has(child.tagName)) {
        child.replaceWith(...child.childNodes);
        continue;
      }
      const tone = toneFromStyle(child.getAttribute('style') ?? '');
      for (const attr of [...child.attributes]) child.removeAttribute(attr.name);
      if (tone) child.setAttribute('class', tone);
      if (child.tagName === 'STRONG' || child.tagName === 'B') child.classList.add('text-zinc-50', 'font-semibold');
    }
  };
  walk(root);
  return root.innerHTML;
}
