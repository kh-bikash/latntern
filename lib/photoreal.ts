// Open photogrammetry meshes (keyless, open licences) that give Google-Earth-like scenery in their coverage areas.
// `geoid` is the EGM2008 geoid height used to place ellipsoidal meshes at sea level (the runway calibration then
// removes any remaining datum difference). Tiles are fetched through the /api/geo relay (CDN-cached, HTTP/2). Only these regions are offered: the whole ground is real 3D there.
export type PhotorealRegion={id:string;name:string;country:string;format:'3dtiles'|'i3s';url:string;crs?:string;
 bounds:[south:number,north:number,west:number,east:number];geoid:number;airports:string[];credit:string;gltf1?:boolean};

export const PHOTOREAL:PhotorealRegion[]=[
 {id:'nrw',name:'North Rhine-Westphalia',country:'Germany',format:'i3s',url:'/api/geo/nrw',crs:'+proj=utm +zone=32 +ellps=GRS80 +units=m +no_defs',
  bounds:[50.32,52.53,5.86,9.46],geoid:46.5,airports:['EDDK','EDDL','EDLW','EDDG','EDLP','EDLV'],credit:'3D-Mesh NRW © Geobasis NRW, dl-de/zero-2-0'},
 {id:'strasbourg',name:'Strasbourg',country:'France',format:'3dtiles',url:'/api/geo/sxb/tileset.json',bounds:[48.43,48.71,7.522,7.9],geoid:48.56,airports:['LFST'],credit:'Photomaillage 2022 © Eurométropole de Strasbourg (open data)'},
 // Clermont-Ferrand: the CRAIG server fails many tile requests (query-string tile URLs); disabled until resolved.
 // Luxembourg streams glTF 1.0 tiles; enabled once the in-browser converter lands.
 // {id:'luxembourg',name:'Luxembourg',country:'Luxembourg',format:'3dtiles',url:'https://acts3.geoportail.lu/3d-data/3d-tiles/mesh3D/mesh3D_2020_v2/Cesium/tileset.json',bounds:[49.416,50.2,5.674,6.589],geoid:48.05,airports:['ELLX'],credit:'Maquette 3D 2020 © Administration du cadastre et de la topographie, CC0',gltf1:true},
];
/** Photoreal-only mode: only photogrammetry regions are offered and no generated (block) buildings or trees are drawn. */
export const PHOTOREAL_ONLY=true;
export const PHOTOREAL_AIRPORTS=PHOTOREAL.flatMap(r=>r.airports);
export const photorealAt=(lat:number,lon:number)=>PHOTOREAL.find(r=>lat>r.bounds[0]&&lat<r.bounds[1]&&lon>r.bounds[2]&&lon<r.bounds[3])??null;
