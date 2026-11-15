import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { QuestLoader } from '@/components/QuestLoader';
import { StoryIllustrationFrame } from '@/gen/StoryIllustrationFrame';
afterEach(cleanup);
it('keeps the inline loader inside the image opening and below the separate frame',()=>{
 const {container,rerender}=render(<StoryIllustrationFrame title="Story"><QuestLoader done={false} inline /></StoryIllustrationFrame>);
 const loader=screen.getByRole('status',{name:'Loading next puzzle'});
 expect(loader.closest('.story-window-content')).not.toBeNull();
 expect(loader).toHaveClass('quest-loader-inline');
 expect(loader.querySelector('.quest-loader-surface')).toBeNull();
 expect(container.querySelector('.story-branch-overlay')?.contains(loader)).toBe(false);
 rerender(<StoryIllustrationFrame title="Story"><QuestLoader done inline /></StoryIllustrationFrame>);
 expect(screen.queryByRole('status',{name:'Loading next puzzle'})).toBeNull();
 expect(loader).toHaveClass('quest-loader-done');
});
it('retains the existing surface loader for other games',()=>{
 const {container}=render(<QuestLoader done={false} surface="/tree.jpg"/>);
 expect(container.querySelector('img')).toHaveAttribute('src','/tree.jpg');
 expect(screen.getByRole('status')).not.toHaveClass('quest-loader-inline');
});
