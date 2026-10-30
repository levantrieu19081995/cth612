"use client";
import { Alert, Box, Button, Center, Group, Loader, Paper, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { IconAlertCircle, IconRefresh } from "@tabler/icons-react";
import { usePolling } from "../../lib/usePolling";
import type { AnalyticsSummary } from "../../types/monitoring";
import Benchmarks from "../../components/Benchmarks";
export default function AnalyticsPage()
{
  const { data, error, loading, refresh } = usePolling<AnalyticsSummary>("/api/analytics/summary", 5000);

  return (
    <Box component="section">
      <Stack gap="lg">
        <Stack gap={4}>
          <Text size="sm" fw={700} c="blue.7" tt="uppercase" lts={1}>Thống kê</Text>
          <Title order={1}>Booking & sự kiện</Title>
        </Stack>

        <Group justify="space-between">
          <Text c="dimmed">Số liệu đọc trực tiếp từ hai database.</Text>
          <Button variant="light" leftSection={<IconRefresh size={18} />} onClick={refresh} loading={loading}>Làm mới</Button>
        </Group>

        {error && (
          <Alert color="red" title="Không thể tải thống kê" icon={<IconAlertCircle size={20} />} role="alert">
            {error}. Nếu còn số liệu hiển thị, đó là lần đọc trước.
          </Alert>
        )}
        {loading && !data && (
          <Center mih={160} role="status">
            <Stack align="center" gap="sm">
              <Loader size="sm" />
              <Text c="dimmed">Đang tải thống kê…</Text>
            </Stack>
          </Center>
        )}

        {data && (
          <>
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
              <Paper withBorder radius="lg" p="lg">
                <Stack gap="xs">
                  <Title order={3} size="sm" c="dimmed">Vé đã xác nhận</Title>
                  <Text fz={32} fw={700} c="blue.7">{data.business.confirmed}</Text>
                  <Text size="sm" c="dimmed">{data.business.bookings} booking tổng cộng</Text>
                </Stack>
              </Paper>
              <Paper withBorder radius="lg" p="lg">
                <Stack gap="xs">
                  <Title order={3} size="sm" c="dimmed">Thanh toán demo</Title>
                  <Text fz={32} fw={700} c="blue.7">{data.business.payments}</Text>
                  <Text size="sm" c="dimmed">{new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(data.business.demoRevenue)}</Text>
                </Stack>
              </Paper>
              <Paper withBorder radius="lg" p="lg">
                <Stack gap="xs">
                  <Title order={3} size="sm" c="dimmed">Sự kiện hôm nay</Title>
                  <Text fz={32} fw={700} c="blue.7">{data.eventsToday ?? "—"}</Text>
                  <Text size="sm" c="dimmed">
                    Ngày UTC {data.eventDateUtc} · Cassandra{" "}
                    <Text span c={data.eventStoreStatus === "AVAILABLE" ? "teal.7" : "orange.8"}>{data.eventStoreStatus === "AVAILABLE" ? "khả dụng" : "tạm gián đoạn"}</Text>
                  </Text>
                </Stack>
              </Paper>
              <Paper withBorder radius="lg" p="lg">
                <Stack gap="xs">
                  <Title order={3} size="sm" c="dimmed">Sự kiện đã đồng bộ</Title>
                  <Text fz={32} fw={700} c="teal.7">{data.outbox.published}</Text>
                  <Text size="sm" c="dimmed">
                    <Text span c={data.outbox.pending > 0 ? "orange.8" : "dimmed"}>{data.outbox.pending} đang chờ</Text>
                    {" · "}<Text span c={data.outbox.failed > 0 ? "red.7" : "dimmed"}>{data.outbox.failed} đang retry</Text>
                  </Text>
                </Stack>
              </Paper>
            </SimpleGrid>

            <Paper withBorder radius="lg" p="lg">
              <Stack gap="sm">
                <Title order={2} size="lg">Dữ liệu chuyến bay</Title>
                <Text>
                  <Text span fw={700} c="blue.7">{data.business.flights}</Text> chuyến sắp khởi hành
                  {" · "}<Text span fw={700} c="teal.7">{data.business.availableSeats}</Text> ghế còn trống.
                </Text>
                <Text size="sm" c="dimmed">Thanh toán mô phỏng; các vé kiểm thử được tính trong số liệu database.</Text>
                <Text size="xs" c="dimmed">Quan sát lúc {new Date(data.observedAt).toLocaleString("vi-VN")}</Text>
              </Stack>
            </Paper>
          </>
        )}

        <Benchmarks />
      </Stack>
    </Box>
  );
}
