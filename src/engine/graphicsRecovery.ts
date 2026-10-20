/** Keep a solo match paused while the browser recreates its graphics context. */
export class GraphicsRecovery {
  lost = false;
  private onLost = (event:Event) => {
    event.preventDefault();
    if (this.lost) return;
    this.lost = true;
    this.callbacks.lost();
  };
  private onRestored = () => {
    if (!this.lost) return;
    this.lost = false;
    this.callbacks.restored();
  };
  constructor(private target:EventTarget,private callbacks:{lost:()=>void;restored:()=>void}) {
    target.addEventListener('webglcontextlost',this.onLost);
    target.addEventListener('webglcontextrestored',this.onRestored);
  }
  dispose():void {
    this.target.removeEventListener('webglcontextlost',this.onLost);
    this.target.removeEventListener('webglcontextrestored',this.onRestored);
  }
}
