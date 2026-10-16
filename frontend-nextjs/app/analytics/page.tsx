"use client";
import {usePolling} from "../../lib/usePolling";
import type {AnalyticsSummary} from "../../types/monitoring";
import Benchmarks from "../../components/Benchmarks";
export default function AnalyticsPage() {
  const {data,error,loading,refresh}=usePolling<AnalyticsSummary>("/api/analytics/summary",5000);
  return <section><p className="eyebrow">THỐNG KÊ</p><h1>Booking & sự kiện</h1>
    <div className="toolbar"><p>Số liệu đọc trực tiếp từ hai database.</p><button onClick={refresh}>Làm mới</button></div>
    {error&&<p className="alert error" role="alert">{error}. Nếu còn số liệu hiển thị, đó là lần đọc trước.</p>}
    {loading&&!data&&<p role="status">Đang tải thống kê…</p>}
    {data&&<><div className="grid">
      <div className="card"><h3>Vé đã xác nhận</h3><p className="stat">{data.business.confirmed}</p><small>{data.business.bookings} booking tổng cộng</small></div>
      <div className="card"><h3>Thanh toán demo</h3><p className="stat">{data.business.payments}</p><small>{new Intl.NumberFormat("vi-VN",{style:"currency",currency:"VND"}).format(data.business.demoRevenue)}</small></div>
      <div className="card"><h3>Sự kiện hôm nay</h3><p className="stat">{data.eventsToday??"—"}</p><small>Ngày UTC {data.eventDateUtc} · Cassandra {data.eventStoreStatus==="AVAILABLE"?"khả dụng":"tạm gián đoạn"}</small></div>
      <div className="card"><h3>Sự kiện đã đồng bộ</h3><p className="stat">{data.outbox.published}</p><small>{data.outbox.pending} đang chờ · {data.outbox.failed} đang retry</small></div>
    </div><div className="card section-card"><h2>Dữ liệu chuyến bay</h2><p>{data.business.flights} chuyến sắp khởi hành · {data.business.availableSeats} ghế còn trống.</p><p>Thanh toán mô phỏng; các vé kiểm thử được tính trong số liệu database.</p><small>Quan sát lúc {new Date(data.observedAt).toLocaleString("vi-VN")}</small></div>
    </>}
    <Benchmarks />
  </section>;
}
