"use client";
import { useParams } from "next/navigation";
import Link from "next/link";
import { usePolling } from "../../../lib/usePolling";
import type { Booking } from "../../../types/booking";
import type { TimelineType } from "../../../types/monitoring";

import {
      Alert,
      Badge,
      Box,
      Button,
      Center,
      Divider,
      Group,
      Loader,
      Paper,
      SimpleGrid,
      Stack,
      Text,
      ThemeIcon,
      Timeline,
      Title,
} from "@mantine/core";

import {
      IconAlertCircle,
      IconArmchair,
      IconArrowLeft,
      IconCalendar,
      IconCheck,
      IconClock,
      IconHistory,
      IconLuggage,
      IconMail,
      IconPlane,
      IconRefresh,
      IconTicket,
      IconToolsKitchen2,
      IconUser,
      IconWallet,
} from "@tabler/icons-react";

const formatVnd = (value: number | null | undefined) =>
      new Intl.NumberFormat("vi-VN", {
            style: "currency",
            currency: "VND",
      }).format(value ?? 0);

const labels: Record<string, string> = {
      BOOKING_CREATED: "Tạo yêu cầu đặt vé",
      SEAT_RESERVED: "Đặt ghế",
      INFANT_NO_SEAT_REQUIRED: "Trẻ dưới 2 tuổi không cần ghế riêng",
      PAYMENT_RECORDED: "Ghi nhận thanh toán demo",
      BOOKING_CONFIRMED: "Xác nhận vé"
};

const mealLabels: Record<string, string> = {
      CHICKEN: "Cơm gà",
      VEGETARIAN: "Suất chay",
      SANDWICH: "Sandwich"
};

const passengerLabels: Record<string, string> = {
      ADULT: "Người lớn",
      CHILD: "Trẻ em (2–dưới 16 tuổi)",
      INFANT: "Trẻ dưới 2 tuổi"
};

const fareByPassengerType: Record<string, number> = {
      ADULT: 1500000,
      CHILD: 1125000,
      INFANT: 0
};

const baggageFees: Record<number, number> = {
      15: 150000,
      20: 200000,
      25: 300000
};

const mealFees: Record<string, number> = {
      CHICKEN: 90000,
      VEGETARIAN: 75000,
      SANDWICH: 60000
};

const money = (value: number) => new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND"
}).format(value);

export default function BookingDetails() {
      const params = useParams<{ id: string }>();

      const details = usePolling<Booking>("/api/bookings/" + encodeURIComponent(params.id), 10000);

      const history = usePolling<TimelineType>("/api/bookings/" + encodeURIComponent(params.id) + "/events", 3000);

      return (

            <Box
                  component="section"
                  maw={1120}
                  mx="auto"
                  px={{ base: "md", md: "xl" }}
                  py={{ base: "lg", md: "xl" }}
            >
                  <Stack gap="xl">
                        {/* HEADER */}
                        <Group align="center" gap="md">
                              <ThemeIcon size={52} radius="lg" color="blue" variant="light">
                                    <IconTicket size={28} stroke={1.7} />
                              </ThemeIcon>

                              <Box style={{ flex: 1, minWidth: 0 }}>
                                    <Text fw={800} fz={12} c="blue.7" tt="uppercase" lts={1}>
                                          Vé & lịch sử
                                    </Text>
                                    <Title order={1} fz={{ base: 25, sm: 30 }} fw={800} c="dark.8">
                                          Thông tin đặt vé
                                    </Title>
                                    <Text c="dimmed" fz="sm" mt={4}>
                                          Tra cứu hành trình, dịch vụ và lịch sử giao dịch.
                                    </Text>
                              </Box>

                              <Button
                                    component={Link}
                                    href="/booking"
                                    variant="default"
                                    radius="md"
                                    size="md"
                                    leftSection={<IconArrowLeft size={18} />}
                              >
                                    Đặt vé khác
                              </Button>
                        </Group>

                        {/* LOADING */}
                        {details.loading && !details.data && (
                              <Paper withBorder radius="xl" p="xl">
                                    <Center mih={180}>
                                          <Stack align="center" gap="sm">
                                                <Loader color="blue" size="md" />
                                                <Text c="dimmed">Đang tải thông tin đặt vé...</Text>
                                          </Stack>
                                    </Center>
                              </Paper>
                        )}

                        {/* ERROR */}
                        {details.error && (
                              <Alert
                                    color="red"
                                    variant="light"
                                    radius="lg"
                                    title="Không thể tải thông tin vé"
                                    icon={<IconAlertCircle size={20} />}
                                    role="alert"
                              >
                                    {details.error}
                              </Alert>
                        )}

                        {details.data && (
                              <Stack gap="lg">
                                    {/* BOOKING SUMMARY */}
                                    <Paper
                                          radius="xl"
                                          withBorder
                                          p={{ base: "lg", sm: "xl" }}
                                          style={{
                                                background: "linear-gradient(120deg, #EFF6FF 0%, #FFFFFF 75%)",
                                                borderColor: "#BFDBFE",
                                          }}
                                    >
                                          <Stack gap="lg">
                                                <Group align="flex-start" gap="md">
                                                      <ThemeIcon color="blue" variant="filled" size={52} radius="lg">
                                                            <IconPlane size={27} />
                                                      </ThemeIcon>

                                                      <Box style={{ flex: 1, minWidth: 0 }}>
                                                            <Text fz="sm" c="dimmed" fw={600}>
                                                                  MÃ ĐẶT VÉ
                                                            </Text>

                                                            <Title
                                                                  order={2}
                                                                  fz={{ base: 22, sm: 28 }}
                                                                  fw={800}
                                                                  c="blue.8"
                                                                  style={{ overflowWrap: "anywhere" }}
                                                            >
                                                                  {details.data.bookingCode}
                                                            </Title>

                                                            <Text c="dimmed" fz="sm" mt={5}>
                                                                  Đặt lúc{" "}
                                                                  {new Date(details.data.createdAt).toLocaleString("vi-VN")}
                                                            </Text>
                                                      </Box>

                                                      <Badge
                                                            color={details.data.status === "CONFIRMED" ? "green" : "orange"}
                                                            variant="light"
                                                            size="lg"
                                                            radius="md"
                                                            leftSection={
                                                                  details.data.status === "CONFIRMED"
                                                                        ? <IconCheck size={14} />
                                                                        : <IconClock size={14} />
                                                            }
                                                      >
                                                            {details.data.status === "CONFIRMED"
                                                                  ? "Đã xác nhận"
                                                                  : details.data.status}
                                                      </Badge>
                                                </Group>

                                                <Divider color="blue.1" />

                                                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                                                      <Box>
                                                            <Text fz="sm" c="dimmed" mb={5}>
                                                                  Chuyến bay
                                                            </Text>
                                                            <Text fz={20} fw={800} c="dark.8">
                                                                  {details.data.flightNo}
                                                            </Text>
                                                      </Box>

                                                      <Box>
                                                            <Text fz="sm" c="dimmed" mb={5}>
                                                                  Chỗ ngồi
                                                            </Text>
                                                            <Group gap="xs">
                                                                  <IconArmchair size={20} color="#2563EB" />
                                                                  <Text fz={18} fw={700}>
                                                                        {details.data.seatNo
                                                                              ? `Ghế ${details.data.seatNo}`
                                                                              : "Trẻ ngồi cùng người lớn"}
                                                                  </Text>
                                                            </Group>
                                                      </Box>
                                                </SimpleGrid>
                                          </Stack>
                                    </Paper>

                                    <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
                                          {/* PASSENGER INFORMATION */}
                                          <Paper withBorder radius="xl" p="lg">
                                                <Stack gap="md">
                                                      <Group gap="sm" wrap="nowrap">
                                                            <ThemeIcon color="blue" variant="light" radius="md" size={42}>
                                                                  <IconUser size={22} />
                                                            </ThemeIcon>
                                                            <Box>
                                                                  <Title order={3} fz="lg" fw={750}>
                                                                        Thông tin hành khách
                                                                  </Title>
                                                                  <Text fz="sm" c="dimmed">
                                                                        Thông tin người đặt vé
                                                                  </Text>
                                                            </Box>
                                                      </Group>

                                                      <Divider color="gray.2" />

                                                      <Stack gap="md">
                                                            <Box>
                                                                  <Text fz="sm" c="dimmed">Họ và tên</Text>
                                                                  <Text fw={700} fz="md" mt={4}>
                                                                        {details.data.passengerName}
                                                                  </Text>
                                                            </Box>

                                                            <Box>
                                                                  <Text fz="sm" c="dimmed">Email nhận xác nhận</Text>
                                                                  <Group gap="xs" mt={4} wrap="nowrap">
                                                                        <IconMail size={18} color="#64748B" />
                                                                        <Text fw={600} style={{ overflowWrap: "anywhere", minWidth: 0 }}>
                                                                              {details.data.passengerEmail}
                                                                        </Text>
                                                                  </Group>
                                                            </Box>

                                                            <Box>
                                                                  <Text fz="sm" c="dimmed" mb="xs">Loại hành khách</Text>
                                                                  <Badge color="indigo" variant="light" size="lg" radius="md">
                                                                        {details.data.passengerType === "CHILD"
                                                                              ? "Trẻ em (2–12 tuổi)"
                                                                              : "Người lớn"}
                                                                  </Badge>
                                                            </Box>
                                                      </Stack>
                                                </Stack>
                                          </Paper>

                                          {/* SERVICES */}
                                          <Paper withBorder radius="xl" p="lg">
                                                <Stack gap="md">
                                                      <Group gap="sm" wrap="nowrap">
                                                            <ThemeIcon color="violet" variant="light" radius="md" size={42}>
                                                                  <IconLuggage size={22} />
                                                            </ThemeIcon>
                                                            <Box>
                                                                  <Title order={3} fz="lg" fw={750}>
                                                                        Hạng vé & dịch vụ
                                                                  </Title>
                                                                  <Text fz="sm" c="dimmed">
                                                                        Tiện ích đi kèm hành trình
                                                                  </Text>
                                                            </Box>
                                                      </Group>

                                                      <Divider color="gray.2" />

                                                      <Box>
                                                            <Text c="dimmed" fz="sm" mb="xs">Hạng vé</Text>
                                                            <Badge color="violet" variant="light" size="lg" radius="md">
                                                                  {details.data.cabinClass === "BUSINESS"
                                                                        ? "Thương gia"
                                                                        : details.data.cabinClass === "PREMIUM_ECONOMY"
                                                                              ? "Phổ thông đặc biệt"
                                                                              : "Phổ thông"}
                                                            </Badge>
                                                      </Box>

                                                      <SimpleGrid cols={2} spacing="sm">
                                                            <Paper radius="md" bg="gray.0" p="md">
                                                                  <IconLuggage size={21} color="#2563EB" />
                                                                  <Text fz="sm" c="dimmed" mt={6}>
                                                                        Hành lý xách tay
                                                                  </Text>
                                                                  <Text fw={700}>07 kg</Text>
                                                                  <Text fz="sm" c="teal.7">Đã bao gồm</Text>
                                                            </Paper>

                                                            <Paper radius="md" bg="gray.0" p="md">
                                                                  <IconLuggage size={21} color="#7C3AED" />
                                                                  <Text fz="sm" c="dimmed" mt={6}>
                                                                        Hành lý ký gửi
                                                                  </Text>
                                                                  <Text fw={700}>
                                                                        {details.data.baggageKg
                                                                              ? `${details.data.baggageKg} kg`
                                                                              : "Không mua thêm"}
                                                                  </Text>
                                                            </Paper>
                                                      </SimpleGrid>

                                                      <Group gap="sm" align="flex-start" wrap="nowrap">
                                                            <ThemeIcon color="orange" variant="light" radius="md" size={38}>
                                                                  <IconToolsKitchen2 size={20} />
                                                            </ThemeIcon>
                                                            <Box style={{ flex: 1, minWidth: 0 }}>
                                                                  <Text fz="sm" c="dimmed">Suất ăn</Text>
                                                                  <Text fw={600} mt={3}>
                                                                        {details.data.mealCode
                                                                              ? (mealLabels[details.data.mealCode] ?? details.data.mealCode)
                                                                              : "Không chọn suất ăn"}
                                                                  </Text>
                                                            </Box>
                                                      </Group>
                                                </Stack>
                                          </Paper>
                                    </SimpleGrid>

                                    {/* PAYMENT */}
                                    <Paper withBorder radius="xl" p="lg">
                                          <Stack gap="md">
                                                <Group gap="sm">
                                                      <ThemeIcon color="orange" variant="light" size={42} radius="md">
                                                            <IconWallet size={22} />
                                                      </ThemeIcon>
                                                      <Box>
                                                            <Title order={3} fz="lg" fw={750}>
                                                                  Chi tiết thanh toán
                                                            </Title>
                                                            <Text fz="sm" c="dimmed">
                                                                  Tổng hợp các khoản phụ thu và số tiền đặt vé
                                                            </Text>
                                                      </Box>
                                                </Group>

                                                <Divider />

                                                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
                                                      <Box>
                                                            <Text c="dimmed" fz="sm">Phụ thu ghế ngồi</Text>
                                                            <Text fw={700} fz="lg" mt={5}>
                                                                  {formatVnd(details.data.seatFee)}
                                                            </Text>
                                                      </Box>
                                                      <Box>
                                                            <Text c="dimmed" fz="sm">Phụ thu hạng vé</Text>
                                                            <Text fw={700} fz="lg" mt={5}>
                                                                  {formatVnd(details.data.cabinFee)}
                                                            </Text>
                                                      </Box>
                                                </SimpleGrid>

                                                <Paper
                                                      bg="blue.0"
                                                      radius="lg"
                                                      p="lg"
                                                      style={{ border: "1px solid var(--mantine-color-blue-2)" }}
                                                >
                                                      <Group align="center" gap="md">
                                                            <Box style={{ flex: 1, minWidth: 0 }}>
                                                                  <Text fw={700} c="dark.7">
                                                                        Tổng thanh toán mô phỏng
                                                                  </Text>
                                                                  <Text fz="sm" c="dimmed" mt={4}>
                                                                        Không phát sinh giao dịch tiền thật
                                                                  </Text>
                                                            </Box>
                                                            <Text fz={{ base: 22, sm: 26 }} fw={800} c="blue.7">
                                                                  {formatVnd(details.data.amount)}
                                                            </Text>
                                                      </Group>
                                                </Paper>
                                          </Stack>
                                    </Paper>
                              </Stack>
                        )}

                        {/* HISTORY */}
                        <Paper withBorder radius="xl" p={{ base: "md", sm: "lg" }}>
                              <Stack gap="lg">
                                    <Group gap="sm">
                                          <ThemeIcon color="indigo" variant="light" size={44} radius="md">
                                                <IconHistory size={23} />
                                          </ThemeIcon>
                                          <Box style={{ flex: 1 }}>
                                                <Title order={2} fz="xl" fw={750}>
                                                      Lịch sử sự kiện
                                                </Title>
                                                <Text fz="sm" c="dimmed">
                                                      Theo dõi quá trình ghi nhận và đồng bộ dữ liệu đặt vé
                                                </Text>
                                          </Box>

                                          {history.data && (
                                                <Badge color="gray" variant="light" size="lg">
                                                      {history.data.events.length} sự kiện
                                                </Badge>
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
                                                loading={details.loading || history.loading}
                                                onClick={() => {
                                                      details.refresh();
                                                      history.refresh();
                                                }}
                                          >
                                                Kiểm tra lại
                                          </Button>
                                    </Group>
                              </Stack>
                        </Paper>
                  </Stack>
            </Box>

      );
}
