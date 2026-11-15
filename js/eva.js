"use strict";
/* Positions, distances and the EVA route. Everything here is a calculation (🟡) or a user assumption (🔵). */
const MARS_R_KM=3389.5;   // Mars mean radius (IAU)
const SOLH=24.66;         // hours in one sol
const P=id=>S.pos[id]||(T_[id]?T_[id].ll:null);
const E=id=>S.elev[id]!=null?S.elev[id]:(T_[id]?T_[id].elev:null);
const isWp=id=>/^wp-\d+$/.test(id);
const stopName=id=>T_[id]?T_[id].name:(S.wp[id]?S.wp[id].name:id);
/* Minutes spent at a stop: the value you typed, else the default (science stops) or 0 (free waypoints). */
const stopMin=id=>S.dur[id]!=null?S.dur[id]:(isWp(id)?0:S.stop);
const rad=x=>x*Math.PI/180;
const fc=ll=>ll?`${Math.abs(ll[0]).toFixed(3)}°${ll[0]<0?"S":"N"}, ${ll[1].toFixed(3)}°E`:"not placed";

/* Great-circle distance in metres (haversine, sphere of Mars' mean radius). */
function hav(a,b){
  const dl=rad(b[0]-a[0]),dn=rad(b[1]-a[1]);
  const h=Math.sin(dl/2)**2+Math.cos(rad(a[0]))*Math.cos(rad(b[0]))*Math.sin(dn/2)**2;
  return 2*MARS_R_KM*Math.asin(Math.sqrt(h))*1000;
}
const seq=()=>["home",...S.route];
function legs(){
  const q=seq(),o=[];
  for(let i=1;i<q.length;i++){
    const a=q[i-1],b=q[i],pa=P(a),pb=P(b);
    if(!pa||!pb){o.push({a,b,miss:1});continue}
    const d=hav(pa,pb),ea=E(a),eb=E(b);
    let sl=null;
    if(ea!=null&&eb!=null&&d>0)sl=Math.atan(Math.abs(eb-ea)/d)*180/Math.PI;
    o.push({a,b,d,dz:(ea!=null&&eb!=null)?eb-ea:null,sl});
  }
  return o;
}
/* Mean gradient of a whole leg. The 10°/20° bands are OUR assumptions, not NASA limits, and say nothing about safety. */
function gradeLabel(s){
  if(s==null)return["no elevation data","m"];
  if(s<10)return["low mean gradient (<10°)",""];
  if(s<20)return["moderate (10–20°)","gr2"];
  return["high (>20°)","gr3"];
}
function routeTotals(){
  const ok=legs().filter(l=>!l.miss);
  const km=ok.reduce((s,l)=>s+l.d,0)/1000;
  const walkH=km/S.speed,stopH=S.route.reduce((s,id)=>s+stopMin(id),0)/60,totH=walkH+stopH;
  const rate=ENV&&ENV.radiation?ENV.radiation.value:0;           // mGy per day (see environment.json)
  return{km,walkH,stopH,totH,doseUGy:rate*totH/SOLH*1000};
}
function addToRoute(){if(!S.route.includes(S.sel))S.route.push(S.sel);S.tab="rte";save();render()}
function moveStop(i,d){const j=i+d;if(j<0||j>=S.route.length)return;[S.route[i],S.route[j]]=[S.route[j],S.route[i]];save();render()}
function removeStop(i){const id=S.route[i];S.route.splice(i,1);delete S.dur[id];dropWp(id);save();render()}
function clearRoute(){S.route.filter(isWp).forEach(dropWp);S.route=[];S.dur={};save();render()}
function dropWp(id){if(isWp(id)){delete S.wp[id];delete S.pos[id];delete S.elev[id]}}
function addWaypoint(ll){
  const id="wp-"+S.nextWp++;
  S.wp[id]={name:"WP"+id.slice(3)};
  S.pos[id]=[+ll[0].toFixed(4),+ll[1].toFixed(4)];
  S.route.push(id);S.tab="rte";
  if(isMobile()&&S.sheet==="closed")S.sheet="half";
  save();render();
}
function renameStop(i,v){
  const id=S.route[i];if(!isWp(id))return;
  S.wp[id].name=String(v).trim().slice(0,60)||"WP"+id.slice(3);
  save();render();
}
function setDur(i,v){
  const id=S.route[i],n=parseFloat(v);
  if(Number.isFinite(n)&&n>=0)S.dur[id]=n;else delete S.dur[id];
  save();render();
}
function setSpeed(v){const n=parseFloat(v);S.speed=n>0?n:1.5;save();render()}
function setStop(v){const n=parseFloat(v);S.stop=Number.isFinite(n)&&n>=0?n:30;save();render()}
function setElev(){const v=parseFloat($("#ei").value);if(Number.isNaN(v))delete S.elev[S.sel];else S.elev[S.sel]=v;save();render()}
/* ---- Saved plans (Stage 4.5) ---- */
function snap(){
  const wp={},pos={},elev={},dur={};
  S.route.forEach(id=>{
    if(isWp(id)){wp[id]={name:S.wp[id].name};pos[id]=S.pos[id].slice();if(S.elev[id]!=null)elev[id]=S.elev[id]}
    if(S.dur[id]!=null)dur[id]=S.dur[id];
  });
  return{route:S.route.slice(),wp,pos,elev,dur,speed:S.speed,stop:S.stop};
}
function savePlan(){
  if(S.plans.length>=10){notify("You can keep up to 10 plans. Delete one first.",6000);return}
  const el=$("#pn"),name=((el&&el.value)||"").trim().slice(0,40)||"Plan "+S.nextPlan;
  const id="plan-"+S.nextPlan++;
  S.plans.push(Object.assign({id,name},snap()));
  S.activePlan=id;save();render();
}
function updatePlan(id){
  const p=S.plans.find(x=>x.id===id);if(!p)return;
  if(!confirm("Overwrite \""+p.name+"\" with the current route?"))return;
  Object.assign(p,snap());S.activePlan=id;save();render();
}
function deletePlan(id){
  const p=S.plans.find(x=>x.id===id);if(!p)return;
  if(!confirm("Delete \""+p.name+"\"?"))return;
  S.plans=S.plans.filter(x=>x.id!==id);
  if(S.activePlan===id)S.activePlan=null;
  save();render();
}
function loadPlan(id){
  const p=S.plans.find(x=>x.id===id);if(!p)return;
  if(!confirm("Load \""+p.name+"\"? This replaces the current route. Save it first if you want to keep it."))return;
  S.route.filter(isWp).forEach(dropWp);
  S.route=p.route.slice();
  S.wp=JSON.parse(JSON.stringify(p.wp));
  Object.assign(S.pos,JSON.parse(JSON.stringify(p.pos)));
  Object.assign(S.elev,p.elev||{});
  S.dur=Object.assign({},p.dur);
  S.speed=p.speed;S.stop=p.stop;S.activePlan=id;
  save();render();
}
/* Totals for a saved plan, computed without changing the current route. */
function planTotals(p){
  const b={route:S.route,wp:S.wp,pos:S.pos,elev:S.elev,dur:S.dur,speed:S.speed,stop:S.stop};
  try{
    S.route=p.route;S.wp=Object.assign({},S.wp,p.wp);S.pos=Object.assign({},S.pos,p.pos);
    S.elev=Object.assign({},S.elev,p.elev||{});S.dur=p.dur;S.speed=p.speed;S.stop=p.stop;
    return Object.assign(routeTotals(),{stops:p.route.length,miss:legs().filter(l=>l.miss).length});
  }finally{Object.assign(S,b)}
}
