"use client";

import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Center,
  Collapse,
  Container,
  Divider,
  Grid,
  Group,
  Loader,
  NumberInput,
  Paper,
  ScrollArea,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Stepper,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from "@mantine/core";
import {
  IconAlertCircle,
  IconArrowRight,
  IconArmchair,
  IconCalendar,
  IconCheck,
  IconCircleCheck,
  IconClock,
  IconInfoCircle,
  IconPlane,
  IconPlaneDeparture,
  IconSearch,
  IconTicket,
  IconChevronDown,
  IconChevronUp,
} from "@tabler/icons-react";

import { DateInput, MonthPickerInput } from '@mantine/dates';
import 'dayjs/locale/vi';

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ApiError, apiGet, apiPost } from "../../lib/api";
import type { Flight, Seat, Booking } from "../../types/booking";
import Link from "next/link";

import { useForm } from "@mantine/form";
import { __getTimChuyenBay } from "@/components/api/booking";
import { dateFormater } from "@/components/utils/date-format";
import { useDisclosure } from "@mantine/hooks";

const money = (value: number) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(value);
const time = (value: string) => new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour12: false });

const flightDuration = (departure: string, arrival: string) => {
  const totalMinutes = Math.max(0, Math.round((new Date(arrival).getTime() - new Date(departure).getTime()) / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return [hours > 0 ? `${hours} giờ` : "", minutes > 0 ? `${minutes} phút` : ""].filter(Boolean).join(" ") || "Dưới 1 phút";
};
const baggageOptions = [
  { value: "15", label: "15 kg · 150.000đ" },
  { value: "20", label: "20 kg · 200.000đ" },
  { value: "25", label: "25 kg · 300.000đ" },
];
const mealOptions = [
  { value: "CHICKEN", label: "Cơm gà · 90.000đ" },
  { value: "VEGETARIAN", label: "Suất chay · 75.000đ" },
  { value: "SANDWICH", label: "Sandwich · 60.000đ" },
];
const baggagePrices: Record<string, number> = { "15": 150000, "20": 200000, "25": 300000 };
const mealPrices: Record<string, number> = { CHICKEN: 90000, VEGETARIAN: 75000, SANDWICH: 60000 };
const adultFare = 1500000;
type PassengerType = "ADULT" | "CHILD" | "INFANT";
type PassengerDraft = {
  id: number;
  type: PassengerType;
  name: string;
  email: string;
  seatId: string | null;
  baggageKg: string | null;
  mealCode: string | null;
};
const passengerTypeLabels: Record<PassengerType, string> = {
  ADULT: "Người lớn",
  CHILD: "Trẻ em (2–dưới 16 tuổi)",
  INFANT: "Trẻ dưới 2 tuổi",
};
const passengerFare = (type: PassengerType) =>
  type === "INFANT" ? 0 : type === "CHILD" ? adultFare * 0.75 : adultFare;
const seatPrice = (seatNo: string) => {
  if (seatNo.startsWith("01")) return 100000;
  if (seatNo.endsWith("A") || seatNo.endsWith("F")) return 50000;
  return 0;
};
const seatLocation = (seatNo: string) => {
  const position = seatNo.slice(-1).toUpperCase();
  if (position === "A" || position === "F") return { label: "Cửa sổ", shortLabel: "CỬA SỔ" };
  if (position === "C" || position === "D") return { label: "Lối đi", shortLabel: "LỐI ĐI" };
  if (position === "B" || position === "E") return { label: "Ở giữa", shortLabel: "GIỮA" };
  return { label: "Không xác định vị trí", shortLabel: "" };
};
const errorText = (error: unknown) => error instanceof Error ? error.message : "Không thể kết nối backend.";

const airportOptions = [
  { value: "SGN", label: "TP. Hồ Chí Minh (SGN)" },
  { value: "HAN", label: "Hà Nội (HAN)" },
  { value: "DAD", label: "Đà Nẵng (DAD)" },
  { value: "VCA", label: "Cần Thơ (VCA)" },
];

export default function BookingPage() {
  const [flights, setFlights] = useState<Flight[]>([]);
  const [flight, setFlight] = useState<Flight | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [passengers, setPassengers] = useState<PassengerDraft[]>([{
    id: 1, type: "ADULT", name: "", email: "", seatId: null, baggageKg: null, mealCode: null,
  }]);
  const [activePassengerId, setActivePassengerId] = useState(1);
  const nextPassengerId = useRef(2);
  const [booking, setBooking] = useState<Booking[] | null>(null);

  const [searching, setSearching] = useState(false);
  const [loadingSeats, setLoadingSeats] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const seatRequest = useRef(0);
  const searchRequest = useRef(0);
  const submitLock = useRef(false);
  const pendingRequest = useRef<{ fingerprint: string; id: string } | null>(null);
  const activePassenger = passengers.find(item => item.id === activePassengerId) ?? passengers[0];
  const seat = activePassenger?.seatId
    ? seats.find(item => item.seatId === activePassenger.seatId) ?? null
    : null;
  const fareTotal = passengers.reduce((total, item) => total + passengerFare(item.type), 0);
  const selectedSeatFee = passengers.reduce((total, passenger) => {
    const assignedSeat = seats.find(item => item.seatId === passenger.seatId);
    return total + (assignedSeat ? seatPrice(assignedSeat.seatNo) : 0);
  }, 0);
  const selectedBaggageFee = passengers.reduce((total, item) =>
    total + (item.baggageKg ? baggagePrices[item.baggageKg] : 0), 0);
  const selectedMealFee = passengers.reduce((total, item) =>
    total + (item.mealCode ? mealPrices[item.mealCode] : 0), 0);
  const taxFee = 0;
  const serviceFee = 0;
  const bookingTotal = fareTotal + selectedSeatFee + selectedBaggageFee + selectedMealFee + taxFee + serviceFee;

  const [searchPeriod, setSearchPeriod] = useState<"day" | "month">("day");
  const [expandedSeats, handlersSeats] = useDisclosure(false);

  const form = useForm<{
    origin: string | null;
    destination: string | null;
    date: string | null;
    month: string | null;
  }>({
    initialValues: {
      origin: null,
      destination: null,
      date: null,
      month: null,
    },
  })

  function updatePassengerCount(type: PassengerType, requestedCount: number | string) {
    const otherCount = passengers.filter(item => item.type !== type).length;
    const minimum = type === "ADULT" ? 1 : 0;
    const count = Math.max(minimum, Math.min(9 - otherCount, Number(requestedCount) || 0));
    const nextPassengers = passengers.filter(item => item.type !== type);
    const existing = passengers.filter(item => item.type === type).slice(0, count);
    nextPassengers.push(...existing);
    while (existing.length < count) {
      const passenger: PassengerDraft = {
        id: nextPassengerId.current++,
        type,
        name: "",
        email: "",
        seatId: null,
        baggageKg: null,
        mealCode: null,
      };
      existing.push(passenger);
      nextPassengers.push(passenger);
    }
    nextPassengers.sort((first, second) =>
      ["ADULT", "CHILD", "INFANT"].indexOf(first.type) - ["ADULT", "CHILD", "INFANT"].indexOf(second.type));
    setPassengers(nextPassengers);
    if (!nextPassengers.some(item => item.id === activePassengerId)) {
      setActivePassengerId(nextPassengers[0].id);
    }
    setBooking(null);
  }

  function updatePassenger(id: number, changes: Partial<PassengerDraft>) {
    setPassengers(current => current.map(item => item.id === id ? { ...item, ...changes } : item));
    setBooking(null);
  }

  async function handleSearchFlights(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const currentRequest = ++searchRequest.current;
    const values = form.values;
    setSearching(true);
    setLoadingSeats(false);
    setError("");
    setFlight(null);
    setSeats([]);
    setPassengers(current => current.map(item => ({ ...item, seatId: null })));
    setBooking(null);

    try {
      const request = {
        origin: values.origin,
        destination: values.destination,
        ...(searchPeriod === "day" && values.date
          ? { date: values.date.slice(0, 10) }
          : {}),
        ...(searchPeriod === "month" && values.month
          ? { month: values.month.slice(0, 7) }
          : {}),
      }
      const data = await __getTimChuyenBay(request);
      if (currentRequest === searchRequest.current) setFlights(data);
    } catch (err) {
      if (currentRequest === searchRequest.current) {
        setFlights([]);
        setError(errorText(err));
      }
    } finally {
      if (currentRequest === searchRequest.current) setSearching(false);
    }
  }

  async function chooseFlight(item: Flight) {
    const request = ++seatRequest.current;
    setFlight(item);
    setSeats([]);
    setPassengers(current => current.map(passenger => ({ ...passenger, seatId: null })));
    setBooking(null);
    setError("");
    setLoadingSeats(true);
    try {
      const data = await apiGet<Seat[]>(`/api/flights/${item.flightId}/seats`);
      if (request === seatRequest.current) setSeats(data);
    } catch (err) {
      if (request === seatRequest.current)
        setError(errorText(err));
    }
    finally {
      if (request === seatRequest.current)
        setLoadingSeats(false);
    }
  }

  async function book(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!flight || submitLock.current) return;
    if (passengers.some(item => !item.name.trim() || !item.email.trim() ||
      (item.type !== "INFANT" && !item.seatId))) {
      setError("Nhập đầy đủ thông tin hành khách và chọn ghế cho người lớn, trẻ em.");
      return;
    }
    submitLock.current = true; setSubmitting(true); setError(""); setBooking(null);
    const groupRequest = passengers.map(item => ({
      passengerName: item.name.trim(),
      passengerEmail: item.email.trim(),
      passengerType: item.type,
      seatId: item.seatId,
      baggageKg: item.baggageKg ? Number(item.baggageKg) : null,
      mealCode: item.mealCode,
    }));
    const fingerprint = JSON.stringify([flight.flightId, groupRequest]);
    if (pendingRequest.current?.fingerprint !== fingerprint) {
      let stored: { fingerprint: string; id: string } | null = null;
      try {
        const candidate: unknown = JSON.parse(sessionStorage.getItem("pending-booking") ?? "null");
        if (candidate && typeof candidate === "object" && "fingerprint" in candidate && "id" in candidate && typeof candidate.fingerprint === "string" && typeof candidate.id === "string") stored = { fingerprint: candidate.fingerprint, id: candidate.id };
      } catch { /* Optional browser storage; the in-memory request key remains authoritative. */ }
      pendingRequest.current = stored?.fingerprint === fingerprint ? stored : { fingerprint, id: crypto.randomUUID() };
      try { sessionStorage.setItem("pending-booking", JSON.stringify(pendingRequest.current)); } catch { /* Private browsing can disable storage. */ }
    }
    try {
      const result = await apiPost<Booking[]>("/api/bookings/group", {
        requestId: pendingRequest.current!.id,
        flightId: flight.flightId,
        passengers: groupRequest,
      });
      if (!Array.isArray(result) || result.length !== groupRequest.length) {
        throw new Error("Backend không trả đủ vé đã đặt. Hãy gửi lại cùng thông tin để kiểm tra trạng thái.");
      }
      setBooking(result);
      pendingRequest.current = null;
      try { sessionStorage.removeItem("pending-booking"); } catch { /* Storage is optional. */ }
      const bookedSeatIds = new Set(result.map(item => item.seatId).filter((id): id is string => Boolean(id)));
      setSeats(current => current.map(item => bookedSeatIds.has(item.seatId) ? { ...item, status: "BOOKED" } : item));
      setFlights(current => current.map(item => item.flightId === flight.flightId
        ? { ...item, availableSeats: Math.max(0, item.availableSeats - bookedSeatIds.size) }
        : item));
    } catch (err) {
      setError(errorText(err) + (err instanceof ApiError && err.status < 500 ? "" : ". Chưa xác định yêu cầu đã lưu hay chưa; bấm gửi lại với cùng thông tin để kiểm tra an toàn."));
      if (err instanceof ApiError && err.code === "SEAT_ALREADY_BOOKED") {
        setPassengers(current => current.map(passenger => ({ ...passenger, seatId: null })));
        try { setSeats(await apiGet<Seat[]>(`/api/flights/${flight.flightId}/seats`)); }
        catch { setError("Ghế đã được đặt. Không thể tải lại sơ đồ; hãy chọn lại chuyến bay."); }
      }
    } finally { submitLock.current = false; setSubmitting(false); }
  }

  const availableSeats = seats.filter(item => item.status === "AVAILABLE").length;
  const requiredSeatCount = passengers.filter(item => item.type !== "INFANT").length;
  const assignedSeatCount = passengers.filter(item => item.type !== "INFANT" && item.seatId).length;

  return (
    <Box className="booking-page-shell" bg="var(--mantine-color-gray-0)" mih="100vh" py={{ base: "lg", md: "xl" }}>
      <Container size="xl">
        <Stack gap="lg">
          <Box className="booking-hero">
            <Group className="booking-hero-layout" justify="space-between" align="center" gap="xl" wrap="wrap">
              <Stack className="booking-hero-copy" gap="md">
                <Badge className="booking-hero-kicker" leftSection={<IconPlaneDeparture size={14} />} variant="light" radius="xl">
                  ĐẶT VÉ MÁY BAY
                </Badge>
                <Box>
                  <Title order={1} size="clamp(30px, 4vw, 48px)" fw={850}>
                    Bắt đầu hành trình
                    <br />
                    <span>theo cách của bạn.</span>
                  </Title>
                  <Text size="md" mt="sm" maw={540}>
                    Tìm chuyến phù hợp, chọn chỗ yêu thích và xác nhận vé chỉ trong vài bước.
                  </Text>
                </Box>
                <Group className="booking-hero-highlights" gap="lg" wrap="wrap">
                  <Group gap={7} wrap="nowrap"><IconCheck size={17} /><Text size="sm">Lịch bay linh hoạt</Text></Group>
                  <Group gap={7} wrap="nowrap"><IconCheck size={17} /><Text size="sm">Tự chọn chỗ ngồi</Text></Group>
                </Group>
              </Stack>

              <Paper className="booking-hero-route" radius="xl" p="lg" aria-label="Minh họa hành trình bay">
                <Text className="booking-hero-route-label" size="xs" fw={800} tt="uppercase" lts={1.4}>
                  HÀNH TRÌNH TIẾP THEO
                </Text>
                <Group className="booking-hero-route-points" justify="space-between" align="center" wrap="nowrap" mt="lg">
                  <Stack gap={3}>
                    <Text className="booking-hero-route-code">ĐI</Text>
                    <Text size="xs">Nơi khởi hành</Text>
                  </Stack>
                  <Box className="booking-hero-route-line"><IconPlane size={21} /></Box>
                  <Stack gap={3} ta="right">
                    <Text className="booking-hero-route-code">ĐẾN</Text>
                    <Text size="xs">Điểm đến</Text>
                  </Stack>
                </Group>
                <Text className="booking-hero-route-note" size="xs" mt="lg">
                  Chọn hành trình để xem các chuyến bay đang mở bán
                </Text>
              </Paper>
            </Group>
          </Box>

          <Alert
            icon={<IconInfoCircle size={20} />}
            color="blue"
            variant="light"
            radius="md"
            title="Môi trường đặt vé mô phỏng"
            className="booking-demo-alert"
          >
            Giá vé người lớn mô phỏng là 1.500.000đ; trẻ 2–15 tuổi tính 75%, trẻ dưới 2 tuổi miễn phí. Thuế và phí dịch vụ hiện là 0đ. Tổng giá vé, ghế và dịch vụ được hiển thị trước khi xác nhận; chưa thu tiền thật.
          </Alert>

          {/* TIẾN TRÌNH */}
          <Paper className="booking-stepper-card" withBorder radius="lg" p={{ base: "md", sm: "lg" }} shadow="xs">
            <Stepper
              className="booking-progress"
              active={booking ? 2 : flight ? 1 : 0}
              allowNextStepsSelect={false}
              completedIcon={<IconCheck size={20} />}
              color="blue"
              iconSize={38}
              size="sm"
            >
              <Stepper.Step label="Tìm chuyến" description="Chọn hành trình" icon={<IconPlaneDeparture size={19} />} />
              <Stepper.Step label="Chọn chỗ" description="Ghế và hành khách" icon={<IconArmchair size={19} />} />
              <Stepper.Step label="Xác nhận" description="Nhận mã đặt vé" icon={<IconTicket size={19} />} />
            </Stepper>

          </Paper>

          {/* BỘ LỌC TÌM CHUYẾN */}
          <Paper className="booking-search-card" withBorder radius="lg" p={{ base: "md", sm: "lg" }} shadow="xs">
            <Stack gap="md">
              <Group gap="sm" wrap="nowrap">
                <ThemeIcon variant="light" size={42} radius="md" color="blue">
                  <IconSearch size={22} />
                </ThemeIcon>
                <Box>
                  <Text className="booking-section-kicker" size="xs" fw={800} tt="uppercase" lts={1}>01 · HÀNH TRÌNH</Text>
                  <Title order={2} size="lg">Tìm chuyến bay</Title>
                  <Text c="dimmed" size="sm">Lọc theo điểm đi, điểm đến và ngày hoặc tháng khởi hành.</Text>
                </Box>
              </Group>

              <Box component="form" onSubmit={handleSearchFlights}>
                <Stack gap="md">
                  <SegmentedControl
                    aria-label="Tìm chuyến theo ngày hoặc tháng"
                    data={[
                      { label: "Theo ngày", value: "day" },
                      { label: "Theo tháng", value: "month" },
                    ]}
                    value={searchPeriod}
                    onChange={(value) => {
                      if (value !== "day" && value !== "month") return;
                      setSearchPeriod(value);
                      form.setFieldValue(value === "day" ? "month" : "date", null);
                    }}
                    disabled={submitting || searching}
                  />

                  <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md" verticalSpacing="sm">
                    <Select
                      label="Nơi đi"
                      placeholder="Tất cả điểm đi"
                      data={airportOptions}
                      {...form.getInputProps("origin")}

                      disabled={submitting}
                      clearable
                      searchable
                      size="md"
                      radius="md"
                      comboboxProps={{ withinPortal: true, zIndex: 500 }}
                    />

                    <Select
                      label="Nơi đến"
                      placeholder="Tất cả điểm đến"
                      data={airportOptions?.filter((opt) => opt.value !== form.values.origin)}
                      {...form.getInputProps("destination")}
                      disabled={submitting}
                      clearable
                      searchable
                      size="md"
                      radius="md"
                      comboboxProps={{ withinPortal: true, zIndex: 500 }}
                    />

                    {searchPeriod === "day" ? (
                      <DateInput
                        placeholder="Chọn ngày bay"
                        label="Ngày bay"
                        {...form.getInputProps("date")}
                        disabled={submitting}
                        leftSection={<IconCalendar size={18} />}
                        size="md"
                        radius="md"
                        minDate={new Date()}
                        valueFormat="DD/MM/YYYY"
                        locale="vi"
                      />
                    ) : (
                      <MonthPickerInput
                        placeholder="Chọn tháng bay"
                        label="Tháng bay"
                        {...form.getInputProps("month")}
                        disabled={submitting}
                        leftSection={<IconCalendar size={18} />}
                        size="md"
                        radius="md"
                        minDate={new Date()}
                        valueFormat="MMMM YYYY"
                        locale="vi"
                      />
                    )}

                    <Button
                      className="booking-search-submit"
                      type="submit"
                      size="md"
                      radius="md"
                      mt={26}
                      loading={searching}
                      disabled={
                        submitting ||
                        searching ||
                        (searchPeriod === "day" ? !form.values.date : !form.values.month)
                      }
                      leftSection={<IconSearch size={19} />}
                      rightSection={<IconArrowRight size={17} />}
                      fullWidth
                    >
                      Tìm chuyến bay
                    </Button>
                  </SimpleGrid>
                </Stack>
              </Box>
            </Stack>
          </Paper>

          {error && (
            <Alert icon={<IconAlertCircle size={20} />} title="Có lỗi xảy ra" color="red" variant="light" radius="md" role="alert">
              {error}
            </Alert>
          )}

          <Stack gap="md" className="booking-content-grid">
            <Paper className="booking-panel booking-flight-panel" component="section" withBorder radius="lg" p={{ base: "md", sm: "lg" }} shadow="xs" aria-labelledby="flight-results-title">
              <Stack gap="md">
                <Group justify="space-between" align="center">
                  <Box>
                    <Text className="booking-section-kicker" size="xs" fw={800} tt="uppercase" lts={1}>02 · CHỌN CHUYẾN</Text>
                    <Title order={2} size="xl" id="flight-results-title">Chuyến bay</Title>
                  </Box>
                  {!searching && <Badge color="gray" variant="light" size="lg">{flights.length} chuyến</Badge>}
                </Group>
                <Divider />

                {searching ? (
                  <Center mih={180} role="status">
                    <Stack align="center" gap="sm">
                      <Loader size="md" />
                      <Text size="sm" c="dimmed">Đang tải chuyến bay…</Text>
                    </Stack>
                  </Center>
                ) : flights.length === 0 ? (
                  <Center mih={220}>
                    <Stack align="center" gap="sm" px="md">
                      <ThemeIcon size={58} radius="xl" color="gray" variant="light">
                        <IconSearch size={30} />
                      </ThemeIcon>
                      <Text fw={700} ta="center">Không tìm thấy chuyến bay</Text>
                      <Text c="dimmed" size="sm" ta="center">
                        Chuyến bay từ <strong>{form.values.origin || "nơi đi"}</strong> đến <strong>{form.values.destination || "nơi đến"}</strong> trong {searchPeriod === "day" ? <>ngày <strong>{form.values.date ? dateFormater(form.values.date, "dd/MM/yyyy") : "đã chọn"}</strong></> : <>tháng <strong>{form.values.month?.slice(0, 7) ?? "đã chọn"}</strong></>} không có sẵn.
                      </Text>
                    </Stack>
                  </Center>
                ) : (
                  <Grid>
                    <Grid.Col span={8}>
                      <Stack gap="sm">
                        {flights.map((item) => {
                          const isSelected = flight?.flightId === item.flightId;
                          const soldOut = item.availableSeats === 0;

                          return (
                            <Paper
                              component="button"
                              type="button"
                              key={item.flightId}
                              className={`booking-flight-card${isSelected ? " booking-flight-card-selected" : ""}`}
                              withBorder
                              radius="md"
                              p="md"
                              disabled={submitting || searching}
                              aria-pressed={isSelected}
                              onClick={() => void chooseFlight(item)}
                              style={{
                                display: "block",
                                width: "100%",
                                textAlign: "left",
                                cursor: submitting || searching ? "not-allowed" : "pointer",
                                transition: "border-color 150ms ease, background-color 150ms ease",
                              }}
                            >
                              <Stack gap="md">
                                <Group className="booking-ticket-heading" justify="space-between" gap="xs" wrap="wrap">
                                  <Group gap="xs">
                                    <ThemeIcon variant="light" size={30} radius="md" color="blue">
                                      <IconPlane size={17} />
                                    </ThemeIcon>
                                    <Text fw={750} size="md" c="dark">{item.flightNo}</Text>
                                  </Group>

                                  <Badge
                                    size="md"
                                    color={soldOut ? "red" : "teal"}
                                  >
                                    {soldOut ? "Hết chỗ" : `${item.availableSeats} ghế trống`}
                                  </Badge>
                                </Group>

                                <Group className="booking-ticket-route" gap="xs" align="center" wrap="nowrap">
                                  <Stack className="booking-ticket-airport" gap={3} style={{ flex: 1, minWidth: 0 }}>
                                    <Text className="booking-ticket-time">{dateFormater(item.departureTime, "HH:mm")}</Text>
                                    <Text className="booking-ticket-code">{item.origin}</Text>
                                    <Text size="sm" c="dimmed" lineClamp={2}>{item.originCity}</Text>
                                  </Stack>
                                  <Stack className="booking-ticket-track" gap={4} align="center" style={{ flex: 1 }}>
                                    <Text size="xs" c="dimmed">{flightDuration(item.departureTime, item.arrivalTime)}</Text>
                                    <Group className="booking-ticket-flight-line" gap={5} align="center" wrap="nowrap">
                                      <Box />
                                      <IconPlane size={18} />
                                      <Box />
                                    </Group>
                                    <Text size="xs" c="dimmed">Thời gian bay</Text>
                                  </Stack>
                                  <Stack className="booking-ticket-airport" gap={3} ta="right" style={{ flex: 1, minWidth: 0 }}>
                                    <Text className="booking-ticket-time">{dateFormater(item.arrivalTime, "HH:mm")}</Text>
                                    <Text className="booking-ticket-code">{item.destination}</Text>
                                    <Text size="sm" c="dimmed" lineClamp={2}>{item.destinationCity}</Text>
                                  </Stack>
                                </Group>

                                <Divider className="booking-ticket-divider" color={isSelected ? "blue.2" : "gray.2"} />
                                <Group className="booking-ticket-footer" justify="space-between" align="center" gap="xs" wrap="wrap">
                                  <Group gap={7}>
                                    <IconClock size={16} />
                                    <Text size="sm">{new Date(item.departureTime).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</Text>
                                    <Text size="sm" c="dimmed">· {item.flightNo}</Text>
                                  </Group>
                                  <Stack gap={0} align="flex-end">
                                    <Text className="booking-ticket-price">{money(item.price)}</Text>
                                    <Text size="xs" c="dimmed">/ hành khách</Text>
                                  </Stack>
                                </Group>
                                <Paper className="booking-fare-includes" radius="md" p="sm">
                                  <Text fw={750} size="sm" mb={4}>Bao gồm</Text>
                                  <Group gap={6} wrap="nowrap" align="center">
                                    <IconCheck size={16} color="var(--mantine-color-teal-7)" />
                                    <Text size="sm">Hành lý xách tay 07 kg</Text>
                                  </Group>
                                  <Group gap={6} wrap="nowrap" align="center">
                                    <IconCheck size={16} color="var(--mantine-color-teal-7)" />
                                    <Text size="sm">Ghế tiêu chuẩn</Text>
                                  </Group>
                                  <Text fw={750} size="sm" mt="sm" mb={4}>Chưa bao gồm · có thể mua thêm với phí</Text>
                                  <Stack gap={3}>
                                    {[
                                      "Hành lý ký gửi",
                                      "Suất ăn",
                                      "Bộ tiện ích 3 trong 1",
                                      "Chọn trước chỗ ngồi ưu tiên",
                                      "Thay đổi chuyến bay, ngày bay, hành trình",
                                      "Chênh lệch tiền vé khi thay đổi (nếu có)",
                                    ].map(item => (
                                      <Group key={item} gap={6} wrap="nowrap" align="center">
                                        <IconAlertCircle size={15} color="var(--mantine-color-red-6)" />
                                        <Text size="xs">{item}</Text>
                                      </Group>
                                    ))}
                                  </Stack>
                                  <Text size="xs" c="dimmed" mt={6}>
                                    Có thể chọn hành lý ký gửi, suất ăn và chỗ ngồi trong bước tiếp theo; các tiện ích khác chưa bán trong bản demo.
                                  </Text>
                                </Paper>
                                {isSelected && (
                                  <Group gap={5} c="blue.7">
                                    <IconCheck size={17} />
                                    <Text size="sm" fw={700}>Đang chọn</Text>
                                  </Group>
                                )}
                              </Stack>
                            </Paper>
                          );
                        })}
                      </Stack>
                    </Grid.Col>

                    <Grid.Col span={4}>
                      <Paper
                        className="booking-panel booking-seat-panel" component="section" withBorder radius="lg" p={{ base: "md", sm: "lg" }} shadow="xs" aria-labelledby="seat-passenger-title">
                        <Stack gap="md">
                          <Group justify="space-between" align="center" gap="sm" wrap="wrap">
                            <Box>

                              <Title order={2} size="xl" id="seat-passenger-title">Ghế & hành khách</Title>
                            </Box>
                            {flight && !booking && (
                              <Badge color={seat ? "teal" : "gray"} variant="light" size="lg">
                                {`${assignedSeatCount}/${requiredSeatCount} ghế đã chọn`}
                              </Badge>
                            )}
                          </Group>
                          <Divider />

                          {!flight && (
                            <Center mih={250}>
                              <Stack align="center" gap="sm" px="md">
                                <ThemeIcon radius="xl" size={64} variant="light" color="gray">
                                  <IconArmchair size={30} />
                                </ThemeIcon>
                                <Text size="lg" fw={750} ta="center">Chọn chuyến bay trước</Text>
                                <Text c="dimmed" size="sm" ta="center">
                                  Thông tin chuyến và sơ đồ ghế sẽ hiển thị tại đây.
                                </Text>
                              </Stack>
                            </Center>
                          )}

                          {flight && loadingSeats && !booking && (
                            <Center mih={240} role="status">
                              <Stack align="center" gap="sm">
                                <Loader size="md" />
                                <Text c="dimmed" size="sm">Đang tải sơ đồ ghế…</Text>
                              </Stack>
                            </Center>
                          )}

                          {flight && !loadingSeats && !booking && (
                            <Stack gap="lg">
                              <Paper className="booking-flight-summary" p="md" bg="gray.0" radius="md" withBorder>
                                <Group gap="md" align="center" wrap="nowrap">
                                  <ThemeIcon size={42} radius="md" color="blue" variant="light" style={{ flexShrink: 0 }}>
                                    <IconPlane size={23} />
                                  </ThemeIcon>
                                  <Stack gap={3} style={{ flex: 1, minWidth: 0 }}>
                                    <Text fw={750} size="md">
                                      {flight.flightNo} · {flight.origin} → {flight.destination}
                                    </Text>
                                    <Text c="dimmed" size="sm" lineClamp={2}>
                                      {flight.originCity} → {flight.destinationCity}
                                    </Text>
                                  </Stack>
                                  <Button
                                    variant="subtle"
                                    color="blue"
                                    size="sm"
                                    onClick={() => {
                                      setFlight(null);
                                      setSeats([]);
                                      setPassengers(current => current.map(passenger => ({ ...passenger, seatId: null })));
                                      setBooking(null);
                                    }}
                                    disabled={submitting}
                                  >
                                    Đổi chuyến
                                  </Button>
                                </Group>
                              </Paper>

                              <Paper withBorder radius="md" p="md">
                                <Text fw={750} mb="sm">Số lượng vé / hành khách</Text>
                                <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
                                  {(["ADULT", "CHILD", "INFANT"] as const).map(type => (
                                    <NumberInput
                                      key={type}
                                      label={passengerTypeLabels[type]}
                                      value={passengers.filter(item => item.type === type).length}
                                      min={type === "ADULT" ? 1 : 0}
                                      max={9 - passengers.filter(item => item.type !== type).length}
                                      allowDecimal={false}
                                      allowNegative={false}
                                      disabled={submitting}
                                      onChange={value => updatePassengerCount(type, value)}
                                    />
                                  ))}
                                </SimpleGrid>
                                <Text size="xs" c="dimmed" mt="xs">Tối đa 9 hành khách mỗi lần đặt · Người lớn 1.500.000đ · Trẻ 2–dưới 16 tuổi 75% · Trẻ dưới 2 tuổi miễn phí, không cần ghế riêng.</Text>
                              </Paper>

                              <Paper withBorder radius="md" p="md">
                                <Text fw={750} size="sm" mb="xs">Đang chọn ghế cho</Text>
                                <Group gap="xs" wrap="wrap">
                                  {passengers.map((passenger, index) => (
                                    <Button
                                      key={passenger.id}
                                      variant={activePassengerId === passenger.id ? "filled" : "light"}
                                      color={activePassengerId === passenger.id ? "blue" : "gray"}
                                      size="xs"
                                      disabled={submitting || passenger.type === "INFANT"}
                                      onClick={() => setActivePassengerId(passenger.id)}
                                    >
                                      {passengerTypeLabels[passenger.type]} {index + 1}
                                      {passenger.seatId ? ` · ${seats.find(item => item.seatId === passenger.seatId)?.seatNo ?? ""}` : ""}
                                    </Button>
                                  ))}
                                </Group>
                                {activePassenger?.type === "INFANT" ? (
                                  <Text size="sm" c="dimmed" mt="sm">Trẻ dưới 2 tuổi ngồi cùng người lớn và không cần ghế riêng.</Text>
                                ) : (
                                  <Text size="sm" c="dimmed" mt="sm">Mỗi người lớn và trẻ em cần một ghế riêng.</Text>
                                )}
                              </Paper>

                              <Stack gap="sm">
                                <Group justify="space-between" align="center" gap="xs" wrap="wrap">
                                  <Box>
                                    <Group justify="space-between">

                                      <Title order={3} size="lg">Sơ đồ chỗ ngồi</Title>
                                      <ActionIcon
                                        variant="transparent"
                                        onClick={() => {
                                          handlersSeats?.toggle()
                                        }}>
                                        {expandedSeats ? <IconChevronDown /> : <IconChevronUp />}
                                      </ActionIcon>
                                    </Group>
                                    <Text c="dimmed" size="sm">Ghế tiêu chuẩn đã gồm trong giá; một số vị trí có phụ thu.</Text>
                                  </Box>

                                  <Badge size="lg" variant="light" color="teal">{availableSeats} ghế trống</Badge>


                                </Group>
                                <Collapse expanded={!expandedSeats}>
                                  <Group gap="md" wrap="wrap" aria-label="Chú giải sơ đồ ghế">
                                    <Group gap={6}>
                                      <Box w={15} h={15} bg="teal.0" style={{ border: "1px solid var(--mantine-color-teal-4)", borderRadius: 4 }} />
                                      <Text size="sm" c="dimmed">Còn trống</Text>
                                    </Group>
                                    <Group gap={6}>
                                      <Box w={15} h={15} bg="gray.2" style={{ border: "1px solid var(--mantine-color-gray-4)", borderRadius: 4 }} />
                                      <Text size="sm" c="dimmed">Đã đặt</Text>
                                    </Group>
                                    <Group gap={6}>
                                      <Box w={15} h={15} bg="blue.6" style={{ borderRadius: 4 }} />
                                      <Text size="sm" c="dimmed">Đang chọn</Text>
                                    </Group>
                                    <Text size="sm" c="dimmed">Vị trí: Cửa sổ (A/F) · Lối đi (C/D) · Giữa (B/E)</Text>
                                  </Group>
                                  {/* 6 ghế/hàng, có lối đi ở giữa ghế thứ 3 và thứ 4 */}
                                  {seats.length > 0 ? (
                                    <Paper className="booking-seat-map" radius="lg" p="md" bg="gray.0" withBorder>
                                      <ScrollArea type="auto" offsetScrollbars>
                                        <Box
                                          role="group"
                                          aria-label="Sơ đồ chọn ghế"
                                          mx="auto"
                                          style={{
                                            display: "grid",
                                            gridTemplateColumns: "repeat(3, 52px) 28px repeat(3, 52px)",
                                            gridAutoRows: "48px",
                                            gap: 8,
                                            width: "max-content",
                                            padding: "12px 4px",
                                          }}
                                        >
                                          {seats.map((item, index) => {
                                            const isChosen = seat?.seatId === item.seatId;
                                            const isAssigned = passengers.some(passenger => passenger.seatId === item.seatId);
                                            const isAssignedToOther = isAssigned && !isChosen;
                                            const isAvailable = item.status === "AVAILABLE";
                                            const columnInRow = index % 6;
                                            const price = seatPrice(item.seatNo);
                                            const location = seatLocation(item.seatNo);

                                            return (
                                              <Button
                                                key={item.seatId}
                                                className={`booking-seat-button${isAssigned ? " booking-seat-button-selected" : isAvailable ? " booking-seat-button-available" : " booking-seat-button-unavailable"}`}
                                                type="button"
                                                size="sm"
                                                radius="md"
                                                p={0}
                                                fz="xs"
                                                fw={750}
                                                variant={isAssigned ? "filled" : isAvailable ? "light" : "default"}
                                                color={isAssigned ? "blue" : isAvailable ? "teal" : "gray"}
                                                disabled={!isAvailable || isAssignedToOther || submitting || activePassenger?.type === "INFANT"}
                                                aria-pressed={isChosen}
                                                aria-label={`Ghế ${item.seatNo}, vị trí ${location.label}, ${isAssignedToOther ? "đã gán cho hành khách khác" : isAvailable ? "còn trống" : "không còn trống"}${price ? `, phụ thu ${money(price)}` : ", đã gồm trong giá vé"}`}
                                                onClick={() => {
                                                  if (activePassenger) updatePassenger(activePassenger.id, { seatId: item.seatId });
                                                  setBooking(null);
                                                }}
                                                style={{
                                                  gridColumn: columnInRow < 3 ? columnInRow + 1 : columnInRow + 2,
                                                  gridRow: Math.floor(index / 6) + 1,
                                                  minWidth: 0,
                                                  width: "100%",
                                                  height: 48,
                                                }}
                                              >
                                                <span className="booking-seat-number">{item.seatNo}</span>
                                                {location.shortLabel && <span className="booking-seat-position">{location.shortLabel}</span>}
                                              </Button>
                                            );
                                          })}
                                        </Box>
                                      </ScrollArea>
                                    </Paper>
                                  ) : (
                                    <Text c="dimmed" size="sm" ta="center" py="lg">
                                      Chuyến bay này chưa có sơ đồ ghế.
                                    </Text>
                                  )}
                                  <Text className="booking-seat-pricing-note" size="xs" c="dimmed">
                                    Ghế thường đã gồm trong giá vé · Hàng 01: +100.000đ · Ghế cửa sổ A/F (trừ hàng 01): +50.000đ.
                                  </Text>
                                </Collapse>
                              </Stack>


                              <Paper className="booking-passenger-card" withBorder radius="lg" p={{ base: "md", sm: "lg" }}>
                                  <Box component="form" onSubmit={book}>
                                    <Stack gap="md">
                                      <Box>
                                        <Text c="blue.7" tt="uppercase" fw={800} size="sm" lts={0.5}>
                                          Hành khách & dịch vụ
                                        </Text>
                                        <Title order={3} size="lg">Thông tin từng hành khách</Title>
                                        <Text size="sm" c="dimmed">Người lớn và trẻ em cần ghế riêng; trẻ dưới 2 tuổi ngồi cùng người lớn.</Text>
                                      </Box>

                                      {passengers.map((passenger, index) => {
                                        const assignedSeat = seats.find(item => item.seatId === passenger.seatId);
                                        const assignedSeatFee = assignedSeat ? seatPrice(assignedSeat.seatNo) : 0;
                                        return (
                                          <Paper key={passenger.id} withBorder radius="md" p="sm">
                                            <Stack gap="sm">
                                              <Group justify="space-between" wrap="wrap">
                                                <Text fw={750}>{passengerTypeLabels[passenger.type]} {index + 1}</Text>
                                                <Badge color={passenger.type === "INFANT" ? "grape" : passenger.seatId ? "teal" : "orange"} variant="light">
                                                  {passenger.type === "INFANT"
                                                    ? "Không cần ghế · 0đ"
                                                    : assignedSeat
                                                      ? `Ghế ${assignedSeat.seatNo}${assignedSeatFee ? ` · +${money(assignedSeatFee)}` : " · đã gồm"}`
                                                      : "Chưa chọn ghế"}
                                                </Badge>
                                              </Group>
                                              <TextInput
                                                label="Họ và tên"
                                                placeholder="Nhập họ tên như trên giấy tờ"
                                                value={passenger.name}
                                                onChange={event => updatePassenger(passenger.id, { name: event.currentTarget.value })}
                                                maxLength={120}
                                                required
                                                disabled={submitting}
                                                autoComplete="name"
                                                size="sm"
                                              />
                                              <TextInput
                                                label="Email nhận xác nhận"
                                                type="email"
                                                placeholder="ban@example.com"
                                                value={passenger.email}
                                                onChange={event => updatePassenger(passenger.id, { email: event.currentTarget.value })}
                                                maxLength={254}
                                                required
                                                disabled={submitting}
                                                autoComplete="email"
                                                size="sm"
                                              />
                                              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                                                <Select
                                                  label="Hành lý ký gửi"
                                                  aria-label={`Hành lý ký gửi cho ${passengerTypeLabels[passenger.type]} ${index + 1}`}
                                                  placeholder="Không mua thêm"
                                                  data={baggageOptions}
                                                  value={passenger.baggageKg}
                                                  onChange={value => updatePassenger(passenger.id, { baggageKg: value })}
                                                  clearable
                                                  disabled={submitting}
                                                  size="sm"
                                                />
                                                <Select
                                                  label="Suất ăn"
                                                  aria-label={`Suất ăn cho ${passengerTypeLabels[passenger.type]} ${index + 1}`}
                                                  placeholder="Không chọn suất ăn"
                                                  data={mealOptions}
                                                  value={passenger.mealCode}
                                                  onChange={value => updatePassenger(passenger.id, { mealCode: value })}
                                                  clearable
                                                  disabled={submitting}
                                                  size="sm"
                                                />
                                              </SimpleGrid>
                                            </Stack>
                                          </Paper>
                                        );
                                      })}

                                      <Paper className="booking-total-card" bg="gray.0" radius="md" p="md" withBorder>
                                        <Stack gap="xs">
                                          <Group justify="space-between" align="center" wrap="wrap" gap="xs">
                                            <Box>
                                              <Text size="sm" fw={700}>Tổng thanh toán mô phỏng</Text>
                                              <Text size="xs" c="dimmed">Chưa thu tiền thật</Text>
                                            </Box>
                                            <Text size="xl" fw={850} c="blue.7">{money(bookingTotal)}</Text>
                                          </Group>
                                          <details className="booking-price-details">
                                            <summary>
                                              <span>Chi tiết giá vé</span>
                                              <span className="booking-price-details-icon" aria-hidden="true" />
                                            </summary>
                                            <Stack className="booking-price-breakdown" gap="xs">
                                              <Group justify="space-between" gap="sm" wrap="nowrap">
                                                <Text size="sm">Giá vé · {passengers.filter(item => item.type === "ADULT").length} người lớn, {passengers.filter(item => item.type === "CHILD").length} trẻ em, {passengers.filter(item => item.type === "INFANT").length} trẻ dưới 2 tuổi</Text>
                                                <Text size="sm" fw={600} ta="right">{money(fareTotal)}</Text>
                                              </Group>
                                              <Group justify="space-between" gap="sm" wrap="nowrap">
                                                <Text size="sm">Chọn trước chỗ ngồi / phụ thu ghế</Text>
                                                <Text size="sm" fw={600} ta="right">{money(selectedSeatFee)}</Text>
                                              </Group>
                                              <Group justify="space-between" gap="sm" wrap="nowrap">
                                                <Text size="sm">Hành lý ký gửi</Text>
                                                <Text size="sm" fw={600} ta="right">{money(selectedBaggageFee)}</Text>
                                              </Group>
                                              <Group justify="space-between" gap="sm" wrap="nowrap">
                                                <Text size="sm">Suất ăn</Text>
                                                <Text size="sm" fw={600} ta="right">{money(selectedMealFee)}</Text>
                                              </Group>
                                              <Group justify="space-between" gap="sm" wrap="nowrap">
                                                <Text size="sm">Thuế</Text>
                                                <Text size="sm" fw={600} ta="right">{money(taxFee)}</Text>
                                              </Group>
                                              <Group justify="space-between" gap="sm" wrap="nowrap">
                                                <Text size="sm">Phí dịch vụ</Text>
                                                <Text size="sm" fw={600} ta="right">{money(serviceFee)}</Text>
                                              </Group>
                                            </Stack>
                                          </details>
                                        </Stack>
                                      </Paper>
                                      <Button
                                        className="booking-confirm-button"
                                        type="submit"
                                        size="md"
                                        radius="md"
                                        fullWidth
                                        loading={submitting}
                                        disabled={passengers.some(item => !item.name.trim() || !item.email.trim() ||
                                          (item.type !== "INFANT" && !item.seatId))}
                                        rightSection={<IconArrowRight size={18} />}
                                      >
                                        Xác nhận đặt vé
                                      </Button>
                                      <Text size="sm" c="dimmed" ta="center">
                                        Mỗi hành khách có mã vé riêng; các ghế được giữ cùng một giao dịch.
                                      </Text>
                                    </Stack>
                                  </Box>
                              </Paper>
                            </Stack>
                          )}

                          {/* BƯỚC 3: XÁC NHẬN ĐẶT VÉ THÀNH CÔNG */}
                          {booking && (
                            <Stack align="center" gap="md" py={{ base: "md", sm: "xl" }} role="status">
                              <ThemeIcon color="teal" size={74} radius="xl" variant="light">
                                <IconCircleCheck size={44} />
                              </ThemeIcon>
                              <Stack align="center" gap={5}>
                                <Text tt="uppercase" fw={800} size="sm" c="teal.7" lts={1}>
                                  Đặt vé hoàn tất
                                </Text>
                                <Title order={3} size="xl" ta="center">{booking.length} vé đã được xác nhận</Title>
                                <Text size="md" c="dimmed">Tổng thanh toán: {money(booking.reduce((total, item) => total + item.amount, 0))}</Text>
                              </Stack>

                              <Stack w="100%">
                                {booking.map(item => (
                                  <Paper key={item.bookingId} className="booking-confirmed-ticket" withBorder radius="lg" p="md" bg="gray.0">
                                    <Group justify="space-between" align="center" wrap="wrap">
                                      <Box>
                                        <Text fw={750}>{item.passengerName} · {passengerTypeLabels[item.passengerType]}</Text>
                                        <Text size="sm" c="dimmed">{item.flightNo} · {item.seatNo ? `Ghế ${item.seatNo}` : "Trẻ ngồi cùng người lớn"}</Text>
                                        <Text size="sm" fw={700}>{item.bookingCode}</Text>
                                      </Box>
                                      <Stack gap={4} align="flex-end">
                                        <Text fw={700} c="blue.7">{money(item.amount)}</Text>
                                        <Button component={Link} href={`/bookings/${item.bookingId}`} size="xs" variant="light">
                                          Xem vé
                                        </Button>
                                      </Stack>
                                    </Group>
                                  </Paper>
                                ))}
                              </Stack>
                            </Stack>
                          )}
                        </Stack>
                      </Paper>
                    </Grid.Col>
                  </Grid>
                )}
              </Stack>
            </Paper>
          </Stack>

        </Stack>
      </Container>
    </Box>
  )
}
