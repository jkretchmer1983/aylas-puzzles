import { useEffect, useId, useState, useSyncExternalStore } from 'react';
import { Loader2, Square, Volume2, VolumeX } from 'lucide-react';
import { getNarration, narrationSupported, speak, stopNarration, stopNarrationFor, subscribeNarration } from '@/lib/audio/narrator';
import { cn } from '@/lib/utils';

const server = () => ({ id: null, status: 'idle' as const });
/** Speaker control: reads the exact current text via the shared narrator on explicit tap. */
export function ReadAloud({ text, label = 'instructions', children, className }: { text: string; label?: string; children?: React.ReactNode; className?: string }) {
  const id = useId();
  const [supported, setSupported] = useState(false);
  const n = useSyncExternalStore(subscribeNarration, getNarration, server);
  useEffect(() => { setSupported(narrationSupported()); }, []);
  useEffect(() => () => stopNarrationFor(id), [id, text]);
  const mine = n.id === id;
  const active = mine && (n.status === 'speaking' || n.status === 'loading');
  const error = mine && n.status === 'error' ? n.error : undefined;
  const toggle = () => { if (active) stopNarration(); else speak(id, text); };
  return <button type="button" className={cn(className ? 'read-aloud' : 'forest-read-aloud', className)} onClick={toggle} disabled={!supported} data-audio-ignore
    aria-label={!supported ? 'Read aloud unavailable on this device' : `${active ? 'Stop reading' : 'Read'} ${label}${active ? '' : ' aloud'}`}
    aria-pressed={active} aria-busy={mine && n.status === 'loading'} title={!supported ? 'Your browser does not support read aloud' : error}>
    {!supported || error ? <VolumeX aria-hidden="true" /> : mine && n.status === 'loading' ? <Loader2 aria-hidden="true" className="animate-spin" /> : active ? <Square aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
    {children}
    {error && <span className="sr-only" role="alert">{error}</span>}
  </button>;
}
