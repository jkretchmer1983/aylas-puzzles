/** Visual placeholder only. No score or earned progress is implied yet. */
export function ScorePlaceholder({className='forest-score'}:{className?:string}) {
  return <div className={`${className} score-placeholder`} role="img" aria-label="Score preview — scoring system coming soon" title="Scoring coming soon">
    <span className="score-placeholder-label" aria-hidden="true">Score</span>
    <span className="score-placeholder-track" aria-hidden="true"><span className="score-placeholder-fill" /></span>
  </div>;
}
