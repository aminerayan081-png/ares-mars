"use strict";
/* ARES Phase 3: Science Intelligence (targets).
   Reads data/science.json, data/images.json, data/sources.json.
   Search, filters and the open target are screen state only (not saved). */
const SCI={loaded:false,failed:null,targets:[],byId:{},cats:{},images:[],imgById:{},srcs:{},skipped:0,notes:[]};
const SCIUI={q:"",cat:"all",ev:"all",data:"all",open:null};
const SCI_ID=/^[A-Za-z0-9_-]+$/;
const sciArr=a=>Array.isArray(a)?a:[];
const sciCat=k=>esc(SCI.cats[k]||k||"Uncategorised");
const sciLink=(u,t)=>/^https:\/\//.test(u||"")?`<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)} ↗</a>`:esc(t);

async function loadScience(){
  try{
    const get=async u=>{try{return await loadJSON(u)}catch(e){console.warn("ARES science:",e.message);return null}};
    const [sc,im,so]=await Promise.all([get("data/science.json"),get("data/images.json"),get("data/sources.json")]);
    if(!sc||!Array.isArray(sc.targets)){SCI.failed="data/science.json could not be loaded."}
    else{
      SCI.cats=(sc.categories&&typeof sc.categories==="object")?sc.categories:{};
      sc.targets.forEach(t=>{
        if(!t||!SCI_ID.test(t.id||"")||!t.name||SCI.byId[t.id]){SCI.skipped++;return}
        const r=Object.assign({},t,{
          facts:sciArr(t.facts).filter(f=>f&&f.text),
          limits:sciArr(t.limits),imageIds:sciArr(t.imageIds),sourceIds:sciArr(t.sourceIds),
          evidence:["green","yellow","blue"].includes(t.evidence)?t.evidence:"blue"}); // unknown label -> most cautious
        SCI.targets.push(r);SCI.byId[r.id]=r;
      });
      if(!SCI.targets.length)SCI.failed="No valid science targets were found in data/science.json.";
    }
    if(im&&Array.isArray(im.images))im.images.forEach(i=>{if(i&&SCI_ID.test(i.id||"")){SCI.images.push(i);SCI.imgById[i.id]=i}});
    else SCI.notes.push("Image records could not be loaded.");
    if(so&&so.sources&&typeof so.sources==="object")SCI.srcs=so.sources;
    else SCI.notes.push("Source records could not be loaded.");
  }catch(e){SCI.failed="Science data problem: "+e.message}
  SCI.loaded=true;
  if(S.tab==="sci")renderSide();
}

/* Called by ui.js for the Science tab. */
function panelScience(){
  if(!SCI.loaded)return'<h3>Science Targets</h3><p class="m">Loading science data…</p>';
  if(SCI.failed)return`<p><span class="b warn">⚠</span> ${esc(SCI.failed)} Showing the basic target list instead.</p>`+panelSci();
  const nav=typeof sciNav==="function"?sciNav():"";
  if(SCIUI.view==="images"&&typeof labList==="function")return nav+labList();
  return nav+(SCIUI.open?sciDetail(SCIUI.open):sciList());
}

function sciFiltered(){
  const q=SCIUI.q.trim().toLowerCase();
  return SCI.targets.filter(r=>{
    if(SCIUI.cat!=="all"&&r.category!==SCIUI.cat)return false;
    if(SCIUI.ev!=="all"&&r.evidence!==SCIUI.ev)return false;
    const hasImg=r.imageIds.some(i=>SCI.imgById[i]),hasObs=r.facts.some(f=>f.kind==="observation");
    if(SCIUI.data==="img"&&!hasImg)return false;
    if(SCIUI.data==="noimg"&&hasImg)return false;
    if(SCIUI.data==="obs"&&!hasObs)return false;
    if(q&&!(r.name+" "+(r.short||"")+" "+(SCI.cats[r.category]||r.category||"")).toLowerCase().includes(q))return false;
    return true;
  });
}
function sciCard(r){
  const mid=r.mapId&&T_[r.mapId]?r.mapId:null,pinned=mid&&P(mid);
  const n=r.imageIds.filter(i=>SCI.imgById[i]).length;
  return`<div class="sci-card" role="button" tabindex="0" onclick="sciOpen('${r.id}')" onkeydown="if(event.key==='Enter')sciOpen('${r.id}')"><b>${esc(r.name)}</b> ${bd(r.evidence)}<br><span class="m">${sciCat(r.category)} · ${n} image${n===1?"":"s"} · ${pinned?"🔵 user pin":"📍 unplaced"}</span><br>${esc(r.short||"")}</div>`;
}
function sciListHTML(){
  const f=sciFiltered();
  return f.length?f.map(sciCard).join(""):'<p class="m">No targets match. <button class="sci-btn" onclick="sciReset()">Clear search and filters</button></p>';
}
function sciList(){
  const opt=(v,l,cur)=>`<option value="${v}"${cur===v?" selected":""}>${l}</option>`;
  const note=(SCI.skipped?`<p class="m">⚠ ${SCI.skipped} invalid record(s) were skipped.</p>`:"")+SCI.notes.map(n=>`<p class="m">⚠ ${esc(n)}</p>`).join("");
  return`<div class="sci"><h3>Science Targets</h3>
  <p class="m">Built from NASA/JPL pages that ARES opened and checked. Badges describe the source information. Coordinates appear only when a source publishes them.</p>
  <input class="sci-search" type="search" placeholder="Search targets" aria-label="Search targets" value="${esc(SCIUI.q)}" oninput="sciSet('q',this.value)">
  <div class="sci-bar">
   <label>Category<select onchange="sciSet('cat',this.value)">${opt("all","All categories",SCIUI.cat)}${Object.keys(SCI.cats).map(k=>opt(esc(k),esc(SCI.cats[k]),SCIUI.cat)).join("")}</select></label>
   <label>Evidence<select onchange="sciSet('ev',this.value)">${opt("all","All evidence",SCIUI.ev)}${opt("green","🟢 Real data",SCIUI.ev)}${opt("yellow","🟡 Calculation",SCIUI.ev)}${opt("blue","🔵 Simulation",SCIUI.ev)}</select></label>
   <label>Data<select onchange="sciSet('data',this.value)">${opt("all","All targets",SCIUI.data)}${opt("img","Has images",SCIUI.data)}${opt("noimg","No image yet",SCIUI.data)}${opt("obs","Has observations",SCIUI.data)}</select></label>
  </div>
  <p class="m" id="sci-count">${sciFiltered().length} of ${SCI.targets.length} targets</p>
  <div id="sci-list">${sciListHTML()}</div>${note}</div>`;
}
/* Update only the results so the search box keeps focus while typing. */
function sciSet(k,v){
  SCIUI[k]=v;
  const l=$("#sci-list"),c=$("#sci-count");if(!l||!c)return;
  c.textContent=sciFiltered().length+" of "+SCI.targets.length+" targets";
  l.innerHTML=sciListHTML();
}
function sciReset(){SCIUI.q="";SCIUI.cat="all";SCIUI.ev="all";SCIUI.data="all";renderSide()}
function sciTop(){const a=$("#sc"),b=$("#side");if(a)a.scrollTop=0;if(b)b.scrollTop=0}

function sciOpen(id){
  const r=SCI.byId[id];if(!r)return;
  SCIUI.open=id;
  if(r.mapId&&T_[r.mapId])S.sel=r.mapId;   // also shows it in the "Selected target" panel
  save();render();sciTop();
}
function sciBack(){SCIUI.open=null;renderSide();sciTop()}
function sciLocate(id){
  const r=SCI.byId[id];if(!r||!r.mapId||!T_[r.mapId]||!P(r.mapId))return;
  pick(r.mapId,1);if(isMobile())closeSheet();
}
function sciPlace(id){
  const r=SCI.byId[id];if(!r||!r.mapId||!T_[r.mapId])return;
  S.sel=r.mapId;save();placeTarget();
}

function sciSourceHTML(sid,n){
  const s=SCI.srcs[sid];
  if(!s)return`<div class="sci-src"><b>[${n}]</b> <span class="b warn">⚠ Source record missing</span> <span class="m">(${esc(sid)})</span></div>`;
  const badge=s.verified?`<span class="b green">✔ checked ${esc(s.checkedOn||"")}</span>`:WARN;
  return`<div class="sci-src"><b>[${n}]</b> ${sciLink(s.url,s.title||sid)}${s.url?"":' <span class="m">(link to add)</span>'}<br>
  <span class="m">${esc(s.publisher||"Publisher unknown")} · ${s.published?esc(s.published):"publication date unavailable"}</span> ${badge}<br>
  <span class="m"><b>Supports:</b> ${esc(s.supports||"—")}</span><br><span class="m"><b>Limits:</b> ${esc(s.limits||"—")}</span></div>`;
}
function sciImageHTML(im){
  return`<div class="sci-img"><a href="${/^https:\/\//.test(im.pageUrl||"")?esc(im.pageUrl):"#"}" target="_blank" rel="noopener"><img loading="lazy" src="${esc(im.thumbUrl||"")}" alt="${esc(im.title)}" onerror="this.replaceWith(document.createTextNode('Image could not be loaded. Use the link below.'))"></a>
  <div><b>${esc(im.title)}</b><br><span class="m">${esc(im.catalogId||"")} · ${esc(im.instrument||"instrument unknown")} · observed ${im.observed?esc(im.observed):"date unavailable"}${im.sol?" (sol "+esc(im.sol)+")":""}<br>Credit: ${esc(im.credit||"unknown")}</span><br>${sciLink(im.pageUrl,"Open NASA page")}</div></div>`;
}
function sciDetail(id){
  const r=SCI.byId[id];if(!r){SCIUI.open=null;return sciList()}
  const mid=r.mapId&&T_[r.mapId]?r.mapId:null,p=mid?P(mid):null;
  const ref=sid=>{const i=r.sourceIds.indexOf(sid);return i>=0?i+1:"?"};
  const li=f=>`<li>${esc(f.text)} <span class="m">${sciArr(f.sources).map(s=>"["+ref(s)+"]").join("")}</span></li>`;
  const obs=r.facts.filter(f=>f.kind==="observation"),itp=r.facts.filter(f=>f.kind!=="observation");
  const imgs=r.imageIds.map(i=>SCI.imgById[i]).filter(Boolean);
  let loc="";
  if(r.lat!=null&&r.lon!=null&&isLL([r.lat,r.lon]))loc+=`<p><b>Published coordinates:</b> ${fc([r.lat,r.lon])} ${bd("green")}<br><span class="m">System: ${esc(r.coordSystem||"not stated")}. Map markers for published coordinates are not built yet.</span></p>`;
  else loc+=`<p><b>Verified coordinates:</b> none. <span class="m">No coordinates are published in the sources ARES has checked.</span></p>`;
  if(mid&&p)loc+=`<p><b>Your pin:</b> ${fc(p)} ${bd("blue")} <span class="m">your own placement, not a NASA coordinate</span></p><button class="sci-btn" onclick="sciLocate('${r.id}')">🧭 Show pin on map</button><button class="sci-btn" onclick="sciPlace('${r.id}')">📍 Re-place pin</button>`;
  else if(mid)loc+=`<button class="sci-btn pri" onclick="sciPlace('${r.id}')">📍 Place a pin on the map</button><p class="m">A pin is your own placement ${bd("blue")}, not a NASA coordinate.</p>`;
  else loc+=`<p class="m">Unplaced: this target has no map marker. Its record, images and sources are still available.</p>`;
  if(mid)loc+=`<p class="m">Route and visited tools for this target are in the Selected target panel.</p>`;
  const d=(t,open,body)=>`<details class="sci-d"${open?" open":""}><summary>${t}</summary>${body}</details>`;
  return`<div class="sci"><button class="sci-btn" onclick="sciBack()">← All targets</button>
  <h2 style="margin:6px 0">${esc(r.name)}</h2>
  <p>${bd(r.evidence)} <span class="sci-tag">${sciCat(r.category)}</span> <span class="sci-tag">${esc(r.status||"status unknown")}</span></p>
  <p>${esc(r.short||"")}</p>
  ${d("Why it matters",true,`<p>${esc(r.relevance||"—")}</p><p class="m">${esc(r.mission||"")}${r.instrument?" · "+esc(r.instrument):""}${r.observedNote?" · "+esc(r.observedNote):""}</p>`)}
  ${d("What the sources report ("+r.facts.length+")",true,
     (obs.length?`<p><span class="sci-tag">Observation</span> reported as seen or measured</p><ul>${obs.map(li).join("")}</ul>`:"")+
     (itp.length?`<p><span class="sci-tag">Published interpretation</span> explanation proposed by scientists, not confirmed fact</p><ul>${itp.map(li).join("")}</ul>`:"")+
     (r.facts.length?"":'<p class="m">No facts recorded.</p>'))}
  ${d("Limitations",true,r.limits.length?`<ul>${r.limits.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`:'<p class="m">No limitations recorded.</p>')}
  ${d("Location",true,loc)}
  ${d("Images ("+imgs.length+")",false,imgs.length?imgs.map(sciImageHTML).join(""):'<p class="m">No verified image for this target yet.</p>')}
  ${d("Sources ("+r.sourceIds.length+")",false,r.sourceIds.map((s,i)=>sciSourceHTML(s,i+1)).join("")||'<p class="m">No sources listed.</p>')}
  </div>`;
}
