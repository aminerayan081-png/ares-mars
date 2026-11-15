"use strict";
/* ARES Phase 3: Image Laboratory (gallery + viewer). Needs science.js loaded first. */
const LAB={id:null,zoom:1,full:false,steps:[1,2,3,4,6,8]};
const labSafe=u=>/^https:\/\//.test(u||"")?u:"";
const labEv=im=>["green","yellow","blue"].includes(im.evidence)?im.evidence:"blue";

/* Sub-menu at the top of the Science tab. */
function sciNav(){
  const v=SCIUI.view||"targets";
  const b=(k,t)=>`<button class="sci-btn${v===k?" on":""}" aria-pressed="${v===k}" onclick="labTab('${k}')">${t}</button>`;
  return`<div class="sci-nav">${b("targets","Targets")}${b("images","Image Lab")}</div>`;
}
function labTab(k){SCIUI.view=k;renderSide();sciTop()}

/* Gallery */
function labCard(im){
  const th=labSafe(im.thumbUrl);
  return`<div class="sci-card lab-card" role="button" tabindex="0" onclick="labOpen('${im.id}')" onkeydown="if(event.key==='Enter')labOpen('${im.id}')">
  ${th?`<img loading="lazy" src="${esc(th)}" alt="${esc(im.title)}" onerror="this.replaceWith(document.createTextNode('[thumbnail unavailable]'))">`:'<span class="m">[no thumbnail]</span><br>'}
  <b>${esc(im.title)}</b> ${bd(labEv(im))}<br><span class="m">${esc(im.catalogId||im.id)} · ${esc(im.instrument||"instrument unknown")} · ${im.observed?"observed "+esc(im.observed):"observation date unavailable"}</span></div>`;
}
function labList(){
  const n=SCI.images.length;
  if(!n)return'<div class="sci"><h3>Image Lab</h3><p class="m">⚠ No image records could be loaded.</p></div>';
  return`<div class="sci"><h3>Image Lab</h3>
  <p class="m">Real NASA/JPL images that ARES checked. Tap one to inspect it. A photo does not by itself give the exact map location of what it shows.</p>
  <p class="m">${n} image${n===1?"":"s"}</p>${SCI.images.map(labCard).join("")}</div>`;
}

/* Replaces the simple version in science.js: tapping a thumbnail in a target opens the viewer. */
function sciImageHTML(im){
  const th=labSafe(im.thumbUrl);
  return`<div class="sci-img"><div role="button" tabindex="0" onclick="labOpen('${im.id}')" onkeydown="if(event.key==='Enter')labOpen('${im.id}')">${th?`<img loading="lazy" src="${esc(th)}" alt="${esc(im.title)}" onerror="this.replaceWith(document.createTextNode('Thumbnail could not be loaded.'))">`:""}</div>
  <div><b>${esc(im.title)}</b><br><span class="m">${esc(im.catalogId||"")} · ${esc(im.instrument||"instrument unknown")} · observed ${im.observed?esc(im.observed):"date unavailable"}${im.sol?" (sol "+esc(im.sol)+")":""}<br>Credit: ${esc(im.credit||"unknown")}</span><br>
  <button class="sci-btn" onclick="labOpen('${im.id}')">🔍 Inspect in Image Lab</button> ${sciLink(im.pageUrl,"NASA page")}</div></div>`;
}

/* Viewer */
function labMeta(im,targets){
  const row=(k,v)=>`<div class="lab-row"><b>${k}:</b> ${v}</div>`;
  const s=SCI.srcs[im.sourceId];
  const coord=(im.lat!=null&&im.lon!=null&&isLL([im.lat,im.lon]))?fc([im.lat,im.lon])+" "+bd("green"):"Not published. This image is unplaced.";
  const srcHTML=s?`${sciLink(s.url,s.title||im.sourceId)}<br><span class="m">${esc(s.publisher||"Publisher unknown")} · ${s.published?esc(s.published):"publication date unavailable"}</span> ${s.verified?'<span class="b green">✔ checked '+esc(s.checkedOn||"")+'</span>':WARN}`:'<span class="b warn">⚠ Source record missing</span>';
  const links=[sciLink(im.pageUrl,"Open NASA page"),labSafe(im.fullUrl)?sciLink(im.fullUrl,"Open original file"):""].filter(Boolean).join(" · ");
  return`<summary>Details and sources</summary>
  ${row("Evidence",bd(labEv(im))+" real NASA image")}
  ${row("Catalog ID",esc(im.catalogId||"unavailable"))}
  ${row("Mission",esc(im.mission||"unavailable")+" · "+esc(im.platform||""))}
  ${row("Instrument",esc(im.instrument||"unavailable"))}
  ${row("Observed",im.observed?esc(im.observed)+(im.sol?" (sol "+esc(im.sol)+")":""):"date unavailable")}
  ${row("Published",im.published?esc(im.published):"date unavailable")}
  ${row("Credit",esc(im.credit||"unavailable"))}
  ${row("Location",coord)}
  <p>${esc(im.description||"No description recorded.")}</p>
  <p class="m"><b>Limitations:</b> ${esc(im.limits||"none recorded")}</p>
  <div class="lab-row"><b>Linked targets:</b><br>${targets.length?targets.map(r=>`<button class="sci-btn" onclick="labGoTarget('${r.id}')">${esc(r.name)}</button>`).join(""):'<span class="m">No target linked yet.</span>'}</div>
  <div class="lab-row"><b>Source:</b><br>${srcHTML}</div>
  <div class="lab-row">${links}</div>`;
}
function labOpen(id){
  const im=SCI.imgById[id];if(!im)return;
  labClose();
  LAB.id=id;LAB.zoom=1;LAB.full=false;
  const src=labSafe(im.viewUrl)||labSafe(im.thumbUrl);
  const targets=SCI.targets.filter(r=>r.imageIds.includes(id));
  const canFull=labSafe(im.fullUrl)&&im.fullUrl!==im.viewUrl;
  const el=document.createElement("div");
  el.id="lab-view";el.setAttribute("role","dialog");el.setAttribute("aria-label","Image viewer");
  el.innerHTML=`<div class="lab-top"><b class="lab-title">${esc(im.title)}</b><button onclick="labClose()" aria-label="Close viewer">✕</button></div>
  <div class="lab-tools"><button onclick="labZoom(-1)" aria-label="Zoom out">−</button><span id="lab-z">Fit</span><button onclick="labZoom(1)" aria-label="Zoom in">+</button><button onclick="labZoomFit()">Fit width</button>${canFull?'<button onclick="labFull()">Load original</button>':""}</div>
  <div class="lab-pan" id="lab-pan"><p class="m" id="lab-load" style="padding:10px">${src?"Loading image…":"No image link available."}</p>${src?`<img id="lab-img" hidden alt="${esc(im.title)}" src="${esc(src)}" onload="labLoaded()" onerror="labFail()">`:""}</div>
  <details class="lab-meta" open>${labMeta(im,targets)}</details>`;
  document.body.appendChild(el);
  document.body.classList.add("lab-open");
}
function labClose(){
  const el=$("#lab-view");if(el)el.remove();
  document.body.classList.remove("lab-open");LAB.id=null;
}
function labLoaded(){
  const img=$("#lab-img"),l=$("#lab-load");
  if(img)img.hidden=false;
  if(l)l.hidden=true;
  labApplyZoom();
}
function labFail(){
  const im=SCI.imgById[LAB.id],img=$("#lab-img"),l=$("#lab-load");
  if(!im)return;
  if(LAB.full&&img){            // the big original failed: go back to the standard version
    LAB.full=false;img.src=labSafe(im.viewUrl);
    if(l){l.hidden=false;l.textContent="The original file could not be loaded. Showing the standard version."}
    return;
  }
  if(img)img.hidden=true;
  if(l){l.hidden=false;l.innerHTML=`⚠ The image could not be loaded (it may be blocked or offline). ${sciLink(im.pageUrl,"Open the NASA page")}`}
}
function labZoom(d){
  const i=LAB.steps.indexOf(LAB.zoom);
  LAB.zoom=LAB.steps[Math.max(0,Math.min(LAB.steps.length-1,i+d))];
  labApplyZoom();
}
function labZoomFit(){LAB.zoom=1;labApplyZoom();const p=$("#lab-pan");if(p){p.scrollLeft=0;p.scrollTop=0}}
function labApplyZoom(){
  const img=$("#lab-img"),z=$("#lab-z");
  if(img)img.style.width=(LAB.zoom*100)+"%";
  if(z)z.textContent=LAB.zoom===1?"Fit":"×"+LAB.zoom;
}
function labFull(){
  const im=SCI.imgById[LAB.id];if(!im)return;
  const u=labSafe(im.fullUrl);if(!u)return;
  if(!confirm("Load the original full-size file? It can be large and may use a lot of mobile data."+(im.fullSizeNote?"\n\n"+im.fullSizeNote:"")))return;
  const img=$("#lab-img"),l=$("#lab-load");
  if(l){l.hidden=false;l.textContent="Loading original…"}
  LAB.full=true;if(img)img.src=u;
}
/* From the viewer back to a target record. */
function labGoTarget(tid){
  labClose();
  SCIUI.view="targets";S.tab="sci";
  if(isMobile()&&S.sheet==="closed")S.sheet="half";
  sciOpen(tid);
}
document.addEventListener("keydown",e=>{if(e.key==="Escape")labClose()});
