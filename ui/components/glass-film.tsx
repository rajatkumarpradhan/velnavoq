import {useEffect,useRef,useState} from 'react';
import {Icon} from './icon';
/** Decorative, locally authored motion. Never presented as a running build or customer demo. */
export function GlassFilm(){
 const video=useRef<HTMLVideoElement>(null);
 const manuallyPaused=useRef(false);
 const inView=useRef(false);
 const [playing,setPlaying]=useState(false);
 const [failed,setFailed]=useState(false);
 const [reduced,setReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
 useEffect(()=>{
  const v=video.current;if(!v)return;
  const media=matchMedia('(prefers-reduced-motion: reduce)');let disposed=false;
  const shouldPlay=()=>!disposed&&inView.current&&!document.hidden&&!media.matches&&!manuallyPaused.current;
  const sync=async()=>{
   if(!shouldPlay()){v.pause();return;}
   if(!v.getAttribute('src'))v.src='/media/liquid-study-v1.mp4';
   try{await v.play();if(!shouldPlay())v.pause();}
   catch{/* Autoplay policy is not a media failure: leave a usable Play button. */setPlaying(false);}
  };
  const change=()=>{setReduced(media.matches);void sync();};
  const observer=new IntersectionObserver(entries=>{inView.current=entries[0]?.isIntersecting??false;void sync();},{threshold:0.01});
  observer.observe(v);media.addEventListener('change',change);document.addEventListener('visibilitychange',sync);
  return()=>{disposed=true;observer.disconnect();media.removeEventListener('change',change);document.removeEventListener('visibilitychange',sync);v.pause();};
 },[]);
 const toggle=async()=>{
  const v=video.current;if(!v||failed)return;
  if(!v.paused){manuallyPaused.current=true;v.pause();return;}
  manuallyPaused.current=false;
  try{if(!v.getAttribute('src'))v.src='/media/liquid-study-v1.mp4';await v.play();}
  catch{setPlaying(false);}
 };
 return <section className="glass-film-section" aria-label="Liquid glass visual study"><div className="glass-film-frame"><video ref={video} width="768" height="432" poster="/media/liquid-study-v1.jpg" preload="none" autoPlay={!reduced} muted loop playsInline disablePictureInPicture aria-label="Decorative liquid-glass motion study" onError={()=>{setFailed(true);setPlaying(false)}} onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)}/><div className="film-overlay"><span className="film-label">IDEAS IN MOTION</span><span className="film-caption">Original visual study · Not a live build.</span></div><button className="film-toggle" type="button" onClick={toggle} disabled={failed} aria-label={playing?'Pause decorative video':'Play decorative video'} aria-pressed={playing}><Icon name="play" size={14}/>{failed?'Still image':playing?'Pause motion':'Play motion'}</button>{reduced&&!playing&&<span className="film-preference">Reduced motion · Still image</span>}</div></section>;
}
