import { Flight, FlightBookingRequest } from "@/types/booking";
import { Alert, Badge, Box, Divider, Group, NumberInput, Paper, Select, SimpleGrid, Stack, Text, TextInput, ThemeIcon, Title } from "@mantine/core";
import { PassengerDraft } from "./page";
import { createFormContext, UseFormReturnType } from "@mantine/form";
import { IconArmchair, IconBabyCarriage, IconBriefcase, IconCircleCheck, IconLuggage, IconMail, IconToolsKitchen2Filled, IconUser } from "@tabler/icons-react";
import SectionBookingSeat from "./SectionBookingSeat";


type SectionThongTinKhachHangProps = {
    flight: Flight,
    allPassengersBooked?: any
    adultCount?: number
    childCount?: number
    infantCount?: number
    passengers?: PassengerDraft[]
    form: UseFormReturnType<FlightBookingRequest>;

}
const SectionThongTinKhachHang = (props: SectionThongTinKhachHangProps) => {
    const { flight, allPassengersBooked, adultCount = 0, childCount = 0, infantCount = 0, passengers, form } = props;

    console.log(">>>>>", flight, "all", allPassengersBooked);
    if (!flight && !allPassengersBooked) return;

    return (
        (

            <Box>
                <Stack gap="md">
                    <Group justify="space-between" align="center" gap="sm" wrap="wrap">
                        <Box>
                            <Text c="blue.7" tt="uppercase" fw={800} size="sm" lts={0.5}>
                                Hành khách & dịch vụ
                            </Text>
                            <Title order={3} size="lg">Thông tin đặt vé</Title>
                        </Box>

                    </Group>
                    <Paper withBorder radius="md" p="sm">
                        <Group justify="space-between" gap="xs" wrap="wrap">
                            <Text size="sm" fw={700}>Số lượng đã chọn ở bước tìm chuyến</Text>
                            <Text size="sm">
                                {adultCount > 0 && (
                                    <Text span>
                                        {adultCount} người lớn
                                    </Text>
                                )}

                                {childCount > 0 && (
                                    <Text span>
                                        {childCount} trẻ em
                                    </Text>
                                )}

                                {infantCount > 0 && (
                                    <Text span>
                                        {infantCount} trẻ dưới 2 tuổi
                                    </Text>
                                )}
                            </Text>
                        </Group>
                    </Paper>
                    <Stack gap="xs">
                        {passengers?.map((passenger, index) => {
                            const isChild = passenger.passengerType === "CHILD";
                            const isBooked = passenger.booking != null;
                            const passengerNumber = isChild
                                ? index - adultCount + 1
                                : index + 1;

                            const passengerLabel = isChild
                                ? `Trẻ em ${passengerNumber}`
                                : `Người lớn ${passengerNumber}`;

                            const baggageOptions = [
                                { value: "0", label: "Không mua thêm" },
                                ...(flight?.ancillaries?.baggage ?? []).map((item) => ({
                                    value: String(item.kg),
                                    label: `${item.kg} kg · ${item.price.toLocaleString("vi-VN")} ₫`,
                                })),
                            ];

                            const mealNames: Record<string, string> = {
                                CHICKEN: "Cơm gà",
                                VEGETARIAN: "Suất ăn chay",
                                SANDWICH: "Bánh sandwich",
                            };

                            const mealOptions = [
                                { value: "", label: "Không chọn suất ăn" },
                                ...(flight?.ancillaries?.meals ?? []).map((item) => ({
                                    value: item.code,
                                    label: `${mealNames[item.code] ?? item.code} · ${item.price.toLocaleString("vi-VN")} ₫`,
                                })),
                            ];
                            return (
                                <>

                                    <Paper withBorder radius="lg" p="lg">
                                        <Stack gap="md">
                                            <Group gap="sm">
                                                <ThemeIcon size={40} radius="md" variant="light" color="blue">
                                                    <IconMail size={20} />
                                                </ThemeIcon>

                                                <Box>
                                                    <Text fw={700}>Thông tin liên hệ</Text>
                                                    <Text fz="sm" c="dimmed">
                                                        Vé điện tử và thông tin đặt chỗ sẽ được gửi đến email này.
                                                    </Text>
                                                </Box>
                                            </Group>

                                            <TextInput
                                                label="Email"
                                                placeholder="example@gmail.com"
                                                type="email"
                                                required
                                                leftSection={<IconMail size={18} />}

                                                {...form.getInputProps("contactEmail")}
                                            />
                                        </Stack>
                                    </Paper>

                                    <Paper
                                        key={`passenger-${index}`}
                                        withBorder
                                        radius="lg"
                                        p={{ base: "md", sm: "lg" }}
                                        style={{
                                            borderColor: isBooked
                                                ? "var(--mantine-color-teal-3)"
                                                : "var(--mantine-color-gray-3)",
                                        }}
                                    >
                                        <Stack gap="md">
                                            {/* HEADER */}
                                            <Group gap="sm" wrap="nowrap">
                                                <ThemeIcon
                                                    size={42}
                                                    radius="md"
                                                    variant="light"
                                                    color={isBooked ? "teal" : "gray"}
                                                >
                                                    <IconUser size={22} />
                                                </ThemeIcon>

                                                <Box style={{ flex: 1, minWidth: 0 }}>
                                                    <Text fw={700} fz="md">
                                                        {passengerLabel}
                                                    </Text>
                                                    <Text fz="sm" c="dimmed">
                                                        {isChild ? "Từ 2 đến dưới 12 tuổi" : "Từ 12 tuổi trở lên"}
                                                    </Text>
                                                </Box>

                                                <Badge
                                                    color={isBooked ? "teal" : "gray"}
                                                    variant="light"
                                                    size="md"
                                                >
                                                    {isBooked ? "Đã đặt" : "Chưa đặt"}
                                                </Badge>
                                            </Group>

                                            <Divider />

                                            {/* THÔNG TIN CÁ NHÂN */}
                                            <Stack gap="sm">
                                                <Text fw={650}>Thông tin cá nhân</Text>

                                                <TextInput
                                                    label="Họ và tên"
                                                    placeholder="Nhập họ tên như trên giấy tờ"
                                                    {...form.getInputProps(
                                                        `passengers.${index}.passengerName`
                                                    )}
                                                    maxLength={120}
                                                    required
                                                    disabled={isBooked}
                                                    autoComplete={index === 0 ? "name" : "off"}
                                                    size="md"
                                                    radius="md"
                                                    leftSection={<IconUser size={17} />}
                                                />
                                            </Stack>

                                            {/* DỊCH VỤ ĐI KÈM */}
                                            <Stack gap="sm">
                                                <Group gap="xs">
                                                    <IconBriefcase size={18} />
                                                    <Text fw={650}>Dịch vụ đi kèm</Text>
                                                    <Badge variant="outline" color="gray">
                                                        Tùy chọn
                                                    </Badge>
                                                </Group>

                                                <SimpleGrid
                                                    cols={{ base: 1, sm: 2 }}
                                                    spacing="md"
                                                >
                                                    <Select
                                                        label="Hành lý ký gửi"
                                                        placeholder="Chọn hành lý"
                                                        data={baggageOptions}
                                                        value={String(
                                                            form.values.passengers[index]?.baggageKg ?? 0
                                                        )}
                                                        onChange={(value) =>
                                                            form.setFieldValue(
                                                                `passengers.${index}.baggageKg`,
                                                                Number(value ?? 0)
                                                            )
                                                        }
                                                        disabled={isBooked}
                                                        leftSection={<IconLuggage size={18} />}
                                                        size="md"
                                                        radius="md"
                                                        allowDeselect={false}
                                                    />

                                                    <Select
                                                        label="Suất ăn"
                                                        placeholder="Chọn suất ăn"
                                                        data={mealOptions}
                                                        value={
                                                            form.values.passengers[index]?.mealCode ?? ""
                                                        }
                                                        onChange={(value) =>
                                                            form.setFieldValue(
                                                                `passengers.${index}.mealCode`,
                                                                value ?? ""
                                                            )
                                                        }
                                                        disabled={isBooked}
                                                        leftSection={<IconToolsKitchen2Filled size={18} />}
                                                        size="md"
                                                        radius="md"
                                                        allowDeselect={false}
                                                    />
                                                </SimpleGrid>

                                                <Paper
                                                    withBorder
                                                    radius="md"
                                                    p="md"
                                                    bg="var(--mantine-color-default-hover)"
                                                >
                                                    <Group gap="sm" wrap="nowrap">
                                                        <ThemeIcon
                                                            color="gray"
                                                            variant="light"
                                                            size={36}
                                                            radius="md"
                                                        >
                                                            <IconArmchair size={20} />
                                                        </ThemeIcon>

                                                        <Box style={{ flex: 1, minWidth: 0 }}>
                                                            <Text fw={600} fz="sm">
                                                                Ghế ngồi
                                                            </Text>
                                                            <Text c="dimmed" fz="sm">
                                                                {form.values.passengers[index]?.seatIds?.length
                                                                    ? `Đã chọn ${form.values.passengers[index].seatIds.length
                                                                    } ghế`
                                                                    : "Chưa chọn ghế"}
                                                            </Text>
                                                        </Box>

                                                        <Badge variant="light" color="gray">
                                                            Tùy chọn
                                                        </Badge>
                                                    </Group>


                                                </Paper>
                                            </Stack>

                                            {/* THÔNG TIN ĐẶT VÉ */}
                                            {isBooked && (
                                                <Alert
                                                    color="teal"
                                                    variant="light"
                                                    radius="md"
                                                    icon={<IconCircleCheck size={20} />}
                                                >
                                                    <Text fw={600}>
                                                        Đặt vé thành công
                                                    </Text>
                                                    <Text fz="sm">
                                                        Mã đặt chỗ: {passenger?.booking?.bookingCode}
                                                    </Text>
                                                </Alert>
                                            )}
                                        </Stack>
                                    </Paper>

                                    {/* THÔNG TIN EM BÉ ĐI CÙNG */}
                                    {passenger.passengerType === "ADULT" &&
                                        index < infantCount && (
                                            <Paper
                                                radius="md"
                                                p="md"
                                                withBorder
                                                bg="var(--mantine-color-orange-0)"
                                                style={{
                                                    borderColor: "var(--mantine-color-orange-2)",
                                                }}
                                            >
                                                <Stack gap="sm">
                                                    <Group gap="sm" wrap="nowrap">
                                                        <ThemeIcon
                                                            size={36}
                                                            radius="md"
                                                            color="orange"
                                                            variant="light"
                                                        >
                                                            <IconBabyCarriage size={20} />
                                                        </ThemeIcon>

                                                        <Box>
                                                            <Text fw={700}>Em bé {index + 1}</Text>
                                                            <Text fz="sm" c="dimmed">
                                                                Dưới 2 tuổi · Đi cùng
                                                            </Text>
                                                        </Box>
                                                    </Group>

                                                    <TextInput
                                                        label="Họ và tên em bé"
                                                        placeholder="Nhập họ tên như trên giấy tờ"
                                                        {...form.getInputProps(
                                                            `passengers.${index}.infantName`
                                                        )}
                                                        required
                                                        maxLength={120}

                                                        size="md"
                                                        radius="md"
                                                        leftSection={<IconUser size={18} />}
                                                    />

                                                    <Text fz="sm" c="dimmed">
                                                        Em bé ngồi cùng người lớn, không sử dụng ghế riêng.
                                                    </Text>
                                                </Stack>
                                            </Paper>
                                        )}

                                </>
                            );
                        })}
                    </Stack>

                </Stack>
            </Box>

        )
    )
}


export default SectionThongTinKhachHang;