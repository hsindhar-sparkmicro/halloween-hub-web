import {WelcomeFloat} from './welcome-float.js';
import {WelcomeMessages} from './welcome-messages.js';
import {BackgroundRotation} from './background-rotation.js';
import {IdleBackgroundVideo} from './idle-background-video.js';
import {NightWeather} from './night-weather.js';
// Locally rendered atmosphere. Cached sprites keep the Pi's per-frame work small.
export class WelcomeAtmosphere {
 constructor(canvas){
  this.canvas=canvas;this.ctx=canvas.getContext('2d');this.settings={};this.frame=0;this.draws=0;this.elapsed=0;this.last=0;this.visible=false;
  this.weatherCanvas=document.querySelector('#night-weather-canvas');this.weatherCtx=this.weatherCanvas.getContext('2d');this.weather=new NightWeather(this.weatherCanvas);this.backgrounds=new BackgroundRotation();this.idleVideo=new IdleBackgroundVideo(this.backgrounds);this.messages=new WelcomeMessages();this.float=new WelcomeFloat();
  this.glows=new Map();this.ghosts=[];this.nextGhost=2;this.low=true;
  this.art=new Image();this.art.src='./assets/art-sheet.png';this.art.onload=()=>{this.ghostSprite=document.createElement('canvas');this.ghostSprite.width=this.ghostSprite.height=192;const c=this.ghostSprite.getContext('2d'),sw=this.art.naturalWidth/3,sh=this.art.naturalHeight/2;c.drawImage(this.art,0,sh,sw,sh,0,0,192,192);c.globalCompositeOperation='destination-in';const g=c.createRadialGradient(96,96,30,96,96,94);g.addColorStop(0,'#000');g.addColorStop(.35,'#000');g.addColorStop(1,'transparent');c.fillStyle=g;c.fillRect(0,0,192,192);this.draw();};
  this.clouds=Array.from({length:18},()=>({x:Math.random(),y:.53+Math.random()*.43,r:.14+Math.random()*.21,speed:.003+Math.random()*.012,phase:Math.random()*6.28,alpha:.11+Math.random()*.19}));
  this.embers=Array.from({length:30},()=>({x:Math.random(),y:Math.random(),speed:.01+Math.random()*.025,phase:Math.random()*6.28}));
  this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(canvas);
  this.motion=matchMedia('(prefers-reduced-motion: reduce)');this.motion.addEventListener('change',()=>this.refresh());
  this.observer=new MutationObserver(()=>this.refresh());this.observer.observe(document.body,{subtree:true,attributes:true,attributeFilter:['class','open']});
  document.addEventListener('visibilitychange',()=>this.refresh());this.resize();
 }
 configure(settings,backgrounds=[],cutscenes=[]){this.backgrounds.configure(backgrounds);this.idleVideo.configure(cutscenes);this.settings=settings;const low=settings.quality==='low'||settings.quality==='auto'&&innerWidth<=1000;if(this.low!==low){this.low=low;this.resize();}this.refresh();}
 resize(){const r=this.canvas.getBoundingClientRect();if(!r.width||!r.height)return;this.width=r.width;this.height=r.height;const dpr=this.low?1:Math.min(devicePixelRatio,1.5);for(const canvas of [this.canvas,this.weatherCanvas]){canvas.width=Math.round(r.width*dpr);canvas.height=Math.round(r.height*dpr);canvas.getContext('2d').setTransform(dpr,0,0,dpr,0,0);}this.draw();}
 refresh(){
  const visible=document.querySelector('#dashboard').classList.contains('active')&&!document.hidden&&!document.querySelector('dialog[open]');
  const reduced=this.settings.reduced_motion||this.motion.matches;
  this.idleVideo.setAllowed(visible&&!reduced);
  const changed=visible!==this.visible||reduced!==this.reduced;this.visible=visible;this.reduced=reduced;
  document.querySelector('#dashboard').classList.toggle('atmosphere-paused',!visible);
  if(!visible||reduced){cancelAnimationFrame(this.frame);this.frame=0;this.last=0;if(visible&&changed)this.draw();return;}
  if(this.frame)return;
  const tick=now=>{if(!this.visible){this.frame=0;return;}if(!this.last)this.last=now;
   if(now-this.last>=33){this.elapsed+=Math.min((now-this.last)/1000,.12);this.last=now;this.draw();}
   this.frame=requestAnimationFrame(tick);
  };this.last=0;this.frame=requestAnimationFrame(tick);
 }
 glow(x,y,r,color,alpha=1){
  let sprite=this.glows.get(color);if(!sprite){sprite=document.createElement('canvas');sprite.width=sprite.height=192;const c=sprite.getContext('2d'),g=c.createRadialGradient(96,96,0,96,96,96);g.addColorStop(0,color);g.addColorStop(.35,color);g.addColorStop(1,'transparent');c.fillStyle=g;c.fillRect(0,0,192,192);this.glows.set(color,sprite);}
  this.ctx.globalAlpha=alpha;this.ctx.drawImage(sprite,x-r,y-r,r*2,r*2);this.ctx.globalAlpha=1;
 }
 spawnGhost(){const direction=Math.random()<.5?1:-1;this.ghosts.push({direction,born:this.elapsed,duration:18+Math.random()*18,y:.24+Math.random()*.42,size:.13+Math.random()*.15,phase:Math.random()*6.28});}
 draw(){
  if(!this.width||!this.height)return;
  const c=this.ctx,w=this.width,h=this.height,t=this.elapsed;this.draws++;c.clearRect(0,0,w,h);
  const moving=!this.settings.reduced_motion&&!this.motion.matches;this.weather.advance(t,moving,this.low);
  const imported=this.backgrounds.draw(t,!this.settings.reduced_motion&&!this.motion.matches);
  this.idleVideo.update();
  this.messages.draw(t,!this.settings.reduced_motion&&!this.motion.matches);
  this.float.draw(t,!this.settings.reduced_motion&&!this.motion.matches);
  this.glow(w*.49,h*.63,h*.61,'#ed773b',(.1+Math.sin(t*.38)*.025)*(1-this.weather.winter*.75));
  this.glow(w*.84,h*.19,h*.42,'#827ed8',.09+Math.sin(t*.23+2)*.025);
  for(const cloud of this.clouds.slice(0,this.low?9:18)){
   const x=((cloud.x+t*cloud.speed)%1.5-.25)*w,y=(cloud.y+Math.sin(t*.15+cloud.phase)*.05)*h;
   this.glow(x,y,cloud.r*w,'#aaa0c6',cloud.alpha*(.7+Math.sin(t*.21+cloud.phase)*.3)*(1-imported*.45));
  }
  if(moving&&t>=this.nextGhost&&this.ghosts.length<(this.low?2:3)){this.spawnGhost();this.nextGhost=t+9+Math.random()*11;}
  this.ghosts=this.ghosts.filter(ghost=>t-ghost.born<ghost.duration);
  for(const ghost of this.ghosts){
   const progress=(t-ghost.born)/ghost.duration,x=(ghost.direction===1?progress:1-progress)*(w+200)-100,y=ghost.y*h+Math.sin(t*.65+ghost.phase)*h*.08,size=ghost.size*h,alpha=Math.sin(progress*Math.PI)*.58;
   c.save();c.globalAlpha=alpha;c.translate(x,y);c.rotate(Math.sin(t*.3+ghost.phase)*.14);
   if(this.ghostSprite)c.drawImage(this.ghostSprite,-size/2,-size/2,size,size);
   c.restore();
  }
  for(const ember of this.embers.slice(0,this.low?12:30)){const x=(ember.x+Math.sin(t*.15+ember.phase)*.03)*w,y=((ember.y-t*ember.speed)%1+1)%1*h;c.globalAlpha=(.12+Math.sin(t*.4+ember.phase)**2*.36)*(1-this.weather.winter);c.fillStyle='#ffba7d';c.beginPath();c.arc(x,y,1.2,0,Math.PI*2);c.fill();}c.globalAlpha=1;
  this.weatherCtx.clearRect(0,0,w,h);this.weather.draw(this.weatherCtx,w,h,moving);
 }
}
