"use client";

import
{
  Alert,
  Badge,
  Box,
  Button,
  Center,
  Container,
  Divider,
  Grid,
  Group,
  Loader,
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
import
{
  IconAlertCircle,
  IconArrowRight,
  IconArmchair,
  IconCalendar,
  IconCheck,
  IconCircleCheck,
  IconClock,
  IconInfoCircle,
  IconLuggage,
  IconPlane,
  IconPlaneDeparture,
  IconSearch,
  IconTicket,
  IconToolsKitchen2,
} from "@tabler/icons-react";

import { DateInput, MonthPickerInput } from '@mantine/dates';
import 'dayjs/locale/vi';

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ApiError, apiGet, apiPost } from "../../lib/api";
import type { Flight, Seat, Booking, CreateBooking } from "../../types/booking";
import Link from "next/link";

import { useForm } from "@mantine/form";
import { __getTimChuyenBay } from "@/components/api/booking";
import { dateFormater } from "@/components/utils/date-format";

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
const mealLabels: Record<string, string> = {
  CHICKEN: "Cơm gà",
  VEGETARIAN: "Suất chay",
  SANDWICH: "Sandwich",
};
const seatPrice = (seatNo: string) => {
  if (seatNo.startsWith("01")) return 100000;
  if (seatNo.endsWith("A") || seatNo.endsWith("F")) return 50000;
  return 0;
};
const errorText = (error: unknown) => error instanceof Error ? error.message : "Không thể kết nối backend.";

const airportOptions = [
  { value: "SGN", label: "TP. Hồ Chí Minh (SGN)" },
  { value: "HAN", label: "Hà Nội (HAN)" },
  { value: "DAD", label: "Đà Nẵng (DAD)" },
  { value: "VCA", label: "Cần Thơ (VCA)" },
];

export default function BookingPage()
{
  const [flights, setFlights] = useState<Flight[]>([]);
  const [flight, setFlight] = useState<Flight | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [seat, setSeat] = useState<Seat | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [baggageKg, setBaggageKg] = useState<string | null>(null);
  const [mealCode, setMealCode] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [searching, setSearching] = useState(false);
  const [loadingSeats, setLoadingSeats] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const seatRequest = useRef(0);
  const searchRequest = useRef(0);
  const submitLock = useRef(false);
  const pendingRequest = useRef<{ fingerprint: string; id: string } | null>(null);
  const selectedSeatFee = seat ? seatPrice(seat.seatNo) : 0;
  const selectedBaggageFee = baggageKg ? baggagePrices[baggageKg] : 0;
  const selectedMealFee = mealCode ? mealPrices[mealCode] : 0;
  const bookingTotal = flight
    ? flight.price + selectedSeatFee + selectedBaggageFee + selectedMealFee
    : 0;

  const [searchPeriod, setSearchPeriod] = useState<"day" | "month">("day");

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


  async function handleSearchFlights(event: FormEvent<HTMLFormElement>)
  {
    event.preventDefault();
    const currentRequest = ++searchRequest.current;
    const values = form.values;
    setSearching(true);
    setLoadingSeats(false);
    setError("");
    setFlight(null);
    setSeats([]);
    setSeat(null);
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

  async function chooseFlight(item: Flight)
  {
    const request = ++seatRequest.current;
    setFlight(item); setSeat(null); setSeats([]); setBooking(null); setBaggageKg(null); setMealCode(null); setError(""); setLoadingSeats(true);
    try {
      const data = await apiGet<Seat[]>(`/api/flights/${item.flightId}/seats`);
      if (request === seatRequest.current) setSeats(data);
    } catch (err) { if (request === seatRequest.current) setError(errorText(err)); }
    finally { if (request === seatRequest.current) setLoadingSeats(false); }
  }

  async function book(event: FormEvent<HTMLFormElement>)
  {
    event.preventDefault();
    if (!flight || !seat || submitLock.current) return;
    submitLock.current = true; setSubmitting(true); setError(""); setBooking(null);
    const fingerprint = JSON.stringify([flight.flightId, seat.seatId, name.trim(), email.trim(), baggageKg, mealCode, bookingTotal]);
    if (pendingRequest.current?.fingerprint !== fingerprint) {
      let stored: { fingerprint: string; id: string } | null = null;
      try {
        const candidate: unknown = JSON.parse(sessionStorage.getItem("pending-booking") ?? "null");
        if (candidate && typeof candidate === "object" && "fingerprint" in candidate && "id" in candidate && typeof candidate.fingerprint === "string" && typeof candidate.id === "string") stored = { fingerprint: candidate.fingerprint, id: candidate.id };
      } catch { /* Optional browser storage; the in-memory request key remains authoritative. */ }
      pendingRequest.current = stored?.fingerprint === fingerprint ? stored : { fingerprint, id: crypto.randomUUID() };
      try { sessionStorage.setItem("pending-booking", JSON.stringify(pendingRequest.current)); } catch { /* Private browsing can disable storage. */ }
    }
    const body: CreateBooking = {
      requestId: pendingRequest.current!.id, flightId: flight.flightId, seatId: seat.seatId,
      passengerName: name.trim(), passengerEmail: email.trim(),
      baggageKg: baggageKg ? Number(baggageKg) : null,
      mealCode,
      payment: { amount: bookingTotal, currency: flight.currency }
    };
    try {
      const result = await apiPost<Booking>("/api/bookings", body);
      setBooking(result); setSeat(null);
      pendingRequest.current = null;
      try { sessionStorage.removeItem("pending-booking"); } catch { /* Storage is optional. */ }
      setSeats(current => current.map(s => s.seatId === result.seatId ? { ...s, status: "BOOKED" } : s));
      setFlights(current => current.map(f => f.flightId === result.flightId ? { ...f, availableSeats: Math.max(0, f.availableSeats - 1) } : f));
    } catch (err) {
      setError(errorText(err) + (err instanceof ApiError && err.status < 500 ? "" : ". Chưa xác định yêu cầu đã lưu hay chưa; bấm gửi lại với cùng thông tin để kiểm tra an toàn."));
      if (err instanceof ApiError && err.code === "SEAT_ALREADY_BOOKED") {
        setSeat(null);
        try { setSeats(await apiGet<Seat[]>(`/api/flights/${flight.flightId}/seats`)); }
        catch { setError("Ghế đã được đặt. Không thể tải lại sơ đồ; hãy chọn lại chuyến bay."); }
      }
    } finally { submitLock.current = false; setSubmitting(false); }
  }

  const availableSeats = seats.filter(item => item.status === "AVAILABLE").length;

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
            Giá cơ bản 1.500.000 VND gồm ghế tiêu chuẩn; chưa gồm hành lý ký gửi và suất ăn. Tổng tiền dịch vụ được tính minh bạch trước khi xác nhận · Thanh toán mô phỏng, chưa thu tiền thật.
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
                  <Stack gap="sm">
                    {flights.map((item) =>
                    {
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
                              <Group gap="xs" wrap="wrap">
                                <Badge color="teal" variant="light">Đã gồm ghế tiêu chuẩn</Badge>
                                <Badge color="orange" variant="light">Chưa gồm hành lý ký gửi</Badge>
                                <Badge color="orange" variant="light">Chưa gồm suất ăn</Badge>
                              </Group>
                              <Text size="xs" c="dimmed" mt={6}>
                                Có thể mua thêm hành lý, suất ăn và nâng cấp vị trí ghế ở bước tiếp theo.
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
                )}
              </Stack>
            </Paper>


            <Paper
              className="booking-panel booking-seat-panel" component="section" withBorder radius="lg" p={{ base: "md", sm: "lg" }} shadow="xs" aria-labelledby="seat-passenger-title">
              <Stack gap="md">
                <Group justify="space-between" align="center" gap="sm" wrap="wrap">
                  <Box>

                    <Title order={2} size="xl" id="seat-passenger-title">Ghế & hành khách</Title>
                  </Box>
                  {flight && !booking && (
                    <Badge color={seat ? "teal" : "gray"} variant="light" size="lg">
                      {seat ? "Đã chọn ghế" : "Chưa chọn ghế"}
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
                        <Button variant="subtle" color="gray" size="sm" onClick={() =>
                        {
                          setFlight(null);
                          setSeat(null);
                          setSeats([]);
                          setBooking(null);
                        }} disabled={submitting}>
                          Đổi chuyến
                        </Button>
                      </Group>
                    </Paper>

                    <Stack gap="sm">
                      <Group justify="space-between" align="center" gap="xs" wrap="wrap">
                        <Box>
                          <Title order={3} size="lg">Chọn chỗ ngồi</Title>
                          <Text c="dimmed" size="sm">Ghế tiêu chuẩn đã gồm trong giá; một số vị trí có phụ thu.</Text>
                        </Box>
                        <Badge size="lg" variant="light" color="teal">{availableSeats} ghế trống</Badge>
                      </Group>

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
                      </Group>
                    </Stack>

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
                              gridTemplateColumns: "repeat(3, 48px) 28px repeat(3, 48px)",
                              gridAutoRows: "42px",
                              gap: 8,
                              width: "max-content",
                              padding: "12px 4px",
                            }}
                          >
                            {seats.map((item, index) =>
                            {
                              const isChosen = seat?.seatId === item.seatId;
                              const isAvailable = item.status === "AVAILABLE";
                              const columnInRow = index % 6;
                              const price = seatPrice(item.seatNo);

                              return (
                                <Button
                                  key={item.seatId}
                                  className={`booking-seat-button${isChosen ? " booking-seat-button-selected" : isAvailable ? " booking-seat-button-available" : " booking-seat-button-unavailable"}`}
                                  type="button"
                                  size="sm"
                                  radius="md"
                                  p={0}
                                  fz="sm"
                                  fw={750}
                                  variant={isChosen ? "filled" : isAvailable ? "light" : "default"}
                                  color={isChosen ? "blue" : isAvailable ? "teal" : "gray"}
                                  disabled={!isAvailable || submitting}
                                  aria-pressed={isChosen}
                                  aria-label={`Ghế ${item.seatNo}, ${isAvailable ? "còn trống" : "không còn trống"}${price ? `, phụ thu ${money(price)}` : ", đã gồm trong giá vé"}`}
                                  onClick={() =>
                                  {
                                    setSeat(item);
                                    setBooking(null);
                                  }}
                                  style={{
                                    gridColumn: columnInRow < 3 ? columnInRow + 1 : columnInRow + 2,
                                    gridRow: Math.floor(index / 6) + 1,
                                    minWidth: 0,
                                    width: "100%",
                                    height: 42,
                                  }}
                                >
                                  {item.seatNo}
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

                    {seat && (
                      <Paper className="booking-passenger-card" withBorder radius="lg" p={{ base: "md", sm: "lg" }}>
                        <Box component="form" onSubmit={book}>
                          <Stack gap="md">
                            <Group justify="space-between" align="center" gap="sm" wrap="wrap">
                              <Box>
                                <Text c="blue.7" tt="uppercase" fw={800} size="sm" lts={0.5}>
                                  Tiện ích cho chuyến đi
                                </Text>
                                <Title order={3} size="lg">Tùy chỉnh dịch vụ</Title>
                              </Box>
                              <Badge color={selectedSeatFee ? "orange" : "teal"} variant="light" size="lg">
                                Ghế {seat.seatNo} · {selectedSeatFee ? `+${money(selectedSeatFee)}` : "Đã gồm"}
                              </Badge>
                            </Group>

                            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                              <Box className="booking-addon-option">
                                <Group gap="xs" mb={6}>
                                  <IconLuggage size={19} />
                                  <Text fw={700}>Hành lý ký gửi</Text>
                                </Group>
                                <Text size="sm" c="dimmed" mb="sm">Chọn gói hành lý cho chuyến bay này.</Text>
                                <Select
                                  aria-label="Gói hành lý ký gửi"
                                  placeholder="Không mua thêm"
                                  data={baggageOptions}
                                  value={baggageKg}
                                  onChange={setBaggageKg}
                                  clearable
                                  disabled={submitting}
                                  size="sm"
                                />
                              </Box>
                              <Box className="booking-addon-option">
                                <Group gap="xs" mb={6}>
                                  <IconToolsKitchen2 size={19} />
                                  <Text fw={700}>Suất ăn</Text>
                                </Group>
                                <Text size="sm" c="dimmed" mb="sm">Chọn món ăn phục vụ trên chuyến bay.</Text>
                                <Select
                                  aria-label="Suất ăn"
                                  placeholder="Không chọn suất ăn"
                                  data={mealOptions}
                                  value={mealCode}
                                  onChange={setMealCode}
                                  clearable
                                  disabled={submitting}
                                  size="sm"
                                />
                              </Box>
                            </SimpleGrid>

                            <Divider />
                            <Text c="blue.7" tt="uppercase" fw={800} size="sm" lts={0.5}>
                              Thông tin hành khách
                            </Text>
                            <TextInput
                              label="Họ và tên"
                              placeholder="Nhập họ tên như trên giấy tờ"
                              value={name}
                              onChange={(event) => setName(event.currentTarget.value)}
                              maxLength={120}
                              required
                              disabled={submitting}
                              autoComplete="name"
                              size="md"
                              radius="md"
                            />
                            <TextInput
                              label="Email nhận xác nhận"
                              type="email"
                              placeholder="ban@example.com"
                              value={email}
                              onChange={(event) => setEmail(event.currentTarget.value)}
                              maxLength={254}
                              required
                              disabled={submitting}
                              autoComplete="email"
                              size="md"
                              radius="md"
                            />

                            <Paper className="booking-total-card" bg="gray.0" radius="md" p="md" withBorder>
                              <Stack gap="xs">
                                <Group justify="space-between"><Text size="sm">Giá vé cơ bản · gồm ghế tiêu chuẩn</Text><Text size="sm" fw={600}>{money(flight.price)}</Text></Group>
                                {selectedSeatFee > 0 && <Group justify="space-between"><Text size="sm">Phụ thu vị trí ghế {seat.seatNo}</Text><Text size="sm" fw={600}>{money(selectedSeatFee)}</Text></Group>}
                                {selectedBaggageFee > 0 && <Group justify="space-between"><Text size="sm">Hành lý ký gửi · {baggageKg} kg</Text><Text size="sm" fw={600}>{money(selectedBaggageFee)}</Text></Group>}
                                {selectedMealFee > 0 && <Group justify="space-between"><Text size="sm">Suất ăn · {mealCode ? mealLabels[mealCode] : ""}</Text><Text size="sm" fw={600}>{money(selectedMealFee)}</Text></Group>}
                                <Divider />
                                <Group justify="space-between" align="center" wrap="wrap" gap="xs">
                                  <Box>
                                    <Text size="sm" fw={700}>Tổng thanh toán mô phỏng</Text>
                                    <Text size="xs" c="dimmed">Chưa thu tiền thật</Text>
                                  </Box>
                                  <Text size="xl" fw={850} c="blue.7">{money(bookingTotal)}</Text>
                                </Group>
                              </Stack>
                            </Paper>
                            <Button
                              className="booking-confirm-button"
                              type="submit"
                              size="md"
                              radius="md"
                              fullWidth
                              loading={submitting}
                              disabled={!name.trim() || !email.trim()}
                              rightSection={<IconArrowRight size={18} />}
                            >
                              Xác nhận đặt vé
                            </Button>
                            <Text size="sm" c="dimmed" ta="center">
                              Chỉ xác nhận sau khi giao dịch database hoàn tất.
                            </Text>
                          </Stack>
                        </Box>
                      </Paper>
                    )}
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
                      <Title order={3} size="xl" ta="center">Chuyến đi đã được xác nhận</Title>
                      <Group gap="xs" justify="center">
                        <Text fw={700}>{booking.flightNo}</Text>
                        <Text c="dimmed">·</Text>
                        <Text>Ghế {booking.seatNo}</Text>
                      </Group>
                      <Text size="md" c="dimmed">{booking.passengerName}</Text>
                      <Group justify="center" gap="xs" wrap="wrap">
                        <Badge color={booking.seatFee > 0 ? "orange" : "teal"} variant="light">
                          {booking.seatFee > 0 ? `Phụ thu ghế ${money(booking.seatFee)}` : "Ghế tiêu chuẩn"}
                        </Badge>
                        {booking.baggageKg && <Badge color="blue" variant="light">Hành lý {booking.baggageKg} kg</Badge>}
                        {booking.mealCode && <Badge color="grape" variant="light">{mealLabels[booking.mealCode] ?? "Suất ăn"}</Badge>}
                      </Group>
                    </Stack>

                    <Paper className="booking-confirmed-ticket" withBorder radius="lg" p="lg" bg="gray.0" w="100%" maw={400}>
                      <Stack align="center" gap={6}>
                        <Text tt="uppercase" fw={700} c="dimmed" size="sm" lts={1}>
                          Mã đặt vé
                        </Text>
                        <Text fw={850} size="clamp(22px, 4vw, 30px)" style={{ letterSpacing: "0.08em", overflowWrap: "anywhere" }} ta="center">
                          {booking.bookingCode}
                        </Text>
                        <Divider w="100%" my="xs" />
                        <Text fw={700} c="blue.7" size="lg">{money(booking.amount)}</Text>
                        <Badge color="teal" variant="light" size="lg">{booking.status}</Badge>
                      </Stack>
                    </Paper>

                    <Button component={Link} href={`/bookings/${booking.bookingId}`} size="md" radius="md" rightSection={<IconArrowRight size={18} />}>
                      Xem vé & lịch sử sự kiện
                    </Button>
                  </Stack>
                )}
              </Stack>
            </Paper>

          </Stack>



        </Stack>
      </Container>
    </Box>
  )
}
