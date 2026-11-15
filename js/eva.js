"use strict";
/* Positions, distances and the EVA route. Everything here is a calculation (🟡) or a user assumption (🔵). */
const MARS_R_KM=3389.5;   // Mars mean radius (IAU)
const SOLH=24.66;         // hours in one sol
const P=id=>S.pos[id]||(T_[id]?T_[id].ll:null);
const E=id=>S.elev[id]!=null?S.elev[id]:(T_[id]?T_[id].elev:null);
const isWp=id=>/^wp-\d+$/.test(id);
const stopName=id=>T_[id]?T_[id].name:(S.wp[id]?S.wp[id].name:id);
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
  const walkH=km/S.speed,stopH=S.route.length*S.stop/60,totH=walkH+stopH;
  const rate=ENV&&ENV.radiation?ENV.radiation.value:0;           // mGy per day (see environment.json)
  return{km,walkH,stopH,totH,doseUGy:rate*totH/SOLH*1000};
}
function addToRoute(){if(!S.route.includes(S.sel))S.route.push(S.sel);S.tab="rte";save();render()}
function moveStop(i,d){const j=i+d;if(j<0||j>=S.route.length)return;[S.route[i],S.route[j]]=[S.route[j],S.route[i]];save();render()}
function removeStop(i){S.route.splice(i,1);save();render()}
function clearRoute(){S.route=[];save();render()}
function setSpeed(v){const n=parseFloat(v);S.speed=n>0?n:1.5;save();render()}
function setStop(v){const n=parseFloat(v);S.stop=Number.isFinite(n)&&n>=0?n:30;save();render()}
function setElev(){const v=parseFloat($("#ei").value);if(Number.isNaN(v))delete S.elev[S.sel];else S.elev[S.sel]=v;save();render()}
