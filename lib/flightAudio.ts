// Responsive propeller synthesis mixed with the existing credited wind recording.
// Engine sound is synthesized; this is not a recording of a real aircraft.
export class FlightAudio{
 private ctx:AudioContext;private gain:GainNode;private engine:OscillatorNode;private harmonic:OscillatorNode;private wind:HTMLAudioElement;
 constructor(){this.ctx=new AudioContext();this.gain=this.ctx.createGain();this.gain.gain.value=.035;const filter=this.ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=750;this.gain.connect(filter).connect(this.ctx.destination);this.engine=this.ctx.createOscillator();this.engine.type='sawtooth';this.engine.frequency.value=70;this.engine.connect(this.gain);this.engine.start();this.harmonic=this.ctx.createOscillator();this.harmonic.type='sine';this.harmonic.frequency.value=140;this.harmonic.connect(this.gain);this.harmonic.start();this.wind=new Audio('/audio/wind-trees.mp3');this.wind.loop=true;this.wind.volume=.08;void this.wind.play().catch(()=>{});void this.ctx.resume();}
 update(throttle:number,speed:number){const now=this.ctx.currentTime;this.engine.frequency.setTargetAtTime(42+throttle*48,now,.25);this.harmonic.frequency.setTargetAtTime(84+throttle*96,now,.25);this.gain.gain.setTargetAtTime(.015+throttle*.027,now,.2);this.wind.volume=Math.min(.2,.04+speed*.001);}
 cue(){const o=this.ctx.createOscillator(),g=this.ctx.createGain(),now=this.ctx.currentTime;o.frequency.setValueAtTime(620,now);o.frequency.exponentialRampToValueAtTime(920,now+.16);g.gain.setValueAtTime(.05,now);g.gain.exponentialRampToValueAtTime(.0001,now+.45);o.connect(g).connect(this.ctx.destination);o.start();o.stop(now+.45);}
 dispose(){this.engine.stop();this.harmonic.stop();void this.ctx.close();this.wind.pause();this.wind.src='';}
}
