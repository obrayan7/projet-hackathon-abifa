// Script classique (fonctionne aussi en double-clic, sans serveur)
const Ent=(()=>{
const BAN=new URL('../../images/bureau.jpg',document.currentScript.src).href;
let PAGE,FIRST;const QID=()=>String(window.__id||new URLSearchParams(location.search).get('id')||'');
const ST={'Nouvelle':'b-demo','Présélectionnée':'b-pre','Acceptée':'b-val','Refusée':'b-ref'};
const NAV=[['dashboard','🏠','Tableau de bord'],['talents','🔎','Rechercher des talents'],['missions','📋','Mes missions'],['candidats','👥','Mes candidats'],['profil','🏢','Profil entreprise'],['parametres','⚙️','Paramètres']];
const shell=(r,body)=>`<div class="lg:flex min-h-screen bg-[var(--mist)]"><aside class="side lg:w-64 lg:h-screen lg:sticky lg:top-0 p-4 flex flex-col gap-4" style="background:linear-gradient(180deg,#14125A,#2A0FB5)">
<div class="flex items-center justify-between"><a href="../index.html" class="bg-white rounded-xl px-3 py-1.5"><img src="${LOGO}" alt="SkillUp IA" class="h-7"></a><button data-act="menu" class="lg:hidden text-white font-bold px-3 py-2 rounded-lg bg-white/15" aria-expanded="false" aria-controls="nav">Menu</button></div>
<nav id="nav" class="hidden lg:flex flex-col gap-1" aria-label="Espace entreprise">${NAV.map(([h,i,t])=>`<a href="${h}.html" ${h===r?'aria-current="page"':''}><span aria-hidden="true">${i}</span>${t}</a>`).join('')}<a href="../index.html" data-act="out">Déconnexion</a></nav>
<div class="mt-auto hidden lg:block rounded-2xl bg-white/12 p-4 text-white text-sm"><b>${esc(S.co.name)}</b><br>${esc(S.user?.name||'')}</div></aside>
<main class="flex-1 p-4 md:p-6 max-w-6xl w-full mx-auto space-y-5">${body}</main></div>`;
const H=(t,s='')=>`<div class="fi"><h1 class="text-2xl font-extrabold text-[var(--navy)]">${t}</h1>${s?`<p class="text-sm text-[var(--mut)]">${s}</p>`:''}</div>`;
const LEG=`<p class="text-xs text-[var(--mut)]">Couleur des compétences : ${bd('declare')} ${bd('demontre')} ${bd('valide')}</p>`;
const pubs=()=>S.co.jobs.filter(j=>j.st==='Publiée'),jobSel=()=>pubs().find(j=>j.id===S.co.sel)||pubs()[0];
const jobSelect=j=>`<label class="text-sm font-semibold">Mission <select data-act="sel" class="inp !w-auto !inline-block">${pubs().map(x=>`<option value="${x.id}" ${x===j?'selected':''}>${esc(x.t)}</option>`).join('')}</select></label>`;
const tc=(t,j,i=0)=>{const s=j?score(t,j):0,f=S.co.fav.includes(t.id);return `<li class="card tilt fi" style="--d:${i*.08}s"><div class="flex items-center gap-3"><div class="h-12 w-12 rounded-full grad grid place-items-center text-white font-extrabold" aria-hidden="true">${ini(t.name)}</div><div><b>${esc(t.name)}</b><p class="text-sm text-[var(--mut)]">${esc(t.titre)} · ${esc(t.ville)}</p></div></div>
<div class="mt-3 flex flex-wrap gap-1">${t.skills.map(([n,s])=>`<span class="badge ${L[s][1]}" title="${L[s][0]}">${esc(n)}</span>`).join('')}</div>
${j?`<p class="text-xs mt-3 font-semibold">Pertinence pour « ${esc(j.t)} » : ${s} %</p><div class="bar mt-1"><i data-w="${s}" style="width:0"></i></div>`:''}
<div class="mt-3 flex gap-2"><a class="btn btn-p !py-1.5 text-sm" href="candidat.html?id=${t.id}">Voir le profil</a><button data-act="fav" data-v="${t.id}" class="btn btn-o !py-1.5 text-sm" aria-pressed="${f}">${f?'★ Favori':'☆ Favori'}</button></div></li>`};
const btns=a=>[['Présélectionnée','Présélectionner'],['Acceptée','Accepter'],['Refusée','Refuser']].filter(x=>x[0]!==a.st).map(([s,l])=>`<button data-act="st" data-a="${a.id}" data-v="${s}" class="btn ${s==='Refusée'?'btn-o':'btn-p'} !py-1.5 text-sm">${l}</button>`).join('');
const ar=(a,i)=>{const t=a.t,j=S.co.jobs.find(x=>x.id===a.job);return `<li class="card fi" style="--d:${i*.06}s"><div class="flex flex-wrap items-center justify-between gap-3"><div><b>${esc(t.name)}</b> <span class="badge ${ST[a.st]}">${a.st}</span><p class="text-sm text-[var(--mut)]">${esc(j.t)} · Pertinence ${score(t)} %</p></div><div class="flex flex-wrap gap-2"><a class="btn btn-o !py-1.5 text-sm" href="candidat.html?id=${t.id}">Voir le profil</a>${btns(a)}</div></div></li>`};
const V={};
V.dashboard=()=>{const c=S.co,ac=pubs(),j=jobSel(),top=j?TAL.map(t=>[t,score(t,j)]).filter(x=>x[1]>=40).sort((a,b)=>b[1]-a[1]).slice(0,4):[];
const st=[['Talents correspondants',TAL.filter(t=>t.fit&&t.fit.have.length).length,'🎯'],['Candidatures reçues',c.apps.length,'📨'],['Présélectionnées',c.apps.filter(a=>a.st==='Présélectionnée').length,'⭐'],['Missions actives',ac.length,'📋']];
return shell('dashboard',`<section class="relative overflow-hidden rounded-3xl grad text-white p-6 md:p-8 fi" style="min-height:200px"><div class="relative z-10 max-w-md"><h1 class="text-2xl md:text-3xl font-extrabold">Bienvenue sur votre espace Entreprise</h1><p class="mt-2 text-[#E6E0FF]">Consultez des profils appuyés par des preuves, pas seulement des CV.</p><div class="mt-4 flex flex-wrap gap-2"><a href="talents.html" class="btn bg-white text-[var(--violet)]">Rechercher des talents</a><a href="publier-mission.html" class="btn border-2 border-white/60 text-white">Publier une mission</a></div></div><img src="${BAN}" alt="Responsable d’entreprise devant son ordinateur" class="absolute right-0 bottom-0 h-full w-1/2 object-cover hidden sm:block" style="-webkit-mask-image:linear-gradient(90deg,transparent,#000 45%);mask-image:linear-gradient(90deg,transparent,#000 45%)"></section>
<section class="grid grid-cols-2 lg:grid-cols-4 gap-4">${st.map(([a,n,i],k)=>`<div class="card tilt fi" style="--d:${k*.08}s"><p class="text-2xl" aria-hidden="true">${i}</p><p class="text-3xl font-extrabold text-[var(--violet)]" data-n="${n}">0</p><p class="text-sm text-[var(--mut)]">${a}</p></div>`).join('')}</section>
<section><div class="flex flex-wrap items-center justify-between gap-2"><h2 class="font-extrabold text-[var(--navy)] text-lg">Talents recommandés</h2>${j?jobSelect(j):''}</div>${LEG}
${top.length?`<ul class="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mt-3">${top.map(([t],i)=>tc(t,j,i)).join('')}</ul>`:'<p class="card mt-3">Publiez une mission pour recevoir des talents recommandés.</p>'}</section>
<div class="grid lg:grid-cols-3 gap-5"><section class="card lg:col-span-2 fi"><div class="flex justify-between"><h2 class="font-extrabold text-[var(--navy)]">Mes missions</h2><a class="text-sm font-bold text-[var(--violet)]" href="missions.html">Tout voir</a></div>
${c.jobs.length?`<ul class="mt-3 divide-y divide-[var(--line)]">${c.jobs.slice(0,3).map(x=>`<li class="py-2.5 flex justify-between gap-2 text-sm"><div><b>${esc(x.t)}</b><p class="text-[var(--mut)]">${c.apps.filter(a=>a.job===x.id).length} candidature(s) · ${fmt(x.bmin)} à ${fmt(x.bmax)}</p></div><span class="badge ${x.st==='Publiée'?'b-val':'b-ref'}">${x.st}</span></li>`).join('')}</ul>`:'<p class="mt-3 text-sm">Aucune mission pour l’instant.</p>'}</section>
<section class="card fi"><h2 class="font-extrabold text-[var(--navy)]">Activité récente</h2><ul class="mt-3 space-y-2 text-sm">${c.log.slice(0,5).map(x=>`<li class="flex gap-2"><span aria-hidden="true">●</span>${esc(x)}</li>`).join('')}</ul></section></div>`)};
V.talents=()=>{const j=jobSel(),q=(S.tq||'').toLowerCase(),k=S.tsk||'',l=TAL.filter(t=>(!q||(t.name+t.titre).toLowerCase().includes(q))&&(!k||t.skills.some(s=>s[0]===k))).sort((a,b)=>j?score(b,j)-score(a,j):0);
return shell('talents',`${H('Rechercher des talents','Les profils sont classés avec les mêmes critères pour tous.')}
<div class="card fi flex flex-wrap items-end gap-3">${j?jobSelect(j):''}<label class="text-sm font-semibold">Nom ou métier <input data-act="tq" value="${esc(S.tq||'')}" class="inp" placeholder="Ex. : designer"></label><label class="text-sm font-semibold">Compétence <select data-act="tsk" class="inp"><option value="">Toutes</option>${SK.map(x=>`<option ${k===x?'selected':''}>${x}</option>`).join('')}</select></label></div>${LEG}
${l.length?`<ul class="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">${l.map((t,i)=>tc(t,j,i)).join('')}</ul>`:'<p class="card">Aucun talent ne correspond à cette recherche.</p>'}`)};
V.missions=()=>{const c=S.co;return shell('missions',`<div class="flex flex-wrap justify-between gap-3">${H('Mes missions','Publiez, modifiez ou clôturez vos besoins.')}<a href="publier-mission.html" class="btn btn-p self-center">Publier une mission</a></div>
${c.jobs.length?`<ul class="space-y-4">${c.jobs.map((x,i)=>`<li class="card fi" style="--d:${i*.08}s"><div class="flex flex-wrap justify-between gap-2"><div><h2 class="font-bold">${esc(x.t)}</h2><p class="text-sm text-[var(--mut)]">${fmt(x.bmin)} à ${fmt(x.bmax)} · ${esc(x.delai||'—')} · ${esc(x.mode)}</p></div><span class="badge ${x.st==='Publiée'?'b-val':'b-ref'}">${x.st}</span></div>
<p class="text-sm mt-2">${esc(x.desc)}</p><div class="mt-2 flex flex-wrap gap-1">${x.k.map(k=>`<span class="badge b-demo">${esc(k)}</span>`).join('')}</div>
<div class="mt-3 flex flex-wrap gap-2"><a class="btn btn-o !py-1.5 text-sm" href="candidats.html">${c.apps.filter(a=>a.job===x.id).length} candidature(s)</a><a class="btn btn-o !py-1.5 text-sm" href="publier-mission.html?id=${x.id}">Modifier</a>${x.st==='Publiée'||x.st==='Clôturée'?`<button data-act="jt" data-v="${x.id}" class="btn btn-o !py-1.5 text-sm">${x.st==='Publiée'?'Clôturer':'Rouvrir'}</button>`:''}</div></li>`).join('')}</ul>`:'<p class="card">Aucune mission. Publiez votre première mission pour recevoir des candidatures.</p>'}`)};
V['publier-mission']=()=>{const id=QID(),e=S.co.jobs.find(j=>j.id===id),j=S.draft||e||{k:[],sub:[]};
const f=(n,l,v='',t='text',x='')=>`<label class="block text-sm font-semibold">${l}<input name="${n}" type="${t}" value="${esc(v)}" class="inp" ${x}></label>`;
return shell('missions',`${H(e?'Modifier la mission':'Publier une mission','Décrivez le besoin. L’IA peut vous aider à le découper, vous validez.')}
<form data-job="${id}" class="card space-y-4 max-w-3xl fi" novalidate>${f('t','Titre',j.t)}
<label class="block text-sm font-semibold">Description<textarea name="desc" rows="4" class="inp">${esc(j.desc||'')}</textarea></label>
<fieldset><legend class="text-sm font-semibold">Compétences demandées</legend><div class="flex flex-wrap gap-2 mt-2">${SK.map(k=>`<label class="badge b-demo !text-sm cursor-pointer"><input type="checkbox" name="k" value="${k}" ${(j.k||[]).includes(k)?'checked':''}> ${k}</label>`).join('')}</div></fieldset>
${f('liv','Livrables attendus',j.liv)}<div class="grid grid-cols-2 gap-3">${f('bmin','Budget min (FCFA)',j.bmin,'number','min=0')}${f('bmax','Budget max (FCFA)',j.bmax,'number','min=0')}</div>
<div class="grid sm:grid-cols-3 gap-3">${f('delai','Délai',j.delai)}<label class="block text-sm font-semibold">Mode<select name="mode" class="inp">${['À distance','Sur site','Mixte'].map(m=>`<option ${j.mode===m?'selected':''}>${m}</option>`).join('')}</select></label>${f('loc','Localisation',j.loc)}</div>
<div class="rounded-2xl bg-[var(--mist)] p-4"><button type="button" data-act="dec" class="btn btn-o !py-1.5 text-sm">✨ Décomposer avec l’IA</button><p class="text-xs text-[var(--mut)] mt-2">Proposition de démonstration, à relire avant publication.</p>
${j.sub&&j.sub.length?`<label class="block text-sm font-semibold mt-3">Sous-tâches proposées (modifiables)<textarea name="sub" rows="5" class="inp">${esc(j.sub.join('\n'))}</textarea></label><label class="flex gap-2 text-sm mt-2"><input type="checkbox" name="ok"> J’ai relu et validé cette décomposition</label>`:''}</div>
<p id="err" role="alert" class="text-sm text-red-600">${esc(S.derr||'')}</p><button class="btn btn-p">${e?'Enregistrer':'Publier la mission'}</button></form>`)};
V.candidats=()=>{const c=S.co,fl=c.apps.filter(a=>!S.cf||a.job===S.cf);
return shell('candidats',`${H('Mes candidats','Présélectionnez, acceptez ou refusez selon les preuves partagées.')}
<div class="card fi"><label class="text-sm font-semibold">Mission <select data-act="cf" class="inp !w-auto !inline-block"><option value="">Toutes</option>${c.jobs.map(x=>`<option value="${x.id}" ${S.cf===x.id?'selected':''}>${esc(x.t)}</option>`).join('')}</select></label></div>
${fl.length?`<ul class="space-y-3">${fl.map(ar).join('')}</ul>`:'<p class="card">Aucune candidature pour cette mission.</p>'}`)};
V.candidat=()=>{const t=TAL.find(x=>x.id===QID());if(!t)return shell('candidats',`<p class="card">Profil introuvable. <a class="font-bold text-[var(--violet)]" href="talents.html">Retour aux talents</a></p>`);
const a=S.co.apps.find(x=>x.tal===t.id),j=a?S.co.jobs.find(x=>x.id===a.job):jobSel(),sh=t.proofs.filter(p=>p[2]),fav=S.co.fav.includes(t.id),f=j?fit(t,j):null;
return shell('candidats',`<a href="candidats.html" class="text-sm font-bold underline">Retour aux candidats</a>
<section class="card fi flex flex-wrap items-center gap-4"><div class="h-20 w-20 rounded-full grad grid place-items-center text-white text-2xl font-extrabold" aria-hidden="true">${ini(t.name)}</div><div class="flex-1 min-w-[200px]"><h1 class="text-xl font-extrabold text-[var(--navy)]">${esc(t.name)}</h1><p>${esc(t.titre)} · ${esc(t.ville)}</p>${a?`<span class="badge ${ST[a.st]}">${a.st}</span>`:''}</div>
<div class="flex flex-wrap gap-2">${a?btns(a):''}<button data-act="fav" data-v="${t.id}" class="btn btn-o !py-1.5 text-sm">${fav?'★ Favori':'☆ Favori'}</button></div></section>
${j?`<section class="card fi"><h2 class="font-extrabold text-[var(--navy)]">Pourquoi ce profil ? (${esc(j.t)})</h2><p class="text-3xl font-extrabold text-[var(--violet)] mt-1">${score(t,j)} %</p><div class="bar mt-1"><i data-w="${score(t,j)}" style="width:0"></i></div>
<p class="text-sm mt-3"><b>Compétences en commun :</b> ${f.have.length?f.have.map(([n,s])=>esc(n)+' ('+L[s][0]+')').join(', '):'aucune'}.</p>${f.miss.length?`<p class="text-sm"><b>Non trouvées :</b> ${f.miss.map(esc).join(', ')}.</p>`:''}<p class="text-xs text-[var(--mut)] mt-2">Score indicatif, calculé avec les mêmes critères pour tous. Ce n’est pas une garantie de réussite.</p></section>`:''}
<div class="grid md:grid-cols-2 gap-5"><section class="card fi"><h2 class="font-extrabold text-[var(--navy)]">Compétences</h2>${LEG}<ul class="mt-3 space-y-2">${t.skills.map(([n,s])=>`<li class="flex justify-between text-sm font-semibold"><span>${esc(n)}</span>${bd(s)}</li>`).join('')}</ul></section>
<section class="card fi"><h2 class="font-extrabold text-[var(--navy)]">Preuves partagées</h2><ul class="mt-3 divide-y divide-[var(--line)]">${sh.map(p=>`<li class="py-2 flex justify-between gap-2 text-sm"><span>${esc(p[0])}</span>${bd(p[1])}</li>`).join('')||'<li class="text-sm">Aucune preuve partagée.</li>'}</ul>
${t.hidden?`<p class="text-xs text-[var(--mut)] mt-3">${t.hidden} preuve(s) non partagée(s) : le jeune garde le contrôle de sa visibilité.</p>`:''}</section></div>
${a?`<section class="card fi"><h2 class="font-extrabold text-[var(--navy)]">Message de candidature</h2><p class="text-sm mt-2">${esc(a.msg)}</p></section>`:''}`)};
V.profil=()=>{const c=S.co;return shell('profil',`${H('Profil entreprise')}<form data-co class="card space-y-4 max-w-2xl fi" novalidate>
${[['name','Nom de l’entreprise'],['secteur','Secteur'],['ville','Localisation']].map(([k,l])=>`<label class="block text-sm font-semibold">${l}<input name="${k}" value="${esc(c[k])}" class="inp"></label>`).join('')}
<label class="block text-sm font-semibold">Description<textarea name="desc" rows="3" class="inp">${esc(c.desc)}</textarea></label><p class="text-sm">Statut : <span class="badge b-decl">${esc(c.verif)}</span></p>
<p id="msg" role="status" class="text-sm text-green-600"></p><button class="btn btn-p">Enregistrer</button></form>`)};
V.parametres=()=>shell('parametres',`${H('Paramètres')}<section class="card max-w-xl fi"><h2 class="font-bold">Notifications</h2><p class="mt-2 text-sm">Les candidatures et les changements de statut apparaissent dans « Activité récente » de votre tableau de bord.</p><p class="text-xs mt-3 text-[var(--mut)]">Les données des jeunes ne sont jamais vendues. Vous ne voyez que les preuves validées qu’ils ont choisi de partager.</p></section>`);
function anim(an){requestAnimationFrame(()=>{document.querySelectorAll('[data-w]').forEach(e=>e.style.width=e.dataset.w+'%');document.querySelectorAll('[data-n]').forEach(e=>{const n=+e.dataset.n;if(!an||!n){e.textContent=n;return}let t0;const f=ts=>{t0??=ts;const k=Math.min(1,(ts-t0)/800);e.textContent=Math.round(n*k);if(k<1)requestAnimationFrame(f)};requestAnimationFrame(f)})})}
const render=an=>{const y=scrollY;$('#app').innerHTML=V[PAGE]();scrollTo(0,y);anim(an)};
const run=async fn=>{try{await fn()}catch(e){NOTE=e.message}};
async function mount(p){PAGE=p;if(!await requireUser('entreprise'))return;S.draft=null;S.derr='';NOTE='';
$('#app').innerHTML='<div class="p-6 space-y-3"><div class="skeleton h-10"></div><div class="skeleton h-40"></div></div>';
try{await loadCompany();await loadSkills();
 const j=jobSel();
 if(p==='dashboard'||p==='talents')await loadTalents(j&&j.id);
 if(p==='candidat'){const a=S.co.apps.find(x=>x.tal===QID());await loadTalent(QID(),(a?a.job:j&&j.id))}
}catch(e){NOTE=e.message}render(true)}
document.addEventListener('click',async e=>{const b=e.target.closest('[data-act]');if(!b||b.tagName==='SELECT'||b.tagName==='INPUT')return;const{act,v,a}=b.dataset;
if(act==='menu'){const n=$('#nav'),o=!n.classList.toggle('hidden');n.classList.toggle('flex',o);b.setAttribute('aria-expanded',o);return}
if(act==='out'){e.preventDefault();logout();return}
if(act==='st')await run(async()=>{await patch('/applications/'+a+'/status',{status:{'Présélectionnée':'SHORTLISTED','Acceptée':'ACCEPTED','Refusée':'REJECTED'}[v]});await loadCompany();if(PAGE==='candidat')await loadTalent(QID(),(S.co.apps.find(x=>x.tal===QID())||{}).job)});
if(act==='jt')await run(async()=>{const j=S.co.jobs.find(p=>p.id===v);await patch('/jobs/'+v+'/status',{status:j.st==='Publiée'?'CLOSED':'PUBLISHED'});await loadCompany()});
if(act==='fav')await run(async()=>{const f=S.co.fav.includes(v);await (f?del:post)('/companies/me/favorites/'+v);await loadCompany();TAL.forEach(t=>{if(t.id===v)t.favorite=!f})});
if(act==='dec'){const d=new FormData($('[data-job]'));const o={...(S.draft||{}),t:d.get('t'),desc:d.get('desc'),k:d.getAll('k'),liv:d.get('liv'),bmin:d.get('bmin'),bmax:d.get('bmax'),delai:d.get('delai'),mode:d.get('mode'),loc:d.get('loc')};
 if(!(o.desc||'').trim()||(o.desc||'').trim().length<20||!o.k.length){S.derr='Ajoutez une description (20 caractères minimum) et au moins une compétence avant la décomposition.';o.sub=[]}
 else{S.derr='';await run(async()=>{const r=await post('/ai/jobs/decompose',{title:o.t||'',description:o.desc,skills:o.k});o.sub=r.subtasks;if(r.fallback)NOTE='Proposition de secours : le service IA est momentanément indisponible. Relisez-la avant de publier.'})}S.draft=o}
render();NOTE=''});
document.addEventListener('change',async e=>{const t=e.target,a=t.dataset.act;
if(a==='sel'){S.co.sel=t.value;await run(()=>loadTalents(t.value))}else if(a==='cf')S.cf=t.value;else if(a==='tq')S.tq=t.value;else if(a==='tsk')S.tsk=t.value;else return;render();NOTE=''});
document.addEventListener('submit',async e=>{const fj=e.target.closest('[data-job]'),fc=e.target.closest('[data-co]');if(!fj&&!fc)return;e.preventDefault();
if(fc){const d=Object.fromEntries(new FormData(fc));try{await put('/companies/me',{name:d.name,sector:d.secteur,description:d.desc,city:d.ville});await loadCompany();$('#msg').textContent='Profil enregistré.'}catch(x){$('#msg').className='text-sm text-red-600';$('#msg').textContent=x.message}return}
const d=new FormData(fj),er=$('#err'),g=n=>(d.get(n)||'').toString().trim(),k=d.getAll('k'),bmin=+g('bmin'),bmax=+g('bmax');
if(!g('t'))return er.textContent='Indiquez un titre.';
if(g('desc').length<20)return er.textContent='La description doit contenir au moins 20 caractères.';
if(!k.length)return er.textContent='Choisissez au moins une compétence.';
if(bmin&&bmax&&bmin>bmax)return er.textContent='Le budget minimum dépasse le maximum.';
const sub=g('sub')?g('sub').split('\n').map(x=>x.trim()).filter(Boolean):[];
if(sub.length&&!d.get('ok'))return er.textContent='Validez la décomposition avant de publier.';
const id=fj.dataset.job,body={title:g('t'),description:g('desc'),skills:k,deliverables:g('liv'),budgetMin:bmin||0,budgetMax:bmax||0,deadline:g('delai'),mode:g('mode'),location:g('loc'),subtasks:sub,subtasksConfirmed:!!d.get('ok')};
try{const r=id?await put('/jobs/'+id,body):await post('/jobs',body);S.draft=null;location.href='missions.html'}catch(x){er.textContent=x.message}});
return {mount}})();
