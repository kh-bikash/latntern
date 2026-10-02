"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowLeft, ArrowRight, Pause, Play, RotateCcw, Volume2, VolumeX, X } from "lucide-react";
import { REALMS } from "@/lib/adventure";
import { storyFor } from "@/lib/cinematics";
import { playStoryCue, setCinematicMix } from "@/lib/audio";

type Props = { realm: number; ending: boolean; sound: boolean; onSound: () => void; onClose: () => void };
export default function CinematicStory({ realm, ending, sound, onSound, onClose }: Props) {
  const [index, setIndex] = useState(0), [auto, setAuto] = useState(false);
  const root = useRef<HTMLDivElement>(null), cuePlayed = useRef(-1);
  const place = REALMS[realm], beats = storyFor(realm, ending), current = beats[index];
  const duration = Math.max(7500, current.text.split(/\s+/).length * 360 + 2000);
  useEffect(() => { const previousOverflow=document.body.style.overflow; document.body.style.overflow="hidden"; setCinematicMix(true); return () => { document.body.style.overflow=previousOverflow; setCinematicMix(false); }; }, []);
  useEffect(() => { if (sound && cuePlayed.current !== index) { cuePlayed.current = index; if (current.cue) playStoryCue(current.cue); } }, [index, sound, current.cue]);
  useEffect(() => { if (!auto) return; const timer = setTimeout(() => { if (index < beats.length - 1) setIndex(index + 1); else setAuto(false); }, duration); return () => clearTimeout(timer); }, [auto, index, beats.length, duration]);
  function step(direction: number) { setAuto(false); setIndex(i => Math.max(0, Math.min(beats.length - 1, i + direction))); }
  function replay() { cuePlayed.current = -1; setAuto(false); setIndex(0); }
  return <div ref={root} className={`cinematic-story ${ending ? "cinematic-ending" : ""}`} role="dialog" aria-modal="true" aria-labelledby="cinema-title" onKeyDown={event => {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") { event.preventDefault(); step(event.key === "ArrowRight" ? 1 : -1); }
    if (event.key === "Tab") { const buttons = root.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"); if (!buttons?.length) return; const first = buttons[0], last = buttons[buttons.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } }
  }}>
    <div className="cinema-landscape" key={`${index}-${realm}`} style={{ "--shot-focus": current.focus, "--scene-accent": place.accent } as CSSProperties}>
      <img src={realm === 0 ? "/adventure/valley.png" : place.image} alt={place.title}/>
      <div className="cinema-mist"/><div className="cinema-vignette"/>
      <div className="cinema-motes" aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <i key={i} style={{left:`${8+i*7}%`,animationDelay:`${-i*1.7}s`,top:`${20+i%5*12}%`}}/>)}</div>
      <div className="cinema-place"><p className="eyebrow">{ending ? "THE LIGHT’S WAY HOME" : `CHAPTER ${Math.floor(realm / 2) + 1} · ${place.chapter}`}</p><h2 id="cinema-title">{ending ? "A light nobody owns." : place.title}</h2><span>{ending ? "THE HOMECOMING" : `A MEMORY OF THE JOURNEY · ${String(realm + 1).padStart(2, "0")}`}</span></div>
      {(current.speaker === "Aoi" || current.speaker === "Ren") && <div className={`cinema-traveler ${current.speaker === "Ren" ? "ren" : "aoi"}`} aria-hidden="true"/>}
    </div>
    <div className="cinema-topbar"><span>LANTERN RELAY <b>THE LOST DAWN</b></span><div><button onClick={onSound} aria-label={sound ? "Mute scene sound" : "Enable scene sound"}>{sound ? <Volume2 size={18}/> : <VolumeX size={18}/>}</button><button onClick={onClose} className="cinema-skip" autoFocus>Skip scene<X size={16}/></button></div></div>
    <section className="cinema-dialogue">
      <div className="cinema-subtitle" key={index} aria-live="polite" aria-atomic="true"><p className={`cinema-speaker speaker-${current.speaker.toLowerCase().replace(/\s/g,"-")}`}><i/>{current.speaker}</p><p className="cinema-line">{current.text}</p></div>
      <div className="cinema-controls"><div className="cinema-playback"><button onClick={replay} aria-label="Replay scene"><RotateCcw size={16}/></button><button onClick={()=>setAuto(!auto)} aria-label={auto ? "Pause automatic story" : "Play story automatically"}>{auto ? <Pause size={16}/> : <Play size={16}/>}<span>{auto ? "Pause" : "Auto"}</span></button><div className="cinema-beats" aria-label={`Story passage ${index+1} of ${beats.length}`}>{beats.map((_, i) => <button key={i} className={i === index ? "active" : i < index ? "read" : ""} aria-label={`Read passage ${i+1}`} aria-current={i===index?"step":undefined} onClick={()=>{setAuto(false);setIndex(i);}}/>)}</div></div><div className="cinema-navigation"><button className="cinema-back" onClick={()=>step(-1)} disabled={index === 0} aria-label="Previous passage"><ArrowLeft size={18}/></button><button className="cinema-next" onClick={()=>index === beats.length-1 ? onClose() : step(1)}>{index === beats.length-1 ? ending ? "Return to the village" : "Begin exploring" : "Continue"}<ArrowRight size={18}/></button></div></div>
      <p className="cinema-reading-note">{index === beats.length-1 && !ending ? "The atlas is open. Choose a trail together and explore at your own pace." : "Read at your own pace · ← → to turn the page · Esc to explore"}</p>
    </section>
  </div>;
}
