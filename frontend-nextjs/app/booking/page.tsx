"use client";

import
{
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Center,
  Container,
  Divider,
  Flex,
  Grid,
  Group,
  List,
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
  IconAlertCircleFilled,
  IconPlus,
  IconMinus,
  IconCheckFilled,
  IconX,
  IconPlaneArrival,
} from "@tabler/icons-react";

import { DateInput, MonthPickerInput } from '@mantine/dates';
import 'dayjs/locale/vi';

import React, { useEffect, useRef, useState, type FormEvent } from "react";
import { ApiError, apiGet, apiPost } from "../../lib/api";
import type { Flight, Seat, Booking, CreateBooking } from "../../types/booking";
import Link from "next/link";

import { useForm } from "@mantine/form";
import { __getTimChuyenBay } from "@/components/api/booking";
import { dateFormater } from "@/components/utils/date-format";
import { useParams, usePathname, useSearchParams } from "next/navigation";
import { useQueryFilters } from "@/components/utils/setURLParams";
import "./styles.css";

const money = (value: number) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(value);
const time = (value: string) => new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour12: false });

const flightDuration = (departure: string, arrival: string) =>
{
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
const seatPrice = (seatNo: string) =>
{
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

type PassengerDraft = {
  passengerType: "ADULT" | "CHILD";
  name: string;
  email: string;
  seatId: string | null;
  booking: Booking | null;
};

const createPassenger = (passengerType: PassengerDraft["passengerType"] = "ADULT"): PassengerDraft => ({
  passengerType,
  name: "",
  email: "",
  seatId: null,
  booking: null,
});

const cabinLabels: Record<string, string> = {
  ECONOMY: "Phổ thông",
  PREMIUM_ECONOMY: "Phổ thông đặc biệt",
  BUSINESS: "Thương gia",
};

const cabinPrices: Record<string, number> = {
  ECONOMY: 0,
  PREMIUM_ECONOMY: 500000,
  BUSINESS: 1000000,
};

const dateWithOffset = (date: string, offset: number) =>
{
  const [year, month, day] = date.split("-").map(Number);
  const adjusted = new Date(Date.UTC(year, month - 1, day + offset));
  return `${adjusted.getUTCFullYear()}-${String(adjusted.getUTCMonth() + 1).padStart(2, "0")}-${String(adjusted.getUTCDate()).padStart(2, "0")}`;
};

const flightDate = (value: string) =>
{
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
};

function BookingPageContent()
{
  const { get, set } = useQueryFilters();

  const origin = get("origin");
  const destination = get("destination");
  const date = get("date");
  const month = get("month");

  const [flights, setFlights] = useState<Flight[]>([]);
  const [flight, setFlight] = useState<Flight | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [adultCount, setAdultCount] = useState<number>(1);
  const [childCount, setChildCount] = useState<number>(0);
  const [infantCount, setInfantCount] = useState<number>(0);
  const [passengers, setPassengers] = useState<PassengerDraft[]>([createPassenger()]);
  const [activePassengerIndex, setActivePassengerIndex] = useState(0);
  const [suggestedFlights, setSuggestedFlights] = useState<Flight[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestionError, setSuggestionError] = useState("");
  const [baggageKg, setBaggageKg] = useState<string | null>(null);
  const [mealCode, setMealCode] = useState<string | null>(null);

  const [searching, setSearching] = useState(false);
  const [loadingSeats, setLoadingSeats] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const seatRequest = useRef(0);
  const searchRequest = useRef(0);
  const submitLock = useRef(false);
  const selectedSeats = passengers.map(passenger => seats.find(item => item.seatId === passenger.seatId) ?? null);
  const allPassengersBooked = passengers.every(passenger => passenger.booking !== null);
  const selectedSeatFee = selectedSeats.reduce((total, item) => total + (item ? seatPrice(item.seatNo) : 0), 0);
  const selectedCabinFee = selectedSeats.reduce((total, item) => total + (item ? cabinPrices[item.cabinClass] ?? 0 : 0), 0);
  const selectedBaseFare = flight ? selectedSeats.reduce((total, item, index) =>
    total + (item ? passengers[index].passengerType === "CHILD" ? flight.price * 0.75 : flight.price : 0), 0) : 0;
  const selectedBaggageFee = baggageKg ? baggagePrices[baggageKg] : 0;
  const selectedMealFee = mealCode ? mealPrices[mealCode] : 0;
  const bookingTotal = flight && selectedSeats.some(Boolean)
    ? selectedSeats.reduce((total, item, index) => total + (item
      ? (passengers[index].passengerType === "CHILD" ? flight.price * 0.75 : flight.price) +
      (cabinPrices[item.cabinClass] ?? 0) + seatPrice(item.seatNo) + selectedBaggageFee + selectedMealFee
      : 0), 0)
    : 0;
  const requiredSeatCount = adultCount + childCount;

  const [searchPeriod, setSearchPeriod] = useState<"day" | "month">(date ? "day" : "month");

  const form = useForm<{
    origin: string | null;
    destination: string | null;
    date: string | null;
    month: string | null;
  }>({
    initialValues: {
      origin: origin ?? "",
      destination: destination ?? "",
      date: date ?? null,
      month: month ?? null,
    },
  })

  function updatePartySize(adults: number, children: number, infants = Math.min(infantCount, adults))
  {
    setAdultCount(adults);
    setChildCount(children);
    setInfantCount(infants);
    setPassengers(current => Array.from({ length: adults + children }, (_, index) => ({
      ...(current[index] ?? createPassenger(index < adults ? "ADULT" : "CHILD")),
      passengerType: index < adults ? "ADULT" : "CHILD",
      seatId: null,
      booking: null,
    })));
    setActivePassengerIndex(0);
    setFlight(null);
    setSeats([]);
    setLoadingSeats(false);
    setSuggestedFlights([]);
    setSuggestionError("");
    setLoadingSuggestions(false);
    setError("");
    ++seatRequest.current;
  }


  const handleSearchFlights = React.useCallback(async (values: typeof form.values) =>
  {
    set({
      origin: values.origin,
      destination: values.destination,
      date: values.date || null,
      month: values.month || null
    });

    setSearching(true);
    setLoadingSeats(false);
    setError("");
    setFlight(null);
    setSeats([]);

    setPassengers(Array.from({ length: requiredSeatCount }, (_, index) => createPassenger(index < adultCount ? "ADULT" : "CHILD")));
    setActivePassengerIndex(0);
    setSuggestedFlights([]);
    setSuggestionError("");
    setLoadingSuggestions(false);

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
        requiredSeats: requiredSeatCount,
      }
      const data = await __getTimChuyenBay(request);

      setFlights(data);

    } catch (err) {

      setFlights([]);
      setError(errorText(err));

    } finally {
      setSearching(false);
    }
  }, [origin, destination, date, month]);

  useEffect(() =>
  {
    handleSearchFlights(form.values);
  }, [handleSearchFlights])

  async function chooseFlight(item: Flight)
  {
    const request = ++seatRequest.current;
    setFlight(item);
    setSeats([]);
    setPassengers(current => Array.from({ length: requiredSeatCount }, (_, index) => current[index] ?? createPassenger(index < adultCount ? "ADULT" : "CHILD")));
    setActivePassengerIndex(0);
    setBaggageKg(null);
    setMealCode(null);
    setError("");
    setSuggestedFlights([]);
    setSuggestionError("");
    setLoadingSeats(true);
    let currentAvailability = item.availableSeats;
    try {
      const data = await apiGet<Seat[]>(`/api/flights/${item.flightId}/seats`);
      currentAvailability = data.filter(seat => seat.status === "AVAILABLE").length;
      if (request === seatRequest.current) {
        setSeats(data);
        setFlight(current => current?.flightId === item.flightId
          ? { ...current, availableSeats: currentAvailability, sufficientSeats: currentAvailability >= requiredSeatCount }
          : current);
      }
    } catch (err) {
      if (request === seatRequest.current)
        setError(errorText(err));
    }
    finally {
      if (request === seatRequest.current)
        setLoadingSeats(false);
    }

    if (request !== seatRequest.current || currentAvailability >= requiredSeatCount) return;
    const departureTime = new Date(item.departureTime).getTime();
    const sameDayOptions = flights
      .filter(candidate => candidate.flightId !== item.flightId &&
        candidate.origin === item.origin && candidate.destination === item.destination &&
        candidate.availableSeats >= requiredSeatCount &&
        flightDate(candidate.departureTime) === flightDate(item.departureTime) &&
        Math.abs(new Date(candidate.departureTime).getTime() - departureTime) <= 60 * 60 * 1000)
      .sort((left, right) =>
        Math.abs(new Date(left.departureTime).getTime() - departureTime) -
        Math.abs(new Date(right.departureTime).getTime() - departureTime));
    if (sameDayOptions.length > 0) {
      setSuggestedFlights(sameDayOptions.slice(0, 3));
      return;
    }

    setLoadingSuggestions(true);
    try {
      const date = flightDate(item.departureTime);
      const adjacentResults = await Promise.allSettled([-1, 1].map(offset =>
        __getTimChuyenBay({
          origin: item.origin,
          destination: item.destination,
          date: dateWithOffset(date, offset),
          requiredSeats: requiredSeatCount,
        })));
      if (request === seatRequest.current) {
        const availableResults = adjacentResults
          .filter((result): result is PromiseFulfilledResult<Flight[]> => result.status === "fulfilled")
          .flatMap(result => result.value);
        const failedSearches = adjacentResults.filter(result => result.status === "rejected").length;
        setSuggestedFlights(availableResults
          .filter(candidate => candidate.availableSeats >= requiredSeatCount)
          .sort((left, right) =>
            Math.abs(new Date(left.departureTime).getTime() - departureTime) -
            Math.abs(new Date(right.departureTime).getTime() - departureTime))
          .slice(0, 3));
        if (failedSearches > 0) {
          setSuggestionError(`Không thể tra cứu ${failedSearches} ngày liền kề; các chuyến tìm được vẫn được hiển thị.`);
        }
      }
    } catch (err) {
      if (request === seatRequest.current)
        setSuggestionError(`Không tải được chuyến ngày liền kề: ${errorText(err)}`);
    } finally {
      if (request === seatRequest.current) setLoadingSuggestions(false);
    }
  }

  async function book(event: FormEvent<HTMLFormElement>)
  {
    event.preventDefault();
    if (!flight || submitLock.current) return;
    const pendingPassengers = passengers
      .map((passenger, index) => ({ passenger, index, seat: selectedSeats[index] }))
      .filter((item): item is { passenger: PassengerDraft; index: number; seat: Seat } =>
        item.seat !== null && item.passenger.booking === null);
    if (pendingPassengers.length === 0) return;

    submitLock.current = true;
    setSubmitting(true);
    setError("");
    const failures: string[] = [];
    try {
      for (const { passenger, index, seat: selectedSeat } of pendingPassengers) {
        const passengerBaseFare = passenger.passengerType === "CHILD"
          ? Math.round(flight.price * 0.75)
          : flight.price;
        const totalAmount = passengerBaseFare + (cabinPrices[selectedSeat.cabinClass] ?? 0) +
          seatPrice(selectedSeat.seatNo) + selectedBaggageFee + selectedMealFee;
        const fingerprint = JSON.stringify([
          flight.flightId, selectedSeat.seatId, passenger.name.trim(), passenger.email.trim(),
          passenger.passengerType, baggageKg, mealCode, totalAmount,
        ]);
        const storageKey = `pending-booking-${index}`;
        let requestId = crypto.randomUUID();
        try {
          const candidate: unknown = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
          if (candidate && typeof candidate === "object" &&
            "fingerprint" in candidate && candidate.fingerprint === fingerprint &&
            "id" in candidate && typeof candidate.id === "string") requestId = candidate.id;
          sessionStorage.setItem(storageKey, JSON.stringify({ fingerprint, id: requestId }));
        } catch {
          // Keep this attempt's request ID when browser storage is unavailable.
        }

        const body: CreateBooking = {
          requestId,
          flightId: flight.flightId,
          seatId: selectedSeat.seatId,
          passengerName: passenger.name.trim(),
          passengerEmail: passenger.email.trim(),
          passengerType: passenger.passengerType,
          baggageKg: baggageKg ? Number(baggageKg) : null,
          mealCode,
          payment: { amount: totalAmount, currency: flight.currency },
        };
        try {
          const result = await apiPost<Booking>("/api/bookings", body);
          setPassengers(current => current.map((item, passengerIndex) =>
            passengerIndex === index ? { ...item, booking: result } : item));
          setSeats(current => current.map(item =>
            item.seatId === result.seatId ? { ...item, status: "BOOKED" } : item));
          setFlights(current => current.map(item =>
            item.flightId === result.flightId
              ? { ...item, availableSeats: Math.max(0, item.availableSeats - 1) }
              : item));
          const nextPassenger = pendingPassengers.find(candidate => candidate.index > index) ??
            pendingPassengers.find(candidate => candidate.index < index);
          if (nextPassenger) setActivePassengerIndex(nextPassenger.index);
          try { sessionStorage.removeItem(storageKey); } catch { /* Storage is optional. */ }
        } catch (err) {
          failures.push(`${passenger.name.trim() || `Hành khách ${index + 1}`} · ghế ${selectedSeat.seatNo}: ${errorText(err)}${err instanceof ApiError && err.status < 500
            ? ""
            : " (chưa xác định đã lưu hay chưa; có thể gửi lại an toàn với cùng thông tin)"
            }`);
          if (err instanceof ApiError && err.code === "SEAT_ALREADY_BOOKED") {
            try {
              const latestSeats = await apiGet<Seat[]>(`/api/flights/${flight.flightId}/seats`);
              setSeats(latestSeats);
              setPassengers(current => current.map((item, passengerIndex) =>
                passengerIndex === index ? { ...item, seatId: null } : item));
              setActivePassengerIndex(index);
            } catch {
              failures.push("Không thể tải lại sơ đồ ghế sau khi ghế vừa được người khác đặt.");
            }
          }
        }
      }
      if (failures.length > 0) setError(`Một số vé chưa đặt được:\n${failures.join("\n")}`);
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  }

  const availableSeats = seats.filter(item => item.status === "AVAILABLE").length;

  return (
    // THAY phần JSX hiện tại trong `return (...)` bằng nội dung bên dưới.
    // Giữ nguyên toàn bộ state, hooks, các hàm xử lý và import của trang đang có.
    // Import file booking-reference.css SAU stylesheet hiện tại. Ảnh: public/booking-hero-art.webp.

    <Box className="booking-page-shell booking-reference" mih="100vh" py={{ base: "md", md: "xl" }}>
      <Container size={1440}>
        <Stack gap="lg">
          <Box className="booking-hero">
            <Group className="booking-hero-layout" justify="space-between" align="center" gap="xl" wrap="wrap">
              <Stack className="booking-hero-copy" gap="md">
                <Badge className="booking-hero-kicker" leftSection={<IconPlaneDeparture size={14} />} variant="light" color="blue" radius="xl">
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
                  <Group className="booking-hero-pill" gap={7} wrap="nowrap"><ThemeIcon color="teal" size={29} radius="md" variant="filled"><IconCheck size={17} /></ThemeIcon><Text size="sm">Lịch bay linh hoạt</Text></Group>
                  <Group className="booking-hero-pill" gap={7} wrap="nowrap"><ThemeIcon color="blue" size={29} radius="md" variant="filled"><IconCheck size={17} /></ThemeIcon><Text size="sm">Giá vé minh bạch</Text></Group>
                  <Group className="booking-hero-pill" gap={7} wrap="nowrap"><ThemeIcon color="orange" size={29} radius="md" variant="filled"><IconArmchair size={17} /></ThemeIcon><Text size="sm">Tự chọn chỗ ngồi</Text></Group>
                </Group>
              </Stack>
              <Paper className="booking-hero-route" radius="xl" p="lg" aria-label="Minh họa hành trình bay">
                <Text className="booking-hero-route-label" size="xs" fw={800} tt="uppercase" lts={1.4}>
                  HÀNH TRÌNH TIẾP THEO
                </Text>
                <Group className="booking-hero-route-points" justify="space-between" align="center" wrap="nowrap" mt="lg">
                  <Stack gap={3}>
                    <Text className="booking-hero-route-code">{form.values.origin || "ĐI"}</Text>
                    <Text size="xs">Nơi khởi hành</Text>
                  </Stack>
                  <Box className="booking-hero-route-line"><IconPlane size={21} /></Box>
                  <Stack gap={3} ta="right">
                    <Text className="booking-hero-route-code">{form.values.destination || "ĐẾN"}</Text>
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
            color="orange"
            variant="light"
            radius="md"
            title="Đây là hệ thống đặt vé mô phỏng"
            className="booking-demo-alert"
          >
            Người lớn tính 100% giá cơ bản; trẻ 2–12 tuổi có ghế tính 75%; trẻ dưới 2 tuổi ngồi cùng người lớn và miễn phí. Mỗi trẻ dưới 2 tuổi phải đi cùng một người lớn; bản mô phỏng chưa phát hành vé riêng cho nhóm này. Thanh toán mô phỏng, chưa thu tiền thật.
          </Alert>
          {/* TIẾN TRÌNH */}
          <Paper className="booking-stepper-card" withBorder radius="xl" p={{ base: "md", sm: "lg" }} shadow="xs">
            <Stepper
              className="booking-progress"
              active={allPassengersBooked ? 2 : flight ? 1 : 0}
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
          <Paper className="booking-search-card" withBorder radius="xl" p={{ base: "md", sm: "lg" }} shadow="xs">
            <Stack gap="md">
              <Group gap="sm" wrap="nowrap">
                <ThemeIcon variant="filled" size={46} radius="lg" color="blue">
                  <IconSearch size={22} />
                </ThemeIcon>
                <Box>
                  <Text className="booking-section-kicker" size="xs" fw={800} tt="uppercase" lts={1}>01 · HÀNH TRÌNH</Text>
                  <Title order={2} size="lg">Tìm chuyến bay</Title>
                  <Text c="dimmed" size="sm">Lọc theo điểm đi, điểm đến và ngày hoặc tháng khởi hành.</Text>
                </Box>
              </Group>
              <Stack gap="md">
                <SegmentedControl
                  aria-label="Tìm chuyến theo ngày hoặc tháng"
                  data={[
                    { label: "Theo ngày", value: "day" },
                    { label: "Theo tháng", value: "month" },
                  ]}
                  value={searchPeriod}
                  onChange={(value) =>
                  {
                    if (value !== "day" && value !== "month") return;
                    setSearchPeriod(value);
                    form.setFieldValue(value === "day" ? "month" : "date", null);
                  }}
                  disabled={submitting || searching}
                />
                <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md" verticalSpacing="sm">
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
                    leftSection={<IconPlaneDeparture color="blue" />}
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
                    leftSection={<IconPlaneArrival color="blue" />}
                  />
                  {searchPeriod === "day" ? (
                    <DateInput
                      placeholder="Chọn ngày bay"
                      label="Ngày bay"
                      {...form.getInputProps("date")}
                      disabled={submitting}
                      leftSection={<IconCalendar size={18} color="blue" />}
                      size="md"
                      radius="lg"
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
                      leftSection={<IconCalendar size={18} color="blue" />}
                      size="md"
                      radius="lg"
                      minDate={new Date()}
                      valueFormat="MMMM YYYY"
                      locale="vi"
                    />
                  )}
                  <Group className="booking-passenger-counter booking-counter-adult" justify="flex-start" wrap="nowrap" mt="sm">
                    <Stack gap={0}>
                      <Text fw={500}>Người lớn</Text>
                      <Text fz="sm" c="dimmed" fs="italic">12 tuổi trở lên</Text>
                    </Stack>
                    <Group className="booking-counter-controls" gap="xs" wrap="nowrap">
                      <ActionIcon
                        variant="filled"
                        disabled={adultCount <= Math.max(1, infantCount) || submitting || searching || passengers.some(p => p.booking !== null)}
                        onClick={() =>
                        {
                          setAdultCount((prev) => Math.max(prev - 1, Math.max(1, infantCount)))
                        }}
                      >
                        <IconMinus color="#ffffff" />
                      </ActionIcon>
                      <NumberInput
                        placeholder="0"
                        hideControls
                        readOnly
                        variant="filled"
                        min={0}
                        max={9}
                        allowDecimal={false}
                        allowNegative={false}
                        value={adultCount}
                        styles={{
                          root: {
                            width: 46
                          },
                          input: {
                            textAlign: "center",
                            fontWeight: 750,
                          }
                        }}
                        disabled={submitting || searching || passengers.some(passenger => passenger.booking !== null)}
                      />
                      <ActionIcon
                        variant="filled"
                        disabled={adultCount >= 9 || submitting || searching || passengers.some(p => p.booking !== null)}
                        onClick={() =>
                        {
                          setAdultCount((prev) => Math.min(prev + 1, 9))
                        }}>
                        <IconPlus color="#ffffff" />
                      </ActionIcon>
                    </Group>
                  </Group>
                  <Group className="booking-passenger-counter booking-counter-child" justify="flex-start" wrap="nowrap">
                    <Stack gap={0}>
                      <Text fw={500}>Trẻ em</Text>
                      <Text fz="sm" c="dimmed" fs="italic">Từ 2-12 tuổi</Text>
                    </Stack>
                    <Group className="booking-counter-controls" gap="xs" wrap="nowrap">
                      <ActionIcon
                        variant="filled"
                        disabled={childCount <= 0 || submitting || searching || passengers.some(p => p.booking !== null)}
                        onClick={() =>
                        {
                          setChildCount((prev) => Math.max(prev - 1, 0))
                          updatePartySize(adultCount, Math.max(childCount - 1, 0));
                        }}
                      >
                        <IconMinus color="#ffffff" />
                      </ActionIcon>
                      <NumberInput
                        placeholder="0"
                        hideControls
                        readOnly
                        variant="filled"
                        min={0}
                        max={9}
                        allowDecimal={false}
                        allowNegative={false}
                        value={childCount}
                        styles={{
                          root: {
                            width: 46
                          },
                          input: {
                            textAlign: "center",
                            fontWeight: 750,
                          }
                        }}
                        disabled={submitting || searching || passengers.some(passenger => passenger.booking !== null)}
                      />
                      <ActionIcon
                        variant="filled"
                        disabled={childCount >= 9 || submitting || searching || passengers.some(p => p.booking !== null)}
                        onClick={() =>
                        {
                          setChildCount((prev) => Math.min(prev + 1, 9))
                          updatePartySize(adultCount, Math.min(childCount + 1, 9));
                        }}>
                        <IconPlus color="#ffffff" />
                      </ActionIcon>
                    </Group>
                  </Group>
                  <Group className="booking-passenger-counter booking-counter-infant" justify="flex-start" wrap="nowrap">
                    <Stack gap={0}>
                      <Text fw={500}>Em bé</Text>
                      <Text fz="sm" c="dimmed" fs="italic">Dưới 2 tuổi</Text>
                    </Stack>
                    <Group className="booking-counter-controls" gap="xs" wrap="nowrap">
                      <ActionIcon
                        variant="filled"
                        disabled={infantCount <= 0 || submitting || searching || passengers.some(p => p.booking !== null)}
                        onClick={() =>
                        {
                          setInfantCount((prev) => Math.max(prev - 1, 0))
                        }}
                      >
                        <IconMinus color="#ffffff" />
                      </ActionIcon>
                      <NumberInput
                        placeholder="0"
                        hideControls
                        readOnly
                        variant="filled"
                        min={0}
                        max={9}
                        allowDecimal={false}
                        allowNegative={false}
                        value={infantCount}
                        styles={{
                          root: {
                            width: 46
                          },
                          input: {
                            textAlign: "center",
                            fontWeight: 750,
                          }
                        }}
                        disabled={submitting || searching || passengers.some(passenger => passenger.booking !== null)}
                      />
                      <ActionIcon
                        variant="filled"
                        disabled={infantCount >= Math.min(adultCount, 9) || submitting || searching || passengers.some(p => p.booking !== null)}
                        onClick={() =>
                        {
                          setInfantCount((prev) => Math.min(prev + 1, 9))
                        }}>
                        <IconPlus color="#ffffff" />
                      </ActionIcon>
                    </Group>
                  </Group>
                </SimpleGrid>
                <Flex
                  w="100%"
                  align="flex-end"
                  justify="flex-end"
                  gap="md"
                  wrap="nowrap"
                >
                  {(infantCount > 0 || childCount > 0) && (
                    <Alert
                      color="yellow"
                      variant="light"
                      p="sm"
                      title="Lưu ý"
                      icon={<IconAlertCircleFilled />}
                      style={{
                        flex: 1,
                        minWidth: 0,
                      }}
                    >
                      {infantCount > 0 && (
                        <Text fz="sm" fs="italic">
                          Ngồi cùng người lớn, miễn phí, không tính ghế.
                        </Text>
                      )}
                      {childCount > 0 && (
                        <Text fz="sm" fs="italic">
                          Giá cơ bản bằng 75%.
                        </Text>
                      )}
                    </Alert>
                  )}
                  <Button
                    className="booking-search-submit" color="blue"
                    // type="submit"
                    size="md"
                    radius="md"
                    loading={searching}
                    disabled={
                      submitting ||
                      searching ||
                      (searchPeriod === "day"
                        ? !form.values.date
                        : !form.values.month)
                    }
                    leftSection={<IconSearch size={19} />}
                    rightSection={<IconArrowRight size={17} />}
                    style={{ flexShrink: 0 }}
                    onClick={() => handleSearchFlights(form.values)}
                  >
                    Tìm chuyến bay
                  </Button>
                </Flex>
              </Stack>
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

                {(searching || flights.length === 0) && (
                  <Group justify="space-between" align="center">
                    <Title order={2} size="xl" id="flight-results-title">Chuyến bay</Title>
                    {!searching && <Badge color="gray" variant="light">{flights.length} chuyến</Badge>}
                  </Group>
                )}
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
                    <Grid gap={{ base: "md", lg: "lg" }} align="stretch">
                      <Grid.Col span={{ base: 12, md: 7 }}>
                        <Group className="booking-list-heading" justify="space-between" align="center" gap="sm" mb="xs">


                          <Title order={2} size="xl" id="flight-results-title">Chuyến bay</Title>

                          <Badge color="gray" variant="light">{flights.length} chuyến</Badge>
                        </Group>

                        <Stack className="booking-flight-list" gap="sm">
                          {flights.map((item) =>
                          {
                            const isSelected = flight?.flightId === item.flightId;
                            const soldOut = item.availableSeats === 0;
                            const flightCode = String(item.flightNo ?? "").toUpperCase();
                            // Chỉ hiện tên hãng khi mã chuyến thực sự có tiền tố tương ứng.
                            const carrier = /^(VN|HVN)(-|\d)/.test(flightCode)
                              ? { name: "Vietnam Airlines", short: "VN", tone: "vietnam" }
                              : /^(VJ)(-|\d)/.test(flightCode)
                                ? { name: "Vietjet Air", short: "VJ", tone: "vietjet" }
                                : /^(QH)(-|\d)/.test(flightCode)
                                  ? { name: "Bamboo Airways", short: "QH", tone: "bamboo" }
                                  : /^(VU)(-|\d)/.test(flightCode)
                                    ? { name: "Vietravel Airlines", short: "VU", tone: "vietravel" }
                                    : { name: "Chuyến bay", short: "✈", tone: "other" };
                            const canFit = !soldOut && item.availableSeats >= requiredSeatCount;
                            return (
                              <Paper
                                component="button"
                                type="button"
                                key={item.flightId}
                                withBorder
                                radius="lg"
                                p="md"
                                className={`booking-flight-card ticket-ref ticket-ref--${carrier.tone}${isSelected ? " ticket-ref--selected" : ""}`}
                                disabled={submitting || searching}
                                aria-pressed={isSelected}
                                aria-label={`${item.flightNo}, ${item.origin} đến ${item.destination}, ${money(item.price)}. ${soldOut ? "Hết chỗ" : `Còn ${item.availableSeats} ghế`}`}
                                onClick={() => void chooseFlight(item)}
                              >
                                {/* Hàng 1 — Logo/tên hãng, mã chuyến và dấu mở rộng trang trí */}
                                <Group className="ticket-ref__header" gap="xs" wrap="nowrap">
                                  <Box className="ticket-ref__mark" aria-hidden="true">
                                    {carrier.tone === "vietnam" ? "✺" : carrier.short}
                                  </Box>
                                  <Text className="ticket-ref__brand" fw={800} title={carrier.name}>
                                    {carrier.name}
                                  </Text>
                                  <Text className="ticket-ref__number" fw={750}>{item.flightNo}</Text>
                                  <Box className="ticket-ref__chevron" aria-hidden="true">
                                    <IconArrowRight size={16} stroke={2.2} />
                                  </Box>
                                </Group>

                                {/* Hàng 2 — Giờ đi / thời lượng / giờ đến + giá cùng hàng */}
                                <Box className="ticket-ref__main">
                                  <Box className="ticket-ref__route">
                                    <Stack gap={2} className="ticket-ref__airport">
                                      <Text className="ticket-ref__time">{dateFormater(item.departureTime, "HH:mm")}</Text>
                                      <Text className="ticket-ref__iata">{item.origin}</Text>
                                      <Text className="ticket-ref__city" lineClamp={1}>{item.originCity}</Text>
                                    </Stack>

                                    <Stack gap={3} align="center" className="ticket-ref__track">
                                      <Text className="ticket-ref__duration">
                                        {flightDuration(item.departureTime, item.arrivalTime)}
                                      </Text>
                                      <Group gap={5} wrap="nowrap" w="100%" align="center" aria-hidden="true">
                                        <Box className="ticket-ref__dash" />
                                        <IconPlane size={17} stroke={1.8} />
                                        <Box className="ticket-ref__dash" />
                                      </Group>
                                      <Text className="ticket-ref__direct">Bay thẳng</Text>
                                    </Stack>

                                    <Stack gap={2} className="ticket-ref__airport ticket-ref__airport--arrival">
                                      <Text className="ticket-ref__time">{dateFormater(item.arrivalTime, "HH:mm")}</Text>
                                      <Text className="ticket-ref__iata">{item.destination}</Text>
                                      <Text className="ticket-ref__city" lineClamp={1}>{item.destinationCity}</Text>
                                    </Stack>
                                  </Box>

                                  <Stack className="ticket-ref__fare" gap={0} align="flex-end">
                                    <Text className="ticket-ref__amount">{money(item.price)}</Text>
                                    <Text className="ticket-ref__unit">/ hành khách</Text>
                                  </Stack>
                                </Box>

                                {/* Hàng 3 — Ngày, các đặc điểm và nút chọn bên phải */}
                                <Box className="ticket-ref__footer">
                                  <Stack className="ticket-ref__details" gap={7}>
                                    <Group className="ticket-ref__date" gap={6} wrap="nowrap">
                                      <IconCalendar size={15} stroke={1.8} />
                                      <Text span>
                                        {new Date(item.departureTime).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}
                                        {" · "}
                                        {new Date(item.departureTime).toLocaleDateString("vi-VN", { weekday: "long", timeZone: "Asia/Ho_Chi_Minh" })}
                                      </Text>
                                    </Group>
                                    <Group gap={6} wrap="wrap" className="ticket-ref__badges">
                                      <Badge color={soldOut ? "red" : canFit ? "green" : "orange"} variant="light" radius="sm" leftSection={!soldOut ? <IconCheck size={12} /> : undefined}>
                                        {soldOut ? "Hết chỗ" : `Còn ${item.availableSeats} ghế`}
                                      </Badge>
                                      <Badge color="blue" variant="light" radius="sm">
                                        Chọn hạng ghế
                                      </Badge>
                                      <Badge color="orange" variant="light" radius="sm">
                                        Dịch vụ mua thêm
                                      </Badge>
                                      {!canFit && !soldOut && (
                                        <Badge color="red" variant="light" radius="sm">
                                          Thiếu ghế cho nhóm {requiredSeatCount} người
                                        </Badge>
                                      )}
                                    </Group>
                                  </Stack>
                                  <Box className="ticket-ref__cta" aria-hidden="true">
                                    <Text span fw={750}>
                                      {isSelected ? "Đang chọn" : soldOut ? "Hết chỗ" : "Chọn chuyến"}
                                    </Text>
                                    <IconArrowRight size={16} />
                                  </Box>
                                </Box>
                              </Paper>

                            );
                          })}
                        </Stack>

                      </Grid.Col>
                      <Grid.Col span={{ base: 12, md: 5 }}>
                        <Paper
                          className="booking-panel booking-seat-panel" component="section" withBorder radius="lg" p={{ base: "md", sm: "lg" }} shadow="xs" aria-labelledby="seat-passenger-title">
                          <Stack gap="md">
                            <Group justify="space-between" align="center" gap="sm" wrap="wrap">
                              <Box>
                                <Title order={2} size="xl" id="seat-passenger-title">Ghế & hành khách</Title>
                              </Box>
                              {flight && !allPassengersBooked && (
                                <Badge color={selectedSeats.every(Boolean) ? "teal" : "gray"} variant="light" size="lg">
                                  {selectedSeats.filter(Boolean).length}/{passengers.length} ghế đã chọn
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
                            {flight && loadingSeats && !allPassengersBooked && (
                              <Center mih={240} role="status">
                                <Stack align="center" gap="sm">
                                  <Loader size="md" />
                                  <Text c="dimmed" size="sm">Đang tải sơ đồ ghế…</Text>
                                </Stack>
                              </Center>
                            )}
                            {flight && !loadingSeats && !allPassengersBooked && (
                              <Stack gap="lg">
                                <Paper className="booking-flight-summary" p="md" radius="lg" withBorder>
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
                                      setSeats([]);
                                      setPassengers([createPassenger()]);
                                      setActivePassengerIndex(0);
                                    }} disabled={submitting}>
                                      Đổi chuyến
                                    </Button>
                                  </Group>
                                </Paper>
                                {flight.availableSeats < requiredSeatCount && (
                                  <Alert color={suggestionError ? "red" : "orange"} variant="light" title="Chuyến này không đủ ghế cho nhóm">
                                    <Stack gap="sm">
                                      <Text size="sm">
                                        Cần {requiredSeatCount} ghế cho {adultCount} người lớn và {childCount} trẻ em; chuyến hiện còn {flight.availableSeats} ghế.
                                        {infantCount > 0 ? ` ${infantCount} trẻ dưới 2 tuổi ngồi cùng người lớn, không cần ghế.` : ""}
                                      </Text>
                                      {loadingSuggestions && <Text size="sm">Đang tìm chuyến gần giờ hoặc ngày liền kề…</Text>}
                                      {suggestionError && <Text size="sm">{suggestionError}</Text>}
                                      {!loadingSuggestions && !suggestionError && suggestedFlights.length === 0 && (
                                        <Text size="sm">Không tìm thấy chuyến liền kề còn đủ ghế. Hãy đổi ngày hoặc giảm số hành khách.</Text>
                                      )}
                                      {suggestedFlights.map(candidate => (
                                        <Button
                                          key={candidate.flightId}
                                          type="button"
                                          variant="white"
                                          color="blue"
                                          size="sm"
                                          justify="space-between"
                                          onClick={() => void chooseFlight(candidate)}
                                          disabled={submitting}
                                        >
                                          {flightDate(candidate.departureTime) === flightDate(flight.departureTime)
                                            ? `Cùng ngày · ${new Date(candidate.departureTime).toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" })}`
                                            : `${new Date(candidate.departureTime).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit" })} · ${new Date(candidate.departureTime).toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" })}`}
                                          {" · "}{candidate.flightNo} · còn {candidate.availableSeats} ghế
                                        </Button>
                                      ))}
                                    </Stack>
                                  </Alert>
                                )}
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
                                  <Group gap="xs" wrap="wrap" aria-label="Hạng vé và phụ thu">
                                    <Badge color="teal" variant="light">Phổ thông · +0đ</Badge>
                                    <Badge color="blue" variant="light">Phổ thông đặc biệt · +500.000đ</Badge>
                                    <Badge color="orange" variant="light">Thương gia · +1.000.000đ</Badge>
                                  </Group>
                                  <Group gap="xs" wrap="wrap" aria-label="Chọn hành khách để gán ghế">
                                    <Text size="sm" fw={600}>Gán ghế cho:</Text>
                                    {passengers.map((passenger, index) => (
                                      <Button
                                        key={index}
                                        type="button"
                                        size="xs"
                                        variant={activePassengerIndex === index ? "filled" : "light"}
                                        color="blue"
                                        onClick={() => setActivePassengerIndex(index)}
                                        disabled={submitting || passenger.booking !== null}
                                      >
                                        {passenger.passengerType === "CHILD" ? `Trẻ em ${index - adultCount + 1}` : `Người lớn ${index + 1}`}
                                        {passenger.seatId ? " · đã có ghế" : ""}
                                      </Button>
                                    ))}
                                  </Group>
                                </Stack>
                                {/* 6 ghế/hàng, có lối đi ở giữa ghế thứ 3 và thứ 4 */}
                                {seats.length > 0 ? (
                                  <Paper className="booking-seat-map" radius="lg" p="md" withBorder>
                                    <ScrollArea type="auto" offsetScrollbars>
                                      <Box
                                        role="group"
                                        aria-label="Sơ đồ chọn ghế"
                                        mx="auto"
                                        style={{
                                          display: "grid",
                                          gridTemplateColumns: "22px repeat(3, 38px) 18px repeat(3, 38px)",
                                          gridAutoRows: "36px",
                                          gap: 7,
                                          width: "max-content",
                                          padding: "8px 3px",
                                        }}
                                      >
                                        {["A", "B", "C", "D", "E", "F"].map((letter, index) => (
                                          <Text
                                            key={letter}
                                            className="booking-seat-axis"
                                            ta="center"
                                            style={{ gridRow: 1, gridColumn: index < 3 ? index + 2 : index + 3 }}
                                          >{letter}</Text>
                                        ))}
                                        {Array.from({ length: Math.ceil(seats.length / 6) }, (_, index) => (
                                          <Text
                                            key={`row-${index}`}
                                            className="booking-seat-axis"
                                            ta="center"
                                            style={{ gridColumn: 1, gridRow: index + 2 }}
                                          >{String(index + 1).padStart(2, "0")}</Text>
                                        ))}
                                        {seats.map((item, index) =>
                                        {
                                          const assignedPassengerIndex = passengers.findIndex(passenger => passenger.seatId === item.seatId);
                                          const isChosen = assignedPassengerIndex >= 0;
                                          const isAvailable = item.status === "AVAILABLE";
                                          const columnInRow = index % 6;
                                          const price = seatPrice(item.seatNo);
                                          const classPrice = cabinPrices[item.cabinClass] ?? 0;
                                          return (
                                            <Button
                                              key={item.seatId}
                                              className={`booking-seat-button${isChosen ? " booking-seat-button-selected" : isAvailable ? ` booking-seat-button-available booking-seat-class-${String(item.cabinClass).toLowerCase()}` : " booking-seat-button-unavailable"}`}
                                              type="button"
                                              size="sm"
                                              radius="sm"
                                              p={0}
                                              fz="sm"
                                              fw={700}
                                              variant={isChosen ? "filled" : isAvailable ? "light" : "default"}
                                              color={isChosen ? "blue" : isAvailable ? "teal" : "gray"}
                                              disabled={!isAvailable || submitting ||
                                                (assignedPassengerIndex >= 0 && assignedPassengerIndex !== activePassengerIndex) ||
                                                passengers[activePassengerIndex]?.booking !== null}
                                              aria-pressed={isChosen}
                                              aria-label={`Ghế ${item.seatNo}, hạng ${cabinLabels[item.cabinClass] ?? item.cabinClass}${isChosen ? `, hành khách ${assignedPassengerIndex + 1} đã chọn` : isAvailable ? " còn trống" : " không còn trống"}, phụ thu hạng ${money(classPrice)}${price ? `, phụ thu vị trí ${money(price)}` : ""}`}
                                              onClick={() =>
                                              {
                                                setError("");
                                                setPassengers(current => current.map((passenger, passengerIndex) =>
                                                  passengerIndex === activePassengerIndex
                                                    ? { ...passenger, seatId: passenger.seatId === item.seatId ? null : item.seatId }
                                                    : passenger));
                                              }}
                                              style={{
                                                gridColumn: columnInRow < 3 ? columnInRow + 2 : columnInRow + 3,
                                                gridRow: Math.floor(index / 6) + 2,
                                                minWidth: 0,
                                                width: "100%",
                                                height: 36,
                                              }}
                                            >
                                              {isChosen ? item.seatNo : isAvailable ? item.seatNo : "×"}
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
                                  Chọn hành khách cần gán ghế ở trên · Hàng 01 +100.000đ, ghế A/F +50.000đ.
                                </Text>
                                {flight && !allPassengersBooked && (
                                  <Paper className="booking-passenger-card" withBorder radius="lg" p={{ base: "md", sm: "lg" }}>
                                    <Box component="form" onSubmit={book}>
                                      <Stack gap="md">
                                        <Group justify="space-between" align="center" gap="sm" wrap="wrap">
                                          <Box>
                                            <Text c="blue.7" tt="uppercase" fw={800} size="sm" lts={0.5}>
                                              Hành khách & dịch vụ
                                            </Text>
                                            <Title order={3} size="lg">Thông tin đặt vé</Title>
                                          </Box>
                                          <Badge color="blue" variant="light" size="lg">
                                            {selectedSeats.filter(Boolean).length}/{passengers.length} ghế đã chọn
                                          </Badge>
                                        </Group>
                                        <Paper withBorder radius="md" p="sm">
                                          <Group justify="space-between" gap="xs" wrap="wrap">
                                            <Text size="sm" fw={700}>Số lượng đã chọn ở bước tìm chuyến</Text>
                                            <Text size="sm">
                                              {adultCount} người lớn · {childCount} trẻ em · {infantCount} trẻ dưới 2 tuổi
                                            </Text>
                                          </Group>
                                        </Paper>
                                        <Stack gap="xs">
                                          {passengers.map((passenger, index) =>
                                          {
                                            const assignedSeat = selectedSeats[index];
                                            return (
                                              <Paper key={index} withBorder radius="md" p="sm">
                                                <Stack gap="xs">
                                                  <Group justify="space-between" align="center">
                                                    <Text size="sm" fw={700}>
                                                      {passenger.passengerType === "CHILD" ? "Trẻ em" : "Người lớn"} {passenger.passengerType === "CHILD" ? index - adultCount + 1 : index + 1}
                                                    </Text>
                                                    <Text size="sm" c={assignedSeat ? "dark" : "dimmed"}>
                                                      {assignedSeat
                                                        ? `Ghế ${assignedSeat.seatNo} · ${cabinLabels[assignedSeat.cabinClass] ?? assignedSeat.cabinClass}`
                                                        : "Chưa chọn ghế"}
                                                    </Text>
                                                  </Group>
                                                  <TextInput
                                                    label="Họ và tên"
                                                    placeholder="Nhập họ tên như trên giấy tờ"
                                                    value={passenger.name}
                                                    onChange={event => setPassengers(current => current.map((item, passengerIndex) =>
                                                      passengerIndex === index ? { ...item, name: event.currentTarget.value } : item))}
                                                    maxLength={120}
                                                    required
                                                    disabled={submitting || passenger.booking !== null}
                                                    autoComplete={index === 0 ? "name" : "off"}
                                                    size="md"
                                                  />
                                                  <TextInput
                                                    label="Email nhận xác nhận"
                                                    type="email"
                                                    placeholder="ban@example.com"
                                                    value={passenger.email}
                                                    onChange={event => setPassengers(current => current.map((item, passengerIndex) =>
                                                      passengerIndex === index ? { ...item, email: event.currentTarget.value } : item))}
                                                    maxLength={254}
                                                    required
                                                    disabled={submitting || passenger.booking !== null}
                                                    autoComplete={index === 0 ? "email" : "off"}
                                                    size="md"
                                                  />
                                                  {passenger.booking && (
                                                    <Badge color="teal" variant="light" w="fit-content">
                                                      Đã đặt · {passenger.booking.bookingCode}
                                                    </Badge>
                                                  )}
                                                </Stack>
                                              </Paper>
                                            );
                                          })}
                                        </Stack>
                                        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                                          <Box className="booking-addon-option booking-addon-baggage">
                                            <Group gap="xs" mb={6}>
                                              <IconLuggage size={19} />
                                              <Text fw={700}>Hành lý ký gửi</Text>
                                            </Group>
                                            <Text size="sm" c="dimmed" mb="sm">Gói đã chọn áp dụng cho mỗi hành khách.</Text>
                                            <Select
                                              aria-label="Gói hành lý ký gửi"
                                              placeholder="Không mua thêm"
                                              data={baggageOptions}
                                              value={baggageKg}
                                              onChange={setBaggageKg}
                                              clearable
                                              disabled={submitting || passengers.some(passenger => passenger.booking !== null)}
                                              size="sm"
                                            />
                                          </Box>
                                          <Box className="booking-addon-option booking-addon-meal">
                                            <Group gap="xs" mb={6}>
                                              <IconToolsKitchen2 size={19} />
                                              <Text fw={700}>Suất ăn</Text>
                                            </Group>
                                            <Text size="sm" c="dimmed" mb="sm">Suất ăn đã chọn áp dụng cho mỗi hành khách.</Text>
                                            <Select
                                              aria-label="Suất ăn"
                                              placeholder="Không chọn suất ăn"
                                              data={mealOptions}
                                              value={mealCode}
                                              onChange={setMealCode}
                                              clearable
                                              disabled={submitting || passengers.some(passenger => passenger.booking !== null)}
                                              size="sm"
                                            />
                                          </Box>
                                        </SimpleGrid>
                                        <Divider />
                                        <Paper className="booking-total-card" radius="lg" p="md" withBorder>
                                          <Stack gap="xs">
                                            <Group justify="space-between" align="center" wrap="wrap" gap="xs">
                                              <Box>
                                                <Text size="sm" fw={700}>
                                                  {passengers.some(passenger => passenger.booking !== null)
                                                    ? "Tổng giá trị các vé"
                                                    : "Tổng thanh toán mô phỏng"}
                                                </Text>
                                                <Text size="xs" c="dimmed">
                                                  {passengers.some(passenger => passenger.booking !== null)
                                                    ? "Các vé đã thành công được giữ riêng"
                                                    : "Chưa thu tiền thật"}
                                                </Text>
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
                                                  <Text size="sm">Giá vé cơ bản · người lớn và trẻ em</Text>
                                                  <Text size="sm" fw={600} ta="right">{money(selectedBaseFare)}</Text>
                                                </Group>
                                                <Group justify="space-between" gap="sm" wrap="nowrap">
                                                  <Text size="sm">Phụ thu hạng vé</Text>
                                                  <Text size="sm" fw={600} ta="right">{money(selectedCabinFee)}</Text>
                                                </Group>
                                                <Group justify="space-between" gap="sm" wrap="nowrap">
                                                  <Text size="sm">Phụ thu vị trí ghế</Text>
                                                  <Text size="sm" fw={600} ta="right">{money(selectedSeatFee)}</Text>
                                                </Group>
                                                <Group justify="space-between" gap="sm" wrap="nowrap">
                                                  <Text size="sm">{baggageKg ? `Hành lý ký gửi · ${baggageKg} kg × ${selectedSeats.filter(Boolean).length}` : "Hành lý ký gửi · Không mua thêm"}</Text>
                                                  <Text size="sm" fw={600} ta="right">{money(selectedBaggageFee * selectedSeats.filter(Boolean).length)}</Text>
                                                </Group>
                                                <Group justify="space-between" gap="sm" wrap="nowrap">
                                                  <Text size="sm">{mealCode ? `Suất ăn · ${mealLabels[mealCode] ?? mealCode} × ${selectedSeats.filter(Boolean).length}` : "Suất ăn · Không chọn"}</Text>
                                                  <Text size="sm" fw={600} ta="right">{money(selectedMealFee * selectedSeats.filter(Boolean).length)}</Text>
                                                </Group>
                                                <Group justify="space-between" gap="sm" wrap="nowrap">
                                                  <Text size="sm">Phí phục vụ · Không thu riêng</Text>
                                                  <Text size="sm" fw={600} ta="right">{money(0)}</Text>
                                                </Group>
                                              </Stack>
                                            </details>
                                          </Stack>
                                        </Paper>
                                        <Button
                                          className="booking-confirm-button" color="blue"
                                          type="submit"
                                          size="md"
                                          radius="md"
                                          fullWidth
                                          loading={submitting}
                                          disabled={passengers.some(passenger =>
                                            passenger.booking === null &&
                                            (!passenger.name.trim() || !passenger.email.trim() || !passenger.seatId))}
                                          rightSection={<IconArrowRight size={18} />}
                                        >
                                          {passengers.some(passenger => passenger.booking !== null) ? "Đặt các vé còn lại" : `Xác nhận ${passengers.length} vé`}
                                        </Button>
                                        <Text size="sm" c="dimmed" ta="center">
                                          Mỗi vé được xác nhận riêng; vé đã thành công vẫn được giữ nếu vé khác gặp lỗi.
                                        </Text>
                                      </Stack>
                                    </Box>
                                  </Paper>
                                )}
                              </Stack>
                            )}
                            {/* BƯỚC 3: XÁC NHẬN ĐẶT VÉ THÀNH CÔNG */}
                            {allPassengersBooked && (
                              <Stack align="center" gap="md" py={{ base: "md", sm: "xl" }} role="status">
                                <ThemeIcon color="teal" size={74} radius="xl" variant="light">
                                  <IconCircleCheck size={44} />
                                </ThemeIcon>
                                <Stack align="center" gap={5}>
                                  <Text tt="uppercase" fw={800} size="sm" c="teal.7" lts={1}>
                                    Đặt {passengers.length} vé hoàn tất
                                  </Text>
                                  <Title order={3} size="xl" ta="center">Các chuyến đi đã được xác nhận</Title>
                                  {infantCount > 0 && (
                                    <Text size="sm" c="dimmed" ta="center">
                                      Còn {infantCount} trẻ dưới 2 tuổi đi cùng người lớn · không cần ghế, miễn phí.
                                    </Text>
                                  )}
                                </Stack>
                                {passengers.map((passenger, index) =>
                                {
                                  const booking = passenger.booking;
                                  if (!booking) return null;
                                  return (
                                    <Paper key={booking.bookingId} className="booking-confirmed-ticket" withBorder radius="lg" p="lg" w="100%">
                                      <Stack gap="sm">
                                        <Group justify="space-between" align="center" wrap="wrap">
                                          <Text fw={700}>{booking.passengerName}</Text>
                                          <Badge color={passenger.passengerType === "CHILD" ? "blue" : "teal"} variant="light">
                                            {passenger.passengerType === "CHILD" ? "Trẻ em · 75%" : "Người lớn"}
                                          </Badge>
                                          <Badge color="teal" variant="light" size="lg">{booking.status}</Badge>
                                        </Group>
                                        <Group gap="xs" justify="space-between" wrap="wrap">
                                          <Text>{booking.flightNo} · Ghế {booking.seatNo}</Text>
                                          <Badge color="blue" variant="light">
                                            {cabinLabels[booking.cabinClass] ?? booking.cabinClass}
                                          </Badge>
                                        </Group>
                                        <Group justify="space-between" align="center" wrap="wrap">
                                          <Text size="sm" c="dimmed">Mã vé · {booking.bookingCode}</Text>
                                          <Text fw={700} c="blue.7" size="lg">{money(booking.amount)}</Text>
                                        </Group>
                                        <Group justify="space-between" align="center" wrap="wrap">
                                          <Group gap="xs">
                                            <Badge color="blue" variant="light">
                                              Phụ thu hạng {money(booking.cabinFee)}
                                            </Badge>
                                            <Badge color={booking.seatFee > 0 ? "orange" : "teal"} variant="light">
                                              {booking.seatFee > 0 ? `Phụ thu ghế ${money(booking.seatFee)}` : "Ghế tiêu chuẩn"}
                                            </Badge>
                                            {booking.baggageKg && <Badge color="blue" variant="light">Hành lý {booking.baggageKg} kg</Badge>}
                                            {booking.mealCode && <Badge color="grape" variant="light">{mealLabels[booking.mealCode] ?? "Suất ăn"}</Badge>}
                                          </Group>
                                          <Button component={Link} href={`/bookings/${booking.bookingId}`} size="xs" variant="subtle" rightSection={<IconArrowRight size={14} />}>
                                            Chi tiết vé
                                          </Button>
                                        </Group>
                                      </Stack>
                                    </Paper>
                                  );
                                })}
                              </Stack>
                            )}
                          </Stack>
                        </Paper>
                      </Grid.Col>
                    </Grid>
                  </Stack>
                )}
              </Stack>
            </Paper>
          </Stack>
        </Stack>
      </Container>
    </Box >
  )
}

export default function BookingPage() {
  return (
    <React.Suspense fallback={null}>
      <BookingPageContent />
    </React.Suspense>
  );
}
