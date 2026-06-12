import MarkdownToJsx from 'markdown-to-jsx';
import type { ComponentPropsWithoutRef } from 'react';

// Envuelve cada tabla en un contenedor scrolleable (para el scroll-shadow del CSS
// y para aislar el overflow horizontal sin romper el ancho del resto del mensaje).
function TableWrap(props: ComponentPropsWithoutRef<'table'>) {
  return (
    <div className="aichat-table-wrap">
      <table {...props} />
    </div>
  );
}

// Render Markdown del asistente a elementos React (no innerHTML).
// disableParsingRawHTML: no renderiza HTML crudo embebido (defensa XSS).
// forceBlock: trata el contenido como bloque (párrafos/listas), no inline.
export function Markdown({ children }: { children: string }) {
  return (
    <div className="aichat-md">
      <MarkdownToJsx options={{ disableParsingRawHTML: true, forceBlock: true, overrides: { table: TableWrap } }}>
        {children}
      </MarkdownToJsx>
    </div>
  );
}
