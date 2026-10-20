export function combatHudSlots(profileBottom:number,statusHeight:number,bossHeight:number,compact=false,noticeHeight=0) {
  const statusTop=compact?10:Math.ceil(profileBottom)+8;
  const juiceTop=Math.max(profileBottom,statusTop+statusHeight)+10;
  const bossTop=juiceTop+18;
  const toastTop=bossTop+(bossHeight>0?bossHeight+8:0);
  return {statusTop,juiceTop,bossTop,toastTop,toastHostTop:toastTop+(noticeHeight>0?noticeHeight+8:0)};
}

/** Measured HUD slots share one owner; no inline position overrides compete with CSS. */
export function installCombatHudLayout():void {
  const hud=document.getElementById('hud'),profile=document.getElementById('player-chip');
  const status=document.getElementById('battle-status'),boss=document.getElementById('boss-health'),notice=document.getElementById('hud-toast');
  if(!hud||!profile||!status)return;
  const toggle=document.createElement('button');
  toggle.type='button';toggle.id='combat-status-toggle';toggle.textContent='Hide info';
  toggle.setAttribute('aria-controls','battle-status');toggle.setAttribute('aria-expanded','true');
  hud.appendChild(toggle);
  toggle.addEventListener('click',()=>{
    const collapsed=status.classList.toggle('is-collapsed');
    toggle.textContent=collapsed?'Show info':'Hide info';
    toggle.setAttribute('aria-expanded',String(!collapsed));
  });
  const align=()=>{
    const origin=hud.getBoundingClientRect().top;
    const slots=combatHudSlots(profile.getBoundingClientRect().bottom-origin,status.getBoundingClientRect().height,
      boss?.getBoundingClientRect().height??0,window.innerHeight<=520&&window.innerWidth>=640,notice?.getBoundingClientRect().height??0);
    for(const [name,value] of Object.entries(slots)){
      hud.style.setProperty(`--combat-${name}`,`${value}px`);
      document.documentElement.style.setProperty(`--combat-${name}`,`${value}px`);
    }
  };
  const observer=new ResizeObserver(align);
  for(const element of [profile,status,boss,notice])if(element)observer.observe(element);
  window.addEventListener('resize',align,{passive:true});align();
}
