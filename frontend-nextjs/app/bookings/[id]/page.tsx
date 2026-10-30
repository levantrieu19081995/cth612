"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { Alert, Box, Button, Center, Divider, Group, Loader, Modal, Paper, Stack, Text, ThemeIcon, Timeline, Title } from "@mantine/core";
import { IconAlertCircle, IconArrowLeft, IconCalendar, IconCheck, IconClock, IconHistory, IconRefresh } from "@tabler/icons-react";
import { usePolling } from "../../../lib/usePolling";
import type { Booking, BookingGroup } from "../../../types/booking";
import type { TimelineType } from "../../../types/monitoring";
import FlightPassengerList from "../../booking/FlightPassengerList";
import { money } from "@/components/utils/func";

const labels: Record<string, string> = {
      BOOKING_CREATED: "Tạo yêu cầu đặt vé",
      SEAT_RESERVED: "Đặt ghế",
      INFANT_NO_SEAT_REQUIRED: "Trẻ dưới 2 tuổi không cần ghế riêng",
      PAYMENT_RECORDED: "Ghi nhận thanh toán demo",
      BOOKING_CONFIRMED: "Xác nhận vé"
};

function BookingHistory({ booking }: { booking: Booking }) {
  const history = usePolling<TimelineType>(
    "/api/bookings/" + encodeURIComponent(booking.bookingId) + "/events",
    3000,
  );

  return (
    <Paper withBorder radius="xl" p={{ base: "md", sm: "lg" }}>
      <Stack gap="lg">
        <Group gap="sm">
          <ThemeIcon color="indigo" variant="light" size={44} radius="md">
            <IconHistory size={23} />
          </ThemeIcon>
          <Box style={{ flex: 1 }}>
            <Title order={2} fz="xl" fw={750}>
              {booking.passengerName} · {booking.bookingCode}
            </Title>

            <Text fz="sm" c="dimmed">
              {booking.flightNo} · {booking.seatNo ? `Ghế ${booking.seatNo}` : "Không có ghế riêng"}
            </Text>
            
          </Box>

          {history.data && (
            <Text size="sm" c="dimmed">
              {history.data.events.length} sự kiện
            </Text>
          )}
        </Group>

        <Divider />

        {history.error && (
          <Alert
            color="orange"
            variant="light"
            radius="md"
            title="Không thể đọc lịch sử"
            icon={<IconAlertCircle size={20} />}
            role="alert"
          >
            {history.error} Thông tin vé phía trên vẫn được đọc độc lập.
          </Alert>
        )}

        {history.loading && !history.data && (
          <Center mih={100}>
            <Stack align="center" gap="sm">
              <Loader size="sm" />
              <Text c="dimmed">Đang đọc lịch sử...</Text>
            </Stack>
          </Center>
        )}

        {history.data && (
          <>
            <Alert
              color={history.data.synchronizedEvents ? "teal" : "orange"}
              variant="light"
              radius="md"
              icon={
                history.data.synchronizedEvents
                  ? <IconCheck size={20} />
                  : <IconClock size={20} />
              }
              title={
                history.data.synchronizedEvents
                  ? "Dữ liệu đã đồng bộ"
                  : "Đang chờ đồng bộ"
              }
            >
              {history.data.synchronizedEvents
                ? "Tất cả sự kiện đã được đồng bộ."
                : `${history.data.pendingEvents} sự kiện đang chờ đồng bộ.`}
            </Alert>

            {history.data.events.length === 0 ? (
              <Center py="xl">
                <Stack gap="xs" align="center">
                  <ThemeIcon color="gray" size={54} radius="xl" variant="light">
                    <IconHistory size={27} />
                  </ThemeIcon>
                  <Text fw={650}>Chưa có lịch sử sự kiện</Text>
                  <Text c="dimmed" fz="sm" ta="center">
                    Lịch sử chưa có dữ liệu; trang sẽ tự cập nhật.
                  </Text>
                </Stack>
              </Center>
            ) : (
              <Timeline
                active={history.data.events.length - 1}
                bulletSize={30}
                lineWidth={2}
                color={history.data.synchronizedEvents ? "teal" : "orange"}
              >
                {history.data.events.slice().reverse().map((event) => (
                  <Timeline.Item
                    key={event.eventId}
                    bullet={<IconClock size={16} />}
                    title={
                      <Text fw={700} fz="md">
                        {labels[event.eventType] ?? event.eventType}
                      </Text>
                    }
                  >
                    <Group gap={6} mt={6}>
                      <IconCalendar size={16} color="#64748B" />
                      <Text fz="sm" c="dimmed">
                        {new Date(event.occurredAt).toLocaleString("vi-VN")}
                      </Text>
                    </Group>
                  </Timeline.Item>
                ))}
              </Timeline>
            )}
          </>
        )}

        <Divider />

        <Group justify="flex-end">
          <Button
            variant="light"
            color="blue"
            size="md"
            radius="md"
            leftSection={<IconRefresh size={18} />}
            loading={history.loading}
            onClick={() =>
            {
              history.refresh();
            }}
          >
            Kiểm tra lại
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}

export default function BookingDetails() {
  const params = useParams<{ id: string }>();
  const [historyTicketId, setHistoryTicketId] = useState<string | null>(null);
  const isTicketId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.id);
  const details = usePolling<BookingGroup | Booking>(
    (isTicketId ? "/api/bookings/" : "/api/booking-groups/") + encodeURIComponent(params.id),
    10000,
  );
  const group = details.data && "tickets" in details.data ? details.data : null;
  const tickets = details.data ? ("tickets" in details.data ? details.data.tickets : [details.data]) : [];
  const historyTicket = tickets.find(ticket => ticket.bookingId === historyTicketId);

  return (
    <Box component="section" maw={1120} mx="auto" px={{ base: "md", md: "xl" }} py="xl">
      <Stack gap="lg">

        <Group justify="space-between">
          <Title order={1}>Thông tin đặt vé</Title>
          <Button component={Link} href="/booking" variant="default" leftSection={<IconArrowLeft size={18} />}>Đặt vé khác</Button>
        </Group>

        {details.loading && !details.data && <Center mih={180}><Loader /></Center>}

        {details.error && <Alert color="red" title="Không thể tải thông tin vé" icon={<IconAlertCircle size={20} />} role="alert">{details.error}</Alert>}

        {details.data && (
          <>
            {group && (
              <Paper withBorder radius="lg" p="md">
                <Stack gap="xs">
                  <Title order={2} size="lg" c="blue.8">Mã đặt chỗ: {group.groupCode}</Title>
                  <Text size="sm" c="dimmed">Đặt lúc {new Date(group.createdAt).toLocaleString("vi-VN")}</Text>
                  <Text size="sm">Email nhận xác nhận: {group.contactEmail}</Text>
                  <Text fw={700} c="blue.8">Tổng thanh toán: {money(group.totalAmount)}</Text>
                </Stack>
              </Paper>
            )}

            <FlightPassengerList onViewHistory={setHistoryTicketId} entries={tickets.map(ticket => ({
              key: ticket.bookingId,
              bookingId: ticket.bookingId,
              flightId: ticket.flightId,
              flightNo: ticket.flightNo,
              legNo: ticket.legNo ?? 1,
              groupCode: ticket.groupCode,
              
              passengerName: ticket.passengerName,
              passengerType: ticket.passengerType,
              seatNo: ticket.seatNo,
              cabinClass: ticket.cabinClass,
              baggageKg: ticket.baggageKg,
              mealCode: ticket.mealCode,
              seatFee: ticket.seatFee,
              cabinFee: ticket.cabinFee,
              total: ticket.amount,
              bookingCode: ticket.bookingCode,
              status: ticket.status,
            }))} />

            {tickets.length === 0 && <Text c="dimmed">Chưa có vé trong mã đặt chỗ này.</Text>}
          </>
        )}

        <Group justify="flex-end">
          <Button variant="light" leftSection={<IconRefresh size={18} />} loading={details.loading} onClick={details.refresh}>Cập nhật thông tin đặt vé</Button>
        </Group>

      </Stack>

      <Modal
        opened={!!historyTicket}
        onClose={() => setHistoryTicketId(null)}
        title="Lịch sử vé"
        size="lg"
        centered
      >
        {historyTicket && <BookingHistory key={historyTicket.bookingId} booking={historyTicket} />}
      </Modal>
    </Box>
  );
}
