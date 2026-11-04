import { ReactNode } from 'react';

/**
 * KaTeX lays matrix columns out with absolutely-positioned `.vlist` spans that sit on top of the
 * cell contents, so hovering a \hl{…} symbol inside a pmatrix hits the vlist instead. Making the
 * layout spans transparent to the pointer (while keeping \hl regions hit-testable) restores
 * equation ↔ visualization linking inside matrices. (Scoped here; a global fix belongs in index.css.)
 */
const CSS = '.qp-hlfix .tex .vlist{pointer-events:none}.qp-hlfix .tex [data-hl],.qp-hlfix .tex [data-hl] *{pointer-events:auto}';

export function HoverFix({ children }: { children: ReactNode }) {
  return (
    <div className="qp-hlfix">
      <style>{CSS}</style>
      {children}
    </div>
  );
}
