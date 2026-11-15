"use strict";
/* ARES state: one object (S) that is saved in the browser (localStorage). */
const STORE_KEY="ares";
const TABS=[["nav","1 Surface Navigation"],["sci","2 Science Targets"],["ter","3 Terrain Intel"],["env","4 Environment"],["rte","5 EVA Planner"],["log","6 Field Log"]];
const S={tab:"nav",sel:"home",route:[],vis:[],log:[],smp:[],pos:{},elev:{},speed:1.5,stop:30,placing:null,sheet:"closed",wp:{},nextWp:1};
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
  const wp={};
  if(S.wp&&typeof S.wp==="object")for(const k in S.wp)
    if(/^wp-\d+$/.test(k)&&S.wp[k]&&typeof S.wp[k].name==="string"&&S.pos&&isLL(S.pos[k]))wp[k]={name:S.wp[k].name.slice(0,60)};
  S.wp=wp;
  const ok=id=>ids.includes(id)||!!S.wp[id];
  S.route=Array.isArray(S.route)?S.route.filter(ok):[];
  S.vis=Array.isArray(S.vis)?S.vis.filter(id=>ids.includes(id)):[];
  S.log=Array.isArray(S.log)?S.log.filter(l=>l&&typeof l.x==="string"):[];
  S.smp=Array.isArray(S.smp)?S.smp.filter(s=>s&&isLL(s.ll)):[];
  const pos={},elev={};
  if(S.pos&&typeof S.pos==="object")for(const k in S.pos)if(ok(k)&&isLL(S.pos[k]))pos[k]=S.pos[k];
  if(S.elev&&typeof S.elev==="object")for(const k in S.elev)if(ok(k)&&Number.isFinite(S.elev[k]))elev[k]=S.elev[k];
  S.pos=pos;S.elev=elev;
  for(const k in S.wp)if(!S.route.includes(k)){delete S.wp[k];delete S.pos[k];delete S.elev[k]}
  let mx=0;for(const k in S.wp)mx=Math.max(mx,+k.slice(3));
  S.nextWp=Math.max(Number.isInteger(S.nextWp)&&S.nextWp>0?S.nextWp:1,mx+1);
  if(!(S.speed>0))S.speed=1.5;
  if(!(S.stop>=0))S.stop=30;
  if(!ids.includes(S.sel))S.sel="home";
  if(!TABS.some(t=>t[0]===S.tab))S.tab="nav";
  if(!["closed","half","full"].includes(S.sheet))S.sheet="closed";
}
function save(){try{localStorage.setItem(STORE_KEY,JSON.stringify(S))}catch(e){}}
