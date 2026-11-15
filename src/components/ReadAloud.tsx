import { useEffect, useRef, useState } from 'react';
import { Volume2, Square } from 'lucide-react';

/** One shared browser voice, started only by an explicit tap. No provider keys needed. */
export function ReadAloud({ text, label = 'instructions', children }: { text: string; label?: string; children?: React.ReactNode }) {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);
  useEffect(() => {
    setSupported(!!window.speechSynthesis && typeof window.SpeechSynthesisUtterance === 'function');
    return () => {
      if (utterance.current) { window.speechSynthesis?.cancel(); utterance.current = null; }
    };
  }, [text]);
  const toggle = () => {
    if (!supported) return;
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return; }
    window.dispatchEvent(new Event('forest-speech-stop'));
    window.speechSynthesis.cancel();
    const speech = new SpeechSynthesisUtterance(text);
    speech.rate = .88;
    speech.lang = 'en-US';
    speech.onend = speech.onerror = () => { utterance.current = null; setSpeaking(false); };
    utterance.current = speech;
    setSpeaking(true);
    window.speechSynthesis.speak(speech);
  };
  useEffect(() => {
    const stop = () => setSpeaking(false);
    window.addEventListener('forest-speech-stop', stop);
    return () => window.removeEventListener('forest-speech-stop', stop);
  }, []);
  return <button type="button" className="forest-read-aloud" onClick={toggle} disabled={!supported}
    aria-label={!supported ? 'Read aloud unavailable on this device' : `${speaking ? 'Stop reading' : 'Read'} ${label}${speaking ? '' : ' aloud'}`}
    aria-pressed={speaking} title={!supported ? 'Your browser does not support read aloud' : undefined}>
    {speaking ? <Square aria-hidden="true" /> : <Volume2 aria-hidden="true" />}{children}
  </button>;
}
