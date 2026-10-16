"use client";
import {usePolling} from "../../lib/usePolling";
import type {MonitoringOverview} from "../../types/monitoring";
import MachineMatrix from "../../components/MachineMatrix";
const label:Record<string,string>={HEALTHY:"Hoạt động ổn định",DEGRADED:"Đang suy giảm",UNAVAILABLE:"Tạm gián đoạn",UNKNOWN:"Chưa xác định",ONLINE:"Đang hoạt động",OFFLINE:"Mất kết nối"};
export default function MonitorPage() {
  const {data,error,loading,refresh}=usePolling<MonitoringOverview>("/api/monitoring/overview");
  const fresh=!!data?.observedAt&&!error&&Date.now()-Date.parse(data.observedAt)<45000;
  return <section><p className="eyebrow">GIÁM SÁT HỆ THỐNG</p><h1>Máy & cụm database</h1>
    {data&&<div className={"alert monitor-status-banner "+(fresh&&data.systemStatus==="HEALTHY"?"success":"notice")}>
      <strong>{fresh?label[data.systemStatus]:"Chưa có quan sát mới"}</strong>
      <div className="monitor-status-description">
        <p>{data.mode==="LOCAL_SINGLE_NODE"?"1 máy bàn · 1 node CockroachDB và 1 node Cassandra.":"Chế độ cụm máy dữ liệu."}</p>
      </div>
      <small className="monitor-status-time">Quan sát lúc: {data.observedAt?new Date(data.observedAt).toLocaleString("vi-VN"):"Chưa có kết quả"}</small>
    </div>}
    <div className="toolbar"><p>Cập nhật từ các kiểm tra thực tế của backend.</p><button onClick={refresh}>Kiểm tra lại</button></div>
    {error&&<p className="alert error" role="alert">Mất kết nối backend: {error}. Dữ liệu bên dưới là lần quan sát gần nhất.</p>}
    {loading&&!data&&<p role="status">Đang kiểm tra…</p>}
    {data&&<div className="monitor-columns"><div className="monitor-computers"><MachineMatrix machines={data.physicalMachines??[]} stale={!fresh} local={data.mode.startsWith("LOCAL_")}/></div>
      <section className="monitor-databases" aria-labelledby="database-status-title">
      <div className="monitor-column-heading"><p className="eyebrow">DATABASE</p><h2 id="database-status-title">Tình trạng database</h2></div>
      <div className="grid monitor-summary"><div className="card"><h2>CockroachDB</h2><p className="stat">{fresh?`${data.cockroach.activeNodes}/${data.cockroach.expectedNodes}`:"—"}</p><p>{fresh?label[data.cockroach.status]:label.UNKNOWN}</p><small>Truy vấn: {fresh&&data.cockroach.queryAvailable?"khả dụng":"chưa xác định"}</small></div>
      <div className="card"><h2>Cassandra</h2><p className="stat">{fresh?`${data.cassandra.activeNodes}/${data.cassandra.expectedNodes}`:"—"}</p><p>{fresh?label[data.cassandra.status]:label.UNKNOWN}</p><small>Truy vấn: {fresh&&data.cassandra.queryAvailable?"khả dụng":"chưa xác định"}</small></div>
      <div className="card"><h2>Đồng bộ sự kiện</h2><p className="stat">{fresh?data.outbox?.pending??"—":"—"}</p><p>Sự kiện đang chờ</p><small>{fresh&&data.outbox?data.outbox.failed+" sự kiện đang retry · chờ lâu nhất "+Math.round(data.outbox.oldestPendingAgeMs/1000)+" giây":"Chưa đọc được outbox"}</small></div></div>
      <h2>Các node dữ liệu</h2><div className="table-wrap"><table><thead><tr><th>Node</th><th>Địa chỉ</th><th>CockroachDB</th><th>Cassandra</th></tr></thead>
      <tbody>{data.machines.map(m=><tr key={m.machineId}><td>{m.machineId}</td><td>{m.host}</td><td><span className={"badge "+m.cockroach.toLowerCase()}>{label[m.cockroach]}</span></td><td><span className={"badge "+m.cassandra.toLowerCase()}>{label[m.cassandra]}</span></td></tr>)}</tbody></table></div>
      <h2 id="recent-changes-title">Thay đổi gần đây</h2>
      <div className="table-wrap"><table className="monitor-table transition-table" aria-labelledby="recent-changes-title">
        <thead><tr><th scope="col">Thời gian</th><th scope="col">Node / Database</th><th scope="col">Trước</th><th scope="col">Sau</th></tr></thead>
        <tbody>{data.transitions.length?data.transitions.slice(0,12).map((t,i)=>{
          const observedAt=new Date(t.observedAt);
          return <tr key={t.observedAt+t.service+t.machineId+i}>
            <td><time dateTime={t.observedAt}><span>{observedAt.toLocaleTimeString("vi-VN")}</span><small>{observedAt.toLocaleDateString("vi-VN")}</small></time></td>
            <th scope="row"><div className="transition-source"><span>{t.machineId}</span><small>{t.service}</small></div></th>
            <td><span className={"badge "+t.before.toLowerCase()}>{label[t.before]??t.before}</span></td>
            <td><span className={"badge "+t.after.toLowerCase()}>{label[t.after]??t.after}</span></td>
          </tr>;
        }):<tr><td colSpan={4} className="table-empty">Chưa ghi nhận thay đổi.</td></tr>}</tbody>
      </table></div>
      </section>
    </div>}
  </section>;
}
