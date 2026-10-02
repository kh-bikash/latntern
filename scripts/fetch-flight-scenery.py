"""Cache open geographic scenery; all exported OSM adaptations remain ODbL.
No data service is contacted at game runtime. Estimated heights are labeled.
"""
import json, math, hashlib, urllib.request, urllib.parse, time
from pathlib import Path
OUT=Path('public/flight/scenery'); OUT.mkdir(parents=True,exist_ok=True)
CACHE=Path('outputs/flight-osm-cache'); CACHE.mkdir(parents=True,exist_ok=True)
for name in ['fuji','hakone','miyajima','kyoto','aso','daisetsu']:
    t=json.loads(Path(f'public/flight/terrain/{name}.json').read_text())
    bbox=f"{t['south']},{t['west']},{t['north']},{t['east']}"
    building_bbox=bbox if name!='kyoto' else f"{t['lat']-.024},{t['lon']-.03},{t['lat']+.024},{t['lon']+.03}"
    query=f'[out:json][timeout:90][maxsize:70000000];(way["building"]({building_bbox});way["landuse"="forest"]({bbox});way["natural"="wood"]({bbox});way["natural"="water"]({bbox}););out tags geom;'
    raw=CACHE/f'{name}.json'
    if not raw.exists():
        req=urllib.request.Request('https://overpass-api.de/api/interpreter',data=urllib.parse.urlencode({'data':query}).encode(),headers={'User-Agent':'HinodeGeographyBuild/3.1 (OpenStreetMap attribution; static snapshots)'})
        for attempt in range(3):
            try:
                data=urllib.request.urlopen(req,timeout=110).read(); parsed=json.loads(data)
                if 'remark' in parsed: raise RuntimeError(parsed['remark'])
                raw.write_bytes(data); break
            except Exception as e:
                if attempt==2: raise
                print(name,'retry',str(e)[:120],flush=True);time.sleep(5)
    parsed=json.loads(raw.read_bytes()); buildings=[]; forests=[]; lakes=[]
    def points(geom):
        return [[round((p['lon']-t['west'])/(t['east']-t['west'])*t['size'],1),round((t['north']-p['lat'])/(t['north']-t['south'])*t['size'],1)] for p in geom]
    for way in parsed['elements']:
        tags=way.get('tags',{}); geom=way.get('geometry',[])
        if len(geom)<4 or geom[0]!=geom[-1]: continue
        p=points(geom[:-1])
        if any(x<0 or z<0 or x>t['size'] or z>t['size'] for x,z in p): continue
        if 'building' in tags:
            area=abs(sum(p[i][0]*p[(i+1)%len(p)][1]-p[(i+1)%len(p)][0]*p[i][1] for i in range(len(p)))/2)
            if area<20 or len(p)>80: continue
            try: h=float(tags.get('height','').replace(' m',''))
            except ValueError:
                try: h=float(tags.get('building:levels','2'))*3
                except ValueError: h=6
            buildings.append({'id':way['id'],'p':p,'h':round(max(3,min(120,h)),1),'estimated':'height' not in tags})
        elif tags.get('natural')=='water' and tags.get('water')!='river': lakes.append(p)
        else: forests.append(p)
    # Deterministic spatial coverage, keeping browser mesh construction bounded.
    buildings.sort(key=lambda b: hashlib.sha256(str(b['id']).encode()).digest())
    payload={'license':'ODbL 1.0','attribution':'© OpenStreetMap contributors','licenseUrl':'https://opendatacommons.org/licenses/odbl/1-0/','source':'https://overpass-api.de/api/interpreter','query':query,'accessed':'2026-10-03','sourceSha256':hashlib.sha256(raw.read_bytes()).hexdigest(),'availableBuildings':len(buildings),'buildings':buildings[:10000],'forests':forests,'lakes':lakes}
    (OUT/f'{name}.json').write_text(json.dumps(payload,separators=(',',':')),encoding='utf-8')
    print(name,len(buildings),'buildings',len(forests),'forests',len(lakes),'lakes',flush=True)
