import Link from "next/link";
export default function HomePage() {
  return <section><div className="hero"><p className="eyebrow">CTH612 · ỨNG DỤNG ĐẶT VÉ PHÂN TÁN</p>
    <h1>Đặt vé dễ dàng.<br/>Theo dõi dữ liệu rõ ràng.</h1>
    <p>Tìm chuyến bay, chọn ghế và xem hành trình xử lý vé của bạn.</p><Link className="primary-link" href="/booking">Tìm chuyến bay →</Link></div>
    <div className="grid section-card">
      <Link className="card feature" href="/booking"><span className="feature-icon">01</span><h2>Đặt vé</h2><p>Chọn chuyến, chọn ghế và nhận mã vé sau khi giao dịch được xác nhận.</p></Link>
      <Link className="card feature" href="/monitor"><span className="feature-icon">02</span><h2>Giám sát hệ thống</h2><p>Theo dõi trạng thái các node và tiến độ đồng bộ sự kiện.</p></Link>
      <Link className="card feature" href="/analytics"><span className="feature-icon">03</span><h2>Thống kê</h2><p>Xem số vé, thanh toán demo và lịch sử ghi nhận từ hai database.</p></Link>
    </div><p className="muted">Bản đồ án: thanh toán mô phỏng. Dữ liệu nghiệp vụ được lưu thật; trạng thái giám sát lấy từ các kiểm tra backend.</p>
  </section>;
}
