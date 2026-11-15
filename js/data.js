"use strict";
/* ARES data: loads data/targets.json and data/environment.json. */
let T=[],T_={},SRC={},ENV=null;

async function loadJSON(url){
  const r=await fetch(url,{cache:"no-cache"});
  if(!r.ok)throw new Error(url+" → HTTP "+r.status);
  return r.json();
}
/* Give each target the short field names the rest of the app uses. */
function norm(t){
  if(!t||!/^[A-Za-z0-9_-]+$/.test(t.id||"")||!t.name)throw new Error("targets.json: a target has a missing or invalid id/name");
  return Object.assign({},t,{ll:(t.lat!=null&&t.lon!=null)?[t.lat,t.lon]:null,elev:t.elev_m!=null?t.elev_m:null,cls:t.evidence||"blue"});
}
async function loadData(){
  const [tg,env]=await Promise.all([loadJSON("data/targets.json"),loadJSON("data/environment.json")]);
  if(!Array.isArray(tg.targets)||!tg.targets.some(t=>t.id==="home"))throw new Error("targets.json must contain a target with id \"home\"");
  T=tg.targets.map(norm);T_={};T.forEach(t=>T_[t.id]=t);
  SRC=Object.assign({},tg.sources||{},env.sources||{});
  ENV=env;
}
