// Local visual playback; browser state remains authoritative for timing and Stop.
export class ScenePlayer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', {alpha:false});
    this.art = new Image(); this.art.src = './assets/scene-backgrounds.png';
    this.glows = new Map(); this.clouds=[]; this.background=null;
    this.frame = 0; this.visible = false; this.settings = {};
    this.haunt = {}; this.anchor = performance.now(); this.progress = 0;
    document.addEventListener('visibilitychange', () => this.schedule());
  }
  update(haunt, settings) {
    const changed = haunt.scene !== this.haunt.scene || haunt.progress !== this.haunt.progress || haunt.active !== this.haunt.active;
    if(haunt.run_id !== this.haunt.run_id || !this.clouds.length) {
      let seed=haunt.seed||1;
      const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
      this.clouds=Array.from({length:12},()=>({x:random()*1600-300,y:340+random()*260,r:95+random()*170,speed:8+random()*24,drift:random()*30,phase:random()*6.28,life:7+random()*12,delay:random()*15,alpha:.12+random()*.25}));
      this.wind=random()<.5?-1:1;
    }
    this.haunt = {...haunt}; this.settings = settings;
    if (changed) {this.progress = haunt.progress || 0; this.anchor = performance.now();}
    this.schedule();
  }
  show(visible) {this.visible = visible; this.schedule();}
  schedule() {
    cancelAnimationFrame(this.frame); this.frame = 0;
    if (!this.visible || document.hidden) return;
    this.draw(performance.now());
    if (this.haunt.active && !this.settings.reduced_motion) {
      let last = 0;
      const tick = now => {
        if (!this.visible || document.hidden || !this.haunt.active || this.settings.reduced_motion) {this.frame=0; return;}
        if (now-last >= 32) {this.draw(now); last=now;}
        this.frame = requestAnimationFrame(tick);
      };
      this.frame=requestAnimationFrame(tick);
    }
  }
  glow(x,y,r,color) {
    let sprite=this.glows.get(color);
    if(!sprite) {
      sprite=document.createElement('canvas');sprite.width=sprite.height=192;
      const c=sprite.getContext('2d'),g=c.createRadialGradient(96,96,0,96,96,96);
      g.addColorStop(0,color);g.addColorStop(1,'transparent');c.fillStyle=g;c.fillRect(0,0,192,192);
      this.glows.set(color,sprite);
    }
    this.ctx.drawImage(sprite,x-r,y-r,r*2,r*2);
  }
  bat(x,y,size,t) {
    const c=this.ctx, wing=Math.sin(t*7)*size*.5;
    c.save();c.translate(x,y);c.fillStyle='#080712';c.beginPath();
    c.moveTo(0,0);c.quadraticCurveTo(-size,-size-wing,-size*1.5,wing);
    c.lineTo(-size*.7,size*.3);c.lineTo(-size*.3,0);c.lineTo(0,size*.4);
    c.lineTo(size*.3,0);c.lineTo(size*.7,size*.3);c.lineTo(size*1.5,wing);
    c.quadraticCurveTo(size,-size-wing,0,0);c.fill();c.restore();
  }
  ghost(x,y,size,t,alpha,color='#d6c4ff') {
    const c=this.ctx;c.save();c.translate(x,y);c.scale(size,size);
    c.globalAlpha=alpha;c.fillStyle=color;c.shadowColor='#b273ee';c.shadowBlur=this.low?0:20;
    c.beginPath();c.moveTo(-.5,.7);c.quadraticCurveTo(-.6,-.7,0,-.7);
    c.quadraticCurveTo(.6,-.7,.5,.7);
    for(let i=4;i>=0;i--) c.lineTo(-.5+i*.25,.7+Math.sin(t*3+i)*.09);
    c.closePath();c.fill();c.shadowBlur=0;c.fillStyle='#211632';
    for(const x of [-.18,.18]) {c.beginPath();c.ellipse(x,-.15,.065,.11,0,0,Math.PI*2);c.fill();}
    c.beginPath();c.ellipse(0,.18,.075,.12,0,0,Math.PI*2);c.fill();c.restore();
  }
  pumpkin(x,y,size,t,index) {
    const c=this.ctx;c.save();c.translate(x,y);c.rotate(Math.sin(t*3+index)*.08);c.scale(size,size);
    const g=c.createRadialGradient(-.2,-.2,.1,0,0,.8);g.addColorStop(0,'#f18b24');g.addColorStop(1,'#77301a');
    c.fillStyle=g;c.beginPath();c.ellipse(0,0,.64,.53,0,0,Math.PI*2);c.fill();
    c.strokeStyle='#a2491b';c.lineWidth=.025;
    for(const x of [-.32,0,.32]) {c.beginPath();c.ellipse(x,0,.22,.51,0,0,Math.PI*2);c.stroke();}
    c.strokeStyle='#6c7940';c.lineWidth=.1;c.beginPath();c.moveTo(0,-.49);c.quadraticCurveTo(-.06,-.72,.1,-.78);c.stroke();
    c.fillStyle='#ffdf66';c.shadowColor='#ff8b23';c.shadowBlur=this.low?0:12;
    c.beginPath();c.moveTo(-.42,-.08);c.lineTo(-.24,-.32);c.lineTo(-.1,-.05);c.closePath();c.fill();
    c.beginPath();c.moveTo(.12,-.05);c.lineTo(.28,-.32);c.lineTo(.44,-.08);c.closePath();c.fill();
    c.beginPath();c.moveTo(-.4,.14);c.quadraticCurveTo(0,.35+Math.sin(t*2+index)*.1,.4,.14);
    c.quadraticCurveTo(0,.65,-.4,.14);c.fill();c.restore();
  }
  backdrop(width,height,index) {
    const key=[width,height,index,this.art.complete&&this.art.naturalWidth].join(':');
    if(this.backgroundKey===key) return;
    this.backgroundKey=key;this.background=document.createElement('canvas');
    this.background.width=width;this.background.height=height;
    const c=this.background.getContext('2d',{alpha:false});
    c.fillStyle='#0c0a18';c.fillRect(0,0,width,height);
    if(this.art.complete&&this.art.naturalWidth) {
      const w=this.art.naturalWidth/2,h=this.art.naturalHeight/4;
      c.drawImage(this.art,index%2*w+2,Math.floor(index/2)*h+2,w-4,h-4,0,0,width,height);
    }
    const v=c.createRadialGradient(width/2,height/2,height*.2,width/2,height/2,width*.65);
    v.addColorStop(0,'transparent');v.addColorStop(1,'#02030a99');c.fillStyle=v;c.fillRect(0,0,width,height);
  }
  vampire(t,phase) {
    const c=this.ctx;
    c.fillStyle='#20101c';c.strokeStyle='#723546';c.lineWidth=3;
    c.beginPath();c.moveTo(440,575);c.lineTo(410,420);c.lineTo(455,370);c.lineTo(550,370);c.lineTo(590,420);c.lineTo(560,575);c.closePath();c.fill();c.stroke();
    if(phase>=1&&phase<3) {
      const scale=phase===2?1+(t-10)*.1:.75;
      c.save();c.translate(505,450);c.scale(scale,scale);
      c.fillStyle='#380923';c.beginPath();c.moveTo(-25,-60);c.lineTo(-85,115);c.quadraticCurveTo(0,75,85,115);c.lineTo(25,-60);c.closePath();c.fill();
      c.fillStyle='#090711';c.fillRect(-23,-50,46,135);
      c.fillStyle='#e0d4c8';c.beginPath();c.ellipse(0,-76,19,26,0,0,Math.PI*2);c.fill();
      c.fillStyle='#710a27';c.fillRect(-13,-82,8,3);c.fillRect(5,-82,8,3);
      c.fillStyle='#fff';c.beginPath();c.moveTo(-7,-63);c.lineTo(-4,-54);c.lineTo(-1,-63);c.moveTo(2,-63);c.lineTo(5,-54);c.lineTo(8,-63);c.fill();c.restore();
    }
    if(phase===3) for(let i=0;i<14;i++) this.bat(500+Math.sin(i*2+t)*(t-14)*32,430-(t-15)*45+i*5,12,t+i);
  }
  buster(t,phase) {
    const c=this.ctx,x=530+Math.sin(t)*75,y=230+Math.sin(t*1.4)*40;
    if(phase<3)this.ghost(x,y,phase===0?30:115,t,.75,'#a8f568');
    c.fillStyle='#1b2632';c.strokeStyle='#8aa0a7';c.lineWidth=3;c.fillRect(470,525,70,30);c.strokeRect(470,525,70,30);
    if(phase===2) {
      for(let j=0;j<3;j++) {c.strokeStyle=['#fa822f','#66def8','#e8c07b'][j];c.lineWidth=3;c.beginPath();
        for(let i=0;i<12;i++){const p=i/11;const xx=100+(x-100)*p,yy=570+(y-570)*p+Math.sin(t*6+i+j)*14;if(!i)c.moveTo(xx,yy);else c.lineTo(xx,yy);}c.stroke();}
    }
    if(phase===3) for(let i=0;i<8;i++) this.glow(500+Math.sin(i+t)*80,520-(1-(t-15)/5)*i*30,16,'#99ff7755');
  }
  witch(t,phase) {
    const c=this.ctx;
    for(let i=0;i<8;i++) {const age=(t*1.5+i*.7)%4;this.glow(730+Math.sin(i*3+t)*25,430-age*35,6+age*2,'#a0ff5d99');}
    if(phase===2) {
      const x=(t-10)*230-80,y=180+Math.sin(t)*30;c.save();c.translate(x,y);
      c.strokeStyle='#c19350';c.lineWidth=5;c.beginPath();c.moveTo(-60,35);c.lineTo(75,15);c.stroke();
      c.fillStyle='#080714';c.beginPath();c.moveTo(-30,20);c.lineTo(0,-35);c.lineTo(45,25);c.closePath();c.fill();
      c.beginPath();c.arc(6,-42,12,0,Math.PI*2);c.fill();c.beginPath();c.moveTo(-16,-50);c.lineTo(10,-88);c.lineTo(32,-50);c.closePath();c.fill();c.restore();
    }
    for(let i=0;i<(this.low?7:14);i++)this.glow((i*137+Math.sin(t+i)*35)%1000,120+i%5*75+Math.sin(t*.7+i)*20,7,'#d6ff6388');
  }
  graveyard(t,phase) {
    const c=this.ctx;
    if(phase>=1) for(let i=0;i<5;i++) {
      const rise=Math.min(1,(t-5)/5),x=140+i*180,y=580-rise*(65+i%2*25);
      c.strokeStyle='#b5bda7';c.lineCap='round';c.lineWidth=7;c.beginPath();c.moveTo(x,600);c.lineTo(x,y);c.stroke();
      for(let finger=0;finger<4;finger++) {c.lineWidth=4;c.beginPath();c.moveTo(x,y);c.lineTo(x-15+finger*10,y-20);c.lineTo(x-20+finger*13,y-40+Math.sin(t+i)*4);c.stroke();}
    }
    if(phase===3) for(let i=0;i<3;i++)this.ghost(200+i*280+Math.sin(t+i)*40,270+Math.sin(t+i)*45,65,t+i,.35,'#c4e4ef');
  }
  train(t,phase) {
    const c=this.ctx;
    if(phase===1)this.glow(620,300,25+(t-5)*12,'#fce9a755');
    if(phase>=2) {
      const x=-560+(t-10)*165;c.save();c.translate(x,430);c.globalAlpha=phase===3?Math.max(.15,1-(t-15)/6):.7;
      c.fillStyle='#244551';c.strokeStyle='#8aaaae';c.lineWidth=2;c.fillRect(0,-120,570,120);c.strokeRect(0,-120,570,120);
      for(let i=0;i<5;i++){c.fillStyle='#8be0c788';c.fillRect(30+i*100,-95,55,65);this.ghost(58+i*100,-60,27,t+i,.6);}
      c.fillStyle='#24323e';c.fillRect(570,-70,150,70);c.fillRect(580,-125,35,60);
      for(let i=0;i<7;i++){c.fillStyle='#111c26';c.beginPath();c.arc(35+i*100,12,24,0,Math.PI*2);c.fill();c.strokeStyle='#849f9f';c.beginPath();c.moveTo(35+i*100,12);c.lineTo(35+i*100+Math.sin(t*4)*20,12+Math.cos(t*4)*20);c.stroke();}
      this.glow(712,-35,55,'#ffe6a077');c.restore();
    }
  }
  draw(now) {
    const bounds=this.canvas.getBoundingClientRect();if(!bounds.width||!bounds.height)return;
    this.low=this.settings.quality==='low'||this.settings.quality==='auto'&&bounds.width<=1000;
    const width=Math.min(this.low?640:1280,Math.round(bounds.width)),height=Math.round(width*bounds.height/bounds.width);
    if(this.canvas.width!==width||this.canvas.height!==height){this.canvas.width=width;this.canvas.height=height;}
    const names=['Quiet shadows','Purple mist','Pumpkin parade','Transylvania vampire','Ghostbuster encounter',"Witch’s swamp",'Graveyard awakening','Phantom train'];
    const index=Math.max(0,names.indexOf(this.haunt.scene));this.backdrop(width,height,index);
    const c=this.ctx;c.setTransform(width/1000,0,0,height/600,0,0);c.drawImage(this.background,0,0,1000,600);
    const progress=Math.max(0,Math.min(100,this.progress+(this.haunt.active&&!this.settings.reduced_motion?Math.max(0,now-this.anchor)/200:0)));
    const phase=Math.min(3,Math.floor(progress/25)),t=this.settings.reduced_motion?phase*5:progress/5;
    if(index===0){this.glow(590,300,95,'#ef9e3833');c.save();c.globalAlpha=.4;c.fillStyle='#04050c';const x=470+Math.sin(t*.5)*130;c.beginPath();c.ellipse(x,420,17,50,0,0,Math.PI*2);c.fill();c.beginPath();c.arc(x,360,14,0,Math.PI*2);c.fill();c.restore();}
    if(index===1)for(let i=0;i<(phase===2?5:3);i++)this.ghost(180+i*160+Math.sin(t*.6+i)*80,210+Math.sin(t*1.2+i*2)*65,55+i%2*22,t+i,.6);
    if(index===2){for(let i=0;i<(this.low?5:7);i++){const x=(i*205+t*55)%1300-130,bounce=Math.abs(Math.sin(t*3+i))*(phase===2?25:12);this.pumpkin(x,520-bounce,66+i%2*16,t,i);}if(phase===2)for(let i=0;i<24;i++){c.fillStyle=['#ffb641','#b785f4','#eecba3'][i%3];c.fillRect((i*79+t*25)%1000,(i*63+t*70)%470,5,8);}}
    if(index===3)this.vampire(t,phase);
    if(index===4)this.buster(t,phase);
    if(index===5)this.witch(t,phase);
    if(index===6)this.graveyard(t,phase);
    if(index===7)this.train(t,phase);
    if([0,1,3,6].includes(index))for(let i=0;i<(this.low?3:6);i++){const cloud=this.clouds[i];this.bat((cloud.x+t*(30+cloud.speed))%1200-100,80+i*24+Math.sin(t+cloud.phase)*24,10+i%3*3,t+cloud.phase);}
    // Seeded per playback; independent cloud births, gusts, size and opacity.
    const color=[4,5].includes(index)?'#94cf9d88':index===3?'#aa647688':'#afa0d088';
    for(const cloud of this.clouds.slice(0,this.low?6:12)) {
      const age=(t+cloud.delay)%cloud.life,envelope=Math.sin(Math.PI*age/cloud.life);
      const x=((cloud.x+this.wind*t*cloud.speed+Math.sin(t*.35+cloud.phase)*cloud.drift+1800)%1800)-400;
      const y=cloud.y+Math.sin(t*.4+cloud.phase)*cloud.drift;
      c.globalAlpha=envelope*cloud.alpha*(phase===2?1.2:.8);this.glow(x,y,cloud.r*(.8+age/cloud.life*.4),color);
    }
    c.globalAlpha=1;this.canvas.dataset.scene=this.haunt.scene||'';this.canvas.dataset.phase=String(phase);this.canvas.dataset.seed=String(this.haunt.seed||0);
  }
}
