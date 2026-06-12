import MarkdownToJsx from 'markdown-to-jsx';

// Render Markdown del asistente a elementos React (no innerHTML).
// disableParsingRawHTML: no renderiza HTML crudo embebido (defensa XSS).
// forceBlock: trata el contenido como bloque (párrafos/listas), no inline.
export function Markdown({ children }: { children: string }) {
  return (
    <div className="aichat-md">
      <MarkdownToJsx options={{ disableParsingRawHTML: true, forceBlock: true }}>{children}</MarkdownToJsx>
    </div>
  );
}
