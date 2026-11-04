import katex from 'katex';
import { memo, useEffect, useMemo, useRef } from 'react';
import { useHighlight } from './Highlight';

/**
 * Shared macros. Use \hl{key}{…} to make part of an equation hoverable: hovering sets the
 * global highlight key (visualizations react to it) and shows the tooltip registered for key.
 */
export const TEX_MACROS: Record<string, string> = {
  '\\ket': '|#1\\rangle',
  '\\bra': '\\langle #1|',
  '\\braket': '\\langle #1|#2\\rangle',
  '\\hl': '\\htmlData{hl=#1}{#2}',
  '\\R': '\\mathbb{R}',
  '\\C': '\\mathbb{C}',
  '\\vs': '\\vec{\\sigma}',
  '\\dg': '^{\\dagger}',
};

const cache = new Map<string, string>();

export function renderTex(tex: string, display: boolean): string {
  const key = (display ? 'D' : 'I') + tex;
  const hit = cache.get(key);
  if (hit) return hit;
  let html: string;
  try {
    html = katex.renderToString(tex, {
      displayMode: display,
      throwOnError: false,
      trust: (ctx) => ctx.command === '\\htmlData' || ctx.command === '\\htmlClass',
      strict: 'ignore',
      macros: { ...TEX_MACROS },
      output: 'htmlAndMathml',
    });
  } catch (e) {
    html = `<span style="color:#ff8a8a">${String(e)}</span>`;
  }
  if (cache.size > 4000) cache.clear();
  cache.set(key, html);
  return html;
}

interface TexProps {
  children: string;
  display?: boolean;
  className?: string;
}

/** Renders KaTeX and wires \hl{…} regions into the global highlight + tooltip system. */
export const Tex = memo(function Tex({ children, display = false, className = '' }: TexProps) {
  const html = useMemo(() => renderTex(children, display), [children, display]);
  const ref = useRef<HTMLSpanElement>(null);
  const { active, setActive, showTip, hideTip } = useHighlight();

  // reflect externally-set highlight in this equation
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.querySelectorAll('[data-hl]').forEach((n) => {
      n.classList.toggle('hl-active', active !== null && (n as HTMLElement).dataset.hl === active);
    });
  }, [active, html]);

  const Tag = display ? 'div' : 'span';
  return (
    <Tag
      ref={ref as never}
      className={`tex ${className}`}
      onMouseOver={(e) => {
        const t = (e.target as HTMLElement).closest('[data-hl]') as HTMLElement | null;
        if (t?.dataset.hl) {
          setActive(t.dataset.hl);
          showTip(t.dataset.hl, t.getBoundingClientRect());
        }
      }}
      onMouseOut={(e) => {
        const t = (e.target as HTMLElement).closest('[data-hl]') as HTMLElement | null;
        const to = (e.relatedTarget as HTMLElement | null)?.closest?.('[data-hl]');
        if (t && to !== t) {
          setActive(null);
          hideTip();
        }
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});

/** Inline-math shorthand: <M>{'\\theta'}</M> */
export const M = ({ children, className }: { children: string; className?: string }) => (
  <Tex className={className}>{children}</Tex>
);
