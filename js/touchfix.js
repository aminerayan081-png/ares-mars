"use strict";
/* ARES touch and popup fix. Edits no other file; remove its <script> line to undo it.
   1. A tap that places a pin or waypoint (or picks a notebook position) no longer also opens a tool popup.
      Cause: map.js handles the click first and clears S.placing / addingWp, then terrain.js (and any tool that
      works the same way) sees "not placing" and opens its white reading popup on top of the new pin.
   2. Tapping anywhere outside a popup closes it first, so tapping a pin, a button or the map works at once.
      (Leaflet only closes popups on map clicks, and a pin tap does not reach the map.)
   3. Popup close buttons get a 44 px touch area, and popups cannot be wider than the screen.
   4. The notification banner never blocks taps, and a map tap hides it.
   5. On narrow screens the top-left map buttons wrap into extra columns instead of running off the map. */
const TFIX={skip:false,added:false};

function tfixCss(){
  if(document.getElementById("tfix-css"))return;
  const s=document.createElement("style");s.id="tfix-css";
  s.textContent=".leaflet-container a.leaflet-popup-close-button{width:44px;height:44px;line-height:44px;font-size:28px;padding:0;text-align:center;top:0;right:0}"
   +".leaflet-popup-content-wrapper{max-width:88vw}.leaflet-popup-content{margin:12px 40px 12px 14px}"
   +"#banner{pointer-events:none}"
   +"@media (max-width:800px){"
   +".leaflet-top.leaflet-left{display:flex;flex-direction:column;flex-wrap:wrap;align-content:flex-start;max-height:calc(100% - 4px);box-sizing:border-box}"
   +".leaflet-top.leaflet-left .leaflet-bar .ter-btn,.leaflet-top.leaflet-left .leaflet-bar .tinfo-btn{min-height:38px;padding:0 8px;font-size:13px}}";
  document.head.appendChild(s);
}

function tfixInit(){
  if(TFIX.added)return true;
  if(typeof map==="undefined"||!map||typeof map.on!=="function"||!map.getContainer)return false;
  tfixCss();

  /* 1. Was this tap used to place something? Decided before any click handler runs. */
  map.on("preclick",()=>{
    TFIX.skip=!!((typeof S!=="undefined"&&S.placing)||(typeof addingWp!=="undefined"&&addingWp)||(typeof FN!=="undefined"&&FN.pick));
    setTimeout(()=>{TFIX.skip=false},0);
  });
  map.on("popupopen",e=>{if(TFIX.skip){TFIX.skip=false;map.closePopup(e.popup)}});

  /* 2 and 4. Any tap on the map area outside a popup or a map button: close the popup, tooltips and the banner. */
  map.getContainer().addEventListener("click",e=>{
    const t=e.target;
    if(t&&t.closest&&(t.closest(".leaflet-popup")||t.closest(".leaflet-control")))return;
    map.closePopup();
    if(typeof mk!=="undefined"&&mk&&mk.eachLayer)mk.eachLayer(l=>{if(l.closeTooltip)l.closeTooltip()});
    const b=document.getElementById("banner");if(b)b.hidden=true;
  },true);

  TFIX.added=true;return true;
}
(function(){
  if(tfixInit())return;
  let n=0;
  const t=setInterval(()=>{if(tfixInit()||++n>100)clearInterval(t)},200);
})();
/* END OF FILE touchfix */
