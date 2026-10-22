"use client";

import { MantineProvider, createTheme } from "@mantine/core";
import type { ReactNode } from "react";

const fontFamily = "var(--font-be-vietnam-pro), Arial, Helvetica, sans-serif";

const paper = "#f5f2e9";
const clay = "#b86b50";
const forest = "#426457";
const ink = "#293b35";
const sage = "#a9b8aa";

const theme = createTheme({
  primaryColor: "green",
  primaryShade: 7,
  colors: {
    blue: [paper, paper, sage, sage, sage, forest, forest, forest, ink, ink],
    teal: [paper, paper, sage, sage, sage, forest, forest, forest, ink, ink],
    green: [paper, paper, sage, sage, sage, forest, forest, forest, ink, ink],
    red: [paper, paper, clay, clay, clay, clay, clay, "#98543f", "#7e4636", "#65392e"],
    orange: [paper, paper, clay, clay, clay, clay, clay, "#98543f", "#7e4636", "#65392e"],
    grape: [paper, paper, sage, sage, sage, forest, forest, ink, ink, ink],
    yellow: [paper, paper, sage, sage, clay, clay, clay, "#98543f", "#7e4636", "#65392e"],
    gray: [paper, paper, "#ebe8df", "#d4dcd2", sage, "#87968a", "#66736c", "#52635a", ink, ink],
  },
  fontFamily,
  headings: { fontFamily },
  defaultRadius: "md",
});

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <MantineProvider theme={theme} defaultColorScheme="light">
      {children}
    </MantineProvider>
  );
}
