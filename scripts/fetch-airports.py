"""Worldwide airport/runway snapshot from public-domain OurAirports data."""
import csv,io,json,urllib.request,hashlib
from pathlib import Path
out=Path('public/flight/global');out.mkdir(parents=True,exist_ok=True)
def get(name):
    url=f'https://davidmegginson.github.io/ourairports-data/{name}.csv'
    raw=urllib.request.urlopen(url,timeout=90).read()
    return list(csv.DictReader(io.StringIO(raw.decode('utf-8')))),{'url':url,'sha256':hashlib.sha256(raw).hexdigest()}
airports,airport_receipt=get('airports');runways,runway_receipt=get('runways');by={};airport_by_ident={a['ident']:a for a in airports}
for w in runways:
    if w['closed']=='1':continue
    try:
        rw={'name':w['le_ident'],'length':round(float(w['length_ft'])*.3048),'width':round(float(w['width_ft'] or '100')*.3048),'surface':w['surface'],'lat':float(w['le_latitude_deg']),'lon':float(w['le_longitude_deg']),'heading':float(w['le_heading_degT'] or '0'),'endLat':float(w['he_latitude_deg']),'endLon':float(w['he_longitude_deg'])}
    except ValueError:
        # Retain known dimensions; place an explicitly estimated strip at the
        # airport center only if the public dataset lacks threshold coordinates.
        a=airport_by_ident.get(w['airport_ident'])
        if not a:continue
        try:
            lat,lon=float(a['latitude_deg']),float(a['longitude_deg']);length=round(float(w['length_ft'] or '3300')*.3048);heading=float(w['le_heading_degT'] or (str(w['le_ident'])[:2]+'0'))
        except ValueError:heading=0
        import math
        dy=math.cos(math.radians(heading))*length/2/111320;dx=math.sin(math.radians(heading))*length/2/(111320*max(.05,math.cos(math.radians(lat))))
        rw={'name':w['le_ident'],'length':length,'width':round(float(w['width_ft'] or '100')*.3048),'surface':w['surface'],'lat':lat-dy,'lon':lon-dx,'heading':heading,'endLat':lat+dy,'endLon':lon+dx,'estimated':True}
    by.setdefault(w['airport_ident'],[]).append(rw)
data=[]
for a in airports:
    if a['type']=='closed':continue
    data.append({'id':a['ident'],'iata':a['iata_code'],'name':a['name'],'type':a['type'],'country':a['iso_country'],'city':a['municipality'],'lat':float(a['latitude_deg']),'lon':float(a['longitude_deg']),'elevation':round(float(a['elevation_ft'] or '0')*.3048),'runways':by.get(a['ident'],[])})
(out/'airports.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
(out/'sources.json').write_text(json.dumps({'accessed':'2026-10-03','license':'Public Domain','source':'https://ourairports.com/data/','airports':len(data),'withRunwayDimensions':sum(bool(a['runways']) for a in data),'withSurveyedEndpoints':sum(any(not r.get('estimated') for r in a['runways']) for a in data),'receipts':[airport_receipt,runway_receipt]},indent=2),encoding='utf-8')
print(len(data),'airports;',sum(bool(a['runways']) for a in data),'with runway endpoints',flush=True)
