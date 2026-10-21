import {hub, mediaUrl} from './browser-service.js';
import {setupWelcomeChrome} from './welcome-chrome.js';
import {ScenePlayer} from './scene-player.js';
import {Visitor} from './visitor.js';
import {WelcomeAtmosphere} from './welcome-atmosphere.js';
import {EffectShuffle} from './effect-shuffle.js';
const $ = (q, root = document) => root.querySelector(q);
const $$ = (q, root = document) => [...root.querySelectorAll(q)];
let state, currentScreen = 'dashboard', lastInteraction = 0, lastRotation = Date.now();
let syncing = false, recordsHash = '', tracksHash = '', effectsHash = '', logsHash = '', settingsHash = '';
let audioEnabled = false, ambienceEnabled = false, trackIndex = 0, playingId = null;
let cueGain, cueTimer=0, cueRun=null, blockedCueRun=null, lastCueId=null;
let context, analyser, effectGain, frame = 0, previousHauntStage = '', lastScare = 0, previousHauntActive = false, lastWelcome = 0;
const player = $('#music-player'), ambience = $('#ambience-player'), effect = $('#effect-player'), cue = $('#cue-player');
const scenePlayer = new ScenePlayer($('#scene-canvas'));
const welcomeAtmosphere=new WelcomeAtmosphere($('#welcome-atmosphere'));
const ambientShuffle=new EffectShuffle();
setupWelcomeChrome();
let ambientGeneration=0;
function showScene() {
  if (!$('#scene-dialog').open) $('#scene-dialog').showModal();
  document.body.classList.add('scene-playing');
  scenePlayer.show(true);
}
$('#scene-dialog').addEventListener('close', () => {scenePlayer.show(false);document.body.classList.remove('scene-playing');});
$('#view-scene').addEventListener('click', showScene);
$('#scene-back').addEventListener('click', () => {stopScene(); $('#scene-dialog').close();if(visitor.mode==='scene')visitor.sceneFinished();});
$('#scene-dialog').addEventListener('cancel', () => {stopScene();if(visitor.mode==='scene')visitor.sceneFinished();});
let introResume=[];
const visitor = new Visitor({
  audio: ()=>({enabled:audioEnabled,volume:(state?.settings.volume??40)/100}),
  introStart: ()=>{introResume=[player,ambience].filter(audio=>!audio.paused);[player,ambience,effect,cue].forEach(audio=>audio.pause());},
  introEnd: ()=>{const resume=introResume;introResume=[];if(audioEnabled)resume.forEach(audio=>{if(audio===ambience&&!ambienceEnabled)return;audio.play().catch(()=>{});});},
  scene: async()=>{const haunt=await api('/haunt','POST',{action:'random',_source:'encounter'});state.haunt=haunt;render();showScene();},
  finish: id=>action(async()=>{await api('/encounter','POST',{action:'finish',id});navigate('dashboard');}),
  heartbeat: id=>api('/encounter','POST',{action:'heartbeat',id}).catch(()=>{}),
  sound: ()=>{if(audioEnabled){effect.src='./assets/pumpkin-scene.wav';effect.currentTime=0;effect.play().catch(()=>{});}}
});
function triggerVisitor() {
  $('#pumpkin').disabled=true;
  unlockAudio();
  return action(async()=>{const event=await api('/encounter','POST',{action:'start'});state.welcome=event;render();});
}
const screens = ['dashboard', 'haunt', 'party', 'detector'];
const recipes = [
  {name:'Pumpkin patch cocoa', description:'A warm little spell for chilly October nights.', ingredients:'For 4: 800 ml milk, 4 tbsp cocoa, 4 tbsp pumpkin purée, 2 tbsp sugar, ½ tsp cinnamon, whipped cream.', method:'Warm the milk gently. Whisk in cocoa, pumpkin, sugar and cinnamon until smooth. Pour into mugs and top with whipped cream. Serve warm.'},
  {name:'Monster apple bites', description:'A crunchy grin with a sweet little secret.', ingredients:'For 8: 2 apples, 4 tbsp sunflower-seed butter, sunflower seeds and strawberries.', method:'Cut apples into wedges. Spread seed butter between two wedges to make a mouth. Add seeds as teeth and a strawberry slice as a tongue.'},
  {name:'Midnight popcorn', description:'Movie-night crunch, dressed for the occasion.', ingredients:'For 4: 6 cups popped popcorn, 80 g melted dark chocolate, 2 tbsp pumpkin seeds and a pinch of salt.', method:'Spread popcorn on a tray, drizzle with chocolate, scatter seeds and salt, and let the chocolate set. Break into clusters.'}
];
let recipe = recipes[new Date().getDate() % recipes.length];
$('#recipe-name').textContent = $('#recipe-title').textContent = recipe.name;
$('#recipe-description').textContent = recipe.description;
$('#recipe-ingredients').textContent = recipe.ingredients;
$('#recipe-method').textContent = recipe.method;

function toast(message) {
  const host = $('dialog[open]') || $('#app'); host.append($('#toast')); $('#toast').classList.toggle('dialog-toast',host.tagName==='DIALOG');
  $('#toast').textContent = message; $('#toast').hidden = false; if(host.tagName==='DIALOG') $('#toast').scrollIntoView({block:'nearest'});
  clearTimeout(toast.timer); toast.timer = setTimeout(() => $('#toast').hidden = true, 5000);
}
async function api(path, method = 'GET', data) {
  return hub.request(path, method, data);
}
async function action(fn) {
  try {await fn(); await sync();} catch (error) {recordsHash = tracksHash = effectsHash = settingsHash = ''; if(state) {render(); $$('[data-haunt]').forEach(el=>{el.value=state.haunt[el.dataset.haunt]; $('#'+el.dataset.haunt+'-output').textContent=el.value+'%';});} toast(error.message);}
}
function navigate(screen) {
  currentScreen = screen;
  $$('.screen').forEach(el => el.classList.toggle('active', el.id === screen));
  $$('[data-screen]').forEach(el => {el.classList.toggle('selected', el.dataset.screen === screen); el.setAttribute('aria-current', el.dataset.screen === screen ? 'page' : 'false');});
  document.body.classList.toggle('detector-theme', screen === 'detector');
  if (screen === 'party' && audioEnabled) startEqualizer();
  else {cancelAnimationFrame(frame); frame = 0;}
}
function openDialog(id) {
  if (id === 'settings-dialog') fillSettings();
  if (id === 'logs-dialog') action(async () => {const result = await api('/logs'); renderLogRows($('#log-list'), result.detections, true);});
  $('#' + id).showModal();
}
document.addEventListener('pointerdown', () => lastInteraction = Date.now());
document.addEventListener('keydown', () => lastInteraction = Date.now());
$$('[data-screen]').forEach(button => button.addEventListener('click', () => navigate(button.dataset.screen)));
$$('[data-open]').forEach(button => button.addEventListener('click', () => openDialog(button.dataset.open)));
$$('[data-close]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
$('#fullscreen').addEventListener('click', () => action(async () => {
  if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen();
}));

const expressions = [
  '<path d="M94 139L115 108 128 142Z M174 142L189 110 210 139Z M144 155L151 140 159 155Z M91 166Q150 221 212 166L191 178 181 173 171 188 146 190 136 177 124 183Z"/>',
  '<path d="M87 135L129 152 117 118Z M172 151L214 133 181 119Z M145 161L154 147 162 161Z M90 182L110 168 122 186 138 169 155 192 169 171 185 187 208 169 198 198 108 201Z"/>',
  '<path d="M91 140L115 111 129 143Z M174 134Q192 119 211 137L208 143Q191 134 175 142Z M147 155L154 143 162 155Z M100 169Q151 213 205 167Q185 207 155 210Q122 206 100 169Z"/>',
  '<ellipse cx="111" cy="135" rx="13" ry="18"/><ellipse cx="188" cy="135" rx="13" ry="18"/><path d="M145 158L152 144 161 158Z"/><ellipse cx="152" cy="185" rx="20" ry="24"/>'
];
let expression = 0;
function changeFace() {$('#face').innerHTML = $('#face-glow').innerHTML = expressions[expression++ % expressions.length];}
changeFace(); $('#pumpkin').addEventListener('click', triggerVisitor);
setInterval(() => {if(currentScreen === 'dashboard' && !visitor.active && !document.hidden && !state?.settings.reduced_motion) changeFace();}, 10000);

function unlockAudio() {
  if (!context) {
    context = new AudioContext();
    analyser = context.createAnalyser(); analyser.fftSize = 128;
    analyser.connect(context.destination);
    context.createMediaElementSource(player).connect(analyser);
    context.createMediaElementSource(ambience).connect(analyser);
    effectGain = context.createGain();
    context.createMediaElementSource(effect).connect(effectGain); effectGain.connect(analyser);
    cueGain=context.createGain();context.createMediaElementSource(cue).connect(cueGain);cueGain.connect(analyser);
  }
  context.resume().catch(error => toast(error.message));
  audioEnabled = true; document.body.classList.add('audio-on');
  $('#sound-toggle').textContent = '♫'; $('#sound-toggle').setAttribute('aria-label','Mute audio');
  updateVolume();
  if(currentScreen === 'party') startEqualizer();
}
function updateVolume() {
  const volume = (state?.settings.volume ?? 40)/100;
  player.volume = ambience.volume = effect.volume = cue.volume = volume;
  visitor.setVideoAudio(audioEnabled,volume);
  if(cueGain)cueGain.gain.value=((state?.haunt.sound ?? 40)/100)*.7;
  if (effectGain) effectGain.gain.value = (state?.haunt.sound ?? 40)/100;
}
function muteAudio() {
  stopCues();stopAmbience();
  player.pause(); effect.pause(); audioEnabled = false;
  visitor.setVideoAudio(false,(state?.settings.volume??40)/100);
  document.body.classList.remove('audio-on');
  $('#sound-toggle').setAttribute('aria-label','Enable audio');
  $('#ambience-toggle').textContent = 'Play spooky sounds'; $('#play-track').textContent = 'Play music';
  cancelAnimationFrame(frame); frame = 0;
}
$('#sound-toggle').addEventListener('click', () => audioEnabled ? muteAudio() : unlockAudio());
function ambientControl(){
  $('#ambience-toggle').setAttribute('aria-pressed',String(ambienceEnabled));
  $('#ambience-toggle').textContent=ambienceEnabled?'Pause spooky sounds':'Play spooky sounds';
}
function stopAmbience(){ambienceEnabled=false;ambientGeneration++;ambience.pause();ambientControl();}
async function nextAmbientEffect(){
  if(!ambienceEnabled||!audioEnabled)return;
  const item=ambientShuffle.next(state.effects||[]);
  if(!item){stopAmbience();toast('Import sound effects in Party Hub → Library');openDialog('music-dialog');return;}
  const generation=++ambientGeneration;
  ambience.loop=false;ambience.src=mediaUrl('effects',item.id);ambience.currentTime=0;
  try{await ambience.play();if(generation!==ambientGeneration&&(!ambienceEnabled||!audioEnabled))ambience.pause();}
  catch(error){if(generation===ambientGeneration){stopAmbience();toast('Spooky sound could not play: '+error.message);}}
}
$('#ambience-toggle').addEventListener('click',()=>action(async()=>{
  if(ambienceEnabled)stopAmbience();
  else{unlockAudio();ambienceEnabled=true;ambientControl();await nextAmbientEffect();}
}));
ambience.addEventListener('ended',()=>{if(ambienceEnabled&&audioEnabled)nextAmbientEffect();});
function startEqualizer() {
  if (frame || !analyser || currentScreen !== 'party' || document.hidden) return;
  const canvas = $('#equalizer'), drawing = canvas.getContext('2d'), data = new Uint8Array(analyser.frequencyBinCount);
  function draw() {
    if (currentScreen !== 'party' || !audioEnabled || document.hidden) {frame=0; return;}
    analyser.getByteFrequencyData(data); drawing.clearRect(0,0,canvas.width,canvas.height);
    for(let i=0;i<30;i++) {const height=Math.max(2,data[i]*canvas.height/255); drawing.fillStyle=i>20?'#ff952d':'#b184f7'; drawing.fillRect(i*12,canvas.height-height,7,height);}
    frame=requestAnimationFrame(draw);
  }
  draw();
}
function stopCues(){clearTimeout(cueTimer);cueTimer=0;cue.pause();cueRun=null;}
function playRandomCue(){
  if(!audioEnabled||!state?.haunt.active||blockedCueRun===state.haunt.run_id)return;
  let choices=(state.effects||[]).filter(item=>item.id!==lastCueId);
  if(!choices.length)choices=state.effects||[];
  if(!choices.length)return;
  const item=choices[Math.floor(Math.random()*choices.length)];lastCueId=item.id;
  cue.src=mediaUrl('effects',item.id);cue.currentTime=0;cue.play().catch(()=>{});
}
cue.addEventListener('ended',()=>{
  if(cueRun!==null&&audioEnabled&&state?.haunt.active){
    clearTimeout(cueTimer);cueTimer=setTimeout(playRandomCue,1000+Math.random()*3000);
  }
});
$('#effect-upload').addEventListener('change',()=>action(async()=>{
  for(const file of $('#effect-upload').files){
    if(file.size>100*1024*1024)throw new Error('Choose a file smaller than 100 MB');
    const body=new FormData();body.append('file',file);await api('/effects','POST',body);
  }
  $('#effect-upload').value='';toast('Scene effects saved for random offline playback');
}));
function renderEffects(){
  $('#effect-list').replaceChildren();
  $('.welcome-sound-description').textContent=(state.effects||[]).length+' saved sound effects · shuffled';
  (state.effects||[]).forEach(item=>{
    const row=document.createElement('div');row.className='track-row';
    const label=document.createElement('span');label.textContent=item.name+(item.included?' · Included':'');
    const preview=document.createElement('button');preview.className='secondary';preview.textContent='Listen';
    preview.onclick=()=>{if(state.haunt.active){toast('Stop the scene before previewing an effect');return;}unlockAudio();stopCues();cue.src=mediaUrl('effects',item.id);cue.play().catch(error=>toast(error.message));};
    const remove=document.createElement('button');remove.className='secondary';remove.textContent='×';remove.setAttribute('aria-label','Delete effect '+item.name);
    remove.onclick=()=>action(async()=>{if(cue.getAttribute('src')===mediaUrl('effects',item.id))stopCues();if(ambience.getAttribute('src')===mediaUrl('effects',item.id))stopAmbience();await api('/effects/'+item.id,'DELETE');});
    row.append(label,preview,remove);$('#effect-list').append(row);
  });
}
function nextTrackIndex() {
  if(!state?.tracks.length)return 0;
  const current=state.tracks.findIndex(track=>track.id===playingId);
  if(!state.settings.music_shuffle)return (current+1)%state.tracks.length;
  const choices=state.tracks.map((_,i)=>i).filter(i=>i!==current);
  return choices.length?choices[Math.floor(Math.random()*choices.length)]:0;
}
async function playTrack(index) {
  if (!state?.tracks.length) {openDialog('music-dialog'); return;}
  unlockAudio(); trackIndex = (index + state.tracks.length) % state.tracks.length;
  const track = state.tracks[trackIndex];
  if(playingId !== track.id) {player.src = mediaUrl('tracks',track.id); playingId = track.id;}
  await player.play(); $('#now-playing').textContent = track.name; $('#play-track').textContent='Pause';
}
$('#play-track').addEventListener('click', () => action(async () => {
  if (!player.paused) {player.pause(); $('#play-track').textContent='Play music';} else await playTrack(playingId===null?nextTrackIndex():Math.max(0,state.tracks.findIndex(track=>track.id===playingId)));
}));
$('#previous-track').addEventListener('click', () => action(() => playTrack(state.tracks.findIndex(track=>track.id===playingId)-1)));
$('#next-track').addEventListener('click', () => action(() => playTrack(nextTrackIndex())));
player.addEventListener('ended', () => action(() => playTrack(nextTrackIndex())));
[player,ambience,effect,cue].forEach(audio => audio.addEventListener('error', () => toast('This audio file could not be played. Try another MP3, WAV, or OGG.')));
$('#music-shuffle').addEventListener('change',()=>action(()=>api('/settings','PATCH',{music_shuffle:$('#music-shuffle').checked})));
$('#music-upload').addEventListener('change', () => action(async () => {
  for (const file of $('#music-upload').files) {
    if(file.size > 100*1024*1024) throw new Error('Choose a file smaller than 100 MB');
    const body = new FormData(); body.append('file',file); await api('/tracks','POST',body);
  }
  $('#music-upload').value=''; toast('Music added to your local library');
}));

$$('[data-haunt]').forEach(slider => {
  slider.addEventListener('input', () => $('#'+slider.dataset.haunt+'-output').textContent=slider.value+'%');
  slider.addEventListener('change', () => action(() => api('/haunt','POST',{action:'set',key:slider.dataset.haunt,value:Number(slider.value)})));
});
function playScene(command) {
  unlockAudio();
  const wasOpen=$('#scene-dialog').open;
  return action(async () => {const haunt=await api('/haunt','POST',command); if(state) {state.haunt=haunt;render();if(wasOpen) scenePlayer.show($('#scene-dialog').open); else showScene();}});
}
$('#haunt-scene').addEventListener('change', () => playScene({action:'play',scene:$('#haunt-scene').value}));
$('#random-scene').addEventListener('click', () => playScene({action:'random'}));
$('#activate-haunt').addEventListener('click', () => playScene({action:'activate'}));
function stopScene() {
  blockedCueRun=state?.haunt.run_id;stopCues();
  effect.pause();
  scenePlayer.show(false);
  return action(async () => {const haunt=await api('/haunt','POST',{action:'stop'}); state.haunt=haunt;render();});
}
$('#stop-haunt').addEventListener('click', stopScene);

$('#trigger-motion').addEventListener('click', () => action(() => api('/haunt','POST',{action:'motion'})));
$('#scan-toggle').addEventListener('click', () => action(() => api('/scan','POST',{active:!state.scan.active})));
$('#sensitivity').addEventListener('change', () => action(() => api('/settings','PATCH',{sensitivity:$('#sensitivity').value})));
$('#trick-mode').addEventListener('click', triggerVisitor);
function fillSettings() {
  if(!state) return;
  for(const [key,value] of Object.entries(state.settings)) {
    const input=$('#setting-'+key); if(!input) continue;
    if(input.type==='checkbox') input.checked=value;
    else input.value=value;
  }
  $('#selected-location').textContent=state.settings.location?.name || 'No weather location selected';
  $('#volume-output').textContent=state.settings.volume+'%';
}
$('#setting-volume').addEventListener('input', () => $('#volume-output').textContent=$('#setting-volume').value+'%');
$('#save-settings').addEventListener('click', () => action(async () => {
  const settings={};
  $$('[id^="setting-"]').forEach(el => settings[el.id.slice(8)]=el.type==='checkbox'?el.checked:el.id==='setting-volume'?Number(el.value):el.value);
  await api('/settings','PATCH',settings); $('#settings-dialog').close(); toast('Settings saved');
}));
$('#search-location').addEventListener('click', () => action(async () => {
  const button=$('#search-location'); button.disabled=true;
  try {
    const results=await api('/locations?q='+encodeURIComponent($('#location-query').value));
    $('#location-results').replaceChildren();
    if(!results.results.length) $('#location-results').textContent='No matching locations';
    for(const location of results.results) {
      const el=document.createElement('button'); el.className='text-button'; el.textContent=location.name;
      el.addEventListener('click', () => action(async () => {await api('/settings','PATCH',{location}); $('#selected-location').textContent=location.name; $('#location-results').replaceChildren();}));
      $('#location-results').append(el);
    }
  } finally {button.disabled=false;}
}));
$('#clear-location').addEventListener('click', () => action(async () => {await api('/settings','PATCH',{location:null}); $('#selected-location').textContent='No weather location selected';}));
$$('[data-record-form]').forEach(form => form.addEventListener('submit',event => {
  event.preventDefault(); action(async () => {await api('/records','POST',{kind:form.dataset.recordForm,name:form.elements.name.value}); form.reset();});
}));
function renderRecords() {
  for(const kind of ['task','guest']) {
    const records=state.records.filter(r=>r.kind===kind), list=$('#'+kind+'-list'); list.replaceChildren();
    if(!records.length) {const empty=document.createElement('p'); empty.className='subtle'; empty.textContent=kind==='task'?'Add the little things that make a great party.':'Invite a few friendly souls.'; list.append(empty);}
    records.forEach(record => {
      const row=document.createElement('div'); row.className='record-row'+(record.done?' done':'');
      const checkbox=document.createElement('input'); checkbox.type='checkbox'; checkbox.checked=Boolean(record.done); checkbox.setAttribute('aria-label',(kind==='guest'?'Arrived: ':'Completed: ')+record.name);
      checkbox.addEventListener('change',()=>action(()=>api('/records/'+record.id,'PATCH',{done:checkbox.checked})));
      const name=document.createElement('span'); name.textContent=record.name;
      const rename=document.createElement('button'); rename.className='secondary'; rename.textContent='Edit';
      rename.addEventListener('click',()=>{const value=prompt('Edit '+kind,record.name); if(value!==null) action(()=>api('/records/'+record.id,'PATCH',{name:value}));});
      const remove=document.createElement('button'); remove.className='secondary'; remove.textContent='×'; remove.setAttribute('aria-label','Delete '+record.name); remove.addEventListener('click',()=>action(()=>api('/records/'+record.id,'DELETE')));
      row.append(checkbox,name,rename,remove); list.append(row);
    });
    const completed=records.filter(r=>r.done).length;
    if(kind==='guest') $('#guest-summary').textContent=completed+' / '+records.length;
    else {
      $('#task-summary').textContent=completed+' of '+records.length+' ready for the night';
      $('#task-preview').replaceChildren();
      records.slice(0,2).forEach(r=>{const el=document.createElement('div'); el.textContent=(r.done?'✓ ':'○ ')+r.name; $('#task-preview').append(el);});
    }
  }
}
function renderTracks() {
  $('#track-list').replaceChildren();
  state.tracks.forEach((track,index)=> {
    const row=document.createElement('div'); row.className='track-row';
    const name=document.createElement('span'); name.textContent=track.name;
    const play=document.createElement('button'); play.className='primary'; play.textContent='Play'; play.addEventListener('click',()=>action(()=>playTrack(index)));
    const remove=document.createElement('button'); remove.className='secondary'; remove.textContent='×'; remove.setAttribute('aria-label','Delete '+track.name);
    remove.addEventListener('click',()=>action(async()=>{if(playingId===track.id){player.pause(); player.removeAttribute('src'); playingId=null; $('#now-playing').textContent='Pick your party soundtrack'; $('#play-track').textContent='Play music';} await api('/tracks/'+track.id,'DELETE');}));
    row.append(name,play,remove); $('#track-list').append(row);
  });
}
function renderLogRows(container, records, detailed=false) {
  container.replaceChildren(); container.classList.toggle('subtle', !records.length);
  if(!records.length) {container.textContent='Start a scan to discover a little mystery.';container.classList.add('subtle');}
  records.forEach(record=> {
    const row=document.createElement('div');row.className='log-row';
    const label=document.createElement('span');
    label.textContent=new Date(record.time).toLocaleTimeString([], {timeZone:state.settings.timezone,hour:'2-digit',minute:'2-digit',second:'2-digit'})+' · '+record.room+(detailed?' · '+record.event:'');
    label.title=record.event;
    const value=document.createElement('span');value.textContent=record.emf.toFixed(1)+' mG';
    row.append(label,value);container.append(row);
  });
}
function renderLogs() {renderLogRows($('#log-preview'),state.detections.slice(0,2));}
function temperature(n) {if(!Number.isFinite(n)) return '—°'+state.settings.units; return (state.settings.units==='F'?n*9/5+32:n).toFixed(1)+'°'+state.settings.units;}
function renderWeather() {
  const weather=state.weather, current=weather.current;
  const locationName=state.settings.location?.name || '';
  $('#weather-location').textContent=locationName || 'Set location ↗';
  $('#weather-location').setAttribute('aria-label',locationName?'Change weather location: '+locationName:'Set weather location');
  $('#weather-location').title=locationName || 'Set weather location';
  $('#weather-status').textContent={unset:'',loading:'Loading forecast…',offline:'Offline • forecast unavailable',fresh:'Updated '+(weather.fetched?new Date(weather.fetched*1000).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):''),stale:'Offline / stale • last update '+(weather.fetched?new Date(weather.fetched*1000).toLocaleString():'' )}[weather.status];
  if(!current) {$('#weather-icon').dataset.kind='clear'; $('#weather-icon').textContent='☾'; $('#temperature').textContent='—°'; $('#weather-condition').textContent=weather.status==='unset'?'Choose your city':weather.status==='offline'?'Weather unavailable':'Loading weather'; $('#weather-detail').textContent=weather.status==='unset'?'Tap ⌖ to select a city in Settings.':weather.status==='offline'?'Check your Internet connection.':'Fetching temperature, feels-like and wind…'; return;}
  if(locationName) $('#weather-status').textContent=locationName.split(',')[0]+' · '+$('#weather-status').textContent;
  const code=current.weather_code;
  const label=!Number.isFinite(code)?'Weather unavailable':code===0?'Clear skies':code<=3?'Cloudy':code<=48?'Ghostly fog':code<=67?'Rainy night':code<=77?'Snowy skies':code<=86?'Passing showers':'Thunder & mystery';
  $('#temperature').textContent=temperature(current.temperature_2m);
  $('#weather-condition').textContent=label;
  $('#weather-detail').textContent='Feels like '+temperature(current.apparent_temperature)+' · Wind '+(Number.isFinite(current.wind_speed_10m)?current.wind_speed_10m+' km/h':'—');
  const kind=current.wind_speed_10m>20?'wind':code>=45&&code<=48?'fog':code===0?'clear':'cloud';
  $('#weather-icon').dataset.kind=kind;
  $('#weather-icon').textContent=kind==='clear'?'☾':kind==='cloud'?'☁':'';
}
function renderCountdown() {
  if(!state) return;
  const elapsed=(Date.now()-state.received)/1000;
  $$('[data-countdown]').forEach(el=> {
    const countdown=el.closest('#party')?(state.party_countdown||state.countdown):state.countdown;
    const seconds=Math.max(0,Math.floor(countdown.seconds-elapsed));
    const values=[Math.floor(seconds/86400),Math.floor(seconds/3600)%24,Math.floor(seconds/60)%60];
    if(!el.children.length) el.innerHTML='<span class="digit"><b></b><small>DAYS</small></span><span class="colon">:</span><span class="digit"><b></b><small>HOURS</small></span><span class="colon">:</span><span class="digit"><b></b><small>MINUTES</small></span>';
    $$('.digit b',el).forEach((b,i)=>b.textContent=String(values[i]).padStart(2,'0'));
  });
  $$('.countdown-target').forEach(el=>{
    const countdown=el.closest('#party')?(state.party_countdown||state.countdown):state.countdown;
    el.textContent=new Date(countdown.target).toLocaleDateString([],{timeZone:state.settings.timezone,month:'short',day:'numeric',year:'numeric'})+' · '+state.settings.timezone.split('/').pop().replaceAll('_',' ');
  });
  $('#clock').textContent=new Date().toLocaleTimeString([],{timeZone:state.settings.timezone,hour:'2-digit',minute:'2-digit'});
}
function render() {

  const settings=state.settings;
  welcomeAtmosphere.configure(settings,state.backgrounds||[],state.cutscene?.items||[]);
  const hash=JSON.stringify(settings);
  if(hash!==settingsHash) {
    settingsHash=hash;
    document.body.classList.toggle('reduced-motion',settings.reduced_motion);
    document.body.classList.toggle('flicker',settings.flicker);
    document.body.classList.toggle('low-quality',settings.quality==='low'||settings.quality==='auto'&&innerWidth<=1000);
    $('#sensitivity').value=settings.sensitivity;
    updateVolume();
    $('#music-shuffle').checked=settings.music_shuffle;
  }
  for(const [key,renderFn] of [['records',renderRecords],['tracks',renderTracks],['effects',renderEffects],['detections',renderLogs]]) {
    const hash=JSON.stringify(state[key]);
    if(key==='records'&&hash!==recordsHash){recordsHash=hash;renderFn();}
    if(key==='tracks'&&hash!==tracksHash){tracksHash=hash;renderFn();}
    if(key==='effects'&&hash!==effectsHash){effectsHash=hash;renderFn();}
    if(key==='detections'&&hash!==logsHash){logsHash=hash;renderFn();}
  }
  renderWeather(); renderCountdown();
  const haunt=state.haunt;
  $('#scene-title').textContent=haunt.scene;
  if(state.scenes && $('#haunt-scene').options.length!==state.scenes.length) {
    $('#haunt-scene').replaceChildren(...state.scenes.map(name=>{const option=document.createElement('option');option.textContent=option.value=name;return option;}));
  }
  if(state.welcome?.active && state.welcome.id!==lastWelcome && !visitor.active) {
    lastWelcome=state.welcome.id;
    for(const dialog of $$('dialog[open]')) if(dialog.id!=='scene-dialog') dialog.close();
    visitor.start(state.welcome,settings,state.cutscene);
  }
  if(visitor.active && !state.welcome?.active && visitor.mode!=='scene') visitor.finish();
  if(previousHauntActive && !haunt.active && $('#scene-dialog').open) {
    $('#scene-dialog').close();
    if(visitor.mode==='scene')visitor.sceneFinished();else navigate('haunt');
  }
  $('#pumpkin').disabled=Boolean(state.welcome?.active||haunt.active);
  previousHauntActive=haunt.active;
  scenePlayer.update(haunt,settings);
  $('#haunt-stage').textContent=haunt.stage;
  $('#haunt').classList.toggle('haunt-running',haunt.active); $('#haunt').dataset.scene=haunt.scene;
  $('#haunt').style.setProperty('--scene-progress',(haunt.progress||0)+'%');
  $('#activate-haunt').disabled=haunt.active;
  $('#motion-state').textContent=haunt.motion?'Motion detected · simulated':'All quiet on the porch';
  $('#haunt-scene').value=haunt.scene; $('#haunt-scene').disabled=false;
  $$('[data-haunt]').forEach(el=>{el.disabled=haunt.active&&el.dataset.haunt!=='sound';if(document.activeElement!==el){el.value=haunt[el.dataset.haunt]; $('#'+el.dataset.haunt+'-output').textContent=el.value+'%';}});
  $('.bulb-art').style.opacity=.2+haunt.room/125;
  $('.porch-art').style.opacity=.2+haunt.porch/125;
  $('.fog-art').style.opacity=.25+haunt.fog/133;
  if(haunt.active&&haunt.stage!==previousHauntStage&&audioEnabled) {effect.src='./assets/'+haunt.audio;effect.currentTime=0; effect.play().catch(()=>{});}
  if(!haunt.active && previousHauntStage!==haunt.stage) effect.pause();
  if(!haunt.active){if(cueRun!==null)stopCues();blockedCueRun=null;}
  else if(audioEnabled&&cueRun!==haunt.run_id&&blockedCueRun!==haunt.run_id){stopCues();cueRun=haunt.run_id;playRandomCue();}
  previousHauntStage=haunt.stage; updateVolume();
  const scan=state.scan;
  $('#scan-toggle').textContent=scan.active?'Stop scan':'Start scan';
  $('#needle').style.transform='rotate('+scan.emf*40+'deg)';
  $('#emf-value').textContent=scan.emf.toFixed(1)+' mG';
  $('#scan-temperature').textContent=temperature(scan.temperature);
  $('#peak-emf').textContent=scan.peak.toFixed(1)+' mG';
  if(!$('#room-bars').children.length) ['Hallway','Attic','Parlor','Basement'].forEach((name,i)=>{const row=document.createElement('div'); row.className='room-row'; const label=document.createElement('span'); label.textContent=String(i+1).padStart(2,'0')+' '+name; const bar=document.createElement('div'); bar.className='bar'; bar.append(document.createElement('i')); row.append(label,bar); $('#room-bars').append(row);});
  $$('.bar i').forEach((el,i)=>{el.style.width=scan.rooms[i]+'%';el.classList.toggle('high',scan.rooms[i]>70);});
  if(settings.jumpscares&&scan.active&&scan.emf>4&&currentScreen==='detector'&&Date.now()-lastScare>90000){lastScare=Date.now(); $('#scare').hidden=false; setTimeout(()=>$('#scare').hidden=true,600); if(audioEnabled){effect.currentTime=0;effect.play().catch(()=>{});}}
}
async function sync() {
  if(syncing) return;
  syncing=true;
  try {
    state=await api('/state'); state.received=Date.now(); render();
    $('#connection').textContent=navigator.onLine?'● Ready':'● Offline'; $('#connection').classList.toggle('offline',!navigator.onLine);
    const notice=$('#storage-notice');notice.textContent=hub.storageNotice;notice.hidden=!hub.storageNotice;
  } catch(error) {$('#connection').textContent='● Unavailable';$('#connection').classList.add('offline');console.error(error);toast(error.message);}
  finally {syncing=false;}
}
setInterval(()=> {
  renderCountdown();
  if(state?.settings.rotation&&!document.hidden&&!$('dialog[open]')&&Date.now()-lastInteraction>120000&&Date.now()-lastRotation>30000) {navigate(screens[(screens.indexOf(currentScreen)+1)%4]);lastRotation=Date.now();}
},1000);
setInterval(()=>{if(!document.hidden)sync();},1000);
document.addEventListener('visibilitychange',()=>{document.body.classList.toggle('page-hidden',document.hidden);if(!document.hidden){sync();if(currentScreen==='party'&&audioEnabled)startEqualizer();}else{cancelAnimationFrame(frame);frame=0;}});
sync();


$$('[data-export-logs]').forEach(link=>link.addEventListener('click',event=>{event.preventDefault();hub.exportLogs();}));
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});

$('#restore-audio').addEventListener('click',()=>action(async()=>{await api('/audio/restore','POST');toast('Included music and sound effects restored');}));
