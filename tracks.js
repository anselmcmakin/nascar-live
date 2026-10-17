// Track outlines (approximations), counter-clockwise on screen, frontstretch at the bottom, frac 0 = start/finish.
(function(){
function stadium(a,r,o){o=o||{};var P=[],N=360,L=4*a+2*Math.PI*r,i;
  for(i=0;i<N;i++){var s=i/N*L,x,y;
    if(s<a){x=s;y=r}else if(s<a+Math.PI*r){var t=(s-a)/r;x=a+r*Math.sin(t);y=r*Math.cos(t)}
    else if(s<3*a+Math.PI*r){x=a-(s-a-Math.PI*r);y=-r}else if(s<3*a+2*Math.PI*r){var t2=(s-3*a-Math.PI*r)/r;x=-a-r*Math.sin(t2);y=-r*Math.cos(t2)}
    else{x=-a+(s-3*a-2*Math.PI*r);y=r}
    if(o.bow&&y>0&&Math.abs(x)<a*1.25){var u=Math.min(1,Math.abs(x)/(a*1.25));y+=o.bow*Math.pow(1-u*u,1.4)*(y/r)}
    if(o.back&&y<0&&x<a*.3&&x>-a*1.2){var v=(x+a*.45)/(a*.75);y-=o.back*Math.max(0,1-v*v)}
    if(o.egg){y*=1-o.egg*(x/(a+r)+1)/2}
    P.push([x,y])}return P}
function superel(a,b,n){var P=[];for(var i=0;i<360;i++){var t=Math.PI/2-i/360*2*Math.PI,c=Math.cos(t),s=Math.sin(t);
  P.push([a*Math.sign(c)*Math.pow(Math.abs(c),2/n),b*Math.sign(s)*Math.pow(Math.abs(s),2/n)])}return P}
function spline(pts){var P=[],n=pts.length;for(var i=0;i<n;i++){var p0=pts[(i-1+n)%n],p1=pts[i],p2=pts[(i+1)%n],p3=pts[(i+2)%n];
  for(var k=0;k<24;k++){var t=k/24,t2=t*t,t3=t2*t;P.push([0,1].map(function(j){return .5*((2*p1[j])+(-p0[j]+p2[j])*t+(2*p0[j]-5*p1[j]+4*p2[j]-p3[j])*t2+(-p0[j]+3*p1[j]-3*p2[j]+p3[j])*t3)}))}}return P}
var S={
 triOval:function(){return stadium(.62,.42,{bow:.13})}, superTri:function(){return stadium(.8,.4,{bow:.12})},
 dOval:function(){return stadium(.55,.45,{bow:.09})}, oval:function(){return stadium(.5,.45)},
 paperclip:function(){return stadium(.85,.27)}, bowl:function(){return stadium(.32,.45)}, egg:function(){return stadium(.55,.44,{egg:.22})},
 phoenix:function(){return stadium(.5,.4,{back:.14})}, indy:function(){return superel(1,.42,7)},
 pocono:function(){return spline([[0,.42],[.6,.42],[.95,.3],[.55,-.15],[.08,-.55],[-.25,-.4],[-.75,.15],[-.6,.42]])},
 road:function(){return spline([[0,.45],[.75,.45],[.95,.25],[.7,.05],[.85,-.25],[.6,-.45],[.2,-.3],[-.05,-.48],[-.5,-.45],[-.6,-.1],[-.9,0],[-.85,.35],[-.5,.45]])}
};
var BY_ID={162:'triOval',43:'triOval',41:'triOval',42:'triOval',40:'oval',111:'triOval',61:'triOval',39:'dOval',38:'dOval',133:'dOval',52:'oval',
 105:'superTri',82:'superTri',22:'paperclip',14:'bowl',159:'bowl',177:'oval',26:'dOval',206:'oval',138:'oval',103:'oval',45:'egg',47:'oval',51:'indy',175:'oval',
 4:'egg',84:'phoenix',123:'indy',198:'pocono'};
var ROAD=[157,210,214,204,218,1001,75,220,1002,221,99,222,72,34,209,211,212];
window.trackShape=function(id,type){var k=BY_ID[id];if(!k){type=(type||'').trim();
  k=(ROAD.indexOf(id)>=0||/Road|Street/.test(type))?'road':type==='Superspeedway'?'superTri':/Short/.test(type)?'bowl':'triOval'}
  var P=S[k](),i=0,best=1e9;for(var j=0;j<P.length;j++){var d=Math.abs(P[j][0])+(P[j][1]>0?0:9);if(d<best){best=d;i=j}}
  P=P.slice(i).concat(P.slice(0,i));var L=[0];for(j=1;j<=P.length;j++){var a=P[j-1],b=P[j%P.length];L.push(L[j-1]+Math.hypot(b[0]-a[0],b[1]-a[1]))}
  return {kind:k,pts:P,cum:L,len:L[L.length-1],road:k==='road'}};
// point at fraction f (0..1) -> {x,y,nx,ny} in shape coords, n = outward normal
window.trackPoint=function(T,f){f=((f%1)+1)%1;var s=f*T.len,lo=0,hi=T.cum.length-1;while(hi-lo>1){var m=(lo+hi)>>1;if(T.cum[m]<=s)lo=m;else hi=m}
  var a=T.pts[lo%T.pts.length],b=T.pts[(lo+1)%T.pts.length],t=(s-T.cum[lo])/((T.cum[lo+1]-T.cum[lo])||1),dx=b[0]-a[0],dy=b[1]-a[1],d=Math.hypot(dx,dy)||1;
  return {x:a[0]+dx*t,y:a[1]+dy*t,nx:-dy/d,ny:dx/d}};
})();
