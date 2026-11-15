"use strict";
/* ARES Phase 5.2: tap the map to read elevation from the saved Gale MOLA 463 m window
   (data/terrain/gale-mola463.bin + .json). Needs Leaflet, map.js, data.js (loadJSON) and ui.js (bd, fc). */
const TER={on:false,loaded:false,loading:false,meta:null,data:null,btn:null,box:null};
const TER_NODATA=-32768;
const TER_TIMEOUT_MS=20000;   // give up on the terrain file after 20 seconds

function terCss(){
  if(document.getElementById("ter-css"))return;
  const s=document.createElement("style");s.id="ter-css";
  s.textContent=".ter-btn{min-height:44px;padding:0 12px;font-size:14px;background:#fff;color:#222;border:0;cursor:pointer;white-space:nowrap}"
   +".ter-btn.on{background:#ff9d1c;color:#000;font-weight:700}#map.ter-on{cursor:crosshair}"
   +".ter-pop{font-size:13px;line-height:1.4}.ter-pop .m{color:#555;font-size:12px}.ter-pop a{color:#0b5cad}";
  document.head.appendChild(s);
}
function initTerrain(){
  if(typeof map==="undefined"||!map||typeof L==="undefined")return;
  terCss();
  const Ctl=L.Control.extend({options:{position:"topleft"},onAdd(){
    const d=L.DomUtil.create("div","leaflet-bar"),b=L.DomUtil.create("button","ter-btn",d);
    b.type="button";b.textContent="⛰ Elevation: off";b.setAttribute("aria-pressed","false");
    L.DomEvent.disableClickPropagation(d);L.DomEvent.on(b,"click",terToggle);TER.btn=b;return d}});
  map.addControl(new Ctl());
  map.on("click",terClick);
}
async function terLoad1(){
  TER.loading=true;
  try{
    const m=await loadJSON("data/terrain/gale-mola463.json"),b=m&&m.bounds;
    if(!b||![m.width,m.height].every(n=>Number.isInteger(n)&&n>10&&n<5000)||![b.west,b.east,b.north,b.south].every(Number.isFinite)||b.east<=b.west||b.north<=b.south)throw new Error("the terrain description file is invalid");
    const ac=new AbortController(),tm=setTimeout(()=>ac.abort(),TER_TIMEOUT_MS);let buf;
    try{
      const r=await fetch("data/terrain/gale-mola463.bin",{cache:"no-cache",signal:ac.signal});
      if(!r.ok)throw new Error("terrain file not found (HTTP "+r.status+")");
      buf=await r.arrayBuffer();
    }catch(err){throw err&&err.name==="AbortError"?new Error("the terrain file took too long to load"):err}
    finally{clearTimeout(tm)}
    if(buf.byteLength!==m.width*m.height*2)throw new Error("the terrain file has the wrong size");
    const dv=new DataView(buf),d=new Int16Array(m.width*m.height);
    for(let i=0;i<d.length;i++)d[i]=dv.getInt16(i*2,true);
    TER.meta=m;TER.data=d;TER.loaded=true;
    TER.box=L.rectangle([[b.south,b.west],[b.north,b.east]],{color:"#9aa0b4",weight:1,dashArray:"4 4",fill:false,interactive:false}).addTo(map);
    TER.loading=false;return true;
  }catch(e){TER.loading=false;if(typeof notify==="function")notify("Elevation data could not be loaded: "+e.message,10000);return false}
}
/* One shared load: every tool that needs the data waits for the same request instead of starting its own. */
let TER_P=null;
function terLoad(){
  if(TER.loaded)return Promise.resolve(true);
  if(!TER_P)TER_P=terLoad1().finally(()=>{TER_P=null});
  return TER_P;
}
async function terToggle(){
  if(TER.on){terSet(false);return}
  if(!TER.loaded&&!(await terLoad()))return;
  terSet(true);
  notify("Elevation tool on. Tap inside the dashed rectangle (the saved Gale terrain data).",9000);
}
function terSet(on){
  TER.on=on;
  if(TER.btn){TER.btn.textContent="⛰ Elevation: "+(on?"on":"off");TER.btn.classList.toggle("on",on);TER.btn.setAttribute("aria-pressed",String(on))}
  const m=document.getElementById("map");if(m)m.classList.toggle("ter-on",on);
  if(!on&&typeof map!=="undefined")map.closePopup();
}
/* Elevation at a point: nearest stored pixel, and a smooth value between the 4 nearest pixels. */
function terSample(lat,lon){
  const m=TER.meta,b=m.bounds;
  if(lat<b.south||lat>b.north||lon<b.west||lon>b.east)return null;
  const dLon=(b.east-b.west)/m.width,dLat=(b.north-b.south)/m.height;
  const fx=(lon-b.west)/dLon-0.5,fy=(b.north-lat)/dLat-0.5,cl=(v,mx)=>Math.max(0,Math.min(mx,v));
  const x0=Math.floor(fx),y0=Math.floor(fy),wx=fx-x0,wy=fy-y0;
  const xa=cl(x0,m.width-1),xb=cl(x0+1,m.width-1),ya=cl(y0,m.height-1),yb=cl(y0+1,m.height-1),at=(x,y)=>TER.data[y*m.width+x];
  const v=[at(xa,ya),at(xb,ya),at(xa,yb),at(xb,yb)],nearest=at(cl(Math.round(fx),m.width-1),cl(Math.round(fy),m.height-1));
  if(nearest===TER_NODATA||v.some(x=>x===TER_NODATA))return{nodata:true};
  return{nearest,interp:v[0]*(1-wx)*(1-wy)+v[1]*wx*(1-wy)+v[2]*(1-wx)*wy+v[3]*wx*wy};
}
function terClick(e){
  if(!TER.on||!TER.loaded||(typeof S!=="undefined"&&S.placing))return;
  const lat=e.latlng.lat,lon=e.latlng.lng,s=terSample(lat,lon);
  const pos=(typeof fc==="function"?fc([lat,lon]):lat.toFixed(4)+", "+lon.toFixed(4));
  const page=TER.meta.source&&TER.meta.source.officialPage;
  let h;
  if(!s)h=`<b>No terrain data here</b><br>This spot is outside the saved Gale terrain window (dashed rectangle). ARES shows no number rather than guessing.<br><span class="m">${pos}</span>`;
  else if(s.nodata)h=`<b>No data at this spot</b><br>The terrain file marks this pixel as empty.<br><span class="m">${pos}</span>`;
  else h=`<b>Elevation reading</b><br><span class="m">${pos}</span><br>
   <b style="font-size:16px">${Math.round(s.interp)} m</b> ${bd("yellow")}<br><span class="m">Smooth value between the 4 nearest 463 m pixels (bilinear interpolation).</span><br>
   Nearest pixel: <b>${s.nearest} m</b> ${bd("green")}<br><span class="m">Stored value, MOLA 463 m grid${page?` · <a href="${page}" target="_blank" rel="noopener">USGS page</a>`:""}.</span><br>
   <span class="m"><b>Limits:</b> each pixel is about 463 m wide, so this is regional context only. It cannot show ridges, rocks or slopes at EVA scale and must not be used to judge obstacles or safety. The file does not state the height reference, so do not call this "above sea level".</span>`;
  L.popup({maxWidth:270,className:"ter-pop"}).setLatLng(e.latlng).setContent(h).openOn(map);
}
/* END OF FILE terrain */
