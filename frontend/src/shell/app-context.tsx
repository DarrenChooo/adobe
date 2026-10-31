import { createContext, useContext } from "react";
import type { ToolContext } from "../tools/registry";

/** The app frame's shared state and actions. Route pages read it with useApp(). */
export const AppContext = createContext<ToolContext | null>(null);

export function useApp(): ToolContext {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp() used outside the app frame");
  return ctx;
}
