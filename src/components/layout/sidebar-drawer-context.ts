import { createContext, useContext } from "react";

export interface SidebarDrawerValue {
  open: boolean;
  toggle: () => void;
  close: () => void;
}

export const SidebarDrawerContext = createContext<SidebarDrawerValue | null>(null);

export function useSidebarDrawer(): SidebarDrawerValue {
  const ctx = useContext(SidebarDrawerContext);
  if (!ctx) throw new Error("useSidebarDrawer must be used within AdminShell");
  return ctx;
}
