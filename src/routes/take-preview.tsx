import { createFileRoute } from '@tanstack/react-router';
import { TakePreview } from '../take-preview/TakePreview';
import previewCss from '../take-preview/take-preview.css?url';

export const Route = createFileRoute('/take-preview')({
  head: () => ({ meta: [
    { title: 'Taking Away · Ayla’s Puzzles Interaction Preview' },
    { name: 'description', content: 'Ayla’s Puzzles Taking Away balloon interaction preview for ages 4–5.' },
    { property: 'og:title', content: 'Taking Away · Ayla’s Puzzles Interaction Preview' },
    { property: 'og:description', content: 'Review the Taking Away balloon interaction for ages 4–5.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary' },
  ], links: [{ rel: 'stylesheet', href: previewCss }, ...['landscape','balloon','anchor','explorer','explorer-cheer','windsock','banner','suitcase'].map(name=>({rel:'preload',as:'image',href:`/take-airfield/${name}.webp`}))] }),
  component: TakePreview,
});
