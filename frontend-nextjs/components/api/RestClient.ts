"use client";

import axios, { AxiosRequestConfig, AxiosRequestHeaders, AxiosResponse } from "axios";
import { GetServerSidePropsContext } from "next/types";
import https from "https";
import { getRuntimeConfig } from "../hooks/useRuntimeConfig";

const versionHeaderKey = "X-CUSC-Api-Version".toLowerCase();
const versionUpdatedNeededHeaderKey = "X-CUSC-Api-Version-Update-Needed".toLowerCase();
let accessToken = "";
let orgCode = "";
let orgLevel = -1;
let context = <GetServerSidePropsContext>{};
let isRedirectingToLogin = false;

export const setAccessToken = (_accessToken: string) => {
    accessToken = _accessToken;
    // ensure axios default header is set immediately so subsequent requests in same tick include it
    if (_accessToken && _accessToken !== "undefined") {
        instance.defaults.headers.common.Authorization = "Bearer " + _accessToken;
    } else {
        delete instance.defaults.headers.common.Authorization;
    }
};

export const setOrgCode = (_code: string) => {
    orgCode = _code;
};
export const setOrgLevel = (_level: number) => {
    orgLevel = _level;
};

// Resolve APP_API_URL at runtime using shared getRuntimeConfig
const resolveBaseURL = async () => {
    const config = await getRuntimeConfig();
    instance.defaults.baseURL = config.appApiUrl;
    return config.appApiUrl;
};

export const getAccessToken = () => accessToken;
export const getOrgCode = () => orgCode;

export const setContext = (_context: GetServerSidePropsContext) => {
    context = _context;
};

export const getCustomInstance = (defaultConfig: AxiosRequestConfig<any> = {}) => {
    const customInstance = axios.create({
        baseURL: "",
        timeout: 600000,
        headers: {
            Accept: "application/json",
        },
        ...defaultConfig,
    });

    // Interceptor để set baseURL runtime trước mỗi request (chỉ gọi một lần)
    customInstance.interceptors.request.use(
        async (config) => {
            const runtimeConfig = await getRuntimeConfig();
            config.baseURL = `${runtimeConfig.appApiUrl}/file-service`;
            return config;
        },
        (error) => Promise.reject(error),
    );

    const get = async (path: string, params = {}): Promise<AxiosResponse> => {
        const headers = await getHttpHeaders();
        console.debug("[RestClient:file-service] GET", path, headers);
        return customInstance.get(path, Object.assign(headers, params));
    };

    const del = async (path: string, params = {}): Promise<AxiosResponse> => {
        const headers = await getHttpHeaders();
        console.debug("[RestClient:file-service] DELETE", path, headers);
        return customInstance.delete(path, Object.assign(headers, params));
    };

    const post = async (path: string, data: any, params = {}): Promise<AxiosResponse> => {
        const headers = await getHttpHeaders();
        console.debug("[RestClient:file-service] POST", path, headers);
        return customInstance.post(path, data, Object.assign(headers, params));
    };

    const put = async (path: string, data: any): Promise<AxiosResponse> => {
        const headers = await getHttpHeaders();
        console.debug("[RestClient:file-service] PUT", path, headers);
        return customInstance.put(path, data, headers);
    };

    const patch = async (path: string, data: any): Promise<AxiosResponse> => {
        const headers = await getHttpHeaders();
        console.debug("[RestClient:file-service] PATCH", path, headers);
        return customInstance.patch(path, data, headers);
    };

    return {
        get,
        del,
        post,
        put,
        patch,
        instance: customInstance,
    };
};

// Config axios
// Set config defaults when creating the instance
const instance = axios.create({
    baseURL: "",
    httpsAgent: new https.Agent({ rejectUnauthorized: false }),
});

if (typeof window !== "undefined") {
    void resolveBaseURL();
}

instance.defaults.headers.common.Accept = "application/json";
instance.defaults.timeout = 60000;

function setAxiosHeaders(_headers: AxiosRequestHeaders) {
    instance.interceptors.request.use(
        async function handleRequestInterceptor(config) {
            Object.assign(config.headers, _headers);
            return config;
        },
        function handleRequestInterceptorError(error) {
            return Promise.reject(error);
        },
    );
}

async function getToken() {
    if (accessToken) {
        return accessToken;
    }
    return null;
}

const getHttpHeaders = async (isAuthenticated = true) => {
    // Add your custom logic here, for example add a Token to the Headers
    if (isAuthenticated) {
        const jwt = await getToken();
        const headers: Record<string, any> = {
            "Data-Organization-Code": orgCode,
            "Data-Organization-Level": orgLevel,
        };

        if (jwt && jwt !== "undefined") {
            headers.Authorization = "Bearer " + jwt;
        }

        // debug: show whether token exists at request time
        console.debug("[RestClient] getHttpHeaders jwt:", jwt ? "PRESENT" : "ABSENT", "orgCode:", orgCode, "orgLevel:", orgLevel);

        return { headers };
    }

    return {};
};

const getLoginUrl = () => {
    if (typeof window === "undefined") return "/user/login";

    const returnUrl = encodeURIComponent(window.location.href);

    if (process.env.ECOSYSTEM_ENABLE === "true") {
        const userPath = process.env.ECOSYSTEM_USER_PATH || "/user";
        return `${userPath}/login?returnUrl=${returnUrl}`;
    }
    console.log('>>>>>>>>>>>>>>>userPath', process.env.ECOSYSTEM_ENABLE);
    
    return `/user/login?returnUrl=${returnUrl}`;
};

const redirectToLogin = () => {
    if (typeof window === "undefined" || isRedirectingToLogin) return;

    const pathname = window.location.pathname || "";
    if (pathname.includes("/user/login")) return;

    isRedirectingToLogin = true;
    setAccessToken("");
    window.location.replace(getLoginUrl());
};

const get = async (path: string, params = {}): Promise<AxiosResponse> => {
    const headers = await getHttpHeaders();
    // console.debug('[RestClient] GET', path, headers)
    return instance.get(path, Object.assign(headers, params));
};

const del = async (path: string, params = {}): Promise<AxiosResponse> => {
    const headers = await getHttpHeaders();
    // console.debug('[RestClient] DELETE', path, headers)
    return instance.delete(path, Object.assign(headers, params));
};

const post = async (path: string, data: any, params = {}): Promise<AxiosResponse> => {
    const headers = await getHttpHeaders();
    // console.debug('[RestClient] POST', path, headers)
    return instance.post(path, data, Object.assign(headers, params));
};

const put = async (path: string, data: any): Promise<AxiosResponse> => {
    const headers = await getHttpHeaders();
    // console.debug('[RestClient] PUT', path, headers)
    return instance.put(path, data, headers);
};

const patch = async (path: string, data: any): Promise<AxiosResponse> => {
    const headers = await getHttpHeaders();
    // console.debug('[RestClient] PATCH', path, headers)
    return instance.patch(path, data, headers);
};

// Request interceptor
instance.interceptors.request.use(
    async (config) => {
        config.baseURL = await resolveBaseURL();

        if (typeof window === "undefined") return config;

        try {
            if (window.localStorage.getItem(versionUpdatedNeededHeaderKey) == "true") {
                // Kiểm tra dialog đã tồn tại chưa
                if (document.getElementById("dialog-update")) {
                    return config;
                }

                const myDialog = document.createElement("dialog");
                myDialog.id = "dialog-update";
                myDialog.style.cssText = "border: 3px solid #000000050; border-radius: 10px;";
                document.body.appendChild(myDialog);

                const h4 = document.createElement("h4");
                h4.innerHTML = "Đã có phiên bản mới!";
                h4.style.fontWeight = "bold";
                myDialog.appendChild(h4);

                const p = document.createElement("p");
                p.innerHTML = "Vui lòng bấm vào nút dưới đây để tải lại trang web";
                p.style.cssText = "color: #a3a3a3";
                myDialog.appendChild(p);

                const btn = document.createElement("button");
                btn.type = "button";
                btn.innerHTML = "Click vào đây để tải lại trang";
                btn.style.cssText =
                    "font-family: inherit;font-size: 1.5rem; padding: 5px; background-image: linear-gradient(45deg, rgb(255 0 0) 0%, rgb(177 15 15) 100%); color: #fff; border: 1px solid #ccc; border-radius: 5px; margin-top: 10px; display: block; width: 100%;";
                btn.onclick = () => {
                    window.localStorage.setItem(versionUpdatedNeededHeaderKey, "false");
                    window.location.reload();
                };

                myDialog.appendChild(btn);

                // One liner function:
                const addCSS = (css: any) => (document.head.appendChild(document.createElement("style")).innerHTML = css);

                // Usage:
                addCSS("dialog::backdrop { background: rgba(0,0,0, 0.3) !important; }");

                // When the modal is shown, we want a fixed body
                document.body.style.position = "fixed";
                document.body.style.top = `-${window.scrollY}px`;
                myDialog.showModal();
            }
        } catch (e) {
            // swallow DOM related errors to avoid breaking requests
            // (keep requests working even if dialog creation fails)
        }

        return config;
    },
    (error) => {
        // Handle request errors here
        return Promise.reject(error);
    },
);
// End of Request interceptor

// Response interceptor
instance.interceptors.response.use(
    (response) => {
        if (typeof window === "undefined") return response;

        try {
            // Modify the response data here
            const currentVersion = window.localStorage.getItem(versionHeaderKey);
            const serverVersion = response.headers[versionHeaderKey];

            if (serverVersion && (!currentVersion || currentVersion == "undefined" || currentVersion == "null")) {
                window.localStorage.setItem(versionHeaderKey, serverVersion);
                window.localStorage.setItem(versionUpdatedNeededHeaderKey, "false");
            } else if (serverVersion && currentVersion != serverVersion) {
                window.localStorage.setItem(versionUpdatedNeededHeaderKey, "true");
                window.localStorage.setItem(versionHeaderKey, serverVersion);
            }
        } catch (e) {
            // ignore storage errors
        }

        return response; // continue with response
    },
    (error) => {
        // Handle response errors here
        const status = error?.response?.status;
        if (status === 401) {
            redirectToLogin();
        }

        return Promise.reject(error);
    },
);
// End of Response interceptor

console.log("[RestClient] Runtime Config instance:", JSON.stringify(instance));

export default {
    get,
    del,
    post,
    put,
    patch,
    instance,
    setAxiosHeaders,
    setAccessToken,
    setOrgCode,
    setOrgLevel,
    getOrgCode,
    getCustomInstance,
};
