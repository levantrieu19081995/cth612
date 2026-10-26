
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
  bookingId: string; bookingCode: string; flightId: string; flightNo: string;
  seatId: string | null; seatNo: string | null; passengerName: string; passengerEmail: string;
  status: string; createdAt: string; amount: number; currency: string;
  baggageKg: number | null; mealCode: string | null; seatFee: number;
  passengerType: "ADULT" | "CHILD"; cabinClass: string; cabinFee: number;
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
  passengerType: PassengerType;
  baggageKg: number;
  mealCode: string;
  infantName: string;
  seatIds: string[];
}

export interface FlightBookingPayment {
  amount: number;
  currency: string;
}
