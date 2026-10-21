// Small local text effects share the atmosphere clock: hidden screens/dialogs freeze them.
const MESSAGES=[
 ['Halloween','awaits.','THE NIGHT IS DRAWING NEAR'],
 ['Something','stirs.','LISTEN BEYOND THE WIND'],
 ['The shadows','watch.','WHO IS HIDING IN THE DARK?'],
 ['You are not','alone.','WAS THAT A FOOTSTEP?'],
 ['A whisper','calls.','FOLLOW THE FLICKERING LIGHT'],
 ['Dare to','stay?','THE NIGHT HAS MORE SECRETS'],
 ['Ghosts and','ghouls.','SOMETHING WICKED WANDERS HERE'],
 ['Midnight is','near.','DO NOT FOLLOW THE SHADOWS']
];
const EFFECTS=['ghost','wave','fade','title','typewriter','city'];
class ShuffleBag {
 constructor(items){this.items=items;this.bag=[];this.last=null;}
 next(){
  if(!this.bag.length){
   this.bag=[...this.items];
   for(let i=this.bag.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[this.bag[i],this.bag[j]]=[this.bag[j],this.bag[i]];}
   if(this.bag.at(-1)===this.last){[this.bag[0],this.bag[this.bag.length-1]]=[this.bag.at(-1),this.bag[0]];}
  }
  this.last=this.bag.pop();return this.last;
 }
}
export class WelcomeMessages {
 constructor(){
  this.heading=document.querySelector('.welcome-countdown h1');this.eyebrow=document.querySelector('.welcome-eyebrow');
  this.messages=new ShuffleBag(MESSAGES.map((_,i)=>i));this.effects=new ShuffleBag(EFFECTS);this.cycle=-1;
 }
 select(index,effect){
  this.effect=effect;this.heading.dataset.textEffect=effect;
  const [lead,ending,eyebrow]=MESSAGES[index];this.heading.setAttribute('aria-label',lead+' '+ending);this.eyebrow.textContent=eyebrow;
  const content=document.createElement('span');content.setAttribute('aria-hidden','true');this.glyphs=[];
  let wordIndex=0;
  for(const [text,emphasis] of [[lead,false],[ending,true]]){
   const group=document.createElement(emphasis?'em':'span');
   for(const word of text.split(' ')){
    if(content.textContent||group.textContent)group.append(' ');
    const span=document.createElement('span');span.className='welcome-word';
    for(const char of word){const glyph=document.createElement('span');glyph.className='welcome-glyph';glyph.textContent=char;span.append(glyph);this.glyphs.push({element:glyph,word:wordIndex});}
    group.append(span);wordIndex++;
   }
   content.append(group);
  }
  const ghost=document.createElementNS('http://www.w3.org/2000/svg','svg');ghost.classList.add('message-ghost');ghost.setAttribute('viewBox','0 0 40 48');ghost.setAttribute('aria-hidden','true');
  const path=document.createElementNS(ghost.namespaceURI,'path');path.setAttribute('d','M5 43V20a15 15 0 0 1 30 0v23l-8-5-7 6-7-6z M14 18v5 M26 18v5');ghost.append(path);
  this.heading.replaceChildren(content,ghost);this.ghost=ghost;
 }
 draw(time,moving){
  const cycle=Math.floor(time/12),phase=time%12;
  if(cycle!==this.cycle){
   this.cycle=cycle;this.select(this.messages.next(),this.effects.next());
  }
  const fade=moving?Math.max(0,Math.min(1,phase/1.2,(12-phase)/1.5)):1;
  this.heading.style.opacity=String(Number(fade.toFixed(3)));this.eyebrow.style.opacity=this.heading.style.opacity;
  this.heading.classList.toggle('message-steady',!moving);
  for(const [i,{element,word}] of this.glyphs.entries()){
   let y=0,x=0,rotate=0,opacity=1,blur=0,shadow='';
   if(moving){
    if(this.effect==='wave')y=Math.sin(phase*2.2-i*.5)*4;
    if(this.effect==='fade'){opacity=Math.max(0,Math.min(1,(phase-i*.025)/1.3));blur=(1-opacity)*3;}
    if(this.effect==='title'){const reveal=Math.max(0,Math.min(1,(phase-word*.22)/.9));rotate=(1-reveal)*85;y=(1-reveal)*10;opacity=reveal;shadow=`0 0 ${3+Math.sin(phase*1.6)**2*8}px #d9b87f66`;}
    if(this.effect==='typewriter'){const typed=Math.floor(phase*12);opacity=i<typed?1:0;if(i===typed-1&&typed<this.glyphs.length&&Math.floor(phase*2)%2===0)shadow='2px 0 #d9c6ee';}
    if(this.effect==='ghost'){x=Math.sin(phase*.8+i*.16)*1.5;y=Math.sin(phase+i*.18)*2;}
   }
   element.style.transform=`translate(${x.toFixed(2)}px,${y.toFixed(2)}px) rotateX(${rotate.toFixed(2)}deg)`;
   element.style.opacity=String(Number(opacity.toFixed(3)));element.style.filter=blur?`blur(${blur.toFixed(2)}px)`:'none';
   element.style.textShadow=this.effect==='title'?shadow:'';element.style.boxShadow=this.effect==='typewriter'?shadow:'';
  }
  this.ghost.style.opacity=moving&&this.effect==='ghost'?'.65':'0';
  this.ghost.style.left=`${(Math.min(1,phase/8)*85).toFixed(2)}%`;
  this.ghost.style.transform=`translateY(${(Math.sin(phase*1.4)*9).toFixed(2)}px)`;
  this.heading.style.setProperty('--night-glow',moving?String((.3+Math.sin(phase*.8)**2*.45).toFixed(2)):'.4');
 }
}
