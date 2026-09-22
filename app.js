const $=s=>document.querySelector(s);
const $$=s=>document.querySelectorAll(s);
const state={html:"",css:"",js:""};

function saveDraft(){localStorage.setItem("novaDraft",JSON.stringify({html:$("#htmlCode").value,css:$("#cssCode").value,js:$("#jsCode").value}));}
function loadDraft(){try{const d=JSON.parse(localStorage.getItem("novaDraft")||"{}");$("#htmlCode").value=d.html||"";$("#cssCode").value=d.css||"";$("#jsCode").value=d.js||"";}catch{}}
function setPage(id){
  $$(".page").forEach(x=>x.classList.toggle("active",x.id===id));
  $$(".nav").forEach(x=>x.classList.toggle("active",x.dataset.page===id));
  const labels={dashboard:"Dashboard",builder:"Builder",deploy:"Deploy",projects:"Projects",docs:"Documentation",settings:"Settings"};
  $("#pageTitle").textContent=labels[id]||id;
  if(id==="projects")renderProjects();
}
$$(".nav").forEach(b=>b.onclick=()=>setPage(b.dataset.page));
$$("[data-go]").forEach(b=>b.onclick=()=>setPage(b.dataset.go));

function log(s){$("#log").textContent+=`\n${s}`;$("#log").scrollTop=$("#log").scrollHeight}
function resetLog(){ $("#log").textContent="NOVA BUILDER initialized.\n"; $("#result").classList.add("hidden"); }

$("#loadDemo").onclick=()=>{
 $("#htmlCode").value=`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>NOVA Site</title></head><body><main><h1>NOVA SITE</h1><p>Deployed with NOVA BUILDER.</p></main></body></html>`;
 $("#cssCode").value=`body{margin:0;min-height:100vh;display:grid;place-items:center;background:#111;color:#eee;font-family:Arial,sans-serif}main{text-align:center}h1{letter-spacing:.18em}p{opacity:.6}`;
 $("#jsCode").value=`console.log("NOVA BUILDER demo");`; saveDraft();
};
$("#clearBtn").onclick=()=>{$("#htmlCode").value="";$("#cssCode").value="";$("#jsCode").value="";saveDraft()};
$("#previewBtn").onclick=()=>{
 const html=$("#htmlCode").value||"<h1>NOVA BUILDER</h1>";
 const css=$("#cssCode").value; const js=$("#jsCode").value;
 const doc=`<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${html}<script>${js.replace(/<\/script>/gi,"<\\/script>")}<\/body></html>`;
 $("#preview").srcdoc=doc;$("#previewWrap").classList.remove("hidden");
};
$("#closePreview").onclick=()=>$("#previewWrap").classList.add("hidden");
$("#sendDeploy").onclick=()=>{setPage("deploy");};

["#htmlCode","#cssCode","#jsCode"].forEach(s=>$(s).addEventListener("input",saveDraft));

async function readFile(file){return file?await file.text():null}
function cleanName(name){return name.replace(/^\/+/,"").replace(/\.\.+/g,".").replace(/\\/g,"/")}
function validProjectName(name){return /^[a-z0-9][a-z0-9._-]{0,99}$/.test(name)&&!name.includes("---")}

$("#deployBtn").onclick=async()=>{
 resetLog(); $("#logState").textContent="RUNNING"; $("#statusText").textContent="Deploying";
 const name=$("#projectName").value.trim().toLowerCase();
 if(!validProjectName(name)){log("ERROR: Project name tidak valid. Gunakan lowercase, angka, titik, underscore, atau minus.");$("#logState").textContent="ERROR";$("#statusText").textContent="Ready";return}
 let files=[];
 const htmlFile=$("#htmlFile").files[0], cssFile=$("#cssFile").files[0], jsFile=$("#jsFile").files[0];
 if(htmlFile) files.push({file:"index.html",content:await readFile(htmlFile)});
 if(cssFile) files.push({file:"style.css",content:await readFile(cssFile)});
 if(jsFile) files.push({file:"script.js",content:await readFile(jsFile)});
 for(const f of $("#extraFiles").files){files.push({file:cleanName(f.webkitRelativePath||f.name),content:await readFile(f)});}
 if(!files.length && $("#htmlCode").value.trim()){
   files=[{file:"index.html",content:$("#htmlCode").value}];
   if($("#cssCode").value.trim())files.push({file:"style.css",content:$("#cssCode").value});
   if($("#jsCode").value.trim())files.push({file:"script.js",content:$("#jsCode").value});
 }
 if(!files.length){log("ERROR: Masukkan index.html atau gunakan Builder.");$("#logState").textContent="ERROR";$("#statusText").textContent="Ready";return}
 if(!files.some(x=>x.file.toLowerCase()==="index.html")){log("ERROR: index.html wajib ada untuk root static site.");$("#logState").textContent="ERROR";$("#statusText").textContent="Ready";return}
 log(`Preparing ${files.length} file(s)...`);
 try{
   const r=await fetch("/api/deploy",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,target:$("#target").value,files})});
   const data=await r.json();
   if(!r.ok)throw new Error(data.error||"Deployment failed");
   log(`Deployment created: ${data.url||data.inspector||data.id}`);
   $("#logState").textContent="SUCCESS";$("#statusText").textContent="Published";
   const row={name,url:data.url||"",id:data.id||"",time:new Date().toISOString()};
   const history=JSON.parse(localStorage.getItem("novaProjects")||"[]");history.unshift(row);localStorage.setItem("novaProjects",JSON.stringify(history.slice(0,30)));
   $("#result").innerHTML=`<b>Deployment ready.</b><br>${data.url?`<a href="${data.url}" target="_blank" rel="noopener">${data.url}</a>`:"Deployment ID: "+(data.id||"unknown")}`;
   $("#result").classList.remove("hidden");
 }catch(e){log("ERROR: "+e.message);$("#logState").textContent="ERROR";$("#statusText").textContent="Ready";}
};

function renderProjects(){
 const list=$("#projectList"), h=JSON.parse(localStorage.getItem("novaProjects")||"[]");
 if(!h.length){list.innerHTML='<div class="card"><p>Belum ada deployment lokal.</p></div>';return}
 list.innerHTML=h.map(x=>`<div class="project-row"><div><strong>${escapeHtml(x.name)}</strong><small>${new Date(x.time).toLocaleString()}</small></div>${x.url?`<a href="${x.url}" target="_blank" rel="noopener">OPEN</a>`:""}</div>`).join("");
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
$("#clearProjects").onclick=()=>{localStorage.removeItem("novaProjects");renderProjects()};
$("#wipeStorage").onclick=()=>{localStorage.removeItem("novaProjects");localStorage.removeItem("novaDraft");location.reload()};

loadDraft();renderProjects();
