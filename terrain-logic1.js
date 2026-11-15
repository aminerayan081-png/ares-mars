"use strict";
const R_MARS=3396190;
const PT={name:"Bradbury Landing",lat:-4.5895,lon:137.4417,published:-4501};
const fmtB=n=>n>=1e9?(n/1e9).toFixed(2)+" GB":n>=1e6?(n/1e6).toFixed(1)+" MB":n>=1e3?(n/1e3).toFixed(1)+" KB":n+" B";
const hex=(b,n)=>Array.from(new Uint8Array(b).slice(0,n)).map(x=>x.toString(16).padStart(2,"0")).join(" ");
const L_REACH="Can a web page read this server?",L_RANGE="Partial downloads (Range)",L_LAYOUT="File layout",L_NUM="Real elevation numbers",L_SPEED="Speed";
const EPS=[
 {id:"mola-usgs",kind:"tiff",name:"1. USGS MOLA DEM 463 m",url:"https://planetarymaps.usgs.gov/mosaic/Mars_MGS_MOLA_DEM_mosaic_global_463m.tif",note:"Global, 463 m/pixel, 16-bit, about 2 GB, CC0."},
 {id:"mola-cog",kind:"tiff",name:"2. MOLA cloud-optimised copy (Amazon S3)",url:"https://asc-pds-services.s3.us-west-2.amazonaws.com/wms_basemaps3/Mars/MOLA/mola128_mola64_merge_90Nto90S_SimpleC_clon0_cog.tif",note:"Link from a USGS staff post on the OpenPlanetary forum. Built for partial reads."},
 {id:"msl-1m",kind:"tiff",name:"3. USGS MSL Gale merged DEM 1 m",url:"https://planetarymaps.usgs.gov/mosaic/Mars/MSL/MSL_Gale_DEM_Mosaic_1m_v3.tif",note:"Gale only, 3.6 GB, mixed sources, marked 'In Work' by USGS."},
 {id:"hrsc-30m",kind:"tiff",name:"4. HRSC 30 m Gale DTM (Zenodo)",url:"https://zenodo.org/records/5808354/files/hrsc_km09_h1938_h1927_h1916-dtm-mosaic.tif?download=1",note:"Gale, 30 m/pixel, float32, 311.8 MB, CC BY 4.0."},
 {id:"cds-hips",kind:"hips",name:"5. CDS HiPS tiles of the MOLA DEM",base:"https://alasky.cds.unistra.fr/Planets/Mars_MGS_MOLA_DEM",note:"Tile service. This test reads the description and one tile."}
];
async function fetchRange(url,start,len,timeoutMs){
  const ctl=new AbortController(),t0=performance.now(),timer=setTimeout(()=>ctl.abort(),timeoutMs||25000);
  let res;
  try{res=await fetch(url,{headers:{Range:"bytes="+start+"-"+(start+len-1)},mode:"cors",cache:"no-store",credentials:"omit",signal:ctl.signal})}
  catch(e){clearTimeout(timer);return{ok:false,stage:"fetch",error:e,aborted:ctl.signal.aborted,ms:performance.now()-t0}}
  const info={status:res.status,redirected:res.redirected,contentRange:res.headers.get("content-range"),contentType:res.headers.get("content-type"),msHead:performance.now()-t0};
  if(res.status!==206){try{ctl.abort()}catch(e){}clearTimeout(timer);return Object.assign({ok:false,stage:"range"},info)}
  try{const buf=await res.arrayBuffer();clearTimeout(timer);return Object.assign({ok:true,buf,ms:performance.now()-t0},info)}
  catch(e){clearTimeout(timer);return Object.assign({ok:false,stage:"body",error:e},info)}
}
async function readSmall(url,maxBytes,timeoutMs){   // small files: read the start, then cancel
  const ctl=new AbortController(),t0=performance.now(),timer=setTimeout(()=>ctl.abort(),timeoutMs||20000);
  try{
    const res=await fetch(url,{mode:"cors",cache:"no-store",credentials:"omit",signal:ctl.signal});
    if(!res.ok){try{ctl.abort()}catch(e){}clearTimeout(timer);return{ok:false,status:res.status,ms:performance.now()-t0}}
    const rd=res.body.getReader(),parts=[];let got=0;
    while(got<maxBytes){const r=await rd.read();if(r.done)break;parts.push(r.value);got+=r.value.length}
    try{ctl.abort()}catch(e){}clearTimeout(timer);
    const u8=new Uint8Array(got);let p=0;parts.forEach(a=>{u8.set(a,p);p+=a.length});
    return{ok:true,u8,status:res.status,type:res.headers.get("content-type"),ms:performance.now()-t0};
  }catch(e){clearTimeout(timer);return{ok:false,error:e,aborted:ctl.signal.aborted,ms:performance.now()-t0}}
}
async function readAt(ctx,start,len){
  for(const c of ctx.chunks)if(start>=c.start&&start+len<=c.start+c.buf.byteLength)return c.buf.slice(start-c.start,start-c.start+len);
  const r=await fetchRange(ctx.url,start,Math.max(len,256),30000);ctx.R.reqs++;
  if(!r.ok)throw new Error("a small read at byte "+start+" failed");
  ctx.R.bytes+=r.buf.byteLength;ctx.chunks.push({start,buf:r.buf});return r.buf.slice(0,len);
}
/* ---- TIFF reading ---- */
const TSZ={1:1,2:1,3:2,4:4,5:8,6:1,7:1,8:2,9:4,10:8,11:4,12:8,16:8,17:8,18:8};
const COMP={1:"none",5:"LZW",7:"JPEG",8:"Deflate",32946:"Deflate",32773:"PackBits",34925:"LZMA",50000:"Zstd"};
const SFN={1:"unsigned integer",2:"signed integer",3:"floating point"};
function parseHeader(buf){
  if(buf.byteLength<16)return null;
  const dv=new DataView(buf),bo=dv.getUint16(0,false);let le;
  if(bo===0x4949)le=true;else if(bo===0x4D4D)le=false;else return null;
  const m=dv.getUint16(2,le);
  if(m===42)return{le,big:false,ifd:dv.getUint32(4,le)};
  if(m===43)return{le,big:true,ifd:Number(dv.getBigUint64(8,le))};
  return null;
}
function parseIFD(buf,base,h){
  const dv=new DataView(buf),le=h.le,big=h.big,p0=h.ifd-base;
  if(p0<0||p0+8>buf.byteLength)return{partial:true,need:8192};
  const n=big?Number(dv.getBigUint64(p0,le)):dv.getUint16(p0,le);
  if(n>300)return null;
  const esz=big?20:12,head=big?8:2,need=head+n*esz+(big?8:4);
  if(p0+need>buf.byteLength)return{partial:true,need};
  const tags={};
  for(let i=0;i<n;i++){const q=p0+head+i*esz;
    tags[dv.getUint16(q,le)]={type:dv.getUint16(q+2,le),count:big?Number(dv.getBigUint64(q+4,le)):dv.getUint32(q+4,le),vq:q+(big?12:8)}}
  const qn=p0+head+n*esz;
  return{tags,dv,le,big,next:big?Number(dv.getBigUint64(qn,le)):dv.getUint32(qn,le)};
}
async function getIfd(ctx,h){
  let need=8192;
  for(let t=0;t<3;t++){
    let base=0,buf=ctx.chunks[0].buf;
    if(h.ifd+16>buf.byteLength||t>0){base=h.ifd;buf=await readAt(ctx,h.ifd,need)}
    const r=parseIFD(buf,base,h);
    if(!r)return null;if(!r.partial)return r;need=Math.max(need,r.need);
  }
  return null;
}
function readVals(dv,pos,type,n,le){
  const o=[];
  for(let i=0;i<n;i++)switch(type){
    case 1:case 2:case 7:o.push(dv.getUint8(pos+i));break;
    case 3:o.push(dv.getUint16(pos+i*2,le));break;
    case 4:o.push(dv.getUint32(pos+i*4,le));break;
    case 6:o.push(dv.getInt8(pos+i));break;
    case 8:o.push(dv.getInt16(pos+i*2,le));break;
    case 9:o.push(dv.getInt32(pos+i*4,le));break;
    case 11:o.push(dv.getFloat32(pos+i*4,le));break;
    case 12:o.push(dv.getFloat64(pos+i*8,le));break;
    case 16:case 18:o.push(Number(dv.getBigUint64(pos+i*8,le)));break;
    case 17:o.push(Number(dv.getBigInt64(pos+i*8,le)));break;
    default:o.push(null);
  }
  return o;
}
async function tagVals(ctx,ifd,tag,n,i0){
  const e=ifd.tags[tag];if(!e)return null;
  const sz=TSZ[e.type]||1,fs=ifd.big?8:4;i0=i0||0;
  let cnt=n==null?Math.min(e.count,64):n;if(i0+cnt>e.count)cnt=Math.max(0,e.count-i0);
  if(cnt<=0)return null;
  let v;
  if(e.count*sz<=fs)v=readVals(ifd.dv,e.vq+i0*sz,e.type,cnt,ifd.le);
  else{
    const off=ifd.big?Number(ifd.dv.getBigUint64(e.vq,ifd.le)):ifd.dv.getUint32(e.vq,ifd.le);
    const b=await readAt(ctx,off+i0*sz,cnt*sz);
    v=readVals(new DataView(b),0,e.type,Math.min(cnt,Math.floor(b.byteLength/sz)),ifd.le);
  }
  return e.type===2?String.fromCharCode.apply(null,v).replace(/\0[\s\S]*$/,""):v;
}
async function inflate(u8){return new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream("deflate"))).arrayBuffer())}
function lzw(u8){
  const out=[];let bit=0,len=9,dict,prev=null;const total=u8.length*8;
  const reset=()=>{dict=[];for(let i=0;i<256;i++)dict[i]=[i];dict[256]=null;dict[257]=null;len=9;prev=null};reset();
  while(bit+len<=total){
    let c=0;for(let i=0;i<len;i++)c=(c<<1)|((u8[(bit+i)>>3]>>(7-((bit+i)&7)))&1);
    bit+=len;
    if(c===257)break;if(c===256){reset();continue}
    let e;
    if(prev===null)e=dict[c];
    else{e=c<dict.length?dict[c]:prev.concat(prev[0]);dict.push(prev.concat(e[0]))}
    if(!e)break;
    for(let i=0;i<e.length;i++)out.push(e[i]);
    prev=e;const n=dict.length;len=n>=2047?12:n>=1023?11:n>=511?10:9;
  }
  return Uint8Array.from(out);
}
function undoPred2(raw,rowW,bits,le){
  const bps=bits/8,rb=rowW*bps,rows=Math.floor(raw.length/rb),dv=new DataView(raw.buffer,raw.byteOffset,raw.byteLength);
  for(let r=0;r<rows;r++){const b=r*rb;
    if(bits===8)for(let i=1;i<rowW;i++)raw[b+i]=(raw[b+i]+raw[b+i-1])&255;
    else if(bits===16)for(let i=1;i<rowW;i++)dv.setUint16(b+i*2,(dv.getUint16(b+i*2,le)+dv.getUint16(b+(i-1)*2,le))&0xFFFF,le);
    else if(bits===32)for(let i=1;i<rowW;i++)dv.setUint32(b+i*4,(dv.getUint32(b+i*4,le)+dv.getUint32(b+(i-1)*4,le))>>>0,le);
  }
}
function undoPred3(raw,rowW,bits,le){
  const bps=bits/8,rb=rowW*bps,rows=Math.floor(raw.length/rb),out=new Uint8Array(raw.length);
  for(let r=0;r<rows;r++){const b=r*rb;
    for(let i=1;i<rb;i++)raw[b+i]=(raw[b+i]+raw[b+i-1])&255;
    for(let i=0;i<rowW;i++)for(let k=0;k<bps;k++)out[b+i*bps+k]=le?raw[b+(bps-k-1)*rowW+i]:raw[b+k*rowW+i];
  }
  return out;
}
function getNum(dv,idx,bits,sf,le){
  const p=idx*bits/8;
  if(bits===8)return sf===2?dv.getInt8(p):dv.getUint8(p);
  if(bits===16)return sf===2?dv.getInt16(p,le):dv.getUint16(p,le);
  if(bits===32)return sf===3?dv.getFloat32(p,le):(sf===2?dv.getInt32(p,le):dv.getUint32(p,le));
  if(bits===64&&sf===3)return dv.getFloat64(p,le);
  return NaN;
}
function summarize(v,nd){
  v=v.filter(x=>Number.isFinite(x)&&Math.abs(x)<1e30&&!(nd!=null&&Number.isFinite(nd)&&Math.abs(x-nd)<=1e-6*Math.max(1,Math.abs(nd))));
  if(v.length<5)return{n:v.length,empty:true};
  let mn=Infinity,mx=-Infinity;v.forEach(x=>{if(x<mn)mn=x;if(x>mx)mx=x});
  return{n:v.length,min:mn,max:mx,sample:v.slice(0,5).map(x=>+x.toFixed(1)),plausible:mn>=-12000&&mx<=25000};
}
function finish(R){
  const st=l=>{const c=R.checks.find(x=>x.label===l);return c?c.status:"SKIP"};
  const bad=[L_REACH,L_RANGE,L_NUM].some(l=>st(l)==="FAIL"||st(l)==="SKIP");
  const any=R.checks.some(c=>c.status==="PARTIAL"||c.status==="FAIL");
  R.verdict=bad?"FAIL":any?"PARTIAL":"PASS";return R;
}
/* END OF FILE terrain-logic1 */
