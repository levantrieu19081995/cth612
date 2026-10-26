"use client";

import { Box, Loader, MantineProvider, Select, Stack, Text, createTheme } from "@mantine/core";
import type { ReactNode } from "react";

const fontFamily = "var(--font-be-vietnam-pro), Arial, Helvetica, sans-serif";

const green = [
  "#d8f3dc",
  "#b7e4c7",
  "#95d5b2",
  "#74c69d",
  "#52b788",
  "#40916c",
  "#2d6a4f",
  "#1b4332",
  "#081c15",
  "#081c15",
] as const;
const blue = [
  "#eff6ff",
  "#dbeafe",
  "#bfdbfe",
  "#93c5fd",
  "#60a5fa",
  "#3b82f6",
  "#1769e0",
  "#1557c0",
  "#1249a3",
  "#103b82",
] as const;
const teal = [
  "#e6fcf5",
  "#c3fae8",
  "#96f2d7",
  "#63e6be",
  "#38d9a9",
  "#20c997",
  "#12b886",
  "#0ca678",
  "#099268",
  "#087f5b",
] as const;
const amber = [
  "#fff9db",
  "#fff3bf",
  "#ffec99",
  "#ffe066",
  "#ffd43b",
  "#fcc419",
  "#fab005",
  "#f59f00",
  "#f08c00",
  "#e67700",
] as const;
const ink = "#102044";

const bookingColors = {
  primary: "#2563EB",
  primaryLight: "#EFF6FF",

  success: "#16A34A",
  successLight: "#F0FDF4",

  warning: "#EA580C",
  warningLight: "#FFF7ED",

  service: "#7C3AED",
  serviceLight: "#F5F3FF",

  background: "#F8FAFC",
  surface: "#FFFFFF",
  border: "#E2E8F0",
} as const;

const theme = createTheme({
  primaryColor: "blue",
  primaryShade: 6,
  colors: {
    blue,
    teal,
    green: ["#f0fdf4", "#dcfce7", "#bbf7d0", "#86efac", "#4ade80", "#22c55e", "#16a34a", "#15803d", "#166534", "#14532d"],
    red: ["#fff5f5", "#ffe3e3", "#ffc9c9", "#ffa8a8", "#ff8787", "#ff6b6b", "#fa5252", "#f03e3e", "#e03131", "#c92a2a"],
    orange: amber,
    grape: ["#f8f0fc", "#f3d9fa", "#eebefa", "#e599f7", "#da77f2", "#cc5de8", "#be4bdb", "#ae3ec9", "#9c36b5", "#862e9c"],
    yellow: amber,
    gray: ["#f8f9fa", "#f1f3f5", "#e9ecef", "#dee2e6", "#ced4da", "#adb5bd", "#868e96", "#495057", "#343a40", ink],
  },
  fontFamily,
  headings: { fontFamily },
  defaultRadius: "md",

  components: {
    Text: {
      defaultProps: {
        fontSize: "var(--mantine-font-size-sm)"
      }
    },

    Select: {
      defaultProps: {
        size: "sm",
        styles: {
          label: {
            fontSize: "var(--mantine-font-size-sm)",
            fontWeight: 500
          },
          input: {
            fontSize: "var(--mantine-font-size-sm)"
          }
        }
      }
    },

    TextInput: {
      defaultProps: {
        size: "sm",
        styles: {
          label: {
            fontSize: "var(--mantine-font-size-sm)",
            fontWeight: 500
          },
          input: {
            fontSize: "var(--mantine-font-size-sm)"
          }
        }
      }
    },

    LoadingOverlay: {
                defaultProps: {
                    zIndex: 1400,

                    overlayProps: {
                        radius: "md",
                        blur: 4,
                        backgroundOpacity: 0.55,
                    },

                    transitionProps: {
                        transition: "fade",
                        duration: 650,
                        timingFunction: "ease",
                    },

                    loaderProps: {
                        children: (
                            <Stack
                                align="center"
                                gap={8}
                                p="md"
                                style={{
                                    minWidth: 240,
                                    borderRadius: 14,
                                    background: "var(--mantine-color-body)",
                                    boxShadow: "0 16px 40px rgba(15, 23, 42, 0.16)",
                                    border: "1px solid var(--mantine-color-gray-2)",
                                }}
                            >
                                <Loader size="md" color="blue" />

                                <Box ta="center">
                                    <Text fw={700} size="sm">
                                        Đang xử lý dữ liệu
                                    </Text>

                                    <Text size="sm" c="dimmed" mt={3}>
                                        Vui lòng chờ trong giây lát...
                                    </Text>
                                </Box>
                            </Stack>
                        ),
                    },
                },
            },
  }
});

export default function Providers({ children }: { children: ReactNode })
{
  return (
    <MantineProvider theme={theme} defaultColorScheme="light">
      {children}
    </MantineProvider>
  );
}
