import { WORLD_SCENES } from "./world";
import { terrainFor } from "./terrain";

export type TrialKind = "bond" | "mirrors" | "bells" | "embers" | "escort" | "tide" | "guardian" | "runes" | "rescue" | "balance";
export type Difficulty = 'story'|'adventure'|'expert';
export type Upgrade = 'wind'|'sight'|'bond';
export type Point = { x: number; y: number };
export type Traveler = Point & { facing: number; moving: boolean; grounded: boolean; seen: number };
export type Platform = { x: number; y: number; w: number; spirit?: boolean };
export type Trial = { id: string; x: number; kind: TrialKind; title: string; hint: string; sockets: [Point, Point]; targets: [number, number]; melodies: [number[], number[]]; embers: [Point[], Point[]] };
export type TrialState = { solved: boolean; turns: [number, number]; notes: [number, number]; pieces: [number[], number[]]; pulses: [number, number]; progress: number; lastPulse: number };
export type CampaignRoom = { code: string; seat: 0 | 1; names: [string,string|null]; status: "waiting"|"playing"|"won"; realm: number; unlocked: number; players: [Traveler,Traveler]; trials: TrialState[]; shards: string[]; pages: string[]; ready: [boolean,boolean]; emotes: [string,string]; checkpoints: [number,number]; created: number; version: number; hint: string; playtime: number; difficulty:Difficulty; quests:string[]; upgrades:Record<Upgrade,number>; spent:number; choices:[string|null,string|null]; completed:number[];discoveries:string[] };

export const WIDTH = 4100, FLOOR = 730, HEIGHT = 940;
export const SIGILS = ["Moon", "River", "Mountain", "Sun"];
export const BELL_NAMES = ["Leaf", "Rain", "Star"];
const chapterNames = ["The vanished dawn","The listening forest","A city of memories","What the tide keeps","The winter promise","The river between us","Beneath the forgotten world","A light worth sharing"];
const stories = [
  "Every morning, the village's lantern shared its light with the valley. Tonight it is cold. Its keeper left two smaller lanterns: one for the world we know, one for the world we have forgotten.",
  "A silver fox waits beyond the ridge. It knows where the light went, but will only trust travelers who can walk together.",
  "The forest remembers the keeper's footsteps. The warm lantern wakes its roots. The blue lantern reveals the bridges hidden among them.",
  "Behind the waterfall, a child's folded wish still glows: ‘Let nobody make the long journey alone.’",
  "The city traded its shared lantern for a hundred private flames. In the rain, every window looks warm. Every street feels empty.",
  "An old shopkeeper kept the last letter: the keeper carried the dawn away to save it from something growing beneath the village.",
  "At the sea gate, the tide offers a bargain. Keep the light for yourselves, or carry it onward and trust each other through the dark.",
  "The watchfire belonged to two siblings. One guarded the coast, the other the mountains. Neither fire survived without the other.",
  "Snow has buried the keeper's shrine. Its promise is simple: wisdom is a light that becomes brighter when it is shared.",
  "Deep in the cedar cave, the keeper's shadow waits. She did not steal the dawn. She hid it from a hunger that feeds on loneliness.",
  "The river divides the path in two. To cross it, each traveler must restore a bridge for the other.",
  "In the garden, you find the keeper's last memory: a village where every door was open and every story was heard.",
  "Under the falls, lost wishes have become stars. The hunger gathered them here, mistaking a thousand lights for a thousand possessions.",
  "The cavern answers your lanterns. The way home opens only when warm light and spirit light travel as one.",
  "The village is visible again. Its rooftops are dark. Beneath the great lantern, the hollow guardian waits for the light you carry.",
  "The guardian cannot understand a gift. Show it what two travelers can do together, and bring the dawn home.",
];
const arrangements: TrialKind[][] = [
  ["bond","embers","mirrors","bells"],["balance","runes","escort","rescue"],
  ["bells","rescue","runes","balance"],["mirrors","tide","rescue","escort"],
  ["runes","bells","mirrors","balance"],["escort","rescue","runes","bells"],
  ["tide","embers","balance","rescue"],["escort","tide","bells","runes"],
  ["balance","runes","embers","rescue"],["mirrors","escort","bells","balance"],
  ["rescue","mirrors","tide","runes"],["bells","balance","escort","embers"],
  ["escort","rescue","runes","mirrors"],["balance","bells","rescue","tide"],
  ["runes","bells","mirrors","guardian"],["rescue","balance","bells","guardian"],
];
const titles: Record<TrialKind,string> = { bond:"The twin lanterns", mirrors:"The light compass", bells:"A melody for two", embers:"Scattered wishes", escort:"The fox's passage", tide:"The breathing tide", guardian:"The hollow guardian",runes:'The borrowed names',rescue:'The lost flock',balance:'The windkeeper’s vow' };
const instructions: Record<TrialKind,string> = {
  bond:"Stand at your lantern shrine. Both travelers hold E together to restore the crossing.",
  mirrors:"Your lantern reveals your own compass mark. Turn your mirror with E until it matches. Help your partner find theirs.",
  bells:"Read your melody, then ring the three bells in that order with E. Each traveler has a different melody.",
  embers:"Gather the wishes that match your lantern. Jump to the upper paths; each traveler must find both wishes.",
  escort:"Follow the silver fox together and hold E to guide it. It waits when either traveler is too far away.",
  tide:"Stand at your shrine and hold E together while the tide is low. The light rests during high tide.",
  guardian:"Stand at your shrines and hold E together. Jump over the guardian's shadow waves; keep your bond alight.",
  runes:"Your lantern reveals your companion’s seal. Tell them which mark to choose, then select your own with E. A wrong seal resets both travelers.",
  rescue:"Reach the two trapped crane spirits matching your lantern, then return to your own shrine. Hold E together to release the flock.",
  balance:"Climb to your lantern’s raised shrine. Both hold E while the wind is calm. The crossing charges only when both travelers have landed.",
};
export const REALMS = WORLD_SCENES.map((scene,index)=>({ ...scene, chapter:chapterNames[Math.floor(index/2)], index, narrative:stories[index], accent:["#edc98a","#bdd9ec","#94d7bd","#76d1cb","#c4a5de","#9dc8e8","#e6cf9b","#f2ad82","#d8e6ff","#94c4dd","#eeae91","#d9c48d","#85dedb","#b4b5ef","#ffd398","#ffe6b0"][index], epilogue: index===15?"The dawn returns as a hundred open doors, a table with room for one more, and the wisdom to share what you have. The village's prosperity begins with a light nobody owns.":stories[Math.min(15,index+1)] }));

export function trialsFor(realm:number,difficulty:Difficulty='adventure'): Trial[] {
  return arrangements[realm].map((kind,i)=>{
    const x=720+i*870;
    const raised=(realm+i)%3===2;
    return {id:`r${realm}-t${i}`,x,kind,title:`${titles[kind]}${realm>1?` · ${WORLD_SCENES[realm].title}`:''}`,hint:instructions[kind], sockets:[{x:x-115,y:kind==='balance'?FLOOR-145:FLOOR},{x:x+100,y:kind==='balance'||raised?FLOOR-145:FLOOR}], targets:[(realm+i+1)%4,(realm*3+i+2)%4], melodies:[Array.from({length:3+Math.floor(realm/6)+(difficulty==='expert'?2:0)},(_,n)=>(realm+i+n*2)%3),Array.from({length:3+Math.floor(realm/6)+(difficulty==='expert'?2:0)},(_,n)=>(realm+i+n+1)%3)], embers:[[{x:x-190,y:FLOOR-60},{x:x-70,y:FLOOR-240}],[{x:x+180,y:FLOOR-60},{x:x+55,y:FLOOR-355}]]};
  });
}
export function platformsFor(realm:number): Platform[] {
  const result:Platform[]=[],terrain=terrainFor(realm);
  for(let x=0;x<WIDTH;x+=terrain.groundWidth)result.push({x,y:FLOOR,w:Math.min(terrain.groundWidth,WIDTH-x)});
  for(const trial of trialsFor(realm)) {
    const offset=terrain.shift*(trial.kind==="embers"?.5:1),lift=terrain.lift;
    result.push({x:trial.x-225+offset,y:FLOOR-lift,w:terrain.width},{x:trial.x-110-offset*.5,y:FLOOR-lift-95,w:terrain.width+12},{x:trial.x+5+offset*.3,y:FLOOR-lift-205,w:terrain.width+20,spirit:true},{x:trial.x+140-offset,y:FLOOR-lift-20,w:terrain.width+8});
    for(let side=0;side<2;side++)if(trial.sockets[side].y<FLOOR)result.push({x:trial.sockets[side].x-55,y:trial.sockets[side].y,w:110,spirit:side===1});
  }
  for(let i=0;i<6;i++)result.push({x:350+i*610+terrain.shift,y:FLOOR-105-(i%3)*75+(terrain.lift-115)*.3,w:terrain.width+30,spirit:(i+realm)%2===1});
  return result;
}
export function shardPoints(realm:number) { return Array.from({length:6},(_,i)=>({id:`r${realm}-s${i}`,x:400+i*610,y:FLOOR-145-(i%3)*75})); }
export function pagePoints(realm:number) { return [{id:`r${realm}-p0`,x:205,y:FLOOR-20},{id:`r${realm}-p1`,x:3650,y:FLOOR-20}]; }
export function inspectPoints(realm:number){return REALMS[realm].hotspots.map((hotspot,i)=>({...hotspot,id:`r${realm}-i${i}`,x:1060+i*960,y:FLOOR}));}
export function trialInitial():TrialState {return {solved:false,turns:[0,0],notes:[0,0],pieces:[[],[]],pulses:[0,0],progress:0,lastPulse:0};}
export function spawn(seat:number):Traveler {return {x:130+seat*65,y:FLOOR,facing:1,moving:false,grounded:true,seen:Date.now()};}
export const JOURNAL_PAGES = [
  "Keeper's note: ‘Warm light gives the world its shape. Spirit light gives it meaning. Carry them together.’",
  "A villager's wish: ‘When the dawn returns, may we remember the people who helped us through the night.’",
  "Forest inscription: ‘A bridge grows from two promises, never one.’",
  "A child's map: ‘The fox only runs ahead when it knows nobody has been left behind.’",
  "Rain-soaked letter: ‘A locked door keeps out the dark. It also keeps out the morning.’",
  "The merchant's memory: ‘I had every lantern in the street, and nobody to share the evening with.’",
  "Sea stone: ‘The tide takes what is held too tightly, and returns what is given freely.’",
  "Watchkeeper's log: ‘My sister's fire is the first star I look for every night.’",
  "Winter vow: ‘No one should have to be wise alone.’",
  "Keeper's confession: ‘I took the dawn away because the village forgot how to share it. I hoped someone would come looking together.’",
  "Bridge builder's drawing: ‘The strongest bridge begins on both banks.’",
  "Garden memory: ‘We planted this tree for a person who had not yet arrived.’",
  "A forgotten wish: ‘May the stars guide somebody home, even if they never learn my name.’",
  "Cavern echo: ‘A light reflected is a light multiplied.’",
  "The guardian's inscription: ‘If I keep every flame, I will never be cold again.’",
  "The village's new promise: ‘Our dawn belongs to everyone.’",
];
