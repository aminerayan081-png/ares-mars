"use strict";
/* ARES Phase 5.5: slope calculated from the saved Gale MOLA 463 m grid, shown as a colour map,
   plus a tap-to-read slope popup. Needs Leaflet, the global map, terrain.js (TER, terLoad).
   Adds its own button under the shade buttons. Edits no other file. */
const SL_R=3396190;                                  // sphere radius (m) for grid spacing
const SL_SCALE=3;
/* Our own display bands. They are NOT NASA limits and do not mean "safe" or "unsafe", so the colours are neutral. */
const SL_BANDS=[[5,"#fde725","under 5°"],[10,"#5ec962","5–10°"],[20,"#21908d","10–20°"],[30,"#3b528b","20–30°"],[91,"#440154","over 30°"]];
const SL={on:false,layer:null,arr:null,busy:false,btn:null,legend:null};

/* Slope in degrees per pixel (NaN where data is missing). Horn's method over 3×3 pixels, spacing in metres. No exaggeration. */
function slSlope(m,d){
  const W=m.width,H=m.height,b=m.bounds,out=new Float32Array(W*H),nd=TER_NODATA;
  const dLat=(b.north-b.south)/H*Math.PI/180,dLon=(b.east-b.west)/W*Math.PI/180,dy=dLat*SL_R;
  const cl=(v,mx)=>v<0?0:v>mx?mx:v;
  for(let y=0;y<H;y++){
    const lat=(b.north-(y+0.5)*(b.north-b.south)/H)*Math.PI/180,dx=dLon*SL_R*Math.cos(lat);
    const y0=cl(y-1,H-1),y2=cl(y+1,H-1);
    for(let x=0;x<W;x++){
      const x0=cl(x-1,W-1),x2=cl(x+1,W-1);
      const a=d[y0*W+x0],bb=d[y0*W+x],c=d[y0*W+x2],dd=d[y*W+x0],e=d[y*W+x],f=d[y*W+x2],g=d[y2*W+x0],h=d[y2*W+x],i=d[y2*W+x2];
      if(a===nd||bb===nd||c===nd||dd===nd||e===nd||f===nd||g===nd||h===nd||i===nd){out[y*W+x]=NaN;continue}
      const gx=((c+2*f+i)-(a+2*dd+g))/(8*dx),gn=((a+2*bb+c)-(g+2*h+i))/(8*dy);
      out[y*W+x]=Math.atan(Math.sqrt(gx*gx+gn*gn))*180/Math.PI;
    }
  }
  return out;
}
const slBand=v=>{for(let i=0;i<SL_BANDS.length;i++)if(v<SL_BANDS[i][0])return i;return SL_BANDS.length-1};

function slURL(){
  const m=TER.meta,W=m.width,H=m.height,small=document.createElement("canvas");
  small.width=W;small.height=H;
  const sc=small.getContext("2d"),img=sc.createImageData(W,H);
  const rgb=SL_BANDS.map(b=>[parseInt(b[1].slice(1,3),16),parseInt(b[1].slice(3,5),16),parseInt(b[1].slice(5,7),16)]);
  for(let i=0;i<SL.arr.length;i++){
    const v=SL.arr[i];
    if(Number.isNaN(v)){img.data[i*4+3]=0;continue}
    const c=rgb[slBand(v)];img.data[i*4]=c[0];img.data[i*4+1]=c[1];img.data[i*4+2]=c[2];img.data[i*4+3]=255;
  }
  sc.putImageData(img,0,0);
  const big=document.createElement("canvas");big.width=W*SL_SCALE;big.height=H*SL_SCALE;
  const bc=big.getContext("2d");bc.imageSmoothingEnabled=false;bc.drawImage(small,0,0,big.width,big.height);
  return big.toDataURL("image/png");
}
function slNote(t,ms){if(typeof notify==="function")notify(t,ms||8000)}
async function slToggle(){
  if(SL.busy)return;
  if(SL.on){map.removeLayer(SL.layer);SL.on=false;slUI();map.closePopup();return}
  SL.busy=true;
  try{
    if(!TER.loaded&&!(await terLoad()))return;
    if(!SL.arr)SL.arr=slSlope(TER.meta,TER.data);
    if(!SL.layer){const b=TER.meta.bounds;SL.layer=L.imageOverlay(slURL(),[[b.south,b.west],[b.north,b.east]],{opacity:0.6,interactive:false})}
    SL.layer.addTo(map);SL.on=true;
    if(TER.box&&TER.box.bringToFront)TER.box.bringToFront();
    slNote("Slope map on. Tap inside the dashed rectangle to read the slope there. Turn the Elevation tool off first, or it will show elevation instead.",10000);
  }catch(e){slNote("Could not draw the slope map: "+e.message,10000)}
  finally{SL.busy=false;slUI()}
}
function slUI(){
  if(SL.btn){SL.btn.textContent="∠ Slope: "+(SL.on?"on":"off");SL.btn.classList.toggle("on",SL.on);SL.btn.setAttribute("aria-pressed",String(SL.on))}
  if(SL.legend)SL.legend.style.display=SL.on?"block":"none";
}
function slClick(e){
  if(!SL.on||!SL.arr||TER.on||(typeof S!=="undefined"&&S.placing))return;
  const m=TER.meta,b=m.bounds,lat=e.latlng.lat,lon=e.latlng.lng;
  let h;
  if(lat<b.south||lat>b.north||lon<b.west||lon>b.east)h="<b>No slope data here</b><br>This spot is outside the saved Gale terrain window. ARES shows no number rather than guessing.";
  else{
    const x=Math.min(m.width-1,Math.floor((lon-b.west)/(b.east-b.west)*m.width)),y=Math.min(m.height-1,Math.floor((b.north-lat)/(b.north-b.south)*m.height)),v=SL.arr[y*m.width+x];
    if(Number.isNaN(v))h="<b>No slope here</b><br>The terrain file has empty pixels around this spot.";
    else h=`<b>Slope ≈ ${v.toFixed(1)}°</b> ${typeof bd==="function"?bd("yellow"):"🟡 CALC"}<br><span style="font-size:12px;color:#555">Calculated from the 463 m pixels around this point (a window about 1 km across), so it averages out anything steeper or smaller. Regional context only: it does not show local slopes, rocks or obstacles, and it is not a safety or traversability assessment.</span>`;
  }
  L.popup({maxWidth:260}).setLatLng(e.latlng).setContent(`<div style="font-size:13px;line-height:1.4">${h}</div>`).openOn(map);
}
function slInit(){
  const s=document.createElement("style");
  s.textContent=".sl-leg{display:none;max-width:230px;background:rgba(255,255,255,.92);color:#222;font-size:11px;line-height:1.35;padding:6px 8px;border-radius:4px}.sl-leg i{display:inline-block;width:10px;height:10px;margin-right:3px;vertical-align:-1px;border:1px solid #888}";
  document.head.appendChild(s);
  const Bar=L.Control.extend({options:{position:"topleft"},onAdd(){
    const d=L.DomUtil.create("div","leaflet-bar"),b=L.DomUtil.create("button","ter-btn",d);
    b.type="button";SL.btn=b;L.DomEvent.on(b,"click",slToggle);L.DomEvent.disableClickPropagation(d);return d}});
  map.addControl(new Bar());
  const Leg=L.Control.extend({options:{position:"bottomleft"},onAdd(){
    const d=L.DomUtil.create("div","sl-leg");SL.legend=d;
    d.innerHTML="<b>Slope</b> "+(typeof bd==="function"?bd("yellow"):"🟡 CALC")+" from the MOLA 463 m grid<br>"
      +SL_BANDS.map(b=>`<i style="background:${b[1]}"></i>${b[2]}`).join(" ")
      +"<br>Bands are our own, not NASA limits, and say nothing about safety. Regional context only.";
    L.DomEvent.disableClickPropagation(d);return d}});
  map.addControl(new Leg());
  map.on("click",slClick);
  slUI();
}
/* Start once the map and the other terrain buttons exist (checks twice a second for up to 20 seconds). */
(function(){
  let n=0;
  const t=setInterval(()=>{
    n++;
    if(typeof map!=="undefined"&&map&&typeof L!=="undefined"&&typeof TER!=="undefined"&&TER.btn&&(typeof SH==="undefined"||SH.legend)){clearInterval(t);slInit()}
    else if(n>40){clearInterval(t);if(typeof console!=="undefined")console.warn("ARES slope.js: map or terrain tool not found")}
  },500);
})();
/* END OF FILE slope */
