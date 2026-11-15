"use strict";
/* The Leaflet map: basemaps, grid, markers, route line, messages. */
let map,mk,rl,tileErrs=0;
let addingWp=false;

/* Mars-sized coordinate system, so the scale bar measures Mars kilometres, not Earth kilometres. */
const MARS_CRS=L.extend({},L.CRS.EPSG4326,{R:MARS_R_KM*1000});

const trekLayer=id=>L.tileLayer(`https://trek.nasa.gov/tiles/Mars/EQ/${id}/1.0.0/default/default028mm/{z}/{y}/{x}.jpg`,
  {minZoom:1,maxNativeZoom:7,maxZoom:10,attribution:"NASA/JPL Mars Trek"});
const LAYERS=[
 {name:"Viking colour mosaic (NASA Trek)",credit:"NASA/JPL Mars Trek — Viking MDIM 2.1 colour mosaic, 232 m/pixel",url:"https://trek.nasa.gov/mars/",
  make:()=>trekLayer("Mars_Viking_MDIM21_ClrMosaic_global_232m")},
 {name:"MOLA colour hillshade (NASA Trek)",credit:"NASA/JPL Mars Trek — MOLA colour-shaded relief, 463 m/pixel",url:"https://trek.nasa.gov/mars/",
  make:()=>trekLayer("Mars_MGS_MOLA_ClrShade_merge_global_463m")},
 {name:"USGS Viking MDIM 2.1 (backup)",credit:"USGS Astrogeology / NASA Viking — WMS server (intermittent in our tests)",url:"https://astrogeology.usgs.gov/",
  make:()=>L.tileLayer.wms("https://planetarymaps.usgs.gov/cgi-bin/mapserv?map=/maps/mars/mars_simp_cyl.map",
    {layers:"MDIM21",format:"image/jpeg",version:"1.1.1",attribution:"USGS Astrogeology · NASA Viking"})}
];

let noteTimer=null;
function notify(msg,ms){
  const b=$("#banner");if(!b)return;
  b.textContent=msg;b.hidden=false;
  clearTimeout(noteTimer);noteTimer=setTimeout(()=>{b.hidden=true},ms||7000);
}
function onTileError(){
  tileErrs++;
  if(tileErrs===6)notify("Some map tiles did not load. The orange grid still works. Try another layer from the layer button (top right of the map).",12000);
}

function initMap(){
  map=L.map("map",{crs:MARS_CRS,center:[-5.1,137.6],zoom:7,minZoom:1,maxZoom:10});
  const base={};
  LAYERS.forEach(l=>{const ly=l.make();ly.on("tileerror",onTileError);base[l.name]=ly});
  base[LAYERS[0].name].addTo(map);
  L.control.layers(base,null,{collapsed:true}).addTo(map);
  map.on("baselayerchange",()=>{tileErrs=0});
  L.control.scale({imperial:false}).addTo(map);
  // 1° grid (🟡 drawn by ARES): always visible, even if every tile server fails.
  const grat=L.layerGroup().addTo(map),gs={color:"#ff9d1c",weight:.4,opacity:.35,interactive:false};
  for(let la=-10;la<=0;la++)grat.addLayer(L.polyline([[la,130],[la,145]],gs));
  for(let lo=130;lo<=145;lo++)grat.addLayer(L.polyline([[-10,lo],[0,lo]],gs));
  mk=L.layerGroup().addTo(map);
  rl=L.polyline([],{color:"#ff9d1c",weight:3,dashArray:"8 6"}).addTo(map);
  map.on("mousemove",e=>{$("#co").textContent=fc([e.latlng.lat,e.latlng.lng])});
    map.on("click",e=>{
    if(addingWp){addingWp=false;$("#map").classList.remove("pl");addWaypoint([e.latlng.lat,e.latlng.lng]);return}
    if(!S.placing)return;
    S.pos[S.placing]=[+e.latlng.lat.toFixed(4),+e.latlng.lng.toFixed(4)];
    S.sel=S.placing;S.placing=null;$("#map").classList.remove("pl");
    if(isMobile()&&S.sheet==="closed")S.sheet="half";
    save();render();
  });
}

function drawMap(){
  mk.clearLayers();
  T.forEach(t=>{
    const p=P(t.id);if(!p)return;
    const m=L.marker(p,{draggable:t.type==="science",
      icon:L.divIcon({className:"",iconSize:[16,16],html:`<div class="pin ${S.vis.includes(t.id)?"v":""} ${S.sel===t.id?"sel":""}"></div>`})}).bindTooltip(t.name);
    m.on("click",()=>selectOnMap(t.id));
    m.on("dragend",e=>{const l=e.target.getLatLng();S.pos[t.id]=[+l.lat.toFixed(4),+l.lng.toFixed(4)];save();render()});
    mk.addLayer(m);
  });
  S.smp.forEach(s=>mk.addLayer(L.marker(s.ll,{icon:L.divIcon({className:"",iconSize:[14,14],html:'<div class="pin s"></div>'})}).bindTooltip("Hypothetical sample: "+esc(s.note))));
  rl.setLatLngs(seq().map(P).filter(Boolean));
}
function placeTarget(){
  S.placing=S.sel;$("#map").classList.add("pl");
  if(isMobile()){S.sheet="closed";save();applySheet()}   // close the panel so the whole map can be tapped
  notify("Tap the map to place: "+T_[S.sel].name,9000);
}
