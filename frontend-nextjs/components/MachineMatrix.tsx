import type { PhysicalMachine } from "../types/monitoring";

import { useState } from "react";
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Collapse,
  Divider,
  Group,
  Paper,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
  Tooltip,
} from "@mantine/core";
import {
  IconActivity,
  IconAlertCircle,
  IconChevronDown,
  IconChevronUp,
  IconCircleCheck,
  IconDeviceDesktop,
  IconInfoCircle,
  IconNetwork,
  IconServer,
  IconWifiOff,
} from "@tabler/icons-react";

type MachineStatus = "REACHABLE" | "UNREACHABLE" | "UNKNOWN";
type ServiceStatus = "ONLINE" | "OFFLINE" | "UNKNOWN";

interface MachineService {
  name: string;
  status: ServiceStatus;
}

interface MachineItem {
  machineId: string;
  name: string;
  role?: string | null;
  ip?: string | null;
  status: MachineStatus;
  respondingServices: number;
  totalServices: number;
  services: MachineService[];
}

interface MachineStatusPanelProps {
  machines: MachineItem[];
  stale: boolean;
  responding: number;
  local: boolean;
}

export function MonitorIcon() {
  return <svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><rect x="6" y="7" width="36" height="26" rx="4" stroke="currentColor" strokeWidth="2" /><path d="M18 41h12M24 33v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="M13 25l7-7 6 5 9-10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
export default function MachineMatrix({ machines, stale, local }: { machines: PhysicalMachine[]; stale: boolean; local: boolean }) {
  const responding = machines.filter(machine => machine.status === "REACHABLE").length;

  const [expandedMachines, setExpandedMachines] = useState<
    string[]
  >([]);

  const toggleMachine = (id: string) => {
    setExpandedMachines((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  };

  const statusConfig = {
    REACHABLE: {
      label: "Có phản hồi",
      color: "teal",
      icon: IconCircleCheck,
    },
    UNREACHABLE: {
      label: "Không phản hồi",
      color: "red",
      icon: IconWifiOff,
    },
    UNKNOWN: {
      label: "Chưa xác định",
      color: "gray",
      icon: IconAlertCircle,
    },
  } as const;

  return (
    <Paper
      component="section"
      aria-labelledby="computer-status-title"
      withBorder
      radius="lg"
      p={{ base: "md", sm: "lg" }}
    >
      <Stack gap="lg">
        {/* TIÊU ĐỀ VÀ THỐNG KÊ */}
        <Group align="flex-start" justify="space-between" gap="md">
          <Group align="flex-start" gap="sm" wrap="nowrap">
            <ThemeIcon
              size={44}
              radius="md"
              variant="light"
              color="indigo"
            >
              <IconDeviceDesktop size={24} />
            </ThemeIcon>

            <Box>
              <Text
                size="xs"
                fw={700}
                c="dimmed"
                tt="uppercase"
                lts={0.7}
              >
                Máy vật lý
              </Text>

              <Title order={2} size="h3" id="computer-status-title">
                Tình trạng máy tính
              </Title>

              <Text size="sm" c="dimmed" mt={4}>
                Theo dõi khả năng phản hồi của các máy và dịch vụ.
              </Text>
            </Box>
          </Group>

          <Paper
            withBorder
            radius="md"
            px="lg"
            py="sm"
            bg="var(--mantine-color-default-hover)"
          >
            <Stack gap={2} align="center">
              <Group gap={4} align="baseline">
                <Text
                  fz={28}
                  fw={800}
                  c={!stale && responding > 0 ? "teal" : "dimmed"}
                  lh={1.1}
                >
                  {stale ? "—" : responding}
                </Text>
                <Text fw={600} c="dimmed">
                  /{machines.length}
                </Text>
              </Group>

              <Text size="xs" c="dimmed" fw={500}>
                Máy có phản hồi
              </Text>
            </Stack>
          </Paper>
        </Group>

        {/* CHÚ GIẢI */}
        <Group gap="lg">
          {(
            [
              ["teal", "Có phản hồi"],
              ["red", "Không phản hồi dịch vụ"],
              ["gray", "Chưa xác định"],
            ] as const
          ).map(([color, label]) => (
            <Group key={color} gap={6} wrap="nowrap">
              <Box
                w={9}
                h={9}
                style={{
                  borderRadius: "50%",
                  background: `var(--mantine-color-${color}-6)`,
                  flexShrink: 0,
                }}
              />
              <Text size="sm" c="dimmed">
                {label}
              </Text>
            </Group>
          ))}
        </Group>

        {stale && (
          <Alert
            color="gray"
            variant="light"
            icon={<IconInfoCircle size={18} />}
            radius="md"
            role="status"
          >
            Chưa có quan sát mới. Trạng thái các máy tạm
            chuyển sang chưa xác định.
          </Alert>
        )}

        {/* DANH SÁCH MÁY */}
        {machines.length === 0 ? (
          <Paper withBorder radius="md" p="xl">
            <Stack align="center" gap="xs">
              <IconServer
                size={36}
                color="var(--mantine-color-gray-5)"
              />
              <Text fw={600}>Chưa có máy tính</Text>
              <Text size="sm" c="dimmed" ta="center">
                Backend chưa trả về danh sách máy được cấu hình.
              </Text>
            </Stack>
          </Paper>
        ) : (
          <SimpleGrid
            cols={{ base: 1, sm: 2, xl: 3 }}
            spacing="md"
            verticalSpacing="md"
          >
            {machines.map((machine) => {
              const status: MachineStatus = stale
                ? "UNKNOWN"
                : machine.status;

              const config = statusConfig[status];
              const StatusIcon = config.icon;

              const expanded = expandedMachines.includes(
                machine.machineId
              );

              const hasFailure =
                !stale &&
                machine.status === "REACHABLE" &&
                machine.services.some(
                  (service) => service.status === "OFFLINE"
                );

              const progress =
                !stale && machine.totalServices > 0
                  ? Math.min(
                    100,
                    Math.max(
                      0,
                      (machine.respondingServices /
                        machine.totalServices) *
                      100
                    )
                  )
                  : 0;

              return (
                <Paper
                  key={machine.machineId}
                  data-machine-id={machine.machineId}
                  data-state={status}
                  aria-label={`${machine.name}, ${config.label}`}
                  withBorder
                  radius="lg"
                  p="md"
                  style={{
                    borderColor: hasFailure
                      ? "var(--mantine-color-orange-4)"
                      : status === "UNREACHABLE"
                        ? "var(--mantine-color-red-3)"
                        : "var(--mantine-color-default-border)",
                    transition:
                      "border-color 180ms ease, box-shadow 180ms ease",
                  }}
                >
                  <Stack gap="md">
                    {/* THÔNG TIN MÁY */}
                    <Group align="flex-start" gap="sm" wrap="nowrap">
                      <ThemeIcon
                        size={44}
                        radius="md"
                        color={config.color}
                        variant="light"
                      >
                        <IconDeviceDesktop size={24} />
                      </ThemeIcon>

                      <Box style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          size="xs"
                          c="dimmed"
                          fw={600}
                          tt="uppercase"
                        >
                          {local
                            ? "Máy bàn"
                            : machine.machineId}
                        </Text>

                        <Text fw={750} fz="lg" lineClamp={2}>
                          {machine.name}
                        </Text>

                        <Text size="sm" c="dimmed">
                          {machine.role ?? "Máy dữ liệu"}
                        </Text>
                      </Box>
                    </Group>

                    {/* TRẠNG THÁI */}
                    <Group gap="xs">
                      <Badge
                        size="lg"
                        radius="sm"
                        variant="light"
                        color={config.color}
                        leftSection={<StatusIcon size={14} />}
                      >
                        {config.label}
                      </Badge>

                      {hasFailure && (
                        <Badge
                          color="orange"
                          variant="light"
                          size="lg"
                        >
                          Gián đoạn một phần
                        </Badge>
                      )}
                    </Group>

                    {/* ĐỊA CHỈ IP */}
                    <Paper
                      radius="md"
                      p="sm"
                      bg="var(--mantine-color-default-hover)"
                    >
                      <Group gap="xs" wrap="nowrap">
                        <IconNetwork
                          size={18}
                          color="var(--mantine-color-dimmed)"
                        />

                        <Box style={{ flex: 1, minWidth: 0 }}>
                          <Text size="xs" c="dimmed">
                            Địa chỉ IP LAN
                          </Text>

                          <Text
                            fw={650}
                            ff="monospace"
                            size="sm"
                            style={{
                              overflowWrap: "anywhere",
                            }}
                          >
                            {machine.ip || "Chưa cấu hình IP"}
                          </Text>
                        </Box>
                      </Group>
                    </Paper>

                    {/* DỊCH VỤ PHẢN HỒI */}
                    <Stack gap={7}>
                      <Group justify="space-between" gap="xs">
                        <Group gap={6}>
                          <IconActivity
                            size={17}
                            color="var(--mantine-color-dimmed)"
                          />
                          <Text size="sm" fw={600}>
                            Dịch vụ phản hồi
                          </Text>
                        </Group>

                        <Text fw={700} size="sm">
                          {stale
                            ? "—"
                            : machine.respondingServices}
                          <Text span c="dimmed" fw={400}>
                            /{machine.totalServices}
                          </Text>
                        </Text>
                      </Group>

                      <Progress
                        value={progress}
                        color={
                          stale
                            ? "gray"
                            : hasFailure
                              ? "orange"
                              : status === "REACHABLE"
                                ? "teal"
                                : "red"
                        }
                        size={7}
                        radius="xl"
                      />
                    </Stack>

                    {/* CẢNH BÁO */}
                    {hasFailure && (
                      <Text size="sm" c="orange.8">
                        Máy vẫn phản hồi nhưng có dịch vụ đang
                        gián đoạn.
                      </Text>
                    )}

                    <Divider />

                    {/* MỞ RỘNG DANH SÁCH DỊCH VỤ */}
                    <Box>
                      <Group
                        justify="space-between"
                        gap="xs"
                        onClick={() =>
                          toggleMachine(machine.machineId)
                        }
                        style={{ cursor: "pointer" }}
                        role="button"
                        tabIndex={0}
                        aria-expanded={expanded}
                        onKeyDown={(event) => {
                          if (
                            event.key === "Enter" ||
                            event.key === " "
                          ) {
                            event.preventDefault();
                            toggleMachine(machine.machineId);
                          }
                        }}
                      >
                        <Text fw={650} size="sm">
                          Chi tiết dịch vụ
                        </Text>

                        <ActionIcon
                          variant="subtle"
                          color="gray"
                          size="sm"
                          component="span"
                        >
                          {expanded ? (
                            <IconChevronUp size={18} />
                          ) : (
                            <IconChevronDown size={18} />
                          )}
                        </ActionIcon>
                      </Group>

                      <Collapse expanded={expanded}>
                        <Stack gap="xs" mt="md">
                          {machine.services.length === 0 ? (
                            <Text size="sm" c="dimmed">
                              Chưa có dịch vụ được cấu hình.
                            </Text>
                          ) : (
                            machine.services.map((service, index) => {
                              const serviceStatus = stale
                                ? "UNKNOWN"
                                : service.status;

                              const color =
                                serviceStatus === "ONLINE"
                                  ? "teal"
                                  : serviceStatus === "OFFLINE"
                                    ? "red"
                                    : "gray";

                              const label =
                                serviceStatus === "ONLINE"
                                  ? "Phản hồi"
                                  : serviceStatus === "OFFLINE"
                                    ? "Gián đoạn"
                                    : "Chưa rõ";

                              return (
                                <Group
                                  key={`${service.name}-${index}`}
                                  justify="space-between"
                                  gap="xs"
                                  wrap="nowrap"
                                >
                                  <Text
                                    size="sm"
                                    style={{
                                      flex: 1,
                                      minWidth: 0,
                                      overflowWrap: "anywhere",
                                    }}
                                  >
                                    {local
                                      ? service.name.replace(
                                        /\bPC(\d+)\b/g,
                                        "Node local $1"
                                      )
                                      : service.name}
                                  </Text>

                                  <Badge
                                    color={color}
                                    variant="light"
                                    size="sm"
                                  >
                                    {label}
                                  </Badge>
                                </Group>
                              );
                            })
                          )}
                        </Stack>
                      </Collapse>
                    </Box>
                  </Stack>
                </Paper>
              );
            })}
          </SimpleGrid>
        )}

        {/* GHI CHÚ */}
        <Group gap="xs" align="flex-start" wrap="nowrap">
          <IconInfoCircle
            size={18}
            style={{
              flexShrink: 0,
              color: "var(--mantine-color-dimmed)",
            }}
          />
          <Text size="sm" c="dimmed">
            Không phản hồi dịch vụ không đồng nghĩa với
            máy đã tắt. IP LAN là địa chỉ được cấu hình
            trong hệ thống triển khai.
          </Text>
        </Group>
      </Stack>
    </Paper>
  );
}
