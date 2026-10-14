/** Serialize paste commits while allowing only our own earlier commits to advance a queued intent. */
export class ClipboardQueue {
  private tail:Promise<unknown>=Promise.resolve();
  private pending=0;
  private expected='';
  private inputs=new Set<string>();
  run(captured:string,context:()=>string,action:(current:string)=>Promise<string>):Promise<void>{
    if(!this.pending){this.inputs.clear();this.expected='';}
    this.pending++;
    const task=this.tail.then(async()=>{
      const current=context();
      if(current!==captured&&(current!==this.expected||!this.inputs.has(captured)))throw new Error('The document changed. Paste again at the intended location.');
      if(current===captured&&current!==this.expected)this.inputs.clear();
      const after=await action(current);this.inputs.add(captured);this.inputs.add(current);this.expected=after;
    });
    const result=task.finally(()=>{if(!--this.pending){this.inputs.clear();this.expected='';}});
    this.tail=result.catch(()=>{});return result;
  }
}
