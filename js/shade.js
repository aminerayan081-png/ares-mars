"use strict";
/* ARES Phase 5.4: shaded relief (hillshade) and elevation contours, both calculated from the saved
   Gale MOLA 463 m grid (data/terrain/gale-mola463.*). Needs Leaflet, the global map, and terrain.js (TER, terLoad).
   Adds a small control under the Elevation button by itself. Edits no other file. */
const SH_R=3396190;           // sphere radius (m) used to turn grid spacing into metres
const SH_ZF=2;                // vertical exaggeration so the shading is visible (shown to the user)
const SH_AZ=315,SH_ALT=45;    // light from the north-west, 45 degrees above the horizon
const SH_INT=500,SH_IDX=1000; // contour interval and thicker "index" contour interval (m)
const SH_SCALE=3;             // overlay image is 3 times the grid size
const SH={on:{shade:false,contour:false},layers:{},busy:false,btns:{},legend:null};

/* Shade value 0..1 per pixel (NaN where data is missing). Horn's method, grid spacing converted to metres. */
function shHillshade(m,d,az,alt,zf){
  const W=m.width,H=m.height,b=m.bounds,out=new Float32Array(W*H),nd=TER_NODATA;
  const dLat=(b.north-b.south)/H*Math.PI/180,dLon=(b.east-b.west)/W*Math.PI/180,dy=dLat*SH_R;
  const A=az*Math.PI/180,Z=alt*Math.PI/180;
  const lx=Math.sin(A)*Math.cos(Z),ly=Math.cos(A)*Math.cos(Z),lz=Math.sin(Z);
  const cl=(v,mx)=>v<0?0:v>mx?mx:v;
  for(let y=0;y<H;y++){
    const lat=(b.north-(y+0.5)*(b.north-b.south)/H)*Math.PI/180,dx=dLon*SH_R*Math.cos(lat);
    const y0=cl(y-1,H-1),y2=cl(y+1,H-1);
    for(let x=0;x<W;x++){
      const x0=cl(x-1,W-1),x2=cl(x+1,W-1);
      const a=d[y0*W+x0],bb=d[y0*W+x],c=d[y0*W+x2],dd=d[y*W+x0],e=d[y*W+x],f=d[y*W+x2],g=d[y2*W+x0],h=d[y2*W+x],i=d[y2*W+x2];
      if(a===nd||bb===nd||c===nd||dd===nd||e===nd||f===nd||g===nd||h===nd||i===nd){out[y*W+x]=NaN;continue}
      const gx=((c+2*f+i)-(a+2*dd+g))/(8*dx)*zf;      // height change per metre going east
      const gn=((a+2*bb+c)-(g+2*h+i))/(8*dy)*zf;      // height change per metre going north
      const s=(-gx*lx-gn*ly+lz)/Math.sqrt(gx*gx+gn*gn+1);
      out[y*W+x]=s<0?0:s;
    }
  }
  return out;
}

/* Contour line segments by marching squares. Each segment: [x1,y1,x2,y2,level] in grid units (pixel centres at +0.5). */
function shContours(m,d,step){
  const W=m.width,H=m.height,segs=[],nd=TER_NODATA;
  for(let y=0;y<H-1;y++)for(let x=0;x<W-1;x++){
    const v00=d[y*W+x],v10=d[y*W+x+1],v01=d[(y+1)*W+x],v11=d[(y+1)*W+x+1];
    if(v00===nd||v10===nd||v01===nd||v11===nd)continue;
    const lo=Math.min(v00,v10,v01,v11),hi=Math.max(v00,v10,v01,v11);
    for(let L=Math.ceil(lo/step)*step;L<=hi;L+=step){
      const k=(v00>=L?1:0)|(v10>=L?2:0)|(v11>=L?4:0)|(v01>=L?8:0);
      if(k===0||k===15)continue;
      const T=()=>[x+(L-v00)/(v10-v00),y],R=()=>[x+1,y+(L-v10)/(v11-v10)],B=()=>[x+(L-v01)/(v11-v01),y+1],Lf=()=>[x,y+(L-v00)/(v01-v00)];
      const add=(p,q)=>segs.push([p[0],p[1],q[0],q[1],L]);
      const mid=(v00+v10+v01+v11)/4>=L;
      switch(k){
        case 1:case 14:add(Lf(),T());break;
        case 2:case 13:add(T(),R());break;
        case 3:case 12:add(Lf(),R());break;
        case 4:case 11:add(R(),B());break;
        case 6:case 9:add(T(),B());break;
        case 7:case 8:add(Lf(),B());break;
        case 5:if(mid){add(T(),R());add(Lf(),B())}else{add(Lf(),T());add(R(),B())}break;
        case 10:if(mid){add(Lf(),T());add(R(),B())}else{add(T(),R());add(Lf(),B())}break;
      }
    }
  }
  return segs;
}

function shCanvas(w,h){const c=document.createElement("canvas");c.width=w;c.height=h;return c}
function shShadeURL(){
  const m=TER.meta,W=m.width,H=m.height,s=shHillshade(m,TER.data,SH_AZ,SH_ALT,SH_ZF);
  const small=shCanvas(W,H),sc=small.getContext("2d"),img=sc.createImageData(W,H);
  for(let i=0;i<s.length;i++){const v=s[i];img.data[i*4]=img.data[i*4+1]=img.data[i*4+2]=Number.isNaN(v)?0:Math.round(255*v);img.data[i*4+3]=Number.isNaN(v)?0:255}
  sc.putImageData(img,0,0);
  const big=shCanvas(W*SH_SCALE,H*SH_SCALE),bc=big.getContext("2d");
  bc.imageSmoothingEnabled=true;bc.drawImage(small,0,0,big.width,big.height);
  return big.toDataURL("image/png");
}
function shContourURL(){
  const m=TER.meta,segs=shContours(m,TER.data,SH_INT),big=shCanvas(m.width*SH_SCALE,m.height*SH_SCALE),c=big.getContext("2d");
  const P_=v=>(v+0.5)*SH_SCALE;
  [[false,1,0.75],[true,2.2,0.95]].forEach(([idx,w,a])=>{
    c.beginPath();
    segs.forEach(s=>{if((s[4]%SH_IDX===0)===idx){c.moveTo(P_(s[0]),P_(s[1]));c.lineTo(P_(s[2]),P_(s[3]))}});
    c.strokeStyle="rgba(139,233,253,"+a+")";c.lineWidth=w;c.stroke();
  });
  return big.toDataURL("image/png");
}

function shMake(kind){
  const b=TER.meta.bounds,url=kind==="shade"?shShadeURL():shContourURL();
  return L.imageOverlay(url,[[b.south,b.west],[b.north,b.east]],{opacity:kind==="shade"?0.55:1,interactive:false});
}
function shNote(t,ms){if(typeof notify==="function")notify(t,ms||8000)}
async function shToggle(kind){
  if(SH.busy)return;
  if(SH.on[kind]){map.removeLayer(SH.layers[kind]);SH.on[kind]=false;shUI();return}
  SH.busy=true;
  try{
    if(!TER.loaded&&!(await terLoad()))return;
    if(!SH.layers[kind])SH.layers[kind]=shMake(kind);
    SH.layers[kind].addTo(map);SH.on[kind]=true;
    if(TER.box&&TER.box.bringToFront)TER.box.bringToFront();
  }catch(e){shNote("Could not draw this layer: "+e.message,10000)}
  finally{SH.busy=false;shUI()}
}
function shUI(){
  const lab={shade:"◐ Shaded relief",contour:"〰 Contours"};
  Object.keys(lab).forEach(k=>{const b=SH.btns[k];if(!b)return;b.textContent=lab[k]+": "+(SH.on[k]?"on":"off");b.classList.toggle("on",SH.on[k]);b.setAttribute("aria-pressed",String(SH.on[k]))});
  if(SH.legend)SH.legend.style.display=(SH.on.shade||SH.on.contour)?"block":"none";
}
function shInit(){
  const s=document.createElement("style");
  s.textContent=".sh-bar button{display:block;width:100%;text-align:left}.sh-leg{display:none;max-width:230px;background:rgba(255,255,255,.92);color:#222;font-size:11px;line-height:1.35;padding:6px 8px;border-radius:4px}";
  document.head.appendChild(s);
  const Bar=L.Control.extend({options:{position:"topleft"},onAdd(){
    const d=L.DomUtil.create("div","leaflet-bar sh-bar");
    [["shade"],["contour"]].forEach(([k])=>{const b=L.DomUtil.create("button","ter-btn",d);b.type="button";SH.btns[k]=b;L.DomEvent.on(b,"click",()=>shToggle(k))});
    L.DomEvent.disableClickPropagation(d);return d}});
  map.addControl(new Bar());
  const Leg=L.Control.extend({options:{position:"bottomleft"},onAdd(){
    const d=L.DomUtil.create("div","sh-leg");SH.legend=d;
    d.innerHTML="<b>Terrain overlays</b> 🟡 CALC from the MOLA 463 m grid. Shading: light from the NW, height exaggerated ×"+SH_ZF+". Contours every "+SH_INT+" m (thick every "+SH_IDX+" m). Regional context only: too coarse for ridges, rocks or local slopes, and not a safety assessment.";
    L.DomEvent.disableClickPropagation(d);return d}});
  map.addControl(new Leg());
  shUI();
}
/* Start once the map and the Elevation button exist (checks twice a second for up to 20 seconds). */
(function(){
  let n=0;
  const t=setInterval(()=>{
    n++;
    if(typeof map!=="undefined"&&map&&typeof L!=="undefined"&&typeof TER!=="undefined"&&TER.btn){clearInterval(t);shInit()}
    else if(n>40){clearInterval(t);if(typeof console!=="undefined")console.warn("ARES shade.js: map or terrain tool not found")}
  },500);
})();
/* END OF FILE shade */
