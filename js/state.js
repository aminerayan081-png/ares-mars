"use strict";
/* ARES state: one object (S) that is saved in the browser (localStorage). */
const STORE_KEY="ares";
const TABS=[["nav","1 Surface Navigation"],["sci","2 Science Targets"],["ter","3 Terrain Intel"],["env","4 Environment"],["rte","5 EVA Planner"],["log","6 Field Log"]];
const S={tab:"nav",sel:"home",route:[],vis:[],log:[],smp:[],pos:{},elev:{},speed:1.5,stop:30,placing:null};

const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const now=()=>new Date().toISOString().slice(0,16).replace("T"," ")+" UTC";
const isLL=a=>Array.isArray(a)&&a.length===2&&a.every(Number.isFinite);

function loadState(){
  try{const o=JSON.parse(localStorage.getItem(STORE_KEY)||"{}");if(o&&typeof o==="object")Object.assign(S,o)}catch(e){}
  S.placing=null;
}
/* Remove anything in saved data that no longer makes sense (old target ids, bad numbers). */
function cleanState(ids){
  const ok=id=>ids.includes(id);
  S.route=Array.isArray(S.route)?S.route.filter(ok):[];
  S.vis=Array.isArray(S.vis)?S.vis.filter(ok):[];
  S.log=Array.isArray(S.log)?S.log.filter(l=>l&&typeof l.x==="string"):[];
  S.smp=Array.isArray(S.smp)?S.smp.filter(s=>s&&isLL(s.ll)):[];
  const pos={},elev={};
  if(S.pos&&typeof S.pos==="object")for(const k in S.pos)if(ok(k)&&isLL(S.pos[k]))pos[k]=S.pos[k];
  if(S.elev&&typeof S.elev==="object")for(const k in S.elev)if(ok(k)&&Number.isFinite(S.elev[k]))elev[k]=S.elev[k];
  S.pos=pos;S.elev=elev;
  if(!(S.speed>0))S.speed=1.5;
  if(!(S.stop>=0))S.stop=30;
  if(!ok(S.sel))S.sel="home";
  if(!TABS.some(t=>t[0]===S.tab))S.tab="nav";
}
function save(){try{localStorage.setItem(STORE_KEY,JSON.stringify(S))}catch(e){}}
