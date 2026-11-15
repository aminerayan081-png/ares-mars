const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const ALL=[];let THREE_RES=null,busy=false;
const badge=s=>`<span class="b ${s}">${s}</span>`;
function cardHTML(R){
  return`<div class="card"><b>${esc(R.ep.name)}</b> ${badge(R.verdict)}<br><span class="m">${esc(R.ep.note)}</span><div class="url">${esc(R.ep.url||R.ep.base)}</div>
  ${R.checks.map(c=>`<div class="row">${badge(c.status)} <b>${esc(c.label)}</b><br><span class="m">${esc(c.text)}</span></div>`).join("")}
  ${R.details?`<div class="row m"><b>File details:</b> ${esc(R.details)}</div>`:""}<div class="m">Downloaded about ${fmtB(R.bytes)} in ${R.reqs} request(s).</div></div>`;
}
function setStatus(t){$("#status").textContent=t}
function deviceInfo(){
  const c=navigator.connection||{},d=[
   "Browser: "+navigator.userAgent,"Screen: "+screen.width+"x"+screen.height+", pixel ratio "+devicePixelRatio,
   "Network type: "+(c.effectiveType||"unknown")+", data saver: "+(c.saveData?"on":"off"),"Memory (approx GB): "+(navigator.deviceMemory||"unknown"),
   "CPU cores: "+(navigator.hardwareConcurrency||"unknown"),"Can decompress files (DecompressionStream): "+(typeof DecompressionStream!=="undefined"),
   "64-bit numbers (BigInt64): "+(typeof BigInt64Array!=="undefined")];
  $("#device").innerHTML=d.map(esc).join("<br>");return d;
}
async function runData(){
  $("#eps").innerHTML="";ALL.length=0;
  for(const ep of EPS){
    setStatus("Testing "+ep.name+" …");
    let R;try{R=ep.kind==="hips"?await testHips(ep):await testTiff(ep)}
    catch(e){R={ep,checks:[{label:"Test crashed",status:"FAIL",text:e.message}],bytes:0,reqs:0,details:"",verdict:"FAIL"}}
    ALL.push(R);$("#eps").insertAdjacentHTML("beforeend",cardHTML(R));
  }
}
/* ---- 3D test: real WebGL render, rotation and touch controls ---- */
async function runThree(){
  const out=[],add=(l,s,t)=>out.push({label:l,status:s,text:t}),box=$("#three"),cv=$("#cv");
  box.textContent="Testing …";
  try{
    const cvt=document.createElement("canvas"),gl=cvt.getContext("webgl2")||cvt.getContext("webgl");
    if(!gl){add("WebGL","FAIL","This browser cannot do 3D graphics (WebGL).");THREE_RES={checks:out};return showThree(out)}
    const dbg=gl.getExtension("WEBGL_debug_renderer_info");
    add("WebGL",gl instanceof WebGL2RenderingContext?"PASS":"PARTIAL","Available ("+(gl instanceof WebGL2RenderingContext?"WebGL 2":"WebGL 1")+"). Graphics chip: "+(dbg?gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL):"hidden by the browser")+".");
    const t0=performance.now();let THREE,OC;
    try{THREE=await import("three");add("Load Three.js 0.186.0","PASS","Loaded in "+Math.round(performance.now()-t0)+" ms. Reports revision r"+THREE.REVISION+".")}
    catch(e){add("Load Three.js 0.186.0","FAIL","Could not load. Version 0.186.0 may not exist or the CDN was unreachable. "+e.message);
      try{const j=await (await fetch("https://data.jsdelivr.com/v1/package/resolve/npm/three@latest")).json();add("Latest version (info)","INFO","jsDelivr reports the latest Three.js is "+j.version+".")}catch(e2){}
      return showThree(out)}
    try{OC=(await import("three/addons/controls/OrbitControls.js")).OrbitControls;add("Touch controls (OrbitControls)","PASS","Loaded.")}
    catch(e){add("Touch controls (OrbitControls)","FAIL",e.message)}
    cv.hidden=false;const w=cv.clientWidth||320,h=220;
    const r=new THREE.WebGLRenderer({canvas:cv,antialias:false});r.setPixelRatio(Math.min(devicePixelRatio,2));r.setSize(w,h,false);
    const sc=new THREE.Scene();sc.background=new THREE.Color(0x101018);
    const cam=new THREE.PerspectiveCamera(50,w/h,0.1,100);cam.position.set(0,7,9);cam.lookAt(0,0,0);
    const geo=new THREE.PlaneGeometry(10,10,127,127);geo.rotateX(-Math.PI/2);const p=geo.attributes.position;
    for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i);p.setY(i,Math.sin(x*0.9)*0.5+Math.cos(z*0.7)*0.4)}
    geo.computeVertexNormals();
    const mesh=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:0xb86b3c,flatShading:true}));sc.add(mesh);
    sc.add(new THREE.HemisphereLight(0xffffff,0x332211,1.1));const dl=new THREE.DirectionalLight(0xffffff,1.6);dl.position.set(5,8,3);sc.add(dl);
    r.render(sc,cam);
    const px=new Uint8Array(4);r.getContext().readPixels(Math.floor(r.domElement.width/2),Math.floor(r.domElement.height/2),1,1,r.getContext().RGBA,r.getContext().UNSIGNED_BYTE,px);
    add("Draws a terrain mesh",(px[0]+px[1]+px[2])>30?"PASS":"FAIL",(px[0]+px[1]+px[2])>30?"A 128 x 128 grid (about 32,000 triangles) was drawn; the centre pixel is lit terrain colour.":"The canvas centre stayed black, so nothing visible was drawn.");
    let frames=0;const ts=performance.now();
    await new Promise(res=>{const tick=()=>{mesh.rotation.y+=0.03;r.render(sc,cam);frames++;performance.now()-ts<2500?requestAnimationFrame(tick):res()};requestAnimationFrame(tick)});
    const ms=(performance.now()-ts)/frames;
    add("Rotation speed",ms<25?"PASS":ms<50?"PARTIAL":"FAIL",frames+" frames in 2.5 s, "+ms.toFixed(1)+" ms per frame ("+Math.round(1000/ms)+" frames per second).");
    if(OC){const c=new OC(cam,cv);c.enableDamping=false;c.addEventListener("change",()=>r.render(sc,cam));
      add("Try it yourself","INFO","Drag the picture above with one finger to rotate and pinch to zoom. Then tell me whether it felt smooth.")}
  }catch(e){add("3D test crashed","FAIL",e.message)}
  THREE_RES={checks:out};showThree(out);
}
function showThree(o){$("#three").innerHTML=o.map(c=>`<div class="row">${badge(c.status)} <b>${esc(c.label)}</b><br><span class="m">${esc(c.text)}</span></div>`).join("")}
function buildReport(dev){
  const L=["ARES TERRAIN DATA TEST REPORT","Date: "+new Date().toISOString(),"",...dev,"","SUMMARY"];
  ALL.forEach(R=>L.push(R.verdict.padEnd(8)+R.ep.name));
  if(THREE_RES)L.push((THREE_RES.checks.some(c=>c.status==="FAIL")?"FAIL":"OK").padEnd(8)+"3D library (Three.js)");
  ALL.forEach(R=>{L.push("","== "+R.ep.name+" ==","Verdict: "+R.verdict);R.checks.forEach(c=>L.push("["+c.status+"] "+c.label+": "+c.text));if(R.details)L.push("Details: "+R.details);L.push("Downloaded: "+fmtB(R.bytes)+" in "+R.reqs+" request(s)")});
  if(THREE_RES){L.push("","== 3D library ==");THREE_RES.checks.forEach(c=>L.push("["+c.status+"] "+c.label+": "+c.text))}
  $("#report").value=L.join("\n");
  $("#summary").innerHTML=ALL.map(R=>`${badge(R.verdict)} ${esc(R.ep.name)}`).join("<br>")+(THREE_RES?`<br>${badge(THREE_RES.checks.some(c=>c.status==="FAIL")?"FAIL":"PASS")} 3D library (Three.js)`:"");
}
async function run(what){
  if(busy)return;busy=true;document.querySelectorAll("button").forEach(b=>b.disabled=true);
  const dev=deviceInfo();
  try{if(what!=="three")await runData();if(what!=="data")await runThree();buildReport(dev);setStatus("Finished. Scroll down and tap Copy report.")}
  catch(e){setStatus("The test page hit an error: "+e.message)}
  busy=false;document.querySelectorAll("button").forEach(b=>b.disabled=false);
}
$("#runAll").onclick=()=>run("all");$("#runThree").onclick=()=>run("three");$("#runData").onclick=()=>run("data");
$("#copy").onclick=async()=>{const t=$("#report");t.select();try{await navigator.clipboard.writeText(t.value);setStatus("Report copied.")}catch(e){document.execCommand("copy");setStatus("Report selected. Copy it manually if needed.")}};
deviceInfo();
/* END OF FILE terrain-ui */
