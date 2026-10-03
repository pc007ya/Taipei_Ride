import {makeTraffic,ROADS,trafficPose,collisionBody,bodiesOverlap,BUILDING} from './world.js';
import {createXitunCity} from './xitun-visuals.js';
export const cityFactory=createXitunCity;
// North remains up. Distances and bends are compressed into the existing driving
// grid; these are exploration stops, not coordinates for real-world navigation.
export const XITUN_START={x:1080,y:800,angle:Math.PI};
export const sceneStart=XITUN_START;
export const TAIWAN_BOULEVARD={y:800,from:110,to:1490};
export const XITUN_LANDMARKS=[
 {id:'xitun-autumn',name:'秋紅谷',en:'AUTUMN VALLEY',x:1120,y:935,type:'park',color:'#b5ce7e',stamp:'谷',clue:'台灣大道南側的下凹綠地與水面，沿步道停下來。',fact:'以水景、綠坡與步道表現秋紅谷；本圖縮短距離，不作真實導航。',source:'https://travel.taichung.gov.tw/zh-tw/attractions/intro/818'},
 {id:'xitun-opera',name:'臺中國家歌劇院',en:'NATIONAL TAICHUNG THEATER',x:1290,y:1120,type:'opera',color:'#e5d4b1',stamp:'藝',clue:'秋紅谷東南方，尋找有圓洞與曲面輪廓的劇院。',fact:'以曲面洞口、淺色量體與屋頂綠意表現歌劇院，並非精確建築模型。',source:'https://travel.taichung.gov.tw/zh-tw/attractions/intro/942'},
 {id:'xitun-fengjia',name:'逢甲夜市',en:'FENGJIA NIGHT MARKET',x:1440,y:365,type:'market',color:'#f3a578',stamp:'逢',clue:'往秋紅谷東北側，找招牌、攤位與夜市街角。',fact:'逢甲商圈包含文華路、逢甲路與福星路。本圖以簡化攤街呈現。',source:'https://www.taiwan.net.tw/m1.aspx?id=9471&sNo=0001112'},
 {id:'xitun-hospital',name:'澄清醫院中港院區',en:'CHENG CHING HOSPITAL',x:630,y:800,type:'hospital',color:'#9bd7e0',stamp:'醫',clue:'沿台灣大道往西騎，抵達四段966號的澄清中港院區街角。',fact:'澄清中港院區位於台灣大道四段966號；此處以醫院立面與入口辨識。',source:'https://www.cdc.gov.tw/En/Category/Page/_XqK2nV3LI11BLNaXzox8g'},
 {id:'xitun-store',name:'萬家福西屯店',en:'PROSPERITY XITUN',x:350,y:800,type:'store',color:'#e8b569',stamp:'福',clue:'沿台灣大道從澄清醫院繼續往西，到四段1086號附近。',fact:'萬家福官方西屯店地址是台灣大道四段1086號。這裡是可連續抵達的簡化商場街區。',source:'https://www.uni-prosperity.com.tw/impact/'}
];
export function createSceneWorld(){
 const buildings=[],stalls=[],trees=[],lamps=[],obstacles=[];
 const building=(x,y,w,d,h,color,sign,kind='block')=>{const floorCount=Math.max(2,Math.round(h/28));h=BUILDING.groundFloorHeight+(floorCount-1)*BUILDING.upperFloorHeight;const b={type:'building',kind,x,y,w,d,h,height:h,floorCount,doorHeight:BUILDING.doorHeight,floorPitch:BUILDING.upperFloorHeight,color,seed:.3,sign};buildings.push(b);obstacles.push({type:'building',x,y,w,d,height:h});};
 building(535,570,210,175,136,'#d9e4df','澄清醫院','hospital');
 building(215,535,215,210,55,'#e7dfc3','萬家福西屯店','store');
 building(1180,1180,205,190,90,'#e9e0cc','臺中國家歌劇院','opera');
 for(let ix=0;ix<4;ix++)for(let iy=0;iy<4;iy++){
  if((iy===1&&ix<2)||(ix===2&&iy===2)||(ix===3&&(iy===0||iy===3)))continue;
  building(ROADS[ix]+65,ROADS[iy]+66,125,135,55+(ix+iy)%3*25,['#c1c9bb','#bdcace','#dbcbb5'][(ix+iy)%3],['書店','咖啡','餐館'][(ix+iy)%3]);
 }
 for(let i=0;i<8;i++){const s={type:'stall',x:1175+(i%4)*58,y:235+Math.floor(i/4)*103,w:40,d:30,h:24,color:['#d87756','#d4b45f','#77a091'][i%3],sign:['逢甲','茶','麵','甜點'][i%4]};stalls.push(s);obstacles.push({...s,height:24});}
 // Water is a fixed obstacle. The surrounding level paths remain walkable.
 obstacles.push({type:'building',x:903,y:910,w:136,d:108,height:1});
 for(let i=0;i<24;i++){const x=848+(i%6)*44,y=i<12?860+Math.floor(i/6)*180:1320+Math.floor((i-12)/6)*50;if(x>1075)continue;const t={type:'tree',x,y,h:33,height:33,trunkRadius:1.4,color:i%4?'#67885e':'#a77c58'};trees.push(t);obstacles.push({type:'tree',x,y,radius:1.4,height:33});}
 for(const x of [210,450,530,760,850,1100,1170,1400]){const l={type:'lamp',x,y:753,h:44,height:44,radius:1.3,poleRadius:.45};lamps.push(l);obstacles.push({...l});}
 return {sceneId:'xitun',name:'台中西屯',start:XITUN_START,landmarks:XITUN_LANDMARKS,hasQuest:false,buildings,stalls,trees,lamps,obstacles,boulevard:TAIWAN_BOULEVARD};
}
export function createSceneTraffic(){
 const cars=makeTraffic().slice(0,10);
 for(let i=0;i<4;i++){cars[i].route=3;cars[i].t=i*.19;Object.assign(cars[i],trafficPose(3,cars[i].t));}
 for(let i=0;i<cars.length;i++)for(let attempt=0;attempt<100&&cars.slice(0,i).some(c=>bodiesOverlap(collisionBody(c,'car'),collisionBody(cars[i],'car')));attempt++){cars[i].t=(cars[i].t+.017)%1;Object.assign(cars[i],trafficPose(cars[i].route,cars[i].t));}
 return cars;
}
