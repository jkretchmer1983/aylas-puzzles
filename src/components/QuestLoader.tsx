import { Puzzle } from 'lucide-react';
import { cn } from '@/lib/utils';
export function QuestLoader({done, inline=false, surface}: {done:boolean; inline?:boolean; surface?:string}) {
  return <div className={cn('quest-loader', inline && 'quest-loader-inline', done && 'quest-loader-done')} role="status" aria-label="Loading next puzzle" aria-hidden={done}>
    {!inline && surface && <img className="quest-loader-surface" src={surface} alt="" draggable={false} />}
    <div className="quest-loader-content">
      <div className="quest-loader-emblem" aria-hidden="true"><Puzzle strokeWidth={1.5} /></div>
      <p className="quest-loader-text">Your next puzzle</p>
      <p className="quest-loader-detail">A little wonder is on its way.</p>
      <div className="quest-loader-track" aria-hidden="true"><span /></div>
    </div>
  </div>;
}
