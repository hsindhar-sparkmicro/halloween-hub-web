// Welcome navigation overlays the scene only when requested; other screens keep it visible.
export function setupWelcomeChrome() {
 const dashboard=document.querySelector('#dashboard');
 const bars=[document.querySelector('#app > header'),document.querySelector('#app > nav')];
 let timer=0,wasWelcome=null;
 const welcome=()=>dashboard.classList.contains('active');
 function hide(){
  clearTimeout(timer);
  if(bars.some(bar=>bar.querySelector(':focus-visible'))){timer=setTimeout(hide,7000);return;}
  document.body.classList.remove('welcome-controls');
  bars.forEach(bar=>bar.inert=welcome());
 }
 function reveal(){
  if(!welcome())return;
  clearTimeout(timer);bars.forEach(bar=>bar.inert=false);
  document.body.classList.add('welcome-controls');
  timer=setTimeout(hide,7000);
 }
 function sync(){
  if(wasWelcome===welcome())return;
  wasWelcome=welcome();
  clearTimeout(timer);document.body.classList.toggle('welcome-fullscreen',welcome());
  document.body.classList.remove('welcome-controls');bars.forEach(bar=>bar.inert=welcome());
 }
 new MutationObserver(sync).observe(dashboard,{attributes:true,attributeFilter:['class']});
 document.addEventListener('pointerdown',event=>{
  if(!welcome()||event.target.closest('#pumpkin,dialog'))return;
  reveal();
 });
 document.addEventListener('keydown',event=>{
  if(!document.querySelector('dialog[open]')&&['Tab','Escape'].includes(event.key))reveal();
 },true);
 bars.forEach(bar=>bar.addEventListener('focusin',reveal));
 sync();
}
