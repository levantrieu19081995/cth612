import { Badge, Box, Button, Group, Paper, ScrollArea, Stack, Text, Title } from "@mantine/core";
import { PassengerDraft } from "./page";
import { useState } from "react";
import { Seat } from "@/types/booking";
import { money } from "@/components/utils/func";

const seatPrice = (seatNo: string) =>
{
  if (seatNo.startsWith("01")) return 100000;
  if (seatNo.endsWith("A") || seatNo.endsWith("F")) return 50000;
  return 0;
};

const cabinPrices: Record<string, number> = {
  ECONOMY: 0,
  PREMIUM_ECONOMY: 500000,
  BUSINESS: 1000000,
};

const cabinLabels: Record<string, string> = {
  ECONOMY: "Phổ thông",
  PREMIUM_ECONOMY: "Phổ thông đặc biệt",
  BUSINESS: "Thương gia",
};

const SectionBookingSeat = (
  {
    passengers,
    availableSeats,
    adultCount,
    seats,
    activeLegIndex,
    onSelectedSeats
  }: {
    passengers: PassengerDraft[],
    availableSeats: number,
    adultCount: number,
    seats: Seat[],
    activeLegIndex: number,
    onSelectedSeats: (activeIndex: number, seatId: string) => void

  }) =>
{

  const [activePassengerIndex, setActivePassengerIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  return (
    <Paper withBorder radius="md" p="sm" mt="sm">
      <Box>
        {/* 6 ghế/hàng, có lối đi ở giữa ghế thứ 3 và thứ 4 */}
        <Stack gap="sm">
          <Group justify="space-between" align="center" gap="xs" wrap="wrap">
            <Box>
              <Title order={3} size="lg">Chọn chỗ ngồi</Title>
              <Text c="dimmed" size="sm">Ghế tiêu chuẩn đã gồm trong giá; một số vị trí có phụ thu.</Text>
            </Box>
            <Badge size="lg" variant="light" color="teal">{availableSeats} ghế trống</Badge>
          </Group>
          <Group gap="md" wrap="wrap" aria-label="Chú giải sơ đồ ghế">
            <Group gap={6}>
              <Box w={15} h={15} bg="teal.0" style={{ border: "1px solid var(--mantine-color-teal-4)", borderRadius: 4 }} />
              <Text size="sm" c="dimmed">Còn trống</Text>
            </Group>
            <Group gap={6}>
              <Box w={15} h={15} bg="gray.2" style={{ border: "1px solid var(--mantine-color-gray-4)", borderRadius: 4 }} />
              <Text size="sm" c="dimmed">Đã đặt</Text>
            </Group>
            <Group gap={6}>
              <Box w={15} h={15} bg="blue.6" style={{ borderRadius: 4 }} />
              <Text size="sm" c="dimmed">Đang chọn</Text>
            </Group>
          </Group>
          <Group gap="xs" aria-label="Hạng vé và phụ thu">
            <Text c="gray" fw={400} fz="sm">
              Phổ thông:{" "}
              <Text c="dark" span fw={500} fz="sm">0đ</Text>
            </Text>
            <Text c="gray" fw={400} fz="sm">
              Phổ thông đặc biệt:{" "}
              <Text c="dark" span fw={500} fz="sm"> +500.000đ</Text>
            </Text>
            <Text c="gray" fw={400} fz="sm">
              Thương gia:{" "}
              <Text c="dark" fz="sm" span>+1.000.000đ</Text>
            </Text>
          </Group>
          <Group gap="xs" wrap="wrap" aria-label="Chọn hành khách để gán ghế" my="xs">
            <Text size="sm" fw={600}>Gán ghế cho:</Text>
            {passengers?.map((passenger, index) => (
              <Button
                key={index}
                type="button"
                size="compact-xs"
                variant={activePassengerIndex === index ? "filled" : "light"}
                color="blue"
                onClick={() => setActivePassengerIndex(index)}
                disabled={submitting || passenger.booking !== null}
              >
                {passenger.passengerType === "CHILD" ? `Trẻ em ${index - adultCount + 1}` : `Người lớn ${index + 1}`}
                {passenger.seatIds[activeLegIndex] ? " · đã có ghế" : ""}
              </Button>
            ))}
          </Group>
        </Stack>
        {seats.length > 0 ? (
          <Paper className="booking-seat-map" radius="lg" p="md" withBorder>
            <ScrollArea type="auto" offsetScrollbars>
              <Box
                role="group"
                aria-label="Sơ đồ chọn ghế"
                mx="auto"
                style={{
                  display: "grid",
                  gridTemplateColumns: "22px repeat(3, 38px) 18px repeat(3, 38px)",
                  gridAutoRows: "36px",
                  gap: 7,
                  width: "max-content",
                  padding: "8px 3px",
                }}
              >
                {["A", "B", "C", "D", "E", "F"].map((letter, index) => (
                  <Text
                    key={letter}
                    className="booking-seat-axis"
                    ta="center"
                    style={{ gridRow: 1, gridColumn: index < 3 ? index + 2 : index + 3 }}
                  >{letter}</Text>
                ))}
                {Array.from({ length: Math.ceil(seats.length / 6) }, (_, index) => (
                  <Text
                    key={`row-${index}`}
                    className="booking-seat-axis"
                    ta="center"
                    style={{ gridColumn: 1, gridRow: index + 2 }}
                  >{String(index + 1).padStart(2, "0")}</Text>
                ))}
                {seats.map((item, index) =>
                {
                  const assignedPassengerIndex = passengers.findIndex(passenger => passenger.seatIds[activeLegIndex] === item.seatId);
                  const isChosen = assignedPassengerIndex >= 0;
                  const isAvailable = item.status === "AVAILABLE";
                  const columnInRow = index % 6;
                  const price = seatPrice(item.seatNo);
                  const classPrice = cabinPrices[item.cabinClass] ?? 0;
                  return (
                    <Button
                      key={item.seatId}
                      className={`booking-seat-button${isChosen ? " booking-seat-button-selected" : isAvailable ? ` booking-seat-button-available booking-seat-class-${String(item.cabinClass).toLowerCase()}` : " booking-seat-button-unavailable"}`}
                      type="button"
                      size="sm"
                      radius="sm"
                      p={0}
                      fz="sm"
                      fw={700}
                      variant={isChosen ? "filled" : isAvailable ? "light" : "default"}
                      color={isChosen ? "blue" : isAvailable ? "teal" : "gray"}
                      disabled={!isAvailable || submitting ||
                        (assignedPassengerIndex >= 0 && assignedPassengerIndex !== activePassengerIndex) ||
                        Boolean(passengers[activePassengerIndex]?.booking)}
                      aria-pressed={isChosen}
                      aria-label={`Ghế ${item.seatNo}, hạng ${cabinLabels[item.cabinClass] ?? item.cabinClass}${isChosen ? `, hành khách ${assignedPassengerIndex + 1} đã chọn` : isAvailable ? " còn trống" : " không còn trống"}, phụ thu hạng ${money(classPrice)}${price ? `, phụ thu vị trí ${money(price)}` : ""}`}
                      onClick={() =>
                      {
                        onSelectedSeats(activePassengerIndex, item.seatId);
                      }}
                      style={{
                        gridColumn: columnInRow < 3 ? columnInRow + 2 : columnInRow + 3,
                        gridRow: Math.floor(index / 6) + 2,
                        minWidth: 0,
                        width: "100%",
                        height: 36,
                      }}
                    >
                      {isChosen ? item.seatNo : isAvailable ? item.seatNo : "×"}
                    </Button>
                  );
                })}
              </Box>
            </ScrollArea>
          </Paper>
        ) : (
          <Text c="dimmed" size="sm" ta="center" py="lg">
            Chuyến bay này chưa có sơ đồ ghế.
          </Text>
        )}
        <Text className="booking-seat-pricing-note" size="xs" c="dimmed" mt="sm" p="sm">
          Chọn hành khách cần gán ghế ở trên · Hàng 01 +100.000đ, ghế A/F +50.000đ.
        </Text>
      </Box>
    </Paper>
  )
}

export default SectionBookingSeat