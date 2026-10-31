export const MOCK_DATA: Flight[] = [
  {
    flightId: "361a7b86-6241-3b11-a33f-62889da04048",
    flightNo: "VN102",
    origin: "SGN",
    destination: "DAD",
    originCity: "TP. Hồ Chí Minh",
    destinationCity: "Đà Nẵng",
    departureTime: "2026-11-15T07:00:00Z",
    arrivalTime: "2026-11-15T08:30:00Z",
    status: "SCHEDULED",
    availableSeats: 36,
    price: 1500000,
    currency: "VND",
    sufficientSeats: true,
    airlineCode: "VN",
    airlineName: "Vietnam Airlines",
    cabins: [
      {
        cabinClass: "ECONOMY",
        totalSeats: 12,
        availableSeats: 12,
        surcharge: 0,
        adultFare: 1500000,
        childFare: 1125000,
      },
      {
        cabinClass: "PREMIUM_ECONOMY",
        totalSeats: 12,
        availableSeats: 12,
        surcharge: 500000,
        adultFare: 2000000,
        childFare: 1625000,
      },
      {
        cabinClass: "BUSINESS",
        totalSeats: 12,
        availableSeats: 12,
        surcharge: 1000000,
        adultFare: 2500000,
        childFare: 2125000,
      },
    ],
    passengerFares: [
      {
        passengerType: "ADULT",
        baseFare: 1500000,
        requiresSeat: true,
        bookable: true,
      },
      {
        passengerType: "CHILD",
        baseFare: 1125000,
        requiresSeat: true,
        bookable: true,
      },
      {
        passengerType: "INFANT",
        baseFare: 0,
        requiresSeat: false,
        bookable: false,
      },
    ],
    ancillaries: {
      baggage: [
        { kg: 15, price: 150000 },
        { kg: 20, price: 200000 },
        { kg: 25, price: 300000 },
      ],
      meals: [
        { code: "SANDWICH", price: 60000 },
        { code: "VEGETARIAN", price: 75000 },
        { code: "CHICKEN", price: 90000 },
      ],
      seatFees: [
        { rule: "Hàng 01", price: 100000 },
        { rule: "Ghế A/F hàng khác", price: 50000 },
        { rule: "Ghế còn lại", price: 0 },
      ],
    },
  },
  {
    flightId: "9b99d142-a919-4e93-b10c-cf3a3651ef02",
    flightNo: "VJ205",
    origin: "SGN",
    destination: "HAN",
    originCity: "TP. Hồ Chí Minh",
    destinationCity: "Hà Nội",
    departureTime: "2026-11-15T09:15:00Z",
    arrivalTime: "2026-11-15T11:25:00Z",
    status: "SCHEDULED",
    availableSeats: 18,
    price: 1250000,
    currency: "VND",
    sufficientSeats: true,
    airlineCode: "VJ",
    airlineName: "VietJet Air",
    cabins: [
      {
        cabinClass: "ECONOMY",
        totalSeats: 24,
        availableSeats: 10,
        surcharge: 0,
        adultFare: 1250000,
        childFare: 937500,
      },
      {
        cabinClass: "BUSINESS",
        totalSeats: 12,
        availableSeats: 8,
        surcharge: 900000,
        adultFare: 2150000,
        childFare: 1837500,
      },
    ],
    passengerFares: [
      {
        passengerType: "ADULT",
        baseFare: 1250000,
        requiresSeat: true,
        bookable: true,
      },
      {
        passengerType: "CHILD",
        baseFare: 937500,
        requiresSeat: true,
        bookable: true,
      },
      {
        passengerType: "INFANT",
        baseFare: 0,
        requiresSeat: false,
        bookable: false,
      },
    ],
    ancillaries: {
      baggage: [
        { kg: 15, price: 180000 },
        { kg: 20, price: 250000 },
        { kg: 25, price: 350000 },
      ],
      meals: [
        { code: "SANDWICH", price: 55000 },
        { code: "VEGETARIAN", price: 70000 },
        { code: "CHICKEN", price: 85000 },
      ],
      seatFees: [
        { rule: "Hàng 01", price: 120000 },
        { rule: "Ghế A/F hàng khác", price: 60000 },
        { rule: "Ghế còn lại", price: 0 },
      ],
    },
  },
  {
    flightId: "fa1d7421-b73b-4453-9c2e-86b941bf2303",
    flightNo: "QH306",
    origin: "DAD",
    destination: "HAN",
    originCity: "Đà Nẵng",
    destinationCity: "Hà Nội",
    departureTime: "2026-11-16T03:30:00Z",
    arrivalTime: "2026-11-16T04:50:00Z",
    status: "SCHEDULED",
    availableSeats: 8,
    price: 980000,
    currency: "VND",
    sufficientSeats: true,
    airlineCode: "QH",
    airlineName: "Bamboo Airways",
    cabins: [
      {
        cabinClass: "ECONOMY",
        totalSeats: 24,
        availableSeats: 5,
        surcharge: 0,
        adultFare: 980000,
        childFare: 735000,
      },
      {
        cabinClass: "BUSINESS",
        totalSeats: 12,
        availableSeats: 3,
        surcharge: 850000,
        adultFare: 1830000,
        childFare: 1585000,
      },
    ],
    passengerFares: [
      {
        passengerType: "ADULT",
        baseFare: 980000,
        requiresSeat: true,
        bookable: true,
      },
      {
        passengerType: "CHILD",
        baseFare: 735000,
        requiresSeat: true,
        bookable: true,
      },
      {
        passengerType: "INFANT",
        baseFare: 0,
        requiresSeat: false,
        bookable: false,
      },
    ],
    ancillaries: {
      baggage: [
        { kg: 15, price: 150000 },
        { kg: 20, price: 220000 },
      ],
      meals: [
        { code: "SANDWICH", price: 60000 },
        { code: "CHICKEN", price: 80000 },
      ],
      seatFees: [
        { rule: "Hàng 01", price: 100000 },
        { rule: "Ghế A/F hàng khác", price: 50000 },
        { rule: "Ghế còn lại", price: 0 },
      ],
    },
  },
  {
    flightId: "67c4b118-7fc1-4c52-9b69-3a1871cbdb04",
    flightNo: "VN407",
    origin: "HAN",
    destination: "SGN",
    originCity: "Hà Nội",
    destinationCity: "TP. Hồ Chí Minh",
    departureTime: "2026-11-17T01:00:00Z",
    arrivalTime: "2026-11-17T03:10:00Z",
    status: "DELAYED",
    availableSeats: 4,
    price: 1850000,
    currency: "VND",
    sufficientSeats: true,
    airlineCode: "VN",
    airlineName: "Vietnam Airlines",
    cabins: [
      {
        cabinClass: "ECONOMY",
        totalSeats: 24,
        availableSeats: 2,
        surcharge: 0,
        adultFare: 1850000,
        childFare: 1387500,
      },
      {
        cabinClass: "BUSINESS",
        totalSeats: 12,
        availableSeats: 2,
        surcharge: 1200000,
        adultFare: 3050000,
        childFare: 2587500,
      },
    ],
    passengerFares: [
      {
        passengerType: "ADULT",
        baseFare: 1850000,
        requiresSeat: true,
        bookable: true,
      },
      {
        passengerType: "CHILD",
        baseFare: 1387500,
        requiresSeat: true,
        bookable: true,
      },
      {
        passengerType: "INFANT",
        baseFare: 0,
        requiresSeat: false,
        bookable: false,
      },
    ],
    ancillaries: {
      baggage: [
        { kg: 15, price: 150000 },
        { kg: 20, price: 200000 },
        { kg: 25, price: 300000 },
      ],
      meals: [
        { code: "SANDWICH", price: 60000 },
        { code: "VEGETARIAN", price: 75000 },
        { code: "CHICKEN", price: 90000 },
      ],
      seatFees: [
        { rule: "Hàng 01", price: 100000 },
        { rule: "Ghế A/F hàng khác", price: 50000 },
        { rule: "Ghế còn lại", price: 0 },
      ],
    },
  },
  {
    flightId: "d2c74190-90aa-4c2b-a5b1-ec891d795e05",
    flightNo: "VJ508",
    origin: "DAD",
    destination: "SGN",
    originCity: "Đà Nẵng",
    destinationCity: "TP. Hồ Chí Minh",
    departureTime: "2026-11-18T11:00:00Z",
    arrivalTime: "2026-11-18T12:30:00Z",
    status: "SCHEDULED",
    availableSeats: 0,
    price: 1100000,
    currency: "VND",
    sufficientSeats: false,
    airlineCode: "VJ",
    airlineName: "VietJet Air",
    cabins: [
      {
        cabinClass: "ECONOMY",
        totalSeats: 24,
        availableSeats: 0,
        surcharge: 0,
        adultFare: 1100000,
        childFare: 825000,
      },
      {
        cabinClass: "BUSINESS",
        totalSeats: 12,
        availableSeats: 0,
        surcharge: 950000,
        adultFare: 2050000,
        childFare: 1775000,
      },
    ],
    passengerFares: [
      {
        passengerType: "ADULT",
        baseFare: 1100000,
        requiresSeat: true,
        bookable: true,
      },
      {
        passengerType: "CHILD",
        baseFare: 825000,
        requiresSeat: true,
        bookable: true,
      },
      {
        passengerType: "INFANT",
        baseFare: 0,
        requiresSeat: false,
        bookable: false,
      },
    ],
    ancillaries: {
      baggage: [
        { kg: 15, price: 180000 },
        { kg: 20, price: 250000 },
      ],
      meals: [
        { code: "SANDWICH", price: 55000 },
        { code: "CHICKEN", price: 85000 },
      ],
      seatFees: [
        { rule: "Hàng 01", price: 120000 },
        { rule: "Ghế A/F hàng khác", price: 60000 },
        { rule: "Ghế còn lại", price: 0 },
      ],
    },
  },
];


export const MOCK_SEATS: Seat[] = [
  // BUSINESS - Hàng 01-02
  { seatId: "seat-001", seatNo: "1A", cabinClass: "BUSINESS", status: "AVAILABLE" },
  { seatId: "seat-002", seatNo: "1B", cabinClass: "BUSINESS", status: "BOOKED" },
  { seatId: "seat-003", seatNo: "1C", cabinClass: "BUSINESS", status: "AVAILABLE" },
  { seatId: "seat-004", seatNo: "1D", cabinClass: "BUSINESS", status: "AVAILABLE" },
  { seatId: "seat-005", seatNo: "1E", cabinClass: "BUSINESS", status: "HELD" },
  { seatId: "seat-006", seatNo: "1F", cabinClass: "BUSINESS", status: "AVAILABLE" },

  { seatId: "seat-007", seatNo: "2A", cabinClass: "BUSINESS", status: "AVAILABLE" },
  { seatId: "seat-008", seatNo: "2B", cabinClass: "BUSINESS", status: "AVAILABLE" },
  { seatId: "seat-009", seatNo: "2C", cabinClass: "BUSINESS", status: "BOOKED" },
  { seatId: "seat-010", seatNo: "2D", cabinClass: "BUSINESS", status: "AVAILABLE" },
  { seatId: "seat-011", seatNo: "2E", cabinClass: "BUSINESS", status: "AVAILABLE" },
  { seatId: "seat-012", seatNo: "2F", cabinClass: "BUSINESS", status: "AVAILABLE" },

  // PREMIUM ECONOMY - Hàng 03-04
  { seatId: "seat-013", seatNo: "3A", cabinClass: "PREMIUM_ECONOMY", status: "AVAILABLE" },
  { seatId: "seat-014", seatNo: "3B", cabinClass: "PREMIUM_ECONOMY", status: "AVAILABLE" },
  { seatId: "seat-015", seatNo: "3C", cabinClass: "PREMIUM_ECONOMY", status: "BOOKED" },
  { seatId: "seat-016", seatNo: "3D", cabinClass: "PREMIUM_ECONOMY", status: "AVAILABLE" },
  { seatId: "seat-017", seatNo: "3E", cabinClass: "PREMIUM_ECONOMY", status: "AVAILABLE" },
  { seatId: "seat-018", seatNo: "3F", cabinClass: "PREMIUM_ECONOMY", status: "AVAILABLE" },

  { seatId: "seat-019", seatNo: "4A", cabinClass: "PREMIUM_ECONOMY", status: "HELD" },
  { seatId: "seat-020", seatNo: "4B", cabinClass: "PREMIUM_ECONOMY", status: "AVAILABLE" },
  { seatId: "seat-021", seatNo: "4C", cabinClass: "PREMIUM_ECONOMY", status: "AVAILABLE" },
  { seatId: "seat-022", seatNo: "4D", cabinClass: "PREMIUM_ECONOMY", status: "BOOKED" },
  { seatId: "seat-023", seatNo: "4E", cabinClass: "PREMIUM_ECONOMY", status: "AVAILABLE" },
  { seatId: "seat-024", seatNo: "4F", cabinClass: "PREMIUM_ECONOMY", status: "AVAILABLE" },

  // ECONOMY - Hàng 05-06
  { seatId: "seat-025", seatNo: "5A", cabinClass: "ECONOMY", status: "AVAILABLE" },
  { seatId: "seat-026", seatNo: "5B", cabinClass: "ECONOMY", status: "BOOKED" },
  { seatId: "seat-027", seatNo: "5C", cabinClass: "ECONOMY", status: "AVAILABLE" },
  { seatId: "seat-028", seatNo: "5D", cabinClass: "ECONOMY", status: "AVAILABLE" },
  { seatId: "seat-029", seatNo: "5E", cabinClass: "ECONOMY", status: "AVAILABLE" },
  { seatId: "seat-030", seatNo: "5F", cabinClass: "ECONOMY", status: "BOOKED" },

  { seatId: "seat-031", seatNo: "6A", cabinClass: "ECONOMY", status: "AVAILABLE" },
  { seatId: "seat-032", seatNo: "6B", cabinClass: "ECONOMY", status: "AVAILABLE" },
  { seatId: "seat-033", seatNo: "6C", cabinClass: "ECONOMY", status: "HELD" },
  { seatId: "seat-034", seatNo: "6D", cabinClass: "ECONOMY", status: "AVAILABLE" },
  { seatId: "seat-035", seatNo: "6E", cabinClass: "ECONOMY", status: "AVAILABLE" },
  { seatId: "seat-036", seatNo: "6F", cabinClass: "ECONOMY", status: "AVAILABLE" },
];


export interface Flight {
  flightId: string;
  flightNo: string;
  origin: string;
  destination: string;
  originCity: string;
  destinationCity: string;
  departureTime: string;
  arrivalTime: string;
  status: FlightStatus;
  availableSeats: number;
  price: number;
  currency: string;
  sufficientSeats: boolean;
  airlineCode: string;
  airlineName: string;
  cabins: FlightCabin[];
  passengerFares: FlightPassengerFare[];
  ancillaries: FlightAncillaries;
}

export type FlightStatus =
  | "SCHEDULED"
  | "DELAYED"
  | "CANCELLED"
  | "COMPLETED";

export type CabinClass =
  | "ECONOMY"
  | "PREMIUM_ECONOMY"
  | "BUSINESS";

export type PassengerType =
  | "ADULT"
  | "CHILD"
  | "INFANT";

export interface FlightCabin {
  cabinClass: CabinClass;
  totalSeats: number;
  availableSeats: number;
  surcharge: number;
  adultFare: number;
  childFare: number;
}

export interface FlightPassengerFare {
  passengerType: PassengerType;
  baseFare: number;
  requiresSeat: boolean;
  bookable: boolean;
}

export interface FlightAncillaries {
  baggage: FlightBaggage[];
  meals: FlightMeal[];
  seatFees: FlightSeatFee[];
}

export interface FlightBaggage {
  kg: number;
  price: number;
}

export interface FlightMeal {
  code: string;
  price: number;
}

export interface FlightSeatFee {
  rule: string;
  price: number;
}

export interface Seat {
  seatId: string; seatNo: string; cabinClass: string; status: string;
}
export interface Booking {
  bookingId: string;
  bookingCode: string;
  flightId: string;
  flightNo: string;
  seatId: string | null;
  seatNo: string | null;
  passengerName: string;
  passengerEmail: string;
  status: string;
  createdAt: string;
  amount: number;
  currency: string;
  baggageKg: number | null;
  mealCode: string | null;
  seatFee: number;
  passengerType: "ADULT" | "CHILD";
  cabinClass: string;
  cabinFee: number;
  groupCode?: string | null;
  legNo?: number | null;
  arivalTime?: string;
  departureTime?: string
}
export interface BookingGroup {
  groupId: string;
  groupCode: string;
  tripType: "ONE_WAY" | "ROUND_TRIP";
  contactEmail: string;
  status: string;
  createdAt: string;
  totalAmount: number;
  currency: string;
  tickets: Booking[];
}
export interface CreateBookingGroup {
  flightIds: string[];
  contactEmail: string;
  passengers: Array<{
    passengerName: string;
    passengerType: "ADULT" | "CHILD";
    infantName?: string | null;
    seatIds: string[];
    baggageKgs: Array<number | null>;
    mealCodes: Array<string | null>;
  }>;
  payment: FlightBookingPayment;
  requestId: string;
}
export interface CreateBooking {
  requestId: string;
  flightId: string; seatId: string; passengerName: string; passengerEmail: string;
  baggageKg?: number | null; mealCode?: string | null;
  passengerType?: "ADULT" | "CHILD";
  payment: { amount: number; currency: string };
}


export interface FlightBookingRequest {
  flightIds: string[];
  contactEmail: string;
  passengers: FlightBookingPassenger[];
  payment: FlightBookingPayment;
  requestId: string;
}

export interface FlightBookingPassenger {
  passengerName: string;
  passengerType: "ADULT" | "CHILD";
  baggageKg: number | null;
  mealCode: string;
  baggageKgs: Array<number | null>;
  mealCodes: string[];
  infantName: string;
  seatIds: string[];
  booking: Booking | null;
  bookings?: Booking[];
}

export interface FlightBookingPayment {
  amount: number;
  currency: string;
}
