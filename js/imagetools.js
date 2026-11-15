"use strict";
/* ARES Phase 3: image comparison + user annotations. Loads after imagelab.js. */
const CMP={list:null,loading:false,failed:false};
const ANN={on:false,key:"ares-annot"};

/* ---------- Comparison ---------- */
function cmpLoad(){
  if(CMP.list||CMP.loading||CMP.failed)return;
  CMP.loading=true;
  loadJSON("data/comparisons.json").then(j=>{
    CMP.list=sciArr(j&&j.comparisons).filter(c=>c&&SCI_ID.test(c.id||"")&&SCI.imgById[c.leftId]&&SCI.imgById[c.rightId]);
  }).catch(e=>{CMP.failed=true;console.warn("ARES comparisons:",e.message)}).finally(()=>{
    CMP.loading=false;
    if(S.tab==="sci"&&SCIUI.view==="images"&&!$("#lab-view")&&!$("#cmp-view"))renderSide();
  });
}
function cmpListHTML(){
  cmpLoad();
  let b;
  if(CMP.failed)b='<p class="m">⚠ Comparison data could not be loaded.</p>';
  else if(!CMP.list)b='<p class="m">Loading comparisons…</p>';
  else if(!CMP.list.length)b='<p class="m">No comparisons available.</p>';
  else b=CMP.list.map(c=>`<div class="sci-card" role="button" tabindex="0" onclick="cmpOpen('${c.id}')" onkeydown="if(event.key==='Enter')cmpOpen('${c.id}')"><b>${esc(c.title||c.id)}</b><br><span class="m">${esc(c.leftId)} vs ${esc(c.rightId)}</span></div>`).join("");
  return`<div class="sci"><h3>Compare images</h3><p class="m">Side by side only. Each comparison explains what the images do and do not show.</p>${b}</div>`;
}
function cmpCalc(a,b){
  const out=[];
  if(Number.isFinite(+a.sol)&&Number.isFinite(+b.sol))out.push(Math.abs(b.sol-a.sol)+" sols between observations");
  const da=Date.parse(a.observed),db=Date.parse(b.observed);
  if(Number.isFinite(da)&&Number.isFinite(db))out.push(Math.round(Math.abs(db-da)/864e5)+" days between observations");
  return out;
}
function cmpPane(im,label){
  const u=labSafe(im.viewUrl)||labSafe(im.thumbUrl);
  return`<div class="cmp-pane"><b>${label}: ${esc(im.title)}</b><br><span class="m">${esc(im.catalogId||im.id)} · ${esc(im.instrument||"instrument unknown")} · observed ${im.observed?esc(im.observed):"date unavailable"}${im.sol?" (sol "+esc(im.sol)+")":""}</span>
  ${u?`<img loading="lazy" src="${esc(u)}" alt="${esc(im.title)}" onerror="this.replaceWith(document.createTextNode('Image could not be loaded.'))">`:'<p class="m">No image link.</p>'}
  <button onclick="labOpen('${im.id}')">🔍 Inspect</button> <span class="b green">🟢 REAL</span></div>`;
}
function cmpOpen(id){
  const c=(CMP.list||[]).find(x=>x.id===id);if(!c)return;
  cmpClose();
  const a=SCI.imgById[c.leftId],b=SCI.imgById[c.rightId],calc=cmpCalc(a,b);
  const el=document.createElement("div");
  el.id="cmp-view";el.setAttribute("role","dialog");el.setAttribute("aria-label","Image comparison");
  el.innerHTML=`<div class="lab-top"><b class="lab-title">${esc(c.title||c.id)}</b><button onclick="cmpClose()" aria-label="Close comparison">✕</button></div>
  <div class="cmp-body">
   <p><span class="sci-tag">ARES explanation, not a NASA statement</span></p>
   <p><b>What this shows:</b> ${esc(c.shows||"")}</p>
   <p><b>What this does not show:</b> ${esc(c.notSupported||"")}</p>
   ${calc.length?`<p><span class="b yellow">🟡 CALC</span> ${calc.map(esc).join(" · ")}<br><span class="m">Method: difference between the sol numbers and observation dates in the image records.</span></p>`:""}
   <div class="cmp-grid">${cmpPane(a,"Left")}${cmpPane(b,"Right")}</div>
  </div>`;
  document.body.appendChild(el);document.body.classList.add("lab-open");
}
function cmpClose(){const el=$("#cmp-view");if(el)el.remove();if(!$("#lab-view"))document.body.classList.remove("lab-open")}

/* Add the compare section under the image gallery. */
const _labList0=labList;
labList=function(){return _labList0()+cmpListHTML()};

/* ---------- Annotations (stored in this browser only) ---------- */
function annLoad(){try{const o=JSON.parse(localStorage.getItem(ANN.key)||"{}");return(o&&typeof o==="object"&&!Array.isArray(o))?o:{}}catch(e){return{}}}
function annSaveAll(o){try{localStorage.setItem(ANN.key,JSON.stringify(o));return true}catch(e){return false}}
function annGet(id){
  const o=annLoad();
  return Array.isArray(o[id])?o[id].filter(a=>a&&/^[a-z0-9]+$/.test(a.id||"")&&Number.isFinite(a.x)&&Number.isFinite(a.y)&&typeof a.note==="string"):[];
}
function annToggle(){
  ANN.on=!ANN.on;
  const b=$("#ann-btn"),st=$("#lab-stage");
  if(b)b.textContent="✏ Annotate: "+(ANN.on?"on":"off");
  if(st)st.classList.toggle("ann-on",ANN.on);
}
function annClick(e){
  if(!ANN.on||!LAB.id)return;
  const img=$("#lab-img");if(!img||img.hidden)return;
  const r=img.getBoundingClientRect();if(!r.width||!r.height)return;
  const x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;
  if(x<0||x>1||y<0||y>1)return;
  const list=annGet(LAB.id);
  if(list.length>=30){alert("Limit reached: 30 annotations per image. Delete one first.");return}
  const note=prompt("Your note (max 140 characters).\nThis is your own observation, not a NASA interpretation.");
  if(note===null)return;
  const t=note.trim().slice(0,140);if(!t)return;
  list.push({id:Date.now().toString(36)+Math.floor(Math.random()*1296).toString(36),x:+x.toFixed(4),y:+y.toFixed(4),note:t,t:now()});
  const o=annLoad();o[LAB.id]=list;
  if(!annSaveAll(o))alert("Could not save the annotation in this browser.");
  annDraw();
}
function annDel(aid){
  if(!LAB.id)return;
  const o=annLoad();o[LAB.id]=annGet(LAB.id).filter(a=>a.id!==aid);
  annSaveAll(o);annDraw();
}
function annDraw(){
  const id=LAB.id;if(!id)return;
  const st=$("#lab-stage"),box=$("#ann-box"),list=annGet(id);
  if(st){
    st.querySelectorAll(".ann-pin").forEach(n=>n.remove());
    list.forEach((a,i)=>{const p=document.createElement("span");p.className="ann-pin";p.style.left=(a.x*100)+"%";p.style.top=(a.y*100)+"%";p.textContent=String(i+1);st.appendChild(p)});
  }
  if(box)box.innerHTML=`<div class="lab-row"><b>Your annotations</b> ${bd("blue")}<br><span class="m">Made by you in this browser only. Not NASA interpretations, and not evidence that any feature or mineral is present.</span></div>`+
    (list.length?list.map((a,i)=>`<div class="lab-row">${i+1}. ${esc(a.note)} <button onclick="annDel('${a.id}')" aria-label="Delete annotation ${i+1}">Delete</button></div>`).join(""):'<p class="m">None yet. Turn on Annotate, then tap the image.</p>');
}

/* Extend the viewer: wrap the image in a stage so pins stay in place when zooming. */
const _labOpen0=labOpen;
labOpen=function(id){
  _labOpen0(id);
  ANN.on=false;
  const el=$("#lab-view"),img=$("#lab-img");if(!el)return;
  const meta=el.querySelector(".lab-meta"),tools=el.querySelector(".lab-tools");
  if(meta)meta.insertAdjacentHTML("beforeend",'<div id="ann-box"></div>');
  if(img){
    const st=document.createElement("div");st.id="lab-stage";
    img.parentNode.insertBefore(st,img);st.appendChild(img);
    st.addEventListener("click",annClick);
    if(tools)tools.insertAdjacentHTML("beforeend",'<button id="ann-btn" onclick="annToggle()">✏ Annotate: off</button>');
  }
  labApplyZoom();annDraw();
};
labApplyZoom=function(){
  const st=$("#lab-stage"),img=$("#lab-img"),z=$("#lab-z");
  if(st)st.style.width=(LAB.zoom*100)+"%";
  if(img)img.style.width="100%";
  if(z)z.textContent=LAB.zoom===1?"Fit":"×"+LAB.zoom;
};
