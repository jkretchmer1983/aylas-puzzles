import { useEffect, useState, useSyncExternalStore } from 'react';
import { Loader2, Square, Volume2, VolumeX } from 'lucide-react';
import { getNarration, narrationPayload, narrationSupported, registerReader, speak, stopNarration, subscribeNarration } from '@/lib/audio/narrator';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const IDLE = { id: null, status: 'idle' as const };
const server = () => IDLE;
export type ReadAloudContent = { title?: string; story?: string; task?: string };
/**
 * Speaker control. Story and instructions speakers for the same puzzle share `group` and
 * content, so either one reads the SAME combined payload (story, then instructions);
 * tapping again stops it. Errors are shown right beside the button.
 */
export function ReadAloud({ group, content, label = 'story and instructions', children, className }: { group: string; content: ReadAloudContent; label?: string; children?: React.ReactNode; className?: string }) {
  const id = `read:${group}`;
  const text = narrationPayload(content);
  const [supported, setSupported] = useState(false);
  const n = useSyncExternalStore(subscribeNarration, getNarration, server);
  useEffect(() => { setSupported(narrationSupported()); }, []);
  // Stops only when no mounted speaker still shows the text being read (e.g. story panel closing keeps reading via the task speaker).
  useEffect(() => registerReader(id, text), [id, text]);
  const mine = n.id === id;
  const active = mine && (n.status === 'speaking' || n.status === 'loading');
  const error = mine && n.status === 'error' ? n.error : undefined;
  const note = mine && !error && active ? n.note : undefined;
  const toggle = () => { if (active) stopNarration(); else speak(id, text); };
  return <span className="read-aloud-wrap">
    <Button variant="game" size="game" type="button" className={cn(className ? 'read-aloud' : 'forest-read-aloud', className)} onClick={toggle} data-audio-ignore data-read-payload={text}
      aria-label={!supported ? 'Read aloud unavailable on this device' : `${active ? 'Stop reading' : 'Read'} ${label}${active ? '' : ' aloud'}`}
      aria-pressed={active} aria-busy={mine && n.status === 'loading'} title={!supported ? 'Your browser does not support read aloud' : error}>
      {!supported || error ? <VolumeX aria-hidden="true" /> : mine && n.status === 'loading' ? <Loader2 aria-hidden="true" className="animate-spin" /> : active ? <Square aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
      {children}
    </Button>
    {error && <span className="read-aloud-error" role="alert">{error}</span>}
    {note && <span className="read-aloud-error read-aloud-note" role="status">{note}</span>}
  </span>;
}
