'use strict';
(() => {
  const canvas = document.querySelector('#game');
  const ctx = canvas.getContext('2d');
  const overlay = document.querySelector('#overlay');
  const keys = new Set();
  const W = canvas.width, H = canvas.height, SIZE = 30;
  const dirs = [[0,-1],[1,0],[0,1],[-1,0]];
  let player, enemies, bullets, walls, sparks, pickups, score, wave, state = 'ready', spawnDelay;
  let last = performance.now();
  const overlap = (a,b) => a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
  const tank = (x,y,enemy=false) => ({x,y,w:SIZE,h:SIZE,dir:enemy?2:0,enemy,hp:enemy?1:3,cooldown:0,turn:0});
  function hud() {
    document.querySelector('#health').textContent = `${Math.max(0,player.hp)} / 3`;
    document.querySelector('#score').textContent = String(score).padStart(4,'0');
    document.querySelector('#wave').textContent = String(wave).padStart(2,'0');
  }
  function reset() {
    player=tank(W/2-15,H-60); enemies=[]; bullets=[]; sparks=[]; pickups=[]; walls=[]; score=0; wave=0; spawnDelay=0;
    for (let row=0;row<3;row++) for (let col=0;col<5;col++) {
      walls.push({x:115+col*150,y:155+row*145,w:64,h:32,hp:3});
    }
    state='playing'; keys.clear(); overlay.hidden=true; nextWave(); hud();
  }
  function nextWave() {
    wave++; spawnDelay=1.5;
    for(let i=0;i<Math.min(3+wave,8);i++) enemies.push(tank(35+i*115,35,true));
    hud();
  }
  function show(title,detail,label) {
    document.querySelector('#message').textContent=title;
    document.querySelector('#detail').textContent=detail;
    document.querySelector('#start').textContent=label;
    overlay.hidden=false;
  }
  function pause() {
    if(state==='playing') {state='paused';keys.clear();show('战场暂停','休整一下，随时继续作战。','继续作战 →');}
    else if(state==='paused') {state='playing';overlay.hidden=true;}
  }
  function move(t,dx,dy,dt) {
    const speed=t.enemy?Math.min(72+wave*6,125):175;
    const candidate={...t,x:t.x+dx*speed*dt,y:t.y+dy*speed*dt};
    const others=[player,...enemies].filter(o=>o!==t && o.hp>0);
    if(candidate.x<5||candidate.y<5||candidate.x+SIZE>W-5||candidate.y+SIZE>H-5||[...walls,...others].some(o=>overlap(candidate,o))) return false;
    t.x=candidate.x;t.y=candidate.y;return true;
  }
  function shoot(t) {
    if(t.cooldown>0)return;
    const [dx,dy]=dirs[t.dir];
    bullets.push({x:t.x+15+dx*21-3,y:t.y+15+dy*21-3,w:6,h:6,dx,dy,enemy:t.enemy,life:3});
    t.cooldown=t.enemy?Math.max(.6,1.65-wave*.07):.24;
  }
  function burst(x,y,color) {
    for(let i=0;i<14;i++) sparks.push({x,y,vx:(Math.random()-.5)*220,vy:(Math.random()-.5)*220,life:.5,color});
  }
  function update(dt) {
    if(state!=='playing')return;
    spawnDelay=Math.max(0,spawnDelay-dt);player.cooldown-=dt;
    let direction=-1;
    if(keys.has('w')||keys.has('ArrowUp'))direction=0;
    else if(keys.has('d')||keys.has('ArrowRight'))direction=1;
    else if(keys.has('s')||keys.has('ArrowDown'))direction=2;
    else if(keys.has('a')||keys.has('ArrowLeft'))direction=3;
    if(direction>=0){player.dir=direction;move(player,...dirs[direction],dt);}
    if(keys.has(' '))shoot(player);
    for(const e of enemies) {
      e.cooldown-=dt;e.turn-=dt;
      if(spawnDelay>0)continue;
      if(e.turn<=0) {
        const dx=player.x-e.x,dy=player.y-e.y;
        e.dir=Math.random()<.65?(Math.abs(dx)>Math.abs(dy)?(dx>0?1:3):(dy>0?2:0)):Math.floor(Math.random()*4);
        e.turn=.5+Math.random();
      }
      if(!move(e,...dirs[e.dir],dt))e.turn=0;
      shoot(e);
    }
    for(const b of bullets) {
      b.life-=dt;b.x+=b.dx*390*dt;b.y+=b.dy*390*dt;
      if(b.life<=0||b.x<0||b.y<0||b.x>W||b.y>H){b.life=0;continue;}
      const wall=walls.find(w=>overlap(b,w));
      if(wall){wall.hp--;b.life=0;burst(b.x,b.y,'#a78d67');continue;}
      const targets=b.enemy?[player]:enemies;
      const target=targets.find(t=>t.hp>0&&overlap(b,t));
      if(target){target.hp--;b.life=0;burst(target.x+15,target.y+15,b.enemy?'#c9e79b':'#e68c60');
        if(target.enemy&&target.hp===0){score+=100;if(Math.random()<.25)pickups.push({x:target.x+5,y:target.y+5,w:20,h:20});}
      }
    }
    bullets=bullets.filter(b=>b.life>0);walls=walls.filter(w=>w.hp>0);enemies=enemies.filter(e=>e.hp>0);
    pickups=pickups.filter(p=>{if(overlap(player,p)){player.hp=Math.min(3,player.hp+1);return false;}return true;});
    for(const p of sparks){p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;}sparks=sparks.filter(p=>p.life>0);
    hud();
    if(player.hp<=0){state='over';keys.clear();show('任务结束',`获得 ${score} 分 · 坚守至第 ${wave} 波`,'再次出击 →');}
    else if(enemies.length===0)nextWave();
  }
  function drawTank(t) {
    ctx.save();ctx.translate(t.x+15,t.y+15);ctx.rotate(t.dir*Math.PI/2);
    ctx.fillStyle='#101711';ctx.fillRect(-17,-16,8,32);ctx.fillRect(9,-16,8,32);
    ctx.fillStyle=t.enemy?'#cf755d':'#b1d17c';ctx.fillRect(-11,-14,22,28);
    ctx.fillStyle=t.enemy?'#9c493e':'#6d914a';ctx.fillRect(-8,-9,16,19);
    ctx.fillStyle=t.enemy?'#f5b292':'#e1f3b9';ctx.fillRect(-3,-24,6,23);ctx.fillRect(-6,-5,12,12);
    ctx.restore();
  }
  function draw() {
    ctx.fillStyle='#19231d';ctx.fillRect(0,0,W,H);
    ctx.strokeStyle='#243227';ctx.lineWidth=1;
    ctx.beginPath();for(let x=0;x<W;x+=40){ctx.moveTo(x,0);ctx.lineTo(x,H);}for(let y=0;y<H;y+=40){ctx.moveTo(0,y);ctx.lineTo(W,y);}ctx.stroke();
    for(const w of walls){ctx.fillStyle=['','#705e45','#867451','#9a865e'][w.hp];ctx.fillRect(w.x,w.y,w.w,w.h);ctx.strokeStyle='#263022';ctx.strokeRect(w.x,w.y,w.w,w.h);ctx.beginPath();ctx.moveTo(w.x,w.y+16);ctx.lineTo(w.x+64,w.y+16);ctx.moveTo(w.x+32,w.y);ctx.lineTo(w.x+32,w.y+32);ctx.stroke();}
    for(const p of pickups){ctx.fillStyle='#e8c66c';ctx.fillRect(p.x,p.y,20,20);ctx.fillStyle='#534725';ctx.fillRect(p.x+8,p.y+3,4,14);ctx.fillRect(p.x+3,p.y+8,14,4);}
    if(player.hp>0)drawTank(player);enemies.forEach(drawTank);
    for(const b of bullets){ctx.fillStyle=b.enemy?'#ffa17a':'#ecf7bb';ctx.fillRect(b.x,b.y,b.w,b.h);}
    for(const p of sparks){ctx.globalAlpha=p.life/.5;ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,4,4);}ctx.globalAlpha=1;
    ctx.fillStyle='#91a17d';ctx.font='11px monospace';ctx.fillText('STEEL FRONT // '+(state==='playing'?'LIVE':'STANDBY'),16,H-15);
  }
  document.querySelector('#start').onclick=()=>state==='paused'?pause():reset();
  document.querySelector('#restart').onclick=reset;document.querySelector('#pause').onclick=pause;
  window.addEventListener('keydown',e=>{
    const k=e.key.length===1?e.key.toLowerCase():e.key;
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(k))e.preventDefault();
    if(k==='p'&&!e.repeat)pause();keys.add(k);
  });
  window.addEventListener('keyup',e=>keys.delete(e.key.length===1?e.key.toLowerCase():e.key));
  window.addEventListener('blur',()=>{keys.clear();if(state==='playing')pause();});
  document.querySelectorAll('[data-key]').forEach(button=>{
    button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);keys.add(button.dataset.key);});
    for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,()=>keys.delete(button.dataset.key));
  });
  reset();state='ready';show('准备出击','驾驶你的坦克，消灭所有敌人。','开始作战 →');
  function frame(now){const dt=Math.min((now-last)/1000,.033);last=now;update(dt);draw();requestAnimationFrame(frame);}requestAnimationFrame(frame);
})();
