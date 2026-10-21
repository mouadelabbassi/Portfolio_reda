import graph from '../data/graph.json';
import { runQuery, getSuggestions } from './query.js';

const $ = id => document.getElementById(id);
const nodes = graph.nodes.filter(n => n.status === 'verified');
const byId = new Map(nodes.map(n => [n.id,n]));
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
let reducedMotion = motionPreference.matches, scene, selectedId = null, classic = false, touring = false, tourStep = -1;
let traceFrame = 0, bootFrame = 0, bootDone = false, terminalOpener = null, activeCluster = null;
let lastMetrics = {}, engineering = false, salam = false;
const initialFocus = $('start-tour');
const make = (tag, className, text) => { const el = document.createElement(tag); if(className) el.className = className; if(text != null) el.textContent = text; return el; };
const relationNodes = id => graph.edges.filter(e => e.source === id || e.target === id).map(e => ({node:byId.get(e.source === id ? e.target : e.source),edge:e})).filter(x => x.node).sort((a,b) => b.edge.weight-a.edge.weight);
const safeURL = url => /^(https:\/\/|mailto:|tel:|\/(?!\/))/.test(url || '');

$('identity-name').textContent = graph.profile.name.toUpperCase();
$('intro-name').textContent = graph.profile.name;
$('intro-role').textContent = graph.profile.headline;
$('intro').querySelector('.intro-copy').textContent = `${graph.profile.summary.split('.')[0]}.`;
$('gateway-name').textContent = graph.profile.name.toUpperCase();
$('network-count').textContent = `${nodes.length} NODES / ${graph.edges.length} LINKS`;
document.documentElement.classList.add('enhanced');
$('app').hidden = false;
$('classic').setAttribute('aria-hidden','true');
$('intro').querySelector('.eyebrow').lastChild.textContent = ` ${byId.get(graph.profile.personNodeId)?.details.dateLabel?.toUpperCase() || ''}`;

function drawTrace(time = 0) {
  const canvas = $('trace'), ctx = canvas.getContext('2d');
  if (!ctx || $('detail').hidden || classic) return;
  const w=canvas.width,h=canvas.height,t=reducedMotion?0:time/1000;
  ctx.clearRect(0,0,w,h);ctx.strokeStyle='#21312e';ctx.lineWidth=1;
  for(let x=0;x<w;x+=26){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}
  for(let y=0;y<h;y+=22){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
  const kind=byId.get(selectedId)?.details.visualization || 'waveform';
  const wave=x=>kind==='can-frames'? ((Math.sin((x+t*36)/9)>0?1:-1)*22) : kind==='power-curve' ? 24-50*(x/w)+Math.sin(x/44+t)*5 : kind==='sensor-stream' ? Math.sin(x/31+t*2)*15+Math.sin(x/8-t)*4 : Math.sin(x/22-t*3)*17+Math.sin(x/9+t)*5;
  ctx.beginPath();for(let x=0;x<w;x++){const y=h/2+wave(x);x?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.strokeStyle='#c7f578';ctx.lineWidth=1.8;ctx.shadowColor='#b8ed6a';ctx.shadowBlur=8;ctx.stroke();ctx.shadowBlur=0;
  if(!reducedMotion && !document.hidden) traceFrame=requestAnimationFrame(drawTrace);
}
function restartTrace(){cancelAnimationFrame(traceFrame);drawTrace(performance.now());}

function renderDetails(id, keyboard=false) {
  const node=byId.get(id); if(!node) return;
  selectedId=id; $('detail').hidden=false;document.body.classList.add('detail-open');
  $('detail-type').textContent=`${node.type} / ${String(nodes.indexOf(node)+1).padStart(2,'0')}`;
  $('detail-meta').textContent=[node.details.organization,node.details.dateLabel].filter(Boolean).join(' · ');
  $('detail-name').textContent=node.name;$('detail-summary').textContent=node.details.summary || '';
  $('detail-body').replaceChildren();
  for(const [key,label] of [['problem','Problem'],['role','My contribution'],['outcome','Outcome']]){
    if(!node.details[key])continue;const field=make('div','detail-field');field.append(make('h3','',label),make('p','',node.details[key]));$('detail-body').append(field);
  }
  $('detail-stack').replaceChildren(...(node.details.stackNodeIds||[]).map(id=>make('span','',byId.get(id)?.name||id)));
  const links=[...(node.details.links||[])];
  if(node.type==='Person'||node.type==='Contact'){
    for(const contact of nodes.filter(n=>n.type==='Contact'))for(const l of contact.details.links||[])if(!links.some(x=>x.url===l.url))links.push(l);
    if(graph.profile.cvDownloadUrl) links.push({label:'Download CV',url:graph.profile.cvDownloadUrl});
  }
  $('detail-links').replaceChildren(...links.filter(l=>safeURL(l.url)).map(l=>{const a=make('a','',`${l.label} ↗`);a.href=l.url;if(l.url.startsWith('https:')){a.target='_blank';a.rel='noopener noreferrer';}if(l.url===graph.profile.cvDownloadUrl)a.download='';return a;}));
  const related=relationNodes(id);const unique=[...new Map(related.map(r=>[r.node.id,r])).values()];
  $('related-count').textContent=unique.length;
  $('related').replaceChildren(...unique.slice(0,6).map(({node,edge})=>{const b=make('button','related-row',node.name);b.style.setProperty('--weight',`${edge.weight*25}px`);b.append(make('span','',node.type));b.onclick=()=>selectNode(node.id,true);return b;}));
  restartTrace();
  if(keyboard)$('detail-name').focus({preventScroll:true});
}
function selectNode(id, keyboard=false){scene?.selectNode(id);scene?.focusNodes([id]);renderDetails(id,keyboard);}
function closeDetails(restoreFocus=false){selectedId=null;$('detail').hidden=true;$('detail-anchor').setAttribute('hidden','');document.body.classList.remove('detail-open');cancelAnimationFrame(traceFrame);scene?.selectNode(null);if(!touring)scene?.focusNodes([graph.profile.personNodeId]);if(restoreFocus)$('open-index').focus({preventScroll:true});}
function renderAnchor({id,x,y,width,height,depth}){
  const svg=$('detail-anchor');if($('detail').hidden||classic||id!==selectedId||depth>1||depth< -1){svg.setAttribute('hidden','');return;}svg.removeAttribute('hidden');svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
  const stage=$('cockpit').getBoundingClientRect(),card=$('detail').getBoundingClientRect();
  const endX=card.left-stage.left+(width<760?20:0),endY=card.top-stage.top+(width<760?0:72);
  $('anchor-path').setAttribute('d',width<760?`M ${x} ${y} L ${x} ${endY-18} L ${endX} ${endY-18} L ${endX} ${endY}`:`M ${x} ${y} L ${endX-25} ${y} L ${endX-25} ${endY} L ${endX} ${endY}`);
  $('anchor-point').setAttribute('cx',x);$('anchor-point').setAttribute('cy',y);
}
$('close-detail').onclick=()=>{closeDetails();$('open-index').focus({preventScroll:true});};
$('about-button').onclick=()=>{if(classic){$('classic').scrollIntoView({behavior:reducedMotion?'instant':'smooth'});}else selectNode(graph.profile.personNodeId,true);};
$('contact-button').onclick=()=>{if(classic){$('classic-contact')?.scrollIntoView({behavior:reducedMotion?'instant':'smooth'});}else{selectNode(nodes.find(n=>n.type==='Contact')?.id || graph.profile.personNodeId,true);}};
$('home').onclick=e=>{e.preventDefault();if(touring)endTour();closeDetails();scene?.highlight(null);activeCluster=null;document.querySelectorAll('.domain-row').forEach(b=>b.classList.remove('active'));if(classic)window.scrollTo({top:0,behavior:reducedMotion?'instant':'smooth'});};

for(const cluster of graph.clusters){const count=nodes.filter(n=>n.clusterId===cluster.id).length;const b=make('button','domain-row',cluster.name);b.style.setProperty('--cluster',cluster.color);b.append(make('span','',String(count).padStart(2,'0')));b.onclick=()=>{if(touring)endTour();activeCluster=activeCluster===cluster.id?null:cluster.id;const ids=activeCluster?nodes.filter(n=>n.clusterId===cluster.id).map(n=>n.id):null;scene?.highlight(ids);if(ids?.length)scene?.focusNodes(ids);else scene?.focusNodes([graph.profile.personNodeId]);document.querySelectorAll('.domain-row').forEach(x=>x.classList.toggle('active',x===b&&!!activeCluster));};$('domains').append(b);}
$('show-all').onclick=()=>{scene?.highlight(null);scene?.focusNodes([graph.profile.personNodeId]);activeCluster=null;document.querySelectorAll('.domain-row').forEach(b=>b.classList.remove('active'));};
for(const button of document.querySelectorAll('[data-layout]'))button.onclick=()=>{const layout=button.dataset.layout;scene?.setLayout(layout);document.querySelectorAll('[data-layout]').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});};

function setClassic(enabled,reason=''){
  if(touring)endTour();classic=enabled;document.documentElement.classList.toggle('classic',enabled);$('classic').setAttribute('aria-hidden',String(!enabled));
  $('classic-button').setAttribute('aria-pressed',String(enabled));$('classic-button').textContent=enabled?'↗ Network view':'▤ Classic view';
  scene?.resume?.(!enabled);if(enabled){cancelAnimationFrame(traceFrame);finishBoot();$('terminal').hidden=true;$('node-index').hidden=true;window.scrollTo(0,0);}else{window.scrollTo(0,0);restartTrace();}
  if(reason){$('classic').prepend(make('p','fallback-note',reason));}
}
$('classic-button').onclick=()=>setClassic(!classic);
document.querySelector('.skip-link').addEventListener('click',e=>{e.preventDefault();setClassic(true);$('classic').setAttribute('tabindex','-1');$('classic').focus({preventScroll:true});});
motionPreference.addEventListener('change',e=>setMotion(e.matches));
function setMotion(value){reducedMotion=value;$('motion-button').textContent=value?'Motion paused':'Motion on';$('motion-button').setAttribute('aria-pressed',String(value));scene?.setReducedMotion(value);if(value)finishBoot();restartTrace();}
$('motion-button').onclick=()=>setMotion(!reducedMotion);setMotion(reducedMotion);

const suggestions=getSuggestions(graph);
for(const suggestion of suggestions){const b=make('button','',suggestion.label);b.onclick=()=>executeQuery(suggestion.query);$('suggestions').append(b);const option=make('option');option.value=suggestion.query;$('query-completions').append(option);}
for(const node of nodes){const option=make('option');option.value=node.name;$('query-completions').append(option);}
function openTerminal(){if(classic)return;terminalOpener=document.activeElement;$('terminal').hidden=false;$('node-index').hidden=true;$('query').focus();}
function closeTerminal(){ $('terminal').hidden=true;terminalOpener?.focus?.({preventScroll:true}); }
$('open-terminal').onclick=openTerminal;$('close-terminal').onclick=closeTerminal;
$('query-form').onsubmit=e=>{e.preventDefault();executeQuery($('query').value);};
function executeQuery(input){
  $('query').value=input;
  if(input.trim().toLowerCase()==='salam'){
    salam=!salam;$('query-result').textContent=salam?'Salam! Merhba bik — welcome to my network.':'Standard signal restored.';
    $('intro').querySelector('h1').replaceChildren();const h=$('intro').querySelector('h1');h.append(document.createTextNode(salam?'Salam.':'From circuit.'),document.createElement('br'),make('em','',salam?'Merhba bik.':'To system.'));return;
  }
  const result=runQuery(input,graph);$('query-result').textContent=result.message;$('query-matches').replaceChildren();
  if(result.error)return;
  scene?.highlight(result.ids);
  if(result.ids.length)scene?.focusNodes(result.ids);
  for(const id of result.ids){const node=byId.get(id);if(!node)continue;const b=make('button','',node.name);b.onclick=()=>{closeTerminal();selectNode(id,true);};$('query-matches').append(b);}
}

function renderIndex(){const needle=$('index-search').value.toLowerCase();const filtered=nodes.filter(n=>`${n.name} ${n.type} ${n.details.summary||''}`.toLowerCase().includes(needle));$('index-list').replaceChildren(...filtered.map(node=>{const b=make('button','index-row',node.name);b.append(make('span','',node.type));b.onclick=()=>{$('node-index').hidden=true;selectNode(node.id,true);};return b;}));}
$('open-index').onclick=()=>{$('node-index').hidden=false;$('terminal').hidden=true;renderIndex();$('index-search').focus();};$('close-index').onclick=()=>{$('node-index').hidden=true;$('open-index').focus();};$('index-search').oninput=renderIndex;
$('index-list').addEventListener('keydown',e=>{if(!['ArrowDown','ArrowUp','Home','End'].includes(e.key))return;const buttons=[...$('index-list').querySelectorAll('button')];if(!buttons.length)return;e.preventDefault();const i=buttons.indexOf(document.activeElement);const next=e.key==='Home'?0:e.key==='End'?buttons.length-1:(i+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;buttons[next].focus();});

const tour=graph.tour.filter(stop=>stop.nodeIds.some(id=>byId.has(id)));
tour.forEach((stop,i)=>{const b=make('button');b.setAttribute('aria-label',`Go to ${stop.title}`);b.onclick=()=>goToStep(i);$('tour-dots').append(b);});
function activateStep(i){
  if(i===tourStep||!tour[i])return;tourStep=i;const stop=tour[i];$('tour-position').textContent=`${String(i+1).padStart(2,'0')} / ${String(tour.length).padStart(2,'0')}`;$('tour-title').textContent=stop.title;
  const primary=byId.get(stop.nodeIds[0]);$('tour-description').textContent=stop.description || primary?.details.summary || '';
  $('tour-dots').querySelectorAll('button').forEach((b,j)=>b.classList.toggle('active',j===i));$('tour-prev').disabled=i===0;$('tour-next').disabled=i===tour.length-1;
  scene?.highlight(stop.nodeIds);scene?.focusNodes(stop.nodeIds);scene?.selectNode(stop.nodeIds[0]);
  if(i>0&&primary&&innerWidth>760)renderDetails(primary.id);else closeDetails();
}
function goToStep(i){const n=Math.max(0,Math.min(tour.length-1,i));activateStep(n);window.scrollTo({top:n*innerHeight,behavior:reducedMotion?'instant':'smooth'});}
function startTour(){if(!tour.length)return;touring=true;tourStep=-1;closeDetails();$('terminal').hidden=true;$('intro').hidden=true;$('tour-panel').hidden=false;$('tour-hint').hidden=false;document.body.classList.add('touring');$('tour-track').style.height=`${tour.length*100}vh`;scene?.setTour(true);activateStep(0);window.scrollTo(0,0);$('tour-title').setAttribute('tabindex','-1');$('tour-title').focus({preventScroll:true});}
function endTour(){touring=false;document.body.classList.remove('touring');$('tour-track').style.height='0';$('tour-panel').hidden=true;$('tour-hint').hidden=true;$('intro').hidden=false;scene?.setTour(false);scene?.highlight(null);closeDetails();window.scrollTo(0,0);$('start-tour').focus({preventScroll:true});}
$('start-tour').onclick=startTour;$('exit-tour').onclick=endTour;$('tour-prev').onclick=()=>goToStep(tourStep-1);$('tour-next').onclick=()=>goToStep(tourStep+1);
addEventListener('scroll',()=>{if(touring)activateStep(Math.min(tour.length-1,Math.floor((scrollY+innerHeight*.25)/innerHeight)));},{passive:true});

const konami=['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];let konamiIndex=0;
addEventListener('keydown',e=>{
  const typing=/INPUT|TEXTAREA|SELECT/.test(e.target.tagName);
  if(e.key==='Escape'){if(!$('terminal').hidden){closeTerminal();return;}if(!$('node-index').hidden){$('node-index').hidden=true;$('open-index').focus();return;}if(!bootDone){finishBoot();return;}if(selectedId){closeDetails(true);return;}if(touring)endTour();return;}
  if(!typing&&e.key==='/'){e.preventDefault();openTerminal();}
  if(typing)return;
  if(touring&&(e.key==='ArrowRight'||e.key==='ArrowDown'||e.key==='ArrowLeft'||e.key==='ArrowUp')){e.preventDefault();goToStep(tourStep+(e.key==='ArrowRight'||e.key==='ArrowDown'?1:-1));}
  konamiIndex=e.key===konami[konamiIndex]?konamiIndex+1:0;
  if(konamiIndex===konami.length){engineering=!engineering;$('debug').hidden=!engineering;document.body.classList.toggle('engineering',engineering);konamiIndex=0;updateMetrics(lastMetrics);}
});
function updateMetrics(metrics){lastMetrics=metrics;$('quality-label').textContent=`${(metrics.quality||'adaptive').toUpperCase()} QUALITY`;$('debug').textContent=`${Math.round(metrics.fps||0)} FPS · ${metrics.drawCalls||0} CALLS · ${selectedId||'person-core'}`;window.__signalMetrics={...metrics,selectedId,layout:document.querySelector('[data-layout].active')?.dataset.layout,reducedMotion,classic};}
function finishBoot(){if(bootDone)return;bootDone=true;cancelAnimationFrame(bootFrame);scene?.completeBoot?.();$('boot-percent').textContent='100';$('boot-log').textContent='NETWORK STABLE · READY TO EXPLORE';$('boot').classList.add('done');setTimeout(()=>$('boot').hidden=true,reducedMotion?0:500);}
$('skip-boot').onclick=()=>{finishBoot();initialFocus.focus({preventScroll:true});};
function runBoot(){
  if(bootDone)return;
  if(reducedMotion){finishBoot();return;}let first=true;try{first=sessionStorage.getItem('me-signal-boot')!=='done';sessionStorage.setItem('me-signal-boot','done');}catch{}
  if(!first){finishBoot();return;}const start=performance.now(),duration=2100;
  function tick(now){const p=Math.min(1,(now-start)/duration);$('boot-percent').textContent=String(Math.round(p*100)).padStart(2,'0');$('boot').querySelector('.gauge-sweep').style.strokeDashoffset=245*(1-p);$('boot-log').textContent=p<.3?'INITIALIZING CENTRAL GATEWAY':p<.65?'POWERING DOMAIN CONTROLLERS':p<.9?'ESTABLISHING SIGNAL PATHS':'NETWORK STABLE · READY TO EXPLORE';if(p<1)bootFrame=requestAnimationFrame(tick);else finishBoot();}bootFrame=requestAnimationFrame(tick);
}
document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelAnimationFrame(traceFrame);else restartTrace();});
runBoot();
try {
  const { createNetwork }=await import('./scene.js');
  scene=await createNetwork({container:$('scene'),graph,onSelect:id=>{scene?.focusNodes([id]);renderDetails(id,true);},onHover:()=>{},onMetrics:updateMetrics,onProject:renderAnchor,reducedMotion});
  $('scene').querySelector('canvas')?.addEventListener('webglcontextlost',event=>{event.preventDefault();setClassic(true,'The graphics context was interrupted. The complete portfolio is available in Classic view.');});
  if(bootDone)scene.completeBoot?.();
} catch(error){console.error('Network view unavailable',error);setClassic(true,'The interactive network is unavailable in this browser. All portfolio content is available below.');$('classic-button').disabled=true;$('classic-button').textContent='Classic view';}

window.addEventListener('pagehide',()=>{scene?.dispose();cancelAnimationFrame(traceFrame);cancelAnimationFrame(bootFrame);},{once:true});
