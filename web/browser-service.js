import {SCENES} from './scenes.js';
import {MEDIA} from './media-manifest.js';

const clone = value => structuredClone(value);
const pick = values => values[Math.floor(Math.random() * values.length)];
const rooms = ['Hallway', 'Attic', 'Parlor', 'Basement'];
export const DEFAULTS = {
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  units:'C', location:null, volume:40, rotation:false, music_shuffle:true,
  reduced_motion:false, jumpscares:false, flicker:false, quality:'auto',
  party_date:'', sensitivity:'medium'
};

const formatters = new Map();
function parts(epoch, zone) {
  if (!formatters.has(zone)) formatters.set(zone, new Intl.DateTimeFormat('en-CA', {
    timeZone:zone, year:'numeric', month:'2-digit', day:'2-digit',
    hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23'
  }));
  return Object.fromEntries(formatters.get(zone).formatToParts(epoch)
    .filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)]));
}
// Resolve local wall time using offsets on either side of a possible DST change.
// The earlier occurrence wins for a repeated time; missing local times are rejected.
export function zonedEpoch(local, zone) {
  const naive = Date.UTC(local.year, local.month-1, local.day, local.hour||0, local.minute||0, local.second||0);
  const candidates = new Set();
  for (const delta of [-86400000, 0, 86400000]) {
    const probe = naive + delta, p = parts(probe, zone);
    const offset = Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second) - probe;
    const epoch = naive-offset, actual = parts(epoch, zone);
    if (['year','month','day','hour','minute','second'].every(k => actual[k] === (local[k]||0))) candidates.add(epoch);
  }
  if (!candidates.size) throw new Error('That local date/time does not exist in the selected timezone.');
  return Math.min(...candidates);
}
function parseParty(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) throw new Error('Choose a valid local party date and time.');
  return Object.fromEntries(['year','month','day','hour','minute','second'].map((k,i) => [k,Number(match[i+1]||0)]));
}
export function countdown(settings, now=Date.now(), party=false) {
  const p = parts(now,settings.timezone);
  let target;
  if (party && settings.party_date) target = zonedEpoch(parseParty(settings.party_date),settings.timezone);
  else target = zonedEpoch({year:p.year+(p.month>10?1:0),month:10,day:31,hour:0,minute:0,second:0},settings.timezone);
  return {seconds:Math.max(0,Math.floor((target-now)/1000)),target:new Date(target).toISOString()};
}

export class BrowserHub {
  constructor() {
    this.db = null;
    this.storageNotice = '';
    this.data = {settings:clone(DEFAULTS),records:[],detections:[],weather:{},candy:0};
    this.audio = [];
    this.urls = new Map();
    this.haunt = {active:false,stage:'Quiet shadows',room:60,porch:80,fog:0,sound:40,
      motion:false,scene:'Quiet shadows',audio:'quiet-scene.wav',progress:0,run_id:0,seed:0,source:'manual'};
    this.scan = {active:false,emf:0,temperature:18.6,rooms:[0,0,0,0],peak:0};
    this.welcome = {active:false,id:0};
    this.savedLights = {room:60,porch:80};
    this.nextLog = 0;this.lastScan = 0;this.refreshing = false;this.retryAt = 0;
    this.ready = this.open();
  }
  async open() {
    try {
      this.db = await new Promise((resolve,reject) => {
        const request = indexedDB.open('halloween-hub-web',1);
        let abandoned = false;
        request.onupgradeneeded = () => {
          request.result.createObjectStore('data');
          request.result.createObjectStore('audio',{keyPath:'id'});
        };
        request.onsuccess = () => abandoned ? request.result.close() : resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onblocked = () => {abandoned=true;reject(new Error('Close other tabs to enable storage.'));};
      });
      this.db.onversionchange = () => {this.db.close();this.db=null;this.storageNotice='Storage changed in another tab. Reload before making changes.';};
      const entries = await Promise.all(Object.keys(this.data).map(async key => [key,await this.read('data',key)]));
      for (const [key,value] of entries) if (value !== undefined) this.data[key] = value;
      this.data.settings = {...DEFAULTS,...this.data.settings};
      this.audio = await this.read('audio');
      for (const item of this.audio) this.urls.set(item.id,URL.createObjectURL(item.blob));
    } catch {
      this.db?.close();this.db=null;
      this.storageNotice='Browser storage is unavailable. Changes last only until this page closes; existing saved data is untouched.';
    }
  }
  read(store,key) {
    return new Promise((resolve,reject) => {
      const tx=this.db.transaction(store),request=key===undefined?tx.objectStore(store).getAll():tx.objectStore(store).get(key);
      request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
    });
  }
  write(store,operation) {
    if (!this.db) return Promise.resolve();
    return new Promise((resolve,reject) => {
      const tx=this.db.transaction(store,'readwrite');
      try {operation(tx.objectStore(store));} catch(error) {tx.abort();reject(error);return;}
      tx.oncomplete=()=>resolve();
      tx.onabort=tx.onerror=()=>reject(new Error('Could not save: browser storage is full or unavailable. Existing saved data is unchanged.'));
    });
  }
  async save(changes) {
    await this.write('data',store=>{for(const [key,value] of Object.entries(changes))store.put(value,key);});
    Object.assign(this.data,clone(changes));
  }
  async settings(changes) {
    const next={...this.data.settings,...changes};
    for(const [key,value] of Object.entries(changes)) {
      if(!(key in DEFAULTS))throw new Error('Unknown setting');
      if(typeof DEFAULTS[key]==='boolean' && typeof value!=='boolean')throw new Error('Expected a boolean');
    }
    if(!['C','F'].includes(next.units)||!['auto','low','high'].includes(next.quality)||!['low','medium','high'].includes(next.sensitivity))throw new Error('Invalid setting');
    if(!Number.isInteger(next.volume)||next.volume<0||next.volume>100)throw new Error('Volume must be 0–100');
    try {parts(Date.now(),next.timezone);}catch{throw new Error('Choose a valid timezone, such as America/Toronto or Europe/London.');}
    if(typeof next.party_date!=='string')throw new Error('Choose a valid party date');
    if(next.party_date)zonedEpoch(parseParty(next.party_date),next.timezone);
    if(next.location!==null && (typeof next.location.name!=='string'||!Number.isFinite(next.location.latitude)||Math.abs(next.location.latitude)>90||!Number.isFinite(next.location.longitude)||Math.abs(next.location.longitude)>180))throw new Error('Choose a valid city');
    await this.save({settings:next});this.retryAt=0;
    return clone(next);
  }
  command(body) {
    const h=this.haunt,action=body.action;
    if(['activate','play','random'].includes(action)) {
      if(body._source!=='encounter')this.welcome.active=false;
      let name=h.scene;
      if(action==='random')name=pick(Object.keys(SCENES).filter(n=>n!==name));
      if(action==='play')name=body.scene;
      if(!SCENES[name])throw new Error('Choose a known haunt scene');
      if(action!=='activate')[h.room,h.porch,h.fog,h.sound]=SCENES[name].preset;
      else if(h.active)Object.assign(h,this.savedLights);
      this.savedLights={room:h.room,porch:h.porch};this.started=performance.now();
      const seed=crypto.getRandomValues(new Uint32Array(1))[0];
      Object.assign(h,{scene:name,active:true,progress:0,audio:SCENES[name].audio,seed,run_id:seed,source:body._source||'manual'});
      this.stepScene();
    } else if(action==='stop') {
      this.welcome.active=false;
      Object.assign(h,{...(h.active?this.savedLights:{}),active:false,stage:'Stopped',fog:0,motion:false,progress:0});
    } else if(action==='motion')h.motion=!h.motion;
    else if(action==='set') {
      if(h.active&&body.key!=='sound')throw new Error('Stop the scene before changing this control');
      if(!['room','porch','fog','sound'].includes(body.key)||!Number.isFinite(body.value)||body.value<0||body.value>100)throw new Error('Slider value must be 0–100');
      h[body.key]=body.value;
    } else throw new Error('Unknown scene command');
    return clone(h);
  }
  stepScene() {
    const h=this.haunt;if(!h.active)return;
    const elapsed=(performance.now()-this.started)/1000,scene=SCENES[h.scene];
    if(elapsed>=20) {
      Object.assign(h,this.savedLights,{active:false,stage:h.scene+' · Complete',fog:0,motion:false,progress:100});
      this.welcome.active=false;return;
    }
    const phase=Math.min(3,Math.floor(elapsed/5));
    Object.assign(h,{stage:h.scene+' · '+scene.phases[phase],fog:scene.fog[phase],motion:phase===2,progress:Math.round(elapsed*5),
      room:Math.round(this.savedLights.room*scene.room[phase]),porch:Math.round(this.savedLights.porch*scene.porch[phase])});
  }
  encounter(body) {
    if(body.action==='start') {
      if(this.haunt.active||this.welcome.active)throw new Error('Finish the current activity first');
      this.welcome={active:true,id:crypto.randomUUID(),source:'touch'};
    } else if(['heartbeat','finish'].includes(body.action)) {
      if(body.id===this.welcome.id&&body.action==='finish')this.welcome.active=false;
    } else throw new Error('Unknown adventure command');
    this.welcomeDeadline=performance.now()+120000;
    return clone(this.welcome);
  }
  async tick() {
    this.stepScene();
    if(this.welcome.active&&performance.now()>=this.welcomeDeadline)this.welcome.active=false;
    if(!this.scan.active||performance.now()-this.lastScan<950)return;
    this.lastScan=performance.now();
    const factor={low:.55,medium:.8,high:1}[this.data.settings.sensitivity];
    const emf=Math.round((.1+Math.random()*4.9)*factor*10)/10;
    Object.assign(this.scan,{emf,temperature:Math.round((17.5+Math.random()*2.3)*10)/10,rooms:rooms.map(()=>Math.round(Math.random()*100)),peak:Math.max(this.scan.peak,emf)});
    if(performance.now()>=this.nextLog) {
      this.nextLog=performance.now()+8000;
      const log={id:crypto.randomUUID(),time:new Date().toISOString(),room:pick(rooms),event:emf>2.5?'Simulated EMF spike':'Simulated faint presence',emf};
      try {await this.save({detections:[log,...this.data.detections].slice(0,500)});}
      catch(error){this.scan.active=false;throw error;}
    }
  }
  async fetchJson(url) {
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),6000);
    try {const response=await fetch(url,{signal:controller.signal});if(!response.ok)throw new Error('Service unavailable');return await response.json();}
    finally {clearTimeout(timer);}
  }
  weather() {
    const location=this.data.settings.location;
    if(!location)return {status:'unset'};
    const key=`${location.latitude},${location.longitude}`,cached=this.data.weather;
    const valid=cached.key===key,age=Date.now()/1000-(cached.fetched||0);
    if(navigator.onLine&&(!valid||age>=900)&&!this.refreshing&&Date.now()>=this.retryAt) {
      this.refreshing=true;
      const query=new URLSearchParams({latitude:location.latitude,longitude:location.longitude,current:'temperature_2m,apparent_temperature,weather_code,wind_speed_10m',hourly:'temperature_2m',forecast_days:1,timezone:'auto'});
      this.fetchJson('https://api.open-meteo.com/v1/forecast?'+query).then(async data=>{
        if(!data.current||!Number.isFinite(data.current.temperature_2m))throw new Error('Invalid forecast');
        await this.save({weather:{key,fetched:Date.now()/1000,current:data.current,hourly:data.hourly||{}}});
        this.retryAt=0;
      }).catch(()=>{this.retryAt=Date.now()+60000;}).finally(()=>{this.refreshing=false;});
    }
    return valid?{...clone(cached),status:navigator.onLine&&age<900?'fresh':'stale'}:{status:this.refreshing?'loading':'offline'};
  }
  async locations(query) {
    const q=query.trim();if(q.length<2||q.length>100)throw new Error('Enter a city name (2–100 characters)');
    try {
      const data=await this.fetchJson('https://geocoding-api.open-meteo.com/v1/search?'+new URLSearchParams({name:q,count:5,language:'en',format:'json'}));
      return {results:(data.results||[]).map(r=>({name:[r.name,r.admin1,r.country].filter(Boolean).join(', '),latitude:r.latitude,longitude:r.longitude}))};
    } catch {throw new Error('Location search is unavailable. Try again when online.');}
  }
  async importAudio(kind,file) {
    if(!(file instanceof Blob)||!file.size||file.size>100*1024*1024||! /\.(mp3|wav|ogg)$/i.test(file.name))throw new Error('Choose an MP3, WAV, or OGG smaller than 100 MB');
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');
    const id=kind+'-'+hash;
    if(this.audio.some(item=>item.id===id))return {id,duplicate:true};
    const item={id,kind,name:file.name,blob:file};
    await this.write('audio',store=>store.put(item));
    this.audio.push(item);this.urls.set(id,URL.createObjectURL(file));
    return {id,duplicate:false};
  }
  async removeAudio(kind,id) {
    const item=this.audio.find(a=>a.kind===kind&&a.id===id);if(!item)throw new Error('Audio file not found');
    await this.write('audio',store=>store.delete(id));
    URL.revokeObjectURL(this.urls.get(id));this.urls.delete(id);this.audio=this.audio.filter(a=>a.id!==id);
    return {ok:true};
  }
  snapshot() {
    const settings=clone(this.data.settings);
    const list=kind=>this.audio.filter(a=>a.kind===kind).map(({id,name})=>({id,name}));
    return {settings,candy:this.data.candy,records:clone(this.data.records),tracks:list('tracks'),effects:list('effects'),
      detections:clone(this.data.detections.slice(0,20)),weather:this.weather(),countdown:countdown(settings),party_countdown:countdown(settings,Date.now(),true),
      cutscene:{available:true,...MEDIA.cutscenes[0],items:MEDIA.cutscenes},backgrounds:MEDIA.backgrounds,scenes:Object.keys(SCENES),
      haunt:clone(this.haunt),scan:clone(this.scan),welcome:clone(this.welcome)};
  }
  async request(path,method='GET',body={}) {
    await this.ready;
    if(path==='/state'){await this.tick();return this.snapshot();}
    if(path==='/settings'&&method==='PATCH')return this.settings(body);
    if(path==='/haunt'&&method==='POST')return this.command(body);
    if(path==='/encounter'&&method==='POST')return this.encounter(body);
    if(path==='/scan'&&method==='POST') {
      if(typeof body.active!=='boolean')throw new Error('Expected scan on/off');
      this.scan.active=body.active;this.nextLog=0;return clone(this.scan);
    }
    if(path==='/logs')return {detections:clone(this.data.detections)};
    if(path.startsWith('/locations?'))return this.locations(new URLSearchParams(path.split('?')[1]).get('q')||'');
    if(path==='/candy'&&method==='POST') {
      if(!Number.isInteger(body.delta)||Math.abs(body.delta)>10000)throw new Error('Invalid candy adjustment');
      await this.save({candy:Math.max(0,this.data.candy+body.delta)});return {candy:this.data.candy};
    }
    if(path==='/records'&&method==='POST') {
      if(!['guest','task'].includes(body.kind))throw new Error('Choose guest or task');
      const name=String(body.name||'').trim();if(!name||name.length>120)throw new Error('Enter a name (1–120 characters)');
      const record={id:crypto.randomUUID(),kind:body.kind,name,done:false};
      await this.save({records:[record,...this.data.records]});return {id:record.id};
    }
    if(path.startsWith('/records/')) {
      const id=path.slice(9),record=this.data.records.find(r=>r.id===id);
      if(!record)throw new Error('Record not found');
      let records=clone(this.data.records);
      if(method==='DELETE')records=records.filter(r=>r.id!==id);
      else if(method==='PATCH') {
        const updated=records.find(r=>r.id===id);
        if('done' in body){if(typeof body.done!=='boolean')throw new Error('Expected a checkbox value');updated.done=body.done;}
        if('name' in body){const name=String(body.name).trim();if(!name||name.length>120)throw new Error('Enter a name (1–120 characters)');updated.name=name;}
      } else throw new Error('Unknown record command');
      await this.save({records});return {ok:true};
    }
    const audio=/^\/(tracks|effects)(?:\/(.+))?$/.exec(path);
    if(audio&&method==='POST'&&!audio[2])return this.importAudio(audio[1],body.get('file'));
    if(audio&&method==='DELETE'&&audio[2])return this.removeAudio(audio[1],audio[2]);
    throw new Error('Unknown browser action');
  }
  exportLogs() {
    const quote=value=>'"'+String(value).replaceAll('"','""')+'"';
    const csv=[['time','room','event','emf_mG_simulated'],...this.data.detections.map(r=>[r.time,r.room,r.event,r.emf])].map(row=>row.map(quote).join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),link=document.createElement('a');
    link.href=url;link.download='ghost-detections.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
}
export const hub = new BrowserHub();
export const mediaUrl = (kind,id) => hub.urls.get(id) || '';
