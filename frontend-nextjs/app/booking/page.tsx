"use client";

import {
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
import {
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
  IconExchange,
  IconArrowsExchange2,
  IconArrowDown,
} from "@tabler/icons-react";

import { DateInput, MonthPickerInput } from '@mantine/dates';
import 'dayjs/locale/vi';

import React, { useEffect, useRef, useState, type FormEvent } from "react";
import { ApiError, apiGet, apiPost } from "../../lib/api";
import type { Flight, Seat, Booking, CreateBooking, FlightBookingRequest } from "../../types/booking";
import Link from "next/link";

import { useForm } from "@mantine/form";
import { __getTimChuyenBay } from "@/components/api/booking";
import { dateFormat, dateFormater } from "@/components/utils/date-format";

import { useQueryFilters } from "@/components/utils/setURLParams";
import "./styles.css";
import { InfoRow } from "@/components/Share";
import { flightDuration, getName, money } from "@/components/utils/func";
import SectionThongTinKhachHang from "./SectionThongTinKhachHang";
import SectionBookingSeat from "./SectionBookingSeat";


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

export type PassengerDraft = {
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

const dateWithOffset = (date: string, offset: number) => {
  const [year, month, day] = date.split("-").map(Number);
  const adjusted = new Date(Date.UTC(year, month - 1, day + offset));
  return `${adjusted.getUTCFullYear()}-${String(adjusted.getUTCMonth() + 1).padStart(2, "0")}-${String(adjusted.getUTCDate()).padStart(2, "0")}`;
};

const flightDate = (value: string) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
};

function BookingPageContent() {
  const { get, set } = useQueryFilters();

  const origin = get("origin") ?? "";
  const destination = get("destination") ?? "";
  const date = get("date") ?? null;
  const month = get("month") ?? null;

  const [type, setType] = useState<"oneWay" | "roundTrip">("oneWay")
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

  const searchForm = useForm<{
    origin: string | null;
    destination: string | null;
    date: string | null;
    month: string | null;
  }>({
    initialValues: {
      origin: origin ?? null,
      destination: destination ?? null,
      date: date ?? null,
      month: month ?? null,
    },
  })

  const bookingForm = useForm<FlightBookingRequest>({
    initialValues: {
      flightIds: [],
      contactEmail: "",
      passengers: [],
      payment: {
        amount: 0,
        currency: "VND",
      },
      requestId: crypto.randomUUID(),
    },
  })

  function updatePartySize(adults: number, children: number, infants = Math.min(infantCount, adults)) {
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


  const handleSearchFlights = React.useCallback(async (values: typeof searchForm.values) => {
    if (!searchForm.values || !values.origin || !values.destination) return;
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

  useEffect(() => {
    handleSearchFlights(searchForm.values);
  }, [handleSearchFlights])

  async function toggleChooseFlight(item: Flight) {
    const request = ++seatRequest.current;
    if (flight?.flightId === item.flightId) {
      setFlight(null);
      setSeats([]);
      setPassengers(current => current.map(passenger => ({
        ...passenger,
        seatId: null,
      })));
      setActivePassengerIndex(0);
      setBaggageKg(null);
      setMealCode(null);
      setError("");
      setSuggestedFlights([]);
      setSuggestionError("");
      setLoadingSeats(false);
      setLoadingSuggestions(false);
      return;
    }

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

  async function book(event: FormEvent<HTMLFormElement>) {
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
                    <Text className="booking-hero-route-code">{searchForm.values.origin || "ĐI"}</Text>
                    <Text size="xs">Nơi khởi hành</Text>
                  </Stack>
                  <Box className="booking-hero-route-line"><IconPlane size={21} /></Box>
                  <Stack gap={3} ta="right">
                    <Text className="booking-hero-route-code">{searchForm.values.destination || "ĐẾN"}</Text>
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

          <Paper
            className="booking-search-card"
            withBorder
            radius="xl"
            shadow="sm"
            p={{ base: "md", sm: "xl" }}
            style={{ borderColor: "var(--mantine-color-gray-2)", overflow: "hidden" }}
          >
            <Stack gap="lg">
              {/* Tiêu đề và chế độ tìm kiếm */}
              <Flex
                direction={{ base: "column", md: "row" }}
                align={{ base: "stretch", md: "center" }}
                gap="md"
              >
                <Group gap="md" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                  <ThemeIcon size={50} radius="lg" variant="light" color="blue">
                    <IconSearch size={26} />
                  </ThemeIcon>
                  <Box style={{ minWidth: 0 }}>
                    <Title order={2} fz={{ base: 20, sm: 24 }} fw={800}>
                      Tìm chuyến bay
                    </Title>
                    <Text c="dimmed" size="sm">
                      Chọn hành trình, thời gian và số hành khách
                    </Text>
                  </Box>
                </Group>
                <SegmentedControl
                  fullWidth={false}
                  size="md"
                  radius="md"
                  aria-label="Loại hành trình"
                  data={[
                    { label: "Một chiều", value: "oneWay" },
                    { label: "Khứ hồi", value: "roundTrip" },
                  ]}
                  value={type}
                  onChange={(value) => {
                    if (value === "oneWay" || value === "roundTrip") setType(value);
                  }}
                  disabled={submitting || searching}
                />
              </Flex>

              {/* Khối chọn hành trình */}
              <Paper radius="lg" p={{ base: "md", sm: "lg" }} bg="gray.0" withBorder>
                <Stack gap="md">
                  <Group gap="xs">
                    <ThemeIcon variant="light" color="blue" radius="md" size={30}>
                      <IconPlaneDeparture size={17} />
                    </ThemeIcon>
                    <Text fw={500} size="md">Hành trình bay</Text>
                  </Group>

                  <Flex
                    direction={{ base: "column", sm: "row" }}
                    align={{ base: "stretch", sm: "flex-end" }}
                    gap="sm"
                  >
                    <Select
                      label="Điểm khởi hành"
                      placeholder="Chọn nơi đi"
                      data={airportOptions}
                      {...searchForm.getInputProps("origin")}
                      clearable
                      searchable
                      disabled={submitting || searching}
                      size="lg"
                      radius="md"
                      leftSection={<IconPlaneDeparture size={19} />}
                      comboboxProps={{ withinPortal: true, zIndex: 500 }}
                      styles={{ root: { flex: 1, minWidth: 0 } }}
                    />

                    <ActionIcon
                      mt={30}
                      size={46}
                      radius="xl"
                      color="blue"
                      variant="white"

                      aria-label="Đổi điểm đi và điểm đến"
                      title="Đổi điểm đi và điểm đến"
                      disabled={submitting || searching}
                      onClick={() => {
                        const origin = searchForm.values.origin;
                        const destination = searchForm.values.destination;
                        searchForm.setFieldValue("origin", destination);
                        searchForm.setFieldValue("destination", origin);
                      }}
                      style={{ alignSelf: "center", flexShrink: 0, boxShadow: "0 2px 8px rgba(0,0,0,.08)" }}
                    >
                      <IconArrowsExchange2 size={22} />
                    </ActionIcon>

                    <Select
                      label="Điểm đến"
                      placeholder="Chọn nơi đến"
                      data={airportOptions?.filter((opt) => opt.value !== searchForm.values.origin)}
                      {...searchForm.getInputProps("destination")}
                      clearable
                      searchable
                      disabled={submitting || searching}
                      size="lg"
                      radius="md"
                      leftSection={<IconPlaneArrival size={19} />}
                      comboboxProps={{ withinPortal: true, zIndex: 500 }}
                      styles={{ root: { flex: 1, minWidth: 0 } }}
                    />
                  </Flex>

                  <Box>
                    <Group gap="sm" mb="sm" wrap="wrap">
                      <Text fw={700} size="sm">Thời gian khởi hành</Text>
                      <SegmentedControl
                        size="xs"
                        radius="md"
                        aria-label="Cách tìm chuyến"
                        data={[
                          { label: "Theo ngày", value: "day" },
                          { label: "Theo tháng", value: "month" },
                        ]}
                        value={searchPeriod}
                        onChange={(value) => {
                          if (value !== "day" && value !== "month") return;
                          setSearchPeriod(value);
                          searchForm.setFieldValue(value === "day" ? "month" : "date", null);
                        }}
                        disabled={submitting || searching}
                      />
                    </Group>
                    {searchPeriod === "day" ? (
                      <DateInput
                        label="Ngày bay"
                        placeholder="Chọn ngày khởi hành"
                        {...searchForm.getInputProps("date")}
                        disabled={submitting || searching}
                        leftSection={<IconCalendar size={19} />}
                        size="lg"
                        radius="md"
                        minDate={new Date()}
                        valueFormat="DD/MM/YYYY"
                        locale="vi"
                        clearable
                      />
                    ) : (
                      <MonthPickerInput
                        label="Tháng bay"
                        placeholder="Chọn tháng khởi hành"
                        {...searchForm.getInputProps("month")}
                        disabled={submitting || searching}
                        leftSection={<IconCalendar size={19} />}
                        size="lg"
                        radius="md"
                        minDate={new Date()}
                        valueFormat="MMMM YYYY"
                        locale="vi"
                        clearable
                      />
                    )}
                  </Box>
                </Stack>
              </Paper>

              {/* Khối chọn hành khách */}
              <Stack gap="sm">
                <Group gap="sm" wrap="wrap">
                  <Text fw={500} size="md">Hành khách</Text>
                  <Text c="dimmed" size="sm">
                    {adultCount + childCount + infantCount} người
                  </Text>
                </Group>

                <SimpleGrid cols={{ base: 1, md: 3 }} spacing="sm">
                  {([
                    {
                      key: "adult",
                      name: "Người lớn",
                      description: "Từ 12 tuổi",
                      count: adultCount,
                      min: Math.max(1, infantCount),
                      max: 9,
                      decrease: () => {
                        const next = Math.max(adultCount - 1, Math.max(1, infantCount));
                        setAdultCount(next);
                        updatePartySize(next, childCount);
                      },
                      increase: () => {
                        const next = Math.min(adultCount + 1, 9);
                        setAdultCount(next);
                        updatePartySize(next, childCount);
                      },
                    },
                    {
                      key: "child",
                      name: "Trẻ em",
                      description: "Từ 2 đến dưới 12 tuổi",
                      count: childCount,
                      min: 0,
                      max: 9,
                      decrease: () => {
                        const next = Math.max(childCount - 1, 0);
                        setChildCount(next);
                        updatePartySize(adultCount, next);
                      },
                      increase: () => {
                        const next = Math.min(childCount + 1, 9);
                        setChildCount(next);
                        updatePartySize(adultCount, next);
                      },
                    },
                    {
                      key: "infant",
                      name: "Em bé",
                      description: "Dưới 2 tuổi",
                      count: infantCount,
                      min: 0,
                      max: Math.min(adultCount, 9),
                      decrease: () => setInfantCount((prev) => Math.max(prev - 1, 0)),
                      increase: () => setInfantCount((prev) => Math.min(prev + 1, adultCount, 9)),
                    },
                  ] as const).map((item) => {
                    const locked = submitting || searching || passengers.some((p) => p.booking !== null);
                    return (
                      <Paper key={item.key} withBorder radius="lg" p="md">
                        <Flex align="center" gap="sm">
                          <Box style={{ flex: 1, minWidth: 0 }}>
                            <Text fw={700} size="md">{item.name}</Text>
                            <Text c="dimmed" size="sm">{item.description}</Text>
                          </Box>
                          <Group gap={6} wrap="nowrap">
                            <ActionIcon
                              aria-label={`Giảm ${item.name.toLowerCase()}`}
                              variant="light"
                              color="gray"
                              radius="md"
                              size={34}
                              disabled={locked || item.count <= item.min}
                              onClick={item.decrease}
                            >
                              <IconMinus size={17} />
                            </ActionIcon>
                            <Text fw={800} fz={20} ta="center" miw={24}>
                              {item.count}
                            </Text>
                            <ActionIcon
                              aria-label={`Tăng ${item.name.toLowerCase()}`}
                              variant="light"
                              color="blue"
                              radius="md"
                              size={34}
                              disabled={locked || item.count >= item.max}
                              onClick={item.increase}
                            >
                              <IconPlus size={17} />
                            </ActionIcon>
                          </Group>
                        </Flex>
                      </Paper>
                    );
                  })}
                </SimpleGrid>

                {(infantCount > 0 || childCount > 0) && (
                  <Alert
                    color="yellow"
                    variant="light"
                    radius="md"
                    p="sm"
                    icon={<IconAlertCircleFilled size={19} />}
                  >
                    <Text size="sm">
                      {infantCount > 0 && "Em bé ngồi cùng người lớn, miễn phí và không tính ghế."}
                      {infantCount > 0 && childCount > 0 && " "}
                      {childCount > 0 && "Giá cơ bản cho trẻ em bằng 75%."}
                    </Text>
                  </Alert>
                )}
              </Stack>

              {/* Hành động tìm kiếm */}
              <Flex
                direction={{ base: "column", sm: "row" }}
                align={{ base: "stretch", sm: "center" }}
                gap="md"
                pt="sm"
                style={{ borderTop: "1px solid var(--mantine-color-gray-2)" }}
              >
                <Box style={{ flex: 1 }}>
                  <Text fw={700} size="sm">
                    {type === "roundTrip" ? "Chuyến khứ hồi" : "Chuyến một chiều"}
                    {` · ${adultCount + childCount + infantCount} hành khách`}
                  </Text>
                  <Text size="sm" c="dimmed">
                    {searchPeriod === "day" ? "Tìm theo ngày khởi hành" : "Tìm trong tháng khởi hành"}
                  </Text>
                </Box>
                <Button
                  className="booking-search-submit"
                  size="lg"
                  radius="md"
                  color="blue"
                  leftSection={<IconSearch size={20} />}
                  rightSection={<IconArrowRight size={18} />}
                  loading={searching}
                  disabled={
                    submitting ||
                    searching ||
                    (searchPeriod === "day" ? !searchForm.values.date : !searchForm.values.month)
                  }
                  onClick={() => handleSearchFlights(searchForm.values)}
                >
                  Tìm chuyến bay
                </Button>
              </Flex>
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
                      {(!searchForm.values.destination || !searchForm.values.origin) ?
                        (
                          <Text ta="center">Chọn <b>Nơi đi</b> và <b>Nơi đến</b> để tìm chuyến bay</Text>
                        ) : (
                          <>
                            <Text fw={700} ta="center">Không tìm thấy chuyến bay nào phù hợp</Text>
                            <Text c="dimmed" size="sm" ta="center">
                              Chuyến bay từ <strong>{searchForm.values.origin || "nơi đi"}</strong> đến <strong>{searchForm.values.destination || "nơi đến"}</strong> trong {searchPeriod === "day" ? <>ngày <strong>{searchForm.values.date ? dateFormater(searchForm.values.date, "dd/MM/yyyy") : "đã chọn"}</strong></> : <>tháng <strong>{searchForm.values.month?.slice(0, 7) ?? "đã chọn"}</strong></>} không có sẵn.
                            </Text>
                          </>
                        )}

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
                          {flights.map((item) => {
                            const isSelected = flight?.flightId === item.flightId;
                            const soldOut = item.availableSeats === 0;

                            const tone = item.airlineCode === "VJ" ? "vietjet" : item.airlineCode === "VN" ? "vietnam" : item.airlineCode === "QH" ? "bamboo" : item.airlineCode === "VU" ? "vietravel" : "orther";

                            const carrier = { name: item.airlineName, short: item.airlineCode, tone: tone }
                            const canFit = !soldOut && item.availableSeats >= requiredSeatCount;
                            return (
                              <Stack key={item.flightId} gap="sm">
                                <Paper
                                  component="button"
                                  type="button"
                                  withBorder
                                  radius="lg"
                                  p="md"
                                  className={`booking-flight-card ticket-ref ticket-ref--${carrier.tone}${isSelected ? " ticket-ref--selected" : ""}`}
                                  disabled={submitting || searching}
                                  aria-pressed={isSelected}
                                  aria-label={`${item.flightNo}, ${item.origin} đến ${item.destination}, ${money(item.price)}. ${soldOut ? "Hết chỗ" : `Còn ${item.availableSeats} ghế`}`}
                                  onClick={() => {
                                    toggleChooseFlight(item);
                                  }}
                                >
                                  {/* Logo/tên hãng, mã chuyến và dấu mở rộng trang trí */}
                                  <Group className="ticket-ref__header" gap="xs" wrap="nowrap">
                                    <Box className="ticket-ref__mark" aria-hidden="true">
                                      {carrier.tone === "vietnam" ? "✺" : carrier.short}
                                    </Box>
                                    <Text className="ticket-ref__brand" fw={800} title={carrier.name}>
                                      {carrier.name}
                                    </Text>
                                    <Text className="ticket-ref__number" fw={500}>{item.flightNo}</Text>

                                  </Group>

                                  {/* Giờ đi / thời lượng / giờ đến + giá cùng hàng */}
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

                                  {/* Ngày, các đặc điểm và nút chọn bên phải */}
                                  <Box className="ticket-ref__footer">
                                    <Stack className="ticket-ref__details" gap={7}>
                                      <Group className="ticket-ref__date" gap={6} wrap="nowrap">
                                        <IconCalendar size={15} stroke={1.8} />
                                        <Text span>
                                          {dateFormat(item.departureTime, "dd/MM/yyyy")}
                                          {" · "}
                                          {new Date(item.departureTime).toLocaleDateString("vi-VN", { weekday: "long", timeZone: "Asia/Ho_Chi_Minh" })}
                                        </Text>
                                      </Group>
                                      <Group gap={6} wrap="wrap" className="ticket-ref__badges">
                                        <Badge color={soldOut ? "red" : canFit ? "green" : "orange"} variant="light" radius="sm" styles={{
                                          label: {
                                            fontSize: "var(--mantine-font-size-sm)",
                                            fontWeight: 500
                                          }
                                        }}>
                                          {soldOut ? "Hết chỗ" : `Còn ${item.availableSeats} ghế`}
                                        </Badge>

                                        {!canFit && !soldOut && (
                                          <Badge color="red" variant="light" radius="sm">
                                            Thiếu ghế cho nhóm {requiredSeatCount} người
                                          </Badge>
                                        )}
                                      </Group>
                                    </Stack>
                                    <Box className="ticket-ref__cta" aria-hidden="true">
                                      <Text span fw={500}>
                                        {isSelected ? "Đang chọn" : soldOut ? "Hết chỗ" : "Chọn chuyến"}
                                      </Text>
                                      {isSelected ? <IconArrowDown size={16} /> : <IconArrowRight size={16} />}
                                    </Box>
                                  </Box>
                                </Paper>
                                <Divider my="sm" />
                                {flight && loadingSeats && !allPassengersBooked && (
                                  <Center mih={240} role="status">
                                    <Stack align="center" gap="sm">
                                      <Loader size="md" />
                                      <Text c="dimmed" size="sm">Đang tải sơ đồ ghế…</Text>
                                    </Stack>
                                  </Center>
                                )}
                                {flight && flight.flightId === item.flightId && !loadingSeats && !allPassengersBooked && (
                                  <Stack gap="lg">

                                    {flights?.length > 1 && (
                                      <Flex justify="flex-end">
                                        <Button
                                          variant="light"
                                          color="gray"
                                          size="sm"
                                          onClick={() => {
                                            setFlight(null);
                                            setSeats([]);
                                            setPassengers([createPassenger()]);
                                            setActivePassengerIndex(0);
                                          }} disabled={submitting}>
                                          Đổi chuyến
                                        </Button>
                                      </Flex>
                                    )}
                                    {flight.availableSeats < requiredSeatCount && (
                                      <Alert
                                        color={suggestionError ? "red" : "orange"}
                                        variant="light"
                                        title="Chuyến này không đủ ghế cho nhóm"
                                      >
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
                                              onClick={() => void toggleChooseFlight(candidate)}
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
                                    <Paper className="booking-passenger-card" withBorder radius="lg" p={{ base: "md", sm: "lg" }}>

                                      <SectionThongTinKhachHang
                                        flight={flight}
                                        allPassengersBooked={allPassengersBooked}
                                        adultCount={adultCount}
                                        childCount={childCount}
                                        infantCount={infantCount}
                                        passengers={passengers}
                                        form={bookingForm}
                                      />

                                      <SectionBookingSeat
                                        passengers={passengers}
                                        seats={seats}
                                        adultCount={adultCount}
                                        availableSeats={availableSeats}
                                        onSelectedSeats={setPassengers}
                                      />
                                    </Paper>
                                  </Stack>
                                )}
                              </Stack>

                            );
                          })}
                        </Stack>


                      </Grid.Col>
                      <Grid.Col span={{ base: 12, md: 5 }}>
                        <Paper
                          className="booking-panel booking-seat-panel"
                          component="section"
                          withBorder
                          radius="lg"
                          p={{ base: "sm", sm: "md" }}
                          shadow="xs"
                          aria-labelledby="seat-passenger-title"
                        >
                          <Title order={2} size="lg" id="seat-passenger-title">Thông tin tìm kiếm</Title>

                          <Divider />
                          {searchForm.values && (
                            <Paper p="sm" withBorder>
                              <InfoRow label="Loại chuyến bay" value={type === "oneWay" ? "Một chiều" : "Khứ hồi"} />
                              <InfoRow label="Nơi đi" value={getName(airportOptions, searchForm.values?.origin)} />
                              <InfoRow label="Nơi đến" value={getName(airportOptions, searchForm.values?.destination)} />
                              <InfoRow label="Thời gian khởi hành" value={searchForm.values.date ? dateFormater(searchForm.values.date, "dd/MM/yyyy") : dateFormater(searchForm.values.month, "MM/yyyy")} />
                              <InfoRow label="Số lượng vé" value={
                                <Stack>

                                  {adultCount > 0 && (
                                    <Text fw={500}>
                                      {adultCount} người lớn
                                    </Text>
                                  )}

                                  {childCount > 0 && (
                                    <Text fw={500}>
                                      {childCount} trẻ em
                                    </Text>
                                  )}

                                  {infantCount > 0 && (
                                    <Text fw={500}>
                                      {infantCount} trẻ dưới 2 tuổi
                                    </Text>
                                  )}

                                </Stack>
                              }
                              />
                            </Paper>
                          )}

                          <Divider my="xs" variant="dashed" />

                          {flight && (
                            <Paper p="sm" withBorder bg="var(--mantine-color-teal-0)">
                              <Paper className="booking-flight-summary" p="md" radius="lg" withBorder>
                                <Group gap="md" align="center" wrap="nowrap">
                                  <ThemeIcon size={42} radius="md" color="blue" variant="light" style={{ flexShrink: 0 }}>
                                    <IconPlane size={23} />
                                  </ThemeIcon>
                                  <Stack gap={3} style={{ flex: 1, minWidth: 0 }}>
                                    <Group justify="space-between" >
                                      <Text fw={500}>
                                        {flight.flightNo}
                                      </Text>
                                      <Text fw={500}>
                                        {flight.origin} → {flight.destination}
                                      </Text>
                                    </Group>
                                    <Text c="dimmed" size="sm" lineClamp={2}>
                                      {flight.originCity} → {flight.destinationCity}
                                    </Text>
                                  </Stack>

                                </Group>
                              </Paper>
                              <InfoRow label="Ngày khởi hành" value={dateFormater(flight.departureTime, "dd/MM/yyyy")} />
                              <InfoRow label="Giờ cất cánh" value={dateFormater(flight.departureTime, "HH:mm")} />
                              <InfoRow label="Giờ hạ cánh" value={dateFormater(flight.arrivalTime, "HH:mm")} />
                              <Divider variant="dashed" />
                              {passengers?.map((passenger) => {
                                const booking = passenger.booking
                                if (!booking) return null;
                                return (

                                  <InfoRow label="Dịch vụ kèm theo" value={
                                    <Stack gap="xs">
                                      {booking.baggageKg && (

                                        <Text>
                                          Hành lý ký gửi: {booking.baggageKg} kg
                                        </Text>
                                      )}

                                      {booking.mealCode && (

                                        <Text>
                                          Suất ăn: {mealLabels[booking.mealCode] ?? "Suất ăn"}
                                        </Text>
                                      )}

                                    </Stack>
                                  }
                                  />
                                )
                              })}
                            </Paper>
                          )}

                        </Paper>
                      </Grid.Col>
                    </Grid>


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
                        {passengers.map((passenger, index) => {
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
