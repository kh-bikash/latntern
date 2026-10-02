"""Build attributed Japanese terrain snapshots from GSI photography and Mapzen DEM.
Not browser automation. Four concurrent data downloads; completed tiles are cached.
"""
import math,json,io,hashlib,urllib.request,time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from PIL import Image

PLACES=[('fuji','Mount Fuji',35.3606,138.7274),('hakone','Hakone Lakes',35.2300,139.0200),('miyajima','Seto Inland Sea',34.2790,132.3190),('kyoto','Kyoto Valley',35.0116,135.7681),('aso','Aso Caldera',32.8848,131.1041),('daisetsu','Daisetsuzan',43.6635,142.8540)]
OUT=Path('public/flight/terrain');CACHE=Path('outputs/flight-tile-cache');OUT.mkdir(parents=True,exist_ok=True);CACHE.mkdir(parents=True,exist_ok=True)
receipts=[]
def get(url):
 p=CACHE/(hashlib.sha256(url.encode()).hexdigest()+'.tile')
 if p.exists():return p.read_bytes()
 for retry in range(3):
  try:
   req=urllib.request.Request(url,headers={'User-Agent':'HinodeFlightAdventure/1.0 (attributed geography asset build)'})
   data=urllib.request.urlopen(req,timeout=30).read();p.write_bytes(data);return data
  except Exception:
   if retry==2:raise
   time.sleep(1+retry)
def tile(lat,lon,z):
 n=2**z;return (lon+180)/360*n,(1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*n
def lat_at(y,z):return math.degrees(math.atan(math.sinh(math.pi*(1-2*y/2**z))))
for idx,(id,name,lat,lon) in enumerate(PLACES):
 x,y=tile(lat,lon,12);sx,sy=math.floor(x)-(1 if x%1<.5 else 0),math.floor(y)-(1 if y%1<.5 else 0)
 jobs=[('photo',i,j,f'https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/14/{sx*4+i}/{sy*4+j}.jpg') for j in range(8) for i in range(8)]+[('dem',i,j,f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/12/{sx+i}/{sy+j}.png') for j in range(2) for i in range(2)]
 photo=Image.new('RGB',(2048,2048));dem=Image.new('RGB',(512,512))
 def download(job):return job,get(job[3])
 with ThreadPoolExecutor(max_workers=4) as pool:
  for job,data in pool.map(download,jobs):
   kind,i,j,url=job;im=Image.open(io.BytesIO(data)).convert('RGB');(photo if kind=='photo' else dem).paste(im,(i*256,j*256));receipts.append({'region':id,'url':url,'sha256':hashlib.sha256(data).hexdigest()})
 heights=[];pixels=dem.load()
 for j in range(257):
  for i in range(257):
   px,py=i/256*511,j/256*511;a,b=int(px),int(py);u,v=px-a,py-b
   def h(x,y):r,g,b=pixels[min(511,x),min(511,y)];return r*256+g+b/256-32768
   heights.append(round(max(0,h(a,b)*(1-u)*(1-v)+h(a+1,b)*u*(1-v)+h(a,b+1)*(1-u)*v+h(a+1,b+1)*u*v),1))
 # Remove isolated corrupt DEM spikes; retain broad natural peaks.
 original=list(heights)
 for row in range(1,256):
  for col in range(1,256):
   near=sorted(original[(row+y)*257+col+x] for y in [-1,0,1] for x in [-1,0,1] if x or y)
   if original[row*257+col]>near[4]+400: heights[row*257+col]=near[4]
 north,south=lat_at(sy,12),lat_at(sy+2,12);west,east=sx/4096*360-180,(sx+2)/4096*360-180
 width=40075016.6856/4096*2*math.cos(math.radians((north+south)/2))
 metadata={'id':id,'name':name,'lat':lat,'lon':lon,'north':north,'south':south,'west':west,'east':east,'size':round(width,2),'grid':257,'heights':heights,'photoSource':'GSI seamlessphoto mosaic, edited into a WebP texture','terrainSource':'Mapzen Terrain Tiles / USGS SRTM, resampled to a 257 by 257 height mesh'}
 (OUT/f'{id}.json').write_text(json.dumps(metadata,separators=(',',':')),encoding='utf-8');photo.save(OUT/f'{id}.webp',quality=88,method=6)
 print(id,'metres',round(width),'height range',min(heights),max(heights),flush=True)
 # A real, lower-detail outer landscape prevents the central scenery from
 # ending as a floating square. Zoom 12 photographs use GSI's Landsat mosaic.
 outer=Image.new('RGB',(1536,1536));outer_dem=Image.new('RGB',(1536,1536))
 farjobs=[(kind,i,j,f'https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/12/{sx-2+i}/{sy-2+j}.jpg' if kind=='photo' else f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/12/{sx-2+i}/{sy-2+j}.png') for kind in ['photo','dem'] for j in range(6) for i in range(6)]
 with ThreadPoolExecutor(max_workers=4) as pool:
  for job,data in pool.map(download,farjobs):
   kind,i,j,url=job;im=Image.open(io.BytesIO(data)).convert('RGB');(outer if kind=='photo' else outer_dem).paste(im,(i*256,j*256));receipts.append({'region':id+'-outer','url':url,'sha256':hashlib.sha256(data).hexdigest()})
 fh=[];fp=outer_dem.load()
 for j in range(193):
  for i in range(193):
   a,b=round(i/192*1535),round(j/192*1535);red,green,blue=fp[a,b];fh.append(round(max(0,red*256+green+blue/256-32768),1))
 (OUT/f'{id}-outer.json').write_text(json.dumps({'grid':193,'size':round(width*3,2),'heights':fh},separators=(',',':')),encoding='utf-8');outer.save(OUT/f'{id}-outer.webp',quality=84,method=6)
 print(id,'outer landscape complete',flush=True)
(OUT/'sources.json').write_text(json.dumps({'accessed':'2026-10-03','tiles':receipts},indent=2),encoding='utf-8')
