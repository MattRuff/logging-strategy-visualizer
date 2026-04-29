import { createContext, useContext } from "react";

export const PricingVisibilityContext = createContext<boolean>(false);

export function usePricingVisible(): boolean {
  return useContext(PricingVisibilityContext);
}
