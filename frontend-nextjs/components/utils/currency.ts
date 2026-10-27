export const currencyUnit = "VND"; // default currency unit

// USAGE
// currencyToString(10000, { unit: 'VND', display: 'none'})

const currency: any = {
    korean: { name: "원", code: "KRW", symbol: "₩" },
    vietnamese: { name: "Đồng", code: "VND", symbol: "₫" },
    english: { name: "Dollar", code: "USD", symbol: "$" },
};

type CurrencyUnitType = "KRW" | "VND" | "USD";
type CurrencyDisplayType = "name" | "code" | "symbol" | "none";
type CurrencyOptionsType = {
    unit?: CurrencyUnitType;
    display?: CurrencyDisplayType;
    locales?: string | string[] | undefined;
    position?: "start" | "end";
};
export const currencyToString = (value: number, options?: CurrencyOptionsType) => {
    var unit = options?.unit || currencyUnit;
    var display = options?.display || "code";
    const country = Object.keys(currency).find((key) => currency[key]["code"] === unit);

    var formatter = new Intl.NumberFormat(options?.locales || "en", {
        // style: 'currency',
        currency: unit,

        // These options are needed to round to whole numbers if that's what you want.
        //minimumFractionDigits: 0, // (this suffices for whole numbers, but will print 2500.10 as $2,500.1)
        //maximumFractionDigits: 0, // (causes 2500.99 to be printed as $2,501)
    });

    switch (options?.display) {
        case "name":
        case "code":
            return options.position == "start"
                ? `${currency[country || 0][display]} ${formatter.format(value)}`
                : `${formatter.format(value)} ${currency[country || 0][display]}`;
        case "symbol":
            return options.position == "start"
                ? `${currency[country || 0][display]} ${formatter.format(value)}`
                : `${formatter.format(value)} ${currency[country || 0][display]}`;
        default:
            return `${formatter.format(value)}`;
    }
};

export const numberToCurrency = (value: number | string | undefined, unit: CurrencyUnitType = "VND", display: CurrencyDisplayType = "code") => {
    return currencyToString(Number(value) || 0, { unit, display });
};

export const formatCurrency = (amount?: number | string | null) => {
    if (typeof amount !== "number" || isNaN(amount)) {
        return "0";
    }
    if (amount === 0) return "0";
    return `${new Intl.NumberFormat("en-US").format(amount)} VND`;
};

// const formatCurrencyVND = (value?: number | string | null) => {
//     const amount = Number(value ?? 0);

//     if (!Number.isFinite(amount)) {
//         return "0";
//     }

//     return new Intl.NumberFormat("vi-VN", {
//         style: "currency",
//         currency: "VND",
//         maximumFractionDigits: 0,
//     }).format(amount);
// };
