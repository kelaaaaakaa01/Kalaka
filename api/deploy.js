const crypto = require("crypto");

function json(res, status, body){
  res.status(status).setHeader("Content-Type","application/json");
  res.end(JSON.stringify(body));
}

function safeProjectName(name){
  return typeof name==="string" &&
    /^[a-z0-9][a-z0-9._-]{0,99}$/.test(name) &&
    !name.includes("---");
}

function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

async function vercel(path, options={}){
  const token=process.env.VERCEL_TOKEN;
  if(!token) throw new Error("VERCEL_TOKEN belum diset di Vercel Environment Variables.");
  const r=await fetch("https://api.vercel.com"+path,{
    ...options,
    headers:{
      "Authorization":"Bearer "+token,
      ...(options.headers||{})
    }
  });
  const text=await r.text();
  let data={}; try{data=text?JSON.parse(text):{}}catch{data={raw:text}};
  if(!r.ok){
    const msg=data.error?.message||data.message||`Vercel API HTTP ${r.status}`;
    throw new Error(msg);
  }
  return data;
}

module.exports=async function handler(req,res){
  if(req.method!=="POST") return json(res,405,{error:"Method not allowed"});
  try{
    const body=req.body||{};
    const name=String(body.name||"").toLowerCase();
    const target=body.target==="production"?"production":"preview";
    const files=Array.isArray(body.files)?body.files:[];
    if(!safeProjectName(name)) return json(res,400,{error:"Invalid Vercel project name"});
    if(!files.length) return json(res,400,{error:"No files supplied"});
    if(files.length>200) return json(res,400,{error:"Too many files"});
    if(!files.some(f=>String(f.file||"").toLowerCase()==="index.html"))
      return json(res,400,{error:"index.html is required"});

    const refs=[];
    for(const item of files){
      const file=String(item.file||"").replace(/^\/+/,"").replace(/\.\.+/g,".").replace(/\\/g,"/");
      if(!file || file.length>240 || file.startsWith(".env") || file.includes("node_modules/"))
        return json(res,400,{error:`Invalid file path: ${file}`});
      const content=String(item.content??"");
      if(Buffer.byteLength(content,"utf8")>2*1024*1024)
        return json(res,400,{error:`File too large: ${file}`});
      const buf=Buffer.from(content,"utf8");
      const sha=crypto.createHash("sha1").update(buf).digest("hex");
      await vercel("/v2/now/files",{
        method:"POST",
        headers:{"x-vercel-digest":sha,"Content-Type":"application/octet-stream"},
        body:buf
      });
      refs.push({file,sha,size:buf.length});
    }

    const deployment=await vercel("/v13/deployments",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        name,
        files:refs,
        target,
        projectSettings:{framework:null}
      })
    });

    return json(res,200,{
      id:deployment.id,
      url:deployment.url?`https://${deployment.url}`:null,
      inspector:deployment.inspectorUrl||null,
      state:deployment.readyState||deployment.state||"QUEUED"
    });
  }catch(err){
    return json(res,500,{error:err.message||"Deployment failed"});
  }
};
