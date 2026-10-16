"use client";
import {usePolling} from "../../lib/usePolling";
import type {ReplicationSnapshot} from "../../types/replication";

// Every number on this page comes from /api/monitoring/replication, which reads CockroachDB ranges and
// Cassandra token ownership; explanatory sentences only describe those measured values.
export default function ReplicationPage() {
  const {data,error,loading,refresh}=usePolling<ReplicationSnapshot>("/api/monitoring/replication",10000);
  const cr=data?.cockroach,cs=data?.cassandra;
  const nodeName=(id:number)=>cr?.nodes.find(n=>n.nodeId===id)?.address.replace(/:\d+$/,"")??`node ${id} (không còn trong cụm)`;
  const copiesText=cr?(cr.minCopies===cr.maxCopies?`${cr.maxCopies}`:`${cr.minCopies}–${cr.maxCopies}`):"—";
  return <section><p className="eyebrow">PHÂN TÁN DỮ LIỆU</p><h1>Dữ liệu nằm ở đâu, có bao nhiêu bản</h1>
    <div className="toolbar"><p>Đọc trực tiếp từ CockroachDB (range, bản sao) và Cassandra (token, replication factor).</p><button onClick={refresh}>Làm mới</button></div>
    {error&&<p className="alert error" role="alert">Mất kết nối backend: {error}. Dữ liệu bên dưới là lần đọc trước.</p>}
    {loading&&!data&&<p role="status">Đang đọc vị trí dữ liệu…</p>}
    {data&&cr&&cs&&<>
      <div className="grid monitor-summary">
        <div className="card"><h2>CockroachDB</h2>
          {cr.status==="UNAVAILABLE"?<p className="alert error">Không đọc được thông tin range ({cr.error}).</p>:<>
          <p className="stat">{copiesText} / {cr.targetReplicas??"?"}</p><p>bản sao mỗi range (thực tế / cấu hình)</p>
          <small>{cr.ranges} range · {cr.liveNodes}/{cr.knownNodes} node đang sống</small>
          <p className={"alert "+(cr.rangesWithoutMajority?"error":"success")}>{cr.rangesWithoutMajority
            ?`${cr.rangesWithoutMajority} range mất đa số bản sao → phần dữ liệu đó không đọc/ghi được cho tới khi node quay lại.`
            :"Mọi range còn đa số bản sao đang sống → đọc/ghi được."}</p>
          {cr.targetReplicas!==null&&cr.maxCopies<cr.targetReplicas&&<p className="alert notice">{cr.knownNodes<cr.targetReplicas
            ?`Cụm mới có ${cr.knownNodes} node nên chưa đủ chỗ cho ${cr.targetReplicas} bản sao. CockroachDB chỉ giữ số bản sao lẻ (2 bản kém an toàn hơn 1 bản), nên mỗi range đang có ${cr.maxCopies} bản. Cần từ ${cr.targetReplicas} node để có ${cr.targetReplicas} bản sao.`
            :`Cụm đã đủ node; CockroachDB đang tạo thêm bản sao cho tới ${cr.targetReplicas} bản mỗi range.`}</p>}
          </>}
        </div>
        <div className="card"><h2>Cassandra</h2>
          {cs.status==="UNAVAILABLE"?<p className="alert error">Không đọc được metadata Cassandra ({cs.error}).</p>:<>
          <p className="stat">{cs.copiesPerRow??"—"} / {cs.replicationFactor??"?"}</p><p>bản sao mỗi dòng sự kiện (thực tế / RF)</p>
          <small>{cs.strategy} · {cs.liveNodes}/{cs.nodesInDatacenter} node UP · ghi ở mức {cs.consistency} cần {cs.requiredForWrite} bản sao xác nhận</small>
          <p className={"alert "+(cs.writableWorstCase?"success":"error")}>{cs.writableWorstCase
            ?`Kể cả dòng có bản sao trên node đang tắt vẫn còn ${cs.liveCopiesWorstCase} bản sống ≥ ${cs.requiredForWrite} → ghi được.`
            :`Trường hợp xấu nhất chỉ còn ${cs.liveCopiesWorstCase} bản sống < ${cs.requiredForWrite} cần cho ${cs.consistency} → có dòng không ghi được; sự kiện chờ trong outbox và tự gửi lại khi node quay về.`}</p>
          </>}
        </div>
      </div>

      {cr.status!=="UNAVAILABLE"&&<>
        <h2>CockroachDB — mỗi node giữ gì</h2>
        <p className="muted">Leaseholder: node đang phục vụ đọc/ghi cho range đó. Bản sao: node giữ một bản dữ liệu của range.</p>
        <div className="table-wrap"><table><thead><tr><th>Node</th><th>Địa chỉ</th><th>Trạng thái</th><th>Range đang phục vụ</th><th>Range giữ bản sao</th></tr></thead>
          <tbody>{cr.nodes.map(n=><tr key={n.nodeId}><td>{n.nodeId}</td><td>{n.address}</td>
            <td><span className={"badge "+(n.live?"online":"offline")}>{n.live?"Đang sống":"Mất kết nối"}</span></td>
            <td>{n.leaseholderRanges}</td><td>{n.replicaRanges}/{cr.ranges}</td></tr>)}</tbody></table></div>
        <h2>CockroachDB — theo bảng</h2>
        <div className="table-wrap"><table><thead><tr><th>Bảng</th><th>Số range</th><th>Dung lượng</th><th>Số bản sao</th></tr></thead>
          <tbody>{cr.tables.map(t=><tr key={t.table}><td>{t.table}</td><td>{t.ranges}</td><td>{t.sizeMb.toFixed(3)} MB</td>
            <td>{Object.entries(t.rangesByCopies).map(([copies,count])=>`${count} range × ${copies} bản`).join(", ")||"—"}</td></tr>)}</tbody></table></div>
        <p className="muted">Bảng nhỏ (vài MB) nằm gọn trong một range; CockroachDB chỉ tự chia khi range vượt 512 MB. Dùng <code>split-ranges.mjs</code> trên PC1 để chia và rải lên các node.</p>
      </>}

      {cs.status!=="UNAVAILABLE"&&<>
        <h2>Cassandra — các node trong cụm</h2>
        <div className="table-wrap"><table><thead><tr><th>Địa chỉ</th><th>Datacenter</th><th>Trạng thái</th></tr></thead>
          <tbody>{cs.nodes.map(n=><tr key={n.address}><td>{n.address}</td><td>{n.datacenter}</td>
            <td><span className={"badge "+(n.state==="UP"?"online":"offline")}>{n.state}</span></td></tr>)}</tbody></table></div>
      </>}

      <h2>5 vé mới nhất đang nằm ở đâu</h2>
      {!data.samples.length?<p className="muted">Chưa có vé hoặc CockroachDB chưa đọc được.</p>:
      <div className="table-wrap"><table><thead><tr><th>Mã vé</th><th>CockroachDB (dòng booking)</th><th>Cassandra (lịch sử sự kiện)</th></tr></thead>
        <tbody>{data.samples.map(s=><tr key={s.bookingId}><td><a href={`/bookings/${s.bookingId}`}>{s.bookingCode}</a></td>
          <td>{s.rangeId===null?"—":<>Range #{s.rangeId}: {s.cockroachReplicas.map(id=>nodeName(id)+(id===s.leaseHolder?" (phục vụ)":"")).join(", ")}</>}</td>
          <td>{s.cassandraReplicas.length?s.cassandraReplicas.join(", "):"—"}</td></tr>)}</tbody></table></div>}

      <div className="card section-card"><h2>Cách đọc trang này</h2><ul>
        <li>Một range CockroachDB chỉ đọc/ghi được khi <strong>đa số</strong> bản sao của nó còn sống (3 bản → cần 2).</li>
        <li>Với 3 bản sao trên 4 máy, tắt 1 máy mỗi range vẫn còn ít nhất 2/3 → hệ thống tiếp tục đặt vé.</li>
        <li>Cassandra ghi ở mức {cs.consistency??"LOCAL_QUORUM"}: cần {cs.requiredForWrite??"đa số"} bản sao xác nhận. Không đủ thì sự kiện nằm chờ trong outbox của CockroachDB, không bị mất.</li>
      </ul><small>Quan sát lúc {new Date(data.observedAt).toLocaleString("vi-VN")}</small></div>
    </>}
  </section>;
}
