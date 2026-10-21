// Idle motion lives behind the dashboard. Keep the matching still mounted throughout.
export class IdleBackgroundVideo {
 constructor(backgrounds){
  this.backgrounds=backgrounds;this.items=new Map();this.allowed=false;
  this.lastActivity=performance.now();this.nextDue=this.lastActivity+20000;
  this.dashboard=document.querySelector('#dashboard');this.fadeMs=3500;
  this.layer=document.createElement('div');this.layer.className='idle-background-video';
  this.layer.setAttribute('aria-hidden','true');
  document.querySelector('#welcome-atmosphere').before(this.layer);
  const activity=()=>{this.lastActivity=performance.now();this.stop(600);};
  for(const event of ['pointerdown','pointermove','keydown','wheel'])document.addEventListener(event,activity,{passive:true});
 }
 configure(items){
  this.items=new Map(items.map(item=>[item.id,item]));
  if(this.video&&!this.items.has(this.video.dataset.cutsceneId))this.stop(600);
 }
 setAllowed(allowed){
  if(this.allowed===allowed)return;this.allowed=allowed;
  this.lastActivity=performance.now();
  if(!allowed)this.stop(0);
 }
 update(){
  if(this.video||!this.allowed)return;
  const now=performance.now(),background=this.backgrounds;
  // Start only on a settled image, with enough room before its next crossfade.
  if(now-this.lastActivity<20000||now<this.nextDue||background.phase<3||background.phase>16||background.progress)return;
  const item=this.items.get(background.current?.video_id);
  if(item)this.start(item);
 }
 start(item){
  const video=document.createElement('video');this.video=video;this.fading=false;
  video.dataset.cutsceneId=item.id;this.layer.dataset.videoId=item.id;this.layer.dataset.state='loading';
  video.muted=true;video.defaultMuted=true;video.volume=0;video.playsInline=true;
  video.playbackRate=.5;video.defaultPlaybackRate=.5;
  video.preload='auto';video.disablePictureInPicture=true;video.tabIndex=-1;
  this.layer.replaceChildren(video);this.backgrounds.hold=true;
  const current=()=>this.video===video&&!this.fading;
  const reveal=()=>{
   if(!current())return;
   clearTimeout(this.loadTimer);this.layer.style.transitionDuration=`${this.fadeMs}ms`;
   this.dashboard.style.setProperty('--idle-fade-duration',`${this.fadeMs}ms`);
   this.dashboard.classList.add('idle-video-playing');
   this.layer.style.opacity='1';this.layer.dataset.state='playing';
  };
  // A decoded/presented frame must exist before the video becomes visible.
  video.onplaying=()=>{
   if(!current())return;clearTimeout(this.stallTimer);
   if(this.layer.dataset.state==='loading'){
    if(video.requestVideoFrameCallback)video.requestVideoFrameCallback(reveal);
    else requestAnimationFrame(()=>requestAnimationFrame(()=>{if(video.readyState>=2)reveal();}));
   }
  };
  // Compare wall time, since the media clock advances at half speed.
  video.ontimeupdate=()=>{if(current()&&Number.isFinite(video.duration)&&(video.duration-video.currentTime)/video.playbackRate<=this.fadeMs/1000+.4)this.stop(this.fadeMs);};
  video.onwaiting=()=>{if(current()){clearTimeout(this.stallTimer);this.stallTimer=setTimeout(()=>this.stop(600),2000);}};
  video.onended=()=>{if(current())this.stop(600);};
  video.onerror=()=>{if(current())this.stop(600);};
  this.loadTimer=setTimeout(()=>this.stop(600),12000);
  this.runTimer=setTimeout(()=>this.stop(this.fadeMs),90000);
  video.src=!video.canPlayType('video/mp4; codecs="avc1.640029,mp4a.40.2"')&&item.webm_url?item.webm_url:item.url;
  video.play().catch(()=>{if(current())this.stop(600);});
 }
 stop(duration){
  const video=this.video;if(!video)return;
  // A hidden tab, dialog or reduced motion must also cancel an in-flight fade.
  if(this.fading&&duration!==0)return;
  const visible=this.layer.dataset.state==='playing'||this.layer.dataset.state==='fading';
  this.fading=true;clearTimeout(this.loadTimer);clearTimeout(this.stallTimer);clearTimeout(this.runTimer);clearTimeout(this.releaseTimer);
  this.dashboard.style.setProperty('--idle-fade-duration',`${duration}ms`);
  this.dashboard.classList.remove('idle-video-playing');
  this.layer.style.transitionDuration=`${duration}ms`;this.layer.style.opacity='0';this.layer.dataset.state='fading';
  const release=()=>{
   if(this.video!==video)return;
   video.onplaying=video.ontimeupdate=video.onwaiting=video.onended=video.onerror=video.onloadedmetadata=null;
   video.pause();video.removeAttribute('src');video.load();video.remove();
   this.video=null;this.fading=false;this.backgrounds.hold=false;this.layer.dataset.state='idle';
   this.nextDue=performance.now()+45000+Math.random()*30000;
  };
  // Leave the last decoded frame mounted until its fade has fully completed.
  if(!visible||!duration)release();else this.releaseTimer=setTimeout(release,duration+100);
 }
}
