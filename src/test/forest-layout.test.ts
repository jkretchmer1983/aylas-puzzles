import { describe, expect, it } from 'vitest';
import { fitForestLayout } from '@/lib/forest-layout';
describe('forest responsive composition',()=>{
 it('retains the approved regular phone canvas',()=>{
  expect(fitForestLayout(393,852)).toEqual({mode:'phone',width:393,height:852,scale:1});
 });
 it.each([[430,700],[600,900],[768,1024],[820,1180],[1024,1366]])('uses a broad canvas at %s by %s without stretching', (width,height)=>{
  const layout=fitForestLayout(width,height);
  expect(layout.mode).toBe('portrait-wide');
  expect(layout.width*layout.scale).toBeLessThanOrEqual(width);
  expect(layout.height*layout.scale).toBeLessThanOrEqual(height);
  expect(layout.width*layout.scale).toBeGreaterThan(width*.9);
 });
 it.each([[1180,820],[1024,768],[1366,1024],[852,393],[900,600]])('uses two columns in landscape at %s by %s', (width,height)=>{
  const layout=fitForestLayout(width,height);
  expect(layout.mode).toBe('landscape');
  expect(layout.width*layout.scale).toBeLessThanOrEqual(width);
  expect(layout.height*layout.scale).toBeLessThanOrEqual(height);
 });
 it('returns to the phone composition in a narrow tablet split view',()=>{
  expect(fitForestLayout(375,1024).mode).toBe('phone');
 });
});
