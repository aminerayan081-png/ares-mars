"use strict";
/* ARES Phase 3: Source Explorer. Loads after imagetools.js. */
const SRCUI={q:"",type:"all",st:"all",open:null};
const SRC_TYPES={"nasa-article":"NASA article","jpl-article":"JPL article","photojournal":"NASA Photojournal","journal-paper":"Journal paper","mission-page":"Mission page"};
const srcType=t=>SRC_TYPES[t]||t||"Other";
const srcIds=()=>Object.keys(SCI.srcs).filter(k=>SCI_ID.test(k)&&SCI.srcs[k]&&typeof SCI.srcs[k]==="object");

/* Three-button menu (replaces the two-button one from imagelab.js). */
sciNav=function(){
  const v=SCIUI.view||"targets";
  const b=(k,t)=>`<button class="sci-btn${v===k?" on":""}" aria-pressed="${v===k}" onclick="labTab('${k}')">${t}</button>`;
  return`<div class="sci-nav">${b("targets","Targets")}${b("images","Image Lab")}${b("sources","Sources")}</div>`;
};
const _panelScience0=panelScience;
panelScience=function(){
  if(SCI.loaded&&!SCI.failed&&SCIUI.view==="sources")return sciNav()+(SRCUI.open&&SCI.srcs[SRCUI.open]?srcDetail(SRCUI.open):srcList());
  return _panelScience0();
};

function srcFiltered(){
  const q=SRCUI.q.trim().toLowerCase();
  return srcIds().filter(k=>{
    const s=SCI.srcs[k];
    if(SRCUI.type!=="all"&&s.type!==SRCUI.type)return false;
    if(SRCUI.st==="ok"&&!s.verified)return false;
    if(SRCUI.st==="no"&&s.verified)return false;
    if(q&&!((s.title||"")+" "+(s.publisher||"")+" "+(s.supports||"")+" "+k).toLowerCase().includes(q))return false;
    return true;
  });
}
function srcCard(k){
  const s=SCI.srcs[k];
  return`<div class="sci-card" role="button" tabindex="0" onclick="srcOpen('${k}')" onkeydown="if(event.key==='Enter')srcOpen('${k}')"><b>${esc(s.title||k)}</b> ${s.verified?'<span class="b green">✔ checked</span>':WARN}<br><span class="m">${esc(srcType(s.type))} · ${esc(s.publisher||"publisher unknown")} · ${s.published?esc(s.published):"date unavailable"}</span></div>`;
}
function srcListHTML(){
  const f=srcFiltered();
  return f.length?f.map(srcCard).join(""):'<p class="m">No sources match. <button class="sci-btn" onclick="srcReset()">Clear search and filters</button></p>';
}
function srcList(){
  const ids=srcIds();
  if(!ids.length)return'<div class="sci"><h3>Sources</h3><p class="m">⚠ No source records could be loaded.</p></div>';
  const ok=ids.filter(k=>SCI.srcs[k].verified).length;
  const types=[...new Set(ids.map(k=>SCI.srcs[k].type).filter(Boolean))];
  const opt=(v,l,c)=>`<option value="${esc(v)}"${c===v?" selected":""}>${esc(l)}</option>`;
  return`<div class="sci"><h3>Sources</h3>
  <p class="m">${ids.length} sources: ${ok} checked by ARES, ${ids.length-ok} unchecked. "Checked" means ARES opened the page on the date shown and confirmed the facts listed for it. It does not mean NASA endorses ARES.</p>
  <input class="sci-search" type="search" placeholder="Search sources" aria-label="Search sources" value="${esc(SRCUI.q)}" oninput="srcSet('q',this.value)">
  <div class="sci-bar">
   <label>Type<select onchange="srcSet('type',this.value)">${opt("all","All types",SRCUI.type)}${types.map(t=>opt(t,srcType(t),SRCUI.type)).join("")}</select></label>
   <label>Status<select onchange="srcSet('st',this.value)">${opt("all","All",SRCUI.st)}${opt("ok","Checked",SRCUI.st)}${opt("no","Unchecked",SRCUI.st)}</select></label>
  </div>
  <p class="m" id="src-count">${srcFiltered().length} of ${ids.length} sources</p>
  <div id="src-list">${srcListHTML()}</div></div>`;
}
function srcSet(k,v){
  SRCUI[k]=v;
  const l=$("#src-list"),c=$("#src-count");if(!l||!c)return;
  c.textContent=srcFiltered().length+" of "+srcIds().length+" sources";
  l.innerHTML=srcListHTML();
}
function srcReset(){SRCUI.q="";SRCUI.type="all";SRCUI.st="all";renderSide()}
function srcOpen(id){if(!SCI.srcs[id])return;SRCUI.open=id;renderSide();sciTop()}
function srcBack(){SRCUI.open=null;renderSide();sciTop()}

/* Who uses this source? Worked out from the data, not from hand-written lists. */
function srcUses(k){
  const targets=SCI.targets.filter(r=>sciArr(r.sourceIds).includes(k)||r.facts.some(f=>sciArr(f.sources).includes(k)));
  const images=SCI.images.filter(i=>i.sourceId===k);
  const mapIds=targets.map(r=>r.mapId).filter(Boolean);
  const nav=T.filter(t=>sciArr(t.sources).includes(k)&&!mapIds.includes(t.id));
  const claims=[];
  SCI.targets.forEach(r=>r.facts.forEach(f=>{if(sciArr(f.sources).includes(k))claims.push({t:r.name,f})}));
  return{targets,images,nav,claims};
}
function srcDetail(k){
  const s=SCI.srcs[k],u=srcUses(k);
  const row=(a,b)=>`<div class="lab-row"><b>${a}:</b> ${b}</div>`;
  const d=(t,open,body)=>`<details class="sci-d"${open?" open":""}><summary>${t}</summary>${body}</details>`;
  const warn=s.verified?"":`<p><span class="b warn">⚠ UNCHECKED</span> ARES has not opened this source. Do not treat any ARES claim as supported by it until it is checked.</p>`;
  return`<div class="sci"><button class="sci-btn" onclick="srcBack()">← All sources</button>
  <h2 style="margin:6px 0">${esc(s.title||k)}</h2>
  <p><span class="sci-tag">${esc(srcType(s.type))}</span> ${s.verified?'<span class="b green">✔ checked '+esc(s.checkedOn||"")+'</span>':WARN}</p>${warn}
  ${row("Publisher",esc(s.publisher||"unknown"))}
  ${row("Published",s.published?esc(s.published):"date unavailable")}
  ${row("Link",s.url?sciLink(s.url,"Open the original source"):'<span class="m">No verified link on record.</span>')}
  ${row("Source ID",esc(k))}
  ${d("What this source supports",true,`<p>${esc(s.supports||"—")}</p>`)}
  ${d("Limitations",true,`<p>${esc(s.limits||"—")}</p>`)}
  ${d("Used by ("+(u.targets.length+u.images.length+u.nav.length)+")",true,
    (u.targets.length?`<div class="lab-row"><b>Science targets</b><br>${u.targets.map(r=>`<button class="sci-btn" onclick="labGoTarget('${r.id}')">${esc(r.name)}</button>`).join("")}</div>`:"")+
    (u.images.length?`<div class="lab-row"><b>Images</b><br>${u.images.map(i=>`<button class="sci-btn" onclick="labOpen('${i.id}')">${esc(i.catalogId||i.title)}</button>`).join("")}</div>`:"")+
    (u.nav.length?`<div class="lab-row"><b>Navigation targets</b><br>${u.nav.map(t=>esc(t.name)).join(", ")}<br><span class="m">Listed in the basic target data, outside the Phase 3 science records.</span></div>`:"")+
    (u.targets.length+u.images.length+u.nav.length?"":'<p class="m">Nothing in ARES uses this source yet.</p>'))}
  ${d("ARES claims that cite it ("+u.claims.length+")",false,u.claims.length?`<ul>${u.claims.map(c=>`<li><span class="m">${esc(c.t)}</span><br>${esc(c.f.text)} <span class="sci-tag">${c.f.kind==="observation"?"Observation":"Published interpretation"}</span></li>`).join("")}</ul>`:'<p class="m">No individual claims cite this source.</p>')}
  </div>`;
                                                                                           }
