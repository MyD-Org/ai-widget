import { createContext, useContext, useRef } from 'react';

/** Lo que la hoja mobile del ChatDrawer le ofrece a las cards. Fuera del ChatDrawer (ChatPanel,
 *  Card suelta) no hay proveedor y las cards se comportan como siempre. */
export interface SheetContextValue {
  /** Una card acaba de hacer navegar al host (catálogo automático o con el botón, abrir un
   *  producto). En mobile la hoja pasa a "peek" para que se vea la página nueva, sin
   *  history.back() ni restaurar el scroll de la anterior. `notice` reemplaza el último mensaje
   *  en la barra (p.ej. "Filtros aplicados: …"). */
  onHostNavigated: (notice?: { catalogSummary: string }) => void;
}

export const SheetContext = createContext<SheetContextValue | null>(null);

/** Ref estable al contexto de la hoja (para usarlo en callbacks y efectos). */
export function useSheetRef() {
  const sheet = useContext(SheetContext);
  const ref = useRef(sheet);
  ref.current = sheet;
  return ref;
}
