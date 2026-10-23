export interface Flight {
  flightId: string; flightNo: string; origin: string; destination: string;
  originCity: string; destinationCity: string;
  departureTime: string; arrivalTime: string; status: string;
  availableSeats: number; price: number; currency: string; sufficientSeats: boolean;
}
export interface Seat {
  seatId: string; seatNo: string; cabinClass: string; status: string;
}
export interface Booking {
  bookingId: string; bookingCode: string; flightId: string; flightNo: string;
  seatId: string; seatNo: string; passengerName: string; passengerEmail: string;
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
