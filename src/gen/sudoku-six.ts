import type { Rng } from './rng';
/** Stop at two: generation needs to distinguish a unique answer from ambiguity. */
export function countSixSolutions(input:(number|null)[]):number {
 const cells=[...input];
 function solve():number {
  let best=-1,options:number[]=[];
  for(let i=0;i<36;i++) if(cells[i]===null){
   const row=Math.floor(i/6),col=i%6;
   const choices=[0,1,2,3,4,5].filter(v=>!cells.some((x,j)=>x===v&&(Math.floor(j/6)===row||j%6===col||(Math.floor(Math.floor(j/6)/2)===Math.floor(row/2)&&Math.floor((j%6)/3)===Math.floor(col/3)))));
   if(!choices.length)return 0;
   if(best<0||choices.length<options.length){best=i;options=choices;}
  }
  if(best<0)return 1;
  let count=0;
  for(const v of options){cells[best]=v;count+=solve();if(count>=2)break;}
  cells[best]=null;return Math.min(count,2);
 }
 return solve();
}
export function makeSixSudoku(r:Rng,holes:number){
 const digits=r.shuffle([0,1,2,3,4,5]);
 const rows=r.shuffle([0,1,2]).flatMap(group=>r.shuffle([group*2,group*2+1]));
 const cols=r.shuffle([0,1]).flatMap(group=>r.shuffle([group*3,group*3+1,group*3+2]));
 const solution=rows.flatMap(row=>cols.map(col=>digits[(row*3+Math.floor(row/2)+col)%6]!));
 const given:(number|null)[]=[...solution];let removed=0;
 for(const i of r.shuffle([...Array(36).keys()])){const value=given[i]!;given[i]=null;if(countSixSolutions(given)!==1)given[i]=value;else removed++;if(removed>=holes)break;}
 return {type:'sudoku' as const,symbols:['1','2','3','4','5','6'],given,solution};
}
