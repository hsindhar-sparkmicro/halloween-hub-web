// Decorative weather on the shared welcome clock, independent of the real forecast.
const random=(min,max)=>min+Math.random()*(max-min);
const smooth=value=>{const x=Math.max(0,Math.min(1,value));return x*x*(3-2*x);};
export class NightWeather {
 constructor(canvas){
  this.canvas=canvas;this.status=document.querySelector('#night-weather');
  this.mode='calm';this.next='leaves';this.started=0;this.duration=6;this.last=0;this.particles=[];this.credit=0;this.direction=1;this.blend=0;this.gust=0;
  this.leaves=['#d37b32','#a74b2c','#d5a348'].map((color,index)=>this.leaf(color,index));
  this.flake=document.createElement('canvas');this.flake.width=this.flake.height=48;
  const c=this.flake.getContext('2d'),g=c.createRadialGradient(24,24,1,24,24,23);g.addColorStop(0,'#f6fbff');g.addColorStop(.25,'#e6f3ffdd');g.addColorStop(1,'#c6ddff00');c.fillStyle=g;c.fillRect(0,0,48,48);
 }
 leaf(color,index){
  const sprite=document.createElement('canvas');sprite.width=sprite.height=128;const c=sprite.getContext('2d');
  c.translate(64,64);c.fillStyle=color;c.strokeStyle='#482b25';c.lineWidth=2;
  c.beginPath();
  if(index===0){c.moveTo(-46,25);c.lineTo(-41,3);c.lineTo(-59,-10);c.lineTo(-33,-13);c.lineTo(-39,-37);c.lineTo(-16,-28);c.lineTo(0,-59);c.lineTo(13,-28);c.lineTo(37,-42);c.lineTo(33,-15);c.lineTo(59,-12);c.lineTo(40,6);c.lineTo(45,27);c.lineTo(13,23);c.lineTo(0,43);c.lineTo(-13,25);}
  else if(index===1){c.moveTo(0,-57);c.bezierCurveTo(52,-42,51,21,0,48);c.bezierCurveTo(-50,18,-45,-32,0,-57);}
  else{c.moveTo(0,-58);c.bezierCurveTo(30,-48,8,-34,30,-27);c.bezierCurveTo(55,-16,23,-4,37,7);c.bezierCurveTo(52,29,15,29,0,48);c.bezierCurveTo(-16,29,-49,28,-35,8);c.bezierCurveTo(-23,-4,-52,-19,-28,-28);c.bezierCurveTo(-6,-36,-29,-48,0,-58);}
  c.closePath();c.fill();c.stroke();c.strokeStyle='#f4c88499';c.lineWidth=2;c.beginPath();c.moveTo(0,56);c.lineTo(0,-44);c.moveTo(0,12);c.lineTo(-22,-4);c.moveTo(0,-8);c.lineTo(20,-24);c.stroke();return sprite;
 }
 change(){
  this.started+=this.duration;this.particles=[];this.credit=0;
  if(this.mode==='calm'){this.mode=this.next;this.next=this.mode==='leaves'?'snow':'leaves';this.duration=this.mode==='leaves'?random(20,28):random(28,36);this.direction=Math.random()<.5?-1:1;}
  else{this.mode='calm';this.duration=random(9,15);}
 }
 advance(time,moving,low){
  const dt=Math.max(0,Math.min(.12,time-this.last));this.last=time;
  if(!moving){this.blend=0;this.gust=0;this.describe('still');return;}
  // Paused/off-screen time never advances the welcome clock; no catch-up burst.
  while(time-this.started>=this.duration)this.change();
  const age=time-this.started;this.blend=this.mode==='calm'?0:smooth(age/4)*smooth((this.duration-age)/4);
  this.gust=this.mode==='leaves'?this.blend*(.25+.75*Math.sin(age*.44)**2):this.blend*(.2+.8*Math.sin(age*.16)**2);
  this.describe(this.mode);
  const limit=this.mode==='leaves'?(low?28:54):(low?90:180);
  this.credit+=dt*(this.mode==='leaves'?(8+this.gust*18):this.mode==='snow'?(12+this.gust*9):0)*this.blend;
  while(this.credit>=1){this.credit--;if(this.particles.length<limit)this.spawn();}
  for(const p of this.particles){
   p.age+=dt;
   if(this.mode==='leaves'){p.x+=this.direction*dt*(.13+this.gust*.33)*p.speed;p.y+=dt*(.035+Math.sin(p.age*2.4+p.phase)*.045-this.gust*.035);p.angle+=dt*p.spin*(.5+this.gust*2);}
   else{p.x+=dt*(this.direction*this.gust*.045+Math.sin(p.age*.8+p.phase)*.018);p.y+=dt*p.speed;}
  }
  this.particles=this.particles.filter(p=>p.x>-.2&&p.x<1.2&&p.y<1.12&&p.age<32);
  if(this.particles.length>limit)this.particles.length=limit;
 }
 spawn(){
  const leaf=this.mode==='leaves';
  this.particles.push({x:leaf?(this.direction>0?-.08:1.08):random(-.08,1.08),y:leaf?random(.1,.9):random(-.15,-.02),age:0,speed:leaf?random(.75,1.4):random(.035,.105),phase:random(0,Math.PI*2),size:leaf?random(9,21):random(1.4,4),angle:random(0,Math.PI*2),spin:random(-3.5,3.5),sprite:Math.floor(Math.random()*3)});
 }
 describe(mode){
  if(this.canvas.dataset.weather===mode)return;this.canvas.dataset.weather=mode;
  if(this.status){this.status.dataset.weather=mode;this.status.querySelector('span').textContent={calm:'Quiet night',leaves:'Autumn wind',snow:'Winter flurries',still:'Still night'}[mode];}
 }
 draw(c,w,h,moving){
  if(!moving||this.mode==='calm'||!this.blend)return;
  c.save();const scale=Math.max(.85,Math.min(2.2,h/480));
  if(this.mode==='snow'){c.globalAlpha=this.blend*.055;c.fillStyle='#8eb4df';c.fillRect(0,0,w,h);}
  for(const p of this.particles){
   const alpha=this.blend*smooth(p.age/.65)*(this.mode==='leaves'?.8:.7),size=p.size*scale;
   c.globalAlpha=alpha;
   if(this.mode==='leaves'){c.save();c.translate(p.x*w,p.y*h);c.rotate(p.angle);c.scale(.22+.78*Math.abs(Math.cos(p.age*3+p.phase)),1);c.drawImage(this.leaves[p.sprite],-size/2,-size/2,size,size);c.restore();}
   else c.drawImage(this.flake,p.x*w-size,p.y*h-size,size*2,size*2);
  }
  c.restore();
 }
 get winter(){return this.mode==='snow'?this.blend:0;}
}
