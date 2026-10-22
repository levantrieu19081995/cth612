"use client";
import {useParams} from "next/navigation";
import Link from "next/link";
import {usePolling} from "../../../lib/usePolling";
import type {Booking} from "../../../types/booking";
import type {Timeline} from "../../../types/monitoring";

const labels:Record<string,string>={BOOKING_CREATED:"Tạo yêu cầu đặt vé",SEAT_RESERVED:"Đặt ghế",PAYMENT_RECORDED:"Ghi nhận thanh toán demo",BOOKING_CONFIRMED:"Xác nhận vé"};
const mealLabels:Record<string,string>={CHICKEN:"Cơm gà",VEGETARIAN:"Suất chay",SANDWICH:"Sandwich"};
export default function BookingDetails() {
  const params=useParams<{id:string}>();
  const details=usePolling<Booking>("/api/bookings/"+encodeURIComponent(params.id),10000);
  const history=usePolling<Timeline>("/api/bookings/"+encodeURIComponent(params.id)+"/events",3000);
  return <section><p className="eyebrow">VÉ & LỊCH SỬ</p><h1>Thông tin đặt vé</h1>
    <Link href="/booking">← Đặt vé khác</Link>
    {details.loading&&!details.data&&<p role="status">Đang tải vé…</p>}
    {details.error&&<p className="alert error" role="alert">{details.error}</p>}
    {details.data&&<div className="card section-card"><h2>{details.data.flightNo} · Ghế {details.data.seatNo}</h2>
      <p className="booking-code"><strong>{details.data.bookingCode}</strong></p>
      <dl className="details"><dt>Hành khách</dt><dd>{details.data.passengerName}</dd><dt>Email</dt><dd>{details.data.passengerEmail}</dd>
      <dt>Trạng thái</dt><dd>{details.data.status==="CONFIRMED"?"Đã xác nhận":details.data.status}</dd>
      <dt>Hành lý ký gửi</dt><dd>{details.data.baggageKg ? `${details.data.baggageKg} kg` : "Không mua thêm"}</dd>
      <dt>Suất ăn</dt><dd>{details.data.mealCode ? (mealLabels[details.data.mealCode] ?? details.data.mealCode) : "Không chọn"}</dd>
      <dt>Phụ thu ghế</dt><dd>{new Intl.NumberFormat("vi-VN",{style:"currency",currency:"VND"}).format(details.data.seatFee)}</dd>
      <dt>Tổng thanh toán demo</dt><dd>{new Intl.NumberFormat("vi-VN",{style:"currency",currency:"VND"}).format(details.data.amount)}</dd>
      <dt>Đặt lúc</dt><dd>{new Date(details.data.createdAt).toLocaleString("vi-VN")}</dd></dl></div>}
    <h2>Lịch sử sự kiện</h2>
    {history.error&&<p className="alert notice" role="alert">{history.error} Thông tin vé phía trên vẫn được đọc độc lập.</p>}
    {history.loading&&!history.data&&<p role="status">Đang đọc lịch sử…</p>}
    {history.data&&<><p className={"alert "+(history.data.synchronizedEvents?"success":"notice")}>{history.data.synchronizedEvents?"Sự kiện đã đồng bộ.":history.data.pendingEvents+" sự kiện đang chờ đồng bộ."}</p>
      {!history.data.events.length&&<p>Lịch sử chưa có dữ liệu; trang sẽ tự cập nhật.</p>}
      <ol className="timeline">{history.data.events.slice().reverse().map(event=><li key={event.eventId}><strong>{labels[event.eventType]??event.eventType}</strong><small>{new Date(event.occurredAt).toLocaleString("vi-VN")}</small></li>)}</ol></>}
    <button onClick={()=>{details.refresh();history.refresh();}}>Kiểm tra lại</button>
  </section>;
}
