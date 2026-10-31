const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const filename = path.join(__dirname, "bulk-bookings.ts");
const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
});
const loaded = new Module(filename, module);
loaded._compile(compiled.outputText, filename);
const { bindInventory, createPreviewInventory, createBulkPlan, ticketCount, seatSurcharge } = loaded.exports;

function inventory() {
  return Array.from({ length: 4 }, (_, index) => {
    const destination = index < 2 ? "HAN" : "DAD";
    const returnLeg = index % 2 === 1;
    const seats = Array.from({ length: 300 }, (_, seatIndex) => ({
      seatId: `${index}-${seatIndex}`,
      seatNo: `${String(Math.floor(seatIndex / 6) + 1).padStart(2, "0")}${"ABCDEF"[seatIndex % 6]}`,
      cabinClass: seatIndex < 102 ? "ECONOMY" : seatIndex < 204 ? "PREMIUM_ECONOMY" : "BUSINESS",
      status: "AVAILABLE",
    }));
    return { seats, flight: {
      flightId: `flight-${index}`, flightNo: `DEMO-${index}`, origin: returnLeg ? destination : "SGN", destination: returnLeg ? "SGN" : destination,
      departureTime: returnLeg ? "2030-01-01T10:00:00Z" : "2030-01-01T02:00:00Z", arrivalTime: returnLeg ? "2030-01-01T12:00:00Z" : "2030-01-01T04:00:00Z",
      currency: "VND",
      cabins: [{ cabinClass: "ECONOMY", surcharge: 0 }, { cabinClass: "PREMIUM_ECONOMY", surcharge: 500000 }, { cabinClass: "BUSINESS", surcharge: 1000000 }],
      passengerFares: [{ passengerType: "ADULT", baseFare: 1500000 }, { passengerType: "CHILD", baseFare: 1125000 }],
      ancillaries: { baggage: [{ kg: 15, price: 150000 }, { kg: 20, price: 200000 }, { kg: 25, price: 300000 }], meals: [{ code: "SANDWICH", price: 60000 }, { code: "VEGETARIAN", price: 75000 }, { code: "CHICKEN", price: 90000 }] },
    } };
  });
}

test("1K plan has 500 one-way and 500 round-trip tickets without reusing seats", () => {
  const source = inventory();
  const original = JSON.stringify(source);
  let request = 0;
  const plan = createBulkPlan(source, "batch", () => `request-${++request}`);
  assert.equal(plan.requests.length, 150);
  assert.equal(ticketCount(plan.requests), 1000);
  assert.equal(ticketCount(plan.requests.filter(item => item.flightIds.length === 1)), 500);
  assert.equal(ticketCount(plan.requests.filter(item => item.flightIds.length === 2)), 500);
  const ids = plan.requests.flatMap(item => item.passengers.flatMap(passenger => passenger.seatIds));
  assert.equal(new Set(ids).size, 1000);
  assert.equal(new Set(plan.requests.map(item => item.requestId)).size, 150);
  assert.equal(JSON.stringify(source), original);
  assert.deepEqual(new Set(ids.map(id => plan.seats[id].cabinClass)), new Set(["ECONOMY", "PREMIUM_ECONOMY", "BUSINESS"]));
});

test("prices, per-leg services and infant/adult constraints match booking policy", () => {
  const source = inventory();
  const plan = createBulkPlan(source, "batch");
  for (const request of plan.requests) {
    let total = 0;
    assert.ok(request.passengers.some(passenger => passenger.passengerType === "ADULT"));
    for (const passenger of request.passengers) {
      if (passenger.infantName) assert.equal(passenger.passengerType, "ADULT");
      assert.equal(passenger.seatIds.length, request.flightIds.length);
      assert.equal(passenger.baggageKgs.length, request.flightIds.length);
      assert.equal(passenger.mealCodes.length, request.flightIds.length);
      for (const [leg, flightId] of request.flightIds.entries()) {
        const { flight, seats } = source.find(item => item.flight.flightId === flightId);
        const seat = seats.find(item => item.seatId === passenger.seatIds[leg]);
        assert.ok(seat);
        total += (passenger.passengerType === "CHILD" ? 1125000 : 1500000)
          + ({ ECONOMY: 0, PREMIUM_ECONOMY: 500000, BUSINESS: 1000000 })[seat.cabinClass]
          + (seat.seatNo.startsWith("01") ? 100000 : /[AF]$/.test(seat.seatNo) ? 50000 : 0)
          + flight.ancillaries.baggage.find(item => item.kg === passenger.baggageKgs[leg]).price
          + flight.ancillaries.meals.find(item => item.code === passenger.mealCodes[leg]).price;
      }
    }
    assert.equal(request.payment.amount, total);
    if (request.flightIds.length === 2) {
      const [out, back] = request.flightIds.map(id => source.find(item => item.flight.flightId === id).flight);
      assert.equal(out.origin, back.destination);
      assert.equal(out.destination, back.origin);
      assert.ok(new Date(back.departureTime) > new Date(out.arrivalTime));
    }
  }
  assert.equal(seatSurcharge("01A"), 100000);
});

test("generation rejects missing return flights or insufficient free seats", () => {
  assert.throws(() => createBulkPlan(inventory().slice(0, 1), "batch"));
  const source = inventory();
  source[0].seats.forEach(seat => { seat.status = "BOOKED"; });
  assert.throws(() => createBulkPlan(source, "batch"), /Không đủ ghế/);
});

test("browser preview creates the complete plan before inventory is saved by the API", () => {
  const preview = createPreviewInventory("12345678-batch", new Date("2030-01-01T00:00:00Z"));
  const plan = createBulkPlan(preview, "12345678-batch");
  assert.equal(ticketCount(plan.requests), 1000);
  assert.equal(preview.reduce((sum, item) => sum + item.seats.length, 0), 1200);
  const real = preview.map((item, index) => ({
    flight: { ...item.flight, flightId: `server-flight-${index}` },
    seats: item.seats.map((seat, seatIndex) => ({ ...seat, seatId: `server-seat-${index}-${seatIndex}` })),
  }));
  const bound = bindInventory(plan, real);
  assert.equal(ticketCount(bound.requests), 1000);
  assert.deepEqual(bound.requests.map(item => item.requestId), plan.requests.map(item => item.requestId));
  assert.deepEqual(bound.requests.map(item => item.payment), plan.requests.map(item => item.payment));
  assert.ok(bound.requests.every(item => item.flightIds.every(id => id.startsWith("server-flight-"))));
  assert.ok(bound.requests.every(item => item.passengers.every(passenger => passenger.seatIds.every(id => id.startsWith("server-seat-")))));
  assert.equal(new Set(bound.requests.flatMap(item => item.passengers.flatMap(passenger => passenger.seatIds))).size, 1000);
  real[0].flight = { ...real[0].flight, passengerFares: real[0].flight.passengerFares.map(fare => ({ ...fare, baseFare: fare.baseFare + 1 })) };
  assert.throws(() => bindInventory(plan, real), /Giá trên API khác/);
});
