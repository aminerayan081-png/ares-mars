"use strict";
/* Panels: tabs, side panel, detail panel, footer status. */
const BD={green:"🟢 REAL",yellow:"🟡 CALC",blue:"🔵 SIM"};
const bd=c=>`<span class="b ${c}">${BD[c]}</span>`;
const WARN='<span class="b warn">⚠ UNCHECKED</span>';
const src=ids=>(ids||[]).filter(k=>SRC[k]).map(k=>{
  const s=SRC[k];
  return s.url?`<a href="${s.url}" target="_blank" rel="noopener">${esc(s.title)}</a>`:`${esc(s.title)} <span class="m">(link to add)</span>`;
}).join("<br>");

const NAVSHORT={nav:["🧭","Navigate"],sci:["🔬","Science"],ter:["⛰️","Terrain"],env:["☢️","Environment"],rte:["🥾","EVA"],log:["📝","Log"]};
const isMobile=()=>typeof window!=="undefined"&&!!window.matchMedia&&window.matchMedia("(max-width:800px)").matches;

function render(){renderNav();renderSide();renderDetail();drawMap();renderStatus();applySheet()}
/* Phone: the panel is a sheet under the map (closed / half / full). Desktop ignores it. */
function applySheet(){
  document.body.dataset.sheet=S.sheet;
  const tab=TABS.find(t=>t[0]===S.tab),g=$("#gt");
  if(g)g.textContent=tab?tab[1].replace(/^\d /,""):"";
  if(typeof map!=="undefined"&&map)setTimeout(()=>map.invalidateSize(),60);
}
function toggleSheet(){S.sheet=S.sheet==="full"?"half":"full";save();applySheet()}
function closeSheet(){S.sheet="closed";save();applySheet();renderNav()}
function setTab(t){
  if(isMobile()&&S.tab===t&&S.sheet!=="closed")S.sheet="closed";          // tap the open tab again to close it
  else{S.tab=t;if(isMobile()&&S.sheet==="closed")S.sheet="half"}
  save();render();
}
function pick(id,fly){S.sel=id;save();render();const p=P(id);if(fly&&p)map.setView(p,Math.max(map.getZoom(),7))}
/* Tapping a marker on the map: show that target's details. */
function selectOnMap(id){
  S.sel=id;
  if(isMobile()&&S.sheet==="closed")S.sheet="half";
  save();render();
  const d=$("#detail");if(isMobile()&&d&&d.scrollIntoView)d.scrollIntoView({block:"start"});
}
function renderNav(){
  const open=!isMobile()||S.sheet!=="closed";
  $("#nav").innerHTML=TABS.map(t=>{const s=NAVSHORT[t[0]];
    return`<button class="${S.tab===t[0]&&open?"on":""}" onclick="setTab('${t[0]}')"><span class="ic">${s[0]}</span><span class="full">${t[1]}</span><span class="short">${s[1]}</span></button>`}).join("");
}
if(typeof window!=="undefined"&&window.addEventListener)window.addEventListener("resize",()=>{if(typeof map!=="undefined"&&map)map.invalidateSize();renderNav()});

function renderSide(){
  const f={nav:panelNav,sci:panelSci,ter:panelTer,env:panelEnv,rte:panelRte,log:panelLog}[S.tab]||panelNav;
  $("#sc").innerHTML=f();
}

function panelNav(){
  return`<h3>Surface Navigation</h3>
  <p class="m">Use the layer button (top right of the map) to switch maps. The orange grid is a 1° graticule ${bd("yellow")} drawn by ARES. Move over or tap the map to read coordinates (east-positive longitude).</p>
  <p class="m">${bd("blue")} Mission framing: Curiosity explored the boxwork in 2025–26, and NASA said it would leave the region in March 2026. ARES simulates a hypothetical astronaut EVA there. No real astronaut mission is implied.<br>${src(["jpl-boxwork"])}</p>
  <h3>Landmarks &amp; destinations</h3>
  ${T.map(t=>`<div class="item ${S.sel===t.id?"sel":""}" onclick="pick('${t.id}',1)"><b>${esc(t.name)}</b> ${bd(t.cls)}<br><span class="m">${fc(P(t.id))}</span></div>`).join("")}
  <h3>Map layers</h3>
  <p class="m">${LAYERS.map(l=>`<a href="${l.url}" target="_blank" rel="noopener">${esc(l.credit)}</a>`).join("<br>")}</p>`;
}

function panelSci(){
  return`<h3>Science Targets</h3>
  ${T.filter(t=>t.type==="science").map(t=>`<div class="item ${S.sel===t.id?"sel":""}" onclick="pick('${t.id}')">${S.vis.includes(t.id)?"✅":"⬜"} <b>${esc(t.name)}</b><br><span class="m">${P(t.id)?fc(P(t.id)):"📍 needs placing"}${S.route.includes(t.id)?" · in route":""}</span></div>`).join("")}
  <p class="m">No published coordinates exist in our sources for these targets, so the astronaut pins each one on the map. A pinned position is ${bd("yellow")} user-placed, not a NASA coordinate.</p>`;
}

function legTbl(){
  const L_=legs();if(!L_.length)return"";
  const nm=id=>esc(T_[id].name.split(" ")[0]);
  return`<table><tr><th>Leg</th><th>km</th><th>Δh</th><th>Mean gradient</th></tr>${L_.map(l=>{
    if(l.miss)return`<tr><td>${nm(l.a)}→${nm(l.b)}</td><td colspan="3" class="m">place both points</td></tr>`;
    const d=gradeLabel(l.sl);
    return`<tr><td>${nm(l.a)}→${nm(l.b)}</td><td>${(l.d/1000).toFixed(2)}</td><td>${l.dz!=null?l.dz.toFixed(0)+" m":"–"}</td><td class="${d[1]}">${l.sl!=null?l.sl.toFixed(1)+"° ":""}${d[0]}</td></tr>`}).join("")}</table>`;
}

function panelTer(){
  const t=T_[S.sel],e=E(S.sel),user=S.elev[S.sel]!=null;
  return`<h3>Terrain Intelligence</h3>
  <p><b>${esc(t.name)}</b></p>
  <p>Elevation: ${e!=null?e.toFixed(0)+" m "+(user?bd("blue")+" user-entered":bd("green")):"not set"}</p>
  <p class="m">Type an elevation you read from a cited source (for example Mars Trek). ARES does not read heights from the map yet.</p>
  <input id="ei" type="number" placeholder="metres" value="${S.elev[S.sel]!=null?S.elev[S.sel]:""}"> <button onclick="setElev()">Set</button>
  <h3>Route legs</h3>${legTbl()||'<p class="m">Add stops in the EVA Planner.</p>'}
  <h3>Limits &amp; cautions</h3><p>${esc(t.limits||"—")}</p>
  <p class="m">A leg's gradient is the height difference between its two end points divided by the straight-line distance, so it hides steep local features. Straight lines are not planned paths. The 10° and 20° bands are our own ${bd("blue")} assumptions, not NASA limits, and a low gradient does not mean a route is safe. Real elevation data (a Terrain Pack) comes in a later phase.</p>`;
}

function panelEnv(){
  const r=ENV.radiation;
  return`<h3>Environmental Conditions</h3>
  <div class="item static">${r.verified?bd("green"):WARN} <b>${esc(r.label)}</b><br>
   ${r.value} ± ${r.uncertainty} ${esc(r.unit)}; daily range ${esc(r.range_text)}.<br>
   <span class="m">${esc(r.measuredInside)}<br>${esc(r.verifyNote)}</span><br>${src(r.sources)}</div>
  <div class="item static">${bd("yellow")} <b>EVA dose estimate</b><br>Dose = rate × EVA hours ÷ ${SOLH} h (we treat "per day" as one sol; not verified). The Route planner computes it. It ignores solar events, terrain shielding and suit shielding, and it inherits the unchecked input above.</div>
  <div class="item static">${bd("blue")} <b>Not available yet</b><br>${esc(ENV.pending)}</div>`;
}

function panelRte(){
  const t=routeTotals();
  return`<h3>EVA Route Planner</h3>
  <p class="m">Start: Bradbury Landing. Add stops from the target details panel.</p>
  <ol>${S.route.map((id,i)=>`<li>${esc(T_[id].name)} <button onclick="moveStop(${i},-1)">↑</button><button onclick="moveStop(${i},1)">↓</button><button onclick="removeStop(${i})">✕</button></li>`).join("")||"<li class='m'>empty</li>"}</ol>
  ${legTbl()}
  <h3>Totals</h3>
  <p>${bd("yellow")} Straight-line distance: <b>${t.km.toFixed(2)} km</b><br><span class="m">Method: haversine on a sphere, R = ${MARS_R_KM} km. Not a traversable path.</span></p>
  <p>${bd("blue")} Assumptions — walking speed <input type="number" step=".1" value="${S.speed}" onchange="setSpeed(this.value)"> km/h, <input type="number" value="${S.stop}" onchange="setStop(this.value)"> min per science stop</p>
  <p>${bd("blue")} Est. EVA time: <b>${t.totH.toFixed(1)} h</b> (walk ${t.walkH.toFixed(1)} + stops ${t.stopH.toFixed(1)})<br>${bd("yellow")} Est. radiation dose: <b>${t.doseUGy.toFixed(1)} µGy</b> (historical average rate; see Environment tab)</p>
  <button onclick="clearRoute()">Clear route</button>`;
}

function panelLog(){
  return`<h3>Astronaut Field Log</h3>
  <p class="m">Notes are about: <b>${esc(T_[S.sel].name)}</b></p>
  <textarea id="ln" rows="3" placeholder="Observation…"></textarea><br>
  <button class="pri" onclick="addLog()">Save note</button> <button onclick="addSample()">Log hypothetical sample here</button>
  <h3>Objectives</h3>${objs().map(o=>`<div>${o[1]?"✅":"⬜"} ${o[0]}</div>`).join("")}
  <h3>Entries ${bd("blue")}</h3>
  ${S.log.slice().reverse().map(l=>`<div class="item static"><span class="m">${esc(l.t)} · ${esc(l.n)}</span><br>${esc(l.x)}</div>`).join("")||"<span class='m'>none yet</span>"}
  <button onclick="exportLog()">Export log (.txt)</button>`;
}

function renderDetail(){
  const t=T_[S.sel],p=P(t.id);
  $("#detail").innerHTML=`<h3>Selected target</h3><h2 style="margin:0">${esc(t.name)}</h2>
  <p>${bd(t.cls)} ${t.type==="science"?"information from NASA / published sources":""}</p>
  <p><b>Position:</b> ${fc(p)} ${p?(S.pos[t.id]?bd("yellow")+" user-placed":bd("green")+(t.coordStatus==="approximate"?" approximate":"")):""}<br>
  <b>Elevation:</b> ${E(t.id)!=null?E(t.id).toFixed(0)+" m":"not set"}</p>
  <p>${esc(t.summary||"")}</p>
  <h3>Why it matters</h3><p>${esc(t.why||"—")}</p>
  <h3>Limits &amp; cautions</h3><p>${esc(t.limits||"—")}</p>
  <h3>Sources</h3><p>${src(t.sources)}</p>
  ${t.type==="science"?`<button class="pri" onclick="placeTarget()">📍 ${p?"Re-place":"Place"} on map</button> `:""}
  ${p&&t.type==="science"?`<button onclick="addToRoute()">➕ Add to EVA route</button> <button onclick="toggleVisited()">${S.vis.includes(t.id)?"↩ Unmark":"✔ Mark visited"}</button>`:""}
  <p class="m">Drag a science marker to adjust it. Pinned positions are ${bd("yellow")} user-placed, not NASA coordinates; check them against NASA imagery.</p>`;
}

function renderStatus(){
  const o=objs(),n=o.filter(x=>x[1]).length,sci=T.filter(t=>t.type==="science");
  $("#st").innerHTML=`<span>MISSION: SIMULATED ${bd("blue")}</span><span>Targets visited ${S.vis.length}/${sci.length}</span><span>Route stops ${S.route.length}</span><span>Samples ${S.smp.length}</span><span>Objectives ${n}/${o.length}</span><div class="bar"><i style="width:${n/o.length*100}%"></i></div>`;
}
