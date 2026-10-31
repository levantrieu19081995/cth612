"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, Box, Button, Divider, Group, List, Paper, ScrollArea, SegmentedControl, Select, Stack, Text, Title } from "@mantine/core";
import type { Placement, ReplicationSnapshot } from "../../types/replication";
import styles from "./topology.module.css";

interface DiagramNode {
  id: string;
  label: string;
  address: string;
  state: "online" | "offline" | "unknown";
  replica: boolean;
  leader?: boolean;
  detail?: string;
}

function DatabaseDiagram({ title, description, nodes, record, stale }: {
  title: string; description: string; nodes: DiagramNode[]; record: string; stale: boolean;
}) {
  const width = Math.max(680, nodes.length * 205);
  return (
    <Stack gap="xs">
      <Group justify="space-between">
        <Title order={3} size="md">{title}</Title>
        <Text size="xs" c="dimmed">{description}</Text>
      </Group>
      {!nodes.length ? <Text size="sm" c="dimmed">Chưa có thông tin node từ database.</Text> : (
        <ScrollArea type="auto">
          <svg width="100%" style={{ minWidth: width, display: "block" }} viewBox={`0 0 ${width} 285`} role="img" aria-label={`${title}: ${record}. ${nodes.map(node => `${node.label}, ${stale ? "chưa xác định" : node.state === "online" ? "đang hoạt động" : node.state === "offline" ? "mất kết nối" : "chưa xác định"}${node.replica ? ", có bản sao" : ""}`).join("; ")}`}>
            <rect x={width / 2 - 155} y={12} width={310} height={52} rx={12} fill="var(--mantine-color-blue-light)" stroke="var(--mantine-color-blue-5)" />
            <text x={width / 2} y={43} textAnchor="middle" fill="var(--mantine-color-blue-7)" fontSize={14} fontWeight={600}>{record.length > 34 ? `${record.slice(0, 31)}…` : record}</text>
            {nodes.map((node, index) => {
              const x = (index + 0.5) * width / nodes.length;
              const color = stale || node.state === "unknown" ? "gray" : node.state === "offline" ? "red" : node.replica ? "teal" : "gray";
              return (
                <g key={node.id}>
                  <title>{node.label} · {node.address} · {node.replica ? "Giữ bản sao" : "Không giữ bản sao được chọn"}{node.leader ? " · Leaseholder" : ""}</title>
                  {node.replica && <path d={`M ${width / 2} 64 C ${width / 2} 105, ${x} 105, ${x} 150`} fill="none" stroke={`var(--mantine-color-${color}-5)`} strokeWidth={2} strokeDasharray="6 5" className={!stale && node.state === "online" ? styles.flow : undefined} />}
                  <rect x={x - 92} y={150} width={184} height={115} rx={14} fill={`var(--mantine-color-${color}-light)`} stroke={`var(--mantine-color-${color}-5)`} strokeWidth={node.replica ? 2 : 1} className={styles.node} />
                  <circle cx={x - 70} cy={173} r={4} fill={`var(--mantine-color-${color}-6)`} />
                  <text x={x - 58} y={178} fill="var(--mantine-color-text)" fontSize={14} fontWeight={700}>{node.label}</text>
                  <text x={x} y={198} textAnchor="middle" fill="var(--mantine-color-dimmed)" fontSize={11}>{node.address.length > 25 ? `${node.address.slice(0, 22)}…` : node.address}</text>
                  <text x={x} y={220} textAnchor="middle" fill={`var(--mantine-color-${color}-7)`} fontSize={12} fontWeight={600}>{stale || node.state === "unknown" ? "Chưa xác định" : node.state === "online" ? "Đang hoạt động" : "Mất kết nối"}</text>
                  <text x={x} y={240} textAnchor="middle" fill="var(--mantine-color-text)" fontSize={11}>{node.replica ? node.leader ? "Bản sao · Leaseholder" : "Giữ bản sao" : "Không giữ bản sao đã chọn"}</text>
                  {node.detail && <text x={x} y={255} textAnchor="middle" fill="var(--mantine-color-dimmed)" fontSize={10}>{node.detail}</text>}
                </g>
              );
            })}
          </svg>
        </ScrollArea>
      )}
    </Stack>
  );
}

function changes(previous: ReplicationSnapshot, current: ReplicationSnapshot): string[] {
  const result: string[] = [];
  if (previous.cockroach.status !== "UNAVAILABLE" && current.cockroach.status !== "UNAVAILABLE") {
    for (const node of current.cockroach.nodes) {
      const before = previous.cockroach.nodes.find(item => item.nodeId === node.nodeId);
      if (before && before.live !== node.live) result.push(`CockroachDB #${node.nodeId}: ${node.live ? "kết nối trở lại" : "mất kết nối"}.`);
    }
    for (const sample of current.samples) {
      const before = previous.samples.find(item => item.bookingId === sample.bookingId);
      if (!before || before.rangeId === null || sample.rangeId === null) continue;
      if (before.leaseHolder !== sample.leaseHolder) result.push(`${sample.bookingCode}: leaseholder ${before.leaseHolder ?? "—"} → ${sample.leaseHolder ?? "—"}.`);
      if ([...before.cockroachReplicas].sort().join() !== [...sample.cockroachReplicas].sort().join()) result.push(`${sample.bookingCode}: bản sao CockroachDB [${before.cockroachReplicas.join(", ")}] → [${sample.cockroachReplicas.join(", ")}].`);
    }
  }
  if (previous.cassandra.status !== "UNAVAILABLE" && current.cassandra.status !== "UNAVAILABLE") {
    for (const node of current.cassandra.nodes) {
      const before = previous.cassandra.nodes.find(item => item.address === node.address);
      if (before && before.state !== node.state) result.push(`Cassandra ${node.address}: ${before.state} → ${node.state}.`);
    }
    for (const sample of current.samples) {
      const before = previous.samples.find(item => item.bookingId === sample.bookingId);
      if (before?.cassandraReplicas.length && sample.cassandraReplicas.length &&
        [...before.cassandraReplicas].sort().join() !== [...sample.cassandraReplicas].sort().join()) {
        result.push(`${sample.bookingCode}: vị trí bản sao Cassandra [${before.cassandraReplicas.join(", ")}] → [${sample.cassandraReplicas.join(", ")}].`);
      }
    }
  }
  return result;
}

export default function ReplicationTopology({ data, stale }: { data: ReplicationSnapshot | null; stale: boolean }) {
  const [mode, setMode] = useState("live");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [offline, setOffline] = useState<number[]>([]);
  const [demoRange, setDemoRange] = useState("0");
  const [events, setEvents] = useState<string[]>([]);
  const previous = useRef<ReplicationSnapshot | null>(null);
  useEffect(() => {
    if (!data || stale) return;
    if (previous.current && previous.current.observedAt !== data.observedAt) {
      const detected = changes(previous.current, data);
      if (detected.length) setEvents(old => [...detected.map(message => `${new Date(data.observedAt).toLocaleTimeString("vi-VN")} · ${message}`), ...old].slice(0, 12));
    }
    previous.current = data;
  }, [data, stale]);

  const sample: Placement | undefined = data?.samples.find(item => item.bookingId === selectedId) ?? data?.samples[0];
  const demo = mode === "demo";
  const replicaIds = [[1, 2, 3], [2, 3, 4], [1, 3, 4]][Number(demoRange)];
  const liveCopies = replicaIds.filter(id => !offline.includes(id)).length;
  const majority = Math.floor(replicaIds.length / 2) + 1;
  const demoLeader = liveCopies >= majority ? replicaIds.find(id => !offline.includes(id)) : undefined;
  const demoNodes: DiagramNode[] = [1, 2, 3, 4].map(id => ({ id: String(id), label: `Máy ${id}`, address: "Máy mô phỏng", state: offline.includes(id) ? "offline" : "online", replica: replicaIds.includes(id), leader: id === demoLeader }));
  const crNodes: DiagramNode[] = data?.cockroach.nodes.map(node => ({ id: String(node.nodeId), label: `Node #${node.nodeId}`, address: node.address, state: node.live ? "online" : "offline", replica: sample?.cockroachReplicas.includes(node.nodeId) ?? false, leader: sample?.leaseHolder === node.nodeId, detail: `${node.replicaRanges} range giữ bản sao` })) ?? [];
  for (const id of sample?.cockroachReplicas ?? []) if (!crNodes.some(node => node.id === String(id))) crNodes.push({ id: String(id), label: `Node #${id}`, address: "Thiếu metadata node", state: "unknown", replica: true });
  const csNodes: DiagramNode[] = data?.cassandra.nodes.map(node => ({ id: node.address, label: "Cassandra", address: node.address, state: node.state === "UP" ? "online" : node.state === "DOWN" || node.state === "FORCED_DOWN" ? "offline" : "unknown", replica: sample?.cassandraReplicas.includes(node.address) ?? false, detail: node.datacenter })) ?? [];
  for (const address of sample?.cassandraReplicas ?? []) if (!csNodes.some(node => node.id === address)) csNodes.push({ id: address, label: "Cassandra", address, state: "unknown", replica: true });
  const actualCopies = sample?.cockroachReplicas.length ?? 0;
  const actualLive = crNodes.filter(node => node.replica && node.state === "online").length;
  const unknownCopies = crNodes.some(node => node.replica && node.state === "unknown");
  const knownQuorum = !stale && data?.cockroach.status !== "UNAVAILABLE" && sample?.rangeId != null && actualCopies > 0 && !unknownCopies;

  return (
    <Paper withBorder radius="xl" p={{ base: "md", sm: "lg" }}>
      <Stack gap="md">
        <Group justify="space-between">
          <Box><Title order={2} size="xl">Sơ đồ phân tán dữ liệu</Title><Text size="sm" c="dimmed">Chọn một vé để xem node giữ bản sao và node phục vụ range.</Text></Box>
          <SegmentedControl aria-label="Chế độ sơ đồ phân tán" value={mode} onChange={setMode} data={[{ value: "live", label: "Dữ liệu thực tế" }, { value: "demo", label: "Mô phỏng 4 máy" }]} />
        </Group>
        {demo ? (
          <>
            <Alert color="blue" title="Mô phỏng trên giao diện">Thử tắt/bật các máy bên dưới để quan sát quorum. Các thao tác này không thay đổi cụm database thật.</Alert>
            <Group align="flex-end">
              <Select label="Dữ liệu minh họa" value={demoRange} onChange={value => value && setDemoRange(value)} data={[{ value: "0", label: "Range A · máy 1, 2, 3" }, { value: "1", label: "Range B · máy 2, 3, 4" }, { value: "2", label: "Range C · máy 1, 3, 4" }]} />
              <Button variant="default" onClick={() => setOffline([])}>Khôi phục tất cả</Button>
            </Group>
            <Group>{[1, 2, 3, 4].map(id => <Button key={id} variant="light" color={offline.includes(id) ? "teal" : "red"} aria-pressed={offline.includes(id)} onClick={() => setOffline(old => old.includes(id) ? old.filter(item => item !== id) : [...old, id])}>{offline.includes(id) ? "Bật" : "Tắt"} máy {id}</Button>)}</Group>
            <Alert color={liveCopies >= majority ? "teal" : "red"} title={liveCopies >= majority ? "Còn quorum · tiếp tục đọc/ghi" : "Mất quorum · không thể xác nhận đọc/ghi"}>
              Còn {liveCopies}/3 bản sao của range đã chọn, cần {majority}. Cassandra RF=3 với LOCAL_QUORUM cũng cần 2 bản sao phản hồi. Mô hình giữ cố định vị trí bản sao; chưa mô phỏng tái cân bằng.
            </Alert>
            <DatabaseDiagram title="CockroachDB · mô phỏng" description="Đường nối = bản sao · Leaseholder = node phục vụ" nodes={demoNodes} record={`Range ${["A", "B", "C"][Number(demoRange)]} · dữ liệu minh họa`} stale={false} />
            <DatabaseDiagram title="Cassandra · mô phỏng" description="RF=3 · LOCAL_QUORUM" nodes={demoNodes.map(node => ({ ...node, leader: false }))} record="Sự kiện minh họa · 3 bản sao" stale={false} />
          </>
        ) : (
          <>
            {(!data || stale) && <Alert color="orange" title="Chưa có quan sát mới">{data ? "Sơ đồ đang hiển thị lần đọc trước; trạng thái hiện tại chưa xác định." : "Chờ API cung cấp metadata cụm. Có thể chuyển sang Mô phỏng 4 máy để xem minh họa."}</Alert>}
            <Select label="Vé cần xem vị trí lưu trữ" placeholder="Chưa có vé mẫu" value={sample?.bookingId ?? null} onChange={setSelectedId} disabled={!data?.samples.length} data={data?.samples.map(item => ({ value: item.bookingId, label: item.bookingCode })) ?? []} searchable />
            {sample && <Text size="sm" c={knownQuorum ? actualLive >= Math.floor(actualCopies / 2) + 1 ? "teal.7" : "red.7" : "dimmed"} fw={600}>
              {knownQuorum ? `Range #${sample.rangeId}: ${actualLive}/${actualCopies} bản sao đang sống · cần ${Math.floor(actualCopies / 2) + 1} · ${actualLive >= Math.floor(actualCopies / 2) + 1 ? "còn quorum" : "mất quorum"}` : "Chưa đủ metadata mới để kết luận quorum của vé này."}
            </Text>}
            <DatabaseDiagram title="CockroachDB · vị trí dòng booking" description="Vị trí từ range metadata" nodes={crNodes} record={sample ? `${sample.bookingCode} · Range #${sample.rangeId ?? "?"}` : "Chọn vé để xem bản sao"} stale={stale || data?.cockroach.status === "UNAVAILABLE"} />
            <DatabaseDiagram title="Cassandra · vị trí phân vùng sự kiện" description="Vị trí theo token map" nodes={csNodes} record={sample?.bookingCode ?? "Chọn vé để xem bản sao"} stale={stale || data?.cassandra.status === "UNAVAILABLE"} />
            <Text size="xs" c="dimmed">Xanh lá: bản sao trên node đang hoạt động · Đỏ: node mất kết nối · Xám: chưa xác định hoặc không giữ bản sao đã chọn. Vị trí Cassandra lấy từ token map, không xác nhận từng sự kiện đã được ghi. Hai cụm hiển thị riêng theo địa chỉ thực tế, không tự suy đoán chúng nằm cùng máy vật lý.</Text>
            <Divider />
            <Title order={3} size="md">Thay đổi quan sát trong phiên này</Title>
            {events.length ? <List size="sm" spacing="xs">{events.map((event, index) => <List.Item key={`${event}-${index}`}>{event}</List.Item>)}</List> : <Text size="sm" c="dimmed">Chưa ghi nhận thay đổi giữa các lần đọc. Hệ thống tự kiểm tra lại khoảng 10 giây/lần.</Text>}
          </>
        )}
      </Stack>
    </Paper>
  );
}
