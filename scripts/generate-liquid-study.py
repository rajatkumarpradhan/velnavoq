#!/usr/bin/env python3
"""Original procedural liquid-glass study for Velnavoq. No external footage or music.
Reproduce: uv run --no-project --with numpy==2.4.1 --with pillow==12.1.0 scripts/generate-liquid-study.py
Requires system ffmpeg. Output: 8s, 768x432, 24fps, H.264 yuv420p, silent, faststart.
"""
from pathlib import Path
import subprocess, math
import numpy as np
from PIL import Image
root=Path(__file__).resolve().parents[1]; out=root/'ui/public/media';out.mkdir(exist_ok=True)
w,h=864,864
Y,X=np.mgrid[0:h,0:w].astype(np.float32); x=(X-w/2)/(h/2);y=(Y-h/2)/(h/2)
base=np.zeros((h,w,3),np.float32);base[:]=[245,246,250]
def bloom(cx,cy,scale,color):
    return np.exp(-((x-cx)**2+(y-cy)**2)/scale)[...,None]*np.array(color,dtype=np.float32)
base+=bloom(-.5,-.5,.7,[-8,-3,0])+bloom(.55,.2,.5,[-3,-8,-1])
ff=subprocess.Popen(['ffmpeg','-y','-loglevel','error','-f','rawvideo','-pixel_format','rgb24','-video_size',f'{w}x{h}','-framerate','24','-i','pipe:0','-an','-c:v','libx264','-preset','medium','-crf','25','-pix_fmt','yuv420p','-movflags','+faststart',str(out/'liquid-study-v1.mp4')],stdin=subprocess.PIPE)
for i in range(192):
    t=2*math.pi*i/192
    rgb=base.copy()
    # Pearlescent glass sculpture, with organic refraction and studio lighting.
    cx=.03*np.sin(t);cy=-.08+.035*np.cos(t)
    xx=x-cx; yy=y-cy
    theta=np.arctan2(yy,xx)
    radius=.63*(1+.09*np.cos(3*theta+t)+.025*np.sin(5*theta-t))
    r=np.sqrt(xx**2+yy**2)/radius
    mask=np.clip((1-r)*90,0,1)
    z=np.sqrt(np.clip(1-r*r,0,1))
    nx=xx/.68;ny=yy/.68
    light=np.clip(.22-.25*nx-.35*ny+.7*z,0,1)
    # Soft contact shadow grounds a solid-looking material, not wireframe art.
    shadow=np.exp(-(x*x/.37+(y-.56)**2/.014))
    rgb-=shadow[...,None]*np.array([42,37,31])
    phase=theta*1.4+z*6+t*.35
    pearl=np.stack([149+66*np.cos(phase+.2),167+62*np.cos(phase-1.2),197+45*np.cos(phase-2.4)],axis=-1)
    color=pearl*(.48+.55*light[...,None])
    spec=np.power(np.clip(-.4*nx-.53*ny+.68*z,0,1),22)
    color+=spec[...,None]*np.array([120,118,107])
    stripe=np.exp(-(np.sin(2.3*theta+3.9*z-t*.2)/.13)**2)
    color=color*(1-stripe[...,None]*.15)+stripe[...,None]*np.array([37,33,28])
    rim=np.exp(-((r-.975)/.024)**2)
    color+=rim[...,None]*np.array([44,36,24])
    rgb=rgb*(1-mask[...,None])+color*mask[...,None]
    # A translucent wide elliptical orbit with a lit edge; no simulated UI.
    angle=.35+.10*np.sin(t)
    u=x*np.cos(angle)+y*np.sin(angle);v=-x*np.sin(angle)+y*np.cos(angle)
    orbit=np.sqrt((u/.88)**2+(v/.39)**2)
    ring=np.exp(-((orbit-1)/.038)**2)
    front=(v>.035).astype(np.float32);visible=(1-mask)+mask*front
    hue=.5+.5*np.sin(theta+t*.3)
    tint=np.stack([114+55*hue,151+36*hue,206+20*hue],axis=-1)
    strength=ring*visible*.75
    rgb=rgb*(1-strength[...,None])+tint*strength[...,None]
    edge=np.exp(-((orbit-.982)/.008)**2)*visible
    rgb+=edge[...,None]*np.array([28,32,36])
    rgb=np.uint8(np.clip(rgb,0,255))
    if i==24:Image.fromarray(rgb).save(out/'liquid-study-v1.jpg',quality=90,optimize=True)
    ff.stdin.write(rgb.tobytes())
ff.stdin.close();code=ff.wait()
if code:raise SystemExit(code)
print(out/'liquid-study-v1.mp4')
