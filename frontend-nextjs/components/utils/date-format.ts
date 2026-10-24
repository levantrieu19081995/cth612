import { format } from "date-fns";
import { enGB, vi } from "date-fns/locale";
import dayjs from "dayjs";
import moment from "moment-timezone";

const locales = { enGB, vi };

const currentDate = new Date();

type DateFormatString =
    | "HHgmmp dd/MM/yyyy"
    | "dd/MM/yyyy"
    | "MM/dd/yyyy"
    | "PP"
    | "MM/dd/yyyy HH:mm:ss"
    | "HH-mm-ss-MM-dd-yyyy"
    | "HH:mm"
    | "MM/yyyy"
    | "MMMM dd, yyyy"
    | "yyyy-MM-dd"
    | "dd/MM/yyyy HH:mm:ss" | 'yyyy' | 'HH:mm dd/MM/yyyy'
    | "dd_MM_yyyy" | 'yyyy-MM-dd'
    | "dd-MM-yyyy_HH-mm-ss";

export const dateFormater = (date: number | string | Date | null, formatStr?: DateFormatString) => {
    if (!date) return "";
    if (!formatStr) formatStr = "PP";

    let d: Date;

    try {
        if (typeof date === "string" || typeof date === "number") {
            d = new Date(date);
        } else {
            d = date;
        }

        if (!d) return "";

        // if (process.env.NEXT_PUBLIC_TIMEZONE) {
        //mặc định chuyển về timezone quốc gia
        const options: Intl.DateTimeFormatOptions = {
            timeZone: "Asia/Ho_Chi_Minh", //process.env.NEXT_PUBLIC_TIMEZONE,
        };
        d = new Date(d.toLocaleString("en-US", options));
        // }

        if (formatStr === "HHgmmp dd/MM/yyyy") {
            const hour = d.getHours();
            const minute = d.getMinutes();
            return `${hour}g${minute}p ${format(d, "dd/MM/yyyy", { locale: vi })}`;
        }
        if (formatStr === "MM/dd/yyyy HH:mm:ss") {
            const hour = d.getHours();
            const minute = d.getMinutes();
            const seconds = d.getSeconds();
            return `${format(d, "MM/dd/yyyy", { locale: vi })} ${hour < 10 ? "0" + hour : hour}:${minute < 10 ? "0" + minute : minute
                }:${seconds < 10 ? "0" + seconds : seconds}`;
        }
        if (formatStr === "dd/MM/yyyy HH:mm:ss") {
            const hour = d.getHours();
            const minute = d.getMinutes();
            const seconds = d.getSeconds();
            return `${format(d, "dd/MM/yyyy", { locale: vi })} ${hour < 10 ? "0" + hour : hour}:${minute < 10 ? "0" + minute : minute
                }:${seconds < 10 ? "0" + seconds : seconds}`;
        }
        if (formatStr === "HH-mm-ss-MM-dd-yyyy") {
            const hour = d.getHours();
            const minute = d.getMinutes();
            const seconds = d.getSeconds();
            return `${hour < 10 ? "0" + hour : hour}-${minute < 10 ? "0" + minute : minute}-${seconds < 10 ? "0" + seconds : seconds
                }-${format(d, "dd-MM-yyyy", { locale: vi })}`;
        }
        if (formatStr === "HH:mm") {
            const hour = d.getHours();
            const minute = d.getMinutes();
            return `${hour < 10 ? "0" + hour : hour}:${minute < 10 ? "0" + minute : minute}`;
        }
        if (formatStr === "MM/yyyy") {
            return `${format(d, "MM/yyyy", { locale: vi })}`;
        }

        if (formatStr === "dd_MM_yyyy") {
            return `${format(d, "dd_MM_yyyy", { locale: vi })} `;
        }

        if (formatStr === "dd-MM-yyyy_HH-mm-ss") {
            const hour = d.getHours();
            const minute = d.getMinutes();
            const seconds = d.getSeconds();
            return `${format(d, "dd-MM-yyyy", { locale: vi })}_${hour < 10 ? "0" + hour : hour}-${minute < 10 ? "0" + minute : minute
                }-${seconds < 10 ? "0" + seconds : seconds}`;
        }

        return format(d, formatStr, {
            locale: vi, //enGB
        });
    } catch (e) {
        return "";
    }
};

export const dayWithRealTime = (value?: Date | string | null): Date => {
    const baseDate = value ? new Date(value) : new Date();
    const now = new Date();

    baseDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), 0);

    return baseDate;
};

export const dateFormat = dateFormater;

export type ThamNienInput = {
    nam?: number | string | null;
    thang?: number | string | null;
    ngay?: number | string | null;
} | null;

export const formatThamNien = (thamNien?: ThamNienInput, separator = ", ") => {
    const nam = Number(thamNien?.nam) || 0;
    const thang = Number(thamNien?.thang) || 0;
    const ngay = Number(thamNien?.ngay) || 0;

    const values = [nam > 0 ? `${nam} năm` : "", thang > 0 ? `${thang} tháng` : "", ngay > 0 ? `${ngay} ngày` : ""].filter(Boolean);

    return values.length > 0 ? values.join(separator) : "-";
};

export const convertDay = (date: any) => {
    date.toString();
    const year = date.slice(0, 4);
    const month = date.slice(4, 6);
    const day = date.slice(6, 8);

    const hour = date.slice(8, 10);
    const minute = date.slice(10, 12);
    // const second = date.slice(12, 14);

    return `${hour}:${minute} ngày ${day}/${month}/${year}`;
};
export const convertStringToDate = (dateString: string) => {
    const year = parseInt(dateString.substring(0, 4), 10);
    const month = parseInt(dateString.substring(4, 6), 10) - 1; // Tháng trong JavaScript bắt đầu từ 0
    const day = parseInt(dateString.substring(6, 8), 10);
    const hour = parseInt(dateString.substring(8, 10), 10);
    const minute = parseInt(dateString.substring(10, 12), 10);
    const second = parseInt(dateString.substring(12, 14), 10);

    return new Date(year, month, day, hour, minute, second);
};
export const convertBirthday = (date: any) => {
    date.toString();
    const day = date.slice(0, 2);
    const month = date.slice(2, 4);
    const year = date.slice(4, 8);

    return ` ${day ? day : "01"}/${month ? month : "01"}/${year}`;
};

const formatYear = (y: string | number) => {
    y = String(y);

    if (y.length === 1) {
        return `200${y}`;
    }

    if (y.length === 2) {
        return Number(y) >= 50
            ? `19${y}`
            : `20${y}`;
    }

    if (y.length === 3) {
        return `2${y}`;
    }

    return y;
};

export function dateParser(value: string, format?: 'YYYY-MM-DD' | 'MM/DD/YYYY') {
    let parsed;
    let d, m, y;

    value = value.replaceAll("/", "");
    if (value.length === 6) {
        d = value.charAt(0);
        m = value.charAt(1);
        y = value.substring(2);
    } else if (value.length === 7) {
        if (Number(value.substring(1, 3)) > 12) {
            d = value.substring(0, 2);
            m = value.charAt(2);
        } else {
            if (value.substring(1, 3).charAt(0) === "0") {
                d = value.substring(0, 2);
                m = value.charAt(2);
            } else {
                d = value.charAt(0);
                m = value.substring(1, 3);
            }
        }
        y = value.substring(3);
    } else
        if (value.length === 8) {
            d = value.substring(0, 2);
            m = value.substring(2, 4);
            y = value.substring(4);
        } else {
            const dateParts = value.split("-");
            let dateObject = null;
            try {
                dateObject = new Date(+dateParts[2], Number(dateParts[1]) - 1, +dateParts[0]);
            } catch (e) { }

            return dateObject;
        }

    try {
        parsed = new Date(Number(formatYear(y)), Number(m.padStart(2, "0")) - 1, Number(d.padStart(2, "0")));
        if(format == 'YYYY-MM-DD'){
            return moment(parsed).format('YYYY-MM-DD')
        }
        if(format == 'MM/DD/YYYY'){
            return moment(parsed).format('MM/DD/YYYY')
        }
        return parsed
    } catch (e) { }
    return parsed;
}

export function timeFormatter(minute: number, format?: "d h m" | "h m" | "in-day" | "auto") {
    // 1 ngày có 8 giờ (tính theo giờ hành chính), 1 giờ 60p
    let days = Math.floor(minute / 60 / 8);
    let remainingTime = parseInt(minute - Math.floor(days * 60 * 8) + "");
    let hours = Math.floor(remainingTime / 60);
    let remainingMin = Math.floor(remainingTime - hours * 60);

    if (format == "d h m") {
        return `${days + " ngày"} ${hours + " giờ"} ${remainingMin + " phút"}`.replace(/ +/g, " ");
    }
    if (format == "h m") {
        return `${hours + " giờ"} ${remainingMin + " phút"}`.replace(/ +/g, " ");
    }
    if (format == "in-day") {
        if (days == 0 && hours < 8) {
            return `${hours + " giờ"} ${remainingMin + " phút"}`.replace(/ +/g, " ");
        }
        return `${days + " ngày"}  ${hours + " giờ"} ${remainingMin + " phút"}`.replace(/ +/g, " ");
    }
    if (format == "auto") {
        return `${days > 0 ? days + " ngày" : ""}  ${hours > 0 ? (hours < 10 ? "0" + hours : hours) + " giờ" : ""} ${remainingMin > 0 ? (remainingMin < 10 ? "0" + remainingMin : remainingMin) + " phút" : ""
            }`.replace(/ +/g, " ");
    }
    return `${days > 0 ? days + " ngày" : ""}  ${hours > 0 ? (hours < 10 ? "0" + hours : hours) + " giờ" : ""} ${days > 0 ? "" : remainingMin > 0 ? (remainingMin < 10 ? "0" + remainingMin : remainingMin) + " phút" : ""
        }`.replace(/ +/g, " ");
}

export function dateByQuarter(quarter: number, year?: number, cauHinhChucNang?: any) {
    // Get current quarter's start and end date
    if (year && year > currentDate.getFullYear()) year = currentDate.getFullYear();
    const quarterStart = new Date(
        Number(year),
        cauHinhChucNang?.kyBaoCao == "thang_truoc" ? (quarter - 1) * 3 - 1 : (quarter - 1) * 3,
        Number(cauHinhChucNang?.ngayBatDauBaoCao) ? Number(cauHinhChucNang?.ngayBatDauBaoCao) : 1,
    );
    const quarterEndTemp = new Date(Number(year), cauHinhChucNang?.kyBaoCao == "thang_truoc" ? quarter * 3 - 1 : quarter * 3, 0);
    const currentDay = new Date();
    const quarterEnd = quarterEndTemp <= currentDay ? quarterEndTemp : currentDay;
    return { quarterStart, quarterEnd };
}

export function dateByHalf(half: number, year?: number, cauHinhChucNang?: any) {
    // Get current half's start and end date
    if (year && year > currentDate.getFullYear()) return;
    let halfStart = new Date(
        Number(year),
        cauHinhChucNang?.kyBaoCao == "thang_truoc" ? Math.abs(half) - 1 : Math.abs(half),
        Number(cauHinhChucNang?.ngayBatDauBaoCao) ? Number(cauHinhChucNang?.ngayBatDauBaoCao) : 1,
    );
    let halfEndTemp = new Date();
    if (Math.abs(half) == 1)
        halfEndTemp = new Date(
            Number(year),
            cauHinhChucNang?.kyBaoCao == "thang_truoc" ? Math.abs(half) + 4 : Math.abs(half) + 5,
            Number(cauHinhChucNang?.ngayBatDauBaoCao) ? Number(cauHinhChucNang?.ngayBatDauBaoCao) : 1,
        );
    else
        halfEndTemp = new Date(
            Number(year),
            cauHinhChucNang?.kyBaoCao == "thang_truoc" ? Math.abs(half) + 5 : Math.abs(half) + 6,
            Number(cauHinhChucNang?.ngayBatDauBaoCao) ? Number(cauHinhChucNang?.ngayBatDauBaoCao) : 1,
        );

    const halfEnd = halfEndTemp <= currentDate ? new Date(halfEndTemp.getTime() - 1) : currentDate;
    return { halfStart, halfEnd };
}

export function dateByYear(year: number, cauHinhChucNang?: any) {
    const firstDay = new Date(
        year,
        cauHinhChucNang?.kyBaoCao == "thang_truoc" ? -1 : 0,
        Number(cauHinhChucNang?.ngayBatDauBaoCao) ? Number(cauHinhChucNang?.ngayBatDauBaoCao) : 1,
    );
    const lastDayinYear = new Date(year + 1, cauHinhChucNang?.kyBaoCao == "thang_truoc" ? -1 : 0, 0);
    const lastDay = lastDayinYear <= currentDate ? lastDayinYear : currentDate;
    return { firstDay, lastDay };
}

export function dateByMonth(month: number, year?: number, cauHinhChucNang?: any) {
    if (month > currentDate.getMonth() && year && year > currentDate.getFullYear()) month = currentDate.getMonth();
    if (year && year > currentDate.getFullYear()) year = currentDate.getFullYear();
    const firstDay = new Date(
        Number(year),
        cauHinhChucNang?.kyBaoCao == "thang_truoc" ? month - 1 : month,
        Number(cauHinhChucNang?.ngayBatDauBaoCao) ? Number(cauHinhChucNang?.ngayBatDauBaoCao) : 1,
    );
    const lastDayinMonth = new Date(Number(year), cauHinhChucNang?.kyBaoCao == "thang_truoc" ? month : month + 1, 0);
    const lastDay = lastDayinMonth <= currentDate ? lastDayinMonth : currentDate;
    return { firstDay, lastDay };
}

export function isDateValid(dateStr: string | number | undefined | null | Date) {
    return dateStr && !isNaN(Number(new Date(dateStr)));
}

export function toDateTz(date: number | Date | undefined | null, _timezone?: string) {
    if (!date) return null;

    const curTz = _timezone || process.env.NEXT_PUBLIC_TIMEZONE || "Asia/Ho_Chi_Minh";

    let newDate = null;
    try {
        newDate = new Date(moment.tz(date, curTz).format("YYYY/MM/DD HH:mm:ss"));
    } catch (e) { }

    return newDate;
}

export function toDatetimeTz(date: number | Date | undefined | null, _timezone?: string) {
    if (!date) return null;

    const curTz = _timezone || process.env.NEXT_PUBLIC_TIMEZONE || "Asia/Ho_Chi_Minh";

    let newDate = null;
    try {
        newDate = new Date(moment.tz(date, curTz).format("YYYY/MM/DD HH:mm:ss"));
    } catch (e) { }

    return newDate;
}
export function formatDateTo8Digits(dateStr?: string) {
    if (!dateStr) return "";
    return dayjs(dateStr, ["D/M/YYYY", "DD/MM/YYYY"]).format("DDMMYYYY");
}

// export function convertTimestamp(n: any): number {
//     if (n === null || n === undefined || n === "") return 0;

//     const num = Number(n);
//     if (isNaN(num)) return 0;

//     const absNum = Math.abs(num);
//     const length = Math.floor(absNum).toString().length;

//     if (length <= 10) return num * 1000;      // seconds -> ms
//     if (length <= 13) return num;             // ms
//     if (length <= 16) return Math.floor(num / 1000); // micro -> ms
//     return Math.floor(num / 1_000_000);       // nano -> ms
// }

export function convertTimestamp(n: any): number {
    if (!n && n !== 0) return 0;

    let num = Number(n);
    if (isNaN(num)) return 0;

    // thử các khả năng
    const candidates = [
        num * 1000, // seconds
        num, // ms
        num / 1000, // micro
        num / 1_000_000, // nano
    ];

    for (const ts of candidates) {
        const d = new Date(ts);
        const year = d.getFullYear();
        if (year > 1900 && year < 2100) {
            return Math.floor(ts);
        }
    }

    return 0;
}


export const parseWarranty = (val: string, baseDate: any) => {
    if (!val) {
        return {
            months: 0,
            date: null,
            display: "",
            unit: null,
        };
    }

    const lower = val.toLowerCase().trim();

    const formatDate = (date: Date) => {
        const d = date.getDate().toString().padStart(2, "0");
        const m = (date.getMonth() + 1).toString().padStart(2, "0");
        const y = date.getFullYear();

        return `${d}/${m}/${y}`;
    };

    const isValidDate = (date: Date, d: number, m: number, y: number) => {
        return (
            !isNaN(date.getTime()) &&
            date.getDate() === d &&
            date.getMonth() + 1 === m &&
            date.getFullYear() === y
        );
    };

    const addMonths = (date: Date, months: number) => {
        const result = new Date(date);
        result.setMonth(result.getMonth() + months);
        return result;
    };

    const addDays = (date: Date, days: number) => {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    };

    const calculateMonthsBetween = (fromDate: any, toDate: Date) => {
        if (!fromDate) return 0;

        const base = new Date(fromDate);

        return Math.max(
            0,
            (toDate.getFullYear() - base.getFullYear()) * 12 +
            (toDate.getMonth() - base.getMonth())
        );
    };

    // 1. Nhận diện ngày compact ddmmyyyy, ví dụ 05062026
    if (/^\d{8}$/.test(lower)) {
        const d = parseInt(lower.slice(0, 2), 10);
        const m = parseInt(lower.slice(2, 4), 10);
        const y = parseInt(lower.slice(4, 8), 10);

        const date = new Date(y, m - 1, d);

        if (isValidDate(date, d, m, y)) {
            return {
                months: calculateMonthsBetween(baseDate, date),
                date,
                display: formatDate(date),
                unit: "DATE",
            };
        }
    }

    // 2. Nhận diện ngày có dấu / hoặc -
    if (lower.includes("/") || lower.includes("-")) {
        const parts = lower.split(lower.includes("/") ? "/" : "-");

        const d = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const y =
            parts.length >= 3
                ? parseInt(parts[2], 10)
                : new Date().getFullYear();

        const date = new Date(y, m - 1, d);

        if (isValidDate(date, d, m, y)) {
            return {
                months: calculateMonthsBetween(baseDate, date),
                date,
                display: formatDate(date),
                unit: "DATE",
            };
        }
    }

    // 3. Nhận diện số + đơn vị
    const numMatch = lower.match(/^[\d.]+/);

    if (!numMatch) {
        return {
            months: 0,
            date: null,
            display: "",
            unit: null,
        };
    }

    let num = parseFloat(numMatch[0]);

    if (!Number.isFinite(num) || num <= 0) {
        return {
            months: 0,
            date: null,
            display: "",
            unit: null,
        };
    }

    const textPart = lower.replace(/^[\d.]+\s*/, "").trim();

    // 4. Trường hợp ngày: 60 ngày, 60 ngay, 60d, 60 day
    if (/^(ngày|ngay|d|day|days)/.test(textPart)) {
        const days = Math.round(num);

        const date = baseDate ? addDays(new Date(baseDate), days) : null;

        return {
            months: 0,
            date,
            display: `${days} ngày`,
            unit: "DAY",
        };
    }

    // 5. Trường hợp tháng: 12 tháng, 12 thang, 12t, 12m
    if (/^(tháng|thang|t|m|month|months)/.test(textPart)) {
        const months = Math.round(num);

        const date = baseDate ? addMonths(new Date(baseDate), months) : null;

        return {
            months,
            date,
            display: `${months} tháng`,
            unit: "MONTH",
        };
    }

    // 6. Trường hợp năm: 2 năm, 2 nam, 2n, 2y
    if (/^(năm|nam|n|y|year|years)/.test(textPart)) {
        const months = Math.round(num * 12);

        const date = baseDate ? addMonths(new Date(baseDate), months) : null;

        return {
            months,
            date,
            display: `${months} tháng`,
            unit: "YEAR",
        };
    }

    // 7. Nếu chỉ nhập số, giữ logic đoán cũ của bạn
    if (!textPart) {
        if (num <= 5) {
            num = num * 12;
        }

        const months = Math.round(num);

        const date = baseDate ? addMonths(new Date(baseDate), months) : null;

        return {
            months,
            date,
            display: `${months} tháng`,
            unit: "MONTH",
        };
    }

    return {
        months: 0,
        date: null,
        display: "",
        unit: null,
    };
};