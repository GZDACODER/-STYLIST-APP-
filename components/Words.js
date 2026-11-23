"use client";

// <Words>Add a client</Words>: the sentence in the pro's own words
// ("Add a student" for a tutor). Anything that isn't plain text is left alone.
import { swapWords } from "@/lib/templates";
import { useTemplate } from "@/components/TemplateContext";

export default function Words({ children }) {
  const { words } = useTemplate();
  return typeof children === "string" ? swapWords(children, words) : children;
}

export function useWords() {
  const { words } = useTemplate();
  return (text) => swapWords(text, words);
}
