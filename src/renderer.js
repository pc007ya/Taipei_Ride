import { WORLD_SIZE, ROADS, ROAD_WIDTH, LANDMARKS, distance } from './world.js';
import { QUEST_STATIONS } from './session.js';
import { BUILDING } from './scale.js';
const mix=(hex,k)=>{const n=parseInt(hex.slice(1),16);return `rgb(${[n>>16,(n>>8)&255,n&255].map(v=>Math.round(Math.min(255,v*k))).join(',')})`;};
export class Renderer {
  constructor(canvas,world) { this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.world=world;this.camera={x:800,y:515};this.width=0;this.height=0;this.scale=1;this.night=false;this.time=0;this.resize(); }
  setQuality(preset){this.quality=['auto','low','medium','high'].includes(preset)?preset:'auto';this.resize();}
  setAppearance(id){this.appearance=id==='river'?'river':id==='sunset'?'sunset':'forest';this.playerShirt={river:'#536e98',sunset:'#b97545',forest:'#6b8b77'}[this.appearance];}
  setMenuView(view){this.menuView=view;}
  setIntroProgress(progress){this.introProgress=typeof progress==='number'?progress:null;}
  resize() {const dpr=Math.min(devicePixelRatio||1,{low:.75,medium:1.2,high:1.6,auto:1.6}[this.quality||'auto']);this.width=innerWidth;this.height=innerHeight;this.canvas.width=Math.round(this.width*dpr);this.canvas.height=Math.round(this.height*dpr);this.canvas.style.width=`${this.width}px`;this.canvas.style.height=`${this.height}px`;this.ctx.setTransform(dpr,0,0,dpr,0,0);this.scale=this.width<650?1.45:2.0;}
  p(x,y,z=0) {return {x:this.width/2+(x-y-this.camera.x+this.camera.y)*.82*this.scale,y:this.height*.55+(x+y-this.camera.x-this.camera.y)*.43*this.scale-z*this.scale};}
  poly(points,fill,stroke) {const c=this.ctx;c.beginPath();points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=.8;c.stroke();}}
  ground(x,y,w,d,color) {this.poly([this.p(x,y),this.p(x+w,y),this.p(x+w,y+d),this.p(x,y+d)],color);}
  line(points,color,width=1) {const c=this.ctx;c.beginPath();points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.strokeStyle=color;c.lineWidth=width*this.scale;c.stroke();}
  box(x,y,w,d,h,color,z=0) {
    const b=[this.p(x,y,z),this.p(x+w,y,z),this.p(x+w,y+d,z),this.p(x,y+d,z)];
    const t=[this.p(x,y,z+h),this.p(x+w,y,z+h),this.p(x+w,y+d,z+h),this.p(x,y+d,z+h)];
    this.poly([b[1],b[2],t[2],t[1]],mix(color,this.night?.49:.75));
    this.poly([b[2],b[3],t[3],t[2]],mix(color,this.night?.61:.9));
    this.poly(t,mix(color,this.night?.77:1.11));
  }
  visible(o) {const p=this.p(o.x,o.y);return p.x>-300&&p.x<this.width+300&&p.y>-60&&p.y<this.height+360;}
  shadow(o,w=o.w||15,d=o.d||15) {this.poly([this.p(o.x,o.y),this.p(o.x+w,o.y),this.p(o.x+w+24,o.y+d+16),this.p(o.x+24,o.y+d+16)],this.night?'#071b2435':'#183f3930');}
  text(text,x,y,z,color='#fcf7df',size=13) {const p=this.p(x,y,z),c=this.ctx;c.font=`700 ${size*this.scale}px "Noto Sans CJK TC", "Microsoft JhengHei", sans-serif`;c.textAlign='center';c.fillStyle=color;c.fillText(text,p.x,p.y);}
  drawBuilding(o,player) {
    const c=this.ctx;
    if(o.x+o.y>player.x+player.y&&distance({x:o.x+o.w/2,y:o.y+o.d/2},player)<145)c.globalAlpha=.4;
    this.box(o.x,o.y,o.w,o.d,o.h,o.color);
    if(o.type==='building') {
      const floors=o.floorCount||2;
      for(let f=0;f<floors;f++) for(let a=0;a<4;a++) {
        const z=BUILDING.groundFloorHeight+7+f*BUILDING.upperFloorHeight;if(z+14>o.h)continue;const xx=o.x+6+a*(o.w-9)/4,yy=o.y+6+a*(o.d-9)/4;
        const col=this.night?((a+f+Math.round(o.seed*5))%3?'#eed58c':'#3d626c'):'#6e9396';
        this.poly([this.p(xx,o.y+o.d+.1,z),this.p(xx+6,o.y+o.d+.1,z),this.p(xx+6,o.y+o.d+.1,z+14),this.p(xx,o.y+o.d+.1,z+14)],col);
        this.poly([this.p(o.x+o.w+.1,yy,z),this.p(o.x+o.w+.1,yy+6,z),this.p(o.x+o.w+.1,yy+6,z+14),this.p(o.x+o.w+.1,yy,z+14)],mix(col,.86));
      }
      this.box(o.x+8,o.y+8,13,12,9,'#91a4a5',o.h);
      if(o.seed>.6)this.box(o.x+o.w-24,o.y+8,13,10,3,'#dde2d4',o.h);
      // Layered original shop fronts, inset doors and arcade posts.
      this.box(o.x+3,o.y+o.d-4,o.w-6,3,22,'#527c79',1);
      this.box(o.x+o.w-4,o.y+3,3,o.d-6,22,'#527c79',1);
      for(let i=0;i<4;i++){const x=o.x+6+i*(o.w-12)/3,y=o.y+6+i*(o.d-12)/3;
        this.line([this.p(x,o.y+o.d,1),this.p(x,o.y+o.d,22)],'#c9ceb8',.8);
        this.line([this.p(o.x+o.w,y,1),this.p(o.x+o.w,y,22)],'#c9ceb8',.8);
      }
      for(const x of [o.x+1,o.x+o.w/2,o.x+o.w-3])this.box(x,o.y+o.d-3,2,3,30,'#ddd7bd');
      this.box(o.x,o.y+o.d-5,o.w,5,1.5,'#d7d1b6',30.5);
      if(o.seed>.52){this.box(o.x+5,o.y+o.d-2,o.w*.28,1,21,'#89918a',1);for(let h=2;h<22;h+=1.5)this.line([this.p(o.x+5,o.y+o.d,h),this.p(o.x+5+o.w*.28,o.y+o.d,h)],'#626f6a',.5);}
      this.box(o.x+3,o.y+o.d-1,o.w-6,1,6,'#356f68',24);
      this.text(o.sign?`小巷${o.sign}`:'日和雜貨',o.x+o.w/2,o.y+o.d+1,26.5,'#fff1c4',7);

    }
    if(o.type==='tower') {
      // Bamboo-inspired stepped volumes; geometry is authored here, not imported.
      this.box(o.x,o.y,o.w,o.d,28,'#8bafa5');
      for(let i=0;i<8;i++) {
        const w=69-i*4.3,off=(o.w-w)/2,z=28+i*23;
        this.box(o.x+off,o.y+off,w,w,21,'#74b7aa',z);
        this.box(o.x+off-3,o.y+off-3,w+6,w+6,3,'#9cd0bb',z+20);
        for(let v=0;v<4;v++) {const xx=o.x+off+8+v*(w-15)/4;this.line([this.p(xx,o.y+off+w,z+3),this.p(xx,o.y+off+w,z+19)],this.night?'#d0efa4':'#bfddd0',1.5);}
      }
      this.box(o.x+34,o.y+34,14,14,26,'#aed4c0',221);
      this.line([this.p(o.x+41,o.y+41,240),this.p(o.x+41,o.y+41,279)],'#d4e5c7',3);
      this.text('101',o.x+41,o.y+83,19,'#d9f4d6',17);
    }
    if(o.type==='temple'||o.type==='hall') {
      const isTemple=o.type==='temple', roof=isTemple?'#c45440':'#416c9b';
      for(let i=0;i<5;i++)this.box(o.x+i*3,o.y+i*3,o.w-i*6,o.d-i*6,3,isTemple?'#b4aa94':'#dfe2d6',i*3);
      for(let i=0;i<6;i++)this.box(o.x+10+i*(o.w-20)/5,o.y+o.d+1,4,5,o.h-8,isTemple?'#a6342a':'#f5f1df',8);
      this.box(o.x-8,o.y-8,o.w+16,o.d+16,4,roof,o.h);
      this.poly([this.p(o.x-11,o.y-11,o.h+2),this.p(o.x+o.w+11,o.y-11,o.h+2),this.p(o.x+o.w+3,o.y+o.d/2,o.h+26),this.p(o.x-3,o.y+o.d/2,o.h+26)],mix(roof,1.15));
      this.poly([this.p(o.x-11,o.y+o.d+11,o.h+2),this.p(o.x+o.w+11,o.y+o.d+11,o.h+2),this.p(o.x+o.w+3,o.y+o.d/2,o.h+26),this.p(o.x-3,o.y+o.d/2,o.h+26)],roof);
      this.text(isTemple?'龍山寺':'自由',o.x+o.w/2,o.y+o.d+7,o.h-10,'#fff0c1',isTemple?15:17);
      if(isTemple)for(const x of [o.x+5,o.x+o.w-5]) {const p=this.p(x,o.y+o.d+14,o.h-13);c.fillStyle='#ef8552';c.beginPath();c.ellipse(p.x,p.y,5*this.scale,7*this.scale,0,0,Math.PI*2);c.fill();}
    }
    c.globalAlpha=1;
  }
  drawTree(o) {
    const c=this.ctx,p=this.p(o.x,o.y,o.h*.78);
    this.line([this.p(o.x,o.y),this.p(o.x,o.y,o.h*.72)],'#7a7860',3);
    c.fillStyle=this.night?mix(o.color,.7):o.color;c.beginPath();c.ellipse(p.x,p.y,o.h*.25*this.scale,o.h*.235*this.scale,0,0,Math.PI*2);c.fill();
    c.fillStyle=this.night?'#608866':'#8fb27b';c.beginPath();c.ellipse(p.x-4*this.scale,p.y-5*this.scale,5*this.scale,7*this.scale,-.4,0,Math.PI*2);c.fill();
  }
  drawLamp(o){const h=o.height||48;this.line([this.p(o.x,o.y),this.p(o.x,o.y,h-2)],'#6c8278',o.poleRadius*2);this.line([this.p(o.x,o.y,h-2),this.p(o.x-7,o.y,h-1)],'#6c8278',.6);this.box(o.x-9,o.y-1,4,2,1.4,'#526b61',h-2.4);this.ground(o.x-o.radius,o.y-o.radius,o.radius*2,o.radius*2,'#a2ac9b');}
  drawStall(o) {
    this.box(o.x,o.y,o.w,o.d,14,'#92755d');
    for(let i=0;i<4;i++)this.box(o.x+i*o.w/4,o.y-4,o.w/4,o.d+8,3,i%2?'#f6e0b4':o.color,24);
    this.line([this.p(o.x,o.y,0),this.p(o.x,o.y,24)],'#dbc6aa',2);
    this.line([this.p(o.x+o.w,o.y+o.d),this.p(o.x+o.w,o.y+o.d,24)],'#dbc6aa',2);
    this.text(o.sign,o.x+o.w/2,o.y+o.d+2,14,'#fff3d8',10);
  }
  vehicle(o,player=false,parked=false) {
    const c=this.ctx, a=o.angle, cos=Math.cos(a),sin=Math.sin(a);
    const small=player||parked,sx=small?.667:1.294,sy=small?.667:1.125,sz=small?.60:.78;const point=(x,y,z=0)=>this.p(o.x+x*sx*cos-y*sy*sin,o.y+x*sx*sin+y*sy*cos,z*sz);
    const quad=(x,y,w,d,z,color)=>this.poly([point(x,y,z),point(x+w,y,z),point(x+w,y+d,z),point(x,y+d,z)],color);
    quad(-14,-7,30,16,0,'#08262635');
    if(!player&&!parked) {
      quad(-17,-8,34,16,5,mix(o.color,.75));quad(-16,-7,31,14,12,o.color);quad(-8,-6,15,12,18,mix(o.color,1.12));quad(8,-6,5,12,13,'#334c56');
      quad(-15,-7,4,3,7,'#fa8a60');quad(-15,4,4,3,7,'#fa8a60');
      if(this.night)quad(17,-6,25,12,0,'#ffe6a12a');
    } else {
      for(const x of [-10,11]) {const p=point(x,0,3);c.fillStyle='#142f37';c.beginPath();c.ellipse(p.x,p.y,4*this.scale,5*this.scale,0,0,Math.PI*2);c.fill();}
      quad(-13,-5,25,10,8,'#b1e95a');quad(-10,-4,13,8,13,'#163b39');if(o.cargo)quad(-16,-5,8,10,17,'#deb77a');
      this.line([point(11,-7,15),point(11,7,15)],'#263b43',2.5);
      this.line([point(11,0,8),point(11,0,16)],'#9be267',3);
      if(!parked){
      // Six-head proportions, bent knees and separate upper/lower arms.
      c.lineCap='round';
      for(const side of [-1,1]){this.line([point(-4,side*3,14),point(2,side*4,11),point(0,side*4,6)],'#314b57',2.5);quad(-1,side*4-1.3,5,2.6,6,'#223b3b');}
      this.line([point(-4,0,15),point(-2,0,24)],this.playerShirt||'#6b8b77',4.2);
      for(const side of [-1,1]){this.line([point(-2,side*3.5,23),point(2,side*5,20)],this.playerShirt||'#6b8b77',1.4);this.line([point(2,side*5,20),point(11,side*6,16)],'#d8ac84',1.8);}
      const head=point(-1,0,29);c.fillStyle='#ead6b0';c.beginPath();c.ellipse(head.x,head.y,2.6*this.scale,2.8*this.scale,0,0,Math.PI*2);c.fill();
      c.fillStyle='#f1eacf';c.beginPath();c.arc(head.x,head.y-1.1*this.scale,2.8*this.scale,Math.PI,Math.PI*2);c.fill();
      this.line([point(2,0,29),point(2,1.5,28)],'#375456',1.5);

      }
      if(this.night)this.poly([point(13,-3,5),point(90,-28),point(90,28),point(13,3,5)],'#e4f0ad22');
      if(!parked&&Math.abs(o.speed)<2) {const p=this.p(o.x,o.y,47);c.fillStyle='#e7ff9c';c.beginPath();c.moveTo(p.x-4,p.y-4);c.lineTo(p.x+4,p.y-4);c.lineTo(p.x,p.y+2);c.fill();}
    }
  }
  walker(o,npc=false){
    const c=this.ctx,a=o.angle??0,cos=Math.cos(a),sin=Math.sin(a),point=(x,y,z=0)=>this.p(o.x+(x*cos-y*sin)*.535,o.y+(x*sin+y*cos)*.535,z*.535);
    const step=Math.sin(this.time*9)*Math.min(2.6,Math.abs(o.speed||0)*.14),shirt=npc?'#bf9564':this.playerShirt||'#6b8b77';c.lineCap='round';
    for(const side of [-1,1]){const swing=step*side;this.line([point(0,side*2,14),point(swing*.5,side*2,8),point(swing,side*2,2)],'#31505a',1.34);this.line([point(swing-.7,side*2,1.5),point(swing+2,side*2,1.5)],'#223b3b',1.28);}
    this.line([point(0,0,15),point(0,0,24)],shirt,3.75);
    for(const side of [-1,1]){const swing=-step*side;this.line([point(0,side*4,23),point(swing*.5,side*4.3,18.5)],shirt,1.18);this.line([point(swing*.5,side*4.3,18.5),point(swing,side*4.3,14)],'#d8ac84',.97);}
    const head=point(0,0,29);c.fillStyle='#d8ac84';c.beginPath();c.ellipse(head.x,head.y,1.34*this.scale,1.5*this.scale,0,0,Math.PI*2);c.fill();c.fillStyle='#283a36';c.beginPath();c.arc(head.x,head.y-.8*this.scale,1.6*this.scale,Math.PI,Math.PI*2);c.fill();
    if(!npc&&this.appearance==='river'){const hair=this.p(o.x-.5,o.y,14);c.fillStyle='#3c2e28';c.beginPath();c.ellipse(hair.x-2*this.scale,hair.y,1.3*this.scale,3*this.scale,0,0,Math.PI*2);c.fill();}
    if(o.cargo){const p=point(5,0,19);c.fillStyle='#d9b473';c.fillRect(p.x,p.y,7*this.scale,7*this.scale);}
    if(!npc){const top=this.p(o.x,o.y,23);c.fillStyle='#e8ffa0';c.beginPath();c.moveTo(top.x-4,top.y-4);c.lineTo(top.x+4,top.y-4);c.lineTo(top.x,top.y+2);c.fill();}
  }
  landmark(l,done,selected) {
    const c=this.ctx,p=this.p(l.x,l.y), pulse=1+Math.sin(this.time*2.5)*.07;
    c.save();c.translate(p.x,p.y);c.scale(this.scale,this.scale*.54);c.beginPath();c.arc(0,0,done?11:12*pulse,0,Math.PI*2);c.fillStyle=done?'#b5deaf25':`${l.color}2a`;c.fill();c.strokeStyle=done?'#acd5a0':l.color;c.lineWidth=selected?3:1.5;c.setLineDash(done?[]:[5,4]);c.stroke();c.restore();
    if(selected&&!done){const q=this.p(l.x,l.y,25+Math.sin(this.time*2)*1.2);c.fillStyle=l.color;c.beginPath();c.arc(q.x,q.y,5*this.scale,0,Math.PI*2);c.fill();c.fillStyle='#163632';c.font=`bold ${13*this.scale}px sans-serif`;c.textAlign='center';c.fillText('◎',q.x,q.y+4*this.scale);this.line([this.p(l.x,l.y,8),this.p(l.x,l.y,20)],l.color,1.5);}
  }
  render(state,dt) {
    const {player,traffic,stamps,target}=state;const night=typeof this.introProgress==='number'&&this.menuView!=='character'?true:state.night;this.night=night;this.time+=dt;
    this.camera.x+=(player.x-this.camera.x)*Math.min(1,dt*5);this.camera.y+=(player.y-this.camera.y)*Math.min(1,dt*5);
    const c=this.ctx,w=this.width,h=this.height;
    c.clearRect(0,0,w,h);c.fillStyle=night?'#112932':'#8cac9e';c.fillRect(0,0,w,h);
    this.ground(-120,-120,1900,1900,night?'#284741':'#87a782');
    this.ground(-170,-120,270,1900,night?'#204a59':'#65a2a7');
    for(let i=0;i<60;i++){const yy=i*32+Math.sin(this.time+i)*3;this.line([this.p(-110,yy),this.p(55,yy-12)],night?'#2f61703b':'#a7d0c34a',1);}
    this.ground(91,70,31,1480,night?'#586b66':'#c6c6a5');
    for(let ix=0;ix<4;ix++)for(let iy=0;iy<4;iy++){const x=ROADS[ix]+35,y=ROADS[iy]+35;this.ground(x,y,250,250,night?'#59615c':'#c7cbb6');if(Math.abs(x+125-player.x)<550&&Math.abs(y+125-player.y)<550)for(let t=0;t<=250;t+=10){this.line([this.p(x+t,y),this.p(x+t,y+250)],night?'#465450':'#acb3a6',.45);this.line([this.p(x,y+t),this.p(x+250,y+t)],night?'#465450':'#acb3a6',.45);}for(const edge of [0,250]){this.line([this.p(x+edge,y),this.p(x+edge,y+250)],night?'#859087':'#e2dfca',1.4);this.line([this.p(x,y+edge),this.p(x+250,y+edge)],night?'#859087':'#e2dfca',1.4);}}
    this.ground(1165,1165,225,225,night?'#345a45':'#779a68');
    this.ground(844,844,231,231,night?'#6c7471':'#d4d8c9');
    for(const road of ROADS){this.ground(road-ROAD_WIDTH/2,80,ROAD_WIDTH,1440,night?'#35494e':'#718382');this.ground(80,road-ROAD_WIDTH/2,1440,ROAD_WIDTH,night?'#35494e':'#718382');}
    for(const road of ROADS)for(let t=90;t<1510;t+=34){if(ROADS.some(r=>Math.abs(r-t)<52))continue;this.ground(road-1,t,2,14,night?'#ada574':'#ded9a5');this.ground(t,road-1,14,2,night?'#ada574':'#ded9a5');}
    for(const x of ROADS)for(const y of ROADS)for(let i=0;i<6;i++) {
      const col=night?'#72837e':'#d7ddd1';this.ground(x-23+i*8,y-42,4,9,col);this.ground(x-23+i*8,y+34,4,9,col);this.ground(x-42,y-23+i*8,9,4,col);this.ground(x+34,y-23+i*8,9,4,col);
    }
    // Open riverside seating and simple public park paths.
    for(let i=0;i<8;i++)this.box(105,200+i*155,8,22,5,'#be9c71');
    this.ground(870,1034,188,11,night?'#9ba39a':'#eef1df');
    for(const l of LANDMARKS)if(!(target?.type==='quest'&&distance(l,target)<15))this.landmark(l,stamps.includes(l.id),target?.id===l.id);
    if(target?.type==='quest')this.landmark(target,state.quest?.stage==='completed',true);
    const walking=state.mode==='walking',carrying=state.quest?.stage==='carrying'||state.quest?.stage==='deliver';
    const pedestrians=Array.from({length:20},(_,i)=>({x:ROADS[i%5]+45,y:180+(i*91+this.time*(i%2?5:-5)+1300)%1220,angle:i%2?Math.PI/2:-Math.PI/2,speed:5,type:'npc'}));
    const items=[...pedestrians,...this.world.buildings,...this.world.trees,...(this.world.lamps||[]),...this.world.stalls,...traffic,...Object.values(QUEST_STATIONS).map(l=>({x:l.x+29,y:l.y,type:'npc'})),...(walking?[{...state.vehicle,type:'parked-scooter',cargo:false}]:[]),{...player,type:walking?'walker':'player',cargo:carrying}].filter(o=>this.visible(o));
    items.sort((a,b)=>(a.x+a.y+(a.w||0)*.5+(a.d||0)*.5)-(b.x+b.y+(b.w||0)*.5+(b.d||0)*.5));
    for(const o of items) {
      if(o.type==='building'||o.type==='tower'||o.type==='temple'||o.type==='hall'){this.shadow(o);this.drawBuilding(o,player);}
      else if(o.type==='tree')this.drawTree(o);
      else if(o.type==='lamp')this.drawLamp(o);
      else if(o.type==='stall')this.drawStall(o);
      else if(o.type==='walker'||o.type==='npc')this.walker(o,o.type==='npc');
      else this.vehicle(o,o.type==='player',o.type==='parked-scooter');
    }
    // Atmospheric vignette keeps the edges quiet without obscuring controls.
    const vignette=c.createRadialGradient(w/2,h/2,h*.15,w/2,h/2,Math.max(w,h)*.66);vignette.addColorStop(0,'#092a2000');vignette.addColorStop(1,night?'#061c285e':'#173d2726');c.fillStyle=vignette;c.fillRect(0,0,w,h);
  }
}

export function drawMap(canvas,state,large=false) {
  const c=canvas.getContext('2d'),dpr=Math.min(devicePixelRatio||1,2),rect=canvas.getBoundingClientRect();
  const size=Math.min(rect.width,rect.height);if(!size)return;
  if(canvas.width!==Math.round(size*dpr)){canvas.width=Math.round(size*dpr);canvas.height=Math.round(size*dpr);}
  c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,size,size);const pad=large?26:9,scale=(size-pad*2)/1600;const p=(x,y)=>[pad+x*scale,pad+y*scale];
  c.fillStyle='#153c3b';c.fillRect(0,0,size,size);c.fillStyle='#245764';c.fillRect(0,0,pad+90*scale,size);
  c.strokeStyle='#63817b';c.lineWidth=large?7:3;for(const r of ROADS){c.beginPath();c.moveTo(...p(r,80));c.lineTo(...p(r,1520));c.stroke();c.beginPath();c.moveTo(...p(80,r));c.lineTo(...p(1520,r));c.stroke();}
  for(const l of LANDMARKS){const [x,y]=p(l.x,l.y);const done=state.stamps.includes(l.id);c.fillStyle=done?'#dff8a0':l.color;c.beginPath();c.arc(x,y,large?7:4,0,Math.PI*2);c.fill();if(state.target?.id===l.id){c.strokeStyle='#f9f4dc';c.lineWidth=1.5;c.beginPath();c.arc(x,y,large?12:7,0,Math.PI*2);c.stroke();}if(large){c.font='600 13px "Noto Sans CJK TC", sans-serif';c.fillStyle='#f0efd6';c.textAlign=l.x>1200?'right':'left';c.fillText(`${done?'✓ ':''}${l.name}`,x+(l.x>1200?-13:13),y-12);}}
  if(state.target?.type==='quest'){const [qx,qy]=p(state.target.x,state.target.y);c.fillStyle='#ffdc88';c.fillRect(qx-5,qy-5,10,10);c.strokeStyle='#fff7d4';c.lineWidth=1.5;c.strokeRect(qx-8,qy-8,16,16);if(large){c.font='600 12px sans-serif';c.textAlign='left';c.fillStyle='#ffedbe';c.fillText(state.target.name,qx+12,qy+17);}}
  if(state.mode==='walking'&&state.vehicle){const [vx,vy]=p(state.vehicle.x,state.vehicle.y);c.fillStyle='#94d7ff';c.fillRect(vx-4,vy-4,8,8);if(large){c.font='600 11px sans-serif';c.fillStyle='#bce9ff';c.textAlign='left';c.fillText('停放機車',vx+8,vy+4);}}
  const [x,y]=p(state.player.x,state.player.y);c.save();c.translate(x,y);c.rotate(state.player.angle);c.fillStyle='#f7ffcb';c.beginPath();c.moveTo(large?11:7,0);c.lineTo(large?-6:-4,large?-6:-4);c.lineTo(large?-3:-2,0);c.lineTo(large?-6:-4,large?6:4);c.closePath();c.fill();c.restore();
}
