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
    const f={nav:panelNav,sci:(typeof panelScience==="function"?panelScience:panelSci),ter:panelTer,env:panelEnv,rte:panelRte,log:panelLog}[S.tab]||panelNav;
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
  <p class="m">No published coordinates exist in our sources for these targets, so the astronaut pins each one on the map. A pinned position is ${bd("blue")} user-placed, not a NASA coordinate.</p>`;
}

function legTbl(){
  const L_=legs();if(!L_.length)return"";
  const nm=id=>esc(isWp(id)?stopName(id):stopName(id).split(" ")[0]);
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

function objBlock(){
  const opts=T.filter(t=>t.type==="science"&&P(t.id));
  let h="<h3>Objective</h3>";
  if(!opts.length)return h+'<p class="m">No science target is placed on the map yet. Open the Science tab, tap a target, press "Place on map", then come back and choose it here.</p>';
  h+=`<p class="m">${bd("blue")} The objective is the science target this plan is meant to reach. Only targets you placed on the map can be chosen.</p>
  <select onchange="setObjective(this.value)"><option value="">none</option>${opts.map(t=>`<option value="${t.id}"${S.obj===t.id?" selected":""}>${esc(t.name)}</option>`).join("")}</select>`;
  if(S.obj){
    const i=S.route.indexOf(S.obj);
    if(i>=0){
      h+=`<p>✔ The objective is stop ${i+1} of this route.</p>`;
    }else{
      const last=S.route.length?S.route[S.route.length-1]:"home",pl=P(last),po=P(S.obj);
      const km=(pl&&po)?hav(pl,po)/1000:null;
      h+=`<p>⚠ The objective is not a stop in this route yet.</p>`;
      if(km!=null)h+=`<p>${bd("yellow")} Straight-line distance from the last stop (${esc(stopName(last))}) to the objective: <b>${km.toFixed(2)} km</b><br><span class="m">Not a traversable path.</span></p>`;
      h+=`<button onclick="addObjToRoute()">➕ Add objective as last stop</button>`;
    }
    h+='<p class="m">Having the objective as a stop only means the route includes it. It says nothing about whether the route is safe or traversable.</p>';
  }
  return h;
}

function planBlock(){
  const warn=(ENV&&ENV.radiation&&!ENV.radiation.verified)?" "+WARN:"";
  const cur=Object.assign(routeTotals(),{stops:S.route.length,miss:legs().filter(l=>l.miss).length});
  const oc=(o,r)=>!o?"–":(r.includes(o)?"yes":"no");
  const row=(n,t,o,r)=>`<tr><td>${n}</td><td>${t.stops}</td><td>${t.km.toFixed(2)}${t.miss?"*":""}</td><td>${t.totH.toFixed(1)}</td><td>${t.doseUGy.toFixed(1)}</td><td>${oc(o,r)}</td></tr>`;
  return`<h3>Saved plans</h3>
  <p class="m">Save the current route as a plan, build another, then compare. Loading a plan replaces the current route.</p>
  <input id="pn" placeholder="Plan name" maxlength="40"> <button class="pri" onclick="savePlan()">Save current as new plan</button>
  ${S.plans.map(p=>`<div class="item static"><b>${esc(p.name)}</b>${p.obj?` <span class="m">· objective: ${esc(stopName(p.obj))}</span>`:""} ${S.activePlan===p.id?'<span class="m">(last loaded or saved)</span>':""}<br><button onclick="loadPlan('${p.id}')">Load</button> <button onclick="updatePlan('${p.id}')">Overwrite with current</button> <button onclick="deletePlan('${p.id}')">Delete</button></div>`).join("")||'<p class="m">No saved plans yet.</p>'}
  ${S.plans.length?`<h3>Compare plans</h3>
  <table><tr><th>Plan</th><th>Stops</th><th>km</th><th>EVA h</th><th>µGy</th><th>Objective reached</th></tr>${row("<i>Current</i>",cur,S.obj,S.route)}${S.plans.map(p=>row(esc(p.name),planTotals(p),p.obj,p.route)).join("")}</table>
  <p class="m">${bd("yellow")} km is straight-line distance, not a path. ${bd("blue")} EVA hours use each plan's own speed and stop times. ${bd("yellow")}${warn} µGy uses the historical average rate. * means a stop is not placed yet, so its legs are left out. "Objective reached" means the objective is a stop in that plan ("–" means no objective chosen). This is a planning comparison, not a safety assessment.</p>`:""}`;
}

function setStopElev(i,v){
  const id=S.route[i],n=parseFloat(v);
  if(id==null)return;
  if(Number.isFinite(n))S.elev[id]=n;else delete S.elev[id];
  save();render();
}

function profileBlock(){
  const q=seq(),L_=legs();
  const note='<p class="m">Terrain limits: the line joins stops with straight segments, so it does not show the real ground between them (rocks, ridges, sand). The height scale is stretched to fit the values, so slopes look steeper than they are. ARES has no elevation dataset yet (a later phase), and this profile does not show whether a route is safe or traversable.</p>';
  let h=`<h3>Elevation profile</h3><p class="m">${bd("blue")} Elevations are values you type from a cited source (for example Mars Trek). ARES does not read heights from the map. Bradbury Landing's elevation is ${bd("green")} published.</p>`;
  h+=`<table><tr><th>Stop</th><th>Elevation</th></tr>`+q.map((id,i)=>{
    const e=E(id);
    const inp=i>0?` <input type="number" style="width:5.5em" placeholder="m" value="${S.elev[id]!=null?S.elev[id]:""}" onchange="setStopElev(${i-1},this.value)">`:"";
    return`<tr><td>${esc(stopName(id))}</td><td>${e!=null?e.toFixed(0)+" m":'<span class="m">no elevation data</span>'}${inp}</td></tr>`;
  }).join("")+`</table>`;
  if(L_.some(l=>l.miss))return h+'<p class="m">Profile not drawn: at least one stop is not placed on the map yet.</p>'+note;
  let x=0;
  const pts=q.map((id,i)=>{if(i>0)x+=L_[i-1].d/1000;return{x,e:E(id)}});
  const withE=pts.filter(p=>p.e!=null);
  if(withE.length<2)return h+'<p class="m">Profile not drawn: it needs an elevation for at least two stops.</p>'+note;
  const W=320,H=150,pl=48,pr=10,pt=10,pb=24;
  const xmax=Math.max(x,0.001);
  const es=withE.map(p=>p.e),emin=Math.min(...es),emax=Math.max(...es),span=Math.max(emax-emin,1);
  const X=v=>pl+(v/xmax)*(W-pl-pr),Y=v=>pt+(1-(v-emin)/span)*(H-pt-pb);
  let svg=`<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Elevation profile">`;
  svg+=`<line x1="${pl}" y1="${pt}" x2="${pl}" y2="${H-pb}" stroke="#888"/><line x1="${pl}" y1="${H-pb}" x2="${W-pr}" y2="${H-pb}" stroke="#888"/>`;
  svg+=`<text x="${pl-4}" y="${pt+4}" fill="#ccc" font-size="10" text-anchor="end">${emax.toFixed(0)} m</text>`;
  svg+=`<text x="${pl-4}" y="${H-pb}" fill="#ccc" font-size="10" text-anchor="end">${emin.toFixed(0)} m</text>`;
  svg+=`<text x="${pl}" y="${H-6}" fill="#ccc" font-size="10">0 km</text>`;
  svg+=`<text x="${W-pr}" y="${H-6}" fill="#ccc" font-size="10" text-anchor="end">${xmax.toFixed(1)} km</text>`;
  for(let i=1;i<pts.length;i++){
    const a=pts[i-1],b=pts[i];
    if(a.e!=null&&b.e!=null)svg+=`<line x1="${X(a.x)}" y1="${Y(a.e)}" x2="${X(b.x)}" y2="${Y(b.e)}" stroke="#ff9d1c" stroke-width="2"/>`;
  }
  pts.forEach(p=>{if(p.e!=null)svg+=`<circle cx="${X(p.x)}" cy="${Y(p.e)}" r="4" fill="#4fc3f7"/>`});
  svg+="</svg>";
  return h+svg+'<p class="m">Horizontal axis: straight-line distance along the stops (🟡 calculated). A gap in the line means a stop has no elevation.</p>'+note;
}

function panelRte(){
  const t=routeTotals();
  const warn=(ENV&&ENV.radiation&&!ENV.radiation.verified)?" "+WARN:"";
  return`<h3>EVA Route Planner</h3>
  <p class="m">Start: Bradbury Landing. Add science stops from the target details panel, or add a free waypoint anywhere on the map. A free waypoint is ${bd("blue")} user-placed, and you can drag its blue marker to move it.</p>
  <button class="pri" onclick="placeWaypoint()">➕ Add waypoint on map</button>
  <ol>${S.route.map((id,i)=>`<li>${isWp(id)?`<input value="${esc(stopName(id))}" maxlength="60" onchange="renameStop(${i},this.value)">`:esc(stopName(id))} <span class="m">${fc(P(id))}</span><br><span class="m">Time at stop:</span> <input type="number" min="0" style="width:4.5em" value="${stopMin(id)}" onchange="setDur(${i},this.value)"> <span class="m">min</span> <button onclick="moveStop(${i},-1)">↑</button><button onclick="moveStop(${i},1)">↓</button><button onclick="removeStop(${i})">✕</button></li>`).join("")||"<li class='m'>empty</li>"}</ol>
  ${legTbl()}
  ${objBlock()}
  <h3>Totals</h3>
  <p>${bd("yellow")} Straight-line distance: <b>${t.km.toFixed(2)} km</b><br><span class="m">Method: haversine on a sphere, R = ${MARS_R_KM} km. Not a traversable path.</span></p>
  <p>${bd("blue")} Assumptions: walking speed <input type="number" step=".1" value="${S.speed}" onchange="setSpeed(this.value)"> km/h, default <input type="number" value="${S.stop}" onchange="setStop(this.value)"> min per science stop (free waypoints default to 0)</p>
  <p>${bd("blue")} Est. EVA time: <b>${t.totH.toFixed(1)} h</b> (walk ${t.walkH.toFixed(1)} + stops ${t.stopH.toFixed(1)})<br>${bd("yellow")}${warn} Est. radiation dose: <b>${t.doseUGy.toFixed(1)} µGy</b><br><span class="m">Uses the historical average rate from the Environment tab. It ignores solar events and shielding.</span></p>
  <p class="m">Routes here are not assessed for safety or traversability.</p>
  <button onclick="clearRoute()">Clear route</button>
  ${planBlock()}`;
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
  <p><b>Position:</b> ${fc(p)} ${p?(S.pos[t.id]?bd("blue")+" user-placed":bd("green")+(t.coordStatus==="approximate"?" approximate":"")):""}<br>
  <b>Elevation:</b> ${E(t.id)!=null?E(t.id).toFixed(0)+" m":"not set"}</p>
  <p>${esc(t.summary||"")}</p>
  <h3>Why it matters</h3><p>${esc(t.why||"—")}</p>
  <h3>Limits &amp; cautions</h3><p>${esc(t.limits||"—")}</p>
  <h3>Sources</h3><p>${src(t.sources)}</p>
  ${t.type==="science"?`<button class="pri" onclick="placeTarget()">📍 ${p?"Re-place":"Place"} on map</button> `:""}
  ${p&&t.type==="science"?`<button onclick="addToRoute()">➕ Add to EVA route</button> <button onclick="toggleVisited()">${S.vis.includes(t.id)?"↩ Unmark":"✔ Mark visited"}</button>`:""}
  <p class="m">Drag a science marker to adjust it. Pinned positions are ${bd("blue")} user-placed, not NASA coordinates; check them against NASA imagery.</p>`;
}

function renderStatus(){
  const o=objs(),n=o.filter(x=>x[1]).length,sci=T.filter(t=>t.type==="science");
  $("#st").innerHTML=`<span>MISSION: SIMULATED ${bd("blue")}</span><span>Targets visited ${S.vis.length}/${sci.length}</span><span>Route stops ${S.route.length}</span><span>Samples ${S.smp.length}</span><span>Objectives ${n}/${o.length}</span><div class="bar"><i style="width:${n/o.length*100}%"></i></div>`;
}
