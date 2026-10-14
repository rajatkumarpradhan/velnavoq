#!/usr/bin/env python3
"""Original Velnavoq interior film: floating satin ribbons, not the landing sculpture.
Silent 8-second seamless loop, 960x540, H264. Requires Pillow and ffmpeg.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import math, subprocess
root=Path(__file__).resolve().parents[1]; out=root/'ui/public/media'
w,h=960,540
base=Image.new('RGB',(w,h)); pixels=base.load()
for y in range(h):
 for x in range(w):
  light=math.exp(-((x-w*.52)**2/(w*.55)**2+(y-h*.48)**2/(h*.65)**2))
  pixels[x,y]=(int(13+10*light),int(26+14*light),int(43+19*light))
f=subprocess.Popen(['ffmpeg','-y','-loglevel','error','-f','rawvideo','-pixel_format','rgb24','-video_size',f'{w}x{h}','-framerate','24','-i','pipe:0','-an','-c:v','libx264','-preset','medium','-crf','23','-pix_fmt','yuv420p','-movflags','+faststart',str(out/'studio-ribbons-v1.mp4')],stdin=subprocess.PIPE)
for frame in range(192):
 t=frame/192*math.tau
 im=base.convert('RGBA')
 # Quiet elliptical studio floor, not a build-status or progress indicator.
 glow=Image.new('RGBA',(w,h));d=ImageDraw.Draw(glow)
 d.ellipse((250,365,780,440),fill=(93,158,171,26));im=Image.alpha_composite(im,glow.filter(ImageFilter.GaussianBlur(24)))
 for layer in range(3):
  offset=layer*math.tau/3
  top=[];bottom=[]
  for i in range(121):
   s=i/120
   xx=175+580*s+layer*22
   yy=185+layer*48+42*math.sin(s*math.tau*.73+math.sin(t)*.10+offset)+13*math.sin(t+offset)-s*45
   thick=36+15*math.sin(math.pi*s)
   top.append((xx,yy));bottom.append((xx+11,yy+thick))
  mask=Image.new('L',(w,h));md=ImageDraw.Draw(mask);md.polygon(top+list(reversed(bottom)),fill=255)
  sheen=Image.new('RGBA',(w,h));sd=ImageDraw.Draw(sheen)
  for x in range(w):
   s=x/w; luminous=.56+.44*math.sin(s*math.pi)
   colors=[(147,185,208),(150,203,198),(194,180,215)]
   c=colors[layer]; rgb=tuple(int(v*luminous) for v in c)
   sd.line((x,0,x,h),fill=rgb+(235,))
  sheen.putalpha(mask.point(lambda p: int(p*.9)))
  shadow=Image.new('RGBA',(w,h));shadow.putalpha(mask.filter(ImageFilter.GaussianBlur(13)).point(lambda p:int(p*.25)))
  im=Image.alpha_composite(im,shadow);im=Image.alpha_composite(im,sheen)
  edges=Image.new('RGBA',(w,h));ed=ImageDraw.Draw(edges)
  ed.line(top,fill=(233,248,255,190),width=2);ed.line(bottom,fill=(93,160,183,170),width=2)
  im=Image.alpha_composite(im,edges)
 im=im.convert('RGB')
 if frame==0: im.save(out/'studio-ribbons-v1.jpg',quality=94)
 f.stdin.write(im.tobytes())
f.stdin.close();code=f.wait()
if code:raise SystemExit(code)
print('Studio ribbon assets written')
