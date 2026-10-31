import type { CreateBookingGroup, Flight, Seat } from "../../types/booking";

export interface InventoryFlight { flight: Flight; seats: Seat[] }
export interface BulkPlan {
  batchId: string;
  requests: CreateBookingGroup[];
  flights: Flight[];
  seats: Record<string, { seatNo: string; cabinClass: string }>;
}

export function seatSurcharge(seatNo: string) {
  if (seatNo.startsWith("01")) return 100000;
  return /[AF]$/.test(seatNo) ? 50000 : 0;
}

/** Generates a preview entirely in the browser, including temporary flight/seat IDs. */
export function createPreviewInventory(batchId: string, now = new Date()): InventoryFlight[] {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (name: string) => Number(parts.find(item => item.type === name)?.value);
  return Array.from({ length: 4 }, (_, index) => {
    const pair = Math.floor(index / 2);
    const returning = index % 2 === 1;
    const destination = pair === 0 ? "HAN" : "DAD";
    const city = pair === 0 ? "Hà Nội" : "Đà Nẵng";
    const departure = new Date(Date.UTC(part("year"), part("month") - 1, part("day") + 7 + pair, returning ? 10 : 2));
    const seats: Seat[] = Array.from({ length: 300 }, (_, seatIndex) => ({
      seatId: crypto.randomUUID(),
      seatNo: `${String(Math.floor(seatIndex / 6) + 1).padStart(2, "0")}${"ABCDEF"[seatIndex % 6]}`,
      cabinClass: seatIndex < 102 ? "ECONOMY" : seatIndex < 204 ? "PREMIUM_ECONOMY" : "BUSINESS",
      status: "AVAILABLE",
    }));
    const flight: Flight = {
      flightId: crypto.randomUUID(), flightNo: `DEMO-${batchId.slice(0, 8).toUpperCase()}-${pair}${index % 2}`,
      origin: returning ? destination : "SGN", destination: returning ? "SGN" : destination,
      originCity: returning ? city : "TP. Hồ Chí Minh", destinationCity: returning ? "TP. Hồ Chí Minh" : city,
      departureTime: departure.toISOString(), arrivalTime: new Date(departure.getTime() + 7200000).toISOString(),
      status: "SCHEDULED", availableSeats: 300, sufficientSeats: true, price: 1500000, currency: "VND", airlineCode: "VN", airlineName: "Vietnam Airlines",
      cabins: ["ECONOMY", "PREMIUM_ECONOMY", "BUSINESS"].map((cabinClass, cabinIndex) => ({
        cabinClass: cabinClass as Flight["cabins"][number]["cabinClass"],
        totalSeats: cabinIndex === 2 ? 96 : 102, availableSeats: cabinIndex === 2 ? 96 : 102,
        surcharge: cabinIndex * 500000, adultFare: 1500000 + cabinIndex * 500000, childFare: 1125000 + cabinIndex * 500000,
      })),
      passengerFares: [{ passengerType: "ADULT", baseFare: 1500000, requiresSeat: true, bookable: true }, { passengerType: "CHILD", baseFare: 1125000, requiresSeat: true, bookable: true }],
      ancillaries: {
        baggage: [{ kg: 15, price: 150000 }, { kg: 20, price: 200000 }, { kg: 25, price: 300000 }],
        meals: [{ code: "SANDWICH", price: 60000 }, { code: "VEGETARIAN", price: 75000 }, { code: "CHICKEN", price: 90000 }], seatFees: [],
      },
    };
    return { flight, seats };
  });
}

/** Bind preview seats to real inventory only after the user presses Submit. */
export function bindInventory(plan: BulkPlan, inventory: InventoryFlight[]): BulkPlan {
  const flights = plan.flights.map(old => {
    const match = inventory.find(item => item.flight.flightNo === old.flightNo);
    if (!match || match.flight.origin !== old.origin || match.flight.destination !== old.destination) throw new Error("API trả về chuyến bay khác dữ liệu đã tạo.");
    return match;
  });
  const requests = plan.requests.map(request => {
    const legs = request.flightIds.map(id => flights[plan.flights.findIndex(flight => flight.flightId === id)]);
    let amount = 0;
    const passengers = request.passengers.map(passenger => ({
      ...passenger,
      seatIds: passenger.seatIds.map((id, leg) => {
        const oldSeat = plan.seats[id];
        const seat = legs[leg]?.seats.find(item => item.seatNo === oldSeat?.seatNo && item.cabinClass === oldSeat.cabinClass && item.status === "AVAILABLE");
        if (!seat) throw new Error("Ghế đã chọn không còn trống. Chưa gửi yêu cầu booking.");
        const flight = legs[leg].flight;
        const fare = flight.passengerFares.find(item => item.passengerType === passenger.passengerType);
        const cabin = flight.cabins.find(item => item.cabinClass === seat.cabinClass);
        const baggage = flight.ancillaries.baggage.find(item => item.kg === passenger.baggageKgs[leg]);
        const meal = flight.ancillaries.meals.find(item => item.code === passenger.mealCodes[leg]);
        if (!fare || !cabin || !baggage || !meal) throw new Error("API thiếu bảng giá dịch vụ.");
        amount += fare.baseFare + cabin.surcharge + seatSurcharge(seat.seatNo) + baggage.price + meal.price;
        return seat.seatId;
      }),
    }));
    if (amount !== request.payment.amount) throw new Error("Giá trên API khác bản xem trước. Chưa gửi yêu cầu booking.");
    return { ...request, flightIds: legs.map(item => item.flight.flightId), passengers };
  });
  return { ...plan, requests, flights: flights.map(item => item.flight), seats: Object.fromEntries(inventory.flatMap(item => item.seats.map(seat => [seat.seatId, { seatNo: seat.seatNo, cabinClass: seat.cabinClass }]))) };
}

export function createBulkPlan(inventory: InventoryFlight[], batchId: string, uuid = () => crypto.randomUUID()): BulkPlan {
  const requests: CreateBookingGroup[] = [];
  // Interleave cabins so every portion of the generated batch includes all three classes.
  const pools = new Map(inventory.map(({ flight, seats }) => {
    const cabins = flight.cabins.map(cabin => seats.filter(seat => seat.status === "AVAILABLE" && seat.cabinClass === cabin.cabinClass));
    const mixed: Seat[] = [];
    for (let index = 0; index < Math.max(0, ...cabins.map(cabin => cabin.length)); index++) {
      for (const cabin of cabins) if (cabin[index]) mixed.push(cabin[index]);
    }
    return [flight.flightId, mixed];
  }));
  const pairs = inventory.filter(item => item.flight.origin === "SGN").map(outbound => {
    const inbound = inventory.find(item => item.flight.origin === outbound.flight.destination &&
      item.flight.destination === outbound.flight.origin && new Date(item.flight.departureTime) > new Date(outbound.flight.arrivalTime));
    if (!inbound) throw new Error("Thiếu chuyến về phù hợp để tạo dữ liệu khứ hồi.");
    return [outbound.flight, inbound.flight];
  });
  if (pairs.length !== 2 || inventory.length !== 4) throw new Error("Cần đủ hai cặp chuyến đi/về để tạo 1.000 vé.");
  if (new Set(inventory.map(item => item.flight.flightId)).size !== 4 || inventory.some(item => item.flight.currency !== "VND")) {
    throw new Error("Danh sách chuyến bay mẫu không hợp lệ.");
  }

  function addGroup(flights: Flight[]) {
    const groupIndex = requests.length;
    let amount = 0;
    const passengers = Array.from({ length: 5 }, (_, passengerIndex) => {
      const ordinal = groupIndex * 5 + passengerIndex + 1;
      const passengerType = passengerIndex === 4 ? "CHILD" as const : "ADULT" as const;
      const seatIds: string[] = [];
      const baggageKgs: number[] = [];
      const mealCodes: string[] = [];
      for (const [legIndex, flight] of flights.entries()) {
        const seat = pools.get(flight.flightId)?.shift();
        if (!seat) throw new Error("Không đủ ghế trống để tạo đủ 1.000 vé. Hãy tạo một lô mới.");
        const cabin = flight.cabins.find(item => item.cabinClass === seat.cabinClass);
        const fare = flight.passengerFares.find(item => item.passengerType === passengerType);
        const baggage = flight.ancillaries.baggage[(ordinal + legIndex) % flight.ancillaries.baggage.length];
        const meal = flight.ancillaries.meals[(ordinal + legIndex) % flight.ancillaries.meals.length];
        if (!cabin || !fare || !baggage || !meal) throw new Error("Thiếu bảng giá hoặc dịch vụ của chuyến bay.");
        amount += fare.baseFare + cabin.surcharge + seatSurcharge(seat.seatNo) + baggage.price + meal.price;
        seatIds.push(seat.seatId);
        baggageKgs.push(baggage.kg);
        mealCodes.push(meal.code);
      }
      const surnames = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng"];
      const names = ["Minh Anh", "Quang Huy", "Thu Hà", "Gia Bảo", "Bảo Ngọc"];
      return {
        passengerName: `${surnames[ordinal % 5]} ${names[ordinal % 5]} ${String(ordinal).padStart(4, "0")}`,
        passengerType,
        infantName: passengerIndex === 0 && groupIndex % 3 === 0 ? `Bé An ${ordinal}` : null,
        seatIds, baggageKgs, mealCodes,
      };
    });
    requests.push({
      requestId: uuid(), flightIds: flights.map(flight => flight.flightId), passengers,
      contactEmail: `demo.${batchId.slice(0, 8)}.${groupIndex + 1}@example.com`,
      payment: { amount, currency: "VND" },
    });
  }
  // 50 groups × 5 passengers × 2 legs = 500 round-trip tickets.
  for (const pair of pairs) for (let index = 0; index < 25; index++) addGroup(pair);
  // 100 groups × 5 passengers = 500 one-way tickets, across both directions.
  for (const { flight } of inventory) for (let index = 0; index < 25; index++) addGroup([flight]);
  return {
    batchId, requests, flights: inventory.map(item => item.flight),
    seats: Object.fromEntries(inventory.flatMap(item => item.seats.map(seat => [seat.seatId, { seatNo: seat.seatNo, cabinClass: seat.cabinClass }]))),
  };
}

export function ticketCount(requests: CreateBookingGroup[]) {
  return requests.reduce((sum, request) => sum + request.passengers.length * request.flightIds.length, 0);
}
