"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Accordion, Box, Button, Group, Stack, Text, TextInput } from "@mantine/core";
import { IconSearch, IconTicket } from "@tabler/icons-react";
import { apiGet } from "../../lib/api";
import type { Booking, BookingGroup } from "../../types/booking";

export default function BookingLookup() {
  const router = useRouter();
  const [bookingCode, setBookingCode] = useState("");
  const [lookupError, setLookupError] = useState("");
  const [lookingUp, setLookingUp] = useState(false);

  async function lookupBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lookingUp) return;
    const code = bookingCode.trim().toUpperCase();
    if (!code) {
      setLookupError("Vui lòng nhập mã đặt chỗ hoặc mã vé.");
      return;
    }
    setLookingUp(true);
    setLookupError("");
    try {
      if (code.startsWith("GR-")) {
        const group = await apiGet<BookingGroup>(`/api/booking-groups/${encodeURIComponent(code)}`);
        router.push(`/bookings/${encodeURIComponent(group.groupCode)}`);
      } else {
        const ticket = await apiGet<Booking>(`/api/bookings/code/${encodeURIComponent(code)}`);
        router.push(`/bookings/${encodeURIComponent(ticket.bookingId)}`);
      }
    } catch (error) {
      setLookupError(error instanceof Error ? error.message : "Không thể tra cứu vé. Vui lòng thử lại.");
    } finally {
      setLookingUp(false);
    }
  }

  return (
    <Accordion variant="separated" radius="lg">
      <Accordion.Item value="purchased-tickets">
        <Accordion.Control icon={<IconTicket size={22} />}>

          <Text tt="uppercase" fw={600}>Tra cứu vé đã mua</Text>
          <Text c="dimmed">Đã có mã đặt chỗ? Xem lại vé và lịch sử tại đây.</Text>

        </Accordion.Control>
        <Accordion.Panel>

            <Box component="form" onSubmit={lookupBooking}>
              <Stack gap="sm">
                <Group align="flex-start" gap="sm">
                  <TextInput
                    label="Mã đặt chỗ hoặc mã vé"
                    placeholder="Nhập mã trên xác nhận đặt vé"
                    value={bookingCode}
                    onChange={event => { setBookingCode(event.currentTarget.value); setLookupError(""); }}
                    disabled={lookingUp}
                    error={lookupError || undefined}
                    autoCapitalize="characters"
                    spellCheck={false}
                    style={{ flex: 1, minWidth: 220 }}
                  />

                  <Button type="submit" leftSection={<IconSearch size={18} />} loading={lookingUp} mt={25}>Tìm vé</Button>
                </Group>

                <Text fz="sm" c="dimmed">Mã đặt chỗ bắt đầu bằng GR- dùng để xem toàn bộ vé trong cùng lần đặt.</Text>
              </Stack>
            </Box>
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );
}
