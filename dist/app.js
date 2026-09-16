const defaults=[{name:'A little moment',duration:60},{name:'Find your rhythm',duration:180},{name:'Take your time',duration:300}];
let saved;try{saved=JSON.parse(localStorage.getItem('tap-presets'))}catch{};
const timers=defaults.map((d,i)=>{const s=saved?.[i];return {...(s&&typeof s.name==='string'&&Number.isInteger(s.duration)&&s.duration>0&&s.duration<=59999?{name:s.name.slice(0,24),duration:s.duration}:d),state:'ready',remaining:0,deadline:0}});
let sound=true,audio,editing=null;
try{sound=localStorage.getItem('tap-sound')!=='off'}catch{}
const $=s=>document.querySelector(s);
const pencil='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="m5 19 1-4L16 5l3 3L9 18l-4 1Z"/></svg>';
const checkmark='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
$('#timers').innerHTML=timers.map((_,i)=>`<section class="timer" data-state="ready"><div class="progress"></div><div class="tile-top"><span class="tile-label"><span class="number">0${i+1}</span><span class="name"></span></span><button class="edit" aria-label="Edit timer ${i+1}">${pencil}</button></div><button class="timer-main"><span class="time"></span><span class="state"><span class="play-icon" aria-hidden="true">▶</span><span class="action">Tap to start</span></span></button><form class="inline-editor" hidden aria-label="Edit timer ${i+1}"><div class="inline-time"><label class="inline-field"><input class="edit-minutes" aria-label="Minutes" inputmode="numeric" type="text" pattern="[0-9]{1,3}" maxlength="3" required autocomplete="off" enterkeyhint="done"></label><span aria-hidden="true">:</span><label class="inline-field"><input class="edit-seconds" aria-label="Seconds" inputmode="numeric" type="text" pattern="[0-9]{1,2}" maxlength="2" required autocomplete="off" enterkeyhint="done"></label></div></form><div class="tile-bottom"><span class="note">Your moment, on repeat.</span><button class="reset" hidden>Reset ↺</button></div></section>`).join('');
const tiles=[...document.querySelectorAll('.timer')];
function format(seconds){return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`}
function render(i){const t=timers[i],el=tiles[i],seconds=Math.ceil(t.state==='ready'?t.duration:t.remaining/1000);el.dataset.state=t.state;el.querySelector('.name').textContent=t.name;el.querySelector('.time').textContent=format(seconds);el.querySelector('.time').style.fontSize=seconds>=6000?'clamp(46px, 6.5vw, 110px)':'';const labels={ready:'Tap to start',running:'Tap to pause',paused:'Tap to resume',done:'Tap to go again'};el.querySelector('.action').textContent=labels[t.state];el.querySelector('.play-icon').textContent=t.state==='running'?'Ⅱ':t.state==='done'?'↻':'▶';el.querySelector('.timer-main').setAttribute('aria-label',`${t.name}, ${format(seconds)}. ${labels[t.state]}. Double tap to reset.`);el.querySelector('.edit').setAttribute('aria-label',`${editing===i?'Save':'Edit'} ${t.name}`);el.querySelector('.reset').hidden=t.state==='ready'||t.state==='done';el.querySelector('.note').textContent=t.state==='done'?"Time’s up. Ready for another?":t.state==='ready'?'Your moment, on repeat.':`${format(t.duration)} timer`;el.querySelector('.progress').style.width=`${t.state==='ready'?0:Math.max(0,Math.min(100,100*(1-t.remaining/(t.duration*1000))))}%`}
function unlockAudio(){try{audio??=new(window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume().catch(()=>{})}catch{}}
function ring(){if(!sound||!audio)return;try{[0,.22,.44].forEach((delay,i)=>{const oscillator=audio.createOscillator(),gain=audio.createGain(),at=audio.currentTime+delay;oscillator.type='sine';oscillator.frequency.value=[660,830,990][i];gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.22,at+.015);gain.gain.exponentialRampToValueAtTime(.001,at+.6);oscillator.connect(gain);gain.connect(audio.destination);oscillator.start(at);oscillator.stop(at+.65)})}catch{}}
function finish(i){const t=timers[i];t.state='done';t.remaining=0;ring();render(i);$('#announcements').textContent=`${t.name} finished. Tap to start again.`;t.resetTimeout=setTimeout(()=>{if(t.state==='done')reset(i)},1000);}
function tick(){timers.forEach((t,i)=>{if(t.state!=='running')return;t.remaining=Math.max(0,t.deadline-Date.now());if(!t.remaining)finish(i);else render(i)})}
function toggle(i){unlockAudio();tick();const t=timers[i];clearTimeout(t.resetTimeout);if(t.state==='running'){t.state='paused'}else{if(t.state!=='paused')t.remaining=t.duration*1000;t.deadline=Date.now()+t.remaining;t.state='running'}render(i)}
function reset(i){clearTimeout(timers[i].resetTimeout);timers[i].state='ready';timers[i].remaining=timers[i].duration*1000;render(i)}
function closeInlineEditor(i){
  const el=tiles[i];editing=null;delete el.dataset.editing;
  el.querySelector('.inline-editor').hidden=true;
  el.querySelector('.timer-main').hidden=false;
  el.querySelector('.edit').innerHTML=pencil;
  render(i);
}
function saveInlineEditor(i){
  const el=tiles[i],form=el.querySelector('.inline-editor');
  const minutes=el.querySelector('.edit-minutes'),seconds=el.querySelector('.edit-seconds');
  minutes.setCustomValidity('');seconds.setCustomValidity('');
  const m=Number(minutes.value),s=Number(seconds.value);
  if(!/^[0-9]{1,3}$/.test(minutes.value))minutes.setCustomValidity('Enter minutes from 0 to 999.');
  if(!/^[0-9]{1,2}$/.test(seconds.value)||s>59)seconds.setCustomValidity('Enter seconds from 0 to 59.');
  if(m===0&&s===0)seconds.setCustomValidity('Choose a duration of at least one second.');
  if(!form.reportValidity())return false;
  timers[i].duration=m*60+s;
  closeInlineEditor(i);reset(i);
  try{localStorage.setItem('tap-presets',JSON.stringify(timers.map(({name,duration})=>({name,duration}))))}catch{}
  el.querySelector('.edit').focus();
  return true;
}
function openInlineEditor(i){
  if(editing!==null&&!saveInlineEditor(editing))return;
  tick();const t=timers[i],el=tiles[i];
  if(t.state==='running')t.state='paused';
  clearTimeout(t.resetTimeout);
  editing=i;el.dataset.editing='true';
  el.querySelector('.timer-main').hidden=true;
  el.querySelector('.inline-editor').hidden=false;
  el.querySelector('.edit').innerHTML=checkmark;
  const minutes=el.querySelector('.edit-minutes'),seconds=el.querySelector('.edit-seconds');
  minutes.value=String(Math.floor(t.duration/60));seconds.value=String(t.duration%60).padStart(2,'0');
  [minutes,seconds].forEach(input=>{input.setCustomValidity('');input.style.width=`${Math.max(1,input.value.length)}ch`});
  render(i);minutes.focus();
}
tiles.forEach((el,i)=>{
  let lastTap=-Infinity;
  el.querySelector('.timer-main').addEventListener('click',e=>{
    const now=performance.now();
    if(e.detail!==0&&now-lastTap<320){reset(i);lastTap=-Infinity}
    else{toggle(i);lastTap=e.detail===0?-Infinity:now}
  });
  el.querySelector('.reset').addEventListener('click',()=>reset(i));
  el.querySelector('.edit').addEventListener('click',()=>{lastTap=-Infinity;if(editing===i)saveInlineEditor(i);else openInlineEditor(i)});
  el.querySelector('.inline-editor').addEventListener('submit',e=>{e.preventDefault();saveInlineEditor(i)});
  el.querySelectorAll('.inline-editor input').forEach(input=>{
    input.addEventListener('focus',()=>input.select());
    input.addEventListener('input',()=>{
      el.querySelectorAll('.inline-editor input').forEach(field=>field.setCustomValidity(''));
      input.style.width=`${Math.max(1,input.value.length)}ch`;
    });
    input.addEventListener('keydown',e=>{
      if(e.key==='Escape'){e.preventDefault();closeInlineEditor(i);if(timers[i].state==='done')reset(i);el.querySelector('.edit').focus()}
      if(e.key==='Enter'){e.preventDefault();saveInlineEditor(i)}
    });
  });
  render(i);
});
// Commit only from the pane being edited. Other panes keep their controls.
function isEditPaneBackground(target){
  return editing!==null&&tiles[editing].contains(target)&&!target.closest('.inline-field');
}
function commitPaneTap(event){
  event.preventDefault();
  event.stopImmediatePropagation();
  saveInlineEditor(editing);
}
document.addEventListener('click',event=>{
  if(isEditPaneBackground(event.target))commitPaneTap(event);
},true);
// iOS may not synthesize clicks on the blank area of a form. Handle the
// completed touch directly and cancel its synthetic click before changing DOM.
let editTouchStart=null;
document.addEventListener('touchstart',event=>{
  editTouchStart=event.touches.length===1?{x:event.touches[0].clientX,y:event.touches[0].clientY}:null;
},{capture:true,passive:true});
document.addEventListener('touchend',event=>{
  const start=editTouchStart;editTouchStart=null;
  if(!start||event.changedTouches.length!==1||!isEditPaneBackground(event.target))return;
  const touch=event.changedTouches[0];
  if(Math.hypot(touch.clientX-start.x,touch.clientY-start.y)>12)return;
  commitPaneTap(event);
},{capture:true,passive:false});
document.addEventListener('touchcancel',()=>{editTouchStart=null},{passive:true});
function updateSound(){$('#sound').innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 5 7 9H4v6h3l5 4Z"/>${sound?'<path d="M17 9a5 5 0 0 1 0 6"/>':'<path d="m17 10 4 4m0-4-4 4"/>'}</svg>`;$('#sound').setAttribute('aria-pressed',String(sound));$('#sound').setAttribute('aria-label',`Sound ${sound?'on':'off'}`)}
$('#sound').onclick=()=>{sound=!sound;unlockAudio();updateSound();try{localStorage.setItem('tap-sound',sound?'on':'off')}catch{}};updateSound();
document.addEventListener('keydown',e=>{if(editing!==null||e.repeat||e.ctrlKey||e.metaKey||e.altKey||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;if(/^[123]$/.test(e.key)){e.preventDefault();toggle(Number(e.key)-1)}});
setInterval(tick,100);document.addEventListener('visibilitychange',tick);
if(document.modelContext?.registerTool){try{Promise.resolve(document.modelContext.registerTool({name:'control_timer',description:'Start, pause, resume or reset one of the three repeat timers.',inputSchema:{type:'object',properties:{timer:{type:'integer',minimum:1,maximum:3},action:{type:'string',enum:['start','pause','resume','reset']}},required:['timer','action'],additionalProperties:false},annotations:{readOnlyHint:false},execute:({timer,action})=>{if(!Number.isInteger(timer)||timer<1||timer>3||!['start','pause','resume','reset'].includes(action))throw Error('Invalid timer or action');const i=timer-1,t=timers[i];if(editing===i)throw Error('Finish editing this timer first');tick();if(action==='reset')reset(i);else if(action==='start'){reset(i);toggle(i)}else if((action==='pause'&&t.state==='running')||(action==='resume'&&t.state==='paused'))toggle(i);else throw Error('Action does not match timer state');return {timer,state:t.state,remainingSeconds:Math.ceil(t.remaining/1000)}}})).catch(()=>{})}catch{}}

// Localhost is a secure context; hosted installations require HTTPS.
if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(error => console.warn('Offline setup failed:', error));
  });
}

// Preserve focus indicators for keyboard use, without rings after touch taps.
document.addEventListener('pointerdown', event => {
  if (event.pointerType === 'touch') document.documentElement.setAttribute('data-touch-input', '');
  else document.documentElement.removeAttribute('data-touch-input');
}, true);
document.addEventListener('keydown', () => document.documentElement.removeAttribute('data-touch-input'), true);
