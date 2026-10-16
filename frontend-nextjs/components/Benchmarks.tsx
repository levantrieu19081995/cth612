"use client";
import {usePolling} from "../lib/usePolling";
interface Result {
 file:string;
 summary:{scenario:string;mode:string;requests:number;success:number;errors:number;concurrency:number;throughput:number;p50:number;p95:number;p99:number;
 before:{cockroach:{activeNodes:number;expectedNodes:number};cassandra:{activeNodes:number;expectedNodes:number}};environment:string;startedAt:string};
}
export default function Benchmarks() {
 const {data,error}=usePolling<{results:Result[];invalidFiles:number}>("/api/benchmarks",10000);
 return <div className="card section-card"><h2>Benchmark đã đo</h2>
  <p>Các lần đo lưu trên máy ứng dụng. Kết quả local không thay thế số liệu trên 5 laptop.</p>
  {error&&<p className="alert error">{error}</p>}
  {data?.invalidFiles? <p className="alert notice">{data.invalidFiles} file kết quả không đọc được; cần kiểm tra dữ liệu.</p>:null}
  {data&&!data.results.length&&<p>Chưa có lần đo.</p>}
  {!!data?.results.length&&<div className="table-wrap"><table><thead><tr><th>Kịch bản</th><th>Workload</th><th>Node SQL / CQL</th><th>Thành công</th><th>p95 (ms)</th><th>Req/s</th><th>Kết quả</th></tr></thead>
   <tbody>{data.results.map(result=><tr key={result.file}><td>{result.summary.scenario}</td><td>{result.summary.mode==="booking"?"Đặt vé":"Đọc chuyến"}</td>
    <td>{result.summary.before.cockroach.activeNodes}/{result.summary.before.cockroach.expectedNodes} · {result.summary.before.cassandra.activeNodes}/{result.summary.before.cassandra.expectedNodes}</td>
    <td>{result.summary.success}/{result.summary.requests}</td><td>{result.summary.p95.toFixed(1)}</td><td>{result.summary.throughput.toFixed(1)}</td>
    <td><a href={"/api/benchmarks?download="+encodeURIComponent(result.file.replace(/\.json$/,".csv"))}>CSV ↓</a></td></tr>)}</tbody></table></div>}
 </div>;
}
