"use strict";
/* ARES Phase 6: Mission dashboard and EVA simulation. Everything here is SIMULATION.
   Reuses (read-only): S, seq(), legs(), routeTotals(), P(), stopName(), stopMin(), objs(), bd(), WARN, ENV, notify().
   Edits no other file and changes no saved data. Adds one map button: "🚀 Mission".
   The astronaut marker moves in straight lines between the stops of the current EVA route. */
const MSIM={box:null,mk:null,tl:null,t:0,run:false,mult:300,timer:null,last:0,seg:-1,alerts:[],reached:0,done:false,added:false};
const MSIM_SPEEDS=[60,300,1200];
const msq=id=>document.getElementById(id);
const msEsc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const msBd=c=>typeof bd==="function"?bd(c):(c==="yellow"?"🟡 CALC":"🔵 SIM");
const msClock=h=>{const s=Math.round(h*3600),p=n=>String(n).padStart(2,"0");return Math.floor(s/3600)+":"+p(Math.floor(s%3600/60))+":"+p(s%60)};

function msMissing(){
  const m=[];
  if(typeof S==="undefined")m.push("S");
  if(typeof seq!=="function")m.push("seq");
  if(typeof legs!=="function")m.push("legs");
  if(typeof routeTotals!=="function")m.push("routeTotals");
  if(typeof P!=="function")m.push("P");
  if(typeof stopName!=="function")m.push("stopName");
  if(typeof stopMin!=="function")m.push("stopMin");
  if(typeof objs!=="function")m.push("objs");
  if(typeof map==="undefined"||!map)m.push("map");
  return m;
}

/* Timeline: for each leg a "walk" segment, then a "stop" segment (may last 0 min). */
function msBuild(){
  const q=seq(),L_=legs();
  if(q.length<2)return{err:"Add at least one stop in the EVA tab first."};
  if(L_.some(l=>l.miss))return{err:"At least one stop is not placed on the map yet. Place it, then press Reset."};
  const sp=Number(S.speed);
  if(!(sp>0))return{err:"Walking speed must be above 0 (EVA tab)."};
  const segs=[];
  for(let i=1;i<q.length;i++){
    const l=L_[i-1],a=P(q[i-1]),b=P(q[i]);
    if(!a||!b)return{err:"A stop has no position. Check the EVA tab."};
    const m=Number(stopMin(q[i]))||0;
    segs.push({type:"walk",h:l.d/1000/sp,a:a,b:b,km:l.d/1000,name:stopName(q[i]),id:q[i],sl:l.sl});
    segs.push({type:"stop",h:Math.max(0,m)/60,a:b,b:b,km:0,name:stopName(q[i]),id:q[i]});
  }
  const total=segs.reduce((s,x)=>s+x.h,0);
  if(!(total>0))return{err:"The route has zero length and no stop time."};
  return{segs:segs,total:total,q:q,km:segs.reduce((s,x)=>s+x.km,0)};
}

/* Where is the astronaut at simulated time t (hours)? */
function msPos(tl,t){
  let acc=0,km=0;
  for(let i=0;i<tl.segs.length;i++){
    const s=tl.segs[i],last=i===tl.segs.length-1;
    if(t<acc+s.h||last){
      const f=s.type==="walk"&&s.h>0?Math.min(1,Math.max(0,(t-acc)/s.h)):1;
      return{i:i,ll:[s.a[0]+(s.b[0]-s.a[0])*f,s.a[1]+(s.b[1]-s.a[1])*f],km:km+s.km*f};
    }
    acc+=s.h;km+=s.km;
  }
}

function msAlert(text,cls){
  MSIM.alerts.push({c:msClock(MSIM.t),x:text,cls:cls||"info"});
  msAlerts();
}
function msAlerts(){
  const el=msq("ms-al");if(!el)return;
  el.innerHTML=MSIM.alerts.length?MSIM.alerts.slice().reverse().slice(0,30).map(a=>`<div class="ms-a ${a.cls}"><span class="ms-m">${a.c}</span> ${a.cls==="warn"?"⚠ ":""}${msEsc(a.x)}</div>`).join(""):'<div class="ms-m">No alerts yet.</div>';
}
function msEnter(s){
  if(s.type==="walk"){
    if(s.sl!=null&&s.sl>=20)msAlert(`Leg to ${s.name}: mean gradient ${s.sl.toFixed(1)}° is above our 20° band (our own assumption, not a NASA limit).`,"warn");
    else if(s.sl!=null&&s.sl>=10)msAlert(`Leg to ${s.name}: mean gradient ${s.sl.toFixed(1)}° is above our 10° band (our own assumption, not a NASA limit).`,"warn");
    else msAlert(`Leaving for ${s.name}.`,"info");
  }else{
    MSIM.reached++;
    msAlert(`Arrived at ${s.name}.`,"info");
    if(typeof S!=="undefined"&&S.obj&&s.id===S.obj)msAlert(`Objective stop reached: ${s.name}.`,"info");
  }
}

function msMarker(ll){
  if(!ll)return;
  if(!MSIM.mk){
    MSIM.mk=L.marker(ll,{icon:L.divIcon({className:"",html:'<div style="font-size:26px;line-height:30px;text-align:center">🧑‍🚀</div>',iconSize:[30,30],iconAnchor:[15,15]}),interactive:false,keyboard:false,zIndexOffset:1000}).addTo(map);
  }else MSIM.mk.setLatLng(ll);
}

function msStat(){
  const el=msq("ms-stat"),tl=MSIM.tl;if(!el)return;
  if(!tl){el.innerHTML="";msq("ms-fill").style.width="0%";return}
  const p=msPos(tl,MSIM.t),s=tl.segs[p.i],pct=Math.min(100,MSIM.t/tl.total*100);
  const warn=(typeof ENV!=="undefined"&&ENV.radiation&&!ENV.radiation.verified&&typeof WARN!=="undefined")?" "+WARN:"";
  const nStops=tl.q.length-1,dose=(tl.dose||0)*MSIM.t/tl.total;
  const ph=MSIM.done?"Finished":(s.type==="walk"?"Traverse to ":"Work at ")+msEsc(s.name);
  msq("ms-fill").style.width=pct.toFixed(1)+"%";
  el.innerHTML=`<table class="ms-t">
   <tr><td>EVA clock ${msBd("blue")}</td><td><b>${msClock(MSIM.t)}</b> of ${msClock(tl.total)} (${pct.toFixed(0)}%)</td></tr>
   <tr><td>Phase</td><td>${ph}</td></tr>
   <tr><td>Distance ${msBd("yellow")}</td><td>${p.km.toFixed(2)} of ${tl.km.toFixed(2)} km (straight lines)</td></tr>
   <tr><td>Stops reached</td><td>${MSIM.reached} of ${nStops}</td></tr>
   <tr><td>Dose so far ${msBd("yellow")}${warn}</td><td>${dose.toFixed(1)} µGy (historical average rate)</td></tr></table>
   <div class="ms-m" style="margin-top:6px"><b>Objectives (read from the Log tab)</b></div>
   ${objs().map(o=>`<div>${o[1]?"✅":"⬜"} ${o[0]}</div>`).join("")}`;
}

function msBriefHtml(err){
  const el=msq("ms-brief");if(!el)return;
  if(err){el.innerHTML=`<p>⚠ ${msEsc(err)}</p>`;return}
  const t=routeTotals(),warn=(typeof ENV!=="undefined"&&ENV.radiation&&!ENV.radiation.verified&&typeof WARN!=="undefined")?" "+WARN:"";
  let o="";
  if(S.obj){const inR=S.route.includes(S.obj);o=`<br>Objective: <b>${msEsc(stopName(S.obj))}</b> ${inR?"(a stop in this route)":"⚠ not a stop in this route"}`}
  el.innerHTML=`<p><b>Briefing</b><br>Stops: ${S.route.length} · ${msBd("yellow")} straight-line ${t.km.toFixed(2)} km<br>${msBd("blue")} est. EVA time ${t.totH.toFixed(1)} h at ${S.speed} km/h<br>${msBd("yellow")}${warn} est. dose ${t.doseUGy.toFixed(1)} µGy${o}</p>`;
}

function msUpdate(){
  const tl=MSIM.tl;if(!tl)return;
  const p=msPos(tl,MSIM.t);
  for(let i=MSIM.seg+1;i<=p.i;i++)msEnter(tl.segs[i]);
  MSIM.seg=p.i;
  msMarker(p.ll);
  const ll=L.latLng(p.ll);
  if(!map.getBounds().pad(-0.15).contains(ll))map.panTo(ll,{animate:false});
  msStat();
}

function msPause(){
  if(MSIM.timer){clearInterval(MSIM.timer);MSIM.timer=null}
  MSIM.run=false;
  const b=msq("ms-play");if(b)b.textContent=MSIM.done?"🔁 Replay":"▶ "+(MSIM.t>0?"Resume":"Start");
}
function msTick(){
  if(!MSIM.tl)return;
  const now=performance.now(),dt=Math.min((now-MSIM.last)/1000,1);
  MSIM.last=now;
  MSIM.t=Math.min(MSIM.tl.total,MSIM.t+dt*MSIM.mult/3600);
  msUpdate();
  if(MSIM.t>=MSIM.tl.total)msFinish();
}
function msFinish(){
  MSIM.done=true;msPause();msStat();
  const tl=MSIM.tl,warn=(typeof ENV!=="undefined"&&ENV.radiation&&!ENV.radiation.verified&&typeof WARN!=="undefined")?" "+WARN:"";
  const nw=MSIM.alerts.filter(a=>a.cls==="warn").length;
  let o="";
  if(S.obj)o=`<br>Objective <b>${msEsc(stopName(S.obj))}</b>: ${S.route.includes(S.obj)?"reached (it is a stop in the route)":"not reached (not a stop in the route)"}`;
  msq("ms-deb").innerHTML=`<h4>Debrief ${msBd("blue")}</h4><p>Stops reached: ${MSIM.reached} of ${tl.q.length-1}<br>${msBd("yellow")} Distance: ${tl.km.toFixed(2)} km (straight lines)<br>${msBd("blue")} EVA time: ${msClock(tl.total)}<br>${msBd("yellow")}${warn} Dose estimate: ${(tl.dose||0).toFixed(1)} µGy${o}<br>Gradient alerts: ${nw}</p><p class="ms-m">A simulation result for a hypothetical astronaut. It does not show that the route is safe or traversable.</p>`;
}
function msReset(){
  msPause();
  const b=msBuild();
  MSIM.done=false;MSIM.t=0;MSIM.seg=-1;MSIM.alerts=[];MSIM.reached=0;
  msq("ms-deb").innerHTML="";
  if(b.err){MSIM.tl=null;msBriefHtml(b.err);msStat();msAlerts();return false}
  b.dose=routeTotals().doseUGy;
  MSIM.tl=b;
  msBriefHtml();msMarker(P(b.q[0]));msStat();msAlerts();
  msPause();
  return true;
}
function msPlay(){
  if(MSIM.run){msPause();return}
  if(!MSIM.tl||MSIM.done){if(!msReset())return}
  MSIM.run=true;MSIM.last=performance.now();
  MSIM.timer=setInterval(msTick,100);
  msq("ms-play").textContent="⏸ Pause";
}
function msSpeed(){
  MSIM.mult=MSIM_SPEEDS[(MSIM_SPEEDS.indexOf(MSIM.mult)+1)%MSIM_SPEEDS.length];
  msq("ms-speed").textContent="Speed ×"+MSIM.mult;
}
function msClose(){msPause();if(MSIM.box)MSIM.box.style.display="none"}

function msShell(){
  if(MSIM.box)return;
  const st=document.createElement("style");
  st.textContent="#msim{position:fixed;left:0;right:0;bottom:0;z-index:4000;max-height:48vh;overflow:auto;background:#10121a;color:#e8e8ee;border-top:2px solid #ff9d1c;font:14px/1.4 system-ui,sans-serif;padding:8px 12px calc(10px + env(safe-area-inset-bottom));box-sizing:border-box;display:none}"
   +"#msim button{font:inherit;min-height:44px;padding:0 12px;border-radius:8px;border:1px solid #ff9d1c;background:#2a2316;color:#ffd9a0;margin:2px 4px 2px 0}"
   +"#msim .ms-h{display:flex;justify-content:space-between;align-items:center}#msim h4{margin:10px 0 4px;color:#ff9d1c}#msim p{margin:6px 0}"
   +"#msim .ms-m{color:#9aa0b4;font-size:12px}#msim .ms-bar{height:8px;background:#2c3042;border-radius:4px;margin:6px 0}#msim .ms-bar i{display:block;height:100%;background:#ff9d1c;border-radius:4px}"
   +"#msim .ms-t{width:100%;border-collapse:collapse}#msim .ms-t td{border-top:1px solid #2c3042;padding:4px 6px 4px 0;vertical-align:top}#msim .ms-t td:first-child{width:38%;color:#9aa0b4}"
   +"#msim .ms-a{border-top:1px solid #2c3042;padding:3px 0}#msim .ms-a.warn{color:#ffd9a0}";
  document.head.appendChild(st);
  const d=document.createElement("div");d.id="msim";d.setAttribute("role","region");d.setAttribute("aria-label","Mission dashboard");
  d.innerHTML=`<div class="ms-h"><b>🚀 Mission dashboard</b><button id="ms-x" type="button" aria-label="Close">✕</button></div>
   <p class="ms-m">${msBd("blue")} SIMULATION: a hypothetical astronaut walks the current EVA route in straight lines between stops. No real astronaut and no live data. Not a safety assessment.</p>
   <div><button id="ms-play" type="button">▶ Start</button><button id="ms-reset" type="button">⏮ Reset</button><button id="ms-speed" type="button">Speed ×${MSIM.mult}</button></div>
   <div class="ms-m">Speed = simulated seconds per real second.</div>
   <div id="ms-brief"></div><div class="ms-bar"><i id="ms-fill" style="width:0%"></i></div><div id="ms-stat"></div>
   <h4>Alerts (simulated)</h4><div id="ms-al"></div><div id="ms-deb"></div>`;
  document.body.appendChild(d);MSIM.box=d;
  msq("ms-x").onclick=msClose;msq("ms-play").onclick=msPlay;msq("ms-reset").onclick=msReset;msq("ms-speed").onclick=msSpeed;
}
function msOpen(){
  const miss=msMissing();
  if(miss.length){if(typeof notify==="function")notify("Mission dashboard cannot start. Missing: "+miss.join(", "),10000);return}
  msShell();
  MSIM.box.style.display="block";
  if(!MSIM.run&&!MSIM.done&&MSIM.t===0)msReset();
}
function msInit(){
  if(MSIM.added)return true;
  if(typeof map==="undefined"||!map||typeof map.addControl!=="function"||typeof L==="undefined")return false;
  const Ctl=L.Control.extend({options:{position:"topleft"},onAdd(){
    const d=L.DomUtil.create("div","leaflet-bar"),b=L.DomUtil.create("button","ter-btn",d);
    b.type="button";b.textContent="🚀 Mission";L.DomEvent.on(b,"click",msOpen);L.DomEvent.disableClickPropagation(d);return d}});
  map.addControl(new Ctl());
  MSIM.added=true;return true;
}
(function(){
  if(msInit())return;
  let n=0;
  const t=setInterval(()=>{if(msInit()||++n>100)clearInterval(t)},200);
})();
/* END OF FILE mission */
