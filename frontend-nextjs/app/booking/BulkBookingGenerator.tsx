"use client";

import { useEffect, useRef, useState } from "react";
import { Accordion, Alert, Anchor, Button, Group, Modal, Pagination, Progress, SimpleGrid, Stack, Table, Text } from "@mantine/core";
import { IconDatabase, IconPlayerPause } from "@tabler/icons-react";
import { ApiError, apiPost } from "../../lib/api";
import type { BookingGroup } from "../../types/booking";
import { money } from "../../components/utils/func";
import { bindInventory, createPreviewInventory, createBulkPlan, ticketCount, type BulkPlan, type InventoryFlight } from "./bulk-bookings";

const STORAGE_KEY = "cth612.bulk-bookings.v1";
const cabinLabels: Record<string, string> = { ECONOMY: "Phổ thông", PREMIUM_ECONOMY: "Phổ thông đặc biệt", BUSINESS: "Thương gia" };
const mealLabels: Record<string, string> = { CHICKEN: "Cơm gà", VEGETARIAN: "Suất chay", SANDWICH: "Sandwich" };
interface Checkpoint {
  batchId: string;
  plan: BulkPlan | null;
  inventoryReady?: boolean;
  next: number;
  groups: { groupCode: string; tickets: number }[];
}

export default function BulkBookingGenerator() {
  const [checkpoint, setCheckpoint] = useState<Checkpoint | null>(null);
  const [busy, setBusy] = useState<"prepare" | "submit" | null>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [preview, setPreview] = useState(false);
  const [page, setPage] = useState(1);
  const lock = useRef(false);
  const stopped = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const value = JSON.parse(saved) as Checkpoint;
        if (typeof value.batchId !== "string" || !Number.isInteger(value.next) || !Array.isArray(value.groups) ||
          value.next < 0 || value.groups.length !== value.next ||
          (value.plan && (ticketCount(value.plan.requests) !== 1000 || value.next > value.plan.requests.length))) {
          throw new Error("Lô đã lưu không hợp lệ.");
        }
        // Older checkpoints were generated from API inventory already.
        setCheckpoint({ ...value, inventoryReady: value.inventoryReady ?? !!value.plan });
      }
    } catch {
      setError("Không đọc được lô đã lưu. Kiểm tra quyền lưu trữ của trình duyệt trước khi tạo lô mới.");
    }
    setReady(true);
    return () => { mounted.current = false; stopped.current = true; };
  }, []);

  function save(value: Checkpoint) {
    // Persist before proceeding; retries always retain the same booking request IDs.
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    if (mounted.current) setCheckpoint(value);
  }

  async function prepare(newBatch = false) {
    if (lock.current) return;
    lock.current = true;
    setBusy("prepare");
    setError("");
    try {
      const current: Checkpoint = !newBatch && checkpoint && !checkpoint.plan ? checkpoint : {
        batchId: crypto.randomUUID(), plan: null, inventoryReady: false, next: 0, groups: [],
      };
      save(current);
      const inventory = createPreviewInventory(current.batchId);
      const plan = createBulkPlan(inventory, current.batchId);
      if (ticketCount(plan.requests) !== 1000) throw new Error("Lô dữ liệu chưa đủ 1.000 vé.");
      save({ ...current, plan });
      if (mounted.current) { setPage(1); setPreview(true); }
    } catch (cause) {
      if (mounted.current) setError(cause instanceof ApiError && cause.status === 404
        ? "Backend chưa bật API dữ liệu mẫu. Khởi động backend với profile local hoặc demo rồi thử lại."
        : cause instanceof Error ? cause.message : "Không tạo được dữ liệu mẫu.");
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(null);
    }
  }

  async function submit() {
    if (lock.current || !checkpoint?.plan) return;
    lock.current = true;
    stopped.current = false;
    setBusy("submit");
    setError("");
    let current = checkpoint;
    try {
      save(current);
      if (!current.inventoryReady) {
        const inventory = await apiPost<InventoryFlight[]>("/api/demo/booking-inventory", { batchId: current.batchId });
        const bound = { ...current, plan: bindInventory(checkpoint.plan, inventory), inventoryReady: true };
        save(bound);
        current = bound;
      }
      const requests = current.plan!.requests;
      while (current.next < requests.length && !stopped.current && mounted.current) {
        const request = requests[current.next];
        const group = await apiPost<BookingGroup>("/api/booking-groups", request);
        if (group.tickets.length !== ticketCount([request]) || group.tickets.some(ticket => ticket.status !== "CONFIRMED")) {
          throw new Error("API chưa xác nhận đủ vé của nhóm. Tiếp tục sẽ kiểm tra lại cùng yêu cầu.");
        }
        const next = { ...current, next: current.next + 1, groups: [...current.groups, { groupCode: group.groupCode, tickets: group.tickets.length }] };
        save(next);
        current = next;
      }
    } catch (cause) {
      if (mounted.current) setError(cause instanceof ApiError && cause.status === 404 && !current.inventoryReady
        ? "Backend chưa bật API dữ liệu mẫu. Khởi động backend với profile local hoặc demo rồi Submit lại."
        : `${cause instanceof Error ? cause.message : "Lưu dữ liệu bị gián đoạn."} Nhấn tiếp tục để gửi lại cùng mã yêu cầu, tránh tạo vé trùng.`);
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(null);
    }
  }

  const plan = checkpoint?.plan;
  const completed = checkpoint?.groups.reduce((sum, group) => sum + group.tickets, 0) ?? 0;
  const done = completed === 1000;
  const previewRequests = plan?.requests.slice((page - 1) * 5, page * 5) ?? [];

  return (
    <>
      <Accordion variant="separated" radius="lg">
        <Accordion.Item value="bulk-data">
          <Accordion.Control icon={<IconDatabase size={22} />}>
            <Text fw={600}>Tạo 1.000 vé mô phỏng</Text>
            <Text size="sm" c="dimmed">Chuẩn bị dữ liệu một chiều và khứ hồi, sau đó Submit để lưu qua API đặt vé.</Text>
          </Accordion.Control>
          <Accordion.Panel>
            <Stack gap="md">
              <Text size="sm">500 vé một chiều + 500 vé khứ hồi (250 hành khách × 2 chặng), chia thành 150 nhóm đặt chỗ. Có người lớn, trẻ em, em bé đi cùng, ba hạng vé, hành lý, suất ăn và thanh toán mô phỏng.</Text>
              <Text size="sm" c="dimmed">Tạo dữ liệu chỉ sinh bản mẫu trên trình duyệt, chưa gọi API. Khi Submit, hệ thống mới chuẩn bị chuyến/ghế trong database và gửi vé qua API booking; sự kiện được đồng bộ qua outbox.</Text>
              {error && <Alert color="red" role="alert" title="Chưa hoàn tất">{error}</Alert>}
              {plan && (
                <>
                  <SimpleGrid cols={{ base: 1, sm: 3 }}>
                    <Text>Đã chuẩn bị: <Text span fw={700}>1.000 vé</Text></Text>
                    <Text>Đã xác nhận: <Text span fw={700} c="teal.7">{completed}/1.000</Text></Text>
                    <Text>Nhóm đã lưu: <Text span fw={700}>{checkpoint.next}/150</Text></Text>
                  </SimpleGrid>
                  <Progress value={completed / 10} aria-label={`Đã lưu ${completed} trên 1.000 vé`} />
                  <Text size="sm" role="status" aria-live="polite">{done ? "Đã lưu đủ 1.000 vé. Có thể kiểm tra tại Thống kê và Phân tán dữ liệu." : busy === "submit" ? "Đang lưu từng nhóm qua API booking…" : "Lô được lưu trên trình duyệt này; có thể tiếp tục sau khi tải lại trang."}</Text>
                  {!!checkpoint.groups.length && <Anchor href={`/bookings/${checkpoint.groups[checkpoint.groups.length - 1].groupCode}`}>Xem nhóm vừa lưu</Anchor>}
                </>
              )}
              <Group>
                {!plan && <Button onClick={() => void prepare()} loading={busy === "prepare"} disabled={!ready || busy === "submit"}>Tạo dữ liệu 1K</Button>}
                {plan && <Button variant="light" onClick={() => setPreview(true)}>Xem dữ liệu mẫu</Button>}
                {plan && !done && <Button onClick={() => void submit()} loading={busy === "submit"} disabled={busy === "prepare"}>{checkpoint.next > 0 || error ? "Tiếp tục lưu vé" : "Submit lưu 1.000 vé"}</Button>}
                {busy === "submit" && <Button variant="light" color="orange" leftSection={<IconPlayerPause size={16} />} onClick={() => { stopped.current = true; }}>Dừng sau nhóm hiện tại</Button>}
                {done && <Button variant="light" onClick={() => void prepare(true)} loading={busy === "prepare"}>Tạo lô 1K mới</Button>}
              </Group>
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
      <Modal opened={preview} onClose={() => setPreview(false)} title="Dữ liệu chuẩn bị gửi API booking" size="min(1200px, 95vw)">
        <Stack gap="md">
          <Text size="sm">1.000 vé · 750 hành khách có ghế · 150 nhóm. Vé khứ hồi tính riêng mỗi chặng. Em bé đi cùng không tạo vé có ghế riêng.</Text>
          {previewRequests.map(request => (
            <Stack key={request.requestId} gap="xs">
              <Text fw={600}>{request.flightIds.length === 2 ? "Khứ hồi" : "Một chiều"} · {request.contactEmail} · {money(request.payment.amount)}</Text>
              <Text size="xs" c="dimmed">Mã yêu cầu: {request.requestId}</Text>
              <Table.ScrollContainer minWidth={850}>
                <Table striped verticalSpacing="xs">
                  <Table.Thead><Table.Tr>{["Hành khách", "Loại", "Chuyến / ghế / hạng", "Hành lý", "Suất ăn", "Em bé đi cùng"].map(label => <Table.Th key={label}>{label}</Table.Th>)}</Table.Tr></Table.Thead>
                  <Table.Tbody>
                    {request.passengers.map(passenger => (
                      <Table.Tr key={passenger.passengerName}>
                        <Table.Td>{passenger.passengerName}</Table.Td>
                        <Table.Td>{passenger.passengerType === "CHILD" ? "Trẻ em" : "Người lớn"}</Table.Td>
                        <Table.Td>{request.flightIds.map((id, index) => {
                          const flight = plan?.flights.find(flight => flight.flightId === id);
                          const seat = plan?.seats[passenger.seatIds[index]];
                          return <Stack key={id} gap={0}>
                            <Text size="xs">{flight?.origin} → {flight?.destination} · {flight?.flightNo} · Ghế {seat?.seatNo} · {cabinLabels[seat?.cabinClass ?? ""]}</Text>
                            {flight && <Text size="xs" c="dimmed">{new Date(flight.departureTime).toLocaleString("vi-VN")} → {new Date(flight.arrivalTime).toLocaleString("vi-VN")}</Text>}
                          </Stack>;
                        })}</Table.Td>
                        <Table.Td>{passenger.baggageKgs.join(" / ")} kg</Table.Td>
                        <Table.Td>{passenger.mealCodes.map(code => mealLabels[code ?? ""] ?? "Không chọn").join(" / ")}</Table.Td>
                        <Table.Td>{passenger.infantName ?? "—"}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </Stack>
          ))}
          <Pagination total={Math.ceil((plan?.requests.length ?? 0) / 5)} value={page} onChange={setPage} />
          <Button onClick={() => setPreview(false)}>Đóng và quay lại Submit</Button>
        </Stack>
      </Modal>
    </>
  );
}
