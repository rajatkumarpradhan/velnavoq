#!/usr/bin/env python3
"""Original procedural liquid-glass study for Velnavoq. No external footage or music.
Reproduce: uv run --no-project --with numpy==2.4.1 --with pillow==12.1.0 scripts/generate-liquid-study.py
Requires system ffmpeg. Output: 8s, 768x432, 15fps, H.264 yuv420p, silent, faststart.
"""
from pathlib import Path
import subprocess, math
import numpy as np
from PIL import Image
root=Path(__file__).resolve().parents[1]; out=root/'ui/public/media';out.mkdir(exist_ok=True)
w,h=768,432
Y,X=np.mgrid[0:h,0:w].astype(np.float32); x=(X-w/2)/(h/2);y=(Y-h/2)/(h/2)
base=np.zeros((h,w,3),np.float32);base[:]=[8,19,39]
def bloom(cx,cy,scale,color):
    return np.exp(-((x-cx)**2+(y-cy)**2)/scale)[...,None]*np.array(color,dtype=np.float32)
base+=bloom(-.85,-.55,.62,[34,50,96])+bloom(.95,.48,.55,[38,24,70])+bloom(.1,.55,.22,[6,39,49])
ff=subprocess.Popen(['ffmpeg','-y','-loglevel','error','-f','rawvideo','-pixel_format','rgb24','-video_size',f'{w}x{h}','-framerate','15','-i','pipe:0','-an','-c:v','libx264','-preset','medium','-crf','25','-pix_fmt','yuv420p','-movflags','+faststart',str(out/'liquid-study-v1.mp4')],stdin=subprocess.PIPE)
for i in range(120):
    t=2*math.pi*i/120
    rgb=base.copy()
    # A flowing translucent ribbon, lit by cyan and lavender edges.
    curve=.40*np.sin(1.45*x+t)+.08*np.cos(3.0*x-t)
    distance=np.abs(y-curve)
    band=np.exp(-(distance/.31)**2)
    edges=np.exp(-((distance-.24)/.020)**2)
    light=.42+.30*np.cos(2*x+t)
    rgb+=band[...,None]*np.stack([18+26*light,28+43*light,58+50*light],axis=-1)
    rgb+=edges[...,None]*np.array([86,117,157],np.float32)*(.45+light[...,None])
    # Refractive glass orbit: elliptic ring, nuanced edge light, no text or fake app footage.
    cx=.10+.08*np.sin(t);cy=-.06+.07*np.cos(t)
    a=.93+.06*np.cos(t);b=.65+.04*np.sin(t)
    r=np.sqrt(((x-cx)/a)**2+((y-cy)/b)**2)
    theta=np.arctan2((y-cy)/b,(x-cx)/a)
    mask=np.exp(-((r-1)/.10)**2)
    sheen=np.power(np.maximum(0,np.cos(theta+t*.4+.6)),6)
    highlights=np.exp(-((r-.925)/.013)**2)+.75*np.exp(-((r-1.07)/.019)**2)
    tint=np.stack([72+68*np.sin(theta+t)**2,112+37*np.cos(theta-t)**2,168+30*np.cos(theta+t)**2],axis=-1)
    rgb=rgb*(1-mask[...,None]*.25)+mask[...,None]*tint*(.30+.5*sheen[...,None])
    rgb+=highlights[...,None]*np.array([131,166,206],np.float32)*(.25+.65*sheen[...,None])
    # Small frosted lens in the foreground, same deterministic animation period.
    sx=-.93+.09*np.cos(t);sy=.52+.06*np.sin(t)
    d=np.sqrt((x-sx)**2+(y-sy)**2)/.22
    lens=np.clip((1-d)*15,0,1)
    rim=np.exp(-((d-.96)/.027)**2)
    rgb+=lens[...,None]*np.array([23,34,49])+rim[...,None]*np.array([133,162,190])
    rgb=np.uint8(np.clip(rgb,0,255))
    if i==15:Image.fromarray(rgb).save(out/'liquid-study-v1.jpg',quality=90,optimize=True)
    ff.stdin.write(rgb.tobytes())
ff.stdin.close();code=ff.wait()
if code:raise SystemExit(code)
print(out/'liquid-study-v1.mp4')
