// Two composited layers crossfade over three seconds after twenty seconds still.
export class BackgroundRotation {
 constructor(){this.layers=[...document.querySelectorAll('.welcome-backdrop')];this.dashboard=document.querySelector('#dashboard');this.images=new Map();this.signature='';this.lastKey='';this.hold=false;this.lastTime=0;this.offset=0;}
 configure(items){
  const signature=JSON.stringify(items);if(signature===this.signature)return;this.signature=signature;
  for(const item of items)if(!this.images.has(item.id)){
   const image=new Image();const entry={...item,image,ready:false};this.images.set(item.id,entry);image.onload=()=>entry.ready=true;image.onerror=()=>entry.ready=false;image.src=item.url;
  }
  this.ids=new Set(items.map(item=>item.id));
 }
 draw(time,moving=true){
  if(this.hold)this.offset+=Math.max(0,time-this.lastTime);this.lastTime=time;time-=this.offset;
  const items=[{id:'original',url:null,video_id:'pumpkin-scare'},...[...this.images.values()].filter(item=>item.ready&&this.ids.has(item.id))];
  const index=Math.floor(time/23)%items.length,phase=time%23,progress=moving&&items.length>1?Math.max(0,(phase-20)/3):0;
  const selected=[items[index],items[(index+1)%items.length]];
  this.current=selected[0];this.phase=phase;this.progress=progress;
  const key=selected.map(item=>item.id).join(':');
  if(key!==this.lastKey){
   this.lastKey=key;
   this.layers.forEach((layer,i)=>{const item=selected[i];layer.dataset.backgroundId=item.id;
    layer.style.backgroundImage=item.url?`url("${item.url}")`:'';
    layer.style.backgroundSize=item.url?'cover':'';layer.style.backgroundPosition=item.url?'center 30%':'';
   });
  }
  // Imported artwork keeps a 30% drop: 20% of the pumpkin height above its former position.
  // Keep the button and caption anchored so touch/keyboard controls stay reachable.
  const importedWeight=(selected[0].id==='original'?0:1)*(1-progress)+(selected[1].id==='original'?0:1)*progress;
  const drop=`${Number((importedWeight*30).toFixed(3))}%`;
  if(this.dashboard.style.getPropertyValue('--pumpkin-drop')!==drop)this.dashboard.style.setProperty('--pumpkin-drop',drop);
  this.dashboard.style.setProperty('--welcome-vignette',String(Number((1-importedWeight*.65).toFixed(3))));
  const opacity=[(1-progress)*(selected[0].url?1:.84),progress*(selected[1].url?1:.84)];
  this.layers.forEach((layer,i)=>{const value=String(Number(opacity[i].toFixed(3)));if(layer.style.opacity!==value)layer.style.opacity=value;});
  return importedWeight;
 }
}
