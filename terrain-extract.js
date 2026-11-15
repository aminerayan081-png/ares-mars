"use strict";
/* ARES terrain extractor: reads ONLY a small Gale Crater window from the MOLA 463 m file and saves it as a tiny file.
   Needs terrain-logic1.js loaded first. Changes nothing in ARES. */
const SRC_URL="https://asc-pds-services.s3.us-west-2.amazonaws.com/wms_basemaps3/Mars/MOLA/mola128_mola64_merge_90Nto90S_SimpleC_clon0_cog.tif";
const GALE_BOX={south:-6.8,north:-4.0,west:136.4,east:139.2};
const NODATA_OUT=-32768;
async function decodeTile(raw,comp,pred,tw,bits,le){
  raw=comp===1?raw:comp===5?lzw(raw):await inflate(raw);
  if(pred===2)undoPred2(raw,tw,bits,le);else if(pred===3)raw=undoPred3(raw,tw,bits,le);
  return raw;
}
async function extractWindow(url,B,log){
  log("Reading the start of the file …");
  const first=await fetchRange(url,0,16384,30000);
  if(!first.ok)throw new Error("Could not read the file ("+(first.stage||"error")+"). Try Wi-Fi and run again.");
  const R={bytes:first.buf.byteLength,reqs:1},ctx={url,chunks:[{start:0,buf:first.buf}],R};
  const h=parseHeader(first.buf);if(!h)throw new Error("The file is not a TIFF.");
  const ifd=await getIfd(ctx,h);if(!ifd)throw new Error("Could not read the file's index.");
  const tv=async(t,n,i)=>await tagVals(ctx,ifd,t,n,i),one=async t=>{const v=await tv(t,1);return v?v[0]:null};
  const W=await one(256),H=await one(257),bits=(await one(258))||0,comp=(await one(259))||1,spp=(await one(277))||1,sf=(await one(339))||1,pred=(await one(317))||1;
  const tw=await one(322),th=await one(323),scale=await tv(33550,3),tie=await tv(33922,6),ndS=await tv(42113),nd=ndS?parseFloat(ndS):null;
  if(!tw||!th||bits!==16||sf!==2||spp!==1)throw new Error("Unexpected file format ("+bits+"-bit, tiled "+tw+"). Stopping so nothing wrong is saved.");
  if(![1,5,8,32946].includes(comp))throw new Error("Compression "+comp+" is not supported by this tool.");
  if(!scale||!tie)throw new Error("The file has no map position information.");
  const keys=await tv(34735,200),gk={};
  if(keys&&keys.length>=4)for(let i=0;i<keys[3];i++){const b=4+i*4;if(b+3<keys.length&&keys[b+1]===0)gk[keys[b]]=keys[b+3]}
  const ascii=await tv(34737,300);
  const Rr=-tie[3]/Math.PI,rad=Math.PI/180,Rm=R_MARS;
  log("File: "+W+" x "+H+" pixels, "+scale[0].toFixed(3)+" m per pixel. Sphere radius implied by the file: "+Rr.toFixed(0)+" m.");
  const Xw=Rm*B.west*rad,Xe=Rm*B.east*rad,Yn=Rm*B.north*rad,Ys=Rm*B.south*rad;
  const c0=Math.max(0,Math.floor((Xw-tie[3])/scale[0]+tie[0])),c1=Math.min(W,Math.ceil((Xe-tie[3])/scale[0]+tie[0]));
  const r0=Math.max(0,Math.floor((tie[4]-Yn)/scale[1]+tie[1])),r1=Math.min(H,Math.ceil((tie[4]-Ys)/scale[1]+tie[1]));
  const w=c1-c0,h2=r1-r0;
  if(w<20||h2<20||w>1500||h2>1500)throw new Error("The window came out "+w+" x "+h2+" pixels, which looks wrong. Stopping.");
  log("Window: "+w+" x "+h2+" pixels.");
  const out=new Int16Array(w*h2).fill(NODATA_OUT),ta=Math.ceil(W/tw);
  const tx0=Math.floor(c0/tw),tx1=Math.floor((c1-1)/tw),ty0=Math.floor(r0/th),ty1=Math.floor((r1-1)/th);
  let done=0,total=(tx1-tx0+1)*(ty1-ty0+1),missing=0;
  for(let ty=ty0;ty<=ty1;ty++){
    const n=tx1-tx0+1,offs=await tv(324,n,ty*ta+tx0),cnts=await tv(325,n,ty*ta+tx0);
    for(let k=0;k<n;k++){
      const tx=tx0+k,off=offs[k],bc=cnts[k];done++;
      if(!bc){missing++;continue}
      if(bc>3e6)throw new Error("A data block is "+fmtB(bc)+", larger than expected. Stopping.");
      log("Reading block "+done+" of "+total+" ("+fmtB(bc)+") …");
      const raw=await decodeTile(new Uint8Array(await readAt(ctx,off,bc)),comp,pred,tw,bits,h.le),dv=new DataView(raw.buffer,raw.byteOffset,raw.byteLength);
      for(let r=Math.max(r0,ty*th);r<Math.min(r1,(ty+1)*th);r++)for(let c=Math.max(c0,tx*tw);c<Math.min(c1,(tx+1)*tw);c++){
        const p=((r-ty*th)*tw+(c-tx*tw))*2;if(p+2>raw.length)continue;
        out[(r-r0)*w+(c-c0)]=dv.getInt16(p,h.le);
      }
    }
  }
  let mn=Infinity,mx=-Infinity,sum=0,n=0,nod=0;
  for(let i=0;i<out.length;i++){const v=out[i];if(v===NODATA_OUT||(nd!=null&&v===nd)){nod++;continue}if(v<mn)mn=v;if(v>mx)mx=v;sum+=v;n++}
  if(n<out.length*0.9)throw new Error("Only "+n+" of "+out.length+" pixels have data. Stopping so nothing wrong is saved.");
  const bc=(PT.lon*rad*Rm-tie[3])/scale[0],br=(tie[4]-PT.lat*rad*Rm)/scale[1],bx=Math.floor(bc)-c0,by=Math.floor(br)-r0;
  const brad=(bx>=0&&bx<w&&by>=0&&by<h2)?out[by*w+bx]:null;
  const edge=(c,r)=>({lon:+((tie[3]+c*scale[0])/Rm/rad).toFixed(5),lat:+((tie[4]-r*scale[1])/Rm/rad).toFixed(5)});
  const NW=edge(c0,r0),SE=edge(c1,r1);
  const meta={
    name:"ARES Gale Crater elevation window (MOLA 463 m)",format:"Raw 16-bit signed integers, little-endian, row-major, first row is the NORTH edge, first column is the WEST edge. Value -32768 means no data.",
    file:"gale-mola463.bin",width:w,height:h2,units:"metres",pixelSize_m:scale[0],
    bounds:{west:NW.lon,east:SE.lon,north:NW.lat,south:SE.lat,note:"Outer pixel edges (assuming the file's pixel convention below)."},
    projection:"Simple cylindrical, centre longitude 0 (from the file name and tie point), longitude positive east.",
    sphereRadius_m:{usedByTool:Rm,impliedByFileTiePoint:+Rr.toFixed(1),note:"ARES distance maths uses 3389500 m, a difference of about 0.2%."},
    geoKeys:{modelType:gk[1024]||null,rasterType:gk[1025]||null,rasterTypeNote:"1 = PixelIsArea, 2 = PixelIsPoint. If PixelIsArea, positions are good to about one pixel (463 m).",text:ascii||null},
    heightReference:"Not stated in the file. Do not call these heights above sea level.",
    stats:{validPixels:n,noDataPixels:nod,min_m:mn,max_m:mx,mean_m:+(sum/n).toFixed(1),bradburyLanding_m:brad,publishedBradbury_m:PT.published,
      note:"Bradbury check is a rough sanity test only; it is not an independent verification."},
    source:{fileUrl:url,fileName:url.split("/").pop(),how:"This S3 link was given by a USGS staff member on the OpenPlanetary forum. It is not an official USGS product page, and it could change or disappear.",
      product:"MOLA 128 pixel/degree DEM merged with 64 pixel/degree (file name), 463 m per pixel",officialPage:"https://astrogeology.usgs.gov/search/map/mars_mgs_mola_dem_463m",licence:"CC0 according to the USGS Astropedia listing (not re-checked by this tool)"},
    limitations:["463 m per pixel cannot show features smaller than several hundred metres, including boxwork ridges (about 1 to 2 m tall).","Not suitable for obstacle detection or any local safety assessment.","MOLA gaps between laser tracks are interpolated in this product (reported in project research; not re-checked here)."],
    evidence:"green",evidenceNote:"Elevation values come from the file unchanged. Only cropping to this window was done by ARES.",
    extracted:{date:new Date().toISOString(),tool:"ARES terrain-extract.html",bytesRead:R.bytes,requests:R.reqs}
  };
  return{data:out,meta,stats:meta.stats,R};
}
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
let RESULT=null;
function log(t){const l=$("#log");l.textContent=t}
function save(name,blob){const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},4000)}
function preview(r){
  const m=r.meta,cv=$("#cv");cv.width=m.width;cv.height=m.height;const g=cv.getContext("2d"),im=g.createImageData(m.width,m.height),lo=m.stats.min_m,hi=m.stats.max_m;
  for(let i=0;i<r.data.length;i++){const v=r.data[i],t=v===NODATA_OUT?0:Math.round(255*(v-lo)/(hi-lo||1));im.data[i*4]=im.data[i*4+1]=im.data[i*4+2]=t;im.data[i*4+3]=255}
  g.putImageData(im,0,0);cv.hidden=false;
}
async function go(){
  const b=$("#go");b.disabled=true;$("#out").innerHTML="";$("#dl").hidden=true;
  try{
    RESULT=await extractWindow(SRC_URL,GALE_BOX,log);
    const m=RESULT.meta,s=m.stats;
    log("Done.");preview(RESULT);
    $("#out").innerHTML=`<div class="card"><b>Extracted ${m.width} x ${m.height} pixels</b> <span class="b PASS">PASS</span><br>
    Area: ${m.bounds.south}° to ${m.bounds.north}° latitude, ${m.bounds.west}° to ${m.bounds.east}° east longitude<br>
    Heights: ${s.min_m} to ${s.max_m} m (mean ${s.mean_m} m)<br>Bradbury Landing pixel: ${s.bradburyLanding_m} m (published: ${s.publishedBradbury_m} m)<br>
    Pixel convention (1 = area, 2 = point): ${m.geoKeys.rasterType}<br>Sphere radius in file: ${m.sphereRadius_m.impliedByFileTiePoint} m<br>
    Downloaded about ${fmtB(RESULT.R.bytes)} in ${RESULT.R.reqs} requests.</div>
    <p class="m">The picture below is the elevation as shades of grey (dark = low). You should see a round crater with a bright mountain in the middle (Mount Sharp). If it looks like noise or stripes, do not use these files.</p>`;
    $("#dl").hidden=false;
  }catch(e){log("Stopped: "+e.message);$("#out").innerHTML='<div class="card"><span class="b FAIL">FAIL</span> '+esc(e.message)+'</div>'}
  b.disabled=false;
}
$("#go").onclick=go;
$("#d1").onclick=()=>{if(!RESULT)return;const d=RESULT.data,buf=new DataView(new ArrayBuffer(d.length*2));for(let i=0;i<d.length;i++)buf.setInt16(i*2,d[i],true);save("gale-mola463.bin",new Blob([buf.buffer]))};
$("#d2").onclick=()=>{if(RESULT)save("gale-mola463.json",new Blob([JSON.stringify(RESULT.meta,null,2)],{type:"application/json"}))};
/* END OF FILE terrain-extract */
