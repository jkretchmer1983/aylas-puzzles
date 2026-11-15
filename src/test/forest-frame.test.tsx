import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { StoryIllustrationFrame } from '@/gen/StoryIllustrationFrame';
afterEach(cleanup);
it('keeps a separate eight-slice frame above the mounted live illustration',()=>{
 const {container,rerender}=render(<StoryIllustrationFrame title="Story"><div className="scene-watercolor"><img src="/preview.jpg" alt="Live story"/></div></StoryIllustrationFrame>);
 const picture=screen.getByAltText('Live story');
 const overlay=container.querySelector('.story-branch-overlay');
 expect(overlay?.querySelectorAll('svg')).toHaveLength(8);
 expect(overlay?.querySelectorAll('image')).toHaveLength(8);
 expect(overlay?.getAttribute('aria-hidden')).toBe('true');
 expect(container.querySelector('.story-window-content')?.contains(overlay)).toBe(false);
 rerender(<StoryIllustrationFrame title="Finished story"><div className="scene-watercolor scene-watercolor-reveal"><img src="/final.jpg" alt="Live story"/></div></StoryIllustrationFrame>);
 expect(screen.getByAltText('Live story')).toBe(picture);
 expect(container.querySelector('.story-branch-overlay')).toBe(overlay);
 expect(screen.getByRole('heading')).toHaveTextContent('Finished story');
});
