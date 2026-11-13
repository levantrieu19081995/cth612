"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, Anchor, Badge, Button, Code, Group, Modal, Paper, Select, SimpleGrid, Stack, Table, Text, TextInput, Title } from "@mantine/core";
import { IconDatabase, IconRefresh, IconSearch } from "@tabler/icons-react";
import { apiGet } from "../../lib/api";
import type { ReplicationSnapshot } from "../../types/replication";
import type { DistributionCounts, DistributionPage, DistributionRow } from "../../types/distribution";

type Filters = { database: string; table: string; query: string; date: string; node: string; limit: string };
const defaults: Filters = { database: "cockroach", table: "bookings", query: "", date: "", node: "", limit: "20" };
const tables = {
  cockroach: ["bookings", "payments", "outbox_events", "flight_seats"],
  cassandra: ["booking_events_by_booking", "booking_events_by_day"],
};
const message = (error: unknown) => error instanceof Error ? error.message : "Không đọc được dữ liệu. Hãy thử lại.";
const when = (value: string | null) => value ? new Date(value).toLocaleString("vi-VN") : "—";

export default function DistributionBrowser({ snapshot }: { snapshot?: ReplicationSnapshot }) {
  const [form, setForm] = useState<Filters>(defaults);
  const [applied, setApplied] = useState<Filters>(defaults);
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [pageIndex, setPageIndex] = useState(0);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<DistributionPage | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [counts, setCounts] = useState<DistributionCounts | null>(null);
  const [countError, setCountError] = useState("");
  const [countLoading, setCountLoading] = useState(false);
  const [selected, setSelected] = useState<DistributionRow | null>(null);
  const [timeline, setTimeline] = useState<{ events: { eventId: string; eventType: string; occurredAt: string }[]; pendingEvents: number } | null>(null);
  const [timelineError, setTimelineError] = useState("");
  const [timelineLoading, setTimelineLoading] = useState(false);
  const detailRequest = useRef(0);
  const cursor = cursors[pageIndex] ?? null;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setData(null);
    const params = { ...applied, limit: Number(applied.limit), cursor: cursor ?? undefined };
    apiGet<DistributionPage>("/api/monitoring/distribution/records", { params, signal: controller.signal })
      .then(value => { if (!controller.signal.aborted) setData(value); })
      .catch(reason => { if (!controller.signal.aborted) setError(message(reason)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [applied, cursor, revision]);

  function apply() {
    setApplied({ ...form, query: form.query.trim() }); setCursors([null]); setPageIndex(0); setRevision(n => n + 1);
  }
  function changeDatabase(database: string) {
    setForm({ ...defaults, database, table: tables[database as keyof typeof tables][0] });
  }
  function changeTable(table: string) {
    setForm({ ...form, table, query: "", date: table === "booking_events_by_day" ? new Date().toISOString().slice(0, 10) : "" });
  }
  async function readCounts() {
    setCountLoading(true); setCountError("");
    try { setCounts(await apiGet<DistributionCounts>("/api/monitoring/distribution/counts")); }
    catch (reason) { setCountError(message(reason)); }
    finally { setCountLoading(false); }
  }
  function open(row: DistributionRow) {
    detailRequest.current++; setSelected(row); setTimeline(null); setTimelineError(""); setTimelineLoading(false);
  }
  async function readEvents() {
    if (!selected?.bookingId) return;
    const request = ++detailRequest.current;
    setTimelineLoading(true); setTimelineError("");
    try {
      const value = await apiGet<{ events: { eventId: string; eventType: string; occurredAt: string }[]; pendingEvents: number }>(`/api/bookings/${selected.bookingId}/events`);
      if (detailRequest.current === request) setTimeline(value);
    } catch (reason) { if (detailRequest.current === request) setTimelineError(message(reason)); }
    finally { if (detailRequest.current === request) setTimelineLoading(false); }
  }
  const isCassandra = form.database === "cassandra";
  const isDay = form.table === "booking_events_by_day";
  const nodes = isCassandra
    ? (snapshot?.cassandra.nodes ?? []).map(n => ({ value: n.address, label: `${n.address} · ${n.state}` }))
    : (snapshot?.cockroach.nodes ?? []).map(n => ({ value: String(n.nodeId), label: `Node ${n.nodeId} · ${n.address}` }));
  const needsPartition = isCassandra && (isDay ? !form.date : !form.query.trim());

  return <Stack gap="lg">
    <Paper withBorder radius="xl" p={{ base: "md", sm: "lg" }}>
      <Stack gap="md">
        <Group justify="space-between">
          <div><Title order={2} fz="xl">Cassandra — số dòng theo bảng</Title><Text size="sm" c="dimmed">Đếm khi bạn yêu cầu; kết quả được giữ tối đa 60 giây.</Text></div>
          <Button variant="light" loading={countLoading} onClick={readCounts} leftSection={<IconDatabase size={17} />}>Đếm dữ liệu</Button>
        </Group>
        {countError && <Alert color="red" role="alert">{countError}</Alert>}
        {counts ? <Table.ScrollContainer minWidth={550}><Table striped>
          <Table.Thead><Table.Tr><Table.Th>Bảng</Table.Th><Table.Th>Số dòng</Table.Th><Table.Th>Kết quả</Table.Th><Table.Th>Đọc lúc</Table.Th></Table.Tr></Table.Thead>
          <Table.Tbody>{counts.tables.map(t => <Table.Tr key={t.table}><Table.Td>{t.table}</Table.Td><Table.Td>{t.rows === null ? "—" : t.rows.toLocaleString("vi-VN")}</Table.Td><Table.Td><Badge color={t.status === "EXACT" ? "teal" : "orange"}>{t.status === "EXACT" ? "Đếm trực tiếp" : "Chưa đọc được"}</Badge></Table.Td><Table.Td>{when(t.observedAt)}</Table.Td></Table.Tr>)}</Table.Tbody>
        </Table></Table.ScrollContainer> : <Text c="dimmed" size="sm">Chưa thực hiện đếm. Số sự kiện đã gửi từ outbox không thay thế số dòng thực trong Cassandra.</Text>}
        <Text size="sm" c="dimmed">Số dòng ở đây là dữ liệu logic, không cộng nhân theo số replica. Hai bảng Cassandra lưu sự kiện theo hai cách tra cứu khác nhau. Truy vấn quá thời gian sẽ hiện “Chưa đọc được”.</Text>
      </Stack>
    </Paper>

    <Paper withBorder radius="xl" p={{ base: "md", sm: "lg" }}>
      <Stack gap="md">
        <Group justify="space-between"><div><Title order={2} fz="xl">Dữ liệu đang nằm ở đâu</Title><Text size="sm" c="dimmed">Tìm dữ liệu và xem các node giữ bản sao theo thông tin phân bố của cụm.</Text></div><Button variant="light" onClick={() => setRevision(n => n + 1)} loading={loading} leftSection={<IconRefresh size={17} />}>Làm mới danh sách</Button></Group>
        <form onSubmit={event => { event.preventDefault(); apply(); }}>
          <Stack gap="sm">
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
              <Select label="Database" data={[{ value: "cockroach", label: "CockroachDB" }, { value: "cassandra", label: "Cassandra" }]} value={form.database} onChange={v => v && changeDatabase(v)} allowDeselect={false} />
              <Select label="Bảng dữ liệu" data={tables[form.database as keyof typeof tables]} value={form.table} onChange={v => v && changeTable(v)} allowDeselect={false} />
              <Select label="Node giữ bản sao" placeholder="Tất cả node" clearable searchable data={nodes} value={form.node || null} onChange={v => setForm({ ...form, node: v ?? "" })} />
              <Select label="Số dòng mỗi trang" data={["20", "50", "100"]} value={form.limit} onChange={v => v && setForm({ ...form, limit: v })} allowDeselect={false} />
            </SimpleGrid>
            <Group align="end">
              {isDay ? <TextInput style={{ flex: 1 }} label="Ngày sự kiện (UTC)" type="date" required value={form.date} onChange={e => setForm({ ...form, date: e.currentTarget.value })} /> : <TextInput style={{ flex: 1 }} label={isCassandra ? "Mã vé hoặc UUID booking (bắt buộc)" : form.table === "flight_seats" ? "Tìm số ghế hoặc UUID" : "Tìm mã vé hoặc UUID dòng"} value={form.query} maxLength={100} onChange={e => setForm({ ...form, query: e.currentTarget.value })} />}
              <Button type="submit" loading={loading} disabled={needsPartition} leftSection={<IconSearch size={17} />}>Áp dụng</Button>
            </Group>
          </Stack>
        </form>
        <Text size="sm" c="dimmed">Danh sách giữ nguyên trong lúc bạn xem. Chỉ cập nhật khi áp dụng bộ lọc, chuyển trang hoặc bấm làm mới. Cassandra tra theo partition mã vé hoặc ngày UTC, không quét toàn bảng để tìm kiếm.</Text>
        {error && <Alert color="red" role="alert">{error}</Alert>}
        {loading && <Text role="status" c="dimmed">Đang đọc dữ liệu…</Text>}
        {data && <>
          <Badge variant="light" w="fit-content">{applied.database === "cockroach" ? "CockroachDB" : "Cassandra"} / {applied.table}</Badge>
          <Table.ScrollContainer minWidth={780}><Table striped highlightOnHover>
            <Table.Thead><Table.Tr><Table.Th>Mã / khóa dữ liệu</Table.Th><Table.Th>Trạng thái / loại</Table.Th><Table.Th>Range / partition</Table.Th><Table.Th>Node giữ bản sao</Table.Th><Table.Th /></Table.Tr></Table.Thead>
            <Table.Tbody>{data.rows.map(row => <Table.Tr key={row.id}>
              <Table.Td><Text fw={650}>{row.label}</Text><Text size="xs" c="dimmed" style={{ overflowWrap: "anywhere" }}>{row.id}</Text></Table.Td>
              <Table.Td>{row.status}</Table.Td>
              <Table.Td><Text size="sm" style={{ overflowWrap: "anywhere" }}>{row.partition ?? (row.rangeId === null ? "Chưa xác định" : `Range #${row.rangeId}`)}</Text></Table.Td>
              <Table.Td><Text size="sm">{row.placementStatus === "UNKNOWN" ? "Chưa đọc được vị trí" : row.replicas.map(n => applied.database === "cockroach" ? `Node ${n}${String(row.leaseholder) === n ? " (phục vụ)" : ""}` : n).join(", ") || "Chưa xác định"}</Text></Table.Td>
              <Table.Td><Button variant="subtle" size="xs" onClick={() => open(row)}>Xem chi tiết</Button></Table.Td>
            </Table.Tr>)}{!data.rows.length && <Table.Tr><Table.Td colSpan={5}><Text ta="center" c="dimmed" py="lg">{data.hasMore ? "Chưa có dòng khớp trong lượt quét này. Bấm Tiếp để tìm tiếp." : "Không có dữ liệu phù hợp."}</Text></Table.Td></Table.Tr>}</Table.Tbody>
          </Table></Table.ScrollContainer>
          <Group justify="space-between"><Text size="sm" c="dimmed">Trang {pageIndex + 1} · {data.rows.length} dòng hiển thị · đã xét {data.scanned} dòng · {when(data.observedAt)}</Text><Group><Button variant="default" disabled={pageIndex === 0 || loading} onClick={() => setPageIndex(i => i - 1)}>Trước</Button><Button variant="light" disabled={!data.hasMore || !data.nextCursor || loading} onClick={() => { setCursors(old => [...old.slice(0, pageIndex + 1), data.nextCursor]); setPageIndex(i => i + 1); }}>Tiếp</Button></Group></Group>
        </>}
        <Alert color="blue">Vị trí replica lấy từ metadata của cụm. Thông tin này không xác nhận từng replica đã nhận bản ghi hoặc đã đồng bộ hoàn toàn. Không cộng số dòng lặp trên các replica thành tổng dữ liệu gốc.</Alert>
      </Stack>
    </Paper>

    <Modal opened={selected !== null} onClose={() => { detailRequest.current++; setSelected(null); }} title="Chi tiết vị trí dữ liệu" size="lg">
      {selected && <Stack gap="sm">
        <Text fw={700}>{selected.label}</Text><Code block>{selected.id}</Code>
        <Text>Trạng thái: {selected.status}</Text><Text>Thời điểm dữ liệu: {when(selected.occurredAt)}</Text>
        <Text style={{ overflowWrap: "anywhere" }}>{selected.partition ? `Partition: ${selected.partition}` : `Range: ${selected.rangeId ?? "Chưa xác định"}`}</Text>
        <Text style={{ overflowWrap: "anywhere" }}>Node giữ bản sao theo metadata: {selected.replicas.join(", ") || "Chưa xác định"}</Text>
        {selected.bookingId && <><Anchor href={`/bookings/${selected.bookingId}`}>Mở thông tin vé</Anchor><Button variant="light" loading={timelineLoading} onClick={readEvents}>Xem lịch sử sự kiện Cassandra</Button></>}
        {timelineError && <Alert color="orange" role="alert">{timelineError}</Alert>}
        {timeline && <><Text>Sự kiện còn chờ trong outbox: {timeline.pendingEvents}</Text>{timeline.events.length ? timeline.events.map(event => <Paper key={event.eventId} withBorder p="sm"><Text fw={600}>{event.eventType}</Text><Text size="sm" c="dimmed">{when(event.occurredAt)}</Text></Paper>) : <Text c="dimmed">Chưa đọc được sự kiện nào cho vé này.</Text>}</>}
      </Stack>}
    </Modal>
  </Stack>;
}
