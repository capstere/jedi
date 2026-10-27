/** Local Web Audio presentation. Logical hearing belongs to Game, including at volume 0.
 * Kenney CC0 samples and modifications: docs/fps-assets.json and THIRD_PARTY_NOTICES.md.
 * All scheduled sources are owned, bounded and stopped on pause/round reset.
 */
export const AUDIO_SAMPLES = Object.freeze([
  'footstep_carpet_000', 'footstep_carpet_001', 'footstep_carpet_002',
  'footstep_concrete_000', 'footstep_concrete_001', 'footstep_concrete_002',
  'impactMetal_light_000', 'impactMetal_light_001', 'impactMetal_medium_000',
  'impactSoft_medium_000', 'impactGeneric_light_000', 'explosionCrunch_000',
  'lowFrequency_explosion_000', 'laserSmall_000', 'computerNoise_000',
]);

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const point = v => ({ x: Number(v?.x) || 0, y: Number(v?.y) || 0, z: Number(v?.z) || 0 });
const ALIASES = { weaponSwitch: 'switch', grenadeThrow: 'throw', grenadeBounce: 'bounce',
  roundResult: 'result', bombBeep: 'beep', bombPlant: 'plant', bombDefuse: 'defuse',
  explosion: 'he', dryfire: 'empty', footstep: 'step' };

export class AudioSystem {
  constructor(world, settings = {}) {
    this.world = world;
    this.settings = settings;
    this.volume = clamp(Number(settings.volume ?? .55), 0, 1);
    this.context = null;
    this.master = null;
    this.buffers = new Map();
    this.active = new Set();
    this.ambient = []; this.ambientRoom = null; this.ambientBuffer = null;
    this.errors = [];
    this.seen = new WeakSet();
    this.ids = new Set();
    this.serial = 0;
    this.lastSimTime = -Infinity;
    this.generation = 0;
    this.disposed = false;
    this.stats = { played: 0, occluded: 0, stale: 0, duplicates: 0, dropped: 0 };
  }

  /** Call directly from a start/resume click, before awaiting other work. */
  async unlock() {
    if (this.disposed) return false;
    const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioContextClass) return false;
    if (!this.context) {
      this.context = new AudioContextClass();
      this.master = this.context.createGain();
      this.master.gain.value = this.volume;
      const limiter = this.context.createDynamicsCompressor();
      limiter.threshold.value = -10;
      limiter.knee.value = 12;
      limiter.ratio.value = 5;
      limiter.attack.value = .003;
      limiter.release.value = .12;
      this.master.connect(limiter).connect(this.context.destination);
      // iPhone Safari versions vary in support for Vorbis OGG. Include a
      // lightweight MP3 copy for every imported CC0 sound; prefer a codec
      // the browser advertises but also retry a decode failure automatically.
      const audioElement=typeof document!=='undefined'?document.createElement('audio'):null;
      const oggSupported=!!audioElement?.canPlayType?.('audio/ogg; codecs="vorbis"');
      const extensions=oggSupported?['ogg','mp3']:['mp3','ogg'];
      this.loadPromise = Promise.all(AUDIO_SAMPLES.map(async name => {
        for(const ext of extensions){
          try {
            const response = await fetch(new URL(`../assets/audio/${name}.${ext}`, import.meta.url));
            if(!response.ok)throw new Error(`HTTP ${response.status}`);
            const buffer = await this.context.decodeAudioData(await response.arrayBuffer());
            if (!this.disposed) this.buffers.set(name, buffer);
            return;
          } catch(error){
            if(ext===extensions.at(-1))this.errors.push(`${name}: ${error.message}`);
          }
        }
      }));
    }
    if (this.context.state === 'suspended') await this.context.resume();
    await this.loadPromise;
    return this.context.state === 'running';
  }

  setVolume(volume) {
    this.volume = clamp(Number(volume) || 0, 0, 1);
    if (this.master) this.master.gain.setTargetAtTime(this.volume, this.context.currentTime, .015);
    if (this.volume === 0) this.stopAmbient();
  }

  updateListener(listener) {
    if (!this.context || !listener) return;
    this.listener = point(listener.position || listener);
    this.listenerId = listener.id ?? listener.actorId;
    const yaw = Number(listener.yaw) || 0, pitch = Number(listener.pitch) || 0;
    const forward = listener.forward || { x: -Math.sin(yaw) * Math.cos(pitch), y: Math.sin(pitch), z: -Math.cos(yaw) * Math.cos(pitch) };
    const l = this.context.listener, t = this.context.currentTime;
    if (l.positionX) {
      for (const [key, value] of Object.entries({ positionX: this.listener.x, positionY: this.listener.y,
        positionZ: this.listener.z, forwardX: forward.x, forwardY: forward.y, forwardZ: forward.z,
        upX: 0, upY: 1, upZ: 0 })) l[key].setValueAtTime(value, t);
    } else {
      l.setPosition(this.listener.x, this.listener.y, this.listener.z);
      l.setOrientation(forward.x, forward.y, forward.z, 0, 1, 0);
    }
  }

  handle(events = [], listener, simTime = 0) {
    // A rewind means a new match, even if the caller forgot reset().
    if (simTime < this.lastSimTime) this.reset();
    this.lastSimTime = simTime;
    this.updateListener(listener);
    this.updateAmbient(listener);
    for (const event of events) {
      if (!event || typeof event !== 'object') continue;
      if (this.seen.has(event) || (event.id != null && this.ids.has(event.id))) {
        this.stats.duplicates++; continue;
      }
      this.seen.add(event);
      if (event.id != null) {
        this.ids.add(event.id);
        if (this.ids.size > 4096) this.ids.delete(this.ids.values().next().value);
      }
      // Never replay accumulated pre-unlock, focus-loss or previous-round sound.
      if (Number.isFinite(event.time) && (event.time < simTime - .4 || event.time > simTime + .1)) {
        this.stats.stale++; continue;
      }
      if (!this.context || this.context.state !== 'running' || !this.listener || this.volume === 0) continue;
      if (this.active.size >= 96) { this.stats.dropped++; continue; }
      this.play(event);
    }
  }

  /** Quiet, local room tone; never enters AI hearing or the match random sequence. */
  updateAmbient(listener) {
    if (!this.context || this.context.state !== 'running' || !this.volume || listener?.ambient === false || this.settings.ambient === false) {
      this.stopAmbient(); return;
    }
    const room = this.world?.roomAt?.(this.listener?.x,this.listener?.z);
    if (!room?.polygon?.length) { this.stopAmbient(); return; }
    if (this.ambientRoom !== room.id) {
      this.stopAmbient(); this.ambientRoom = room.id;
      const ctx=this.context,lab=['I01','I02','I03','I04','I29'].includes(room.id);
      const centre={x:room.polygon.reduce((sum,p)=>sum+p[0],0)/room.polygon.length,y:2.65,z:room.polygon.reduce((sum,p)=>sum+p[1],0)/room.polygon.length};
      if(!this.ambientBuffer){
        const count=ctx.sampleRate*4,buffer=ctx.createBuffer(1,count,ctx.sampleRate),data=buffer.getChannelData(0);let seed=741103,slow=0;
        for(let i=0;i<count;i++){seed=(Math.imul(seed,1664525)+1013904223)|0;slow=slow*.91+((seed>>>0)/2147483648-1)*.09;data[i]=slow;}
        // Join the loop gradually; no abrupt edge every four seconds.
        const blend=256;for(let i=0;i<blend;i++){const v=data[i]*(i/blend)+data[count-blend+i]*(1-i/blend);data[i]=v;data[count-blend+i]=v;}
        this.ambientBuffer=buffer;
      }
      const fan=ctx.createBufferSource();fan.buffer=this.ambientBuffer;fan.loop=true;
      this.ambientLoop(fan,centre,lab?.10:.075,lab?950:540);
      if(lab){
        const candidates=this.world.description?.boxes?.filter(b=>(b.roomId===room.id||this.world.roomAt(b.x,b.z)?.id===room.id)&&/instrument|hood|cabinet/.test(b.id))||[];
        const equipment=candidates.sort((a,b)=>Math.hypot(a.x-this.listener.x,a.z-this.listener.z)-Math.hypot(b.x-this.listener.x,b.z-this.listener.z))[0];
        const position=equipment?{x:equipment.x,y:Math.min(1.3,equipment.y),z:equipment.z}:centre;
        for(const frequency of [60,120]){const oscillator=ctx.createOscillator();oscillator.type='sine';oscillator.frequency.value=frequency;this.ambientLoop(oscillator,position,frequency===60?.014:.009,1200);}
      }
    }
    for(const item of this.ambient){
      const clear=this.world.segmentClear?.(this.listener,item.position,{vision:false})!==false;
      item.gain.gain.setTargetAtTime(item.volume*(clear?1:.18),this.context.currentTime,.18);
      item.filter.frequency.setTargetAtTime(clear?item.cutoff:180,this.context.currentTime,.18);
    }
  }

  ambientLoop(source,position,volume,cutoff){
    const ctx=this.context,gain=ctx.createGain(),filter=ctx.createBiquadFilter(),panner=ctx.createPanner();
    gain.gain.value=0;gain.gain.setTargetAtTime(volume,ctx.currentTime,.3);
    filter.type='lowpass';filter.frequency.value=cutoff;
    panner.panningModel='HRTF';panner.distanceModel='inverse';panner.refDistance=4;panner.maxDistance=30;panner.rolloffFactor=1;
    panner.positionX.value=position.x;panner.positionY.value=position.y;panner.positionZ.value=position.z;
    source.connect(filter).connect(gain).connect(panner).connect(this.master);source.start();
    this.ambient.push({source,gain,filter,position,volume,cutoff,nodes:[gain,filter,panner]});
  }

  stopAmbient(){
    for(const item of this.ambient){try{item.source.stop();}catch{}item.source.disconnect();for(const node of item.nodes)node.disconnect();}
    this.ambient.length=0;this.ambientRoom=null;
  }

  channel(event, volume = 1, delay = 0) {
    const ctx = this.context, gain = ctx.createGain(), filter = ctx.createBiquadFilter();
    const position = point(event.position || event);
    const global = ['result', 'match', 'round'].includes(event.type);
    const own = event.actorId != null && event.actorId === this.listenerId;
    let clear = true;
    if (!own && !global && this.world?.segmentClear) clear = this.world.segmentClear(this.listener, position, { vision: false });
    gain.gain.value = volume * (clear ? 1 : .24);
    filter.type = 'lowpass'; filter.frequency.value = clear ? 18000 : 780;
    gain.connect(filter);
    const nodes = [gain, filter];
    if (!own && !global) {
      const panner = ctx.createPanner();
      panner.panningModel = 'HRTF'; panner.distanceModel = 'inverse';
      panner.refDistance = 2.5; panner.maxDistance = 55; panner.rolloffFactor = 1.45;
      panner.positionX.value = position.x; panner.positionY.value = position.y; panner.positionZ.value = position.z;
      filter.connect(panner).connect(this.master); nodes.push(panner);
    } else filter.connect(this.master);
    if (!clear) this.stats.occluded++;
    return { gain, nodes, when: ctx.currentTime + delay };
  }

  track(source, channel, duration) {
    const item = { source, nodes: channel.nodes };
    this.active.add(item);
    source.onended = () => {
      this.active.delete(item);
      source.disconnect();
      for (const node of item.nodes) node.disconnect();
    };
    source.start(channel.when);
    source.stop(channel.when + duration);
  }

  sample(name, event, volume = .4, rate = 1, delay = 0, maxDuration = 2) {
    const buffer = this.buffers.get(name);
    if (!buffer) return this.noise(event, .06, volume * .15, 1000, delay);
    const source = this.context.createBufferSource();
    source.buffer = buffer; source.playbackRate.value = rate;
    const channel = this.channel(event, volume, delay);
    source.connect(channel.gain);
    const duration = Math.min(buffer.duration / rate, maxDuration);
    channel.gain.gain.setValueAtTime(channel.gain.gain.value, channel.when);
    channel.gain.gain.setTargetAtTime(0, channel.when + Math.max(.01, duration - .035), .01);
    this.track(source, channel, duration + .025);
  }

  tone(event, frequency, duration, volume, type = 'sine', endFrequency = frequency, delay = 0) {
    const osc = this.context.createOscillator(), channel = this.channel(event, volume, delay);
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, channel.when);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), channel.when + duration);
    channel.gain.gain.setValueAtTime(channel.gain.gain.value, channel.when);
    channel.gain.gain.exponentialRampToValueAtTime(.0001, channel.when + duration);
    osc.connect(channel.gain); this.track(osc, channel, duration + .02);
  }

  noise(event, duration, volume, cutoff = 4000, delay = 0) {
    const ctx = this.context, count = Math.ceil(ctx.sampleRate * duration), buffer = ctx.createBuffer(1, count, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    // Audio-only deterministic variation; never consumes the match PRNG.
    let seed = (this.serial + 1) * 7919;
    for (let i = 0; i < count; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; data[i] = ((seed >>> 0) / 2147483648 - 1) * (1 - i / count); }
    const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), channel = this.channel(event, volume, delay);
    source.buffer = buffer; filter.type = 'lowpass'; filter.frequency.value = cutoff;
    source.connect(filter).connect(channel.gain); channel.nodes.push(filter);
    this.track(source, channel, duration + .02);
  }

  play(event) {
    const type = ALIASES[event.type] || event.type;
    this.serial++;
    const n = this.serial % 3, varied = 1 + ((this.serial % 7) - 3) * .025;
    const sound = { ...event, type };
    switch (type) {
      case 'step': {
        const floor = event.surface || this.world?.materialAt?.(event.x, event.z) || 'vinyl';
        const quiet = event.mode === 'sneak' || event.mode === 'crouch';
        const volume = quiet ? .07 : event.mode === 'run' ? .48 : .28;
        this.sample(`footstep_${floor === 'carpet' ? 'carpet' : 'concrete'}_00${n}`, sound, volume, varied * (floor === 'carpet' ? 1 : 1.14));
        if (!quiet && this.serial % 3 === 0) this.noise(sound, .11, .045, 6800);
        break;
      }
      case 'shot': {
        const name = String(event.weapon || 'pistol').toLowerCase();
        if (name.includes('knife')) { this.noise(sound, .12, .2, 2800); break; }
        const sniper = /sniper|scope|long|precision/.test(name), shotgun = /shot|pump/.test(name);
        const rifle = /rifle|^ar47$|^cr4$|ak|m4|ar-/.test(name), smg = /smg|sub|compact/.test(name);
        const duration = sniper ? .32 : shotgun ? .26 : name === 'ar47' ? .17 : rifle ? .14 : smg ? .085 : .12;
        this.noise(sound, duration, sniper ? .95 : shotgun ? .8 : rifle ? .65 : .45, shotgun ? 2300 : smg ? 5200 : 3800);
        this.tone(sound, sniper ? 125 : shotgun ? 100 : name === 'ar47' ? 140 : rifle ? 190 : name === 'p12' ? 185 : 230, duration, .32, 'triangle', 38);
        this.sample('impactMetal_light_000', sound, .12, rifle ? 1.5 : .95, .025, .13);
        break;
      }
      case 'empty': this.sample('impactGeneric_light_000', sound, .18, 1.8); break;
      case 'reload':
        this.sample('impactMetal_light_001', sound, .27, .85);
        this.sample('impactMetal_light_000', sound, .2, 1.1, .3);
        this.sample('impactMetal_medium_000', sound, .24, 1.35, .65); break;
      case 'switch': this.sample('impactMetal_light_001', sound, .21, 1.6); this.noise(sound, .1, .06, 3100); break;
      case 'rustle': this.noise(sound, .18, event.mode === 'sneak' ? .015 : .075, 7800); break;
      case 'jump': this.sample('impactSoft_medium_000', sound, .17, 1.4); this.noise(sound, .09, .05, 1400); break;
      case 'land': this.sample('impactSoft_medium_000', sound, .45, .85); break;
      case 'throw': this.noise(sound, .14, .22, 5000); this.sample('impactMetal_light_001', sound, .12, 2); break;
      case 'bounce': this.sample('impactMetal_light_000', sound, .28 * clamp(event.energy ?? 1, .2, 1), varied * 1.4); break;
      case 'smoke': this.noise(sound, 1.4, .25, 3400); this.sample('impactGeneric_light_000', sound, .18, .8); break;
      case 'flash': this.sample('laserSmall_000', sound, .22, 1.5, 0, .35); this.noise(sound, .13, .36, 5600); break;
      case 'rocket-explosion':
      case 'he': this.sample('explosionCrunch_000', sound, .8, .9, 0, 1.8); this.sample('lowFrequency_explosion_000', sound, .65, 1, 0, 1.8); break;
      case 'tank-fire': this.sample('explosionCrunch_000',sound,.5,1.35,0,.65);this.tone(sound,95,.24,.28,'triangle',40);break;
      case 'tank-hit': this.sample('impactMetal_medium_000',sound,.35,.8);break;
      case 'tank-enter': case 'tank-exit': this.sample('impactMetal_light_000',sound,.25,1);break;
      case 'bot-takeoff': this.noise(sound,.28,.12,3400);this.tone(sound,510,.17,.08,'sine',720);break;
      case 'bot-landed': this.sample('impactSoft_medium_000',sound,.24,1.15);break;
      case 'plant': this.sample('computerNoise_000', sound, .1, 1.3, 0, .5); this.tone(sound, 520, .08, .13); break;
      case 'beep': this.tone(sound, 1250, .09, .25); break;
      case 'defuse': this.sample('computerNoise_000', sound, .12, 1.6, 0, .5); this.tone(sound, 1600, .18, .16, 'sine', 420); break;
      case 'result': case 'match':
        for (let i = 0; i < 3; i++) this.tone(sound, [440, 554, 659][i], .25, .12, 'triangle', [440, 554, 659][i], i * .13); break;
      case 'round': this.tone(sound, 660, .16, .12); break;
      case 'impact': this.sample('impactMetal_light_000', sound, .14, varied); break;
      case 'hit': if(event.sourceId === this.listenerId)this.tone({...sound,actorId:this.listenerId}, 1700, .045, .07); break;
      case 'damage':
        if(event.actorId !== this.listenerId) return;
        this.sample('impactSoft_medium_000',sound,.36,.72,0,.23);
        this.noise(sound,.10,.12,720);
        this.tone(sound,170,.16,.09,'sine',75);break;
      case 'pickup': case 'hostage': case 'rescued': this.tone(sound, 840, .12, .11, 'sine', 1050); break;
      default: return;
    }
    this.stats.played++;
  }

  /** Stop all tails and future scheduled reload/result notes. No setTimeouts survive a reset. */
  reset() {
    this.generation++;
    this.stopAmbient();
    for (const item of this.active) {
      item.source.onended = null;
      try { item.source.stop(); } catch { /* Already ended. */ }
      item.source.disconnect();
      for (const node of item.nodes) node.disconnect();
    }
    this.active.clear(); this.seen = new WeakSet(); this.ids.clear(); this.lastSimTime = -Infinity;
  }

  async dispose() {
    this.reset(); this.disposed = true;
    this.buffers.clear(); this.ambientBuffer=null;
    if (this.context && this.context.state !== 'closed') await this.context.close();
  }
}
