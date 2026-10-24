"use client";
import {
  Alert, Badge, Box, Button, Center, Divider,
  Grid, Group, Loader, Paper, SimpleGrid,
  Stack, Table, Text, ThemeIcon, Title
} from "@mantine/core";

import {
  IconActivityHeartbeat,
  IconAlertCircle,
  IconArrowsExchange,
  IconClock,
  IconDatabase,
  IconHistory,
  IconRefresh,
  IconServer,
} from "@tabler/icons-react";
import { usePolling } from "../../lib/usePolling";
import type { MonitoringOverview } from "../../types/monitoring";
import MachineMatrix from "../../components/MachineMatrix";

const getMonitorColor = (status?: string | null) => {
  switch (status?.toUpperCase()) {
    case "HEALTHY":
    case "ONLINE":
    case "UP":
    case "REACHABLE":
      return "teal";

    case "DEGRADED":
    case "WARNING":
    case "PARTIAL":
      return "orange";

    case "UNHEALTHY":
    case "OFFLINE":
    case "DOWN":
    case "UNREACHABLE":
    case "FAILED":
      return "red";

    default:
      return "gray";
  }
};

const label: Record<string, string> = { HEALTHY: "Hoạt động ổn định", DEGRADED: "Đang suy giảm", UNAVAILABLE: "Tạm gián đoạn", UNKNOWN: "Chưa xác định", ONLINE: "Đang hoạt động", OFFLINE: "Mất kết nối" };
export default function MonitorPage() {
  const { data, error, loading, refresh } = usePolling<MonitoringOverview>("/api/monitoring/overview");
  const fresh = !!data?.observedAt && !error && Date.now() - Date.parse(data.observedAt) < 45000;
  return (

    <Box component="section">
      <Stack gap="xl">

        {/* HEADER */}
        <Group align="center" gap="md" wrap="wrap">
          <ThemeIcon
            size={54}
            radius="lg"
            variant="light"
            color="indigo"
          >
            <IconActivityHeartbeat size={28} stroke={1.7} />
          </ThemeIcon>

          <Box style={{ flex: 1, minWidth: 0 }}>
            <Text
              fz="sm"
              fw={800}
              tt="uppercase"
              c="indigo.7"
              lts={1}
            >
              GIÁM SÁT HỆ THỐNG
            </Text>

            <Title order={1} fz={{ base: 25, sm: 30 }} fw={800}>
              Máy & cụm database
            </Title>

            <Text fz="sm" c="dimmed" mt={4}>
              Theo dõi máy chủ, dịch vụ cơ sở dữ liệu và đồng bộ sự kiện.
            </Text>
          </Box>

          <Button
            variant="light"
            color="indigo"
            size="md"
            radius="md"
            leftSection={<IconRefresh size={18} />}
            loading={loading}
            onClick={refresh}
          >
            Kiểm tra lại
          </Button>
        </Group>

        {/* SYSTEM STATUS */}
        {data && (
          <Paper
            withBorder
            radius="lg"
            p="lg"
            style={{
              borderLeft: `4px solid var(--mantine-color-${fresh ? getMonitorColor(data.systemStatus) : "orange"
                }-5)`,
            }}
          >
            <Group align="center" gap="lg" wrap="wrap">
              <ThemeIcon
                size={48}
                radius="lg"
                variant="light"
                color={
                  fresh
                    ? getMonitorColor(data.systemStatus)
                    : "orange"
                }
              >
                <IconActivityHeartbeat size={25} />
              </ThemeIcon>

              <Stack gap={5} style={{ flex: 1, minWidth: 220 }}>
                <Group gap="sm" wrap="wrap">
                  <Text fw={750} fz="lg">
                    Tình trạng hệ thống
                  </Text>

                  <Badge
                    color={
                      fresh
                        ? getMonitorColor(data.systemStatus)
                        : "orange"
                    }
                    variant="light"
                    size="lg"
                    radius="md"
                  >
                    {fresh
                      ? label[data.systemStatus]
                      : "Chưa có quan sát mới"}
                  </Badge>
                </Group>

                <Text c="dimmed" fz="sm">
                  {data.mode === "LOCAL_SINGLE_NODE"
                    ? "1 máy bàn · 1 node CockroachDB và 1 node Cassandra."
                    : "Chế độ cụm máy dữ liệu."}
                </Text>
              </Stack>

              <Stack gap={4}>
                <Text fz="sm" c="dimmed" fw={600}>
                  Lần quan sát gần nhất
                </Text>

                <Group gap={6}>
                  <IconClock size={17} color="#64748B" />
                  <Text fw={650} fz="sm">
                    {data.observedAt
                      ? new Date(data.observedAt).toLocaleString("vi-VN")
                      : "Chưa có kết quả"}
                  </Text>
                </Group>
              </Stack>
            </Group>
          </Paper>
        )}

        {/* ERROR */}
        {error && (
          <Alert
            color="red"
            variant="light"
            radius="lg"
            title="Không thể kết nối backend"
            icon={<IconAlertCircle size={21} />}
            role="alert"
          >
            <Text fz="sm">
              {error}. Dữ liệu bên dưới là lần quan sát gần nhất.
            </Text>
          </Alert>
        )}

        {/* LOADING */}
        {loading && !data && (
          <Paper withBorder radius="lg" p="xl">
            <Center mih={200}>
              <Stack align="center" gap="sm">
                <Loader color="indigo" size="md" />
                <Text c="dimmed" fz="sm">
                  Đang kiểm tra tình trạng các máy và database...
                </Text>
              </Stack>
            </Center>
          </Paper>
        )}

        {data && (
          <Grid gap="lg" align="flex-start">

            {/* LEFT: PHYSICAL MACHINES */}
            <Grid.Col span={{ base: 12, lg: 5 }}>
              <Stack gap="md">
                <Paper withBorder radius="lg" p="lg">
                  <Group gap="sm" align="center" wrap="nowrap">
                    <ThemeIcon
                      variant="light"
                      color="indigo"
                      size={44}
                      radius="md"
                    >
                      <IconServer size={23} />
                    </ThemeIcon>

                    <Box style={{ flex: 1 }}>
                      <Title order={2} fz="xl" fw={750}>
                        Hệ thống máy chủ
                      </Title>
                      <Text fz="sm" c="dimmed">
                        Trạng thái kết nối các máy vật lý
                      </Text>
                    </Box>

                    <Badge color="indigo" variant="light" size="lg">
                      {data.physicalMachines?.length ?? 0} máy
                    </Badge>
                  </Group>
                </Paper>

                <MachineMatrix
                  machines={data.physicalMachines ?? []}
                  stale={!fresh}
                  local={data.mode.startsWith("LOCAL_")}
                />
              </Stack>
            </Grid.Col>

            {/* RIGHT: DATABASE */}
            <Grid.Col span={{ base: 12, lg: 7 }}>
              <Stack gap="lg">

                {/* DATABASE SUMMARY */}
                <Paper withBorder radius="lg" p="lg">
                  <Stack gap="lg">
                    <Group gap="sm" wrap="nowrap">
                      <ThemeIcon
                        variant="light"
                        color="blue"
                        size={44}
                        radius="md"
                      >
                        <IconDatabase size={23} />
                      </ThemeIcon>

                      <Box>
                        <Text
                          fw={800}
                          fz="sm"
                          c="blue.7"
                          tt="uppercase"
                          lts={0.8}
                        >
                          DATABASE
                        </Text>
                        <Title order={2} fz="xl" fw={750}>
                          Tình trạng database
                        </Title>
                      </Box>
                    </Group>

                    <SimpleGrid
                      cols={{ base: 1, sm: 3 }}
                      spacing="sm"
                    >
                      {/* CockroachDB */}
                      <Paper
                        withBorder
                        radius="lg"
                        p="md"
                        style={{
                          borderTop: "3px solid var(--mantine-color-blue-5)",
                        }}
                      >
                        <Stack gap="sm">
                          <Group gap="xs" wrap="nowrap">
                            <ThemeIcon
                              variant="light"
                              color="blue"
                              size={32}
                              radius="md"
                            >
                              <IconDatabase size={18} />
                            </ThemeIcon>
                            <Text fw={750} fz="sm">
                              CockroachDB
                            </Text>
                          </Group>

                          <Text fw={800} fz={30} lh={1.2} c="dark.8">
                            {fresh
                              ? `${data.cockroach.activeNodes}/${data.cockroach.expectedNodes}`
                              : "—"}
                          </Text>

                          <Badge
                            color={
                              fresh
                                ? getMonitorColor(data.cockroach.status)
                                : "gray"
                            }
                            variant="light"
                            radius="sm"
                            w="fit-content"
                          >
                            {fresh
                              ? label[data.cockroach.status]
                              : label.UNKNOWN}
                          </Badge>

                          <Divider color="gray.2" />

                          <Text fz="sm" c="dimmed">
                            Truy vấn:{" "}
                            <Text
                              span
                              fw={650}
                              c={
                                !fresh
                                  ? "gray"
                                  : data.cockroach.queryAvailable
                                    ? "teal"
                                    : "red"
                              }
                            >
                              {!fresh
                                ? "Chưa xác định"
                                : data.cockroach.queryAvailable
                                  ? "Khả dụng"
                                  : "Không khả dụng"}
                            </Text>
                          </Text>
                        </Stack>
                      </Paper>

                      {/* Cassandra */}
                      <Paper
                        withBorder
                        radius="lg"
                        p="md"
                        style={{
                          borderTop: "3px solid var(--mantine-color-violet-5)",
                        }}
                      >
                        <Stack gap="sm">
                          <Group gap="xs" wrap="nowrap">
                            <ThemeIcon
                              variant="light"
                              color="violet"
                              size={32}
                              radius="md"
                            >
                              <IconDatabase size={18} />
                            </ThemeIcon>
                            <Text fw={750} fz="sm">
                              Cassandra
                            </Text>
                          </Group>

                          <Text fw={800} fz={30} lh={1.2} c="dark.8">
                            {fresh
                              ? `${data.cassandra.activeNodes}/${data.cassandra.expectedNodes}`
                              : "—"}
                          </Text>

                          <Badge
                            color={
                              fresh
                                ? getMonitorColor(data.cassandra.status)
                                : "gray"
                            }
                            variant="light"
                            radius="sm"
                            w="fit-content"
                          >
                            {fresh
                              ? label[data.cassandra.status]
                              : label.UNKNOWN}
                          </Badge>

                          <Divider color="gray.2" />

                          <Text fz="sm" c="dimmed">
                            Truy vấn:{" "}
                            <Text
                              span
                              fw={650}
                              c={
                                !fresh
                                  ? "gray"
                                  : data.cassandra.queryAvailable
                                    ? "teal"
                                    : "red"
                              }
                            >
                              {!fresh
                                ? "Chưa xác định"
                                : data.cassandra.queryAvailable
                                  ? "Khả dụng"
                                  : "Không khả dụng"}
                            </Text>
                          </Text>
                        </Stack>
                      </Paper>

                      {/* OUTBOX */}
                      <Paper
                        withBorder
                        radius="lg"
                        p="md"
                        style={{
                          borderTop: "3px solid var(--mantine-color-orange-5)",
                        }}
                      >
                        <Stack gap="sm">
                          <Group gap="xs" wrap="nowrap">
                            <ThemeIcon
                              variant="light"
                              color="orange"
                              size={32}
                              radius="md"
                            >
                              <IconArrowsExchange size={18} />
                            </ThemeIcon>
                            <Text fw={750} fz="sm">
                              Đồng bộ sự kiện
                            </Text>
                          </Group>

                          <Text fw={800} fz={30} lh={1.2} c="dark.8">
                            {fresh ? (data.outbox?.pending ?? "—") : "—"}
                          </Text>

                          <Text fz="sm" c="dimmed">
                            Sự kiện đang chờ
                          </Text>

                          <Divider color="gray.2" />

                          {fresh && data.outbox ? (
                            <Stack gap={4}>
                              <Text fz="sm" fw={650} c="orange.8">
                                {data.outbox.failed} sự kiện retry
                              </Text>
                              <Text fz="sm" c="dimmed">
                                Chờ lâu nhất:{" "}
                                {Math.round(
                                  data.outbox.oldestPendingAgeMs / 1000
                                )} giây
                              </Text>
                            </Stack>
                          ) : (
                            <Text fz="sm" c="dimmed">
                              Chưa đọc được outbox
                            </Text>
                          )}
                        </Stack>
                      </Paper>
                    </SimpleGrid>
                  </Stack>
                </Paper>

                {/* NODES TABLE */}
                <Paper withBorder radius="lg" p="lg">
                  <Stack gap="md">
                    <Group gap="sm" wrap="nowrap">
                      <ThemeIcon
                        variant="light"
                        color="indigo"
                        size={42}
                        radius="md"
                      >
                        <IconServer size={21} />
                      </ThemeIcon>

                      <Box style={{ flex: 1 }}>
                        <Title order={3} fz="lg" fw={750}>
                          Các node dữ liệu
                        </Title>
                        <Text fz="sm" c="dimmed">
                          Trạng thái theo từng máy và dịch vụ
                        </Text>
                      </Box>

                      <Badge variant="light" color="gray">
                        {data.machines.length} node
                      </Badge>
                    </Group>

                    <Divider />

                    <Table.ScrollContainer minWidth={580}>
                      <Table
                        verticalSpacing="md"
                        horizontalSpacing="md"
                        highlightOnHover
                        striped
                        withRowBorders
                      >
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Node</Table.Th>
                            <Table.Th>Địa chỉ</Table.Th>
                            <Table.Th>CockroachDB</Table.Th>
                            <Table.Th>Cassandra</Table.Th>
                          </Table.Tr>
                        </Table.Thead>

                        <Table.Tbody>
                          {data.machines.map((m) => (
                            <Table.Tr key={m.machineId}>
                              <Table.Td>
                                <Text fw={700} fz="sm">
                                  {m.machineId}
                                </Text>
                              </Table.Td>

                              <Table.Td>
                                <Text fz="sm" c="dimmed">
                                  {m.host}
                                </Text>
                              </Table.Td>

                              <Table.Td>
                                <Badge
                                  variant="light"
                                  color={
                                    fresh
                                      ? getMonitorColor(m.cockroach)
                                      : "gray"
                                  }
                                  size="md"
                                  radius="md"
                                >
                                  {label[m.cockroach] ?? m.cockroach}
                                  {!fresh ? " (cũ)" : ""}
                                </Badge>
                              </Table.Td>

                              <Table.Td>
                                <Badge
                                  variant="light"
                                  color={
                                    fresh
                                      ? getMonitorColor(m.cassandra)
                                      : "gray"
                                  }
                                  size="md"
                                  radius="md"
                                >
                                  {label[m.cassandra] ?? m.cassandra}
                                  {!fresh ? " (cũ)" : ""}
                                </Badge>
                              </Table.Td>
                            </Table.Tr>
                          ))}

                          {data.machines.length === 0 && (
                            <Table.Tr>
                              <Table.Td colSpan={4}>
                                <Text ta="center" c="dimmed" py="lg">
                                  Chưa có dữ liệu node.
                                </Text>
                              </Table.Td>
                            </Table.Tr>
                          )}
                        </Table.Tbody>
                      </Table>
                    </Table.ScrollContainer>
                  </Stack>
                </Paper>

                {/* TRANSITION HISTORY */}
                <Paper withBorder radius="lg" p="lg">
                  <Stack gap="md">
                    <Group gap="sm" wrap="nowrap">
                      <ThemeIcon
                        variant="light"
                        color="violet"
                        size={42}
                        radius="md"
                      >
                        <IconHistory size={22} />
                      </ThemeIcon>

                      <Box style={{ flex: 1 }}>
                        <Title
                          order={3}
                          fz="lg"
                          fw={750}
                          id="recent-changes-title"
                        >
                          Thay đổi gần đây
                        </Title>
                        <Text fz="sm" c="dimmed">
                          Lịch sử biến động trạng thái dịch vụ
                        </Text>
                      </Box>

                      <Badge color="violet" variant="light" size="lg">
                        {data.transitions.length} thay đổi
                      </Badge>
                    </Group>

                    <Divider />

                    <Table.ScrollContainer minWidth={600}>
                      <Table
                        verticalSpacing="md"
                        horizontalSpacing="md"
                        highlightOnHover
                        withRowBorders
                        aria-labelledby="recent-changes-title"
                      >
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Thời gian</Table.Th>
                            <Table.Th>Node / Database</Table.Th>
                            <Table.Th>Trước</Table.Th>
                            <Table.Th>Sau</Table.Th>
                          </Table.Tr>
                        </Table.Thead>

                        <Table.Tbody>
                          {data.transitions.length > 0 ? (
                            data.transitions.slice(0, 12).map((t, i) => {
                              const observedAt = new Date(t.observedAt);

                              return (
                                <Table.Tr
                                  key={
                                    t.observedAt +
                                    t.service +
                                    t.machineId +
                                    i
                                  }
                                >
                                  <Table.Td>
                                    <Stack gap={3}>
                                      <Text fw={650} fz="sm">
                                        {observedAt.toLocaleTimeString("vi-VN")}
                                      </Text>
                                      <Text fz="sm" c="dimmed">
                                        {observedAt.toLocaleDateString("vi-VN")}
                                      </Text>
                                    </Stack>
                                  </Table.Td>

                                  <Table.Td>
                                    <Stack gap={3}>
                                      <Text fw={700} fz="sm">
                                        {t.machineId}
                                      </Text>
                                      <Text fz="sm" c="dimmed">
                                        {t.service}
                                      </Text>
                                    </Stack>
                                  </Table.Td>

                                  <Table.Td>
                                    <Badge
                                      color={getMonitorColor(t.before)}
                                      variant="light"
                                      radius="md"
                                    >
                                      {label[t.before] ?? t.before}
                                    </Badge>
                                  </Table.Td>

                                  <Table.Td>
                                    <Badge
                                      color={getMonitorColor(t.after)}
                                      variant="light"
                                      radius="md"
                                    >
                                      {label[t.after] ?? t.after}
                                    </Badge>
                                  </Table.Td>
                                </Table.Tr>
                              );
                            })
                          ) : (
                            <Table.Tr>
                              <Table.Td colSpan={4}>
                                <Center py="xl">
                                  <Stack align="center" gap="xs">
                                    <ThemeIcon
                                      size={50}
                                      radius="xl"
                                      color="gray"
                                      variant="light"
                                    >
                                      <IconHistory size={25} />
                                    </ThemeIcon>

                                    <Text fw={650}>
                                      Chưa ghi nhận thay đổi
                                    </Text>

                                    <Text fz="sm" c="dimmed" ta="center">
                                      Các biến động trạng thái sẽ xuất hiện tại đây.
                                    </Text>
                                  </Stack>
                                </Center>
                              </Table.Td>
                            </Table.Tr>
                          )}
                        </Table.Tbody>
                      </Table>
                    </Table.ScrollContainer>
                  </Stack>
                </Paper>

              </Stack>
            </Grid.Col>
          </Grid>
        )}
      </Stack>
    </Box>

  );
}
