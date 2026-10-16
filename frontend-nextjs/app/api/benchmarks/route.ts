import {readdir,readFile} from "node:fs/promises";
import path from "node:path";
import type {NextRequest} from "next/server";
export const dynamic="force-dynamic";
export const runtime="nodejs";
export async function GET(request:NextRequest) {
  const folder=path.resolve(process.cwd(),"../benchmark-results");
  const download=request.nextUrl.searchParams.get("download");
  if(download) {
    if(!/^[a-zA-Z0-9_-]+\.csv$/.test(download)) return Response.json({message:"Tên file không hợp lệ."},{status:400});
    try {return new Response(await readFile(path.join(folder,download),"utf8"),{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":'attachment; filename="'+download+'"',"Cache-Control":"no-store"}});}
    catch {return Response.json({message:"Không tìm thấy kết quả."},{status:404});}
  }
  let names:string[];
  try {names=(await readdir(folder)).filter(name=>/^[a-zA-Z0-9_-]+\.json$/.test(name)).sort().reverse().slice(0,30);}
  catch(error) {
    if(error&&typeof error==="object"&&"code" in error&&error.code==="ENOENT") return Response.json({results:[],invalidFiles:0});
    return Response.json({message:"Không đọc được thư mục benchmark."},{status:503});
  }
  const results:unknown[]=[];let invalidFiles=0;
  for(const name of names) {
    try {
      const value:unknown=JSON.parse(await readFile(path.join(folder,name),"utf8"));
      if(value&&typeof value==="object"&&"summary" in value&&value.summary&&typeof value.summary==="object") {
        results.push({file:name,summary:value.summary});
      } else invalidFiles++;
    } catch {invalidFiles++;}
  }
  return Response.json({results,invalidFiles},{headers:{"Cache-Control":"no-store"}});
}
