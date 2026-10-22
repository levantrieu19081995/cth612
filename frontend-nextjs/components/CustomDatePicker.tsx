'use client';
import { DateInput, DateInputProps } from "@mantine/dates";
import { IconCalendar } from "@tabler/icons-react";
import { useState } from "react";
import { dateParser } from "./utils/date-format";

interface Props extends DateInputProps {
    invalidMessage?: string;
}

const CustomDatePicker = (props: Props) => {
    const { onChange, value, locale = "vi", valueFormat = "DD/MM/YYYY", invalidMessage = "Ngày vừa nhập không hợp lệ", error, onKeyDown, ...rest } = props;

    const [errorDate, setErrorDate] = useState("");

    const getSafeDate = (val: any) => {
        if (!val) return null;

        // Cộng thêm 7 tiếng (hoặc 12 tiếng) vào timestamp để đẩy nó
        // thoát khỏi ranh giới nhạy cảm của ngày hôm trước
        const timestamp = typeof val === "number" ? val : new Date(val).getTime();
        const forcedDate = new Date(timestamp + 7 * 60 * 60 * 1000); // Cộng 7 giờ

        return new Date(forcedDate.getFullYear(), forcedDate.getMonth(), forcedDate.getDate(), 12, 0, 0);
    };

    const safeValue = getSafeDate(value);

    // console.log("Original Value:", value);
    // console.log("Safe Value:", safeValue);
    // console.log("Safe Value String:", safeValue?.toString());

    return (
        <DateInput
            {...rest}
            value={safeValue}
            popoverProps={{
                withinPortal: true,
                zIndex: 2000,
            }}
            locale={locale}
            valueFormat={valueFormat}
            leftSection={<IconCalendar size={16} />}
            error={errorDate || error}
            styles={{
                error: {
                    fontSize: 13,
                },
                input: {
                    fontSize: 14,
                },
            }}
            onKeyDown={(e) => {
                if (e.key === "Enter") {
                    e.currentTarget.blur();
                }
                onKeyDown?.(e);
            }}
            onChange={(val) => {
                if (!val) {
                    setErrorDate("");
                    onChange?.(val);
                    return;
                }

                setErrorDate("");
                onChange?.(val);
            }}
            dateParser={(input) => {
                if (!input || input.trim() === "") {
                    setErrorDate("");
                    return null;
                }

                const parsed = dateParser(input);
                if (!parsed) {
                    setErrorDate(invalidMessage);
                    return null;
                }
                setErrorDate("");
                return parsed;
            }}
        />
    );
};

export default CustomDatePicker;
