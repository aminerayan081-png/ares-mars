"use strict";
/* ARES Phase 3: transparent target prioritization. Project-defined planning aid, not a NASA ranking.
   Counts yes/no criteria from existing records. No scores are invented. Loads after sources.js. */
function priOf(r){
  const c=r.criteria||{};
  const srcOk=sciArr(r.sourceIds).length>0&&sciArr(r.sourceIds).every(k=>SCI.srcs[k]&&SCI.srcs[k].verified);
  if(!r.criteria||!c.observation||c.observation==="none"||!srcOk||!c.boxworkRelevance)
    return{insufficient:true,why:!srcOk?"a cited source has not been checked by ARES":"no direct observation is recorded"};
  const hasImg=sciArr(r.imageIds).some(i=>SCI.imgById[i]);
  const rows=[
    [c.boxworkRelevance==="direct","Directly relevant to the boxwork objective"],
    [c.observation==="direct-closeup","Direct close-up observation by the rover"],
    [c.identification==="stated","Source states the identification (not only 'may be')"],
    [hasImg,"At least one verified image"],
    [srcOk,"Every cited source checked by ARES"],
    [r.lat!=null&&r.lon!=null&&isLL([r.lat,r.lon]),"Verified published coordinates"]
  ].map(x=>({ok:!!x[0],text:x[1]}));
  const n=rows.filter(x=>x.ok).length;
  return{insufficient:false,rows,n,level:n>=5?"High":n>=3?"Medium":"Lower"};
}
function priBadge(r){
  const p=priOf(r);
  return p.insufficient?'<span class="sci-tag">Priority: insufficient data</span>':`<span class="sci-tag">Priority: ${p.level}</span>`;
}
function priHTML(r){
  const p=priOf(r);
  const method=`<p class="m"><b>Method:</b> ARES counts six yes/no criteria taken from its own records. High = 5 or 6 met, Medium = 3 or 4, Lower = 0 to 2. These thresholds are our own choice. This is a project-defined planning aid ${bd("yellow")}, not an official NASA scientific ranking, and it does not say how scientifically important a target is.</p>`;
  const body=p.insufficient
    ?`<p><b>Insufficient data for prioritization.</b></p><p class="m">Reason: ${esc(p.why)}.</p>`
    :`<p><b>${p.level}</b> priority (${p.n} of 6 criteria met)</p><ul>${p.rows.map(x=>`<li>${x.ok?"✅":"⬜"} ${esc(x.text)}</li>`).join("")}</ul>`;
  return`<details class="sci-d" open><summary>Priority (project planning aid)</summary>${body}${method}</details>`;
}
const _sciCard0=sciCard;
sciCard=function(r){
  const h=_sciCard0(r),i=h.lastIndexOf("</div>");
  return i<0?h:h.slice(0,i)+"<br>"+priBadge(r)+h.slice(i);
};
const _sciDetail0=sciDetail;
sciDetail=function(id){
  const h=_sciDetail0(id),r=SCI.byId[id],i=h.lastIndexOf("</div>");
  return(!r||i<0)?h:h.slice(0,i)+priHTML(r)+h.slice(i);
};
