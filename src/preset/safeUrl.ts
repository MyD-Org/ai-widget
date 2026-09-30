// Defensa XSS para URLs que terminan en el DOM (href/src): solo esquemas explícitos. Una URL
// relativa se resuelve contra el origen de la página.
function safeUrl(url: string | undefined, schemes: ReadonlySet<string>): string | undefined {
  if (!url || typeof url !== 'string') return undefined;
  const base = typeof window !== 'undefined' ? window.location.origin : 'https://localhost';
  try {
    const u = new URL(url, base);
    return schemes.has(u.protocol) ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

const LINK_SCHEMES = new Set(['http:', 'https:', 'mailto:', 'tel:']);
const HTTP_SCHEMES = new Set(['http:', 'https:']);

/** Links de las cards (evita href="javascript:…"). */
export const safeHref = (url?: string) => safeUrl(url, LINK_SCHEMES);
/** Fotos y archivos del host (imagen del producto, PDF de la ficha): solo http(s). */
export const safeHttpUrl = (url?: string) => safeUrl(url, HTTP_SCHEMES);
