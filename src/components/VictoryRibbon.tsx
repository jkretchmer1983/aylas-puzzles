/** Cloth silhouette unfurls and waves; neutral stars, leaves and confetti frame it. */
export function VictoryRibbon() {
  return <svg className="victory-ribbon" viewBox="0 0 340 74" role="img" aria-label="Correct!">
    <defs>
      <linearGradient id="ribbon-cloth" x2="0" y2="1"><stop stopColor="#73b633"/><stop offset=".48" stopColor="#238323"/><stop offset="1" stopColor="#175d22"/></linearGradient>
      <linearGradient id="ribbon-fold"><stop stopColor="#103e1c"/><stop offset=".5" stopColor="#378731"/><stop offset="1" stopColor="#153e19"/></linearGradient>
    </defs>
    <g fill="url(#ribbon-fold)" stroke="#d0aa3d" strokeWidth="1.5"><path d="M13 25L62 19 62 64 12 61 28 43Z"/><path d="M327 25L278 19 278 64 328 61 312 43Z"/></g>
    <path d="M43 17Q109 6 170 17T297 17L297 57Q230 69 170 57T43 57Z" fill="url(#ribbon-cloth)" stroke="#e5c666" strokeWidth="2"/>
    <path d="M47 21Q110 11 170 21T293 21M47 53Q110 43 170 53T293 53" fill="none" stroke="#a9ce70" strokeWidth=".7" strokeDasharray="2 2"/>
    <text x="170" y="44" textAnchor="middle" fill="#fff8cc" stroke="#174520" strokeWidth=".6" paintOrder="stroke" fontSize="28" fontWeight="900">Correct!</text>
    <g strokeWidth="1" stroke="#dca432" fill="#ffda54"><path d="M27 5l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"/><path d="M313 3l2 5 6 1-4 4 1 6-5-3-5 3 1-6-4-4 6-1z"/></g>
    <g fill="#29a8dc"><path d="M5 37l8-4 4 7-8 4z"/><path d="M83 2l8 3-2 6-8-3z"/><path d="M245 67l8-4 3 6-8 4z"/></g>
    <g fill="#ee9a25"><path d="M319 47l7-4 4 6-7 4z"/><path d="M103 62l7 3-2 6-7-3z"/></g>
    <g fill="#47b78a"><path d="M262 6l8-3-2 8-8 2z"/><path d="M53 66q-16-13-19-4 7 12 19 4z"/><path d="M287 65q16-13 19-4-7 12-19 4z"/></g>
  </svg>;
}
