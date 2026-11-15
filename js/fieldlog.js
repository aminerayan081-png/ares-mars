"use strict";
/* ARES Phase 7: Field notebook. Adds a "📝 Notebook" map button.
   Entries are saved in the existing S.log (same fields as the Log tab: t, n, x, plus optional ll, cs, tid),
   so the Log tab keeps working and shows them. Export to JSON or CSV.
   Reuses: S, T_, save(), render(), now(), esc(), fc(), P(), isLL(), notify(), map. Edits no other file. */
const FN={box:null,cs:"",pick:null,added:false};
const fnq=id=>document.getElementById(id);
const fnBd=c=>typeof bd==="function"?bd(c):"🔵 SIM";

function fnMissing(){
  const m=[];
  if(typeof S==="undefined")m.push("S");
  if(typeof T_==="undefined")m.push("T_");
  if(typeof save!=="function")m.push("save");
  if(typeof render!=="function")m.push("render");
  if(typeof now!=="function")m.push("now");
  if(typeof map==="undefined"||!map)m.push("map");
  return m;
}

function fnList(){
  const el=fnq("fn-list"),n=S.log.length;
  fnq("fn-count").textContent=n+(n===1?" entry":" entries");
  el.innerHTML=n?S.log.map((l,i)=>({l:l,i:i})).reverse().map(o=>{
    const l=o.l,c=isLL(l.ll)?" · "+fc(l.ll)+(l.cs?" ("+esc(l.cs)+")":""):"";
    return`<div class="fn-e"><span class="fn-m">${esc(l.t||"")} · ${esc(l.n||"")}${c}</span><br>${esc(l.x)}<br><button type="button" data-del="${o.i}">Delete</button></div>`;
  }).join(""):'<div class="fn-m">No entries yet.</div>';
}

function fnCancelPick(){
  if(FN.pick){map.off("click",FN.pick);FN.pick=null;const m=$("#map");if(m)m.classList.remove("pl")}
}
function fnPick(){
  if(S.placing||addingWp){notify("Finish placing the current pin first.",6000);return}
  fnCancelPick();
  FN.box.style.display="none";
  $("#map").classList.add("pl");
  notify("Tap the map to set the note's coordinates.",9000);
  FN.pick=e=>{
    FN.pick=null;$("#map").classList.remove("pl");
    fnq("fn-lat").value=e.latlng.lat.toFixed(4);fnq("fn-lon").value=e.latlng.lng.toFixed(4);
    FN.cs="picked on map by user";FN.box.style.display="block";
  };
  map.once("click",FN.pick);
}
function fnUseTarget(){
  const p=P(S.sel);
  if(!p){notify("The selected target has no position yet.",6000);return}
  fnq("fn-lat").value=p[0].toFixed(4);fnq("fn-lon").value=p[1].toFixed(4);
  FN.cs=S.pos[S.sel]?"selected target, user-placed position":"selected target, position from ARES data";
}
function fnClear(){fnq("fn-lat").value="";fnq("fn-lon").value="";FN.cs=""}

function fnSave(){
  const x=fnq("fn-text").value.trim();
  if(!x){notify("Write a note first.",5000);return}
  const la=fnq("fn-lat").value.trim(),lo=fnq("fn-lon").value.trim();
  let ll=null;
  if(la||lo){
    const a=Number(la),b=Number(lo);
    if(!la||!lo||!Number.isFinite(a)||!Number.isFinite(b)||a<-90||a>90||b<-180||b>360){
      notify("Coordinates: two numbers (latitude -90 to 90, east longitude -180 to 360), or leave both empty.",9000);return}
    ll=[+a.toFixed(4),+b.toFixed(4)];
  }
  const e={t:now(),n:T_[S.sel]?T_[S.sel].name:String(S.sel),x:x.slice(0,2000),tid:S.sel};
  if(ll){e.ll=ll;e.cs=FN.cs||"typed by user"}
  S.log.push(e);save();render();
  fnq("fn-text").value="";fnClear();fnList();
  notify("Note saved.",3000);
}

/* ---- export ---- */
function fnRows(){
  return S.log.map(l=>({
    time_utc:l.t||"",target:l.n||"",text:l.x,
    latitude:isLL(l.ll)?l.ll[0]:null,longitude:isLL(l.ll)?l.ll[1]:null,
    coordinate_source:isLL(l.ll)?(l.cs||""):""
  }));
}
function fnStamp(){return new Date().toISOString().slice(0,16).replace(/[-:T]/g,"")}
function fnDownload(name,text,mime){
  const u=URL.createObjectURL(new Blob([text],{type:mime})),a=document.createElement("a");
  a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(u),3000);
}
function fnJSON(){
  if(!S.log.length){notify("No entries to export.",5000);return}
  const o={application:"ARES",
    label:"SIMULATION: notes written by the user in a simulated mission. Not real mission data.",
    exported_utc:new Date().toISOString(),
    time_note:"time_utc is Earth time (UTC) when the note was saved.",
    longitude_convention:"east-positive",
    entry_count:S.log.length,entries:fnRows()};
  fnDownload("ares-field-log-"+fnStamp()+".json",JSON.stringify(o,null,2),"application/json");
}
function fnCell(v,isText){
  let s=v==null?"":String(v);
  if(isText&&/^[=+\-@\t\r]/.test(s))s="'"+s;      // stops spreadsheets from running a note as a formula
  return'"'+s.replace(/"/g,'""')+'"';
}
function fnCSV(){
  if(!S.log.length){notify("No entries to export.",5000);return}
  const head=["time_utc","target","text","latitude","longitude","coordinate_source"];
  const lines=[head.map(h=>fnCell(h,false)).join(",")].concat(fnRows().map(r=>[
    fnCell(r.time_utc,true),fnCell(r.target,true),fnCell(r.text,true),
    fnCell(r.latitude,false),fnCell(r.longitude,false),fnCell(r.coordinate_source,true)].join(",")));
  fnDownload("ares-field-log-"+fnStamp()+".csv","\ufeff"+lines.join("\r\n"),"text/csv;charset=utf-8");
}

/* ---- panel ---- */
function fnShell(){
  if(FN.box)return;
  const st=document.createElement("style");
  st.textContent="#fnb{position:fixed;left:0;right:0;bottom:0;z-index:4000;max-height:55vh;overflow:auto;background:#10121a;color:#e8e8ee;border-top:2px solid #4fc3f7;font:14px/1.4 system-ui,sans-serif;padding:8px 12px calc(10px + env(safe-area-inset-bottom));box-sizing:border-box;display:none}"
   +"#fnb button{font:inherit;min-height:44px;padding:0 12px;border-radius:8px;border:1px solid #4fc3f7;background:#14242c;color:#cdeeff;margin:2px 4px 2px 0}"
   +"#fnb textarea,#fnb input{font-size:16px;width:100%;box-sizing:border-box;background:#1b1f2a;color:#e8e8ee;border:1px solid #2c3042;border-radius:6px;padding:6px}"
   +"#fnb .fn-h{display:flex;justify-content:space-between;align-items:center}#fnb h4{margin:10px 0 4px;color:#4fc3f7}#fnb p{margin:6px 0}"
   +"#fnb .fn-m{color:#9aa0b4;font-size:12px}#fnb .fn-r{display:flex;gap:8px}#fnb .fn-r>div{flex:1}"
   +"#fnb .fn-e{border-top:1px solid #2c3042;padding:6px 0;overflow-wrap:anywhere}";
  document.head.appendChild(st);
  const d=document.createElement("div");d.id="fnb";d.setAttribute("role","region");d.setAttribute("aria-label","Field notebook");
  d.innerHTML=`<div class="fn-h"><b>📝 Field notebook</b><button id="fn-x" type="button" aria-label="Close">✕</button></div>
   <p class="fn-m">${fnBd("blue")} Notes you write in the simulated mission. Time is Earth time (UTC), set when you save. Coordinates are what you pick or type, not measured data.</p>
   <p>Note is about: <b id="fn-target"></b><br><span class="fn-m">To change it, tap a target on the map.</span></p>
   <textarea id="fn-text" rows="3" maxlength="2000" placeholder="Observation…"></textarea>
   <div class="fn-r"><div><span class="fn-m">Latitude (°, S is negative)</span><input id="fn-lat" inputmode="decimal" placeholder="e.g. -5.1"></div>
   <div><span class="fn-m">East longitude (°)</span><input id="fn-lon" inputmode="decimal" placeholder="e.g. 137.6"></div></div>
   <div><button id="fn-pick" type="button">📍 Pick on map</button><button id="fn-tgt" type="button">🎯 Use target position</button><button id="fn-clr" type="button">Clear coordinates</button></div>
   <div><button id="fn-save" type="button" style="font-weight:700">💾 Save note</button></div>
   <h4>Entries <span id="fn-count" class="fn-m"></span></h4>
   <div><button id="fn-json" type="button">⬇ Export JSON</button><button id="fn-csv" type="button">⬇ Export CSV</button></div>
   <div id="fn-list"></div>`;
  document.body.appendChild(d);FN.box=d;
  fnq("fn-x").onclick=fnClose;fnq("fn-save").onclick=fnSave;fnq("fn-pick").onclick=fnPick;
  fnq("fn-tgt").onclick=fnUseTarget;fnq("fn-clr").onclick=fnClear;
  fnq("fn-json").onclick=fnJSON;fnq("fn-csv").onclick=fnCSV;
  ["fn-lat","fn-lon"].forEach(id=>fnq(id).addEventListener("input",()=>{FN.cs="typed by user"}));
  setInterval(()=>{if(FN.box.style.display==="block"&&typeof S!=="undefined"&&T_[S.sel])fnq("fn-target").textContent=T_[S.sel].name},500);
  fnq("fn-list").addEventListener("click",e=>{
    const b=e.target.closest&&e.target.closest("[data-del]");if(!b)return;
    const i=+b.getAttribute("data-del");
    if(!S.log[i]||!confirm("Delete this note?"))return;
    S.log.splice(i,1);save();render();fnList();
  });
}
function fnClose(){fnCancelPick();if(FN.box)FN.box.style.display="none"}
function fnOpen(){
  const miss=fnMissing();
  if(miss.length){if(typeof notify==="function")notify("Notebook cannot start. Missing: "+miss.join(", "),10000);return}
  fnShell();
  const ms=document.getElementById("msim");               // close the mission panel so the two do not overlap
  if(ms&&ms.style.display!=="none"&&typeof msClose==="function")msClose();
  fnq("fn-target").textContent=T_[S.sel]?T_[S.sel].name:String(S.sel);
  fnList();
  FN.box.style.display="block";
}
function fnInit(){
  if(FN.added)return true;
  if(typeof map==="undefined"||!map||typeof map.addControl!=="function"||typeof L==="undefined")return false;
  const Ctl=L.Control.extend({options:{position:"topleft"},onAdd(){
    const d=L.DomUtil.create("div","leaflet-bar"),b=L.DomUtil.create("button","ter-btn",d);
    b.type="button";b.textContent="📝 Notebook";L.DomEvent.on(b,"click",fnOpen);L.DomEvent.disableClickPropagation(d);return d}});
  map.addControl(new Ctl());
  FN.added=true;return true;
}
(function(){
  if(fnInit())return;
  let n=0;
  const t=setInterval(()=>{if(fnInit()||++n>100)clearInterval(t)},200);
})();
/* END OF FILE fieldlog */
