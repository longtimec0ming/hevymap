"use client";

// Thin re-export wrapping next-themes' provider, per shadcn's recommended
// pattern (a dedicated client component so app/layout.tsx can stay a
// server component). attribute="class" toggles the .dark selector that
// app/globals.css's tokens key off of.

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

export function ThemeProvider({ children, ...props }: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
