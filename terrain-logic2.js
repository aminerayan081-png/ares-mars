/* ---- one TIFF endpoint ---- */
async function testTiff(ep){
  const R={ep,checks:[],bytes:0,reqs:1,details:""},add=(label,status,text)=>R.checks.push({label,status,text}),skip=(ls,w)=>ls.forEach(l=>add(l,"SKIP",w));
  const first=await fetchRange(ep.url,0,16384,25000),ms=first.ms||first.msHead||0;
  if(!first.ok&&first.stage==="fetch"){
    add(L_REACH,"FAIL",first.aborted?"No answer within 25 seconds.":"The browser could not read this server from a web page. Usually that means the server does not allow other websites to read it (CORS), but a network error looks the same. On mobile data, try Wi-Fi and run again.");
    skip([L_RANGE,L_LAYOUT,L_NUM,L_SPEED],"Not tested: server unreachable.");return finish(R);
  }
  add(L_REACH,"PASS","The server answered (HTTP "+first.status+(first.redirected?", after a redirect":"")+").");
  if(!first.ok){
    add(L_RANGE,"FAIL",first.stage==="range"?(first.status===200?"The server ignored the request for a small piece and began sending the whole file. This test cancelled it at once and read none of it. A phone would have to fetch the entire file, so this source cannot be used directly.":"Unexpected answer (HTTP "+first.status+") when asking for a small piece."):"The server answered but the data did not arrive.");
    skip([L_LAYOUT,L_NUM,L_SPEED],"Not tested: partial downloads do not work.");return finish(R);
  }
  R.bytes+=first.buf.byteLength;
  const cr=first.contentRange,tot=(cr||"").match(/\/(\d+)$/),total=tot?+tot[1]:null;
  add(L_RANGE,cr?"PASS":"PARTIAL",cr?"Works. Asked for 16 KB, got 16 KB (HTTP 206). Content-Range: "+cr+".":"Works (HTTP 206), but the browser cannot see the Content-Range header, so the file size is unknown to a web page.");
  const ctx={url:ep.url,chunks:[{start:0,buf:first.buf}],R};
  try{
    const h=parseHeader(first.buf);
    if(!h){add(L_LAYOUT,"FAIL","Not a TIFF file. First bytes: "+hex(first.buf,8)+".");skip([L_NUM],"Not decoded.");return finish(R)}
    const ifd=await getIfd(ctx,h);
    if(!ifd){add(L_LAYOUT,"FAIL","Could not read the file's table of contents with small reads.");skip([L_NUM],"Not tested.");return finish(R)}
    const tv=async(t,n,i)=>await tagVals(ctx,ifd,t,n,i);
    const W=(await tv(256,1))[0],H=(await tv(257,1))[0],bits=((await tv(258,1))||[0])[0],comp=((await tv(259,1))||[1])[0],photo=((await tv(262,1))||[1])[0];
    const spp=((await tv(277,1))||[1])[0],sf=((await tv(339,1))||[1])[0],pred=((await tv(317,1))||[1])[0],tw=((await tv(322,1))||[])[0],th=((await tv(323,1))||[])[0],rps=((await tv(278,1))||[H])[0];
    const tiled=!!tw,cmap=!!ifd.tags[320],ndS=await tv(42113),nd=ndS?parseFloat(ndS):null,scale=await tv(33550,3),tie=await tv(33922,6);
    R.details=(h.big?"BigTIFF":"TIFF")+", "+W+" x "+H+" px, "+bits+"-bit "+(SFN[sf]||"?")+", compression "+(COMP[comp]||comp)+(pred>1?", predictor "+pred:"")+", "+(tiled?"tiled "+tw+"x"+th:"strips of "+rps+" rows")+", table of contents at byte "+h.ifd+", more images inside: "+(ifd.next?"yes":"no")+(total?", size "+fmtB(total):"")+(scale?", pixel scale "+scale.map(x=>+x.toPrecision(6)).join("/"):"")+(tie?", tie point "+tie.map(x=>+x.toPrecision(8)).join("/"):"")+(ndS?", no-data "+ndS:"");
    add(L_LAYOUT,tiled?(h.ifd<65536?"PASS":"PARTIAL"):"PARTIAL",tiled?"Stored in tiles, so one small window can be fetched."+(h.ifd<65536?" Table of contents is at the start (cloud-friendly).":" Table of contents is far into the file (one extra small read)."):"Stored in strips of "+rps+" rows, not tiles. Reading a window needs a wider read.");
    speedChk(R,ms);
    if(spp!==1||cmap||photo===3||bits<16){add(L_NUM,"FAIL","This file looks like a picture ("+spp+" band(s), "+bits+"-bit"+(cmap?", colour table":"")+"), not elevation numbers.");return finish(R)}
    if(!COMP[comp]||![1,5,8,32946].includes(comp)){add(L_NUM,"PARTIAL","Compression "+(COMP[comp]||comp)+" is not decoded by this test, so numbers could not be checked.");return finish(R)}
    if(!scale||!tie){add(L_NUM,"PARTIAL","No georeferencing tags, so the test cannot find Gale Crater in this file.");return finish(R)}
    /* find the pixel for the sample point */
    const deg=Math.abs(tie[3])<=360&&Math.abs(tie[4])<=90&&scale[0]<1;
    const X=deg?PT.lon:R_MARS*PT.lon*Math.PI/180,Y=deg?PT.lat:R_MARS*PT.lat*Math.PI/180;
    let col=(X-tie[3])/scale[0]+tie[0],row=(tie[4]-Y)/scale[1]+tie[1],where=PT.name+" ("+PT.lat+", "+PT.lon+")",assumed=deg?"coordinates read as degrees":"coordinates read as metres on a simple cylindrical map, Mars radius "+R_MARS+" m (an assumption)";
    if(!(col>=0&&col<W&&row>=0&&row<H)){col=W/2;row=H/2;where="the middle of the file (the sample point is outside it or the map projection is not the assumed one)"}
    col=Math.floor(col);row=Math.floor(row);
    let off,bc,x0,y0,tcols,trows;
    if(tiled){const ta=Math.ceil(W/tw),ty=Math.floor(row/th),tx=Math.floor(col/tw),idx=ty*ta+tx;
      off=(await tv(324,1,idx))[0];bc=(await tv(325,1,idx))[0];x0=tx*tw;y0=ty*th;tcols=tw;trows=th}
    else{const s=Math.floor(row/rps);off=(await tv(273,1,s))[0];bc=(await tv(279,1,s))[0];x0=0;y0=s*rps;tcols=W;trows=rps}
    if(!bc||bc>6e6){add(L_NUM,"PARTIAL","The block holding this spot is "+(bc?fmtB(bc):"empty")+", too big to read safely in this test.");return finish(R)}
    let raw=new Uint8Array(await readAt(ctx,off,bc));
    raw=comp===1?raw:comp===5?lzw(raw):await inflate(raw);
    if(pred===2)undoPred2(raw,tcols,bits,h.le);else if(pred===3)raw=undoPred3(raw,tcols,bits,h.le);
    const dv=new DataView(raw.buffer,raw.byteOffset,raw.byteLength),vals=[];
    for(let r=Math.max(0,row-y0-2);r<=Math.min(trows-1,row-y0+2);r++)for(let c=Math.max(0,col-x0-4);c<=Math.min(tcols-1,col-x0+4);c++)if((r*tcols+c)*bits/8+bits/8<=raw.length)vals.push(getNum(dv,r*tcols+c,bits,sf,h.le));
    const centre=getNum(dv,(row-y0)*tcols+(col-x0),bits,sf,h.le),s=summarize(vals,nd);
    if(s.empty)add(L_NUM,"PARTIAL","The window at "+where+" was almost all no-data values, so it proves nothing.");
    else if(s.min===s.max)add(L_NUM,"PARTIAL","All values at "+where+" were identical ("+s.min+"), so this does not prove they are elevations.");
    else if(!s.plausible)add(L_NUM,"PARTIAL","Read "+s.n+" numbers at "+where+" ("+s.min.toFixed(1)+" to "+s.max.toFixed(1)+") but they fall outside the Mars range (-12000 to 25000 m). The unit may differ or this decoder may be wrong.");
    else add(L_NUM,"PASS","Read "+s.n+" real numbers at "+where+": "+s.min.toFixed(1)+" to "+s.max.toFixed(1)+" (first: "+s.sample.join(", ")+"). Centre pixel "+(Number.isFinite(centre)?centre.toFixed(1):"?")+" vs the published Bradbury elevation "+PT.published+" m (difference "+(Number.isFinite(centre)?Math.round(centre-PT.published):"?")+" m). That is only a rough sanity check: datasets use different reference surfaces and resolutions. Mapping used: "+assumed+".");
  }catch(e){add(L_NUM,"FAIL","The test could not finish decoding: "+e.message)}
  return finish(R);
}
function speedChk(R,ms){const s=ms<2000?"PASS":ms<6000?"PARTIAL":"FAIL";R.checks.push({label:L_SPEED,status:s,text:"First small read took "+Math.round(ms)+" ms."})}
/* ---- HiPS ---- */
async function testHips(ep){
  const R={ep,checks:[],bytes:0,reqs:1,details:""},add=(l,s,t)=>R.checks.push({label:l,status:s,text:t});
  const p=await readSmall(ep.base+"/properties",20000,20000);
  if(!p.ok){add(L_REACH,"FAIL",p.status?"HTTP "+p.status+" for the description file.":"The browser could not read this server (CORS or network).");add(L_NUM,"SKIP","Not tested.");return finish(R)}
  R.bytes+=p.u8.length;add(L_REACH,"PASS","The description file was readable (HTTP "+p.status+").");
  add(L_RANGE,"SKIP","Not needed: tiles are separate small files.");speedChk(R,p.ms);
  const txt=new TextDecoder().decode(p.u8),g=k=>{const m=txt.match(new RegExp("^"+k+"\\s*=\\s*(.*)$","m"));return m?m[1].trim():null};
  const fmt=(g("hips_tile_format")||"").toLowerCase(),ord=g("hips_order");
  R.details="tile format: "+(fmt||"?")+", max order: "+(ord||"?")+", frame: "+(g("hips_frame")||"?")+", pixel size: "+(g("hips_pixel_scale")||"?")+" deg, tile width: "+(g("hips_tile_width")||"?");
  add(L_LAYOUT,"INFO","Sky-style tiles (HEALPix), not a regular map grid. Using them for Gale needs extra conversion maths.");
  const ext=fmt.includes("fits")?"fits":fmt.includes("png")?"png":"jpg";
  const t=await readSmall(ep.base+"/Norder3/Dir0/Npix0."+ext,20000,20000);
  if(!t.ok){add(L_NUM,"PARTIAL","The description is readable but the test tile was not (HTTP "+(t.status||"error")+").");return finish(R)}
  R.bytes+=t.u8.length;R.reqs++;
  if(ext!=="fits")add(L_NUM,"FAIL","Tiles are "+ext.toUpperCase()+" pictures (8-bit colour), not elevation numbers.");
  else{
    const h=new TextDecoder().decode(t.u8.slice(0,2880)),k=n=>{const m=h.match(new RegExp(n+"\\s*=\\s*([-+0-9.eE]+)"));return m?parseFloat(m[1]):null},bp=k("BITPIX"),bz=k("BZERO")||0,bs=k("BSCALE")==null?1:k("BSCALE");
    const dv=new DataView(t.u8.buffer,t.u8.byteOffset+2880*Math.ceil(2880/2880),Math.max(0,t.u8.length-2880)),vals=[];
    for(let i=0;i<400&&(Math.abs(bp)/8)*(i+1)<=dv.byteLength;i++)vals.push((bp===-32?dv.getFloat32(i*4,false):bp===16?dv.getInt16(i*2,false):NaN)*bs+bz);
    const s=summarize(vals,null);
    add(L_NUM,s.empty||!s.plausible?"PARTIAL":"PASS","FITS tile, BITPIX "+bp+". "+(s.empty?"Sample had no usable values.":"First values range "+s.min.toFixed(1)+" to "+s.max.toFixed(1)+"."));
  }
  return finish(R);
}
/* END OF FILE terrain-logic2 */
