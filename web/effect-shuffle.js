// Play every saved effect once per shuffled cycle, without boundary repeats.
export class EffectShuffle {
 constructor(){this.bag=[];this.signature='';this.last=null;}
 next(effects){
  const signature=effects.map(effect=>effect.id).join(',');
  if(signature!==this.signature){this.signature=signature;this.bag=[];}
  if(!effects.length)return null;
  if(!this.bag.length){
   this.bag=[...effects];
   for(let i=this.bag.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[this.bag[i],this.bag[j]]=[this.bag[j],this.bag[i]];}
   if(this.bag.length>1&&this.bag[0].id===this.last)[this.bag[0],this.bag[1]]=[this.bag[1],this.bag[0]];
  }
  const effect=this.bag.shift();this.last=effect.id;return effect;
 }
}
