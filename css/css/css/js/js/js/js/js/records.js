"use strict";
/* Field log, visited targets, hypothetical samples, objectives, export. */
function objs(){return[
  ["Plan a route with ≥3 science stops",S.route.length>=3],
  ["Visit a boxwork ridge target",S.vis.includes("ridge")],
  ["Visit a hollow target",S.vis.includes("hollow")],
  ["Log ≥1 hypothetical sample",S.smp.length>0],
  ["Record ≥1 field note",S.log.length>0]]}
function toggleVisited(){const i=S.vis.indexOf(S.sel);i<0?S.vis.push(S.sel):S.vis.splice(i,1);save();render()}
function addLog(){const x=$("#ln").value.trim();if(!x)return;S.log.push({t:now(),n:T_[S.sel].name,x});save();render()}
function addSample(){
  const p=P(S.sel);
  if(!p){notify("Place this target on the map first.");return}
  S.smp.push({ll:p,note:T_[S.sel].name});
  S.log.push({t:now(),n:T_[S.sel].name,x:"Hypothetical sample location recorded at "+fc(p)});
  save();render();
}
function exportLog(){
  const s="ARES FIELD LOG (simulated mission; entries are written by the user, not NASA data)\n"+S.log.map(l=>`${l.t} | ${l.n} | ${l.x}`).join("\n");
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([s],{type:"text/plain"}));a.download="ares-log.txt";a.click();
}
