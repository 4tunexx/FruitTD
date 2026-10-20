/** A revealed briefing stays revealed when settings arrive or the title reopens. */
export class TitleStory {
  private timer:ReturnType<typeof setTimeout>|null=null;
  private generation=0;
  private text='';
  private revealed=false;
  constructor(private readonly render:(text:string,typing:boolean,ready:boolean)=>void,
    private readonly schedule:(callback:()=>void)=>ReturnType<typeof setTimeout>=callback=>setTimeout(callback,12),
    private readonly cancel:(timer:ReturnType<typeof setTimeout>)=>void=timer=>clearTimeout(timer)) {}
  get ready():boolean{return this.revealed;}
  play(text:string,reducedMotion=false):void {
    if(this.timer!==null&&text===this.text&&!reducedMotion)return;
    this.stop();this.text=text;
    if(this.revealed||reducedMotion||!text){this.reveal();return;}
    const generation=this.generation;let index=0;
    const tick=()=>{
      if(generation!==this.generation)return;
      index++;
      if(index>=text.length){this.reveal();return;}
      this.render(text.slice(0,index),true,false);this.timer=this.schedule(tick);
    };
    tick();
  }
  reveal():void {this.stop();this.revealed=true;this.render(this.text,false,true);}
  stop():void {this.generation++;if(this.timer!==null)this.cancel(this.timer);this.timer=null;}
}
