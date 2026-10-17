// Synthetic 10-lap TEST RACE at Charlotte (1.5 mi), emitted in the exact live-feed.json shape.
(function(){
var LAPS=10,DT=0.1,CAUTION_AT=4.45,RESTART_AT=6.0,SER=1,LEN,GREEN,CAUT,TRK;
var CFG={1:{len:1.5,green:29.6,caut:48,track:[162,'Charlotte Motor Speedway'],name:'McMakin Test 10'},
         2:{len:1.0,green:27.9,caut:44,track:[84,'Phoenix Raceway'],name:'McMakin Test 10'},
         3:{len:0.526,green:20.6,caut:32,track:[22,'Martinsville Speedway'],name:'McMakin Test 10'}};
function cfg(){var c=CFG[SER]||CFG[1];LEN=c.len;GREEN=c.green;CAUT=c.caut;TRK=c.track}cfg();
function rnd(seed){var x=Math.sin(seed*12.9898+78.233)*43758.5453;return x-Math.floor(x)}
var st=null;
function init(){var R=(window.ROSTERS&&window.ROSTERS[SER]||window.ROSTER).slice(),i;
  R.sort(function(a,b){return rnd(+a[0]*7+3)-rnd(+b[0]*7+3)});
  st={t:-6,flag:1,cars:[],leadChanges:0,leaders:{},lastLeader:null,cautions:0,cautionLaps:0,done:false,finishT:null};
  for(i=0;i<R.length;i++){var c=R[i];st.cars.push({num:c[0],name:c[1],mf:c[2],id:c[3],start:i+1,
    skill:i*0.018+rnd(i*31+1)*0.35, dist:-(Math.floor(i/2)*0.0065+(i%2)*0.0012)-0.02, lastCross:null,lastLap:0,lastSpd:0,best:0,bestSpd:0,bestLapN:0,laps:0,
    pit:null,pits:[{positions_gained_lossed:0,pit_in_elapsed_time:0,pit_in_lap_count:0,pit_in_leader_lap:0,pit_out_elapsed_time:0,pit_in_rank:0,pit_out_rank:i+1}],
    led:[],willPit:rnd(i*17+5)<0.7||c[0]==='51',repair:c[0]==='51',fin:false,finPos:0})}
}
function order(){return st.cars.slice().sort(function(a,b){return b.dist-a.dist})}
function step(){var O=order(),L=O[0],i,t=st.t;
  if(st.flag===1&&!st.cautionDone&&L.dist>=CAUTION_AT){st.flag=2;st.cautions=1;st.cautionStart=Math.floor(L.dist)+1}
  if(st.flag===2&&L.dist>=RESTART_AT&&(L.dist%1)<0.02){var field=O.filter(function(c){return !c.repair&&L.dist-c.dist<1}),tail=field[field.length-1];
    if(!field.some(function(c){return c.pit})&&L.dist-tail.dist<0.3){st.flag=1;st.cautionDone=true;st.restartAt=L.dist;st.cautionLaps=Math.floor(L.dist)-st.cautionStart+1}}
  if(st.flag===1&&L.dist>=LAPS-1&&!st.done)st.flag=4;
  for(i=0;i<O.length;i++){var c=O[i],ahead=O[i-1],lapN=Math.floor(c.dist)+1,v;
    var pace=1/(GREEN+c.skill+(rnd(+c.num*101+lapN*13)-.5)*0.7);
    if(t<0){v=1/GREEN*0.97}
    else if(c.fin){v=1/36}
    else if(st.flag===2&&!c.pit){var gap=ahead?ahead.dist-c.dist:1;v=i===0?1/CAUT:Math.min(1/GREEN,Math.max(0.3/CAUT,(1+(gap-0.007)*30)/CAUT))}
    else{v=pace;if(ahead&&ahead.dist-c.dist<0.006&&ahead.dist-c.dist>0.0015)v*=1.006; // draft
      if(st.flag===1&&st.cautionDone&&L.dist<st.restartAt+0.06)v=Math.min(v,1/(GREEN*1.05))}
    // pit road: enter at 4.94 under caution, box, exit 5.06
    if(st.flag===2&&c.willPit&&!c.pitDone&&!c.pit&&c.dist>=4.94&&c.dist<5.0){c.pit={box:4.96+0.08*(c.start/40),stop:c.repair?62:12+rnd(+c.num)*4,stopped:0,inT:t,inRank:i+1};
      c.pits.push({positions_gained_lossed:0,pit_in_elapsed_time:+t.toFixed(3),pit_in_lap_count:c.laps,pit_in_leader_lap:L.laps,pit_out_elapsed_time:0,pit_in_rank:i+1,pit_out_rank:0})}
    if(c.pit){var p=c.pit;if(c.dist>=p.box&&p.stopped<p.stop){p.stopped+=DT;v=0}else v=1/(CAUT*1.4);
      if(c.dist>=5.06){var s=c.pits[c.pits.length-1];s.pit_out_elapsed_time=+t.toFixed(3);c.pit=null;c.pitDone=true;c.pitOutPending=true}}
    var nd=c.dist+v*DT;
    if(Math.floor(nd)>Math.floor(c.dist)&&nd>=0){ // crossed the line
      if(c.lastCross!==null&&!c.fin){c.lastLap=+(t+DT-c.lastCross).toFixed(3);c.lastSpd=+(LEN*3600/c.lastLap).toFixed(3);c.laps++;
        if(st.flag!==2&&(!c.best||c.lastLap<c.best)&&c.laps>1){c.best=c.lastLap;c.bestSpd=c.lastSpd;c.bestLapN=c.laps}
        if(i===0&&!st.done){var lp=c.laps;if(st.lastLeader!==c.num){if(st.lastLeader)st.leadChanges++;st.leaders[c.num]=1;st.lastLeader=c.num;c.led.push({start_lap:lp,end_lap:lp})}
          else{var l=c.led[c.led.length-1];l.end_lap=lp}}
        if(!st.done&&i===0&&c.laps>=LAPS){st.done=true;st.flag=9;st.finishT=t}
        if(st.done){c.fin=true;c.finT=t;c.finPos=st.cars.filter(function(x){return x.fin}).length}}
      else if(c.lastCross===null)c.lastCross=0;
      c.lastCross=t+DT}
    c.dist=nd}
  st.t+=DT}
window.TestRace={laps:LAPS,series:function(x){if(x&&x!==SER&&CFG[x]){SER=x;cfg();st=null}return SER},has:function(x){return !!CFG[x]&&!!(window.ROSTERS||{})[x]},
 feed:function(simT){if(!st||simT<st.t-0.05)init();while(st.t<simT)step();var O=order(),L=O[0],lt=L.lastLap||GREEN;
  if(st.done)O.sort(function(a,b){return (b.laps-a.laps)||((a.fin?a.finPos:99-a.dist)-(b.fin?b.finPos:99-b.dist))});
  var V=O.map(function(c,i){var gapL=L.dist-c.dist,delta=gapL>=1&&L.laps-c.laps>=1?-Math.floor(gapL):+(gapL*lt).toFixed(3);if(st.done&&c.fin&&c.laps>=L.laps)delta=+(c.finT-L.finT).toFixed(3);else if(st.done&&L.laps-c.laps>=1)delta=-(L.laps-c.laps);
    if(c.pitOutPending){c.pits[c.pits.length-1].pit_out_rank=i+1;c.pits[c.pits.length-1].positions_gained_lossed=c.pits[c.pits.length-1].pit_in_rank-(i+1);c.pitOutPending=false}
    return {average_restart_speed:0,average_running_position:0,average_speed:c.lastSpd,best_lap:c.bestLapN,best_lap_speed:c.bestSpd,best_lap_time:c.best,vehicle_manufacturer:c.mf,vehicle_number:c.num,
     driver:{driver_id:c.id,full_name:c.name,first_name:c.name.split(' ')[0],last_name:c.name.split(' ').slice(1).join(' '),is_in_chase:false},
     vehicle_elapsed_time:+(c.lastCross||0).toFixed(3),fastest_laps_run:0,laps_position_improved:0,laps_completed:c.laps,laps_led:c.led.slice(),last_lap_speed:c.lastSpd,last_lap_time:c.lastLap,
     passes_made:0,passing_differential:0,position_differential_last_10_percent:0,pit_stops:c.pits.map(function(p){return Object.assign({},p)}),qualifying_status:0,running_position:i+1,status:1,
     delta:i===0?0:delta,sponsor_name:'',starting_position:c.start,times_passed:0,quality_passes:0,is_on_track:true,is_on_dvp:false}});
  var lapNo=Math.max(1,Math.min(LAPS,Math.floor(L.dist)+1)),now=new Date(),stg=L.dist<5?{stage_num:1,finish_at_lap:5,laps_in_stage:5}:{stage_num:2,finish_at_lap:10,laps_in_stage:5};
  return {lap_number:lapNo,elapsed_time:+Math.max(0,simT).toFixed(3),flag_state:simT<0?8:st.flag,race_id:0,laps_in_race:LAPS,laps_to_go:st.done?0:LAPS-Math.max(0,Math.floor(L.dist)),vehicles:V,run_id:0,
   run_name:'McMakin Test 10 (demo)',series_id:SER,time_of_day:0,time_of_day_os:now.toISOString(),track_id:TRK[0],track_length:LEN,track_name:TRK[1],run_type:3,
   number_of_caution_segments:st.cautions,number_of_caution_laps:st.cautionLaps||(st.flag===2?Math.max(0,lapNo-(st.cautionStart||lapNo)):0),number_of_lead_changes:st.leadChanges,number_of_leaders:Object.keys(st.leaders).length,avg_diff_1to3:0,stage:stg,
   _test:{finishT:st.finishT}}}};
})();
