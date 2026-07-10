// Convierte el Markdown que genera el asistente a texto plano compatible con WhatsApp.
// El copiloto muestra la respuesta renderizada (markdown-to-jsx), pero al copiar se llevaba
// el Markdown crudo: en WhatsApp los `**dobles asteriscos**` salen literales (WhatsApp usa
// `*simple*` para negrita) y los markers de lista/encabezado quedan "todo junto". Acá lo
// pasamos a la sintaxis de WhatsApp: *negrita*, _cursiva_, ~tachado~ y ```monoespaciado```.

// Sentinelas internas: caracteres del Área de Uso Privado Unicode (no aparecen en texto real)
// para marcar la negrita ya resuelta y aislar el código preservado, de modo que las pasadas
// siguientes no los vuelvan a tocar.
const SENT = "";
const B_OPEN = `${SENT}b${SENT}`;
const B_CLOSE = `${SENT}/b${SENT}`;
const codeToken = (i: number) => `${SENT}c${i}${SENT}`;
const codeTokenRe = new RegExp(`${SENT}c(\\d+)${SENT}`, "g");

export function mdToWhatsApp(md: string): string {
  // 1) Preservar bloques ``` ``` y código inline ` ` para no reformatear su contenido.
  const code: string[] = [];
  const stash = (m: string) => {
    code.push(m);
    return codeToken(code.length - 1);
  };
  let text = md.replace(/```[\s\S]*?```/g, stash);
  text = text.replace(/`[^`]+`/g, stash);

  // 2) Links [texto](url) → "texto (url)" (o solo la url si no aporta texto distinto).
  text = text.replace(/\[([^\]]*)\]\(([^)]+)\)/g, (_m, label: string, url: string) =>
    !label || label === url ? url : `${label} (${url})`,
  );

  // 3) Encabezados (#..######) → línea en negrita.
  text = text.replace(/^[ \t]*#{1,6}[ \t]+(.*)$/gm, (_m, h: string) => `${B_OPEN}${h.trim()}${B_CLOSE}`);

  // 4) Negrita **..** / __..__ → marcador temporal (antes que la cursiva de un asterisco).
  text = text.replace(/\*\*([^*]+)\*\*/g, (_m, b: string) => `${B_OPEN}${b}${B_CLOSE}`);
  text = text.replace(/__([^_]+)__/g, (_m, b: string) => `${B_OPEN}${b}${B_CLOSE}`);

  // 5) Cursiva *..* / _.._ → _.._ (WhatsApp).
  text = text.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, (_m, pre: string, i: string) => `${pre}_${i}_`);
  text = text.replace(/(^|[^_])_([^_\n]+)_(?!_)/g, (_m, pre: string, i: string) => `${pre}_${i}_`);

  // 6) Tachado ~~..~~ → ~..~.
  text = text.replace(/~~([^~]+)~~/g, (_m, s: string) => `~${s}~`);

  // 7) Viñetas -,*,+ → •. Las listas numeradas (1. 2. …) se dejan como están.
  text = text.replace(/^([ \t]*)[-*+][ \t]+/gm, (_m, indent: string) => `${indent}• `);

  // 8) Citas "> " y reglas horizontales (--- *** ___): quitar markers/línea.
  text = text.replace(/^[ \t]*>[ \t]?/gm, "");
  text = text.replace(/^[ \t]*([-*_])(?:[ \t]*\1){2,}[ \t]*$/gm, "");

  // 9) Restaurar negrita (→ *WhatsApp*) y el código preservado.
  text = text.split(B_OPEN).join("*").split(B_CLOSE).join("*");
  text = text.replace(codeTokenRe, (_m, i: string) => code[Number(i)]);

  // 10) Máximo una línea en blanco entre bloques y sin espacios sobrantes.
  return text.replace(/[ \t]+$/gm, "").replace(/\n{3,}/g, "\n\n").trim();
}
