// Open photogrammetry meshes (keyless, open licences) that give Google-Earth-like scenery in their coverage areas.
// Heights in the meshes are ellipsoidal; `geoid` is the EGM2008 geoid height used to bring them to sea level.
export type PhotorealRegion={id:string;name:string;country:string;url:string;bounds:[south:number,north:number,west:number,east:number];geoid:number;airports:string[];credit:string;gltf1?:boolean};

export const PHOTOREAL:PhotorealRegion[]=[
 {id:'strasbourg',name:'Strasbourg',country:'France',url:'https://s3.eu-west-2.wasabisys.com/ems-sgct-photomaillage/ODACIT/EMS_PM2022/tileset.json',bounds:[48.43,48.71,7.522,7.9],geoid:48.56,airports:['LFST'],credit:'Photomaillage 2022 © Eurométropole de Strasbourg (open data)'},
 // Clermont-Ferrand: the CRAIG server fails many tile requests (query-string tile URLs); disabled until resolved.
 // {id:'clermont',name:'Clermont-Ferrand',country:'France',url:'https://3d.craig.fr/datasets/Clermont/3dtiles/tileset.json',bounds:[45.704,45.885,3.041,3.294],geoid:50.52,airports:['LFLC'],credit:'Photomaillage © CRAIG Auvergne-Rhône-Alpes (open data)'},
 // Luxembourg streams glTF 1.0 tiles; enabled once the in-browser converter lands.
 // {id:'luxembourg',name:'Luxembourg',country:'Luxembourg',url:'https://acts3.geoportail.lu/3d-data/3d-tiles/mesh3D/mesh3D_2020_v2/Cesium/tileset.json',bounds:[49.416,50.2,5.674,6.589],geoid:48.05,airports:['ELLX'],credit:'Maquette 3D 2020 © Administration du cadastre et de la topographie, CC0',gltf1:true},
];

export const photorealAt=(lat:number,lon:number)=>PHOTOREAL.find(r=>lat>r.bounds[0]&&lat<r.bounds[1]&&lon>r.bounds[2]&&lon<r.bounds[3])??null;
