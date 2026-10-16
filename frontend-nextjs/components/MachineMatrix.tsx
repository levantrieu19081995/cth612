import type {PhysicalMachine} from "../types/monitoring";

export function MonitorIcon() {
  return <svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><rect x="6" y="7" width="36" height="26" rx="4" stroke="currentColor" strokeWidth="2"/><path d="M18 41h12M24 33v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M13 25l7-7 6 5 9-10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
export default function MachineMatrix({machines,stale,local}:{machines:PhysicalMachine[];stale:boolean;local:boolean}) {
  const responding=machines.filter(machine=>machine.status==="REACHABLE").length;
  return <section className="machine-panel" aria-labelledby="computer-status-title">
    <div className="matrix-heading"><div><p className="matrix-eyebrow">MÁY VẬT LÝ</p><h2 id="computer-status-title">Tình trạng máy tính</h2>
      <p>Mỗi ô là một máy đã cấu hình. Xanh khi có dịch vụ phản hồi.</p></div>
      <div className="matrix-counter" aria-label="Số máy đang phản hồi"><strong>{stale?"—":responding}</strong><span>/{machines.length}</span><small>máy có phản hồi</small></div></div>
    <div className="matrix-legend"><span><i className="led reachable"/>Có phản hồi</span><span><i className="led unreachable"/>Không phản hồi dịch vụ</span><span><i className="led unknown"/>Chưa xác định</span></div>
    {stale&&<p className="matrix-stale" role="status">Chưa có quan sát mới. Các ô tạm chuyển sang xám.</p>}
    {!machines.length&&<p>Chưa có danh sách máy từ backend.</p>}
    <div className="machine-grid">{machines.map(machine=>{
      const status=stale?"UNKNOWN":machine.status;
      const statusLabel=status==="REACHABLE"?"Có phản hồi":status==="UNREACHABLE"?"Không phản hồi dịch vụ":"Chưa xác định";
      const hasFailure=!stale&&machine.status==="REACHABLE"&&machine.services.some(service=>service.status==="OFFLINE");
      return <article key={machine.machineId} className={"machine-tile "+status.toLowerCase()} data-machine-id={machine.machineId} data-state={status} aria-label={`${machine.name}, ${statusLabel}`}>
        <div className="machine-tile-top"><MonitorIcon/><span className={"machine-state "+status.toLowerCase()}><i className={"led "+status.toLowerCase()}/>{statusLabel}</span></div>
        <p className="machine-role">{local?"MÁY BÀN":machine.machineId} · {machine.role??"Máy dữ liệu"}</p>
        <h3>{machine.name}</h3><p className="machine-ip"><span>IP LAN</span><code>{machine.ip||"Chưa cấu hình IP"}</code></p>
        <p className="machine-service-count">{stale?"—":machine.respondingServices}/{machine.totalServices} dịch vụ phản hồi</p>
        {hasFailure&&<p className="machine-partial">Máy còn phản hồi; có dịch vụ đang gián đoạn.</p>}
        <details className="machine-services"><summary>Xem dịch vụ</summary><ul>{machine.services.map((service,index)=>{
          const serviceStatus=stale?"UNKNOWN":service.status;
          return <li key={service.name+index}><span>{local?service.name.replace(/\bPC(\d+)\b/g,"Node local $1"):service.name}</span>
            <span className={"service-state "+serviceStatus.toLowerCase()}>{serviceStatus==="ONLINE"?"Phản hồi":serviceStatus==="OFFLINE"?"Gián đoạn":"Chưa rõ"}</span></li>;
        })}</ul></details>
      </article>;
    })}</div>
    <p className="matrix-note">Không phản hồi dịch vụ chưa đủ để khẳng định máy đã tắt. IP LAN là địa chỉ máy trong cấu hình triển khai.</p>
  </section>;
}
