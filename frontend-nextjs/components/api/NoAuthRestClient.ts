"use client";
import axios, { AxiosResponse } from "axios";
import https from "https";
import { getRuntimeConfig } from "../hook/useRuntimeConfig";

// Config axios
// Set config defaults when creating the instance
const instance = axios.create({
    baseURL: "",
    httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    timeout: 120000,
});
instance.defaults.headers.common.Accept = "application/json";

// Request interceptor để set baseURL runtime (gọi một lần mỗi request)
instance.interceptors.request.use(
    async (config) => {
        const runtimeConfig = await getRuntimeConfig();
        config.baseURL = runtimeConfig.appApiUrl;
        return config;
    },
    (error) => Promise.reject(error),
);

if (typeof window !== "undefined") {
    void getRuntimeConfig();
}

console.log("[NoAuthRestClient] Runtime Config instance:", JSON.stringify(instance));

const getHttpHeaders = async () => {
    return {};
};

const get = async (path: string, params = {}): Promise<AxiosResponse> => instance.get(path, Object.assign(await getHttpHeaders(), params));

const del = async (path: string, params = {}): Promise<AxiosResponse> => instance.delete(path, Object.assign(await getHttpHeaders(), params));

const post = async (path: string, data: any, params = {}): Promise<AxiosResponse> => instance.post(path, data, Object.assign(await getHttpHeaders(), params));

const put = async (path: string, data: any): Promise<AxiosResponse> => instance.put(path, data, await getHttpHeaders());

const patch = async (path: string, data: any): Promise<AxiosResponse> => instance.patch(path, data, await getHttpHeaders());

export default {
    get,
    del,
    post,
    put,
    patch,
    instance,
};
