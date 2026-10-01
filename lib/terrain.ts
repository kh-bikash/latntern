import type { Platform } from "./adventure";

export type Crop=readonly [number,number,number,number];
type Weather="petals"|"stars"|"fireflies"|"mist"|"rain"|"drizzle"|"spray"|"sparks"|"snow"|"frost"|"leaves"|"pollen"|"dust"|"lights"|"seeds"|"gold";
export type TerrainStyle={name:string;atlas:string;ground:Crop;ledge:Crop;detail:Crop;soil:string;shadow:string;weather:Weather;particle:string;surface:"concrete"|"wood"|"grass"|"snow";detailSpacing:number;detailSize:number;sway:number;lift:number;shift:number;width:number;groundWidth:number;water?:string};
const atlas=(group:number)=>`/adventure/stage-terrain-${group}.png`;
const style=(group:number,name:string,ground:Crop,ledge:Crop,detail:Crop,extra:Omit<TerrainStyle,"name"|"atlas"|"ground"|"ledge"|"detail">):TerrainStyle=>({name,atlas:atlas(group),ground,ledge,detail,...extra});

// Explicit rectangles follow the illustrated sprites, rather than assuming a
// generator produced equal cells. Each location owns three different artworks.
export const TERRAIN:TerrainStyle[]=[
 style(0,"Sakura slate",[12,126,772,128],[796,112,276,140],[1090,0,440,252],{soil:"#313942",shadow:"#0b1927",weather:"petals",particle:"#edc6df",surface:"concrete",detailSpacing:470,detailSize:220,sway:.017,lift:112,shift:-14,width:148,groundWidth:420}),
 style(0,"Granite ridge",[12,378,772,131],[796,343,276,165],[1090,256,440,254],{soil:"#42434b",shadow:"#131d2d",weather:"stars",particle:"#daeaff",surface:"wood",detailSpacing:670,detailSize:200,sway:.026,lift:98,shift:24,width:175,groundWidth:495}),
 style(0,"Bamboo rootbed",[12,626,772,142],[796,612,276,155],[1090,515,440,253],{soil:"#263c2c",shadow:"#071e20",weather:"fireflies",particle:"#b3f1a6",surface:"grass",detailSpacing:310,detailSize:240,sway:.025,lift:120,shift:-24,width:160,groundWidth:385}),
 style(0,"Waterfall stone",[12,874,780,136],[796,832,276,177],[1090,770,440,242],{soil:"#214447",shadow:"#06242d",weather:"mist",particle:"#c3f2ec",surface:"concrete",detailSpacing:410,detailSize:190,sway:.01,lift:125,shift:18,width:190,groundWidth:450,water:"#62afbb"}),
 style(1,"Rain-soaked paving",[4,162,879,112],[889,139,266,125],[1159,0,373,277],{soil:"#333645",shadow:"#101528",weather:"rain",particle:"#b6c8f1",surface:"concrete",detailSpacing:580,detailSize:190,sway:.005,lift:90,shift:32,width:170,groundWidth:465,water:"#868bc1"}),
 style(1,"Canal masonry",[4,411,879,136],[889,379,266,111],[1159,282,373,265],{soil:"#304340",shadow:"#071d2c",weather:"drizzle",particle:"#b2daea",surface:"concrete",detailSpacing:480,detailSize:250,sway:.018,lift:115,shift:-32,width:185,groundWidth:510,water:"#70afa9"}),
 style(1,"Tidal sandstone",[4,666,879,107],[889,609,266,148],[1159,560,373,212],{soil:"#766c54",shadow:"#162a36",weather:"spray",particle:"#e4eee0",surface:"concrete",detailSpacing:520,detailSize:190,sway:.036,lift:105,shift:16,width:205,groundWidth:435,water:"#87c2cc"}),
 style(1,"Watchfire basalt",[4,894,879,118],[889,841,266,128],[1159,779,373,233],{soil:"#4e342d",shadow:"#201a29",weather:"sparks",particle:"#ffb374",surface:"concrete",detailSpacing:700,detailSize:210,sway:.024,lift:130,shift:-12,width:165,groundWidth:485}),
 style(2,"Snowbound shrine",[10,159,790,118],[809,128,270,147],[1085,0,442,278],{soil:"#4c6375",shadow:"#102a42",weather:"snow",particle:"#e5f3ff",surface:"snow",detailSpacing:630,detailSize:240,sway:.008,lift:108,shift:28,width:195,groundWidth:455}),
 style(2,"Frozen cedar roots",[10,388,790,141],[809,356,270,173],[1085,283,442,246],{soil:"#204353",shadow:"#07253c",weather:"frost",particle:"#a6e8ff",surface:"snow",detailSpacing:450,detailSize:220,sway:.002,lift:126,shift:-28,width:155,groundWidth:470}),
 style(2,"Autumn earth",[10,640,790,124],[809,625,280,137],[1085,529,442,236],{soil:"#533a2d",shadow:"#211e2d",weather:"leaves",particle:"#eea45f",surface:"grass",detailSpacing:430,detailSize:225,sway:.022,lift:100,shift:12,width:180,groundWidth:410}),
 style(2,"Koi garden stone",[10,875,790,132],[809,846,270,154],[1070,772,458,237],{soil:"#465244",shadow:"#122b2a",weather:"pollen",particle:"#f7deaf",surface:"concrete",detailSpacing:550,detailSize:200,sway:.011,lift:118,shift:-18,width:210,groundWidth:525,water:"#9bbd96"}),
 style(3,"Amethyst limestone",[10,139,824,126],[842,95,305,169],[1150,0,380,266],{soil:"#26283d",shadow:"#111527",weather:"dust",particle:"#c4a6ef",surface:"concrete",detailSpacing:500,detailSize:260,sway:.001,lift:132,shift:22,width:172,groundWidth:445}),
 style(3,"Luminous riverbed",[10,383,824,133],[842,321,305,186],[1150,278,380,240],{soil:"#183c4c",shadow:"#071c32",weather:"lights",particle:"#a1f2eb",surface:"concrete",detailSpacing:360,detailSize:190,sway:.004,lift:110,shift:-22,width:198,groundWidth:490,water:"#65dcd6"}),
 style(3,"Village cobbles",[10,634,824,128],[839,600,308,135],[1150,522,380,245],{soil:"#66503c",shadow:"#322833",weather:"seeds",particle:"#e5d39b",surface:"concrete",detailSpacing:560,detailSize:230,sway:.014,lift:94,shift:34,width:186,groundWidth:460}),
 style(3,"Dawn flagstones",[10,857,824,146],[831,784,318,182],[1148,773,380,236],{soil:"#85765b",shadow:"#3e3835",weather:"gold",particle:"#ffe3a0",surface:"concrete",detailSpacing:610,detailSize:215,sway:.006,lift:122,shift:-34,width:220,groundWidth:535}),
];

export function terrainFor(realm:number):TerrainStyle {const value=TERRAIN[realm];if(!value)throw new Error(`Unknown terrain ${realm}`);return value;}
export function terrainPlatformVariant(platform:Platform,realm:number):number{return Math.floor(platform.x/110)+realm;}
