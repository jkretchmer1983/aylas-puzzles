import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, Settings, Volume2, X } from 'lucide-react';
import { generate } from '../gen/templates';
import { newSeed } from '../gen/rng';
import { TakePreviewPuzzle } from '../gen/Renderer';
import { emptyPlay, type PlayState } from './model';
import { ensureStory, subscribeStory } from '../lib/story-cache';
import { releaseSound } from './audio';

type Adventure = { storySeed: number; boardSeed: number; play: PlayState; started?: boolean; story?: {title:string;story:string} };
type Session = { adventures: Adventure[]; index: number };
const storageKey = 'ayla-take-rendered-v2';
function initialSeed() {
  for (let seed = 1; seed < 10000; seed++) {
    if (generate('take', 1, seed).task === 'There were 8 🎈. 3 were taken. How many are left?') return seed;
  }
  return 42;
}
const demoSeed = initialSeed();
const initial = (): Session => ({ adventures: [{ storySeed: demoSeed, boardSeed: demoSeed, play: emptyPlay() }], index: 0 });
export function TakePreview() {
  const [session, setSession] = useState<Session>(initial);
  const [loaded, setLoaded] = useState(false);
  const [muted, setMuted] = useState(false);
  const [softSound,setSoftSound]=useState(false);
  const [storyLoading,setStoryLoading]=useState(false);
  const [reduced, setReduced] = useState(false);
  const [storyOpen, setStoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [speechAvailable, setSpeechAvailable] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [notice,setNotice]=useState('Hold a balloon to lift it · or tap to select');
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);
  const storyDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
      if (saved?.adventures?.length && Number.isInteger(saved.index) && saved.index >= 0 && saved.index < saved.adventures.length && saved.adventures.every((a: Adventure) => Number.isInteger(a.storySeed) && Number.isInteger(a.boardSeed) && Array.isArray(a.play?.released) && Array.isArray(a.play?.selected) && Array.isArray(a.play?.batches) && Array.isArray(a.play?.marked) && typeof a.play?.answer === 'string')) setSession(saved);
      setMuted(localStorage.getItem('ayla-take-muted') === 'true');
      setSoftSound(localStorage.getItem('ayla-take-soft-sound') === 'true');
    } catch { /* Offline/private mode can still play. */ }
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(media.matches);
    const change = () => setReduced(media.matches);
    media.addEventListener('change', change);
    setSpeechAvailable('speechSynthesis' in window);
    setLoaded(true);
    return () => { media.removeEventListener('change', change); window.speechSynthesis?.cancel(); };
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try { sessionStorage.setItem(storageKey, JSON.stringify(session)); } catch { /* Storage is optional. */ }
  }, [session, loaded]);
  useEffect(() => {
    const dialog = storyDialog.current;
    if (storyOpen && dialog && !dialog.open) dialog.showModal();
    if (!storyOpen && dialog?.open) dialog.close();
  }, [storyOpen]);
  const adventure = session.adventures[session.index] ?? initial().adventures[0];
  if (!adventure) throw new Error('Missing Taking Away adventure');
  const spec = generate('take', 1, adventure.boardSeed);
  const storySpec = generate('take', 1, adventure.storySeed);
  useEffect(()=>{
    const seed=adventure.storySeed, key=`take-airfield:${seed}`;
    const entry=ensureStory(key,{age:4,theme:`A golden weather balloon airfield. ${storySpec.theme}`,title:storySpec.title,story:storySpec.story,task:storySpec.task});
    const update=()=>{
      setStoryLoading(!entry.settled);
      if(entry.settled) setSession(s=>({...s,adventures:s.adventures.map(a=>a.storySeed===seed&&!a.started?{...a,story:{title:entry.title||storySpec.title,story:entry.story||storySpec.story}}:a)}));
    };
    update();return subscribeStory(key,update);
  },[adventure.storySeed]);
  const flightLog=adventure.story||{title:storySpec.title,story:storySpec.story};
  const begin=()=>{stopSpeech();setSession(s=>({...s,adventures:s.adventures.map((a,i)=>i===s.index?{...a,started:true,story:flightLog}:a)}));};
  const stopSpeech = () => { window.speechSynthesis?.cancel(); utterance.current = null; setSpeaking(false); };
  useEffect(() => { stopSpeech(); setHintOpen(false); setStoryOpen(false); }, [session.index, adventure.boardSeed]);
  const patchPlay = (play: PlayState) => setSession(s => ({ ...s, adventures: s.adventures.map((a, i) => i === s.index ? { ...a, play } : a) }));
  const speak = () => {
    if (speaking) { stopSpeech(); return; }
    if (!speechAvailable || muted) return;
    const text = spec.task.replaceAll('🎈', 'balloons').replaceAll('🍪', 'cookies').replaceAll('🧁', 'cupcakes').replaceAll('🍬', 'candies');
    stopSpeech();
    const u = new SpeechSynthesisUtterance(text); u.rate = .85; u.lang = 'en-US';
    utterance.current = u; u.onend = u.onerror = () => { if (utterance.current === u) setSpeaking(false); };
    setSpeaking(true); window.speechSynthesis.speak(u);
  };
  const next = () => {
    stopSpeech(); const seed = newSeed();
    setSession(s => s.index < s.adventures.length - 1 ? { ...s, index: s.index + 1 } : { adventures: [...s.adventures, { storySeed: seed, boardSeed: seed, play: emptyPlay() }], index: s.index + 1 });
  };
  const newBoard = () => {
    stopSpeech(); let seed = newSeed();
    while (generate('take', 1, seed).task === spec.task) seed = (seed + 1) % 2 ** 31;
    setSession(s => ({ ...s, adventures: s.adventures.map((a, i) => i === s.index ? { ...a, boardSeed: seed, play: emptyPlay(), started:true } : a) }));
  };
  return <main className="take-preview" data-reduced={reduced} data-phase={adventure.started?'play':'story'}>
    <div className="take-landscape" aria-hidden="true"/>
    <header className="take-topbar">
      <a className="take-icon" href="/" aria-label="Back to puzzles" onClick={stopSpeech}><ArrowLeft /></a>
      <div className="take-brand"><span>AYLA’S PUZZLES</span><strong>Up & away</strong></div>
      <a className="take-age" href="/" aria-label="Choose age level, current Ages 4–5" onClick={stopSpeech}>Ages 4–5</a>
      <div className="take-progress" role="img" aria-label="Partly filled progress placeholder"><i /></div>
      <button className="take-icon" onClick={() => { stopSpeech(); setSettingsOpen(v => !v); }} aria-label="Game settings" aria-expanded={settingsOpen}><Settings /></button>
    </header>
    <section className="take-task" aria-label="Instructions"><div className="take-banner-copy"><p>{spec.task}</p><span className="take-banner-guidance">{notice}</span></div><button className="take-icon" onClick={speak} disabled={muted || !speechAvailable} aria-label={speaking ? 'Stop spoken instructions' : 'Hear instructions'} aria-pressed={speaking}><Volume2 /></button></section>
    {settingsOpen && <section className="take-settings" aria-label="Game settings"><strong>Game settings</strong><label><input type="checkbox" checked={muted} onChange={e => { setMuted(e.target.checked); stopSpeech(); try { localStorage.setItem('ayla-take-muted', String(e.target.checked)); } catch {} }} />Mute spoken instructions</label><label><input type="checkbox" checked={softSound} onChange={e=>{setSoftSound(e.target.checked);try{localStorage.setItem('ayla-take-soft-sound',String(e.target.checked))}catch{}}}/>Soft release sounds</label><label><input type="checkbox" checked={reduced} onChange={e => setReduced(e.target.checked)} />Reduce motion</label>{!speechAvailable && <p>Spoken instructions aren’t available in this browser.</p>}<button onClick={() => setSettingsOpen(false)}>Done</button></section>}
    <TakePreviewPuzzle onNotice={setNotice} started={!!adventure.started} onReleaseSound={()=>{if(softSound&&!muted)releaseSound()}} spec={spec} play={adventure.play} onPlayChange={patchPlay} reduced={reduced} onAnnounce={setAnnouncement} onNext={next} onPrevious={() => { stopSpeech(); setSession(s => ({ ...s, index: Math.max(0, s.index - 1) })); }} previousDisabled={session.index === 0} onNew={newBoard} onStory={() => { stopSpeech(); setStoryOpen(v => !v); }} onHint={() => setHintOpen(v => !v)} hintOpen={hintOpen} sessionKey={String(adventure.boardSeed)} />
    <section className="take-story-intro" aria-label="Your balloon adventure" aria-hidden={!!adventure.started} inert={adventure.started?true:undefined}>
      <img src="/take-airfield/flight-log.webp" alt="" className="take-intro-book"/>
      <span className="take-story-kicker">YOUR FLIGHT LOG</span><h1>{flightLog.title}</h1><p>{flightLog.story}</p>
      <span className="take-story-loading" role="status">{storyLoading?'Writing your flight log…':'The airfield is ready for you.'}</span>
      <button className="take-begin" onClick={begin}>Let’s fly <span aria-hidden="true">↗</span></button>
    </section>
    <dialog ref={storyDialog} className="take-modal" aria-label="Flight log" onCancel={() => setStoryOpen(false)}><section><button autoFocus className="take-icon take-close" onClick={() => setStoryOpen(false)} aria-label="Close story"><X /></button><BookOpen /><h2>{flightLog.title}</h2><p>{flightLog.story}</p><button onClick={() => setStoryOpen(false)}>Back to the airfield</button></section></dialog>
    <span className="take-sr-only" role="status" aria-live="polite">{announcement}</span>
  </main>;
}
