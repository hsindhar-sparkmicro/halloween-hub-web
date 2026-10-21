import {stories,riddles} from './visitor-content.js';
const $=q=>document.querySelector(q);
// Inline SVG avoids missing emoji fonts on minimal Pi installations.
const icons={pumpkin:'<path d="M12 6V2m-2 4C1 3 1 21 10 21h4c9 0 9-18 0-15M6 11l2-3 2 3m4 0 2-3 2 3M7 15q5 5 10 0"/>',book:'<path d="M12 5v16M12 5Q6 1 2 4v15q5-2 10 2 5-4 10-2V4q-4-3-10 1Z"/>',ghost:'<path d="M4 21V10a8 8 0 0 1 16 0v11l-4-3-4 3-4-3Z"/><path d="M9 9v2m6-2v2m-4 4h2"/>',brush:'<path d="m9 15 9-12q3-2 3 2L11 17M9 15q-6-1-6 6 6 0 8-4Z"/>',key:'<circle cx="8" cy="8" r="5"/><path d="m12 12 9 9m-3-3 3-3m-6 0 3-3"/>',train:'<rect x="5" y="2" width="14" height="17" rx="4"/><path d="M5 10h14M9 5h6M8 22l2-3m6 3-2-3M8 14h1m6 0h1"/>',chest:'<path d="M3 10V7q0-4 4-4h10q4 0 4 4v3M3 10h18v11H3ZM10 9h4v5h-4ZM6 21v-7m12 7v-7"/>'};
const icon=name=>`<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
const monsterNames=['Friendly ghost','Count Candlewick','Moonlit werewolf','Mossy marsh monster','Twilight witch','Pumpkin scarecrow'];
export class Visitor {
 constructor(callbacks){
  this.callbacks=callbacks;this.id=null;this.mode='idle';this.lastIntro=null;try{this.lastIntro=localStorage.getItem('halloween.last-intro');}catch{}this.timer=0;this.gameTimer=0;this.lastActivity=Date.now();
  this.dialog=$('#visitor-dialog');this.content=$('#visitor-content');
  $('#visitor-back').onclick=()=>this.finish();
  this.dialog.addEventListener('cancel',event=>{event.preventDefault();this.finish();});
  this.dialog.addEventListener('close',()=>{document.body.classList.remove('visitor-playing');if(this.id!==null&&this.mode!=='scene')this.finish();});
  this.dialog.addEventListener('pointerdown',()=>this.lastActivity=Date.now());
  this.dialog.addEventListener('keydown',()=>this.lastActivity=Date.now());
  setInterval(()=>{if(this.id===null)return;if(Date.now()-this.lastActivity>90000&&this.mode!=='scene')this.finish();else this.callbacks.heartbeat(this.id);},30000);
 }
 get active(){return this.id!==null;}
 start(event,settings,cutscene={}){
  if(this.active)return;
  this.id=event.id;this.settings=settings;this.lastActivity=Date.now();this.mode='reveal';
  this.monster=event.id%6;
  this.content.style.setProperty('--monster-x',(this.monster%2)*100+'%');this.content.style.setProperty('--monster-y',Math.floor(this.monster/2)*50+'%');
  if(event.source==='touch'){
   document.body.classList.add('visitor-playing');this.dialog.showModal();
   if((cutscene.available||cutscene.items?.length)&&!settings.reduced_motion&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
    const items=cutscene.items?.length?cutscene.items:[{id:'welcome',...cutscene}];
    const next=items[(items.findIndex(item=>item.id===this.lastIntro)+1)%items.length];
    this.lastIntro=next.id;try{localStorage.setItem('halloween.last-intro',next.id);}catch{}this.playIntro(next);
   }
   else this.lobby();
   return;
  }
  this.content.className='visitor-reveal';
  this.content.innerHTML=`<div class="reveal-pumpkin"><div class="reveal-pumpkin-art"></div><svg viewBox="0 0 300 300" aria-hidden="true"><path d="M94 139L115 108 128 142Z M174 142L189 110 210 139Z M144 155L151 140 159 155Z M91 166Q150 221 212 166L191 178 181 173 171 188 146 190 136 177 124 183Z" fill="#ffdb57"/></svg></div><div class="reveal-monster monster-art" role="img" aria-label="${monsterNames[this.monster]}"></div><div class="reveal-ring"></div><p class="reveal-caption">A little Halloween magic…</p>`;
  this.content.style.setProperty('--monster-x',(this.monster%2)*100+'%');this.content.style.setProperty('--monster-y',Math.floor(this.monster/2)*50+'%');
  document.body.classList.add('visitor-playing');this.dialog.showModal();
  this.callbacks.sound();
  this.timer=setTimeout(()=>{this.mode='choose';this.lobby();const preferred=settings.visitor_mode;if(preferred&&preferred!=='choose')this.choose(preferred);},settings.reduced_motion?650:1700);
 }
 playIntro(cutscene){
  this.mode='cutscene';this.videoForcedMuted=false;this.content.className='visitor-cutscene';
  const video=document.createElement('video');video.id='visitor-cutscene-video';video.setAttribute('aria-label','Halloween welcome cutscene');video.playsInline=true;video.preload='none';video.disablePictureInPicture=true;video.src=!video.canPlayType('video/mp4; codecs="avc1.640029,mp4a.40.2"')&&cutscene.webm_url?cutscene.webm_url:cutscene.url;this.video=video;this.content.replaceChildren(video);
  this.callbacks.introStart?.();const audio=this.callbacks.audio?.()||{enabled:false,volume:0};this.setVideoAudio(audio.enabled,audio.volume);
  const id=this.id;
  const complete=notice=>{if(this.id!==id||this.video!==video||this.mode!=='cutscene')return;this.lobby(notice);};
  video.onended=()=>complete('');video.onerror=()=>complete('The intro could not play. Choose a Halloween adventure.');
  video.onloadedmetadata=()=>{clearTimeout(this.timer);this.timer=setTimeout(()=>complete('The intro timed out. Choose a Halloween adventure.'),Math.min(120000,Math.max(30000,(video.duration+15)*1000)));};
  this.timer=setTimeout(()=>complete('The intro could not load. Choose a Halloween adventure.'),30000);
  this.introAbort=new AbortController();
  fetch(video.src,{method:'HEAD',cache:'no-store',signal:this.introAbort.signal}).then(response=>{
   if(this.video!==video||this.id!==id)return;
   if(!response.ok)throw new Error('Intro unavailable');
   video.preload='auto';return video.play();
  }).catch(async error=>{
   if(this.video!==video||this.id!==id)return;
   if(error.name==='NotAllowedError'){this.videoForcedMuted=true;video.muted=true;try{await video.play();}catch{complete('The intro could not play. Choose a Halloween adventure.');}}
   else complete('The intro could not play. Choose a Halloween adventure.');
  });
 }
 setVideoAudio(enabled,volume){if(this.video){this.video.muted=!enabled||this.videoForcedMuted;this.video.volume=Math.max(0,Math.min(1,volume));}}
 stopIntro(){
  const video=this.video;if(!video)return;this.video=null;this.introAbort?.abort();this.introAbort=null;video.onended=video.onerror=video.onloadedmetadata=null;video.pause();video.removeAttribute('src');video.load();video.remove();this.callbacks.introEnd?.();
 }
 clear(){clearTimeout(this.timer);clearInterval(this.gameTimer);this.timer=this.gameTimer=0;this.stopIntro();}
 finish(){
  if(this.id===null)return;
  const id=this.id;this.id=null;this.mode='idle';this.clear();this.dialog.close();document.body.classList.remove('visitor-playing');this.callbacks.finish(id);
 }
 sceneFinished(){if(this.mode==='scene')this.finish();}
 lobby(notice=''){
  this.clear();this.mode='choose';this.content.className='visitor-picker';
  this.content.innerHTML=`<p class="visitor-eyebrow">A LITTLE HALLOWEEN MAGIC</p><h1>Choose your adventure</h1><p class="adventure-notice" role="status"></p><div class="visitor-choices"><button data-choice="play"><span>${icon('pumpkin')}</span>Play<small>Games and little challenges</small></button><button data-choice="story"><span>${icon('book')}</span>Story<small>You choose what happens next</small></button><button data-choice="surprise"><span>${icon('ghost')}</span>Surprise<small>Let a little mischief decide</small></button></div>`;
  this.content.querySelector('.adventure-notice').textContent=notice;
  this.content.querySelectorAll('[data-choice]').forEach(button=>button.onclick=()=>this.choose(button.dataset.choice));
 }
 choose(choice){
  this.lastActivity=Date.now();
  if(choice==='surprise')choice=['scene','story','play'][Math.floor(Math.random()*3)];
  if(choice==='scene'){
   this.mode='scene';this.dialog.close();document.body.classList.remove('visitor-playing');
   this.callbacks.scene().catch(()=>{if(this.active){this.mode='choose';this.dialog.showModal();this.lobby();}});return;
  }
  if(choice==='story')this.storyPicker();else this.gamePicker();
 }
 menuButton(){return '<button class="visitor-menu-back secondary" id="visitor-menu-back">‹ Adventures</button>';}
 bindMenu(){const el=$('#visitor-menu-back');if(el)el.onclick=()=>this.lobby();}
 gamePicker(){
  this.mode='play';this.content.className='visitor-picker';this.content.innerHTML=`<h1>Pick your game</h1><div class="visitor-choices"><button data-game="ghost"><span>${icon("ghost")}</span>Find the Ghosts<small>Find three hidden visitors</small></button><button data-game="paint"><span>${icon("brush")}</span>Pumpkin Painter<small>Make your own lantern</small></button><button data-game="quest"><span>${icon("key")}</span>Candy Quest<small>A riddle unlocks the chest</small></button></div>${this.menuButton()}`;
  this.content.querySelectorAll('[data-game]').forEach(el=>el.onclick=()=>this.game(el.dataset.game));this.bindMenu();
 }
 game(type){this.clear();this.mode='game';if(type==='ghost')this.ghostGame();if(type==='paint')this.paintGame();if(type==='quest')this.questGame();}
 ghostGame(){
  this.found=0;this.content.className='visitor-ghost-game';this.content.innerHTML=`<h1>Find three hidden ghosts <span id="ghost-score">0 / 3</span></h1><div class="ghost-hunt-board" aria-label="Ghost hunting picture"></div><p class="game-help" id="ghost-help">Tap the little ghosts hiding in the forest.</p>${this.menuButton()}`;
  const board=this.content.querySelector('.ghost-hunt-board');
  const positions=[[14,20],[44,52],[74,15]].sort(()=>Math.random()-.5);
  positions.forEach(([x,y],i)=>{const button=document.createElement('button');button.className='hunt-ghost monster-art';button.setAttribute('aria-label','Find ghost '+(i+1));button.style.left=(x+Math.random()*6)+'%';button.style.top=(y+Math.random()*6)+'%';button.onclick=()=>{button.disabled=true;button.hidden=true;this.found++;$('#ghost-score').textContent=this.found+' / 3';if(this.found===3)this.reward('Ghost detective','You found all three friendly ghosts!');};board.append(button);});this.bindMenu();
  let remaining=30;this.gameTimer=setInterval(()=>{remaining--;const hint=$('#ghost-help');if(hint)hint.textContent='Find the ghosts · '+remaining+' seconds';if(remaining<=0){this.reward('Good exploring!','The ghosts will return for another round.');}},1000);
 }
 paintGame(){
  this.paint={eyes:0,mouth:0,color:0};this.content.className='visitor-paint-game';this.content.innerHTML=`<h1>Make your jack-o’-lantern</h1><div id="paint-lantern" role="img" aria-label="Your custom pumpkin"></div><div class="paint-controls"><button data-paint="eyes">Change eyes</button><button data-paint="mouth">Change smile</button><button data-paint="color">Change colour</button><button id="paint-done" class="primary">Done ✦</button></div>${this.menuButton()}`;
  this.content.querySelectorAll('[data-paint]').forEach(el=>el.onclick=()=>{this.paint[el.dataset.paint]++;this.drawPumpkin();});$('#paint-done').onclick=()=>this.reward('Lantern artist','Your pumpkin is ready for the Halloween parade!');this.bindMenu();this.drawPumpkin();
 }
 drawPumpkin(){
  const colors=['#f99625','#b282ef','#91ce69'],eyes=['<path d="M65 110L90 65 115 110Z M185 110L210 65 235 110Z"/>','<ellipse cx="90" cy="95" rx="22" ry="26"/><ellipse cx="210" cy="95" rx="22" ry="26"/>','<path d="M65 98Q90 65 115 98L113 110Q90 92 67 110Z M185 98Q210 65 235 98L233 110Q210 92 187 110Z"/>'],mouth=['<path d="M60 145Q150 245 240 145Q150 205 60 145Z"/>','<ellipse cx="150" cy="170" rx="32" ry="40"/>','<path d="M65 160L90 145 115 170 140 145 165 170 190 145 235 160 210 195 90 195Z"/>'];
  $('#paint-lantern').innerHTML=`<svg viewBox="0 0 300 260" aria-hidden="true"><path d="M148 44Q130 12 166 8" stroke="#637740" stroke-width="16" fill="none"/><ellipse cx="150" cy="142" rx="133" ry="105" fill="${colors[this.paint.color%3]}"/><g fill="none" stroke="#40150f44" stroke-width="5"><ellipse cx="115" cy="142" rx="68" ry="100"/><ellipse cx="185" cy="142" rx="68" ry="100"/></g><g fill="#ffefa0">${eyes[this.paint.eyes%3]}${mouth[this.paint.mouth%3]}</g></svg>`;
 }
 questGame(){
  const riddle=riddles[Math.floor(Math.random()*riddles.length)];this.content.className='visitor-quest-game';this.content.innerHTML=`<h1>Unlock the candy chest</h1><div class="quest-chest" aria-hidden="true">${icon("chest")}</div><p class="quest-riddle">${riddle.question}</p><div class="visitor-choices">${riddle.choices.map(c=>`<button data-answer="${c}">${c}</button>`).join('')}</div><p id="quest-hint" role="status"></p>${this.menuButton()}`;
  this.content.querySelectorAll('[data-answer]').forEach(el=>el.onclick=()=>{if(el.dataset.answer===riddle.answer)this.reward('Candy quest complete','The chest is open! Ask your host for a treat.');else $('#quest-hint').textContent='A good guess! Read the clue and try again.';});this.bindMenu();
 }
 storyPicker(){
  this.clear();this.mode='story';this.content.className='visitor-picker';this.content.innerHTML=`<h1>Choose your story</h1><div class="visitor-choices">${stories.map((s,i)=>`<button data-story="${i}"><span>${icon(['ghost','pumpkin','train'][i])}</span>${s.title}<small>You choose what happens next</small></button>`).join('')}</div>${this.menuButton()}`;
  this.content.querySelectorAll('[data-story]').forEach(el=>el.onclick=()=>this.story(Number(el.dataset.story),'start'));this.bindMenu();
 }
 story(index,node){
  this.mode='story';this.storyIndex=index;this.storyNode=node;const s=stories[index],page=s.pages[node];this.content.className='visitor-story';
  this.content.style.setProperty('--story-x',(s.background%2)*100+'%');this.content.style.setProperty('--story-y',Math.floor(s.background/2)*100/3+'%');
  this.content.innerHTML=`<div class="story-paper"><p class="visitor-eyebrow">AN ORIGINAL HALLOWEEN TALE</p><h1>${s.title}</h1><p class="story-text">${page.text}</p><div class="story-choices">${page.choices.length?page.choices.map(([label,next])=>`<button class="primary" data-next="${next}">${label}</button>`).join(''):'<button class="primary" id="story-end">Finish ✦</button>'}</div></div>${this.menuButton()}`;
  this.content.querySelectorAll('[data-next]').forEach(el=>el.onclick=()=>this.story(index,el.dataset.next));if($('#story-end'))$('#story-end').onclick=()=>this.reward('Story explorer','Thank you for sharing a little Halloween magic.');this.bindMenu();
 }
 reward(title,message){
  this.clear();this.mode='reward';this.content.className='visitor-reward';this.content.innerHTML=`<div class="reward-star" aria-hidden="true">✦</div><h1>${title}</h1><p>${message}</p><small>Virtual badge · treats are handed out by your host</small><div class="reward-buttons"><button class="primary" id="reward-again">Another adventure</button><button class="secondary" id="reward-finish">All done</button></div>`;
  this.callbacks.sound();$('#reward-again').onclick=()=>this.lobby();$('#reward-finish').onclick=()=>this.finish();this.timer=setTimeout(()=>this.finish(),15000);
 }
}
