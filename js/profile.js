"use strict";
/* ARES Phase 5.3: elevation profile along the EVA route, read from the saved Gale MOLA 463 m grid.
   Needs eva.js (seq, legs, P), terrain.js (TER, terSample, terLoad) and ui.js (bd, esc, stopName).
   Called from panelRte() in ui.js. Separate from the typed-elevation profile (profileBlock). */
const TP_STEP_M=463;        // about one MOLA pixel
const TP_MAX_SAMPLES=1500;  // keeps long routes light on a phone

/* Sample the route. Returns points {x (km along route), e (metres or null)} and stops {x, name, e}. */
function tpBuild(){
  const q=seq(),L_=legs(),pts=[],stops=[];
  const totalD=L_.reduce((s,l)=>s+(l.d||0),0);
  const step=Math.max(TP_STEP_M,totalD/TP_MAX_SAMPLES);
  const val=ll=>{const s=terSample(ll[0],ll[1]);return(s&&!s.nodata)?s.interp:null};
  let cum=0;
  L_.forEach((l,i)=>{
    const a=P(q[i]),b=P(q[i+1]),n=Math.max(1,Math.ceil(l.d/step));
    for(let k=(i===0?0:1);k<=n;k++){
      const t=k/n,ll=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
      pts.push({x:(cum+l.d*t)/1000,e:val(ll)});
    }
    if(i===0)stops.push({x:0,name:stopName(q[0]),e:val(a)});
    stops.push({x:(cum+l.d)/1000,name:stopName(q[i+1]),e:val(b)});
    cum+=l.d;
  });
  return{pts,stops,km:cum/1000};
}

async function terProfileLoad(){await terLoad();render()}

function terProfileBlock(){
  if(typeof TER==="undefined"||typeof terSample!=="function")return"";
  const head='<h3>MOLA terrain profile</h3>';
  const lim=`<p class="m"><b>Limits:</b> heights come from the saved MOLA 463 m grid, smoothed between pixels ${bd("yellow")}. This is regional context only. It cannot show ridges, rocks or local slopes, and the vertical scale is stretched to fit, so slopes look steeper than they are. The line joins stops with straight segments, not a planned path. The file does not state its height reference, so do not call these heights "above sea level". This profile does not show whether a route is safe or traversable.</p>`;
  if(!S.route.length)return head+'<p class="m">Add at least one stop to the route to see a profile.</p>'+lim;
  if(!TER.loaded)return head+`<p class="m">Reads the saved Gale terrain data (about 260 KB). It is not loaded yet.</p><button onclick="terProfileLoad()">⛰ Load terrain data</button>`+lim;
  if(legs().some(l=>l.miss))return head+'<p class="m">Profile not drawn: at least one stop is not placed on the map yet.</p>'+lim;
  const r=tpBuild(),ok=r.pts.filter(p=>p.e!=null);
  if(!ok.length)return head+'<p class="m">Profile not drawn: no part of this route is inside the saved terrain window (dashed rectangle on the map). ARES shows no numbers rather than guessing.</p>'+lim;
  const pct=Math.round(ok.length/r.pts.length*100);
  const mn=ok.reduce((a,p)=>p.e<a.e?p:a),mx=ok.reduce((a,p)=>p.e>a.e?p:a);
  const W=320,H=150,pl=48,pr=10,pt=10,pb=24,xmax=Math.max(r.km,0.001),span=Math.max(mx.e-mn.e,1);
  const X=v=>(pl+(v/xmax)*(W-pl-pr)).toFixed(1),Y=v=>(pt+(1-(v-mn.e)/span)*(H-pt-pb)).toFixed(1);
  let d="",prev=false;
  r.pts.forEach(p=>{if(p.e==null){prev=false;return}d+=(prev?"L":"M")+X(p.x)+" "+Y(p.e)+" ";prev=true});
  let svg=`<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="MOLA elevation profile">`
   +`<line x1="${pl}" y1="${pt}" x2="${pl}" y2="${H-pb}" stroke="#888"/><line x1="${pl}" y1="${H-pb}" x2="${W-pr}" y2="${H-pb}" stroke="#888"/>`
   +`<text x="${pl-4}" y="${pt+4}" fill="#ccc" font-size="10" text-anchor="end">${Math.round(mx.e)} m</text>`
   +`<text x="${pl-4}" y="${H-pb}" fill="#ccc" font-size="10" text-anchor="end">${Math.round(mn.e)} m</text>`
   +`<text x="${pl}" y="${H-6}" fill="#ccc" font-size="10">0 km</text>`
   +`<text x="${W-pr}" y="${H-6}" fill="#ccc" font-size="10" text-anchor="end">${r.km.toFixed(1)} km</text>`
   +`<path d="${d}" fill="none" stroke="#9ccc65" stroke-width="2"/>`;
  r.stops.forEach(s=>{if(s.e!=null)svg+=`<circle cx="${X(s.x)}" cy="${Y(s.e)}" r="4" fill="#4fc3f7"/>`});
  svg+="</svg>";
  const rows=r.stops.map(s=>`<tr><td>${esc(s.name)}</td><td>${s.e!=null?Math.round(s.e)+" m":'<span class="m">outside terrain window</span>'}</td></tr>`).join("");
  return head+svg
   +`<p class="m">${bd("yellow")} Horizontal axis: straight-line distance along the stops. Blue dots are stops. A gap in the line means that part is outside the saved terrain window.</p>`
   +`<p>Lowest: <b>${Math.round(mn.e)} m</b> at ${mn.x.toFixed(1)} km · Highest: <b>${Math.round(mx.e)} m</b> at ${mx.x.toFixed(1)} km<br><span class="m">About ${pct}% of the route is inside the terrain window.</span></p>`
   +`<table><tr><th>Stop</th><th>MOLA height</th></tr>${rows}</table>`+lim;
}
/* END OF FILE profile */
