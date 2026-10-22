"use client";
import { useCallback,useEffect,useRef,useState } from "react";
import { apiGet } from "./api";
export function usePolling<T>(path:string,interval=4000) {
  const [data,setData]=useState<T|null>(null);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);
  const [revision,setRevision]=useState(0);
  const refresh=useCallback(()=>setRevision(value=>value+1),[]);
  useEffect(()=>{
    let active=true;let timeout:ReturnType<typeof setTimeout>;
    const controller=new AbortController();
    async function poll() {
      try { const result=await apiGet<T>(path,{signal:controller.signal});if(active) { setData(result);setError(""); } }
      catch(ex) { if(active) setError(ex instanceof Error?ex.message:"Không thể tải dữ liệu."); }
      finally { if(active) {setLoading(false);timeout=setTimeout(()=>void poll(),interval);} }
    }
    setLoading(true);setData(null);setError("");void poll();
    return ()=>{ active=false;controller.abort();clearTimeout(timeout); };
  },[path,interval,revision]);
  return {data,error,loading,refresh};
}
