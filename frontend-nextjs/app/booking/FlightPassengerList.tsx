import { Box, Button, Divider, Group, Paper, Stack, Text } from "@mantine/core";
import Link from "next/link";
import { money } from "@/components/utils/func";
import { IconArrowRight } from "@tabler/icons-react";
import { numberToCurrency } from "@/components/utils/currency";

export interface FlightPassengerSummary
{
  key: string;
  flightId: string;
  flightNo: string;
  legNo: number;
  route?: string;
  departureTime?: string;
  arivalTime?: string;
  groupCode?: string | null;
  passengerName: string;
  passengerType: string;
  infantName?: string;
  seatNo: string | null;
  cabinClass: string;
  baggageKg: number | null;
  mealCode: string | null;
  fare?: number;
  seatFee: number;
  cabinFee: number;
  baggageFee?: number;
  mealFee?: number;
  total: number;
  bookingId?: string;
  bookingCode?: string;
  status?: string;
}

const cabins: Record<string, string> = {
  ECONOMY: "Phổ thông",
  PREMIUM_ECONOMY: "Phổ thông đặc biệt",
  BUSINESS: "Thương gia",
};
const meals: Record<string, string> = {
  CHICKEN: "Cơm gà",
  VEGETARIAN: "Suất chay",
  SANDWICH: "Sandwich",
};
const statuses: Record<string, { label: string; color: string }> = {
  CONFIRMED: { label: "Đã xác nhận", color: "teal.7" },
  PENDING: { label: "Chờ xác nhận", color: "orange.8" },
  CANCELLED: { label: "Đã hủy", color: "red.7" },
  FAILED: { label: "Không thành công", color: "red.7" },
};

export default function FlightPassengerList({ entries, onViewHistory, onViewDetail }: {
  entries: FlightPassengerSummary[];
  onViewHistory?: (bookingId: string) => void;
  onViewDetail?: (bookingId: string) => void;
})
{
  const groups = new Map<string, FlightPassengerSummary[]>();
  for (const entry of entries) {
    const key = JSON.stringify([entry.groupCode ?? "", entry.flightId, entry.legNo]);
    const group = groups.get(key);
    if (group) group.push(entry);
    else groups.set(key, [entry]);
  }

  return (
    <Stack gap="md">
      {Array.from(groups, ([key, passengers]) =>
      {
        const flight = passengers[0];
        return (
          <Paper key={key} withBorder radius="lg" p="md">
            <Stack gap="md">
              <Group justify="space-between" align="flex-start">
                <Box>
                  <Text fw={700} c="blue.8">{flight.legNo === 2 ? "Chuyến về" : "Chuyến đi"} · {flight.flightNo}</Text>

                  {flight.route && <Text >{flight.route}</Text>}

                  <Group justify="space-between">

                    {flight.departureTime && <Text >{new Date(flight.departureTime).toLocaleString("vi-VN")}</Text>}

                    {flight.arivalTime && <Text >{new Date(flight.arivalTime).toLocaleString("vi-VN")}</Text>}
                  </Group>

                  {flight.groupCode && <Text >Mã đặt chỗ: <Text span fw={600} c="blue.7">{flight.groupCode}</Text></Text>}

                </Box>
                <Text c="dimmed">{passengers.length} hành khách</Text>
              </Group>
              <Divider />

              <Stack component="ul" gap="sm" m={0} p={0} style={{ listStyle: "none" }}>
                {passengers.map((passenger, index) => (

                  <Box component="li" key={passenger.key}>
                    {index > 0 && <Divider mb="sm" />}

                    <Stack gap={6}>
                      <Group justify="space-between" align="flex-start">
                        <Text fw={600} tt="uppercase" fz="lg">{index + 1}. {passenger.passengerName}</Text>

                        <Text c={passenger.passengerType === "CHILD" ? "orange.8" : "dimmed"}>{passenger.passengerType === "CHILD" ? "Trẻ em (75%)" : "Người lớn"}</Text>
                      </Group>

                      <Group gap="sm" align="center">
                        <Text >
                          <Text span fw={600} c={passenger.seatNo ? "blue.7" : "orange.8"}>
                            {passenger.seatNo ? `Ghế ${passenger.seatNo}` : "Không có ghế riêng"}
                          </Text>

                          {" · "}
                          <Text span
                            c={passenger.cabinClass === "ECONOMY" ? "dimmed" : "violet.7"} fw={passenger.cabinClass === "ECONOMY" ? 400 : 600}>
                            {cabins[passenger.cabinClass] ?? passenger.cabinClass}
                          </Text>

                        </Text>

                        {passenger.status &&
                          <Text
                            fw={600}
                            c={statuses[passenger.status]?.color ?? "dimmed"}>
                            {statuses[passenger.status]?.label ?? passenger.status}
                          </Text>
                        }
                      </Group>

                      <Text c="dimmed">
                        Hành lý ký gửi: <Text span c={passenger.baggageKg ? "teal.7" : "dimmed"} fw={passenger.baggageKg ? 600 : 400}>
                          {passenger.baggageKg ? `${passenger.baggageKg} kg` : "Không mua thêm"}
                        </Text>

                        Suất ăn: <Text span c={passenger.mealCode ? "teal.7" : "dimmed"} fw={passenger.mealCode ? 600 : 400}>{passenger.mealCode ? meals[passenger.mealCode] ?? passenger.mealCode : "Không chọn"}</Text>

                      </Text>

                      {passenger.infantName && <Box bg="var(--mantine-color-orange-light)" p="xs" style={{ borderLeft: "3px solid var(--mantine-color-orange-6)", borderRadius: 4 }}><Text c="orange.8">Trẻ dưới 2 tuổi đi cùng: <Text span fw={600}>{passenger.infantName}</Text></Text></Box>}

                      <Stack component="ul" gap={6} m={0} p="sm" bg="var(--mantine-color-default-hover)" style={{ listStyle: "none", borderRadius: 8 }}>
                        {[
                          { label: "Giá vé", amount: passenger.fare },
                          { label: "Phụ thu hạng vé", amount: passenger.cabinFee },
                          { label: "Phụ thu ghế", amount: passenger.seatFee },
                          { label: "Hành lý", amount: passenger.baggageFee },
                          { label: "Suất ăn", amount: passenger.mealFee },
                        ].map(({ label, amount }) => amount !== undefined && (
                          <Group component="li" key={label} justify="space-between" wrap="nowrap" align="flex-start" gap="md">

                            <Text c="dimmed">{label}</Text>

                            <Text fw={700} c={amount > 0 ? "blue.7" : "dimmed"} style={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                              {numberToCurrency(amount, "VND", "none")}
                            </Text>

                          </Group>
                        ))}
                      </Stack>

                      <Group justify="space-between" my="xs">
                        {passenger.bookingCode &&
                          <Text c="dark">Mã vé:{" "}
                            <Text span fw={500}>
                              {passenger.bookingCode}
                            </Text>
                          </Text>}

                        <Text fw={700} c="blue.8">Thành tiền: {numberToCurrency(passenger.total, "VND")}</Text>

                        {passenger.bookingId && onViewHistory &&
                          <Button
                            size="compact-sm"
                            variant="light"
                            onClick={() => onViewHistory(passenger.bookingId!)}
                            aria-label={`Xem lịch sử vé ${passenger.bookingCode ?? passenger.bookingId} của ${passenger.passengerName}`}>Xem lịch sử</Button>
                        }

                        {passenger.bookingId && onViewDetail &&
                          <Button
                            onClick={() => onViewDetail(passenger.bookingId!)}
                            size="compact-xs"
                            variant="light">
                            Chi tiết vé
                          </Button>
                        }
                      </Group>

                    </Stack>
                  </Box>
                ))}
              </Stack>
              <Divider />
              <Group justify="space-between">
                <Text fw={600}>Tổng tiền chuyến bay</Text>
                <Text fw={700} c="blue.8">{numberToCurrency(passengers.reduce((sum, passenger) => sum + passenger.total, 0), "VND")}</Text>
              </Group>
            </Stack>
          </Paper>
        );
      })}
    </Stack>
  );
}
