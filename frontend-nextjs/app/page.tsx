import Link from "next/link";

const destinations = [
  {
    number: "01",
    title: "Đặt vé máy bay",
    description:
      "Tìm chuyến bay, chọn chỗ ngồi và theo dõi xác nhận đặt chỗ trong một quy trình rõ ràng.",
    href: "/booking",
    action: "Bắt đầu đặt vé",
    featured: true,
  },
  {
    number: "02",
    title: "Giám sát hệ thống",
    description:
      "Quan sát trạng thái các node và tiến độ đồng bộ sự kiện theo thời gian thực.",
    href: "/monitor",
    action: "Mở giám sát",
  },
  {
    number: "03",
    title: "Thống kê hoạt động",
    description:
      "Xem tổng quan booking, thanh toán mô phỏng và dữ liệu sự kiện.",
    href: "/analytics",
    action: "Xem thống kê",
  },
];

export default function HomePage() {
  return (
    <>
      <section className="home-page">
        <div className="home-hero">
          <div className="hero-copy">
            <p className="home-eyebrow">
              <span className="eyebrow-mark" aria-hidden="true" />
              CTH612 <span aria-hidden="true">/</span> ĐẶT VÉ PHÂN TÁN
            </p>
            <h1>
              Một hành trình,
              <br />
              <span>mọi thứ rõ ràng.</span>
            </h1>
            <p className="hero-description">
              Đặt vé thuận tiện, chọn chỗ ngồi trực quan và theo dõi trạng thái
              dữ liệu trên cùng một nền tảng.
            </p>
            <div className="hero-actions">
              <Link className="primary-link" href="/booking">
                Tìm chuyến bay <span aria-hidden="true">→</span>
              </Link>
              <Link className="secondary-link" href="/monitor">
                Khám phá hệ thống
              </Link>
            </div>
            <p className="hero-footnote">
              <span aria-hidden="true">ⓘ</span> Thanh toán trong ứng dụng là mô
              phỏng phục vụ đồ án.
            </p>
          </div>

          <aside className="journey-card" aria-label="Quy trình đặt vé">
            <div className="journey-card-heading">
              <div>
                <p className="journey-label">THIẾT KẾ CHO BẠN</p>
                <h2>Hành trình đặt vé</h2>
              </div>
              <span className="journey-spark" aria-hidden="true">
                ✦
              </span>
            </div>
            <div className="journey-route" aria-hidden="true">
              <span className="route-point">A</span>
              <span className="route-line">
                <span>✈</span>
              </span>
              <span className="route-point">B</span>
            </div>
            <div className="route-captions" aria-hidden="true">
              <span>Chọn chuyến</span>
              <span>Đến xác nhận</span>
            </div>
            <ol className="journey-steps">
              <li>
                <span>1</span>
                <div>
                  <strong>Chọn chuyến bay</strong>
                  <small>Tìm lựa chọn phù hợp</small>
                </div>
                <span className="step-check" aria-hidden="true">
                  ✓
                </span>
              </li>
              <li>
                <span>2</span>
                <div>
                  <strong>Chọn chỗ ngồi</strong>
                  <small>Chọn vị trí bạn yêu thích</small>
                </div>
                <span className="step-arrow" aria-hidden="true">
                  →
                </span>
              </li>
              <li>
                <span>3</span>
                <div>
                  <strong>Nhận xác nhận</strong>
                  <small>Lưu lại mã đặt chỗ</small>
                </div>
                <span className="step-lock" aria-hidden="true">
                  •••
                </span>
              </li>
            </ol>
          </aside>
        </div>

        <section className="home-destinations" aria-labelledby="destination-title">
          <div className="section-heading">
            <div>
              <p className="home-eyebrow">KHÔNG GIAN CỦA BẠN</p>
              <h2 id="destination-title">Bắt đầu từ đâu?</h2>
            </div>
            <p>
              Những công cụ cần thiết, được sắp xếp để bạn tìm thấy nhanh chóng.
            </p>
          </div>

          <div className="destination-grid">
            {destinations.map((destination) => (
              <Link
                className={`destination-card${destination.featured ? " destination-card-featured" : ""}`}
                href={destination.href}
                key={destination.number}
              >
                <span className="destination-number">{destination.number}</span>
                <span className="destination-arrow" aria-hidden="true">
                  ↗
                </span>
                <h3>{destination.title}</h3>
                <p>{destination.description}</p>
                <span className="destination-action">
                  {destination.action} <span aria-hidden="true">→</span>
                </span>
              </Link>
            ))}
          </div>
        </section>

        <div className="home-info" role="note">
          <span className="info-icon" aria-hidden="true">
            i
          </span>
          <p>
            <strong>Minh bạch ngay từ đầu.</strong> Giao dịch thanh toán được mô
            phỏng; dữ liệu booking được lưu trong hệ thống và trạng thái giám sát
            phản ánh kết quả kiểm tra từ backend.
          </p>
        </div>
      </section>
    </>
  );
}
