import { createFileRoute } from '@tanstack/react-router';
import { TakePreview } from '../take-preview/TakePreview';
import previewCss from '../take-preview/take-preview.css?url';

export const Route = createFileRoute('/take-preview')({
  head: () => ({ meta: [{ title: 'Taking Away · Interaction preview' }], links: [{ rel: 'stylesheet', href: previewCss }] }),
  component: TakePreview,
});
