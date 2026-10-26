import { Box, Card, Divider, Group, Stack, StackProps, Text, TextProps, ThemeIcon } from "@mantine/core";
import React, { ReactNode } from "react";

export function SummaryCard({ icon, label, value, detail, color }: { icon: React.ReactNode; label: string; value: string; detail: string; color: string }) {
    return (
        <Card withBorder radius="md" padding="md">
            <Group justify="space-between" align="flex-start">
                <div>
                    <Text c="dimmed" fw={600}>{label}</Text>
                    <Text size="xl" fw={800} c="gray.9" mt={5}>{value}</Text>
                </div>
                <ThemeIcon color={color} variant="light" size={38} radius="md">{icon}</ThemeIcon>
            </Group>
            <Text c="dimmed" mt="sm">{detail}</Text>
        </Card>
    );
}

export function InfoRow({
    label,
    value,
    last,
    labelProps,
    valueProps,
    subComponent
}: {
    label: string;
    value: string | React.ReactNode;
    last?: boolean;
    subComponent?: React.ReactNode;
    labelProps?: TextProps;
    valueProps?: TextProps;
}) {
    return (
        <Group
            justify="space-between"
            py="sm"
            wrap="nowrap"
            style={{
                borderBottom:
                    last
                        ? "none"
                        : "1px solid #f0f2f5",
            }}
        >
            <Text
                c="#667085"
                {...labelProps}
            >
                {label}
            </Text>

            <Stack gap={0} align="flex-end">
                {typeof value === "string" ? (
                    <>
                        {value !== null && value !== undefined && value !== "" ? (
                            <>

                                <Text
                                    fw={600}
                                    c="#344054"
                                    ta="right"
                                    {...valueProps}
                                >
                                    {value}
                                </Text>
                                {subComponent}
                            </>
                        ) : (
                            <Text c="dimmed" fs="italic">
                                Chưa cập nhật
                            </Text>
                        )}
                    </>
                ) : (
                    <>
                        {value}
                    </>
                )}

            </Stack>
        </Group>
    );
}


interface CustomSectionProps {
    title: string;
    icon?: ReactNode;
    children: ReactNode;

    // style
    titleProps?: TextProps;
    sectionProps?: StackProps;
    headerColor?: string;
}

export const CustomSection = ({
    title,
    icon,
    children,
    titleProps,
    sectionProps,
    headerColor
}: CustomSectionProps) => {
    if (headerColor) {
        return (
            <Stack
                gap={0}
                bg="white"
                bd="1px solid var(--mantine-color-gray-3)"
                {...sectionProps}
                style={{
                    borderRadius: "var(--mantine-radius-md)",
                    boxShadow: "var(--mantine-shadow-xs)",
                    overflow: "hidden",
                    ...sectionProps?.style,
                }}
            >
                <Group
                    gap="xs"
                    px="xs"
                    py="sm"
                    bg="gray.0"
                    style={{ borderBottom: "1px solid var(--mantine-color-gray-3)" }}
                >
                    <Box c={`${headerColor}.6`} style={{ display: "flex" }}>{icon}</Box>
                    <Text tt="uppercase" fw={600} c="dark.7" {...titleProps}>
                        {title}
                    </Text>
                </Group>
                <Stack gap="md" p="lg">
                    {children}
                </Stack>
            </Stack>
        );
    }

    return (
        <Stack gap="md" {...sectionProps}>
            <Box>
                <Group gap="xs" mb="xs">
                    {icon ? icon : (
                        <Box
                            w={4}
                            h={18}
                            bg="blue.6"
                            style={{ borderRadius: 4 }}
                        />
                    )}

                    <Text tt="uppercase" fw={600} c="dark.7" {...titleProps}>
                        {title}
                    </Text>
                </Group>

                <Divider />
            </Box>

            {children}
        </Stack>
    );
};