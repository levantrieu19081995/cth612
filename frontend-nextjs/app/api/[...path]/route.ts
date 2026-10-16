import type {NextRequest} from "next/server";
export const dynamic="force-dynamic";
async function proxy(request:NextRequest,context:{params:Promise<{path:string[]}>}) {
  const {path}=await context.params;
  const base=process.env.BACKEND_URL??"http://127.0.0.1:8080";
  const target=new URL("/api/"+path.map(encodeURIComponent).join("/"),base);
  target.search=request.nextUrl.search;
  try {
    let body:Uint8Array|undefined;
    if(request.method==="POST") {
      const chunks:Uint8Array[]=[];let total=0;
      const reader=request.body?.getReader();
      if(reader) while(true) {
        const {done,value}=await reader.read();if(done) break;
        total+=value.length;
        if(total>65536) {await reader.cancel();return Response.json({code:"PAYLOAD_TOO_LARGE",message:"Yêu cầu quá lớn."},{status:413});}
        chunks.push(value);
      }
      body=new Uint8Array(total);let offset=0;for(const chunk of chunks) {body.set(chunk,offset);offset+=chunk.length;}
    }
    const response=await fetch(target,{method:request.method,headers:{"Content-Type":"application/json"},
      body:body as BodyInit|undefined,cache:"no-store",signal:AbortSignal.timeout(10000)});
    return new Response(await response.text(),{status:response.status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
  } catch {return Response.json({code:"BACKEND_UNAVAILABLE",message:"Không thể liên hệ backend. Nếu vừa đặt vé, hãy gửi lại cùng thông tin để kiểm tra."},{status:503});}
}
export const GET=proxy;
export const POST=proxy;
