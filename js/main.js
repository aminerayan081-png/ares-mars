"use strict";
/* Start-up: load data, restore saved state, build the map, draw everything. */
function fatal(msg){
  const c=$("#sc");
  if(c)c.innerHTML=`<h3>ARES could not start</h3><p>${esc(msg)}</p><p class="m">Check that every file from the setup list exists in your GitHub repository, then reload.</p>`;
  console.error(msg);
}
(async function start(){
  if(typeof L==="undefined"){fatal("The map library (Leaflet) did not load. Check your internet connection.");return}
  try{await loadData()}catch(e){fatal("Data problem: "+e.message);return}
  try{
    loadState();cleanState(T.map(t=>t.id));
        initMap();render();
    if(typeof loadScience==="function")loadScience();
    if(typeof initTerrain==="function")initTerrain();
  }catch(e){fatal("Start-up error: "+e.message)}
})();
