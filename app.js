// NASCAR Live for Fire TV. Same code path for live feed and the synthetic test race.
(function(){
var Q={};location.search.slice(1).split('&').forEach(function(kv){if(!kv)return;var p=kv.split('=');Q[decodeURIComponent(p[0])]=decodeURIComponent(p[1]||'')});
var FEED='https://cf.nascar.com/live/feeds/live-feed.json',SERIES={1:'Cup Series',2:"O'Reilly Auto Parts Series",3:'Craftsman Truck Series',4:'ARCA Menards Series'};
var SHORT={1:'CUP',2:"O'REILLY",3:'TRUCKS',4:'ARCA'},SCOL={1:'#ffc72c',2:'#3ccf6e',3:'#ff6b3d',4:'#4fa3ff'};
var ALIAS={cup:1,'1':1,busch:2,xfinity:2,oreilly:2,"o'reilly":2,nxs:2,noaps:2,'2':2,truck:3,trucks:3,craftsman:3,'3':3,arca:4,'4':4};
function serOf(x){return x==null?null:ALIAS[String(x).toLowerCase().replace(/\s+/g,'')]||null}
var MF={Chv:'#f2c14e',Frd:'#3d7bff',Tyt:'#ff3b3b',Toy:'#ff3b3b',Dge:'#c33cff',Ram:'#c33cff'};
var BUNDLED={};var RS=window.ROSTERS||{1:window.ROSTER||[]};if(!window.NO_BUNDLED_BADGES)for(var _s in RS)RS[_s].forEach(function(r){BUNDLED[_s+'/'+r[0]]=1});
var S={series:serOf(Q.series),mode:Q.mode==='test'||Q.mode==='demo'?'test':'live',speed:+Q.speed||1,feed:null,feedClock:0,lf:0,lapT:30,prevLap:-1,cars:{},track:null,trackId:null,
  focus:Q.driver||Q.car||null,sel:null,menu:false,menuIdx:0,freeze:false,finishSeen:0,next:null,lastTick:0,tickOff:0,tickW:0,liveActive:true};
var $=function(id){return document.getElementById(id)};
// v1.3: write DOM only on change. Rewriting innerHTML every poll re-created ~100 badge <img>s and re-rastered layers,
// which on a memory-starved Fire Stick shows up as the screen blinking.
function setH(el,h){if(typeof el==='string')el=$(el);if(el.__h!==h){el.__h=h;el.innerHTML=h}}
function setT(el,t){if(typeof el==='string')el=$(el);if(el.__t!==t){el.__t=t;el.textContent=t}}
function setC(el,c){if(typeof el==='string')el=$(el);if(el.className!==c)el.className=c}
function hide(el,on){if(typeof el==='string')el=$(el);if(el.classList.contains('hidden')!==on)el.classList.toggle('hidden',on)}
var cv=$('map'),cx=cv.getContext('2d'),W=cv.width,H=cv.height,bg=document.createElement('canvas'),RAT=1;bg.width=W;bg.height=H;
var PHONE=false;
// PWA: portrait phones get a stacked layout with a smaller virtual canvas; TV/landscape keep the 1360x910 map.
function layout(){if(!window.PWA){return}
  PHONE=innerWidth<innerHeight;document.body.classList.toggle('phone',PHONE);document.body.classList.toggle('land',!PHONE);
  if(!PHONE){var z=Math.min(innerWidth/1920,innerHeight/1080);document.body.style.zoom=z}else document.body.style.zoom='';
  W=PHONE?720:1360;H=PHONE?600:910;var dw=PHONE?cv.parentNode.clientWidth:W,dpr=Math.min(3,window.devicePixelRatio||1);
  RAT=(PHONE?dw/W:1)*dpr*(PHONE?1:(document.body.style.zoom||1));cv.style.width=(PHONE?dw:W)+'px';cv.style.height=(PHONE?dw*H/W:H)+'px';
  cv.width=bg.width=Math.round(W*RAT);cv.height=bg.height=Math.round(H*RAT);cx.setTransform(RAT,0,0,RAT,0,0);bg.getContext('2d').setTransform(RAT,0,0,RAT,0,0);
  ROWS=PHONE?99:17;if(S.track)drawTrack();if(S.feed){renderBoard();renderFocus()}}
// ---------- clocks ----------
var simBase=Q.simt?+Q.simt:-5,wallBase=performance.now();
function clock(){if(S.mode!=='test')return performance.now()/1000;if(S.freeze)return simBase;return simBase+(performance.now()-wallBase)/1000*S.speed}
function setSpeed(x){simBase=clock();wallBase=performance.now();S.speed=x;toast('Test race speed '+x+'x')}
function restartTest(){simBase=-5;wallBase=performance.now();S.finishSeen=0;$('finish').classList.add('hidden');poll()}
// ---------- badges ----------
var IM={};
function badgeUrl(series,num,remote){return (!remote&&BUNDLED[series+'/'+num])?'badges/'+series+'/'+num+'.png':'https://cf.nascar.com/data/images/carbadges/'+series+'/'+num+'.png'}
function badgeImg(series,num){var k=series+'/'+num,e=IM[k];if(e)return e;e=IM[k]={ok:null,img:new Image()};var remote=!BUNDLED[series+'/'+num];
  e.img.onload=function(){e.ok=true};e.img.onerror=function(){if(!remote){remote=true;e.img.src=badgeUrl(series,num,true)}else e.ok=false};
  e.img.src=badgeUrl(series,num,false);return e}
function fbHTML(num,mf){return '<span class="fb" style="color:'+(MF[mf]||'#fff')+'">'+num+'</span>'}
window.__bfail=function(el,num,mf){el.outerHTML=fbHTML(num,mf)};
function badgeHTML(series,num,mf){var e=badgeImg(series,num);if(e.ok===false)return fbHTML(num,mf);
  return '<img class="bdg" src="'+e.img.src+'" onerror="__bfail(this,\''+num+'\',\''+mf+'\')">'}
// ---------- data ----------
function getJSON(url,cb){var done=false;
  function viaBridge(){if(window.Android&&Android.httpAsync){var id='b'+(++getJSON.n);window.__bcb=window.__bcb||{};__bcb[id]=function(r){delete __bcb[id];try{if(r&&r.status==200){cb(JSON.parse(r.body));return}}catch(e){}cb(null)};Android.httpAsync(url,id);return}
    if(window.Android&&Android.http){try{var r=JSON.parse(Android.http(url,'GET','{}',''));if(r.status==200){cb(JSON.parse(r.body));return}}catch(e){}}cb(null)}
  try{fetch(url,{cache:'no-store'}).then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(j){done=true;cb(j)}).catch(function(){if(!done)viaBridge()})}catch(e){viaBridge()}}
getJSON.n=0;
var polling=false;
function poll(){if(S.mode==='test'){ingest(TestRace.feed(clock()),clock());return}
  if(polling&&performance.now()-polling<15000)return;polling=performance.now();var url=Q.feed||FEED;poll.k=(poll.k||0)+1;if(!Q.feed&&poll.k%2&&S.feed&&S.feed.series_id&&S.feed.race_id)url='https://cf.nascar.com/live/feeds/series_'+S.feed.series_id+'/'+S.feed.race_id+'/live_feed.json';getJSON(url+(Q.feed?'':'?_='+Date.now()),function(j){polling=false;if(j&&j.vehicles&&S.mode==='live'){if(S.feed&&j.run_id===S.feed.run_id&&j.elapsed_time<S.feed.elapsed_time)return;ingest(j,clock())}})}
function lapsLed(v){var n=0;(v.laps_led||[]).forEach(function(l){if(l.end_lap>=1)n+=l.end_lap-Math.max(1,l.start_lap)+1});return n}
function stops(v){return (v.pit_stops||[]).filter(function(p){return p.pit_in_elapsed_time>0||p.pit_in_lap_count>0}).length}
function inPit(v){var p=(v.pit_stops||[]).slice(-1)[0];return !!(p&&p.pit_in_elapsed_time>0&&p.pit_out_elapsed_time<p.pit_in_elapsed_time)}
function fmtT(t){return t>0?t.toFixed(3):'—'}
function gapTxt(v){if(v.running_position===1)return 'Leader';if(v.delta<0)return (-v.delta)+(v.delta==-1?' lap':' laps');return '+'+(+v.delta).toFixed(3)}
function ingest(f,at){var first=!S.feed;
  // Only re-anchor the clock when the feed actually moved on; identical/stale polls must not pull cars back.
  var changed=first||!S.feed||f.elapsed_time!==S.feed.elapsed_time||f.lap_number!==S.feed.lap_number||f.run_id!==S.feed.run_id;
  S.feed=f;if(changed){S.feedClock=at;S.lastChange=at;S.updWall=Date.now()}var V=f.vehicles.slice().sort(function(a,b){return a.running_position-b.running_position});f.vehicles=V;
  if(S.trackId!==f.track_id){S.trackId=f.track_id;S.track=trackShape(f.track_id,'');drawTrack();}
  var race=f.run_type===3,L=V[0]||{},nominal=f.track_length?f.track_length*3600/(f.track_length<1?95:f.track_length>2.4?190:165):30;
  var lt=L.last_lap_time>0?L.last_lap_time:(S.lapT||nominal);if(f.flag_state===2&&lt<nominal*1.2)lt=Math.max(lt,(S.greenLT||nominal)*1.6);if(f.flag_state===1&&L.last_lap_time>0&&L.last_lap_time<nominal*1.2)S.greenLT=L.last_lap_time;S.lapT=lt;
  var le=f.elapsed_time-(L.vehicle_elapsed_time||0);
  if(race&&L.vehicle_elapsed_time>0&&le>=0&&le<lt*1.5)S.lf=le/lt;           // leader's progress since crossing the line
  else if(f.lap_number!==S.prevLap)S.lf=0; else S.lf+=0;                    // dead reckoning (advanced in frame())
  S.prevLap=f.lap_number;
  var seen={};V.forEach(function(v,i){var n=v.vehicle_number,c=S.cars[n]||(S.cars[n]={disp:null});seen[n]=1;c.v=v;c.pit=inPit(v);c.rank=i;
    var own=v.last_lap_time>0?v.last_lap_time:lt;
    var pitNow=inPit(v);if(c.lc!==undefined&&(c.lc!==v.laps_completed||c.wasPit!==pitNow))c.reset=true;c.lc=v.laps_completed;c.wasPit=pitNow;
    if(race){if(v.delta>=0)c.off=v.delta/lt;                                  // fraction of a lap behind the leader
      else if(v.vehicle_elapsed_time>0){var e=f.elapsed_time-v.vehicle_elapsed_time;c.off=S.lf-(e/own)}else c.off=0.5+i*0.01;
      if(v.delta<0)c.off+=-v.delta; // laps down -> absolute race distance
      c.show=v.status===1||v.is_on_track}
    else{var e2=f.elapsed_time-(v.vehicle_elapsed_time||0);c.own=e2/own;c.ownT=own;c.show=v.is_on_track&&v.vehicle_elapsed_time>0&&f.flag_state!==9&&e2>=0&&e2<own*3} // hide stale 'on track' cars (session over / no crossing for 3 laps)
    if(race)c.off=Math.max(-0.02,c.off);c.leadLaps=(V[0]&&V[0].laps_completed)||0});
  for(var k in S.cars)if(!seen[k])delete S.cars[k];
  if(!S.sel&&V[0])S.sel=V[0].vehicle_number;
  var age=(Date.now()-Date.parse(f.time_of_day_os))/60000;S.liveActive=S.mode==='test'||(!Q.nolive&&age<15&&f.flag_state!==9);
  if(race&&f.flag_state===9){if(!S.finishSeen)S.finishSeen=performance.now();}else S.finishSeen=0;
  if(first||performance.now()-S.lastTick>9000||f.lap_number!==S.tickLap)buildTicker();
  renderBoard();renderHeader();liveTick();renderFocus();renderFinish();renderNext()}
// ---------- header + ticker ----------
var FL={1:['GREEN','f1'],2:['CAUTION','f2'],3:['RED','f3'],4:['WHITE','f4'],8:['PRE-RACE','f8'],9:['CHECKERED','f9']};
function flagOf(f){var x=FL[f.flag_state]||['—','f0'];if(f.run_type!==3&&f.flag_state===1)x=['GREEN','f1'];return x}
function renderHeader(){var f=S.feed,fl=flagOf(f),race=f.run_type===3;setH('flag',f.flag_state===9?'<span style="background:#000;padding:4px 10px;border-radius:7px;font-size:20px">CHECKERED</span>':fl[0]);setC('flag','flag '+fl[1]);
  setT('lap',race?'LAP '+f.lap_number+' / '+f.laps_in_race:(f.run_type===2?'QUALIFYING':'PRACTICE'));
  setT('togo',race?(f.laps_to_go>0?f.laps_to_go+' TO GO':'FINAL'):(f.flag_state===9?'SESSION OVER':f.vehicles.filter(function(v){return v.is_on_track}).length+' ON TRACK'));
  var m=$('mode');if(S.mode==='test'){setT(m,'TEST RACE'+(S.speed>1?' '+S.speed+'x':''));setC(m,'mode test')}else if(S.liveActive){setT(m,'LIVE');setC(m,'mode')}else{setT(m,'LAST SESSION');setC(m,'mode last')}
  setH('title','<span class="ser" style="background:'+(SCOL[f.series_id]||'#888')+'">'+(SHORT[f.series_id]||'S'+f.series_id)+'</span> '+f.run_name);var acc=SCOL[f.series_id]||'#ffb066';if(S.acc!==acc){S.acc=acc;document.documentElement.style.setProperty('--acc',acc)}
  setT('stage',race&&f.stage&&f.stage.stage_num?'Stage '+f.stage.stage_num+' ends lap '+f.stage.finish_at_lap:'');
  setT('stats',race?'Cautions '+f.number_of_caution_segments+' ('+f.number_of_caution_laps+' laps) · Lead changes '+f.number_of_lead_changes:'');
  setT('trackname',f.track_name+' · '+f.track_length+' mi')}
function fastest(V){var b=null;V.forEach(function(v){if(v.best_lap_time>0&&(!b||v.best_lap_time<b.best_lap_time))b=v});return b}
function buildTicker(){var f=S.feed,V=f.vehicles,h=[],fb=fastest(V),race=f.run_type===3;S.lastTick=performance.now();S.tickLap=f.lap_number;
  function sec(k,t){h.push('<span class="ti sec"><span class="k">'+k+'</span>'+t+'</span>')}
  var info=[function(){sec(flagOf(f)[0]+' FLAG',race?'Lap '+f.lap_number+' of '+f.laps_in_race+' · '+f.laps_to_go+' to go':f.run_name)},
    function(){if(fb)sec('FASTEST LAP',badgeHTML(f.series_id,fb.vehicle_number,fb.vehicle_manufacturer)+' '+fb.driver.full_name.replace(/\s*\(.*?\)|[#*]/g,'')+' '+fb.best_lap_time.toFixed(3)+'s · '+fb.best_lap_speed.toFixed(3)+' mph')},
    function(){if(race&&f.stage)sec('STAGE '+f.stage.stage_num,'ends lap '+f.stage.finish_at_lap)},
    function(){if(race)sec('CAUTIONS',f.number_of_caution_segments+' for '+f.number_of_caution_laps+' laps · '+f.number_of_lead_changes+' lead changes · '+f.number_of_leaders+' leaders')}];
  info[0]();info[1]();
  V.forEach(function(v,i){h.push('<span class="ti"><span class="p">P'+v.running_position+'</span>'+badgeHTML(f.series_id,v.vehicle_number,v.vehicle_manufacturer)+
    nm(v)+' <span class="g">'+(race?gapTxt(v):(v.best_lap_time>0?v.best_lap_time.toFixed(3):'—'))+(v.last_lap_time>0?' · '+v.last_lap_time.toFixed(3):'')+'</span></span>');
    if(i%10===9)info[(2+((i/10)|0))%4]()});
  var s=$('tkstrip'),html=h.join('');if(s.__h===html+html)return;setH(s,html+html);S.tickW=s.scrollWidth/2;if(S.tickOff<-S.tickW)S.tickOff=0}
function nm(v){var n=v.driver.full_name.replace(/\s*\(.*?\)|[#*]/g,'').trim().split(' ');return n.length>1?n.slice(-1)[0].replace('Jr.',n[n.length-2]+' Jr.'):n[0]}
function nmFull(v){return v.driver.full_name.replace(/\s*\(.*?\)|[#*]/g,'').trim()}
// ---------- leaderboard ----------
var ROWS=window.PWA&&innerWidth<innerHeight?99:17;
function renderBoard(){var f=S.feed,V=f.vehicles,fb=fastest(V),race=f.run_type===3,si=Math.max(0,idxOf(S.sel));
  var start=Math.max(0,Math.min(V.length-ROWS,si-Math.floor(ROWS/2)));if(si<ROWS-3)start=0;
  // v1.3: rows are persistent nodes patched in place, so badge <img>s survive polls instead of being re-created every 2.5 s
  var box=$('rows'),list=V.slice(start,start+ROWS);
  while(box.children.length<list.length){var d=document.createElement('div');d.innerHTML='<span class="ps"></span><span class="bd"></span><span class="dn"></span><span class="pt hidden">PIT</span><span class="gp"></span><span class="ll"></span>';box.appendChild(d)}
  while(box.children.length>list.length)box.removeChild(box.lastChild);
  list.forEach(function(v,i){var n=v.vehicle_number,r=box.children[i],c=r.children;
    if(r.dataset.n!==n)r.dataset.n=n;setC(r,'row'+(n===S.sel?' cur':'')+(n===S.focus?' foc':'')+(fb&&fb===v?' fast':''));
    setT(c[0],String(v.running_position));setH(c[1],badgeHTML(f.series_id,n,v.vehicle_manufacturer));setT(c[2],nm(v));hide(c[3],!inPit(v));
    setT(c[4],race?gapTxt(v):fmtT(v.best_lap_time));setT(c[5],fmtT(v.last_lap_time))})}
function idxOf(n){var V=S.feed?S.feed.vehicles:[];for(var i=0;i<V.length;i++)if(V[i].vehicle_number===n)return i;return -1}
function renderFocus(){var el=$('focus'),c=S.focus&&S.cars[S.focus],fin=S.feed.run_type===3&&S.feed.flag_state===9&&S.finishSeen&&(S.mode==='test'||performance.now()-S.finishSeen<30000);if(!c||fin){hide(el,true);return}
  var v=c.v,f=S.feed,V=f.vehicles,i=idxOf(S.focus),a=V[i-1],ahead='—';
  if(a&&v.delta>=0&&a.delta>=0)ahead='+'+(v.delta-a.delta).toFixed(3)+' to #'+a.vehicle_number;else if(!a)ahead='Leading';
  setH(el,'<span class="x">✕</span><div class="h">'+badgeHTML(f.series_id,v.vehicle_number,v.vehicle_manufacturer).replace('class="bdg"','class="bdg" style="height:60px"')+'<div><div class="nm">'+nmFull(v)+'</div><div class="mf">'+({Chv:'Chevrolet',Frd:'Ford',Tyt:'Toyota'}[v.vehicle_manufacturer]||v.vehicle_manufacturer||'')+(c.pit?' · ON PIT ROAD':'')+'</div></div><div class="pos">P'+v.running_position+'</div></div>'+
   '<div class="grid"><div><span>Gap to leader</span>'+gapTxt(v)+'</div><div><span>Car ahead</span>'+ahead+'</div><div><span>Last lap</span>'+fmtT(v.last_lap_time)+(v.last_lap_speed>0?' <small style="color:#aaa">'+v.last_lap_speed.toFixed(1)+'</small>':'')+'</div>'+
   '<div><span>Best lap</span>'+fmtT(v.best_lap_time)+'</div><div><span>Laps led</span>'+lapsLed(v)+'</div><div><span>Pit stops</span>'+stops(v)+'</div></div><div class="hint">Back to clear · ▲▼ OK to switch driver</div>');hide(el,false)}
function renderFinish(){var el=$('finish'),f=S.feed,show=f.run_type===3&&f.flag_state===9&&S.finishSeen&&(S.mode==='test'||performance.now()-S.finishSeen<30000);
  if(!show){hide(el,true);return}var V=f.vehicles,w=V[0];
  setH(el,'<div class="chk"></div><div class="k">CHECKERED FLAG</div><div class="w">'+badgeHTML(f.series_id,w.vehicle_number,w.vehicle_manufacturer).replace('class="bdg"','class="bdg" style="height:80px"')+'<div class="wn">'+nmFull(w)+' wins</div></div>'+
   '<div style="color:#bbb;font-size:22px">'+f.run_name+' · led '+lapsLed(w)+' laps</div><ol>'+V.slice(1,5).map(function(v){return '<li value="'+v.running_position+'">'+badgeHTML(f.series_id,v.vehicle_number,v.vehicle_manufacturer).replace('class="bdg"','class="bdg" style="height:28px"')+nmFull(v)+' <span style="color:#999">'+gapTxt(v)+'</span></li>'}).join('')+'</ol>'+
   (S.mode==='test'?'<div class="hint">Test race restarts in '+Math.max(0,Math.ceil(40-(clock()-(f._test.finishT||clock()))/S.speed))+'s · ◀ menu</div>':''));hide(el,false)}
function etDate(s){var d=new Date(s+'Z'),m=d.getUTCMonth(),dst=m>2&&m<10||(m===2&&d.getUTCDate()>=8)||(m===10&&d.getUTCDate()<1);return new Date(d.getTime()+(dst?4:5)*3600000)}
function loadNext(){var y=new Date().getFullYear();getJSON('https://cf.nascar.com/cacher/'+y+'/race_list_basic.json',function(j){if(!j)return;var best=null,now=Date.now();
  var per={};[1,2,3,4].forEach(function(s){var b=null;(j['series_'+s]||[]).forEach(function(r){var t=etDate(r.race_date).getTime();if(t>now-3*3600000&&(!b||t<b.t))b={t:t,r:r}});per[s]=b});S.next=per;renderNext()})}
function renderNext(){var el=$('next');if(S.mode==='test'||S.liveActive||!S.next){hide(el,true);return}
  var opt={weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZone:'America/New_York'},order=[1,2,3,4];
  if(S.series)order=[S.series].concat(order.filter(function(x){return x!==S.series}));
  var h='<div class="k">NEXT RACES</div>';order.forEach(function(s,i){var n=S.next[s],r=n&&n.r;
    h+='<div class="nr'+(i===0?' first':'')+'"><span class="ser" style="background:'+SCOL[s]+'">'+SHORT[s]+'</span>'+
      (r?'<div><div class="r">'+r.race_name+'</div><div class="t">'+r.track_name+' · '+new Date(n.t).toLocaleString('en-US',opt)+' ET</div></div>'
        :'<div><div class="t">'+(s===4?"Not in NASCAR's public timing feed":'No upcoming race listed')+'</div></div>')+'</div>'});
  setH(el,h+'<div class="hint">'+(window.PWA?'Nothing live right now. Tap Test race to try a demo.':'Nothing live right now. Press ◀ for the menu to watch a test race.')+'</div>');hide(el,false)}
// ---------- map ----------
var G={s:1,cx:0,cy:0};
function sc(p,lat){return [G.cx+p.x*G.s+p.nx*(lat||0),G.cy+p.y*G.s+p.ny*(lat||0)]}
function drawTrack(){var T=S.track,x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;T.pts.forEach(function(p){x0=Math.min(x0,p[0]);x1=Math.max(x1,p[0]);y0=Math.min(y0,p[1]);y1=Math.max(y1,p[1])});
  var mx=PHONE?90:150,my=PHONE?80:140;G.s=Math.min((W-2*mx)/(x1-x0),(H-2*my)/(y1-y0));G.cx=W/2-(x0+x1)/2*G.s;G.cy=H/2+10-(y0+y1)/2*G.s;
  var b=bg.getContext('2d');b.clearRect(0,0,W,H);if(PHONE){b.font='600 16px Inter'}b.lineJoin=b.lineCap='round';
  function path(lat){b.beginPath();for(var i=0;i<=300;i++){var q=sc(trackPoint(T,i/300),lat);i?b.lineTo(q[0],q[1]):b.moveTo(q[0],q[1])}b.closePath()}
  var tw=T.road?.62:1;path(0);b.strokeStyle='rgba(120,160,255,.08)';b.lineWidth=86*tw;b.stroke();b.strokeStyle='rgba(255,255,255,.55)';b.lineWidth=50*tw;b.stroke();b.strokeStyle='#252a36';b.lineWidth=46*tw;b.stroke();
  b.setLineDash([14,18]);b.strokeStyle='rgba(255,255,255,.10)';b.lineWidth=2;b.stroke();b.setLineDash([]);
  if(T.pit){b.beginPath();T.pit.forEach(function(q,i){var z=sc({x:q[0],y:q[1],nx:0,ny:0},0);i?b.lineTo(z[0],z[1]):b.moveTo(z[0],z[1])});b.strokeStyle='#3a4152';b.lineWidth=10;b.stroke()}
  else if(!T.road){b.beginPath();for(var i=-30;i<=30;i++){var q=sc(trackPoint(T,i/300*0.9),-44);i>-30?b.lineTo(q[0],q[1]):b.moveTo(q[0],q[1])}b.strokeStyle='#3a4152';b.lineWidth=12;b.stroke();
    var e=sc(trackPoint(T,-0.11),-44);b.fillStyle='rgba(255,255,255,.45)';b.font='600 16px Inter';b.textAlign='center';b.fillText('PIT ROAD',e[0]+60,e[1]-14)}
  var p=trackPoint(T,0),a=sc(p,-24),z=sc(p,24),k;for(k=0;k<8;k++){for(var j=0;j<2;j++){b.fillStyle=(k+j)%2?'#fff':'#000';var t=k/8,u=(k+1)/8;
    b.beginPath();b.moveTo(a[0]+(z[0]-a[0])*t+j*6*-p.ny,a[1]+(z[1]-a[1])*t+j*6*p.nx);b.lineTo(a[0]+(z[0]-a[0])*u+j*6*-p.ny,a[1]+(z[1]-a[1])*u+j*6*p.nx);
    b.lineTo(a[0]+(z[0]-a[0])*u+(j+1)*6*-p.ny,a[1]+(z[1]-a[1])*u+(j+1)*6*p.nx);b.lineTo(a[0]+(z[0]-a[0])*t+(j+1)*6*-p.ny,a[1]+(z[1]-a[1])*t+(j+1)*6*p.nx);b.fill()}}
  if(T.turns){b.fillStyle='rgba(255,255,255,.30)';b.font='700 '+(T.road?17:20)+'px Inter';b.textAlign='center';T.turns.forEach(function(t){var q=sc({x:t[0],y:t[1],nx:0,ny:0},0);b.fillText(t[2],q[0],q[1]+7)})}
  else if(!T.road){var ix=0,nx=0;for(var i=0;i<T.pts.length;i++){if(T.pts[i][0]>T.pts[ix][0])ix=i;if(T.pts[i][0]<T.pts[nx][0])nx=i}
    var fx=T.cum[ix]/T.len,fn=T.cum[nx]/T.len;b.fillStyle='rgba(255,255,255,.28)';b.font='700 20px Inter';b.textAlign='center';
    [[fx-.06,'T1'],[fx+.06,'T2'],[fn-.06,'T3'],[fn+.06,'T4']].forEach(function(t){var q=sc(trackPoint(T,t[0]),-62);b.fillText(t[1],q[0],q[1]+7)})}}
// dot radius: ~45% of the old 10px dot, scaled with how large the track is drawn (bigger on phone's virtual canvas)
function dotR(){return Math.max(3.6,Math.min(6,(PHONE?5.4:4.6)*Math.sqrt(G.s/(PHONE?250:470))))}
function wrap(d){d=((d%1)+1.5)%1-.5;return d}
function feedDt(now){return Math.max(0,Math.min(now-S.feedClock,90))} // keep dead-reckoning between ~30 s CDN refreshes; stop if stalled >90 s
function targetFrac(c,now){var dt=feedDt(now),f=S.feed;if(f.run_type===3){if(f.flag_state===8&&f.lap_number<=1&&f.elapsed_time<=0)return -c.off-0.001*c.rank;
  return c.leadLaps+S.lf+dt/S.lapT-c.off}return c.own+dt/(c.ownT||S.lapT)}
// Monotonic motion: cars only move forward at their expected pace; the estimate error is eased out over ~1.5 s
// by speeding up (max 2x) or slowing down (min 0.25x), never by jumping back. Snaps only on first sight,
// a new lap count / pit change, or when far behind the estimate. Race mode keeps running order (rubber band).
function advance(list,now,dts){var race=S.feed.run_type===3,stalled=now-S.feedClock>90;
  list.sort(function(a,b){return a.rank-b.rank});var prev=null;
  list.forEach(function(c){var tf=targetFrac(c,now),base=1/((race?S.lapT:c.ownT)||S.lapT||30),err=race?tf-c.pos:wrap(tf-c.pos);
    if(c.pos==null||S.freeze||isNaN(c.pos)){c.pos=tf}
    else if(c.reset&&Math.abs(err)>0.04||err>0.3||err<-(race?1:0.45)){c.pos+=err}
    else if(stalled){}
    else{var v=Math.max(0.25*base,Math.min(2*base,base+err/1.5));c.pos+=v*dts}
    c.reset=false;
    if(race&&!S.freeze&&prev&&!c.pit&&!prev.pit&&c.pos>prev.pos-0.0012)c.pos=Math.max(c.posPrev==null?-1e9:c.posPrev,prev.pos-0.0012);
    c.posPrev=c.pos;c.disp=((c.pos%1)+1)%1;if(!c.pit)prev=c})}
var lastF=0;
function liveTick(){if(!S.feed||S.mode!=='live')return;var f=S.feed,race=f.run_type===3,el=$('updago');if(!el){el=document.createElement('div');el.id='updago';el.style.cssText='position:fixed;right:10px;bottom:6px;font:500 12px Inter,sans-serif;color:rgba(255,255,255,.38);z-index:50;pointer-events:none';document.body.appendChild(el)}
  var ago=S.updWall?Math.round((Date.now()-S.updWall)/1000):0;el.textContent='NASCAR data updated '+ago+'s ago';
  if(race&&f.flag_state!==9&&f.flag_state!==8&&f.laps_in_race){var est=Math.min(f.laps_in_race,f.lap_number+Math.floor(S.lf+feedDt(clock())/S.lapT));setT('lap','LAP '+est+' / '+f.laps_in_race);setT('togo',f.laps_in_race-est>0?(f.laps_in_race-est)+' TO GO':'FINAL')}}
setInterval(liveTick,1000);
function frame(ts){requestAnimationFrame(frame);if(ts-lastF<(window.PWA?14:30)&&!S.freeze)return;var dts=Math.min(.25,(ts-lastF)/1000)*(S.mode==='test'?S.speed:1);lastF=ts;
  if(S.mode==='test'&&!S.freeze&&S.feed&&clock()-S.feedClock>2.5*S.speed)poll();
  if(S.tickW>0&&!S.freeze){S.tickOff-=dts*120;if(S.tickOff<=-S.tickW)S.tickOff+=S.tickW;$('tkstrip').style.transform='translate3d('+S.tickOff.toFixed(1)+'px,0,0)'}
  draw(dts)}
function draw(dts){cx.clearRect(0,0,W,H);cx.save();cx.setTransform(1,0,0,1,0,0);cx.drawImage(bg,0,0);cx.restore();if(!S.feed||!S.track)return;var now=clock(),T=S.track,list=[],f=S.feed;
  for(var n in S.cars){var c0=S.cars[n];if(c0.show)list.push(c0);else c0.pos=null}advance(list,now,dts);
  list.forEach(function(c){
    var lat=c.pit&&!T.road?-44:((c.rank%3)-1)*5,p=trackPoint(T,c.disp),q=sc(p,lat);c.x=q[0];c.y=q[1];c.p=p});
  var foc=S.focus&&S.cars[S.focus];
  // trail
  if(foc&&foc.show&&!foc.pit){cx.lineCap='round';for(var k=1;k<=14;k++){var a=sc(trackPoint(T,foc.disp-k*0.0032),((foc.rank%3)-1)*9),b=sc(trackPoint(T,foc.disp-(k-1)*0.0032),((foc.rank%3)-1)*9);
    cx.strokeStyle='rgba(255,176,102,'+(0.55*(1-k/15))+')';cx.lineWidth=12*(1-k/18);cx.beginPath();cx.moveTo(a[0],a[1]);cx.lineTo(b[0],b[1]);cx.stroke()}}
  list.sort(function(a,b){return b.rank-a.rank});
  var DR=dotR();list.forEach(function(c){if(c===foc)return;cx.globalAlpha=foc?.45:1;cx.beginPath();cx.arc(c.x,c.y,DR,0,7);cx.fillStyle=MF[c.v.vehicle_manufacturer]||'#ddd';cx.fill();cx.lineWidth=c.rank===0?1.6:1.1;cx.strokeStyle=c.rank===0?'#fff':'rgba(0,0,0,.9)';cx.stroke()});cx.globalAlpha=1;
  if(foc&&foc.show){cx.save();cx.shadowColor='#ffb066';cx.shadowBlur=26;cx.beginPath();cx.arc(foc.x,foc.y,DR*2,0,7);cx.fillStyle=MF[foc.v.vehicle_manufacturer]||'#ddd';cx.fill();cx.restore();
    cx.beginPath();cx.arc(foc.x,foc.y,DR*2+7,0,7);cx.strokeStyle='#ffb066';cx.lineWidth=3;cx.stroke();cx.beginPath();cx.arc(foc.x,foc.y,DR*2,0,7);cx.strokeStyle='#fff';cx.lineWidth=2;cx.stroke()}
  // badge layout: priority focus > running order; outward tiers then infield; skip if no room
  var placed=[];['focus','next'].forEach(function(id){var e=$(id);if(!PHONE&&!e.classList.contains('hidden'))placed.push([e.offsetLeft-6,e.offsetTop-6,e.offsetWidth+12,e.offsetHeight+12])});var pr=list.slice().sort(function(a,b){return (b===foc)-(a===foc)||a.rank-b.rank}),out=[];
  pr.forEach(function(c){var big=c===foc,bw=big?78:50,bh=big?70:45,tiers=big?[46,100,150,-60,-110]:[34,82,130,-38,-86],ok=null;
    for(var t=0;t<tiers.length&&!ok;t++){var d=tiers[t];if(c.pit&&d>0&&!T.road)d=-Math.abs(d)-30;var x=c.x+c.p.nx*d,y=c.y+c.p.ny*d,r=[x-bw/2,y-bh/2,bw,bh];
      if(x-bw/2<0||x+bw/2>W||y-bh/2<0||y+bh/2>H)continue;
      if(!placed.some(function(o){return r[0]<o[0]+o[2]+2&&o[0]<r[0]+r[2]+2&&r[1]<o[1]+o[3]+2&&o[1]<r[1]+r[3]+2}))ok={r:r,d:d,t:t}}
    if(!ok&&(big||c.rank<5)){var d2=tiers[0];ok={r:[c.x+c.p.nx*d2-bw/2,c.y+c.p.ny*d2-bh/2,bw,bh],d:d2,t:0}}
    if(ok){placed.push(ok.r);out.push({c:c,r:ok.r,t:ok.t,big:big})}});
  out.reverse().forEach(function(o){var c=o.c,r=o.r,mx=r[0]+r[2]/2,my=r[1]+r[3]/2;cx.globalAlpha=foc&&!o.big?.55:1;
    {cx.strokeStyle=o.big?'#ffb066':o.t>0?'rgba(255,255,255,.4)':'rgba(255,255,255,.22)';cx.lineWidth=o.big?2.5:1.2;cx.beginPath();cx.moveTo(c.x,c.y);cx.lineTo(mx,my);cx.stroke()}
    if(o.big){cx.fillStyle='rgba(10,12,18,.85)';rr(r[0]-8,r[1]-6,r[2]+16,r[3]+12,12);cx.fill();cx.strokeStyle='#ffb066';cx.lineWidth=3;cx.stroke()}
    var e=badgeImg(f.series_id,c.v.vehicle_number);
    if(e.ok)cx.drawImage(e.img,r[0],r[1],r[2],r[3]);else{cx.font='italic 900 '+(o.big?44:30)+'px Inter';cx.textAlign='center';cx.textBaseline='middle';cx.lineWidth=5;cx.strokeStyle='#000';cx.strokeText(c.v.vehicle_number,mx,my);cx.fillStyle=MF[c.v.vehicle_manufacturer]||'#fff';cx.fillText(c.v.vehicle_number,mx,my)}});
  cx.globalAlpha=1}
function rr(x,y,w,h,r){cx.beginPath();cx.moveTo(x+r,y);cx.arcTo(x+w,y,x+w,y+h,r);cx.arcTo(x+w,y+h,x,y+h,r);cx.arcTo(x,y+h,x,y,r);cx.arcTo(x,y,x+w,y,r);cx.closePath()}
// ---------- input ----------
function toast(t){var e=$('toast');e.textContent=t;e.classList.remove('hidden');clearTimeout(toast.h);toast.h=setTimeout(function(){e.classList.add('hidden')},2200)}
function menuItems(){var m=[['Live timing',function(){setMode('live')}],['Test race · 10 laps',function(){setMode('test');restartTest()}]];
  var ts=TestRace.series(),nx=ts===1?2:ts===2?3:1;m.push(['Test series <small>'+SHORT[ts]+' → '+SHORT[nx]+'</small>',function(){TestRace.series(nx);setMode('test',true);restartTest();toast('Test race: '+SERIES[nx])}]);
  if(S.mode==='test'){m.push(['Speed <small>'+S.speed+'x → '+(S.speed===1?2:S.speed===2?4:1)+'x</small>',function(){setSpeed(S.speed===1?2:S.speed===2?4:1)}]);m.push(['Restart test race',restartTest])}
  if(S.focus)m.push(['Stop following #'+S.focus,function(){setFocus(null)}]);m.push(['Close',function(){}]);return m}
function renderMenu(){var el=$('menu');if(!S.menu){el.classList.add('hidden');return}var m=menuItems();S.menuIdx=Math.min(S.menuIdx,m.length-1);
  el.innerHTML='<div class="mh">NASCAR LIVE</div>'+m.map(function(x,i){return '<div class="mi'+(i===S.menuIdx?' cur':'')+'">'+x[0]+'</div>'}).join('');el.classList.remove('hidden')}
function setMode(m,force){if(S.mode===m&&!force)return;S.mode=m;S.feed=null;S.cars={};S.trackId=null;S.finishSeen=0;$('finish').classList.add('hidden');if(m==='test'){simBase=-5;wallBase=performance.now()}poll();toast(m==='test'?'Test race':'Live timing')}
function setFocus(n){S.focus=n;if(n)S.sel=n;if(S.feed){renderBoard();renderFocus()}toast(n?(S.cars[n]?'Following #'+n:'Car #'+n+' is not in this session (will follow if it shows up)'):'Focus cleared')}
window.toggleMenu=function(){S.menu=!S.menu;S.menuIdx=0;renderMenu()};
window.onBackTV=function(){if(S.menu){S.menu=false;renderMenu();return true}if(S.focus){setFocus(null);return true}return false};
window.applyParams=function(o){if(o.series){S.series=serOf(o.series);if(S.series&&TestRace.has(S.series)){var was=TestRace.series();TestRace.series(S.series);if(S.mode==='test'&&was!==S.series)setMode('test',true)}renderNext()}if(o.mode)setMode(o.mode==='demo'?'test':o.mode);if(o.speed&&S.mode==='test')setSpeed(+o.speed);if(o.driver)setFocus(String(o.driver))};
document.addEventListener('keydown',function(e){var k=e.keyCode,V=S.feed?S.feed.vehicles:[];
  if(S.menu){var m=menuItems();if(k===38)S.menuIdx=(S.menuIdx+m.length-1)%m.length;else if(k===40)S.menuIdx=(S.menuIdx+1)%m.length;else if(k===13||k===23){S.menu=false;m[S.menuIdx][1]()}else if(k===39||k===27||k===8||k===37&&false)S.menu=false;renderMenu();e.preventDefault();return}
  if(k===38||k===40){var i=idxOf(S.sel);i=Math.max(0,Math.min(V.length-1,i+(k===38?-1:1)));if(V[i])S.sel=V[i].vehicle_number;renderBoard();e.preventDefault()}
  else if(k===13||k===23){if(S.sel)setFocus(S.sel===S.focus?null:S.sel);e.preventDefault()}
  else if(k===37||k===77||k===82){toggleMenu();e.preventDefault()}
  else if(k===39&&S.mode==='test'){setSpeed(S.speed===1?2:S.speed===2?4:1)}
  else if(k===27||k===8){onBackTV()}});
// ---------- touch / click (PWA) ----------
function tapCar(n){setFocus(S.focus===n?null:n)}
$('rows').addEventListener('click',function(e){var r=e.target.closest('.row');if(r&&r.dataset.n)tapCar(r.dataset.n)});
cv.addEventListener('click',function(e){var rc=cv.getBoundingClientRect(),x=(e.clientX-rc.left)*W/rc.width,y=(e.clientY-rc.top)*H/rc.height,best=null,bd=PHONE?40:30;
  for(var n in S.cars){var c=S.cars[n];if(!c.show||c.x==null)continue;var d=Math.hypot(c.x-x,c.y-y);if(d<bd){bd=d;best=n}}if(best)tapCar(best)});
$('focus').addEventListener('click',function(e){if(e.target.closest('.x'))setFocus(null)});
window.NL={setMode:function(m){setMode(m,true);if(m==='test')restartTest()},setSpeed:setSpeed,restart:restartTest,series:function(x){applyParams({series:x})},state:S};
window.addEventListener('resize',function(){clearTimeout(layout.t);layout.t=setTimeout(layout,150)});
// ---------- headless render hook (deterministic frames for previews/video) ----------
window.__render=function(t){if(S.series&&TestRace.has(S.series))TestRace.series(S.series);S.freeze=true;S.mode='test';simBase=t;ingest(TestRace.feed(t),t);if(S.feed.flag_state===9&&!S.finishSeen)S.finishSeen=1;renderFocus();renderFinish();
  if(S.tickW){S.tickOff=-((t*120/8)%S.tickW);$('tkstrip').style.transform='translate3d('+S.tickOff+'px,0,0)'}draw(0);return S.feed.lap_number};
// ---------- boot ----------
layout();
window.__S=S;window.__ingest=ingest;
if(S.series&&TestRace.has(S.series))TestRace.series(S.series);
setInterval(function(){if(S.mode==='live'&&!S.freeze)poll()},2500);
setInterval(function(){if(S.mode==='test'&&!S.freeze&&S.feed&&S.feed.flag_state===9&&clock()-(S.feed._test.finishT||1e9)>40*S.speed)restartTest();if(S.feed&&S.feed.flag_state===9)renderFinish()},1000);
if(Q.simt&&S.mode==='test'){window.__render(+Q.simt)}else poll();
loadNext();requestAnimationFrame(frame);
})();
