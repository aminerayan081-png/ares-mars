"use strict";
/* ARES Phase 5.8: "Terrain data" panel. Shows what the saved Gale terrain file says about itself
   (data/terrain/gale-mola463.json): source, resolution, coverage, height reference, limits.
   It shows only fields that exist in that file. Adds an "ℹ Terrain data" button under the other terrain buttons.
   Needs Leaflet, the global map and terrain.js (TER). Edits no other file. */
const TI={el:null,body:null,busy:false};
const tiEsc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const tiBd=c=>typeof bd==="function"?bd(c):(c==="green"?"🟢 REAL":"🟡 CALC");
const tiLat=v=>Math.abs(v).toFixed(3)+(v<0?"°S":"°N");
const tiLon=v=>Math.abs(v).toFixed(3)+(v<0?"°W":"°E");
const tiNum=v=>typeof v==="number"&&Number.isFinite(v);
function tiRow(k,v){return(v===null||v===undefined||v==="")?"":`<tr><td>${tiEsc(k)}</td><td>${v}</td></tr>`}

/* Page text from the dataset description. Pure function (no screen needed). */
function tiHtml(m){
  const b=m.bounds||{},st=m.stats||{},so=m.source||{},sr=m.sphereRadius_m||{},gk=m.geoKeys||{},ex=m.extracted||{};
  const link=so.officialPage&&/^https:\/\//.test(so.officialPage)?`<a href="${tiEsc(so.officialPage)}" target="_blank" rel="noopener">USGS page</a>`:"";
  const coverage=[b.west,b.east,b.north,b.south].every(tiNum)?`${tiLon(b.west)} to ${tiLon(b.east)}, ${tiLat(b.south)} to ${tiLat(b.north)}`:"";
  let h=`<h2>${tiEsc(m.name||"Terrain data")}</h2>`;
  if(m.evidence==="green")h+=`<p>${tiBd("green")} ${tiEsc(m.evidenceNote||"")}</p>`;
  h+=`<h3>At a glance</h3><table>`
   +tiRow("Resolution",tiNum(m.pixelSize_m)?`about ${Math.round(m.pixelSize_m)} m per pixel`:"")
   +tiRow("Grid",tiNum(m.width)&&tiNum(m.height)?`${m.width} × ${m.height} pixels`:"")
   +tiRow("Units",m.units?tiEsc(m.units):"")
   +tiRow("Coverage",coverage?tiEsc(coverage)+(b.note?`<br><span class="m">${tiEsc(b.note)}</span>`:""):"")
   +tiRow("Projection",m.projection?tiEsc(m.projection):"")
   +tiRow("Height reference",m.heightReference?tiEsc(m.heightReference):"")
   +tiRow("Position accuracy",gk.rasterTypeNote?`Raster type ${tiEsc(gk.rasterType)}. ${tiEsc(gk.rasterTypeNote)}`:"")
   +tiRow("Sphere radius",tiNum(sr.usedByTool)?`${(sr.usedByTool/1000).toFixed(2)} km used by the terrain tools. ${tiEsc(sr.note||"")}`:"")
   +`</table>`;
  if(tiNum(st.min_m)||tiNum(st.max_m)){
    h+=`<h3>Heights in this window</h3><table>`
     +tiRow("Lowest",tiNum(st.min_m)?st.min_m+" m":"")
     +tiRow("Highest",tiNum(st.max_m)?st.max_m+" m":"")
     +tiRow("Mean",tiNum(st.mean_m)?st.mean_m+" m":"")
     +tiRow("Pixels with data",tiNum(st.validPixels)?String(st.validPixels):"")
     +tiRow("Pixels with no data",tiNum(st.noDataPixels)?String(st.noDataPixels):"")
     +tiRow("Bradbury Landing check",tiNum(st.bradburyLanding_m)&&tiNum(st.publishedBradbury_m)?`file ${st.bradburyLanding_m} m, published ${st.publishedBradbury_m} m. ${tiEsc(st.note||"")}`:"")
     +`</table>`;
  }
  h+=`<h3>Source</h3><table>`
   +tiRow("Product",so.product?tiEsc(so.product):"")
   +tiRow("File",so.fileName?tiEsc(so.fileName):"")
   +tiRow("Official page",link)
   +tiRow("How ARES got it",so.how?tiEsc(so.how):"")
   +tiRow("Licence",so.licence?tiEsc(so.licence):"")
   +`</table>`;
  if(Array.isArray(m.limitations)&&m.limitations.length)h+=`<h3>Limits</h3><ul>${m.limitations.map(x=>`<li>${tiEsc(x)}</li>`).join("")}</ul>`;
  h+=`<h3>What is real and what is calculated</h3><ul>`
   +`<li>${tiBd("green")} The height values stored in the file (cropped to this window, otherwise unchanged).</li>`
   +`<li>${tiBd("yellow")} Everything ARES works out from them: smoothed heights between pixels, the elevation profile, shaded relief, contours, slopes and the 3D view (which also stretches heights by the factor you choose).</li>`
   +`<li>None of it says whether a route is safe or traversable.</li></ul>`;
  if(ex.date||ex.tool)h+=`<p class="m">Window cut by ${tiEsc(ex.tool||"ARES")}${ex.date?" on "+tiEsc(String(ex.date).slice(0,10)):""}.</p>`;
  return h;
}

function tiShell(){
  if(TI.el)return;
  const s=document.createElement("style");
  s.textContent="#ti{position:fixed;inset:0;z-index:100000;background:#10121a;color:#e8e8ee;display:none;overflow:auto;-webkit-overflow-scrolling:touch;font:14px/1.45 system-ui,sans-serif;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);box-sizing:border-box}"
   +"#ti .in{max-width:640px;margin:0 auto;padding:10px 14px 30px}#ti h2{font-size:18px;margin:6px 0}#ti h3{font-size:15px;margin:16px 0 4px;color:#ff9d1c}"
   +"#ti table{width:100%;border-collapse:collapse}#ti td{border-top:1px solid #2c3042;padding:5px 6px 5px 0;vertical-align:top;overflow-wrap:anywhere}#ti td:first-child{width:34%;color:#9aa0b4}"
   +"#ti .m{color:#9aa0b4;font-size:12px}#ti a{color:#8ab4ff}#ti ul{padding-left:18px;margin:4px 0}"
   +"#ti button{font:inherit;min-height:44px;padding:0 14px;border-radius:8px;border:1px solid #ff9d1c;background:#2a2316;color:#ffd9a0}";
  document.head.appendChild(s);
  const el=document.createElement("div");el.id="ti";
  el.innerHTML='<div class="in"><button id="ti-x" type="button">✕ Close</button><div id="ti-body"></div></div>';
  document.body.appendChild(el);
  TI.el=el;TI.body=el.querySelector("#ti-body");
  el.querySelector("#ti-x").onclick=tiClose;
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&TI.el.style.display==="block")tiClose()});
}
function tiClose(){if(TI.el)TI.el.style.display="none"}
async function tiOpen(){
  if(TI.busy)return;TI.busy=true;
  try{
    let m=(typeof TER!=="undefined"&&TER.meta)||null;
    if(!m){
      m=typeof loadJSON==="function"?await loadJSON("data/terrain/gale-mola463.json"):await (await fetch("data/terrain/gale-mola463.json",{cache:"no-cache"})).json();
    }
    if(!m||typeof m!=="object")throw new Error("the terrain description file could not be read");
    tiShell();TI.body.innerHTML=tiHtml(m);TI.el.style.display="block";TI.el.scrollTop=0;
  }catch(e){if(typeof notify==="function")notify("Terrain data info could not be loaded: "+(e&&e.message?e.message:e),8000)}
  finally{TI.busy=false}
}
function tiInit(){
  const Bar=L.Control.extend({options:{position:"topleft"},onAdd(){
    const d=L.DomUtil.create("div","leaflet-bar"),b=L.DomUtil.create("button","ter-btn",d);
    b.type="button";b.textContent="ℹ Terrain data";L.DomEvent.on(b,"click",tiOpen);L.DomEvent.disableClickPropagation(d);return d}});
  map.addControl(new Bar());
}
/* Start once the map and the other terrain buttons exist (checks twice a second for up to 20 seconds). */
(function(){
  let n=0;
  const t=setInterval(()=>{
    n++;
    if(typeof map!=="undefined"&&map&&typeof L!=="undefined"&&typeof TER!=="undefined"&&TER.btn&&(typeof TD==="undefined"||TD.btn)){clearInterval(t);tiInit()}
    else if(n>40){clearInterval(t);if(typeof console!=="undefined")console.warn("ARES terraininfo.js: map or terrain tool not found")}
  },500);
})();
/* END OF FILE terraininfo */
