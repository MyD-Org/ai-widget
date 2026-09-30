import { createContext } from 'react';

/** Lo que la hoja mobile del ChatDrawer le ofrece a las cards. Fuera del ChatDrawer (ChatPanel,
 *  Card suelta) no hay proveedor y las cards se comportan como siempre. */
export interface SheetContextValue {
  /** Una card `catalog` en vivo acaba de navegar sola: en mobile la hoja pasa a "peek" para que
   *  se vea el catálogo filtrado detrás. */
  onCatalogAutoNavigated: (summary: string) => void;
}

export const SheetContext = createContext<SheetContextValue | null>(null);
