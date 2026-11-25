// Animations au défilement de l'accueil (sans bibliothèque). Respecte prefers-reduced-motion.
function initHomeAnim(){
const d=document,q=s=>d.querySelector(s),qa=s=>[...d.querySelectorAll(s)];
const cl=(v,a=0,b=1)=>Math.min(b,Math.max(a,v)),lp=(a,b,t)=>a+(b-a)*t,sg=(p,a,b)=>{const t=cl((p-a)/(b-a));return t*t*(3-2*t)};
const red=matchMedia('(prefers-reduced-motion: reduce)').matches;
const ST=[['DÉCLAREZ','Chaque compétence commence par une déclaration.','Décrivez ce que vous savez faire, l’IA vous aide à le formuler.'],
['DÉMONTREZ','Relevez un défi pratique.','Votre livrable est évalué par critères, avec des commentaires clairs.'],
['VALIDEZ','Faites confirmer votre preuve.','Une revue humaine valide. Vous pouvez contester un résultat.'],
['DÉCROCHEZ','Recevez des missions pertinentes.','Le score est le même pour tous, seul le nombre de missions affichées change avec PRO.']];
const BS=[['Déclaré','b-decl','#FFC83D'],['Démontré','b-demo','#5B8CFF'],['Validé','b-val','#2ED47A']];
const wp=q('#words');if(wp&&!wp.dataset.s){wp.dataset.s=1;wp.innerHTML=wp.textContent.trim().split(/\s+/).map(w=>`<span class="w">${w}</span>`).join(' ')}
const ws=qa('#words .w'),set=(el,o)=>Object.assign(el.style,o);
function J(p){const st=q('#st'),W=st.clientWidth,H=st.clientHeight,G=H*.82,bw=Math.min(150,W*.3),bh=bw*.62,top=H*.1;
const A=sg(p,0,.2),B=sg(p,.2,.48),C=sg(p,.5,.7),F=sg(p,.58,.72),D=sg(p,.72,1);
const bx=lp(W*.2,W*.58,B),by=lp(lp(G-bh*1.5,H*.34,A),H*.52,C),s=p<.3?0:p<.5?1:2,box=q('#box');
set(q('#mast'),{left:W*.08+'px',top:top+'px',width:'14px',height:G-top+'px'});
set(q('#boom'),{left:W*.08-10+'px',top:top+'px',width:W*.74+'px',height:'12px'});
set(q('#cab'),{left:bx-1+'px',top:top+12+'px',width:'2px',height:Math.max(0,by-bh/2-top-12)+'px',opacity:1-sg(p,.66,.74)});
set(q('#stat'),{left:W*.2-bw/2+'px',top:G-bh+'px',width:bw+'px',height:bh+'px'});
set(box,{width:bw+'px',height:bh+'px',opacity:F<.5?1:0,transform:`translate(${bx-bw/2}px,${by-bh/2}px) rotateZ(${Math.sin(B*Math.PI)*4}deg) rotateY(${F*90}deg)`,boxShadow:`0 0 0 3px ${BS[s][2]},0 30px 40px -20px #000`});
if(box.dataset.s!=s){box.dataset.s=s;const b=q('#bb');b.textContent=BS[s][0];b.className='badge '+BS[s][1]}
const cx=lp(W*.58,W*.3,D),cw=bw*.95,ch=bw*1.2;
set(q('#card'),{width:cw+'px',opacity:F>=.5?1:0,transform:`translate(${cx-cw/2}px,${lp(H*.52,H*.46,D)-ch/2}px) rotateY(${-(1-F)*90}deg)`});
qa('.job').forEach((j,i)=>{const t=sg(p,.74+i*.06,.9+i*.04);set(j,{width:Math.min(230,W*.36)+'px',left:W*.6+'px',top:H*(.2+i*.16)+'px',opacity:t,transform:`translateX(${(1-t)*W*.4}px)`})});
const k=p<.2?0:p<.5?1:p<.72?2:3,jt=q('#jt');
if(jt.dataset.k!=k){jt.dataset.k=k;q('#jbig').textContent=ST[k][0];jt.textContent=ST[k][1];q('#jp').textContent=ST[k][2];
 ['#jcap','#jbig'].forEach(i=>{const e=q(i);e.classList.remove('pop');void e.offsetWidth;e.classList.add('pop')})}}
if(red){const s=q('#journey');if(s){s.style.height='100vh';J(.95)}return}
d.documentElement.classList.add('js');
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);setTimeout(()=>e.target.classList.remove('rv','in'),1500)}}),{threshold:.12});
qa('.rv').forEach(el=>io.observe(el));
let tk=0;
const upd=()=>{tk=0;const hero=q('#hero');if(!hero){removeEventListener('scroll',window.__ht);removeEventListener('resize',window.__ht);return}
const y=scrollY,vh=innerHeight;q('#prog').style.width=y/Math.max(1,d.documentElement.scrollHeight-vh)*100+'%';
hero.style.backgroundPosition='center '+y*.3+'px';q('#scene').style.transform=`translateY(${-y*.1}px)`;
const ht=q('#htxt');ht.style.transform=`translateY(${y*.15}px)`;ht.style.opacity=cl(1-y/(vh*.9));
if(wp){const r=wp.getBoundingClientRect(),pr=cl((vh*.85-r.top)/(vh*.55));ws.forEach((s,i)=>s.style.opacity=.15+.85*cl(pr*(ws.length+3)-i))}
const sec=q('#journey'),r=sec.getBoundingClientRect();if(r.bottom>-50&&r.top<vh+50)J(cl(-r.top/(sec.offsetHeight-vh)));
qa('[data-wipe]').forEach(el=>{const t=el.getBoundingClientRect(),pr=cl((vh-t.top)/(vh*.7)),k=1-pr;el.style.clipPath=`inset(${k*8}% ${k*6}% 0 round ${k*3}rem)`});
qa('.p3d').forEach(el=>{const t=el.getBoundingClientRect(),pr=cl((vh-t.top)/(vh+t.height)),b=+el.dataset.r;el.style.setProperty('--r',b*(1-cl(pr*1.6)*.85)+'deg');el.style.setProperty('--ty',(.5-pr)*70+'px')})};
window.__ht=()=>{if(!tk)tk=requestAnimationFrame(upd)};
addEventListener('scroll',window.__ht,{passive:true});addEventListener('resize',window.__ht);upd();
}
