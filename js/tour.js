"use strict";
/* ARES Phase 9: ARES Academy, the guided tour.
   Adds a "🎓 Start Guided Tour" button to the header. The tour opens the real tabs and panels, dims the page and
   highlights the real buttons and controls. When it ends, the tab, panel size and selected target are put back.
   Reuses (read/write in memory only): S, T, render(), isMobile(), notify(), and msOpen/msClose, fnOpen/fnClose, tiClose if present.
   Edits no other file and saves nothing except a "tour seen" flag in localStorage. */
const TOUR={on:false,i:0,steps:[],keys:[],secN:0,saved:null,timer:null,scrolled:false,built:false,card:null,spot:null,block:null};
const TR_SEEN="ares_tour_seen";
const trq=id=>document.getElementById(id);
const trMob=()=>typeof isMobile==="function"&&isMobile();
const trEl=sel=>()=>document.querySelector(sel);
const trBtn=(scope,txt)=>()=>[].slice.call(document.querySelectorAll(scope)).find(b=>b.textContent.indexOf(txt)>=0)||null;

/* Close panels opened by other modules, so each step starts clean. */
function trPanels(){
  try{
    if(typeof msClose==="function")msClose();
    if(typeof fnClose==="function")fnClose();
    if(typeof tiClose==="function")tiClose();
    if(typeof map!=="undefined"&&map)map.closePopup();
  }catch(e){}
}
const trTab=t=>()=>{trPanels();S.tab=t;if(trMob())S.sheet="half";render()};
const trMapView=()=>{trPanels();if(trMob())S.sheet="closed";render()};
const trSci=()=>{trPanels();S.tab="sci";const t=T.find(x=>x.type==="science");if(t)S.sel=t.id;if(trMob())S.sheet="half";render()};

/* The 10 sections. A section can have several highlighted parts. */
const TR_STEPS=[
 {k:"welcome",sec:"Welcome",t:"🛰️ Welcome to ARES",tg:trEl("header"),go:trMapView,
  h:`<p>ARES is a <b>simulated</b> astronaut mission planner for lower Mount Sharp in Gale Crater, Mars. You can explore the map, place science targets, plan a walk on the surface (an EVA), run a simulation and keep a field log.</p>
     <p>There is no live telemetry, no live Mars weather and no real astronaut mission. Look for the badges: <b>🟢 real data</b> from a cited source, <b>🟡 calculation</b> done by ARES, <b>🔵 simulation</b> or your own assumption.</p>`},
 {k:"map",sec:"The map",t:"🗺️ The main map",tg:trEl("#mapw"),go:trMapView,
  h:`<p>Drag to move and pinch (or use + and −) to zoom. Pins are landmarks and science targets. <b>Tap a pin</b> to open its details. The dashed orange line is your EVA route. The faint orange grid is a 1° grid drawn by ARES 🟡.</p>`},
 {k:"map",sec:"The map",t:"🗺️ Map layers",tg:trEl(".leaflet-control-layers"),go:trMapView,
  h:`<p>The layer button (top right of the map) switches the picture: the Viking colour mosaic or the MOLA colour hillshade (both NASA/JPL Mars Trek), or a USGS backup that is sometimes unavailable. If tiles do not load, the orange grid still works.</p>`},
 {k:"map",sec:"The map",t:"🗺️ Coordinates",tg:trEl("#co"),go:trMapView,
  h:`<p>Move over or tap the map and the position appears here. Latitude is north or south; longitude is counted east-positive.</p>`},
 {k:"tabs",sec:"Tabs and Navigation",t:"🧭 The tab bar",tg:trEl("#nav"),go:trTab("nav"),
  h:`<p>The tab bar switches between six tabs: <b>Navigate, Science, Terrain, Environment, EVA</b> and <b>Log</b>. On a phone, tap the open tab again to close its panel and see the whole map. The ⇕ handle on the panel makes it taller or shorter.</p>`},
 {k:"tabs",sec:"Tabs and Navigation",t:"🧭 Navigation tab",tg:trEl("#sheet"),go:trTab("nav"),
  h:`<p>This tab explains the map and lists the <b>landmarks and destinations</b>. Tap one and the map flies there and shows its details. At the bottom it credits the map layers.</p>`},
 {k:"sci",sec:"Science targets",t:"🔬 Science tab",tg:trEl("#sheet"),go:trSci,
  h:`<p>Science targets are listed with ✅ visited or ⬜ not visited. Our sources give no published coordinates for them, so <b>you pin each one yourself</b>. A pinned position is 🔵 your own placement, not a NASA coordinate.</p>`},
 {k:"sci",sec:"Science targets",t:"🔬 Target details",tg:trEl("#detail"),go:trSci,scroll:1,
  h:`<p>Details of the selected target: position, summary, why it matters, limits and sources. Use <b>Place on map</b>, then tap the map. Once placed you can <b>Add to EVA route</b> or <b>Mark visited</b>. You can also drag a science pin to adjust it.</p>`},
 {k:"ter",sec:"Terrain Intel",t:"⛰️ Terrain tab",tg:trEl("#sheet"),go:trTab("ter"),
  h:`<p>Shows the elevation of the selected target. You can <b>type a height</b> you read from a cited source and press Set. The <b>route legs</b> table gives each leg's length, height change and mean gradient, with our own 🔵 10° and 20° bands (not NASA limits). A low gradient does not mean a route is safe.</p>`},
 {k:"tools",sec:"Terrain map tools",t:"🏔️ Terrain tools on the map",tg:trEl(".leaflet-top.leaflet-left"),go:trMapView,
  h:`<p>These top-left buttons read the saved MOLA terrain data (about 463 m per pixel, one window around Gale).</p>
     <ul><li><b>⛰ Elevation</b>: turn on, then tap inside the dashed rectangle to read a height.</li>
     <li><b>◐ Shaded relief</b> and <b>〰 Contours</b>: lighting and height lines.</li>
     <li><b>∠ Slope</b>: colours the map by steepness and reads slope on tap (our own bands).</li>
     <li><b>🏔 3D view</b>: drag to rotate, pinch to zoom, Height ×1, ×2 or ×4, with your route on the terrain.</li>
     <li><b>ℹ Terrain data</b>: where the data came from and its limits.</li></ul>
     <p>It is too coarse for rocks, ridges or any safety judgement.</p>`},
 {k:"env",sec:"Environment",t:"☢️ Environment tab",tg:trEl("#sheet"),go:trTab("env"),
  h:`<p>Shows the radiation measurement ARES uses, with its uncertainty, daily range, where it was measured and its sources. If it is not fully checked you will see <b>⚠ UNCHECKED</b>. It also explains the 🟡 EVA dose estimate (rate × EVA hours) and lists what is not available yet. There is no live weather.</p>`},
 {k:"eva",sec:"EVA Planner",t:"🥾 EVA Planner",tg:trEl("#sheet"),go:trTab("rte"),
  h:`<p>Build a walk that starts at Bradbury Landing. Add science stops or free waypoints, set the minutes at each stop, and reorder or remove them with ↑ ↓ ✕. You also get an Objective picker, two elevation profiles, <b>saved plans</b> you can compare, and totals: distance 🟡, EVA time 🔵, dose 🟡.</p>
     <p>Distances are straight lines, not walking paths, and a plan is not a safety assessment.</p>`},
 {k:"eva",sec:"EVA Planner",t:"🥾 Add a waypoint",tg:trBtn("#sc button","Add waypoint on map"),go:trTab("rte"),scroll:1,
  h:`<p>Press this, then tap anywhere on the map. A blue marker appears: drag it to move it, and rename it in the list.</p>`},
 {k:"mission",sec:"Mission dashboard",t:"🚀 Mission button",tg:trBtn(".leaflet-control button","Mission"),go:trMapView,need:()=>typeof msOpen==="function",
  h:`<p>This opens the mission dashboard, which simulates a hypothetical astronaut walking your EVA route. Add and place at least one stop in the EVA Planner first.</p>`},
 {k:"mission",sec:"Mission dashboard",t:"🚀 The dashboard",tg:trEl("#msim"),go:()=>{trMapView();msOpen()},need:()=>typeof msOpen==="function",
  h:`<p>The briefing shows your route totals. <b>Start, Pause and Reset</b> control playback; the speed button changes how fast simulated time runs. A 🧑‍🚀 marker walks the route in straight lines, with a clock, progress bar, distance, stops reached and dose so far. Alerts flag arrivals and steep legs, and a debrief appears at the end. All 🔵 SIMULATION, and it does not change your saved data.</p>`},
 {k:"log",sec:"Field Log",t:"📝 Log tab",tg:trEl("#sheet"),go:trTab("log"),
  h:`<p>Write a note about the selected target and press <b>Save note</b>. You can also log a hypothetical sample, see the objectives checklist and your past entries, and export the log as a .txt file.</p>`},
 {k:"log",sec:"Field Log",t:"📝 Notebook button",tg:trBtn(".leaflet-control button","Notebook"),go:trMapView,need:()=>typeof fnOpen==="function",
  h:`<p>The notebook is a fuller field log. Notes saved here also appear in the Log tab.</p>`},
 {k:"log",sec:"Field Log",t:"📝 The notebook",tg:trEl("#fnb"),go:()=>{trMapView();fnOpen()},need:()=>typeof fnOpen==="function",
  h:`<p>Write a note and optionally add coordinates: <b>Pick on map</b>, <b>Use target position</b>, or type them. The time is Earth time (UTC), set when you save. Export all entries as <b>JSON or CSV</b>, or delete one.</p>
     <p><b>That is the whole tour.</b> Press Finish. Restart it any time with 🎓 Start Guided Tour at the top.</p>`}
];

function trCss(){
  if(trq("tr-css"))return;
  const s=document.createElement("style");s.id="tr-css";
  s.textContent="#tour-start{background:#ff9d1c;color:#1a1205;font:700 13px system-ui,sans-serif;border:0;border-radius:8px;min-height:36px;padding:0 12px;margin:2px 6px;cursor:pointer;white-space:nowrap;box-shadow:0 0 0 0 rgba(255,157,28,.6);animation:trPulse 2.4s ease-out 3}"
   +"#tour-start.tr-float{position:fixed;right:10px;bottom:72px;z-index:3000}"
   +"@keyframes trPulse{0%{box-shadow:0 0 0 0 rgba(255,157,28,.6)}100%{box-shadow:0 0 0 12px rgba(255,157,28,0)}}"
   +"#tr-block{position:fixed;left:0;top:0;right:0;bottom:0;z-index:199998;background:transparent;display:none}"
   +"#tr-spot{position:fixed;z-index:199999;display:none;border-radius:10px;pointer-events:none;box-shadow:0 0 0 9999px rgba(8,10,18,.74),0 0 0 3px #ff9d1c,0 0 18px 4px rgba(255,157,28,.65);transition:left .25s,top .25s,width .25s,height .25s}"
   +"#tr-card,#tr-wel{position:fixed;left:50%;transform:translateX(-50%);z-index:200000;width:min(94vw,440px);box-sizing:border-box;background:#10121a;color:#e8e8ee;border:1px solid #2c3042;border-top:3px solid #ff9d1c;border-radius:12px;padding:10px 14px 12px;font:14px/1.45 system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.6);display:none}"
   +"#tr-card{max-height:46vh;overflow:auto}#tr-wel{top:50%;transform:translate(-50%,-50%)}"
   +"#tr-card h3,#tr-wel h3{margin:6px 0;font-size:17px}#tr-card p,#tr-wel p{margin:6px 0}#tr-card ul{margin:6px 0;padding-left:18px}#tr-card li{margin:3px 0}"
   +".tr-top{display:flex;justify-content:space-between;gap:8px;font-size:12px;color:#9aa0b4}.tr-chip{color:#ff9d1c;font-weight:700}"
   +".tr-bar{height:6px;background:#2c3042;border-radius:3px;margin:6px 0}.tr-bar i{display:block;height:100%;width:0;background:#ff9d1c;border-radius:3px;transition:width .25s}"
   +".tr-row{display:flex;gap:8px;margin-top:8px}.tr-row>button{flex:1}"
   +"#tr-card button,#tr-wel button{font:inherit;min-height:44px;padding:0 10px;border-radius:8px;border:1px solid #ff9d1c;background:#2a2316;color:#ffd9a0;cursor:pointer}"
   +"#tr-card button.pri,#tr-wel button.pri{background:#ff9d1c;color:#1a1205;font-weight:700}#tr-card button:disabled{opacity:.4}"
   +"#tr-card .tr-sm button{min-height:38px;font-size:13px;border-color:#2c3042;background:#1b1f2a;color:#c9cde0}"
   +"@media (prefers-reduced-motion:reduce){#tour-start{animation:none}#tr-spot,.tr-bar i{transition:none}}";
  document.head.appendChild(s);
}
function trBuild(){
  if(TOUR.built)return;
  trCss();
  const b=document.createElement("div");b.id="tr-block";
  const sp=document.createElement("div");sp.id="tr-spot";
  const c=document.createElement("div");c.id="tr-card";c.setAttribute("role","dialog");c.setAttribute("aria-label","ARES guided tour");c.setAttribute("aria-live","polite");
  c.innerHTML=`<div class="tr-top"><span class="tr-chip" id="tr-chip"></span><span id="tr-sec"></span></div>
   <div class="tr-bar"><i id="tr-fill"></i></div><h3 id="tr-title"></h3><div id="tr-body"></div>
   <div class="tr-row"><button id="tr-back" type="button">← Back</button><button id="tr-next" type="button" class="pri">Next →</button></div>
   <div class="tr-row tr-sm"><button id="tr-skip" type="button">Skip section ⏭</button><button id="tr-restart" type="button">↺ Restart</button><button id="tr-exit" type="button">✕ Exit</button></div>`;
  document.body.appendChild(b);document.body.appendChild(sp);document.body.appendChild(c);
  TOUR.block=b;TOUR.spot=sp;TOUR.card=c;TOUR.built=true;
  trq("tr-next").onclick=trNext;trq("tr-back").onclick=trBack;trq("tr-skip").onclick=trSkip;
  trq("tr-restart").onclick=()=>{TOUR.i=0;trShow()};trq("tr-exit").onclick=()=>trEnd(false);
  document.addEventListener("keydown",e=>{
    if(!TOUR.on)return;
    if(e.key==="Escape")trEnd(false);else if(e.key==="ArrowRight")trNext();else if(e.key==="ArrowLeft")trBack();
  });
  window.addEventListener("resize",()=>trPlace());
}

function trPlace(){
  if(!TOUR.on)return;
  const s=TOUR.steps[TOUR.i],card=TOUR.card,sp=TOUR.spot;
  const el=s.tg?s.tg():null;
  if(el&&s.scroll&&!TOUR.scrolled&&el.scrollIntoView){el.scrollIntoView({block:"center"});TOUR.scrolled=true}
  const W=window.innerHeight,V=window.innerWidth;
  let x1=0,y1=0,x2=0,y2=0,ok=false;
  if(el){
    const r=el.getBoundingClientRect();
    x1=Math.max(2,r.left-4);y1=Math.max(2,r.top-4);x2=Math.min(V-2,r.right+4);y2=Math.min(W-2,r.bottom+4);
    ok=r.width>2&&r.height>2&&x2-x1>4&&y2-y1>4;
  }
  if(ok){
    sp.style.display="block";sp.style.left=x1+"px";sp.style.top=y1+"px";sp.style.width=(x2-x1)+"px";sp.style.height=(y2-y1)+"px";
    if(W-y2>=y1){card.style.top="auto";card.style.bottom="calc(8px + env(safe-area-inset-bottom))"}
    else{card.style.bottom="auto";card.style.top="calc(8px + env(safe-area-inset-top))"}
  }else{
    sp.style.display="none";card.style.top="auto";card.style.bottom="calc(8px + env(safe-area-inset-bottom))";
  }
}

function trShow(){
  const s=TOUR.steps[TOUR.i],n=TOUR.steps.length;
  const si=TOUR.keys.indexOf(s.k)+1,parts=TOUR.steps.filter(x=>x.k===s.k),pi=parts.indexOf(s)+1;
  trq("tr-chip").textContent="Section "+si+" of "+TOUR.secN+(parts.length>1?" · part "+pi+"/"+parts.length:"");
  trq("tr-sec").textContent=s.sec;
  trq("tr-title").textContent=s.t;
  trq("tr-body").innerHTML=s.h;
  trq("tr-fill").style.width=((TOUR.i+1)/n*100)+"%";
  trq("tr-back").disabled=TOUR.i===0;
  trq("tr-next").textContent=TOUR.i===n-1?"Finish ✓":"Next →";
  TOUR.card.scrollTop=0;TOUR.scrolled=false;
  try{trPanels();if(s.go)s.go()}catch(e){if(typeof console!=="undefined")console.warn("ARES tour step failed:",e)}
  setTimeout(trPlace,60);setTimeout(trPlace,450);setTimeout(trPlace,1000);
  try{trq("tr-next").focus({preventScroll:true})}catch(e){}
}
function trNext(){if(!TOUR.on)return;if(TOUR.i>=TOUR.steps.length-1){trEnd(true);return}TOUR.i++;trShow()}
function trBack(){if(!TOUR.on||TOUR.i===0)return;TOUR.i--;trShow()}
function trSkip(){
  if(!TOUR.on)return;
  const k=TOUR.steps[TOUR.i].k;let j=TOUR.i;
  while(j<TOUR.steps.length&&TOUR.steps[j].k===k)j++;
  if(j>=TOUR.steps.length){trEnd(true);return}
  TOUR.i=j;trShow();
}

function trStart(){
  if(TOUR.on)return;
  if(typeof S==="undefined"||typeof render!=="function"||typeof map==="undefined"||!map||typeof T==="undefined"||!T.length){
    if(typeof notify==="function")notify("ARES is still loading. Try the tour again in a moment.",5000);return}
  trBuild();trHideWelcome();
  TOUR.saved={tab:S.tab,sheet:S.sheet,sel:S.sel};
  S.placing=null;try{addingWp=false}catch(e){}
  const m=document.getElementById("map");if(m)m.classList.remove("pl");
  if(typeof fnCancelPick==="function")fnCancelPick();
  TOUR.steps=TR_STEPS.filter(s=>!s.need||s.need());
  TOUR.keys=[];TOUR.steps.forEach(s=>{if(TOUR.keys.indexOf(s.k)<0)TOUR.keys.push(s.k)});
  TOUR.secN=TOUR.keys.length;
  TOUR.on=true;TOUR.i=0;
  TOUR.block.style.display="block";TOUR.card.style.display="block";
  TOUR.timer=setInterval(trPlace,400);
  trShow();
}
function trEnd(done){
  if(!TOUR.on)return;
  TOUR.on=false;clearInterval(TOUR.timer);
  trPanels();
  if(TOUR.saved){S.tab=TOUR.saved.tab;S.sheet=TOUR.saved.sheet;S.sel=TOUR.saved.sel}
  render();
  TOUR.block.style.display="none";TOUR.spot.style.display="none";TOUR.card.style.display="none";
  try{localStorage.setItem(TR_SEEN,"1")}catch(e){}
  if(done&&typeof notify==="function")notify("Tour complete. Restart it any time with 🎓 Start Guided Tour at the top.",8000);
}

/* ---- first visit prompt and header button ---- */
function trHideWelcome(){const w=trq("tr-wel");if(w)w.style.display="none"}
function trWelcome(){
  try{if(localStorage.getItem(TR_SEEN))return}catch(e){return}
  trCss();
  const w=document.createElement("div");w.id="tr-wel";w.setAttribute("role","dialog");w.setAttribute("aria-label","Welcome to ARES");
  w.innerHTML=`<h3>🎓 New to ARES?</h3><p>Take a short guided tour. It opens each part of the site and shows you what the buttons do. You can exit at any time.</p>
   <div class="tr-row"><button id="tr-wgo" type="button" class="pri">Start Guided Tour</button><button id="tr-wno" type="button">Not now</button></div>`;
  document.body.appendChild(w);w.style.display="block";
  trq("tr-wgo").onclick=()=>{try{localStorage.setItem(TR_SEEN,"1")}catch(e){}trStart()};
  trq("tr-wno").onclick=()=>{try{localStorage.setItem(TR_SEEN,"1")}catch(e){}trHideWelcome()};
}
function trAddButton(){
  if(trq("tour-start"))return;
  const h=document.querySelector("header");if(!h)return;
  trCss();
  const b=document.createElement("button");b.id="tour-start";b.type="button";b.textContent="🎓 Start Guided Tour";b.onclick=trStart;
  const a=h.querySelector(".sim")||h.querySelector("h1");
  if(a&&a.parentNode===h)a.insertAdjacentElement("afterend",b);else h.appendChild(b);
  if(!b.offsetWidth){h.removeChild(b);b.className="tr-float";document.body.appendChild(b)}   // header hidden on this layout: float the button instead
}
(function(){
  let n=0;
  const t=setInterval(()=>{
    n++;
    if(document.querySelector("header")){trAddButton()}
    if(typeof map!=="undefined"&&map&&typeof T!=="undefined"&&T.length){clearInterval(t);trAddButton();setTimeout(trWelcome,1200)}
    else if(n>80)clearInterval(t);
  },250);
})();
/* END OF FILE tour */
