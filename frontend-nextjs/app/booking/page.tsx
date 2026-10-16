"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ApiError, apiGet, apiPost } from "../../lib/api";
import type { Flight, Seat, Booking, CreateBooking } from "../../types/booking";
import Link from "next/link";

const money = (value: number) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(value);
const time = (value: string) => new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour12: false });
const errorText = (error: unknown) => error instanceof Error ? error.message : "Không thể kết nối backend.";

export default function BookingPage() {
  const [flights, setFlights] = useState<Flight[]>([]);
  const [flight, setFlight] = useState<Flight | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [seat, setSeat] = useState<Seat | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [searching, setSearching] = useState(true);
  const [loadingSeats, setLoadingSeats] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const seatRequest = useRef(0);
  const searchRequest = useRef(0);
  const submitLock = useRef(false);
  const pendingRequest = useRef<{ fingerprint: string; id: string } | null>(null);

  useEffect(() => {
    let active = true;
    try {
      const stored: unknown=JSON.parse(sessionStorage.getItem("pending-booking")??"null");
      if(stored&&typeof stored==="object"&&"id" in stored&&typeof stored.id==="string"&&/^[0-9a-f-]{36}$/.test(stored.id)) {
        apiGet<Booking>("/api/bookings/requests/"+stored.id).then(result=>{
          if(active) {setBooking(result);sessionStorage.removeItem("pending-booking");}
        }).catch(err=>{ if(active&&!(err instanceof ApiError&&err.status===404)) setError("Chưa kiểm tra được yêu cầu trước đó. "+errorText(err)); });
      }
    } catch { /* Session storage may be unavailable. */ }
    apiGet<Flight[]>("/api/flights").then(data => { if (active) setFlights(data); })
      .catch(err => { if (active) setError(errorText(err)); })
      .finally(() => { if (active) setSearching(false); });
    return () => { active = false; };
  }, []);

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const request = ++searchRequest.current;
    ++seatRequest.current;
    setSearching(true); setLoadingSeats(false); setError(""); setFlight(null); setSeats([]); setSeat(null); setBooking(null);
    const query = new URLSearchParams();
    if (origin) query.set("origin", origin);
    if (destination) query.set("destination", destination);
    if (date) query.set("date", date);
    try {
      const data = await apiGet<Flight[]>(`/api/flights?${query}`);
      if (request === searchRequest.current) setFlights(data);
    } catch (err) { if (request === searchRequest.current) { setFlights([]); setError(errorText(err)); } }
    finally { if (request === searchRequest.current) setSearching(false); }
  }

  async function chooseFlight(item: Flight) {
    const request = ++seatRequest.current;
    setFlight(item); setSeat(null); setSeats([]); setBooking(null); setError(""); setLoadingSeats(true);
    try {
      const data = await apiGet<Seat[]>(`/api/flights/${item.flightId}/seats`);
      if (request === seatRequest.current) setSeats(data);
    } catch (err) { if (request === seatRequest.current) setError(errorText(err)); }
    finally { if (request === seatRequest.current) setLoadingSeats(false); }
  }

  async function book(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!flight || !seat || submitLock.current) return;
    submitLock.current = true; setSubmitting(true); setError(""); setBooking(null);
    const fingerprint=JSON.stringify([flight.flightId,seat.seatId,name.trim(),email.trim(),flight.price]);
    if(pendingRequest.current?.fingerprint!==fingerprint) {
      let stored: {fingerprint:string;id:string}|null=null;
      try {
        const candidate: unknown=JSON.parse(sessionStorage.getItem("pending-booking")??"null");
        if(candidate&&typeof candidate==="object"&&"fingerprint" in candidate&&"id" in candidate&&typeof candidate.fingerprint==="string"&&typeof candidate.id==="string") stored={fingerprint:candidate.fingerprint,id:candidate.id};
      } catch { /* Optional browser storage; the in-memory request key remains authoritative. */ }
      pendingRequest.current=stored?.fingerprint===fingerprint ? stored : {fingerprint,id:crypto.randomUUID()};
      try { sessionStorage.setItem("pending-booking",JSON.stringify(pendingRequest.current)); } catch { /* Private browsing can disable storage. */ }
    }
    const body: CreateBooking = { requestId: pendingRequest.current!.id, flightId: flight.flightId, seatId: seat.seatId,
      passengerName: name.trim(), passengerEmail: email.trim(),
      payment: { amount: flight.price, currency: flight.currency } };
    try {
      const result = await apiPost<Booking>("/api/bookings", body);
      setBooking(result); setSeat(null);
      pendingRequest.current=null;
      try { sessionStorage.removeItem("pending-booking"); } catch { /* Storage is optional. */ }
      setSeats(current => current.map(s => s.seatId === result.seatId ? { ...s, status: "BOOKED" } : s));
      setFlights(current => current.map(f => f.flightId === result.flightId ? { ...f, availableSeats: Math.max(0, f.availableSeats - 1) } : f));
    } catch (err) {
      setError(errorText(err)+(err instanceof ApiError&&err.status<500?"":". Chưa xác định yêu cầu đã lưu hay chưa; bấm gửi lại với cùng thông tin để kiểm tra an toàn."));
      if (err instanceof ApiError && err.code === "SEAT_ALREADY_BOOKED") {
        setSeat(null);
        try { setSeats(await apiGet<Seat[]>(`/api/flights/${flight.flightId}/seats`)); }
        catch { setError("Ghế đã được đặt. Không thể tải lại sơ đồ; hãy chọn lại chuyến bay."); }
      }
    } finally { submitLock.current = false; setSubmitting(false); }
  }

  return <section>
    <div className="page-heading"><p className="eyebrow">ĐẶT VÉ / LOCAL DEMO</p><h1>Chọn chuyến. Chọn ghế. Đặt vé.</h1>
      <p>Thanh toán mô phỏng, giá vé mẫu 1.500.000 VND. Dữ liệu đặt vé được lưu trong CockroachDB.</p></div>
    <form className="card search-form" onSubmit={search}>
      <label>Nơi đi<select value={origin} onChange={e => setOrigin(e.target.value)} disabled={submitting}>
        <option value="">Tất cả</option><option value="SGN">TP. Hồ Chí Minh (SGN)</option>
        <option value="HAN">Hà Nội (HAN)</option><option value="DAD">Đà Nẵng (DAD)</option><option value="VCA">Cần Thơ (VCA)</option>
      </select></label>
      <label>Nơi đến<select value={destination} onChange={e => setDestination(e.target.value)} disabled={submitting}>
        <option value="">Tất cả</option><option value="HAN">Hà Nội (HAN)</option><option value="SGN">TP. Hồ Chí Minh (SGN)</option>
        <option value="DAD">Đà Nẵng (DAD)</option><option value="VCA">Cần Thơ (VCA)</option>
      </select></label>
      <label>Ngày bay<input type="date" value={date} onChange={e => setDate(e.target.value)} disabled={submitting} /></label>
      <button disabled={searching || submitting}>{searching ? "Đang tìm…" : "Tìm chuyến bay"}</button>
    </form>
    {error && <p role="alert" className="alert error">{error}</p>}
    <div className="booking-columns">
      <div><h2>Chuyến bay</h2>
        {searching && <p role="status">Đang tải chuyến bay…</p>}
        {!searching && !flights.length && <div className="card">Không có chuyến phù hợp. Thử bỏ bộ lọc hoặc kiểm tra backend chạy với profile local.</div>}
        {flights.map(item => <button key={item.flightId} type="button"
          className={`card flight-card ${flight?.flightId === item.flightId ? "selected" : ""}`}
          onClick={() => void chooseFlight(item)} disabled={submitting || searching} aria-pressed={flight?.flightId === item.flightId}>
          <strong>{item.origin} → {item.destination}</strong><span>{item.originCity} → {item.destinationCity}</span>
          <span>{item.flightNo} · {time(item.departureTime)}</span>
          <span>{item.availableSeats} ghế trống · {money(item.price)}</span>
        </button>)}
      </div>
      <div><h2>Ghế & hành khách</h2><div className="card">
        {!flight && <p>Chọn một chuyến bay để xem ghế.</p>}
        {loadingSeats && <p role="status">Đang tải sơ đồ ghế…</p>}
        {flight && !loadingSeats && <>
          <h3>{flight.flightNo} · {flight.origin} → {flight.destination}</h3>
          <p className="muted">Ghế màu xám đã bán. Chọn ghế trống để tiếp tục.</p>
          <div className="seat-map">{seats.map(item => <button key={item.seatId} type="button"
            className={`seat ${item.seatNo.length>3?"seat-long":""} ${seat?.seatId === item.seatId ? "selected" : ""}`}
            disabled={item.status !== "AVAILABLE" || submitting} aria-pressed={seat?.seatId === item.seatId}
            aria-label={`Ghế ${item.seatNo}, ${item.status === "AVAILABLE" ? "còn trống" : "không còn trống"}`}
            onClick={() => { setSeat(item); setBooking(null); }}>{item.seatNo}</button>)}</div>
          {!seats.length && <p>Chưa có ghế cho chuyến này.</p>}
          {seat && <form className="passenger-form" onSubmit={book}>
            <h3>Ghế {seat.seatNo} · {money(flight.price)}</h3>
            <label>Họ tên<input value={name} onChange={e => setName(e.target.value)} required maxLength={120} disabled={submitting} autoComplete="name" /></label>
            <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} required maxLength={254} disabled={submitting} autoComplete="email" /></label>
            <button disabled={submitting || !name.trim() || !email.trim()}>{submitting ? "Đang xác nhận…" : "Đặt vé & thanh toán demo"}</button>
            <small>Chỉ xác nhận sau khi giao dịch database đã hoàn tất.</small>
          </form>}
        </>}
        {booking && <div className="alert success" role="status"><h3>Đặt vé thành công</h3>
          <p><strong>{booking.flightNo} · Ghế {booking.seatNo}</strong></p><p>{booking.passengerName}</p>
          <p className="booking-code">Mã vé: {booking.bookingCode}</p>
          <p>{money(booking.amount)} · {booking.status}</p>
          <Link href={`/bookings/${booking.bookingId}`}>Xem vé & lịch sử sự kiện →</Link>
        </div>}
      </div></div>
    </div>
  </section>;
}
