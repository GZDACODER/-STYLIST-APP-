"use client";

// The pro's business-type template (lib/templates) for client components:
// useTemplate().words.Clients = "Students" for a tutor, and .modules says
// which features are on. Set once in the dashboard layout.
import { createContext, useContext } from "react";
import { templateFor } from "@/lib/templates";

const Ctx = createContext(null);

export function TemplateProvider({ value, children }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

const FALLBACK = (() => {
  const t = templateFor("");
  return { key: t.key, words: t.words, modules: t.modules };
})();

export function useTemplate() {
  return useContext(Ctx) || FALLBACK;
}
