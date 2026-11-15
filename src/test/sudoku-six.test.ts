import {expect,it} from 'vitest';
import {generate} from '@/gen/templates';
import {countSixSolutions} from '@/gen/sudoku-six';
it('switches to 36 squares at ages 8–9, with unique answers and valid boxes',()=>{
 expect(generate('sudoku',4,42).kind.type==='sudoku'&&generate('sudoku',4,42).kind).toHaveProperty('given.length',16);
 for(const band of [5,6])for(let seed=1;seed<=20;seed++){
  const k=generate('sudoku',band,seed).kind;if(k.type!=='sudoku')throw Error('Sudoku expected');
  expect(k.given).toHaveLength(36);expect(k.symbols).toHaveLength(6);expect(countSixSolutions(k.given)).toBe(1);
  for(let row=0;row<6;row+=2)for(let col=0;col<6;col+=3){const box=[];for(let r=row;r<row+2;r++)for(let c=col;c<col+3;c++)box.push(k.solution[r*6+c]);expect(new Set(box).size).toBe(6);}
 }
});
