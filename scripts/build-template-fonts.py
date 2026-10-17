"""Build portable native faces from the already licensed, bundled font originals.
Run with fonttools + brotli. No network/font downloading and no source file edits.
"""
from pathlib import Path
import re,json,hashlib,struct,io,shutil,logging,argparse
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.merge import Merger

logging.getLogger('fontTools').setLevel(logging.ERROR)
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'public/fonts/pptx';OUT.mkdir(exist_ok=True)
catalog=json.loads((ROOT/'src/core/font-catalog.json').read_text())
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--family',action='append',help='Rebuild only this bundled family; preserve other native faces')
args=parser.parse_args()
families=args.family or ['Manrope','Work Sans','Inter','Plus Jakarta Sans','Space Grotesk','Source Sans 3','DM Serif Display','Noto Sans SC','Noto Serif SC']
unknown=set(families)-{font['family'] for font in catalog}
if unknown:parser.error('Unknown bundled font: '+', '.join(sorted(unknown)))
manifest_path=OUT/'manifest.json'
manifest=[face for face in json.loads(manifest_path.read_text()) if face['family'] not in families] if args.family and manifest_path.exists() else []
def name(font,id,default):
 v=font['name'].getDebugName(id);return v if v else default
def eot(font,raw):
 os=font['OS/2'];pan=os.panose
 panose=bytes(getattr(pan,k) for k in ['bFamilyType','bSerifStyle','bWeight','bProportion','bContrast','bStrokeVariation','bArmStyle','bLetterForm','bMidline','bXHeight'])
 head=struct.pack('<IIII',0,len(raw),0x00020001,0)+panose+bytes([1,1 if os.fsSelection&1 else 0])+struct.pack('<IHH',os.usWeightClass,os.fsType,0x504C)
 head+=struct.pack('<IIIIIII',os.ulUnicodeRange1,os.ulUnicodeRange2,os.ulUnicodeRange3,os.ulUnicodeRange4,getattr(os,'ulCodePageRange1',0),getattr(os,'ulCodePageRange2',0),font['head'].checkSumAdjustment)+struct.pack('<IIII',0,0,0,0)
 for value in [name(font,1,'Font'),name(font,2,'Regular'),name(font,5,'Version 1.0'),name(font,4,'Font')]:
  data=value.encode('utf-16le');head+=struct.pack('<HH',0,len(data))+data
 head+=struct.pack('<HH',0,0) # Padding5 and unrestricted RootStringSize, allowed by OFL.
 blob=head+raw;return struct.pack('<I',len(blob))+blob[4:]
for family in families:
 item=next(f for f in catalog if f['family']==family);css=(ROOT/('public'+item['css'])).read_text();paths=[]
 for block in css.split('}'):
  if 'italic' in block:continue
  for url in re.findall(r'url\([\'"]?([^\)\'\"]+)',block):
   p=ROOT/('public'+url) if url.startswith('/') else (ROOT/('public'+item['css'])).parent/url
   if p not in paths:paths.append(p)
 license=ROOT/('public'+item['license']);shutil.copy2(license,OUT/(item['id']+'-OFL.txt'))
 for weight in ([400] if item['weights']==[400] else [400,700]):
  temps=[]
  for i,path in enumerate(paths):
   font=TTFont(path);font.flavor=None
   if 'fvar' in font:font=instantiateVariableFont(font,{axis.axisTag:weight if axis.axisTag=='wght' else axis.defaultValue for axis in font['fvar'].axes},inplace=False)
   temp=OUT/f'.{item["id"]}-{weight}-{i}.ttf';font.save(temp);temps.append(temp)
  if len(temps)>1:font=Merger().merge([str(t) for t in temps])
  else:font=TTFont(temps[0])
  style='Bold' if weight>=600 else 'Regular';full=family+' '+style
  for nameid,value in [(1,family),(2,style),(4,full),(6,full.replace(' ','')),(16,family),(17,style)]:font['name'].setName(value,nameid,3,1,0x409)
  font['OS/2'].usWeightClass=weight;assert font['OS/2'].fsType==0,'Only fully editable, installable OFL faces are packaged'
  font['OS/2'].fsSelection=(font['OS/2'].fsSelection&~(1<<5|1<<6))|((1<<5) if weight>=600 else (1<<6));font['head'].macStyle=(font['head'].macStyle&~1)|(1 if weight>=600 else 0)
  font.flavor=None;buf=io.BytesIO();font.save(buf);raw=buf.getvalue();font=TTFont(io.BytesIO(raw))
  stem=item['id']+'-'+style.lower();ttf=OUT/(stem+'.ttf');ttf.write_bytes(raw);payload=eot(font,raw);(OUT/(stem+'.fntdata')).write_bytes(payload)
  manifest.append({'family':family,'style':'bold' if weight>=600 else 'regular','weight':weight,'file':'/fonts/pptx/'+stem+'.fntdata','ttf':'/fonts/pptx/'+stem+'.ttf','license':'/fonts/pptx/'+item['id']+'-OFL.txt','format':'EOT 0x20001; full sfnt, no glyph subsetting','fsType':font['OS/2'].fsType,'glyphs':len(font.getBestCmap()),'sha256':hashlib.sha256(payload).hexdigest(),'sourceHashes':{str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}})
  for t in temps:t.unlink()
  print(f'{family} {style}: {len(raw)} bytes, {len(font.getBestCmap())} characters',flush=True)
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2))
print('Native font faces packaged:',len(manifest),flush=True)
