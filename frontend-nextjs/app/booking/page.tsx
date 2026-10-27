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
  IconExchange,
  IconArrowsExchange2,
  IconArrowDown,
} from "@tabler/icons-react";

import { DateInput, MonthPickerInput } from '@mantine/dates';
import 'dayjs/locale/vi';

import React, { useEffect, useRef, useState } from "react";
import { ApiError, apiGet, apiPost } from "../../lib/api";
import { type Flight, type Seat, type Booking, type BookingGroup, type CreateBookingGroup, type FlightBookingPassenger, type FlightBookingRequest, MOCK_DATA, MOCK_SEATS } from "../../types/booking";
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
import { numberToCurrency } from "@/components/utils/currency";


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

function getMockFlights(
  origin: string,
  destination: string,
  date: string | null,
  month: string | null,
  requiredSeats: number,
): Flight[]
{
  const routeTemplates = MOCK_DATA.filter(flight =>
    flight.origin === origin && flight.destination === destination);
  const templates = routeTemplates.length > 0 ? routeTemplates : MOCK_DATA;
  const city = (code: string) => airportOptions.find(airport => airport.value === code)?.label.replace(/\s\([A-Z]+\)$/, "") ?? code;
  const dates = date
    ? [date.slice(0, 10)]
    : month
      ? [10, 20, 28].map(day =>
      {
        const [year, selectedMonth] = month.slice(0, 7).split("-").map(Number);
        const lastDay = new Date(Date.UTC(year, selectedMonth, 0)).getUTCDate();
        return `${month.slice(0, 7)}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
      })
      : [];

  return Array.from({ length: Math.min(3, templates.length) }, (_, index) =>
  {
    const template = templates[index % templates.length];
    const departureDate = dates[index % dates.length] ?? template.departureTime.slice(0, 10);
    const departure = new Date(`${departureDate}T${String(14 + index * 3).padStart(2, "0")}:00:00+07:00`);
    const arrival = new Date(departure.getTime() + (90 + index * 20) * 60_000);
    return {
      ...template,
      flightId: template.flightId,
      flightNo: `DEMO-${template.airlineCode}${String(100 + index)}`,
      origin,
      destination,
      originCity: city(origin),
      destinationCity: city(destination),
      departureTime: departure.toISOString(),
      arrivalTime: arrival.toISOString(),
      status: "SCHEDULED",
      availableSeats: Math.max(template.availableSeats, requiredSeats),
      sufficientSeats: true,
    };
  });
}

export type PassengerDraft = FlightBookingPassenger;

const createPassenger = (passengerType: PassengerDraft["passengerType"] = "ADULT"): PassengerDraft => ({
  passengerType,
  passengerName: "",
  baggageKg: null,
  mealCode: "",
  baggageKgs: [null, null],
  mealCodes: ["", ""],
  infantName: "",
  seatIds: [],
  booking: null,
  bookings: [],
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

  const origin = get("origin") ?? "";
  const destination = get("destination") ?? "";
  const date = get("date") ?? null;
  const month = get("month") ?? null;

  const [type, setType] = useState<"oneWay" | "roundTrip">("oneWay")
  const [flights, setFlights] = useState<Flight[]>([]);
  const [returnFlights, setReturnFlights] = useState<Flight[]>([]);
  const [mockFlightIds, setMockFlightIds] = useState<Set<string>>(() => new Set());
  const [selectedFlightIds, setSelectedFlightIds] = useState<Set<string>>(() => new Set());
  const [activeLegIndex, setActiveLegIndex] = useState<0 | 1>(0);
  const [selectedFlights, setSelectedFlights] = useState<[Flight | null, Flight | null]>([null, null]);
  const flight = selectedFlights[activeLegIndex];
  const setFlight = (value: React.SetStateAction<Flight | null>) =>
  {
    setSelectedFlights(current =>
    {
      const next = [...current] as [Flight | null, Flight | null];
      next[activeLegIndex] = typeof value === "function" ? value(current[activeLegIndex]) : value;
      return next;
    });
  };
  const [seats, setSeats] = useState<Seat[]>([]);
  const [seatsByLeg, setSeatsByLeg] = useState<[Seat[], Seat[]]>([[], []]);
  const [adultCount, setAdultCount] = useState<number>(1);
  const [childCount, setChildCount] = useState<number>(0);
  const [infantCount, setInfantCount] = useState<number>(0);
  const [activePassengerIndex, setActivePassengerIndex] = useState(0);
  const [suggestedFlights, setSuggestedFlights] = useState<Flight[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestionError, setSuggestionError] = useState("");

  const [searching, setSearching] = useState(false);
  const [loadingSeats, setLoadingSeats] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [mockNotice, setMockNotice] = useState("");

  const seatRequest = useRef(0);
  const searchRequest = useRef(0);
  const submitLock = useRef(false);
  const initialSearchStarted = useRef(false);
  const bookingAttempt = useRef<{ fingerprint: string; requestId: string } | null>(null);

  const requiredSeatCount = adultCount + childCount;

  const [searchPeriod, setSearchPeriod] = useState<"day" | "month">(date ? "day" : "month");

  const searchForm = useForm<{
    origin: string | null;
    destination: string | null;
    date: string | null;
    month: string | null;
    returnDate: string | null;
    returnMonth: string | null;
  }>({
    initialValues: {
      origin: origin ?? null,
      destination: destination ?? null,
      date: date ?? null,
      month: month ?? null,
      returnDate: null,
      returnMonth: null,
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

  const passengers = bookingForm.values.passengers;

  const requiredLegCount = type === "roundTrip" ? 2 : 1;
  const selectedBookingFlights = selectedFlights.slice(0, requiredLegCount);
  const visibleFlights = activeLegIndex === 0
    ? flights
    : returnFlights.filter(candidate => !selectedFlights[0] ||
      new Date(candidate.departureTime) > new Date(selectedFlights[0].arrivalTime));
  const displayedOrigin = activeLegIndex === 0 ? searchForm.values.origin : searchForm.values.destination;
  const displayedDestination = activeLegIndex === 0 ? searchForm.values.destination : searchForm.values.origin;
  const displayedDate = activeLegIndex === 0
    ? searchPeriod === "day" ? searchForm.values.date : searchForm.values.month
    : searchPeriod === "day" ? searchForm.values.returnDate : searchForm.values.returnMonth;
  const passengerLegData = (passenger: PassengerDraft, legIndex: number) => ({
    baggageKg: passenger.baggageKgs?.[legIndex] ?? (legIndex === 0 ? passenger.baggageKg : null),
    mealCode: passenger.mealCodes?.[legIndex] ?? (legIndex === 0 ? passenger.mealCode : ""),
  });

  const allPassengersBooked = passengers.length > 0 && passengers.every(passenger => passenger.booking !== null);

  const confirmationPassengers = passengers.flatMap((passenger, index) =>
  {
    if (passenger.booking !== null) return [];
    const legs = Array.from({ length: requiredLegCount }, (_, legIndex) =>
    {
      const selectedFlight = selectedBookingFlights[legIndex];
      const seatId = passenger.seatIds[legIndex];
      const seat = seatsByLeg[legIndex].find(item => item.seatId === seatId);
      if (!selectedFlight || !seat) return null;
      const { baggageKg, mealCode } = passengerLegData(passenger, legIndex);
      const fare = passenger.passengerType === "CHILD"
        ? Math.round(selectedFlight.price * 0.75)
        : selectedFlight.price;
      const baggageFee = baggageKg === null ? 0 : selectedFlight.ancillaries?.baggage.find(item => item.kg === baggageKg)?.price ?? 0;
      const mealFee = selectedFlight.ancillaries?.meals.find(item => item.code === mealCode)?.price ?? 0;
      const cabinFee = cabinPrices[seat.cabinClass] ?? 0;
      const seatFee = seatPrice(seat.seatNo);
      return {
        flight: selectedFlight,
        seat,
        fare,
        cabinFee,
        seatFee,
        baggageKg,
        baggageFee,
        mealCode,
        mealFee,
        total: fare + cabinFee + seatFee + baggageFee + mealFee,
      };
    });
    if (legs.some(leg => leg === null)) return [];
    return [{ passenger, index, legs: legs.filter((leg): leg is NonNullable<typeof leg> => leg !== null), total: legs.reduce((total, leg) => total + (leg?.total ?? 0), 0) }];
  });
  const confirmationTotal = confirmationPassengers.reduce((total, passenger) => total + passenger.total, 0);

  function updatePartySize(adults: number, children: number, infants = Math.min(infantCount, adults))
  {
    setAdultCount(adults);
    setChildCount(children);
    setInfantCount(infants);
    bookingForm.setFieldValue("passengers", (current) => Array.from({ length: adults + children }, (_, index) =>
    {
      const passengerType: PassengerDraft["passengerType"] = index < adults ? "ADULT" : "CHILD";
      return {
        ...(current[index] ?? createPassenger(passengerType)),
        passengerType,
        seatIds: [],
        booking: null,
        bookings: [],
      };
    }));
    bookingForm.setFieldValue("flightIds", []);
    setActivePassengerIndex(0);
    setSelectedFlights([null, null]);
    setSelectedFlightIds(new Set());
    setMockFlightIds(new Set());
    setSeats([]);
    setSeatsByLeg([[], []]);
    setLoadingSeats(false);
    setSuggestedFlights([]);
    setSuggestionError("");
    setLoadingSuggestions(false);
    setError("");
    setMockNotice("");
    ++seatRequest.current;
  }


  const handleSearchFlights = React.useCallback(async (values: typeof searchForm.values) =>
  {
    if (!values.origin || !values.destination) {
      setError("Vui lòng chọn điểm khởi hành và điểm đến.");
      return;
    }
    if (searchPeriod === "day" ? !values.date : !values.month) {
      setError("Vui lòng chọn thời gian khởi hành.");
      return;
    }
    if (type === "roundTrip") {
      const returnFilter = searchPeriod === "day" ? values.returnDate : values.returnMonth;
      if (!returnFilter) {
        setError(searchPeriod === "day" ? "Vui lòng chọn ngày về." : "Vui lòng chọn tháng về để tìm ngày bay.");
        return;
      }
      if (searchPeriod === "day" && values.date && values.returnDate && values.returnDate < values.date) {
        setError("Ngày về không thể trước ngày đi.");
        return;
      }
      if (searchPeriod === "month" && values.month && values.returnMonth &&
        values.returnMonth.slice(0, 7) < values.month.slice(0, 7)) {
        setError("Tháng về không thể trước tháng đi.");
        return;
      }
    }

    const requestId = ++searchRequest.current;
    set({
      origin: values.origin,
      destination: values.destination,
      date: values.date || null,
      month: values.month || null,
      returnDate: values.returnDate || null,
      returnMonth: values.returnMonth || null,
    });

    setSearching(true);
    setLoadingSeats(false);
    setError("");
    setMockNotice("");
    setFlights([]);
    setReturnFlights([]);
    setMockFlightIds(new Set());
    setSelectedFlights([null, null]);
    setSeats([]);
    setSeatsByLeg([[], []]);
    setSelectedFlightIds(new Set());
    setActiveLegIndex(0);
    bookingForm.setFieldValue("flightIds", []);
    bookingForm.setFieldValue("requestId", crypto.randomUUID());
    bookingAttempt.current = null;

    bookingForm.setFieldValue("passengers", Array.from({ length: requiredSeatCount }, (_, index) => createPassenger(index < adultCount ? "ADULT" : "CHILD")));
    setActivePassengerIndex(0);
    setSuggestedFlights([]);
    setSuggestionError("");
    setLoadingSuggestions(false);

    try {
      const outboundRequest = {
        origin: values.origin,
        destination: values.destination,
        ...(searchPeriod === "day" && values.date
          ? { date: values.date.slice(0, 10) }
          : {}),
        ...(searchPeriod === "month" && values.month
          ? { month: values.month.slice(0, 7) }
          : {}),
        requiredSeats: requiredSeatCount,
      };
      const returnRequest = {
        origin: values.destination,
        destination: values.origin,
        ...(searchPeriod === "day" && values.returnDate
          ? { date: values.returnDate.slice(0, 10) }
          : {}),
        ...(searchPeriod === "month" && values.returnMonth
          ? { month: values.returnMonth.slice(0, 7) }
          : {}),
        requiredSeats: requiredSeatCount,
      };
      const requests = [
        { request: outboundRequest, origin: values.origin, destination: values.destination },
        ...(type === "roundTrip" ? [{ request: returnRequest, origin: values.destination, destination: values.origin }] : []),
      ];
      const results = await Promise.all(requests.map(async ({ request, origin, destination }) =>
      {
        try {
          const data = await __getTimChuyenBay(request);
          if (data.length > 0) return { flights: data, isMock: false };
          return {
            flights: getMockFlights(origin, destination, request.date ?? null, request.month ?? null, requiredSeatCount),
            isMock: true,
            reason: "Không tìm thấy chuyến phù hợp trong dữ liệu thực.",
          };
        } catch (requestError) {
          return {
            flights: getMockFlights(origin, destination, request.date ?? null, request.month ?? null, requiredSeatCount),
            isMock: true,
            reason: `Không thể tải dữ liệu thực (${errorText(requestError)}).`,
          };
        }
      }));
      if (requestId !== searchRequest.current) return;
      setFlights(results[0].flights);
      setReturnFlights(results[1]?.flights ?? []);
      setMockFlightIds(new Set(results.filter(result => result.isMock).flatMap(result => result.flights.map(item => item.flightId))));
      setMockNotice(results.some(result => result.isMock)
        ? `${results.filter(result => result.isMock).map(result => result.reason).join(" ")} Đang hiển thị chuyến bay mẫu; không thể đặt vé trong chế độ mẫu.`
        : "");

    } finally {
      if (requestId === searchRequest.current) setSearching(false);
    }
  }, [searchPeriod, type, requiredSeatCount, adultCount, set]);

  useEffect(() =>
  {
    if (initialSearchStarted.current) return;
    initialSearchStarted.current = true;
    if (origin && destination && (date || month)) void handleSearchFlights(searchForm.values);
  }, [handleSearchFlights])

  function switchActiveLeg(legIndex: 0 | 1)
  {
    if (legIndex === 1 && type !== "roundTrip") return;
    if (legIndex === 1 && !selectedFlights[0]) {
      setError("Chọn chuyến đi trước khi chọn chuyến về.");
      return;
    }
    ++seatRequest.current;
    setActiveLegIndex(legIndex);
    setSeats(seatsByLeg[legIndex]);
    setLoadingSeats(false);
    setActivePassengerIndex(0);
    setError("");
  }

  async function toggleChooseFlight(item: Flight)
  {
    const legIndex = activeLegIndex;
    const outbound = selectedFlights[0];
    if (legIndex === 1 && !outbound) {
      setError("Chọn chuyến đi trước khi chọn chuyến về.");
      return;
    }
    if (legIndex === 1 && outbound && new Date(item.departureTime) <= new Date(outbound.arrivalTime)) {
      setError("Chuyến về phải khởi hành sau khi chuyến đi đến nơi.");
      return;
    }
    const request = ++seatRequest.current;
    if (flight?.flightId === item.flightId) {

      setSelectedFlights(current =>
      {
        const next = [...current] as [Flight | null, Flight | null];
        next[legIndex] = null;
        if (legIndex === 0) next[1] = null;
        return next;
      });
      setSeats([]);
      setSeatsByLeg(current =>
      {
        const next = [...current] as [Seat[], Seat[]];
        next[legIndex] = [];
        if (legIndex === 0) next[1] = [];
        return next;
      });
      setSelectedFlightIds(current =>
      {
        const next = new Set(current);
        next.delete(item.flightId);
        if (legIndex === 0 && selectedFlights[1]) next.delete(selectedFlights[1]!.flightId);
        return next;
      });
      bookingForm.setFieldValue("passengers", (current) => current.map(passenger => ({
        ...passenger,
        seatIds: legIndex === 0 ? ["", ""] : passenger.seatIds.map((seatId, index) => index === legIndex ? "" : seatId),
      })));
      const currentFlights = selectedFlights.map((selected, index) => index === legIndex || (legIndex === 0 && index === 1) ? null : selected)
        .filter((selected): selected is Flight => selected !== null);
      bookingForm.setFieldValue("flightIds", currentFlights.map(selected => selected.flightId));
      setActivePassengerIndex(0);
      setError("");
      setSuggestedFlights([]);
      setSuggestionError("");
      setLoadingSeats(false);
      setLoadingSuggestions(false);
      return;
    }

    setSelectedFlights(current =>
    {
      const next = [...current] as [Flight | null, Flight | null];
      next[legIndex] = item;
      if (legIndex === 0) next[1] = null;
      return next;
    });
    setSelectedFlightIds(current =>
    {
      const next = new Set(current);
      if (legIndex === 0 && selectedFlights[1]) next.delete(selectedFlights[1]!.flightId);
      next.add(item.flightId);
      return next;
    });
    if (legIndex === 0) {
      setSeatsByLeg([[], []]);
    }
    const updatedFlights = [...selectedFlights] as [Flight | null, Flight | null];
    updatedFlights[legIndex] = item;
    if (legIndex === 0) updatedFlights[1] = null;
    bookingForm.setFieldValue("flightIds", updatedFlights.slice(0, requiredLegCount)
      .filter((selected): selected is Flight => selected !== null)
      .map(selected => selected.flightId));
    if (legIndex === 0) {
      bookingForm.setFieldValue("passengers", current => current.map(passenger => ({
        ...passenger,
        seatIds: ["", ""],
      })));
    }
    setFlight(item);
    setSeats([]);
    setSeatsByLeg(current =>
    {
      const next = [...current] as [Seat[], Seat[]];
      next[legIndex] = [];
      if (legIndex === 0) next[1] = [];
      return next;
    });
    bookingForm.setFieldValue("passengers", current => Array.from({ length: requiredSeatCount }, (_, index) => ({
      ...(current[index] ?? createPassenger(index < adultCount ? "ADULT" : "CHILD")),
      seatIds: legIndex === 0
        ? ["", ""]
        : current[index]?.seatIds.map((seatId, seatIndex) => seatIndex === legIndex ? "" : seatId) ?? ["", ""],
    })));
    setActivePassengerIndex(0);
    setError("");
    setSuggestedFlights([]);
    setSuggestionError("");
    setLoadingSeats(true);
    let currentAvailability = item.availableSeats;
    if (mockFlightIds.has(item.flightId)) {
      setSeats(MOCK_SEATS);
      setSeatsByLeg(current =>
      {
        const next = [...current] as [Seat[], Seat[]];
        next[legIndex] = MOCK_SEATS;
        return next;
      });
      setLoadingSeats(false);
      return;
    }
    try {
      const data = await apiGet<Seat[]>(`/api/flights/${item.flightId}/seats`);
      currentAvailability = data.filter(seat => seat.status === "AVAILABLE").length;
      if (request === seatRequest.current) {
        setSeats(data);
        setSeatsByLeg(current =>
        {
          const next = [...current] as [Seat[], Seat[]];
          next[legIndex] = data;
          return next;
        });
        setFlight(current => current?.flightId === item.flightId
          ? { ...current, availableSeats: currentAvailability, sufficientSeats: currentAvailability >= requiredSeatCount }
          : current);
      }
    } catch (err) {
      if (request === seatRequest.current) {
        setError(errorText(err));
        setSeats([]);
        setSeatsByLeg(current =>
        {
          const next = [...current] as [Seat[], Seat[]];
          next[legIndex] = [];
          return next;
        });
      }

    }
    finally {
      if (request === seatRequest.current)
        setLoadingSeats(false);
    }

    if (request !== seatRequest.current || currentAvailability >= requiredSeatCount) return;

    const departureTime = new Date(item.departureTime).getTime();

    const sameDayOptions = visibleFlights
      .filter(candidate => candidate.flightId !== item.flightId &&
        candidate.origin === item.origin && candidate.destination === item.destination &&
        candidate.availableSeats >= requiredSeatCount &&
        (legIndex === 0 || !outbound || new Date(candidate.departureTime) > new Date(outbound.arrivalTime)) &&
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

  async function handleSubmit()
  {
    if (selectedBookingFlights.some(selected => selected && mockFlightIds.has(selected.flightId))) {
      setError("Đây là chuyến bay mẫu. Vui lòng tìm lại khi dữ liệu thực khả dụng để đặt vé.");
      return;
    }
    if (submitLock.current || selectedBookingFlights.length !== requiredLegCount ||
      selectedBookingFlights.some(selected => !selected)) {
      setError(type === "roundTrip"
        ? "Vui lòng chọn cả chuyến đi và chuyến về trước khi xác nhận."
        : "Vui lòng chọn chuyến bay trước khi xác nhận.");
      return;
    }
    const selected = selectedBookingFlights as Flight[];
    if (type === "roundTrip" && new Date(selected[1].departureTime) <= new Date(selected[0].arrivalTime)) {
      setError("Chuyến về phải khởi hành sau khi chuyến đi đến nơi.");
      return;
    }
    if (!bookingForm.values.contactEmail.trim() ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bookingForm.values.contactEmail.trim())) {
      setError("Vui lòng nhập email liên hệ hợp lệ.");
      return;
    }
    if (passengers.some(passenger => !passenger.passengerName.trim())) {
      setError("Vui lòng nhập họ tên cho tất cả hành khách.");
      return;
    }
    if (confirmationPassengers.length !== passengers.filter(passenger => passenger.booking === null).length) {
      setError("Vui lòng chọn đủ một ghế cho mỗi hành khách trên từng chặng.");
      return;
    }
    if (confirmationPassengers.length === 0) return;

    submitLock.current = true;
    setSubmitting(true);
    setError("");
    try {
      const request: CreateBookingGroup = {
        flightIds: selected.map(item => item.flightId),
        contactEmail: bookingForm.values.contactEmail.trim(),
        passengers: passengers.map(passenger => ({
          passengerName: passenger.passengerName.trim(),
          passengerType: passenger.passengerType,
          infantName: passenger.infantName.trim() || null,
          seatIds: selected.map((_, legIndex) => passenger.seatIds[legIndex]),
          baggageKgs: selected.map((_, legIndex) => passengerLegData(passenger, legIndex).baggageKg),
          mealCodes: selected.map((_, legIndex) => passengerLegData(passenger, legIndex).mealCode || null),
        })),
        payment: {
          amount: confirmationTotal,
          currency: selected[0].currency,
        },
        requestId: bookingForm.values.requestId,
      };
      const fingerprint = JSON.stringify({
        flightIds: request.flightIds,
        contactEmail: request.contactEmail,
        passengers: request.passengers,
        payment: request.payment,
      });
      if (bookingAttempt.current && bookingAttempt.current.fingerprint !== fingerprint) {
        request.requestId = crypto.randomUUID();
      } else if (bookingAttempt.current) {
        request.requestId = bookingAttempt.current.requestId;
      }
      bookingAttempt.current = { fingerprint, requestId: request.requestId };
      bookingForm.setFieldValue("requestId", request.requestId);
      const group = await apiPost<BookingGroup>("/api/booking-groups", request);
      bookingForm.setFieldValue("flightIds", request.flightIds);
      bookingForm.setFieldValue("passengers", current => current.map((passenger, passengerIndex) =>
      {
        const tickets = selected.map((_, legIndex) =>
          group.tickets.filter(ticket => ticket.legNo === legIndex + 1)[passengerIndex]).filter((ticket): ticket is Booking => ticket !== undefined);
        return { ...passenger, booking: tickets[0] ?? null, bookings: tickets };
      }));
      setSeatsByLeg(current => current.map((legSeats, legIndex) =>
        legSeats.map(seat => group.tickets.some(ticket => ticket.legNo === legIndex + 1 && ticket.seatId === seat.seatId)
          ? { ...seat, status: "BOOKED" }
          : seat)) as [Seat[], Seat[]]);
      setSeats(current => current.map(seat => group.tickets.some(ticket => ticket.seatId === seat.seatId)
        ? { ...seat, status: "BOOKED" }
        : seat));
      setFlights(current => current.map(item => selected.some(chosen => chosen.flightId === item.flightId)
        ? { ...item, availableSeats: Math.max(0, item.availableSeats - passengers.length) }
        : item));
      setReturnFlights(current => current.map(item => selected.some(chosen => chosen.flightId === item.flightId)
        ? { ...item, availableSeats: Math.max(0, item.availableSeats - passengers.length) }
        : item));
    } catch (err) {
      setError(`${errorText(err)}${err instanceof ApiError && err.status < 500
        ? ""
        : " Chưa xác định giao dịch đã hoàn tất hay chưa; hãy thử lại với cùng yêu cầu."}`);
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

                  <Group className="booking-hero-pill" gap={7} wrap="nowrap">
                    <ThemeIcon color="teal" size={29} radius="md" variant="filled">
                      <IconCheck size={17} />
                    </ThemeIcon>
                    <Text>Lịch bay linh hoạt</Text>
                  </Group>

                  <Group className="booking-hero-pill" gap={7} wrap="nowrap">
                    <ThemeIcon color="blue" size={29} radius="md" variant="filled">
                      <IconCheck size={17} /></ThemeIcon>
                    <Text>Giá vé minh bạch</Text>
                  </Group>

                  <Group className="booking-hero-pill" gap={7} wrap="nowrap">
                    <ThemeIcon color="orange" size={29} radius="md" variant="filled">
                      <IconArmchair size={17} />
                    </ThemeIcon>
                    <Text>Tự chọn chỗ ngồi</Text>
                  </Group>

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
                  onChange={(value) =>
                  {
                    if (value === "oneWay" || value === "roundTrip") {
                      setType(value);
                      setSelectedFlights([null, null]);
                      setSelectedFlightIds(new Set());
                      bookingForm.setFieldValue("flightIds", []);
                      bookingForm.setFieldValue("passengers", current => current.map(passenger => ({
                        ...passenger,
                        seatIds: [],
                        booking: null,
                        bookings: [],
                      })));
                      setSeats([]);
                      setSeatsByLeg([[], []]);
                      setActiveLegIndex(0);
                    }
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
                      clearable={searchForm?.values.origin != null}
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
                      onClick={() =>
                      {
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
                      clearable={searchForm.values.destination != null}
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
                        onChange={(value) =>
                        {
                          if (value !== "day" && value !== "month") return;
                          setSearchPeriod(value);
                          searchForm.setFieldValue("date", null);
                          searchForm.setFieldValue("month", null);
                          searchForm.setFieldValue("returnDate", null);
                          searchForm.setFieldValue("returnMonth", null);
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
                  {type === "roundTrip" && (
                    <Box>
                      {searchPeriod === "day" ? (
                        <DateInput
                          label="Ngày về"
                          placeholder="Chọn ngày về"
                          {...searchForm.getInputProps("returnDate")}
                          disabled={submitting || searching}
                          leftSection={<IconCalendar size={19} />}
                          size="lg"
                          radius="md"
                          minDate={searchForm.values.date ? new Date(searchForm.values.date) : new Date()}
                          valueFormat="DD/MM/YYYY"
                          locale="vi"
                          clearable
                        />
                      ) : (
                        <>
                          <MonthPickerInput
                            label="Tháng về"
                            placeholder="Chọn tháng về"
                            {...searchForm.getInputProps("returnMonth")}
                            disabled={submitting || searching}
                            leftSection={<IconCalendar size={19} />}
                            size="lg"
                            radius="md"
                            minDate={new Date()}
                            valueFormat="MMMM YYYY"
                            locale="vi"
                            clearable
                          />
                          <Text size="xs" c="dimmed" mt={4}>
                            Chọn tháng, sau đó chọn chuyến bay đúng ngày về trong danh sách.
                          </Text>
                        </>
                      )}
                    </Box>
                  )}
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
                      decrease: () =>
                      {
                        const next = Math.max(adultCount - 1, Math.max(1, infantCount));
                        setAdultCount(next);
                        updatePartySize(next, childCount);
                      },
                      increase: () =>
                      {
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
                      decrease: () =>
                      {
                        const next = Math.max(childCount - 1, 0);
                        setChildCount(next);
                        updatePartySize(adultCount, next);
                      },
                      increase: () =>
                      {
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
                  ] as const).map((item) =>
                  {
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
                    <Text>
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
                    {`${adultCount + childCount + infantCount} hành khách`}
                  </Text>

                  <Text c="dimmed">
                    {type === "roundTrip"
                      ? searchPeriod === "day" ? "Chọn ngày đi và ngày về" : "Chọn tháng đi và tháng về, rồi chọn ngày qua chuyến bay"
                      : searchPeriod === "day" ? "Tìm theo ngày khởi hành" : "Tìm trong tháng khởi hành"}
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
                    (searchPeriod === "day" ? !searchForm.values.date : !searchForm.values.month) ||
                    (type === "roundTrip" && (searchPeriod === "day"
                      ? !searchForm.values.returnDate
                      : !searchForm.values.returnMonth))
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
          {mockNotice && (
            <Alert icon={<IconInfoCircle size={20} />} title="Đang dùng dữ liệu mẫu" color="yellow" variant="light" radius="md" role="status">
              {mockNotice}
            </Alert>
          )}
          <Stack gap="md" className="booking-content-grid">
            <Paper className="booking-panel booking-flight-panel" component="section" withBorder radius="lg" p={{ base: "md", sm: "lg" }} shadow="xs" aria-labelledby="flight-results-title">
              <Stack gap="md">
                {type === "roundTrip" && (
                  <SegmentedControl
                    fullWidth
                    aria-label="Chặng bay đang chọn"
                    value={String(activeLegIndex)}
                    disabled={submitting || searching || loadingSeats || loadingSuggestions}
                    onChange={value =>
                    {
                      if (value === "0") switchActiveLeg(0);
                      if (value === "1") switchActiveLeg(1);
                    }}
                    data={[
                      { label: `Chuyến đi${selectedFlights[0] ? ` · ${selectedFlights[0].flightNo}` : ""}`, value: "0" },
                      { label: `Chuyến về${selectedFlights[1] ? ` · ${selectedFlights[1].flightNo}` : ""}`, value: "1", disabled: !selectedFlights[0] },
                    ]}
                  />
                )}

                {(searching || visibleFlights.length === 0) && (
                  <Group justify="space-between" align="center">
                    <Title order={2} size="xl" id="flight-results-title">{activeLegIndex === 0 ? "Chuyến đi" : "Chuyến về"}</Title>
                    {!searching && <Badge color="gray" variant="light">{visibleFlights.length} chuyến</Badge>}
                  </Group>
                )}
                {searching ? (
                  <Center mih={180} role="status">
                    <Stack align="center" gap="sm">
                      <Loader size="md" />
                      <Text c="dimmed">Đang tải chuyến bay…</Text>
                    </Stack>
                  </Center>
                ) : visibleFlights.length === 0 ? (
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
                              Chuyến bay từ
                              <strong>{displayedOrigin || "nơi đi"}</strong>
                              đến
                              <strong>{displayedDestination || "nơi đến"}</strong>
                              trong
                              {searchPeriod === "day"
                                ? <>ngày <strong>{displayedDate ? dateFormater(displayedDate, "dd/MM/yyyy") : "đã chọn"}</strong></>
                                : <>tháng <strong>{displayedDate?.slice(0, 7) ?? "đã chọn"}</strong></>}
                              không có sẵn.
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


                          <Title order={2} size="xl" id="flight-results-title">{activeLegIndex === 0 ? "Chuyến đi" : "Chuyến về"}</Title>

                          <Badge color="gray" variant="light">{visibleFlights.length} chuyến</Badge>
                        </Group>

                        <Stack className="booking-flight-list" gap="sm">
                          {visibleFlights.map((item) =>
                          {
                            const isSelected = flight?.flightId === item.flightId;
                            const wasSelected = !isSelected && selectedFlightIds.has(item.flightId);
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
                                  disabled={submitting || searching || (activeLegIndex === 1 && !selectedFlights[0])}
                                  aria-pressed={isSelected}
                                  aria-label={`${item.flightNo}, ${item.origin} đến ${item.destination}, ${money(item.price)}. ${isSelected ? "Đang chọn." : wasSelected ? "Đã chọn trước đó." : soldOut ? "Hết chỗ" : `Còn ${item.availableSeats} ghế`}`}
                                  onClick={() =>
                                  {
                                    if (soldOut || (activeLegIndex === 1 && !selectedFlights[0])) return;
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
                                    {!soldOut && (

                                      <Box className="ticket-ref__cta" aria-hidden="true">
                                        <Text span fw={500}>
                                          {isSelected ? "Đang chọn" : wasSelected ? "Đã chọn" : "Chọn chuyến"}
                                        </Text>
                                        {isSelected
                                          ? <IconArrowDown size={16} />
                                          : wasSelected
                                            ? <IconCircleCheck size={16} />
                                            : <IconArrowRight size={16} />}
                                      </Box>
                                    )}
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


                                    <Flex justify="flex-end">

                                      <Button
                                        variant="light"
                                        color="gray"
                                        size="sm"
                                        onClick={() =>
                                        {
                                          setSelectedFlights(current =>
                                          {
                                            const next = [...current] as [Flight | null, Flight | null];
                                            next[activeLegIndex] = null;
                                            if (activeLegIndex === 0) next[1] = null;
                                            return next;
                                          });
                                          setSelectedFlightIds(current =>
                                          {
                                            const next = new Set(current);
                                            if (flight) next.delete(flight.flightId);
                                            if (activeLegIndex === 0 && selectedFlights[1]) next.delete(selectedFlights[1]!.flightId);
                                            return next;
                                          });
                                          setSeats([]);
                                          setSeatsByLeg(current =>
                                          {
                                            const next = [...current] as [Seat[], Seat[]];
                                            next[activeLegIndex] = [];
                                            if (activeLegIndex === 0) next[1] = [];
                                            return next;
                                          });
                                          bookingForm.setFieldValue("passengers", current => current.map(passenger => ({
                                            ...passenger,
                                            seatIds: activeLegIndex === 0
                                              ? ["", ""]
                                              : passenger.seatIds.map((seatId, index) => index === activeLegIndex ? "" : seatId),
                                          })));
                                          bookingForm.setFieldValue("flightIds", activeLegIndex === 0
                                            ? []
                                            : selectedFlights[0] ? [selectedFlights[0].flightId] : []);
                                          setActivePassengerIndex(0);
                                          setSuggestedFlights([]);
                                          setSuggestionError("");
                                          setLoadingSuggestions(false);
                                          setError("");
                                        }}
                                        disabled={submitting}
                                      >
                                        Đổi chuyến
                                      </Button>

                                    </Flex>

                                    {flight.availableSeats < requiredSeatCount && (

                                      <Alert
                                        color={suggestionError ? "red" : "orange"}
                                        variant="light"
                                        title="Chuyến này không đủ ghế cho nhóm"
                                      >
                                        <Stack gap="sm">
                                          <Text>
                                            Cần {requiredSeatCount} ghế cho {adultCount} người lớn và {childCount} trẻ em; chuyến hiện còn {flight.availableSeats} ghế.

                                            {infantCount > 0 ? ` ${infantCount} trẻ dưới 2 tuổi ngồi cùng người lớn, không cần ghế.` : ""}

                                          </Text>

                                          {loadingSuggestions && <Text>Đang tìm chuyến gần giờ hoặc ngày liền kề…</Text>}

                                          {suggestionError && <Text>{suggestionError}</Text>}

                                          {!loadingSuggestions && !suggestionError && suggestedFlights.length === 0 && (
                                            <Text>Không tìm thấy chuyến liền kề còn đủ ghế. Hãy đổi ngày hoặc giảm số hành khách.</Text>
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
                                        seats={seats}
                                        form={bookingForm}
                                        activeLegIndex={activeLegIndex}
                                        activeLegLabel={activeLegIndex === 0 ? "Chuyến đi" : "Chuyến về"}
                                      />

                                      <SectionBookingSeat
                                        passengers={passengers}
                                        seats={seats}
                                        adultCount={adultCount}
                                        activeLegIndex={activeLegIndex}
                                        availableSeats={availableSeats}
                                        onSelectedSeats={(passengerIndex, seatId) =>
                                        {
                                          bookingForm.setFieldValue("passengers", current =>
                                            current.map((passenger, index) => index === passengerIndex
                                              ? {
                                                ...passenger,
                                                seatIds: passenger.seatIds.map((currentSeatId, legIndex) =>
                                                  legIndex === activeLegIndex
                                                    ? currentSeatId === seatId ? "" : seatId
                                                    : currentSeatId),
                                              }
                                              : passenger));
                                        }}
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
                          {searchForm.values && (
                            <Paper p="sm" withBorder my="xs">
                              <InfoRow label="Loại chuyến bay" value={type === "oneWay" ? "Một chiều" : "Khứ hồi"} />
                              <InfoRow label="Nơi đi" value={getName(airportOptions, displayedOrigin)} />
                              <InfoRow label="Nơi đến" value={getName(airportOptions, displayedDestination)} />
                              <InfoRow
                                label={activeLegIndex === 0 ? "Thời gian đi" : "Thời gian về"}
                                value={searchPeriod === "day"
                                  ? dateFormater(displayedDate, "dd/MM/yyyy")
                                  : dateFormater(displayedDate, "MM/yyyy")}
                              />
                              {type === "roundTrip" && (
                                <InfoRow
                                  label="Thời gian về"
                                  value={searchForm.values.returnDate
                                    ? dateFormater(searchForm.values.returnDate, "dd/MM/yyyy")
                                    : dateFormater(searchForm.values.returnMonth, "MM/yyyy")}
                                />
                              )}
                              <InfoRow label="Số lượng vé"
                                last
                                labelProps={{
                                  color: "dark"
                                }}
                                value={
                                  <Stack>

                                    {adultCount > 0 && (
                                      <Text fw={500} c="green">
                                        {adultCount} người lớn
                                      </Text>
                                    )}

                                    {childCount > 0 && (
                                      <Text fw={500} c="teal">
                                        {childCount} trẻ em
                                      </Text>
                                    )}

                                    {infantCount > 0 && (
                                      <Text fw={500} c="orange">
                                        {infantCount} trẻ dưới 2 tuổi
                                      </Text>
                                    )}

                                  </Stack>
                                }
                              />
                            </Paper>
                          )}

                          <Divider my="xs" variant="dashed" />

                          {selectedBookingFlights.map((summaryFlight, legIndex) => summaryFlight && (
                            <React.Fragment key={`booking-${legIndex}`}>
                              <Title order={2} size="lg" id="seat-passenger-title" my="xs">Thông tin đặt vé</Title>
                              <Paper key={summaryFlight.flightId} p="sm" withBorder bg="var(--mantine-color-teal-0)" mb="sm">
                                <Paper className="booking-flight-summary" p="md" radius="lg" withBorder>
                                  <Group gap="md" align="center" wrap="nowrap">
                                    <ThemeIcon size={42} radius="md" color="blue" variant="light" style={{ flexShrink: 0 }}>
                                      <IconPlane size={23} />
                                    </ThemeIcon>
                                    <Stack gap={3} style={{ flex: 1, minWidth: 0 }}>
                                      <Group justify="space-between">
                                        <Stack gap={0}>
                                          <Text fw={600} className="ticket-ref__brand" title={summaryFlight.airlineName}>
                                            {legIndex === 0 ? "Chuyến đi" : "Chuyến về"} · {summaryFlight.airlineName}
                                          </Text>
                                          <Text fw={500}>{summaryFlight.flightNo}</Text>
                                        </Stack>
                                        <Text fw={500}>{summaryFlight.origin} → {summaryFlight.destination}</Text>
                                      </Group>
                                      <Text c="dimmed" size="sm" lineClamp={2}>
                                        {summaryFlight.originCity} → {summaryFlight.destinationCity} · {dateFormat(summaryFlight.departureTime, "dd/MM/yyyy")}
                                      </Text>
                                    </Stack>
                                  </Group>
                                </Paper>
                              </Paper>
                            </React.Fragment>
                          ))}

                          {confirmationPassengers.map(({ passenger, index, legs, total }) =>
                          {
                            const isChild = passenger.passengerType === "CHILD";

                            const formatMoney = (amount: number, currency = "VND") =>
                              `${numberToCurrency(amount, currency, false)} ${currency}`;

                            const moneyRow = (
                              label: string,
                              amount: number,
                              currency: string,
                              type: "fare" | "surcharge" | "service" = "service"
                            ) =>
                            {
                              const color =
                                type === "fare"
                                  ? "var(--mantine-color-blue-7)"
                                  : type === "surcharge"
                                    ? "var(--mantine-color-orange-7)"
                                    : "var(--mantine-color-text)";

                              return (
                                <Group
                                  key={label}
                                  gap="md"
                                  wrap="nowrap"
                                  align="flex-start"
                                >
                                  <Text
                                    size="sm"
                                    c="dimmed"
                                    style={{ flex: 1, minWidth: 0 }}
                                  >
                                    {label}
                                  </Text>

                                  <Text
                                    size="sm"
                                    fw={type === "fare" ? 700 : 600}
                                    c={color}
                                    ta="right"
                                    style={{
                                      whiteSpace: "nowrap",
                                      fontVariantNumeric: "tabular-nums",
                                    }}
                                  >
                                    {type !== "fare" && amount > 0 ? "+ " : ""}
                                    {formatMoney(amount, currency)}
                                  </Text>
                                </Group>
                              );
                            };

                            return (
                              <Paper
                                key={`review-${index}`}
                                withBorder
                                radius="lg"
                                p={{ base: "md", sm: "lg" }}
                              >
                                <Stack gap="md">
                                  {/* THÔNG TIN HÀNH KHÁCH */}
                                  <Group gap="sm" wrap="nowrap">
                                    <ThemeIcon
                                      size={42}
                                      radius="md"
                                      color="gray"
                                      variant="light"
                                    >
                                      <IconUser size={22} />
                                    </ThemeIcon>

                                    <Box style={{ flex: 1, minWidth: 0 }}>
                                      <Text fw={700} fz="md">
                                        {passenger.passengerName}
                                      </Text>
                                      <Text c="dimmed" size="sm">
                                        {isChild ? "Trẻ em" : "Người lớn"}
                                        {" · "}
                                        Hành khách {index + 1}
                                      </Text>
                                    </Box>

                                    <Badge variant="light" color="gray" size="md">
                                      {legs.length} chuyến
                                    </Badge>
                                  </Group>

                                  {/* CHI TIẾT THEO TỪNG CHUYẾN */}
                                  {legs.map((leg, legIndex) =>
                                  {
                                    const currency = leg.flight.currency;

                                    const extraFees =
                                      leg.cabinFee +
                                      leg.seatFee +
                                      leg.baggageFee +
                                      leg.mealFee;

                                    const legTotal = leg.fare + extraFees;

                                    return (
                                      <Paper
                                        key={`${index}-${leg.flight.flightId}`}
                                        withBorder
                                        radius="md"
                                        p="md"
                                        bg="var(--mantine-color-default-hover)"
                                      >
                                        <Stack gap="md">
                                          {/* HEADER CHUYẾN BAY */}
                                          <Group gap="sm" align="center">
                                            <ThemeIcon
                                              size={36}
                                              radius="md"
                                              variant="light"
                                              color="gray"
                                            >
                                              {legIndex === 0 ? (
                                                <IconPlaneDeparture size={19} />
                                              ) : (
                                                <IconPlaneArrival size={19} />
                                              )}
                                            </ThemeIcon>

                                            <Box style={{ flex: 1, minWidth: 0 }}>
                                              <Text fw={700} fz="sm">
                                                {legIndex === 0
                                                  ? "Chuyến đi"
                                                  : "Chuyến về"}
                                                {" · "}
                                                {leg.flight.flightNo}
                                              </Text>

                                              <Text size="sm" c="dimmed">
                                                {leg.flight.origin}
                                                {" → "}
                                                {leg.flight.destination}
                                                {" · "}
                                                Ghế {leg.seat.seatNo}
                                              </Text>
                                            </Box>

                                            <Badge
                                              variant="outline"
                                              color="gray"
                                              size="sm"
                                            >
                                              {cabinLabels[leg.seat.cabinClass] ??
                                                leg.seat.cabinClass}
                                            </Badge>
                                          </Group>

                                          <Divider color="gray.3" />

                                          {/* GIÁ VÉ CƠ BẢN */}
                                          <Stack gap="xs">
                                            <Group gap="xs">
                                              <IconTicket size={17} color="#3979b5" />
                                              <Text fw={700} size="sm">
                                                Giá vé
                                              </Text>
                                            </Group>

                                            {moneyRow(
                                              "Giá vé cơ bản",
                                              leg.fare,
                                              currency,
                                              "fare"
                                            )}
                                          </Stack>

                                          {/* PHỤ THU */}
                                          {(leg.cabinFee > 0 || leg.seatFee > 0) && (
                                            <>
                                              <Divider color="gray.2" />

                                              <Stack gap="xs">
                                                <Group gap="xs">
                                                  <IconArmchair size={17} color="#c77d30" />
                                                  <Text fw={700} size="sm">
                                                    Phụ thu ghế
                                                  </Text>
                                                </Group>

                                                {leg.cabinFee > 0 &&
                                                  moneyRow(
                                                    `Hạng ${cabinLabels[
                                                    leg.seat.cabinClass
                                                    ] ?? leg.seat.cabinClass
                                                    }`,
                                                    leg.cabinFee,
                                                    currency,
                                                    "surcharge"
                                                  )}

                                                {leg.seatFee > 0 &&
                                                  moneyRow(
                                                    `Vị trí ghế ${leg.seat.seatNo}`,
                                                    leg.seatFee,
                                                    currency,
                                                    "surcharge"
                                                  )}
                                              </Stack>
                                            </>
                                          )}

                                          {/* DỊCH VỤ ĐI KÈM */}
                                          <Divider color="gray.2" />

                                          <Stack gap="xs">
                                            <Group gap="xs">
                                              <IconBriefcase size={17} />
                                              <Text fw={700} size="sm">
                                                Dịch vụ đi kèm
                                              </Text>
                                            </Group>

                                            {moneyRow(
                                              leg.baggageKg
                                                ? `Hành lý ký gửi · ${leg.baggageKg} kg`
                                                : "Hành lý · Không mua",
                                              leg.baggageFee,
                                              currency
                                            )}

                                            {moneyRow(
                                              leg.mealCode
                                                ? `Suất ăn · ${mealLabels[leg.mealCode] ??
                                                leg.mealCode
                                                }`
                                                : "Suất ăn · Không chọn",
                                              leg.mealFee,
                                              currency
                                            )}
                                          </Stack>

                                          {/* TẠM TÍNH CHUYẾN BAY */}
                                          <Paper
                                            radius="md"
                                            p="sm"
                                            bg="var(--mantine-color-body)"
                                            withBorder
                                          >
                                            <Group gap="md" wrap="nowrap">
                                              <Text
                                                fw={600}
                                                size="sm"
                                                style={{ flex: 1 }}
                                              >
                                                Tạm tính chuyến bay
                                              </Text>

                                              <Text
                                                fw={750}
                                                fz="md"
                                                style={{
                                                  whiteSpace: "nowrap",
                                                  fontVariantNumeric: "tabular-nums",
                                                }}
                                              >
                                                {formatMoney(legTotal, currency)}
                                              </Text>
                                            </Group>
                                          </Paper>
                                        </Stack>
                                      </Paper>
                                    );
                                  })}

                                  {/* TỔNG TIỀN HÀNH KHÁCH */}
                                  <Paper
                                    radius="md"
                                    p="md"
                                    style={{
                                      background: "rgba(48, 120, 189, 0.07)",
                                      border: "1px solid rgba(48, 120, 189, 0.16)",
                                    }}
                                  >
                                    <Group
                                      gap="md"
                                      align="center"
                                      wrap="wrap"
                                    >
                                      <Box style={{ flex: 1, minWidth: 150 }}>
                                        <Text fw={700} fz="sm">
                                          Tổng tiền hành khách {index + 1}
                                        </Text>

                                        <Text c="dimmed" fz="sm">
                                          Đã bao gồm vé và dịch vụ
                                        </Text>
                                      </Box>

                                      <Text
                                        fz="xl"
                                        fw={800}
                                        c="var(--mantine-color-blue-8)"
                                        style={{
                                          whiteSpace: "nowrap",
                                          fontVariantNumeric: "tabular-nums",
                                        }}
                                      >
                                        {formatMoney(
                                          total,
                                          selectedBookingFlights[0]?.currency ?? "VND"
                                        )}
                                      </Text>
                                    </Group>
                                  </Paper>
                                </Stack>
                              </Paper>
                            );
                          })}

                          <Paper>
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
                                  {passengers[0]?.booking?.groupCode && (
                                    <Badge color="blue" variant="light" size="lg">
                                      Mã đặt chỗ chung · {passengers[0].booking.groupCode}
                                    </Badge>
                                  )}
                                  {infantCount > 0 && (
                                    <Text c="dimmed" ta="center">
                                      Còn {infantCount} trẻ dưới 2 tuổi đi cùng người lớn · không cần ghế, miễn phí.
                                    </Text>
                                  )}
                                </Stack>
                                {bookingForm.values.passengers?.map((passenger, index) =>
                                {
                                  const booking = passenger.booking;
                                  if (!booking) return null;
                                  const tickets = passenger.bookings?.length ? passenger.bookings : [booking];
                                  return tickets.map(ticket => (
                                    <Paper key={ticket.bookingId} className="booking-confirmed-ticket" withBorder radius="lg" p="lg" w="100%">
                                      <Stack gap="sm">
                                        <Group justify="space-between" align="center" wrap="wrap">
                                          <Text fw={700}>{booking.passengerName}</Text>
                                          <Badge color={passenger.passengerType === "CHILD" ? "blue" : "teal"} variant="light">
                                            {passenger.passengerType === "CHILD" ? "Trẻ em · 75%" : "Người lớn"}
                                          </Badge>
                                          <Badge color="teal" variant="light" size="lg">{booking.status}</Badge>
                                        </Group>
                                        <Group gap="xs" justify="space-between" wrap="wrap">
                                          <Text>
                                            {ticket.legNo === 2 ? "Chuyến về" : ticket.legNo === 1 ? "Chuyến đi" : "Chuyến bay"} · {ticket.flightNo} · Ghế {ticket.seatNo}
                                          </Text>
                                          <Badge color="blue" variant="light">
                                            {cabinLabels[ticket.cabinClass] ?? ticket.cabinClass}
                                          </Badge>
                                        </Group>
                                        <Group justify="space-between" align="center" wrap="wrap">
                                          <Text c="dimmed">Mã vé · {ticket.bookingCode}</Text>
                                          <Text fw={700} c="blue.7" size="lg">{money(ticket.amount)}</Text>
                                        </Group>
                                        <Group justify="space-between" align="center" wrap="wrap">
                                          <Group gap="xs">
                                            <Badge color="blue" variant="light">
                                              Phụ thu hạng {money(ticket.cabinFee)}
                                            </Badge>
                                            <Badge color={ticket.seatFee > 0 ? "orange" : "teal"} variant="light">
                                              {ticket.seatFee > 0 ? `Phụ thu ghế ${money(ticket.seatFee)}` : "Ghế tiêu chuẩn"}
                                            </Badge>
                                            {ticket.baggageKg && <Badge color="blue" variant="light">Hành lý {ticket.baggageKg} kg</Badge>}
                                            {ticket.mealCode && <Badge color="grape" variant="light">{mealLabels[ticket.mealCode] ?? "Suất ăn"}</Badge>}
                                          </Group>
                                          <Button component={Link} href={`/bookings/${ticket.bookingId}`} size="xs" variant="subtle" rightSection={<IconArrowRight size={14} />}>
                                            Chi tiết vé
                                          </Button>
                                        </Group>
                                      </Stack>
                                    </Paper>
                                  ));
                                })}
                              </Stack>
                            )}
                          </Paper>
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

export default function BookingPage()
{
  return (
    <React.Suspense fallback={null}>
      <BookingPageContent />
    </React.Suspense>
  );
}
