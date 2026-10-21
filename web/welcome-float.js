// Each line has an independent slow route and appearance schedule on the welcome clock.
const random=(min,max)=>min+Math.random()*(max-min);
const ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
const selectors=[
 '.welcome-eyebrow','.welcome-countdown h1>span>span','.welcome-countdown h1>span>em',
 '.welcome-countdown .digit:nth-child(1)','.welcome-countdown .digit:nth-child(3)',
 '.welcome-countdown .digit:nth-child(5)','.welcome-countdown .countdown-target',
 '.welcome-weather h2','#weather-icon','#temperature','#weather-condition','#weather-detail',
 '#weather-location','#weather-status','.welcome-sound-title','.welcome-sound-description',
 '#ambience-toggle','.pumpkin-caption .pumpkin-instruction','.pumpkin-caption small'
];
export class WelcomeFloat {
 constructor(){
  this.lines=selectors.map(selector=>{
   // Tight rows keep their gaps even when neighboring lines travel opposite ways.
   const maxX=selector.includes('.digit')?2:18;
   const maxY=selector.includes('.welcome-sound')?2:selector.includes('.digit')?4:3;
   return {selector,maxX,maxY,element:null,start:-random(0,20),duration:random(28,50),from:{x:0,y:0},to:{x:random(-maxX,maxX),y:random(-maxY,maxY)},fadeAt:random(8,46),fade:false,transition:'fade'};
  });
  this.width=0;this.height=0;
 }
 draw(time,moving){
  const resized=this.width!==innerWidth||this.height!==innerHeight;
  this.width=innerWidth;this.height=innerHeight;
  for(const line of this.lines){
   if(!line.element?.isConnected){
    const element=document.querySelector(line.selector);if(!element)continue;
    line.element=element;line.measure=true;
    if(!line.initialized){line.fade=!element.matches('button')&&Math.random()<.55;line.initialized=true;}
    element.dataset.floatMode=line.fade?'intermittent':'continuous';
   }
   const el=line.element;
   if(resized||line.measure){
    el.style.translate='none';el.style.transform='none';el.style.filter='none';
    const r=el.getBoundingClientRect();
    line.bounds={left:Math.max(-line.maxX,4-r.left),right:Math.min(line.maxX,innerWidth-4-r.right),top:Math.max(-line.maxY,4-r.top),bottom:Math.min(line.maxY,innerHeight-4-r.bottom)};
    line.measure=false;
   }
   if(time-line.start>line.duration){
    line.from=line.to;line.to={x:random(-line.maxX,line.maxX),y:random(-line.maxY,line.maxY)};line.start=time;line.duration=random(28,50);
   }
   const progress=ease((time-line.start)/line.duration);
   let x=line.from.x+(line.to.x-line.from.x)*progress,y=line.from.y+(line.to.y-line.from.y)*progress;
   let opacity=1,blur=0,entry=0;
   if(line.fade&&time>=line.fadeAt){
    const age=time-line.fadeAt;
    if(!line.fading){
     line.fading=true;line.out=random(2.5,4);line.rest=random(2,5);line.reveal=random(3,5);
     const choices=['fade','haze','rise','slide'].filter(value=>value!==line.transition);
     line.transition=choices[Math.floor(Math.random()*choices.length)];el.dataset.floatTransition=line.transition;
    }
    if(age<line.out)opacity=1-ease(age/line.out);
    else if(age<line.out+line.rest)opacity=0;
    else{entry=1-ease((age-line.out-line.rest)/line.reveal);opacity=1-entry;}
    if(line.transition==='haze')blur=(1-opacity)*3;
    if(line.transition==='rise')y+=entry*4;
    if(line.transition==='slide')x-=entry*8;
    if(age>=line.out+line.rest+line.reveal){line.fading=false;line.fade=Math.random()<.65;line.fadeAt=time+random(18,48);el.dataset.floatMode=line.fade?'intermittent':'continuous';}
   }else if(!line.fade&&time>=line.fadeAt){
    // Some continuously drifting lines occasionally acquire their own fade cycle.
    if(!el.matches('button'))line.fade=Math.random()<.45;
    line.fadeAt=time+random(18,48);el.dataset.floatMode=line.fade?'intermittent':'continuous';
   }
   const b=line.bounds;
   x=Math.max(b.left,Math.min(b.right,x));y=Math.max(b.top,Math.min(b.bottom,y));
   const focused=el.matches(':focus-visible')||el.querySelector(':focus-visible');
   if(!moving||focused){x=0;y=0;opacity=1;blur=0;}
   // translate is independent of the per-letter heading effects and pumpkin position.
   el.style.translate=`${x.toFixed(2)}px ${y.toFixed(2)}px`;
   el.style.opacity=String(Number(opacity.toFixed(3)));el.style.filter=blur?`blur(${blur.toFixed(2)}px)`:'none';
  }
 }
}
