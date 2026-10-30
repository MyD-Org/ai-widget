// Vite/Vitest: importar un archivo como texto (tests).
declare module '*?raw' {
  const contenido: string;
  export default contenido;
}
