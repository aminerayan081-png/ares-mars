"use strict";
/* ARES Phase 5.6: interactive 3D terrain from the saved Gale MOLA 463 m grid.
   Needs Leaflet, the global map, terrain.js (TER, terLoad, terSample) and, for the route line, eva.js (seq, P, hav).
   Adds a "3D view" button under the other terrain buttons by itself. Edits no other file.
   Three.js is loaded only when you open the 3D view, from the same pinned version the terrain test page used. */
const TD_URL="https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.module.min.js";
const TD_R=3396.19;            // km, sphere radius used to turn degrees into kilometres
const TD_STEP=3;               // mesh uses every 3rd pixel (about 1.4 km between points)
const TD_EXS=[1,2,4];          // vertical exaggeration choices
const TD={busy:false,open:false,ready:false,THREE:null,ex:2,showRoute:true,el:null,cv:null,wrap:null,msg:null,btns:{},
  renderer:null,scene:null,camera:null,mesh:null,routeObj:null,grid:null,geo:null,th:0.0,ph:1.0,dist:190,tgt:[0,0,0],dirty:false,btn:null};

/* ---- pure helpers (checked on made-up data) ---- */
function tdGrid(m,d,step){
  const W=m.width,H=m.height,xs=[],ys=[];
  for(let x=0;x<W;x+=step)xs.push(x);if(xs[xs.length-1]!==W-1)xs.push(W-1);
  for(let y=0;y<H;y+=step)ys.push(y);if(ys[ys.length-1]!==H-1)ys.push(H-1);
  const cols=xs.length,rows=ys.length,h=new Float32Array(cols*rows),ok=new Uint8Array(cols*rows);
  let mn=Infinity,mx=-Infinity,bad=0;
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
    const v=d[ys[j]*W+xs[i]],k=j*cols+i;
    if(v===TER_NODATA){bad++}else{ok[k]=1;h[k]=v;if(v<mn)mn=v;if(v>mx)mx=v}
  }
  return{xs,ys,cols,rows,h,ok,mn,mx,bad};
}
/* Two triangles per grid square, both facing up. Squares touching an empty pixel are left out. */
function tdIndex(cols,rows,ok){
  const idx=[];
  for(let j=0;j<rows-1;j++)for(let i=0;i<cols-1;i++){
    const a=j*cols+i,c=a+1,b=a+cols,d=b+1;
    if(!(ok[a]&&ok[b]&&ok[c]&&ok[d]))continue;
    idx.push(a,b,c,c,b,d);
  }
  return new Uint32Array(idx);
}
/* Size of the window in km (flat-map approximation using the centre latitude). */
function tdGeo(m){
  const b=m.bounds,latC=(b.north+b.south)/2*Math.PI/180;
  return{wKm:(b.east-b.west)*Math.PI/180*TD_R*Math.cos(latC),hKm:(b.north-b.south)*Math.PI/180*TD_R};
}
/* East = +X, south = +Z, centred on the window. */
function tdXZ(m,geo,lon,lat){
  const b=m.bounds;
  return[((lon-b.west)/(b.east-b.west)-0.5)*geo.wKm,((b.north-lat)/(b.north-b.south)-0.5)*geo.hKm];
}
function tdCam(theta,phi,dist,t){return[t[0]+dist*Math.sin(phi)*Math.sin(theta),t[1]+dist*Math.cos(phi),t[2]+dist*Math.sin(phi)*Math.cos(theta)]}
const TD_RAMP=[[0,[43,33,24]],[0.35,[122,92,58]],[0.7,[201,165,114]],[1,[242,232,213]]];
function tdRamp(t){
  t=Math.max(0,Math.min(1,t));
  for(let i=1;i<TD_RAMP.length;i++){
    if(t<=TD_RAMP[i][0]){
      const a=TD_RAMP[i-1],b=TD_RAMP[i],u=(t-a[0])/(b[0]-a[0]);
      return[0,1,2].map(k=>(a[1][k]+(b[1][k]-a[1][k])*u)/255);
    }
  }
  return TD_RAMP[TD_RAMP.length-1][1].map(v=>v/255);
}
/* Route as line pieces and stop points, in world units. Parts outside the terrain window are left out. */
function tdRoutePts(m,geo,ex){
  const lines=[],stops=[];
  if(typeof seq!=="function"||typeof P!=="function"||typeof hav!=="function")return{lines,stops};
  const q=seq();let prev=null;
  const at=(lat,lon)=>{const s=terSample(lat,lon);if(!s||s.nodata)return null;const xz=tdXZ(m,geo,lon,lat);return[xz[0],s.interp/1000*ex,xz[1]]};
  q.forEach((id,i)=>{
    const p=P(id);if(!p){prev=null;return}
    const a=at(p[0],p[1]);if(a)stops.push({p:a,home:i===0});
    if(prev){
      const n=Math.max(1,Math.ceil(hav(prev,p)/1000));let last=null;
      for(let k=0;k<=n;k++){
        const t=k/n,pt=at(prev[0]+(p[0]-prev[0])*t,prev[1]+(p[1]-prev[1])*t);
        if(pt&&last)lines.push(last[0],last[1],last[2],pt[0],pt[1],pt[2]);
        last=pt;
      }
    }
    prev=p;
  });
  return{lines,stops};
}

/* ---- screen, scene ---- */
function tdMsg(t){if(TD.msg){TD.msg.textContent=t;TD.msg.style.display=t?"block":"none"}}
function tdShell(){
  if(TD.el)return;
  const s=document.createElement("style");
  s.textContent="#td{position:fixed;inset:0;z-index:100000;background:#10121a;color:#e8e8ee;display:none;flex-direction:column;font:14px/1.4 system-ui,sans-serif;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);box-sizing:border-box}"
   +"#td .bar{display:flex;align-items:center;gap:8px;padding:6px 10px;flex-wrap:wrap}#td .bar b{font-size:16px}"
   +"#td .wrap{position:relative;flex:1;min-height:0}#td canvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;background:#000}"
   +"#td .msg{position:absolute;left:8px;right:8px;top:8px;background:rgba(0,0,0,.7);padding:8px 10px;border-radius:8px;display:none}"
   +"#td .bot{padding:6px 10px 8px;font-size:12px;color:#c8cbe0}#td .row{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px}"
   +"#td button{font:inherit;font-size:14px;min-height:44px;padding:0 12px;border-radius:8px;border:1px solid #ff9d1c;background:#2a2316;color:#ffd9a0}#td button.on{background:#ff9d1c;color:#000;font-weight:700}"
   +"#td .leg{height:10px;border-radius:5px;margin:4px 0}#td summary{cursor:pointer;color:#ffd9a0}";
  document.head.appendChild(s);
  const el=document.createElement("div");el.id="td";
  el.innerHTML='<div class="bar"><b>3D terrain</b><span>'+(typeof bd==="function"?bd("yellow"):"🟡 CALC")+' MOLA 463 m grid</span><span style="flex:1"></span><button id="td-x" type="button">✕ Close</button></div>'
   +'<div class="wrap"><canvas id="td-cv"></canvas><div class="msg" id="td-msg"></div></div>'
   +'<div class="bot"><div class="row"><span style="align-self:center">Height ×</span>'
   +TD_EXS.map(e=>'<button type="button" data-ex="'+e+'">'+e+'</button>').join("")
   +'<button type="button" id="td-rt">Route</button><button type="button" id="td-rs">Reset view</button></div>'
   +'<div class="leg" id="td-leg"></div><div id="td-rng"></div>'
   +'<div>Drag to rotate · pinch (or scroll) to zoom. Regional context only, not a safety assessment.</div>'
   +'<details><summary>Limits</summary><div id="td-lim"></div></details></div>';
  document.body.appendChild(el);
  TD.el=el;TD.cv=el.querySelector("#td-cv");TD.wrap=el.querySelector(".wrap");TD.msg=el.querySelector("#td-msg");
  el.querySelector("#td-x").onclick=tdClose;
  el.querySelectorAll("[data-ex]").forEach(b=>{TD.btns[b.dataset.ex]=b;b.onclick=()=>tdSetEx(+b.dataset.ex)});
  TD.btns.route=el.querySelector("#td-rt");TD.btns.route.onclick=()=>{TD.showRoute=!TD.showRoute;tdRoute();tdUI();tdRender()};
  el.querySelector("#td-rs").onclick=()=>{tdReset();tdRender()};
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&TD.open)tdClose()});
  window.addEventListener("resize",()=>{if(TD.open){tdResize();tdRender()}});
  tdControls();tdUI();
}
function tdUI(){
  Object.keys(TD.btns).forEach(k=>{
    const on=k==="route"?TD.showRoute:(+k===TD.ex);
    TD.btns[k].classList.toggle("on",on);TD.btns[k].setAttribute("aria-pressed",String(on));
  });
}
function tdControls(){
  const cv=TD.cv,ptrs=new Map();let pinch=0;
  cv.addEventListener("pointerdown",e=>{try{cv.setPointerCapture(e.pointerId)}catch(_){ }ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});pinch=0});
  cv.addEventListener("pointermove",e=>{
    const p=ptrs.get(e.pointerId);if(!p)return;
    const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;
    if(ptrs.size===1){TD.th-=dx*0.007;TD.ph=Math.max(0.12,Math.min(1.5,TD.ph-dy*0.007))}
    else if(ptrs.size===2){
      const [a,b]=[...ptrs.values()],cur=Math.hypot(a.x-b.x,a.y-b.y);
      if(pinch>0&&cur>0)TD.dist=Math.max(15,Math.min(700,TD.dist*pinch/cur));
      pinch=cur;
    }
    tdRender();
  });
  const up=e=>{ptrs.delete(e.pointerId);pinch=0};
  cv.addEventListener("pointerup",up);cv.addEventListener("pointercancel",up);
  cv.addEventListener("wheel",e=>{e.preventDefault();TD.dist=Math.max(15,Math.min(700,TD.dist*Math.exp(e.deltaY*0.001)));tdRender()},{passive:false});
}
function tdResize(){
  if(!TD.renderer)return;
  const w=TD.wrap.clientWidth,h=TD.wrap.clientHeight;if(!w||!h)return;
  TD.renderer.setSize(w,h,false);TD.camera.aspect=w/h;TD.camera.updateProjectionMatrix();
}
function tdRender(){
  if(TD.dirty||!TD.ready)return;TD.dirty=true;
  requestAnimationFrame(()=>{
    TD.dirty=false;if(!TD.open||!TD.renderer)return;
    const c=tdCam(TD.th,TD.ph,TD.dist,TD.tgt);
    TD.camera.position.set(c[0],c[1],c[2]);TD.camera.lookAt(TD.tgt[0],TD.tgt[1],TD.tgt[2]);
    TD.renderer.render(TD.scene,TD.camera);
  });
}
function tdReset(){TD.th=0;TD.ph=1.0;TD.dist=Math.max(TD.geo.wKm,TD.geo.hKm)*1.15}
function tdTarget(){const g=TD.grid;TD.tgt=[0,((g.mn+g.mx)/2)/1000*TD.ex,0]}

function tdScene(){
  const T=TD.THREE,m=TER.meta,g=TD.grid=tdGrid(m,TER.data,TD_STEP);TD.geo=tdGeo(m);
  if(!(g.mx>g.mn))throw new Error("the terrain file has no usable heights");
  const n=g.cols*g.rows,pos=new Float32Array(n*3),col=new Float32Array(n*3);
  for(let j=0;j<g.rows;j++)for(let i=0;i<g.cols;i++){
    const k=j*g.cols+i,b=m.bounds;
    const lon=b.west+(g.xs[i]+0.5)/m.width*(b.east-b.west),lat=b.north-(g.ys[j]+0.5)/m.height*(b.north-b.south),xz=tdXZ(m,TD.geo,lon,lat);
    pos[k*3]=xz[0];pos[k*3+2]=xz[1];
    const c=tdRamp((g.h[k]-g.mn)/(g.mx-g.mn));col[k*3]=c[0];col[k*3+1]=c[1];col[k*3+2]=c[2];
  }
  const geom=new T.BufferGeometry();
  geom.setAttribute("position",new T.BufferAttribute(pos,3));geom.setAttribute("color",new T.BufferAttribute(col,3));
  geom.setIndex(new T.BufferAttribute(tdIndex(g.cols,g.rows,g.ok),1));
  TD.mesh=new T.Mesh(geom,new T.MeshLambertMaterial({vertexColors:true,side:T.DoubleSide}));
  TD.scene=new T.Scene();TD.scene.background=new T.Color(0x10121a);TD.scene.add(TD.mesh);
  TD.scene.add(new T.AmbientLight(0xffffff,0.55));
  const sun=new T.DirectionalLight(0xffffff,1.0);sun.position.set(-1,1.1,-1);TD.scene.add(sun);   // light from the north-west
  TD.camera=new T.PerspectiveCamera(50,1,1,3000);
  TD.renderer=new T.WebGLRenderer({canvas:TD.cv,antialias:true});
  TD.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  TD.ready=true;
  tdHeights();tdReset();
  const leg=TD.el.querySelector("#td-leg"),r=TD_RAMP.map(s=>"rgb("+s[1].join(",")+") "+Math.round(s[0]*100)+"%").join(",");
  leg.style.background="linear-gradient(90deg,"+r+")";
  TD.el.querySelector("#td-rng").textContent="Lowest "+Math.round(g.mn)+" m · highest "+Math.round(g.mx)+" m (colour = height in this file)";
  TD.el.querySelector("#td-lim").innerHTML="The mesh uses every "+TD_STEP+"rd pixel of the MOLA 463 m grid (about "+(TD_STEP*0.463).toFixed(1)+" km between points), so it smooths the terrain even more than the data does. Heights are calculated "+(typeof bd==="function"?bd("yellow"):"🟡")+" and stretched by the factor you choose, so slopes look steeper than they are. It cannot show ridges, rocks or obstacles at EVA scale, and it says nothing about whether any route is safe or traversable. The route line joins your stops with straight segments and is drawn on top of the terrain; it is not a planned path. The file does not state its height reference, so do not call these heights \"above sea level\". The window is drawn on a flat grid (a small approximation)."+(g.bad?" "+g.bad+" mesh points had no data and are left as holes.":"");
}
/* Set the height of every mesh point from the current exaggeration. */
function tdHeights(){
  const g=TD.grid,p=TD.mesh.geometry.attributes.position;
  for(let k=0;k<g.cols*g.rows;k++)p.array[k*3+1]=g.ok[k]?g.h[k]/1000*TD.ex:0;
  p.needsUpdate=true;TD.mesh.geometry.computeVertexNormals();tdTarget();
}
function tdRoute(){
  const T=TD.THREE;
  if(TD.routeObj){TD.scene.remove(TD.routeObj);TD.routeObj.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose()});TD.routeObj=null}
  if(!TD.showRoute)return;
  const r=tdRoutePts(TER.meta,TD.geo,TD.ex),grp=new T.Group();
  if(r.lines.length){
    const lg=new T.BufferGeometry();lg.setAttribute("position",new T.BufferAttribute(new Float32Array(r.lines),3));
    const ln=new T.LineSegments(lg,new T.LineBasicMaterial({color:0xff9d1c,depthTest:false}));ln.renderOrder=10;grp.add(ln);
  }
  [[true,0xffffff],[false,0x4fc3f7]].forEach(([home,color])=>{
    const pts=r.stops.filter(s=>s.home===home).flatMap(s=>s.p);
    if(!pts.length)return;
    const pg=new T.BufferGeometry();pg.setAttribute("position",new T.BufferAttribute(new Float32Array(pts),3));
    const po=new T.Points(pg,new T.PointsMaterial({color,size:9,sizeAttenuation:false,depthTest:false}));po.renderOrder=11;grp.add(po);
  });
  TD.routeObj=grp;TD.scene.add(grp);
}
function tdSetEx(e){if(!TD.ready||e===TD.ex)return;TD.ex=e;tdHeights();tdRoute();tdUI();tdRender()}

async function tdOpen(){
  if(TD.busy)return;TD.busy=true;
  try{
    if(!TER.loaded&&!(await terLoad()))return;
    tdShell();TD.el.style.display="flex";TD.open=true;tdUI();
    if(!TD.ready){
      tdMsg("Loading the 3D library (needs an internet connection)…");
      if(!TD.THREE)TD.THREE=await import(TD_URL);
      tdMsg("Building the terrain…");
      tdScene();
    }
    tdMsg("");tdRoute();tdResize();tdRender();
  }catch(e){tdMsg("The 3D view could not start: "+(e&&e.message?e.message:e)+". The map and all other tools still work.")}
  finally{TD.busy=false}
}
function tdClose(){TD.open=false;if(TD.el)TD.el.style.display="none"}

function tdInit(){
  const Bar=L.Control.extend({options:{position:"topleft"},onAdd(){
    const d=L.DomUtil.create("div","leaflet-bar"),b=L.DomUtil.create("button","ter-btn",d);
    b.type="button";b.textContent="🏔 3D view";TD.btn=b;L.DomEvent.on(b,"click",tdOpen);L.DomEvent.disableClickPropagation(d);return d}});
  map.addControl(new Bar());
}
/* Start once the map and the other terrain buttons exist (checks twice a second for up to 20 seconds). */
(function(){
  let n=0;
  const t=setInterval(()=>{
    n++;
    if(typeof map!=="undefined"&&map&&typeof L!=="undefined"&&typeof TER!=="undefined"&&TER.btn&&(typeof SL==="undefined"||SL.legend)){clearInterval(t);tdInit()}
    else if(n>40){clearInterval(t);if(typeof console!=="undefined")console.warn("ARES terrain3d.js: map or terrain tool not found")}
  },500);
})();
/* END OF FILE terrain3d */
