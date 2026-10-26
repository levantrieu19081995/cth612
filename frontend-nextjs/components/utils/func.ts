
export function getName(options: { value: string; label: string }[] | undefined, value?: number | any) {
    return options?.find((item) => item.value === value?.toString())?.label || "";
}

export const money = (value: number) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(value);
export const time = (value: string) => new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour12: false });

export const flightDuration = (departure: string, arrival: string) => {
    const totalMinutes = Math.max(0, Math.round((new Date(arrival).getTime() - new Date(departure).getTime()) / 60000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return [hours > 0 ? `${hours} giờ` : "", minutes > 0 ? `${minutes} phút` : ""].filter(Boolean).join(" ") || "Dưới 1 phút";
};