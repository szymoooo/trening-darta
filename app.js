// ═══════════════════════════════════════════════
//  SUPABASE
// ═══════════════════════════════════════════════
const SB_URL = 'https://femoshkoumxikrcjhool.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZlbW9zaGtvdW14aWtyY2pob29sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1ODQ3NjIsImV4cCI6MjA5MzE2MDc2Mn0.JEbU2gvcsq6WQxheyktkYDhf1gaoHYyYCzVmzer9hKY';
const HDR = {
  apikey: SB_KEY,
  Authorization: 'Bearer ' + SB_KEY,
  'Content-Type': 'application/json'
};

async function sb(method, table, params = '', body = null) {
  console.log('[DB] ' + method + ' /' + table + (params ? '?' + params.slice(0, 60) : ''));
  const opts = { method, headers: { ...HDR } };
  if (body) opts.body = JSON.stringify(body);
  if (method === 'POST' || method === 'PATCH') opts.headers['Prefer'] = 'return=representation';
  const url = `${SB_URL}/rest/v1/${table}${params ? '?' + params : ''}`;
  const res = await fetch(url, opts);
  
  // Jeśli status 204 (No Content), zwróć null zamiast próbować parsować JSON
  if (res.status === 204) return null;
  
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || 'DB error');
  return data;
}

const dbGet = (t, p) => sb('GET', t, p);
const dbPost = (t, b) => sb('POST', t, '', b);
const dbPatch = (t, p, b) => sb('PATCH', t, p, b);
const dbDelete = (t, p) => sb('DELETE', t, p);

// ═══════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════
let S={user:null,isAdmin:false,exercises:[],training:{},newType:'shanghai',match:null};
let NEW_RULES=[];

// ═══════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════
function hash(s){let h=0;for(let i=0;i<s.length;i++)h=(Math.imul(31,h)+s.charCodeAt(i))|0;return h.toString(36)}
function uid(){return Math.random().toString(36).slice(2,8)}
function loading(show,msg='Ładowanie...'){
  document.getElementById('loading-overlay').classList.toggle('hidden',!show);
  document.getElementById('loading-msg').textContent=msg;
}
let toastTm=null;
function showToast(msg){
  const el=document.getElementById('toast-message');
  el.textContent=msg;el.classList.add('show');
  if(toastTm)clearTimeout(toastTm);
  toastTm=setTimeout(()=>el.classList.remove('show'),2600);
}
function showErr(msg){const el=document.getElementById('login-error');el.textContent=msg;el.classList.add('show')}
function hideErr(){document.getElementById('login-error').classList.remove('show')}

// ═══════════════════════════════════════════════
//  SCORING — dynamiczne reguły
// ═══════════════════════════════════════════════
function defaultRules(type){
  if(type==='shanghai') return[
    {id:uid(),label:'Single',points:1,type:'hit',trigger:'single'},
    {id:uid(),label:'Double',points:2,type:'hit',trigger:'double'},
    {id:uid(),label:'Treble',points:3,type:'hit',trigger:'triple'},
    {id:uid(),label:'Bonus Shanghai (S+D+T)',points:100,type:'bonus',trigger:'shanghai'}
  ];
  return[
    {id:uid(),label:'Trafiony double',points:50,type:'hit',trigger:'double'},
    {id:uid(),label:'Trafiony BULL',points:50,type:'hit',trigger:'bull'},
    {id:uid(),label:'Bonus za BULL',points:50,type:'bonus',trigger:'bull'}
  ];
}

function getRules(ex){
  const sc=ex.scoring;
  if(Array.isArray(sc)) return sc;
  return defaultRules(ex.type);
}

function autoRules(ex){
  return getRules(ex).map(r=>`${r.label}: ${r.points} pkt${r.type==='bonus'?' (bonus)':''}`).join('\n');
}

function initNewRules(type){
  NEW_RULES=defaultRules(type).map(r=>({...r,id:uid()}));
  renderNewRules();
}

function renderNewRules(){
  const el=document.getElementById('new-rules-list');
  if(!el) return;
  el.innerHTML=NEW_RULES.map((r,i)=>ruleRowHTML(r,i,'new')).join('');
}

function addNewRule(){
  NEW_RULES.push({id:uid(),label:'',points:0,type:'hit',trigger:'custom'});
  renderNewRules();
  const inputs=document.querySelectorAll('#new-rules-list .rule-desc');
  if(inputs.length) inputs[inputs.length-1].focus();
}

function ruleRowHTML(r,idx,scope){
  const bc=r.type==='bonus'?'bonus':'hit';
  const bl=r.type==='bonus'?'bonus':'trafienie';
  return`<div class="rule-row">
    <input class="rule-desc" placeholder="Opis reguły..." value="${r.label||''}"
      oninput="updateRuleLabel('${scope}','${r.id}',this.value)"/>
    <input class="rule-pts" type="number" min="0" value="${r.points}"
      oninput="updateRulePoints('${scope}','${r.id}',+this.value)"/>
    <span class="rule-unit">pkt</span>
    <button class="rule-type-badge ${bc}" onclick="toggleRuleType('${scope}','${r.id}')">${bl}</button>
    <button class="rule-del" onclick="removeRule('${scope}','${r.id}')">×</button>
  </div>`;
}

function updateRuleLabel(scope,rid,val){
  if(scope==='new'){const r=NEW_RULES.find(r=>r.id===rid);if(r)r.label=val;}
  else{const ex=S.exercises.find(e=>e.id===scope);if(ex){const r=getRules(ex).find(r=>r.id===rid);if(r)r.label=val;}scheduleAutoSave(scope);}
}
function updateRulePoints(scope,rid,val){
  if(scope==='new'){const r=NEW_RULES.find(r=>r.id===rid);if(r)r.points=val;}
  else{const ex=S.exercises.find(e=>e.id===scope);if(ex){const r=getRules(ex).find(r=>r.id===rid);if(r)r.points=val;}scheduleAutoSave(scope);}
}
function toggleRuleType(scope,rid){
  const rules=scope==='new'?NEW_RULES:getRules(S.exercises.find(e=>e.id===scope));
  const r=rules.find(r=>r.id===rid);if(!r)return;
  r.type=r.type==='hit'?'bonus':'hit';
  if(scope==='new')renderNewRules();
  else{renderExRules(scope);scheduleAutoSave(scope);}
}
function removeRule(scope,rid){
  if(scope==='new'){NEW_RULES=NEW_RULES.filter(r=>r.id!==rid);renderNewRules();}
  else{const ex=S.exercises.find(e=>e.id===scope);if(!ex)return;ex.scoring=getRules(ex).filter(r=>r.id!==rid);renderExRules(scope);scheduleAutoSave(scope);}
}
function addExRule(exId){
  const ex=S.exercises.find(e=>e.id===exId);if(!ex)return;
  const rules=getRules(ex);rules.push({id:uid(),label:'',points:0,type:'hit',trigger:'custom'});
  ex.scoring=rules;renderExRules(exId);scheduleAutoSave(exId);
}
function renderExRules(exId){
  const ex=S.exercises.find(e=>e.id===exId);if(!ex)return;
  const el=document.getElementById('rules-list-'+exId);
  if(el)el.innerHTML=getRules(ex).map((r,i)=>ruleRowHTML(r,i,exId)).join('');
}

const autoSaveTimers={};
function scheduleAutoSave(exId){
  clearTimeout(autoSaveTimers[exId]);
  const dot=document.getElementById('saving-dot-'+exId);
  if(dot)dot.style.display='inline-block';
 // NOWY KOD — zastąp tym:
autoSaveTimers[exId]=setTimeout(async()=>{
    const ex=S.exercises.find(e=>e.id===exId);if(!ex)return;
    try{
      const scoringData=getRules(ex);
      await dbPatch('exercises',`id=eq.${exId}`,{
        name:ex.name,description:ex.description,rules:ex.rules||null,
        scoring:scoringData,enabled:ex.enabled
      });
      if(dot)dot.style.display='none';
      showToast('✅ Zapisano automatycznie');
    }catch(e){if(dot)dot.style.display='none';showToast('⚠️ Błąd auto-zapisu');}
  },800);
}

// ═══════════════════════════════════════════════
//  AUTH
// ═══════════════════════════════════════════════
async function handleLogin(){
  hideErr();
  const name=document.getElementById('login-username').value.trim();
  const pass=document.getElementById('login-password').value;
  if(name.length<2){showErr('Wpisz pseudonim (min. 2 znaki)');return}
  if(!pass){showErr('Wpisz hasło');return}
  const btn=document.getElementById('login-submit');
  btn.textContent='Łączenie...';btn.disabled=true;
  try{
    const ph=hash(pass);
    const users=await dbGet('users',`username=eq.${encodeURIComponent(name)}&select=*`);
    if(!users||!users.length){
      const created=await dbPost('users',{username:name,password_hash:ph,is_admin:false,streak:0});
      S.user=created[0];
    }else{
      if(users[0].password_hash!==ph){showErr('Błędne hasło!');return}
      S.user=users[0];
    }
    S.isAdmin=S.user.is_admin;
    console.log('[AUTH] Zalogowano:', {username:S.user.username, isAdmin:S.user.is_admin, id:S.user.id});
    await updateStreak();
    await loadExercises();
    console.log('[AUTH] Załadowano ćwiczeń:', S.exercises.length);
    saveSession(S.user.id);
    startInactivityTimer();
    if(S.isAdmin){showScreen('admin');renderAdminEx();renderLB();}
    else{goTab('home');}
  }catch(e){showErr('Błąd: '+e.message);}
  finally{btn.textContent='Wejdź do aplikacji';btn.disabled=false;}
}

async function updateStreak(){
  const today=new Date().toISOString().slice(0,10);
  const u=S.user;if(u.last_day===today)return;
  const yest=new Date(Date.now()-86400000).toISOString().slice(0,10);
  const ns=u.last_day===yest?(u.streak||0)+1:0;
  await dbPatch('users',`id=eq.${u.id}`,{streak:ns,last_day:today});
  S.user.streak=ns;S.user.last_day=today;
}

function logout(){
  S.user=null;S.exercises=[];
  clearSession();
  document.getElementById('login-username').value='';
  document.getElementById('login-password').value='';
  hideErr();
  history.replaceState({screen:'login'},'',window.location.pathname+'#login');
  showScreen('login');
}

// ═══════════════════════════════════════════════
//  EXERCISES
// ═══════════════════════════════════════════════
async function loadExercises(){
  const rows=await dbGet('exercises','order=sort_order.asc,created_at.asc');
  S.exercises=(rows||[]).map(r=>({...r,
    scoring:typeof r.scoring==='string'?JSON.parse(r.scoring):r.scoring,
    targets:typeof r.targets==='string'?JSON.parse(r.targets):r.targets
  }));
}

// ═══════════════════════════════════════════════
//  SCREENS & NAV
// ═══════════════════════════════════════════════
function showScreen(name){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById('screen-'+name).classList.add('active');
  // Push to browser history so system back works
  if(history.state?.screen !== name){
    history.pushState({screen:name},'',window.location.pathname+'#'+name);
  }
}

async function goTab(tab){
  const screenMap={home:'home',history:'history',profile:'profile',match:'match',multiplayer:'mp-lobby'};
  const screen=screenMap[tab]||'home';
  if(tab!=='match'){
    const tt=document.getElementById('match-tooltip');
    if(tt) tt.style.display='none';
  }
  showScreen(screen);
  resetInactivityTimer();
  if(tab==='home')await renderHome();
  if(tab==='history')renderHistory();
  if(tab==='profile')renderProfile();
  if(tab==='match')initMatch();
  if(tab==='multiplayer')initMpLobby();
}

// ═══════════════════════════════════════════════
//  HOME
// ═══════════════════════════════════════════════
async function renderHome(){
  const u=S.user;
  // avatar
  const avEl=document.getElementById('home-avatar');
  if(u.avatar_url) avEl.innerHTML=`<img class="avatar-sm" src="${u.avatar_url}" alt="avatar"/>`;
  else avEl.innerHTML=`<div class="avatar-placeholder">🎯</div>`;
  document.getElementById('home-name').textContent=u.first_name||u.username;
  const sk=u.streak||0;
  document.getElementById('home-streak').textContent=sk>0?`🔥 ${sk} dzień z rzędu!`:'👋 Zacznij serię treningową!';
  const sessions=await dbGet('sessions',`user_id=eq.${u.id}&order=created_at.desc`);
  const all=sessions||[];
  const best=all.length?Math.max(...all.map(s=>s.total_score)):null;
  document.getElementById('stat-best').innerHTML=best!=null?best+'<span class="sc-unit">pkt</span>':'—';
  document.getElementById('stat-sess').textContent=all.length;
  const todayStr=new Date().toISOString().slice(0,10);
  const todaySess=all.filter(s=>s.created_at.slice(0,10)===todayStr);
  const active=S.exercises.filter(e=>e.enabled!==false);
  document.getElementById('ex-list').innerHTML=active.length
    ?active.map((ex,i)=>{
        const done=todaySess.some(s=>s.exercise_id===ex.id);
        return`<div class="exc" onclick="startTraining('${ex.id}')">
          <div class="exn ${ex.color}">${i+1}</div>
          <div class="ex-inf"><div class="ex-nm">${ex.name}</div><div class="ex-ds">${ex.description||''}</div></div>
          <div class="badge${done?' done':''}"> ${done?'✓ Zrobione':'Start'}</div>
        </div>`;
      }).join('')
    :`<div class="empty"><span class="empty-ic">😴</span><div class="empty-t">Brak aktywnych ćwiczeń</div></div>`;
  const recent=all.slice(0,3);
  document.getElementById('mini-hist').innerHTML=recent.length
    ?recent.map(s=>`<div class="hi">
        <div><div class="hi-d">${new Date(s.created_at).toLocaleDateString('pl-PL',{weekday:'short',day:'numeric',month:'short'})}</div>
        <div style="font-size:12px">${s.exercise_name||'—'}</div></div>
        <div class="hi-sc">${s.total_score}</div>
      </div>`).join('')
    :`<div class="empty"><span class="empty-ic">📊</span><div class="empty-t">Brak historii</div></div>`;
}
async function startFirst(){
  const active = S.exercises.filter(e => e.enabled !== false);
  if(!active.length){
    showToast('😴 Brak aktywnych ćwiczeń — admin musi je włączyć.');
    return;
  }
  const todayStr = new Date().toISOString().slice(0, 10);
  let doneTodayIds = [];
  try{
    const sess = await dbGet('sessions',
      'user_id=eq.'+S.user.id+'&select=exercise_id,created_at&order=created_at.desc');
    doneTodayIds = (sess||[])
      .filter(s => s.created_at.slice(0,10) === todayStr)
      .map(s => s.exercise_id);
  }catch(e){ console.warn('startFirst sessions error:', e); }

  // Pierwsze ćwiczenie które NIE było robione dziś
  const nextUndone = active.find(ex => !doneTodayIds.includes(ex.id));
  if(nextUndone){
    startTraining(nextUndone.id);
  } else {
    await showAllDoneModal(active);
  }
}

async function showAllDoneModal(active){
  const idx=await caShow(
    '🎉','Wszystkie ćwiczenia zrobione!',
    'Ukończyłeś wszystkie dzisiejsze ćwiczenia. Co chcesz zrobić?',
    [
      {label:'🔁 Powtórz pierwsze',cls:'primary'},
      {label:'📋 Wybierz ćwiczenie',cls:'outline'},
      {label:'← Menu',cls:'outline'}
    ]
  );
  if(idx===0) startTraining(active[0].id);
  else if(idx===1) showScreen('home'); // user kliknie ćwiczenie z listy
}

// ═══════════════════════════════════════════════
//  TRAINING
// ═══════════════════════════════════════════════
async function startTraining(exId){
  const ex=S.exercises.find(e=>e.id===exId);
  if(!ex||ex.enabled===false){await caAlert('To ćwiczenie jest aktualnie wyłączone przez admina.','🔒','Wyłączone');return}
  S.training={exId,ti:0,curThrows:[],sessScore:0,bonuses:[],rounds:[]};
  document.getElementById('training-title').textContent=ex.name;
  showScreen('training');renderTarget();
}
function renderTarget(){
  const t=S.training,ex=S.exercises.find(e=>e.id===t.exId);
  const ti=t.ti,tot=ex.targets.length,target=ex.targets[ti];
  document.getElementById('prog').style.width=(ti/tot*100)+'%';
  document.getElementById('rbadge').textContent=`Cel ${ti+1} z ${tot}`;
  document.getElementById('rname').textContent=ex.name;
  document.getElementById('training-step').textContent=`${ti+1}/${tot}`;
  const ne=document.getElementById('training-target-number');
  ne.textContent=target;
  ne.className='tgt-num'+(ex.color==='c2'?' org':ex.color==='c3'?' blu':'');
  document.getElementById('training-target-label').textContent=target==='BULL'?'Byk':`Liczba ${target}`;
  const rules=ex.rules&&ex.rules.trim()?ex.rules:autoRules(ex);
  const hl=document.getElementById('training-target-hint');hl.textContent=rules;hl.style.display='block';
  t.curThrows=[];
  renderChips(ex.throws_per_target);renderDartBtns(ex,target);
  document.getElementById('next-wrap').style.display='none';
  document.getElementById('fin-wrap').style.display='none';
  document.getElementById('training-score').textContent=t.sessScore+' pkt';
  // Render dartboard with highlighted target
  renderDartboard(target);
}
function renderChips(n){
  document.getElementById('throws-row').innerHTML=Array(n).fill(0).map((_,i)=>`<div class="chip" id="chip-${i}">?</div>`).join('');
}
function renderDartBtns(ex,target){
  const el=document.getElementById('dart-btns');
  const rules=getRules(ex);const isBull=target==='BULL';
  if(ex.type==='doubles'){
    const hitRule=rules.find(r=>r.type==='hit'&&r.trigger===(isBull?'bull':'double'))||rules.find(r=>r.type==='hit');
    const pts=hitRule?hitRule.points:50;
    el.className='dg dg2';
    el.innerHTML=`
      <button class="dbtn" onclick="recThrow('miss',0,'m')"><div class="dbtn-in"><div class="zlbl">Pudło</div><div class="zsc cm">0 pkt</div></div></button>
      <button class="dbtn" onclick="recThrow('${isBull?'bull':'double'}',${pts},'d')"><div class="dbtn-in"><div class="zlbl">${isBull?'BULL':'Double'}</div><div class="zsc cd">${pts} pkt</div></div></button>`;
  }else{
    const sr=rules.find(r=>r.trigger==='single')||{points:1};
    const dr=rules.find(r=>r.trigger==='double')||{points:2};
    const tr=rules.find(r=>r.trigger==='triple')||{points:3};
    el.className='dg dg4';
    el.innerHTML=`
      <button class="dbtn" onclick="recThrow('miss',0,'m')"><div class="dbtn-in"><div class="zlbl">Pudło</div><div class="zsc cm">0</div></div></button>
      <button class="dbtn" onclick="recThrow('single',${sr.points},'s')"><div class="dbtn-in"><div class="zlbl">Single</div><div class="zsc cs">${sr.points} pkt</div></div></button>
      <button class="dbtn" onclick="recThrow('double',${dr.points},'d')"><div class="dbtn-in"><div class="zlbl">Double</div><div class="zsc cd">${dr.points} pkt</div></div></button>
      <button class="dbtn" onclick="recThrow('triple',${tr.points},'t')"><div class="dbtn-in"><div class="zlbl">Treble</div><div class="zsc ct">${tr.points} pkt</div></div></button>`;
  }
}
function recThrow(zone,pts,cc){
  const t=S.training,ex=S.exercises.find(e=>e.id===t.exId);
  if(t.curThrows.length>=ex.throws_per_target)return;
  console.log('[TRAINING] Rzut: zone='+zone+', pts='+pts+', rzut '+(t.curThrows.length+1)+'/'+ex.throws_per_target+', cel='+ex.targets[t.ti]);
  t.curThrows.push({zone,pts,cc});
  const i=t.curThrows.length-1;
  const chip=document.getElementById('chip-'+i);
  if(chip){chip.className='chip f'+cc;chip.textContent=cc==='m'?'✗':cc==='s'?'S':cc==='d'?'D':'T';}
  if(t.curThrows.length===ex.throws_per_target){
    const rndPts=t.curThrows.reduce((a,th)=>a+th.pts,0);
    let bonus=0;
    const rules=getRules(ex);const zones=t.curThrows.map(th=>th.zone);
    rules.filter(r=>r.type==='bonus').forEach(r=>{
      if(r.trigger==='shanghai'&&zones.includes('single')&&zones.includes('double')&&zones.includes('triple')){
        bonus+=r.points;showToast(`🎯 SHANGHAI! +${r.points} pkt`);
      }else if(r.trigger==='bull'&&ex.targets[t.ti]==='BULL'&&zones.includes('bull')){
        bonus+=r.points;showToast(`🔴 BULL BONUS! +${r.points} pkt`);
      }
    });
    if(bonus>0)t.bonuses.push(bonus);
    t.sessScore+=rndPts+bonus;
    t.rounds.push({target:ex.targets[t.ti],pts:rndPts,bonus});
    document.getElementById('training-score').textContent=t.sessScore+' pkt';
    const isLast=t.ti>=ex.targets.length-1;
    if(!isLast){
      // Auto-advance after short delay
      setTimeout(()=>nextTarget(), 400);
    } else {
      document.getElementById('fin-wrap').style.display='block';
    }
  }
}
function nextTarget(){S.training.ti++;renderTarget();}
async function confirmExit(){if(S.training.sessScore>0){const c=await caConfirm('Masz niezapisany wynik. Na pewno chcesz wyjść?','⚠️','Trening w toku');if(c!==1)return;}goTab('home');}
async function finishTraining(){
  const t=S.training,ex=S.exercises.find(e=>e.id===t.exId);
  const bonTotal=t.bonuses.reduce((a,b)=>a+b,0);
  console.log('[TRAINING] Zakończono sesję:', {exercise:ex.name, score:t.sessScore, bonus:bonTotal, rounds:t.rounds.length});
  loading(true,'Zapisywanie wyniku...');
  try{
    const sessionRows=await dbPost('sessions',{
      user_id:S.user.id,exercise_id:ex.id,exercise_name:ex.name,
      total_score:t.sessScore,base_score:t.sessScore-bonTotal,bonus_score:bonTotal
    });
    const session=sessionRows[0];
    if(t.rounds.length){
      await dbPost('throws',t.rounds.map((r,idx)=>({
        session_id:session.id,target:String(r.target),zone:'round',points:r.pts+r.bonus,throw_order:idx
      })));
    }
    const allSess=await dbGet('sessions',`user_id=eq.${S.user.id}&exercise_id=eq.${ex.id}&order=created_at.asc`);
    renderSummary(session,allSess||[]);showScreen('summary');
  }catch(e){await caAlert(e.message,'❌','Błąd zapisu');}
  finally{loading(false);}
}
function startNextExercise(){
  const active = S.exercises.filter(e=>e.enabled!==false);
  const currentId = S.training?.exId;
  const currentIdx = active.findIndex(e=>e.id===currentId);
  const nextEx = active[currentIdx+1];
  if(nextEx) startTraining(nextEx.id);
  else goTab('home');
}

function repeatCurrentExercise(){
  const exId = S.training?.exId;
  if(exId) startTraining(exId);
  else startFirst();
}

function renderSummary(session,allSess){
  const scores=allSess.map(s=>s.total_score);
  const best=Math.max(...scores);const isPB=session.total_score===best&&scores.length>1;
  document.getElementById('summary-trophy').textContent=isPB?'🏆':'🎯';
  document.getElementById('summary-title').textContent=isPB?'Nowy rekord osobisty!':'Dobry trening!';
  document.getElementById('summary-total').textContent=session.total_score;
  document.getElementById('sum-break').innerHTML=`
    <div class="srow"><span class="sl">Ćwiczenie</span><span class="sv">${session.exercise_name}</span></div>
    <div class="srow"><span class="sl">Wynik bazowy</span><span class="sv">${session.base_score} pkt</span></div>
    <div class="srow bon"><span class="sl">Bonusy łącznie</span><span class="sv">+${session.bonus_score} pkt</span></div>
    <div class="srow"><span class="sl">Rekord osobisty</span><span class="sv">${best} pkt</span></div>
    <div class="srow"><span class="sl">Liczba sesji</span><span class="sv">${scores.length}</span></div>`;
  // Show "Next exercise" if there is one
  const active = S.exercises.filter(e => e.enabled !== false);
  const currentIdx = active.findIndex(e => e.id === session.exerciseId);
  const todayStr = new Date().toISOString().slice(0,10);
  // allSess zawiera wszystkie sesje tego ćwiczenia — pobierz wszystkie sesje usera dziś
  const todayDoneIds = (allSess||[])
    .filter(s => s.created_at && s.created_at.slice(0,10) === todayStr)
    .map(s => s.exercise_id);
  // Dodaj właśnie ukończone
  if(!todayDoneIds.includes(session.exerciseId)) todayDoneIds.push(session.exerciseId);

  // Znajdź kolejne NIEZROBIONE (pomijaj zrobione dziś)
  const nextUndone = active.find((e,i) => i > currentIdx && !todayDoneIds.includes(e.id));
  const nextBtn = document.getElementById('summary-next');
  if(nextBtn){
    if(nextUndone){
      nextBtn.style.display = 'block';
      nextBtn.textContent = '▶️ Następne: ' + nextUndone.name;
      nextBtn.onclick = () => startTraining(nextUndone.id);
    } else {
      nextBtn.style.display = 'none';
    }
  }
  const recent=allSess.slice(-5);
  const chart=document.getElementById('sum-chart');
  if(recent.length>1){
    chart.style.display='block';const mx=Math.max(...recent.map(s=>s.total_score));
    document.getElementById('sum-bars').innerHTML=recent.map(s=>{
      const pct=mx>0?Math.round(s.total_score/mx*100):0;
      const lbl=new Date(s.created_at).toLocaleDateString('pl-PL',{day:'numeric',month:'short'});
      return`<div class="brow"><div class="bmeta"><span>${lbl}</span><span>${s.total_score} pkt</span></div><div class="bbg"><div class="bfill" style="width:${pct}%"></div></div></div>`;
    }).join('');
  }else chart.style.display='none';
}

// ═══════════════════════════════════════════════
//  HISTORY
// ═══════════════════════════════════════════════
let historyTab = 'training';

function switchHistoryTab(tab){
  historyTab = tab;
  document.getElementById('history-tab-training').classList.toggle('on', tab==='training');
  document.getElementById('history-tab-matches').classList.toggle('on', tab==='matches');
  renderHistory();
}

async function renderHistory(){
  const el=document.getElementById('history-list');
  el.innerHTML='<div class="empty"><div class="spinner" style="margin:30px auto"></div></div>';
  try{
    if(historyTab==='training'){
      await renderTrainingHistory(el);
    }else{
      await renderMatchHistory(el);
    }
  }catch(e){
    el.innerHTML='<div class="empty"><span class="empty-ic">⚠️</span><div class="empty-t">Błąd ładowania</div></div>';
    console.error(e);
  }
}

async function renderTrainingHistory(el){
  const sessions=await dbGet('sessions',`user_id=eq.${S.user.id}&order=created_at.desc`);
  const all=sessions||[];
  if(!all.length){
    el.innerHTML='<div class="empty"><span class="empty-ic">🎯</span><div class="empty-t">Brak treningów</div><p class="empty-s">Zrób pierwsze ćwiczenie!</p></div>';
    return;
  }
  const grp={};
  all.forEach(s=>{const d=s.created_at.slice(0,10);(grp[d]=grp[d]||[]).push(s)});
  el.innerHTML=Object.entries(grp).map(([day,ss])=>{
    const lbl=new Date(day).toLocaleDateString('pl-PL',{weekday:'long',day:'numeric',month:'long'});
    return`<div style="margin-bottom:18px"><div class="sec" style="margin-top:0">${lbl}</div>
      ${ss.map(s=>`<div class="hi">
        <div>
          <div class="hi-d">${new Date(s.created_at).toLocaleTimeString('pl-PL',{hour:'2-digit',minute:'2-digit'})}</div>
          <div style="font-size:12px">${s.exercise_name||'—'}</div>
          <div class="hi-dt">Baza: ${s.base_score} pkt | Bonusy: +${s.bonus_score} pkt</div>
        </div>
        <div class="hi-sc">${s.total_score}</div>
      </div>`).join('')}</div>`;
  }).join('');
}

async function renderMatchHistory(el){
  const matches=await dbGet('matches',`user_id=eq.${S.user.id}&order=created_at.desc`);
  const all=matches||[];
  if(!all.length){
    el.innerHTML='<div class="empty"><span class="empty-ic">🏹</span><div class="empty-t">Brak rozegranych meczów</div><p class="empty-s">Zagraj swój pierwszy mecz!</p></div>';
    return;
  }
  // Pobierz rundy dla każdego meczu
  const matchIds=all.map(m=>m.id);
  const rounds=await dbGet('match_rounds',`match_id=in.(${matchIds.join(',')})&select=match_id,score_thrown`);
  const roundsMap={};
  (rounds||[]).forEach(r=>{
    if(!roundsMap[r.match_id]) roundsMap[r.match_id]=[];
    roundsMap[r.match_id].push(r.score_thrown);
  });

  const grp={};
  all.forEach(m=>{const d=m.created_at.slice(0,10);(grp[d]=grp[d]||[]).push(m)});

  el.innerHTML=Object.entries(grp).map(([day,ms])=>{
    const lbl=new Date(day).toLocaleDateString('pl-PL',{weekday:'long',day:'numeric',month:'long'});
    return`<div style="margin-bottom:18px"><div class="sec" style="margin-top:0">${lbl}</div>
      ${ms.map(m=>{
        const rds=roundsMap[m.id]||[];
        const totalThrown=rds.reduce((a,b)=>a+b,0);
        const avg=rds.length?Math.round(totalThrown/rds.length):0;
        const statusLabel=m.status==='finished'?'Wygrana':m.status==='abandoned'?'Przerwany':'W toku';
        const statusCls=m.status==='finished'?'won':m.status==='abandoned'?'abandoned':'lost';
        const startedAt=new Date(m.created_at).toLocaleTimeString('pl-PL',{hour:'2-digit',minute:'2-digit'});
        const remaining=m.current_score;
        return`<div class="hi-match">
          <div class="hi-match-hdr">
            <div>
              <div class="hi-match-title">🏹 Mecz ${m.start_score}</div>
              <div class="hi-d">${startedAt}</div>
            </div>
            <span class="hi-match-status ${statusCls}">${statusLabel}</span>
          </div>
          <div class="hi-match-stats">
            <div class="hi-match-stat">
              <div class="hi-match-stat-val">${rds.length}</div>
              <div class="hi-match-stat-lbl">Rund</div>
            </div>
            <div class="hi-match-stat">
              <div class="hi-match-stat-val">${avg}</div>
              <div class="hi-match-stat-lbl">Śr. seria</div>
            </div>
            <div class="hi-match-stat">
              <div class="hi-match-stat-val" style="color:${m.status==='finished'?'var(--success)':(remaining<100?'var(--warn)':'var(--text)')}}">${m.status==='finished'?'0':remaining}</div>
              <div class="hi-match-stat-lbl">${m.status==='finished'?'Checkout':'Zostało'}</div>
            </div>
          </div>
        </div>`;
      }).join('')}</div>`;
  }).join('');
}

// ═══════════════════════════════════════════════
//  PROFILE
// ═══════════════════════════════════════════════
async function renderProfile(){
  const u=S.user;
  // Avatar
  const avEl=document.getElementById('profile-avatar-big');
  if(u.avatar_url) avEl.innerHTML=`<img class="avatar-big" src="${u.avatar_url}" alt="avatar"/>`;
  else avEl.innerHTML=`<div class="avatar-big-placeholder">🎯</div>`;
  // Pola
  document.getElementById('profile-firstname').value=u.first_name||'';
  document.getElementById('profile-age').value=u.age||'';
  document.getElementById('profile-favplayer').value=u.favorite_player||'';
  document.getElementById('profile-dartbrand').value=u.dart_brand||'';
  document.getElementById('profile-dartweight').value=u.dart_weight||'';
  // Input mode
  const mode=u.input_mode||'series';
  selectInputMode(mode,false);
  // Doubles picker
  const favDoubles=u.favorite_doubles||[];
  const dp=document.getElementById('doubles-picker');
  dp.innerHTML=[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,'BULL'].map(d=>{
    const val=d==='BULL'?25:d;
    const on=favDoubles.includes(val);
    return`<button class="dbl-chip${on?' on':''}" onclick="toggleDouble(${val},this)">D${d}</button>`;
  }).join('');
  // Stats
  try{
    const sessions=await dbGet('sessions',`user_id=eq.${u.id}&select=total_score,exercise_name`);
    const all=sessions||[];
    const best=all.length?Math.max(...all.map(s=>s.total_score)):0;
    document.getElementById('profile-stats').innerHTML=`
      <div class="profile-stat"><span class="ps-lbl">Pseudonim</span><span class="ps-val">${u.username}</span></div>
      <div class="profile-stat"><span class="ps-lbl">Sesji treningowych</span><span class="ps-val">${all.length}</span></div>
      <div class="profile-stat"><span class="ps-lbl">Najlepszy wynik</span><span class="ps-val">${best} pkt</span></div>
      <div class="profile-stat"><span class="ps-lbl">Streak</span><span class="ps-val">🔥 ${u.streak||0} dni</span></div>`;
  }catch(e){document.getElementById('profile-stats').innerHTML='<p style="color:var(--muted);font-size:13px">Błąd ładowania statystyk</p>';}
}

function toggleDouble(val,btn){
  let favDoubles=S.user.favorite_doubles||[];
  if(favDoubles.includes(val)){favDoubles=favDoubles.filter(d=>d!==val);btn.classList.remove('on');}
  else{favDoubles.push(val);btn.classList.add('on');}
  S.user.favorite_doubles=favDoubles;
}

function selectInputMode(mode, updateUser=true){
  S.user.input_mode=mode;
  document.getElementById('profile-mode-series')?.classList.toggle('on',mode==='series');
  document.getElementById('profile-mode-single')?.classList.toggle('on',mode==='single');
  const desc=document.getElementById('p-mode-desc');
  if(desc){
    desc.textContent=mode==='series'
      ?'Wpisujesz łączny wynik po 3 rzutach (np. 60, 100, 45...).'
      :'Wpisujesz wynik każdej lotki osobno — aplikacja sumuje po 3 rzutach.';
  }
}

async function saveProfile(){
  loading(true,'Zapisywanie profilu...');
  try{
    const payload={
      first_name:document.getElementById('profile-firstname').value.trim()||null,
      age:+document.getElementById('profile-age').value||null,
      favorite_player:document.getElementById('profile-favplayer').value.trim()||null,
      dart_brand:document.getElementById('profile-dartbrand').value.trim()||null,
      dart_weight:+document.getElementById('profile-dartweight').value||null,
      favorite_doubles:S.user.favorite_doubles||[],
      input_mode:S.user.input_mode||'series'
    };
    await dbPatch('users',`id=eq.${S.user.id}`,payload);
    Object.assign(S.user,payload);
    showToast('✅ Profil zapisany!');
  }catch(e){await caAlert(e.message,'❌','Błąd');}
  finally{loading(false);}
}

async function handleAvatarUpload(input){
  const file=input.files[0];if(!file)return;
  const allowed=['image/jpeg','image/png','image/webp'];
  if(!allowed.includes(file.type)){await caAlert('Dozwolone formaty to JPG, PNG i WebP.','📁','Zły format');input.value='';return}
  if(file.size>5*1024*1024){await caAlert('Plik jest za duży. Maksymalny rozmiar to 5 MB.','📦','Za duży plik');input.value='';return}
  loading(true,'Przesyłanie zdjęcia...');
  try{
    // Zawsze jpeg żeby uniknąć problemów z rozszerzeniem
    const ext=file.type==='image/png'?'png':'jpg';
    const fileName=`avatar_${S.user.id}.${ext}`;
    // Upsert — nadpisuje istniejący plik tego samego użytkownika
    const uploadRes=await fetch(`${SB_URL}/storage/v1/object/avatars/${fileName}`,{
      method:'POST',
      headers:{
        'apikey':SB_KEY,
        'Authorization':'Bearer '+SB_KEY,
        'Content-Type':file.type,
        'x-upsert':'true'
      },
      body:file
    });
    if(!uploadRes.ok){
      const errData=await uploadRes.json().catch(()=>({}));
      throw new Error(errData.message||errData.error||`HTTP ${uploadRes.status}`);
    }
    // Cache-bust żeby przeglądarka nie pokazywała starego zdjęcia
    const avatarUrl=`${SB_URL}/storage/v1/object/public/avatars/${fileName}?t=${Date.now()}`;
    await dbPatch('users',`id=eq.${S.user.id}`,{avatar_url:`${SB_URL}/storage/v1/object/public/avatars/${fileName}`});
    S.user.avatar_url=avatarUrl;
    // Odśwież avatary wszędzie
    renderProfile();
    const avEl=document.getElementById('home-avatar');
    if(avEl)avEl.innerHTML=`<img class="avatar-sm" src="${avatarUrl}" alt="avatar"/>`;
    showToast('✅ Zdjęcie zaktualizowane!');
  }catch(e){await caAlert(e.message,'❌','Błąd przesyłania');}
  finally{loading(false);input.value='';}
}

// ═══════════════════════════════════════════════
//  CHECKOUT HINTS — tabela zakończeń
// ═══════════════════════════════════════════════
const CHECKOUTS={
  170:'T20, T20, DB',169:null,168:null,
  167:'T20, T19, DB',166:null,165:null,
  164:'T20, T18, DB',163:null,162:null,
  161:'T20, T17, DB',
  160:'T20, T20, D20',159:null,
  158:'T20, T20, D19',157:'T20, T19, D20',156:'T20, T20, D18',
  155:'T20, T19, D19',154:'T20, T18, D20',153:'T20, T19, D18',
  152:'T20, T20, D16',151:'T20, T17, D20',150:'T20, T18, D18',
  149:'T20, T19, D16',148:'T20, T20, D14',147:'T20, T17, D18',
  146:'T20, T18, D16',145:'T20, T15, D20',144:'T20, T20, D12',
  143:'T20, T17, D16',142:'T20, T14, D20',141:'T20, T19, D12',
  140:'T20, T20, D10',139:'T20, T13, D20',138:'T20, T18, D12',
  137:'T20, T19, D10',136:'T20, T20, D8',135:'T20, T17, D12',
  134:'T20, T14, D16',133:'T20, T19, D8',132:'T20, T16, D12',
  131:'T20, T13, D16',130:'T20, T20, D5',129:'T19, T16, D12',
  128:'T18, T14, D16',127:'T20, T17, D8',126:'T19, T19, D6',
  125:'DB, T15, D20',124:'T20, T16, D8',123:'T19, T16, D9',
  122:'T18, T18, D7',121:'T20, T11, D14',120:'T20, 20, D20',
  119:'T19, 12, D20',118:'T20, 18, D20',117:'T20, 17, D20',
  116:'T20, 16, D20',115:'T20, 15, D20',114:'T20, 14, D20',
  113:'T20, 13, D20',112:'T20, 12, D20',111:'T20, 11, D20',
  110:'T20, 10, D20',109:'T20, 9, D20',108:'T20, 8, D20',
  107:'T19, 10, D20',106:'T20, 6, D20',105:'T20, 5, D20',
  104:'T18, 10, D20',103:'T19, 6, D20',102:'T20, 2, D20',
  101:'T17, 10, D20',100:'T20, D20',
  99:'T19, 10, D16',98:'T20, D19',97:'T19, D20',96:'T20, D18',
  95:'T19, D19',94:'T18, D20',93:'T19, D18',92:'T20, D16',
  91:'T17, D20',90:'T18, D18',89:'T19, D16',88:'T20, D14',
  87:'T17, D18',86:'T18, D16',85:'T15, D20',84:'T20, D12',
  83:'T17, D16',82:'DB, D16',81:'T19, D12',80:'T20, D10',
  79:'T19, D11',78:'T18, D12',77:'T19, D10',76:'T20, D8',
  75:'T17, D12',74:'T14, D16',73:'T19, D8',72:'T16, D12',
  71:'T13, D16',70:'T18, D8',69:'T19, D6',68:'T20, D4',
  67:'T17, D8',66:'T10, D18',65:'T19, D4',64:'T16, D8',
  63:'T13, D12',62:'T10, D16',61:'T15, D8',
  60:'20, D20',59:'19, D20',58:'18, D20',57:'17, D20',
  56:'16, D20',55:'15, D20',54:'14, D20',53:'13, D20',
  52:'12, D20',51:'11, D20',50:'10, D20',49:'9, D20',
  48:'16, D16',47:'15, D16',46:'14, D16',45:'13, D16',
  44:'12, D16',43:'11, D16',42:'10, D16',41:'9, D16',
  40:'D20',38:'D19',36:'D18',34:'D17',32:'D16',
  30:'D15',28:'D14',26:'D13',24:'D12',22:'D11',
  20:'D10',18:'D9',16:'D8',14:'D7',12:'D6',
  10:'D5',8:'D4',6:'D3',4:'D2',2:'D1'
};

function getCheckout(score){
  if(score in CHECKOUTS) return CHECKOUTS[score]; // null means explicitly no checkout
  return undefined; // not in table = score too high or odd number not mapped
}

function getFavCheckout(score){
  const favDoubles=S.user.favorite_doubles||[];
  if(!favDoubles.length) return null;
  const checkout=CHECKOUTS[score];
  if(!checkout) return null; // null or undefined
  for(const fav of favDoubles){
    const dStr=fav===25?'DB':`D${fav}`;
    if(checkout.includes(dStr)) return checkout;
  }
  return null;
}

function renderHint(score){
  const el=document.getElementById('hint-area');
  if(score>170||score<=1){el.innerHTML='';return}
  const checkout=getCheckout(score);
  // null = explicitly no checkout, undefined = not in table
  if(checkout===null){
    el.innerHTML=`<div class="hint-box"><div class="hint-title">💡 Checkout</div><div class="hint-no">❌ Brak możliwości zakończenia z ${score} pkt w 3 rzutach</div></div>`;
    return;
  }
  if(checkout===undefined){
    // Nieparzysta liczba niepokryta tabelą — brak standardowego checkoutu
    if(score%2!==0&&score<40){
      el.innerHTML=`<div class="hint-box"><div class="hint-title">💡 Checkout</div><div class="hint-no">⚠️ Nieparzysta liczba — najpierw wbij single aby zejść na parzyste</div></div>`;
    }else{
      el.innerHTML='';
    }
    return;
  }
  const favCo=getFavCheckout(score);
  el.innerHTML=`<div class="hint-box">
    <div class="hint-title">
      💡 Checkout z ${score} pkt
      <button class="hint-info-btn" onclick="showAllCheckouts(${score})">ℹ️ wszystkie</button>
    </div>
    ${favCo&&favCo!==checkout?`<div class="hint-fav">⭐ Twój ulubiony: ${favCo}</div>`:''}
    <div class="hint-main">${favCo||checkout}</div>
  </div>`;
}

function showAllCheckouts(score){
  const modal=document.getElementById('checkout-modal');
  const content=document.getElementById('checkout-modal-content');
  // Pokaż wszystkie checkouty w okolicach aktualnego score
  const nearby=[];
  for(let s=Math.min(score+5,170);s>=Math.max(score-20,2);s--){
    const co=CHECKOUTS[s];
    if(co) nearby.push({score:s,checkout:co});
  }
  const favDoubles=S.user.favorite_doubles||[];
  content.innerHTML=`<table class="checkout-table">
    <thead><tr><th>Wynik</th><th>Zakończenie</th></tr></thead>
    <tbody>${nearby.map(({score:s,checkout:co})=>{
      const isFav=favDoubles.some(f=>{const d=f===25?'DB':`D${f}`;return co.includes(d);});
      const isCurrent=s===score;
      return`<tr class="${isFav?'fav-row':''}" style="${isCurrent?'background:rgba(232,255,71,.05)':''}">
        <td><strong>${s}</strong>${isCurrent?' ←':''}</td>
        <td>${co}${isFav?' ⭐':''}</td>
      </tr>`;
    }).join('')}</tbody>
  </table>`;
  modal.classList.add('show');
}

function closeCheckoutModal(e){
  if(e.target===document.getElementById('checkout-modal'))
    document.getElementById('checkout-modal').classList.remove('show');
}
function closeMatchModal(e){
  if(e.target===document.getElementById('match-modal'))
    document.getElementById('match-modal').classList.remove('show');
}
function showGameModal(){
  document.getElementById('game-modal').classList.add('show');
}
function closeGameModal(e){
  if(e.target===document.getElementById('game-modal'))
    document.getElementById('game-modal').classList.remove('show');
}
function closeGameModalAndGo(tab){
  document.getElementById('game-modal').classList.remove('show');
  goTab(tab);
}

// ═══════════════════════════════════════════════
//  MATCH 501
// ═══════════════════════════════════════════════
let matchRounds=[];
let npBuffer='';
let singleThrows=[]; // dla trybu "co rzut" — przechowuje max 3 rzuty

// ═══════════════════════════════════════════════
//  CUSTOM ALERT & CONFIRM — bez brzydkich nagłówków przeglądarki
// ═══════════════════════════════════════════════
let caResolve=null;

function caShow(icon,title,msg,buttons){
  document.getElementById('ca-icon').textContent=icon;
  document.getElementById('ca-title').textContent=title;
  document.getElementById('ca-msg').textContent=msg;
  const btns=document.getElementById('ca-btns');
  btns.className='ca-btns'+(buttons.length>1?' two':'');
  btns.innerHTML=buttons.map((b,i)=>
    `<button class="ca-btn ${b.cls}" onclick="caClick(${i})">${b.label}</button>`
  ).join('');
  document.getElementById('ca-overlay').classList.add('show');
  return new Promise(r=>caResolve=r);
}

function caClick(idx){
  document.getElementById('ca-overlay').classList.remove('show');
  if(caResolve){caResolve(idx);caResolve=null;}
}

// Zamienniki dla alert() i confirm()
function caAlert(msg,icon='ℹ️',title='Informacja'){
  return caShow(icon,title,msg,[{label:'OK',cls:'primary'}]);
}
function caConfirm(msg,icon='❓',title='Potwierdzenie'){
  return caShow(icon,title,msg,[{label:'Anuluj',cls:'outline'},{label:'Tak',cls:'primary'}]);
}
function caDanger(msg,icon='🗑️',title='Usuń'){
  return caShow(icon,title,msg,[{label:'Anuluj',cls:'outline'},{label:'Usuń',cls:'danger'}]);
}
function caWin(msg){
  return caShow('🏆','Gratulacje!',msg,[{label:'Super!',cls:'primary'}]);
}
function caOver(msg){
  return caShow('⚠️','Przekroczenie',msg,[{label:'OK',cls:'outline'}]);
}

const TOOLTIP_KEY='dartpro_tooltip_shown';

function showMatchTooltip(){
  if(localStorage.getItem(TOOLTIP_KEY)) return; // już widzieli
  const el=document.getElementById('match-tooltip');
  if(el) el.style.display='block';
}

function dismissTooltip(){
  localStorage.setItem(TOOLTIP_KEY,'1');
  const el=document.getElementById('match-tooltip');
  if(el){
    el.style.animation='slideUp .2s ease reverse';
    setTimeout(()=>el.style.display='none',200);
  }
}

async function initMatch(){
  loading(true,'Sprawdzanie meczu...');
  try{
    const matches=await dbGet('matches',`user_id=eq.${S.user.id}&status=eq.active&order=created_at.desc&limit=1`);
    if(matches&&matches.length){
      // Jest aktywny mecz - pytaj czy kontynuować
      S.match=matches[0];
      const rounds=await dbGet('match_rounds',`match_id=eq.${S.match.id}&order=round_number.asc`);
      matchRounds=rounds||[];
      npBuffer='';
      renderMatch();
      showMatchPopup(true);
    }else{
      S.match=null;matchRounds=[];npBuffer='';
      renderMatch();
      showMatchPopup(false);
    }
  }catch(e){S.match=null;matchRounds=[];npBuffer='';renderMatch();showMatchPopup(false);}
  finally{loading(false);}
}

function showMatchPopup(hasActive){
  const modal=document.getElementById('match-modal');
  const content=document.getElementById('match-modal-content');
  if(hasActive){
    const sc=S.match.current_score;
    const st=S.match.start_score;
    content.innerHTML=`
      <p style="font-size:13px;color:var(--muted);margin-bottom:16px">Masz niedokończony mecz ${st} — zostało Ci <strong style="color:var(--accent)">${sc} pkt</strong>.</p>
      <div class="g10">
        <button class="block-btn bb-primary" onclick="continueMatch()">▶️ Kontynuuj (${sc} pkt)</button>
        <div style="text-align:center;font-size:12px;color:var(--muted);margin:4px 0">lub zacznij nowy</div>
        <div class="match-type-grid">
          <button class="match-type-btn" onclick="startNewMatch(301)">301</button>
          <button class="match-type-btn" onclick="startNewMatch(501)">501</button>
          <button class="match-type-btn" onclick="startNewMatch(701)">701</button>
        </div>
      </div>`;
  }else{
    content.innerHTML=`
      <p style="font-size:13px;color:var(--muted);margin-bottom:16px">Wybierz wariant gry:</p>
      <div class="match-type-grid">
        <button class="match-type-btn" onclick="startNewMatch(301)">301</button>
        <button class="match-type-btn" onclick="startNewMatch(501)">501</button>
        <button class="match-type-btn" onclick="startNewMatch(701)">701</button>
      </div>`;
  }
  modal.classList.add('show');
}

function continueMatch(){
  document.getElementById('match-modal').classList.remove('show');
  singleThrows=[];npBuffer='';
  renderMatch();
  setTimeout(showMatchTooltip, 400);
}

async function startNewMatch(startScore){
  document.getElementById('match-modal').classList.remove('show');
  loading(true,'Tworzenie meczu...');
  try{
    if(S.match)await dbPatch('matches',`id=eq.${S.match.id}`,{status:'abandoned',finished_at:new Date().toISOString()});
    const res=await dbPost('matches',{user_id:S.user.id,start_score:startScore,current_score:startScore,status:'active'});
    S.match=res[0];matchRounds=[];npBuffer='';singleThrows=[];
    renderMatch();
    setTimeout(showMatchTooltip, 400);
  }catch(e){await caAlert(e.message,'❌','Błąd');}
  finally{loading(false);}
}

async function newMatch(){
  showMatchPopup(!!S.match);
}



function renderMatch(){
  const score=S.match?S.match.current_score:501;
  const mode=S.user?.input_mode||'series';
  document.getElementById('match-score').textContent=score;
  document.getElementById('match-sub').textContent=S.match
    ?(mode==='single'?`Runda ${matchRounds.length+1} – rzut ${singleThrows.length+1}/3`:`Runda ${matchRounds.length+1}`)
    :'Kliknij "Nowy" aby zacząć mecz';
  document.getElementById('np-display').textContent=npBuffer||'—';
  // Pokaż counter rzutów w trybie single
  const tcWrap=document.getElementById('throw-counter-wrap');
  if(tcWrap) tcWrap.style.display=(mode==='single'&&S.match)?'block':'none';
  if(mode==='single'&&S.match){
    const pts=document.getElementById('single-throw-pts');
    if(pts) pts.textContent=`Rzut ${singleThrows.length+1} z 3`;
    [0,1,2].forEach(i=>{
      const dot=document.getElementById('tdot-'+i);
      if(!dot)return;
      dot.className='throw-dot'+(i<singleThrows.length?' done':i===singleThrows.length?' current':'');
    });
    const prev=document.getElementById('single-throws-preview');
    if(prev) prev.innerHTML=singleThrows.map((v,i)=>`<span style="color:var(--accent);font-weight:700">${v}</span>`).join('<span style="color:var(--muted)"> + </span>');
  }
  renderHint(score);
  // Rundy
  const el=document.getElementById('rounds-list');
  if(!matchRounds.length){el.innerHTML='<div class="empty"><span class="empty-ic">🏹</span><div class="empty-t">Brak rund</div></div>';return}
    el.innerHTML=(matchRounds||[]).slice().reverse().map(r=>{
    const isBust=(r.bust===true)||(r.score_thrown===0&&r.score_after>0);
    const scoreColor=isBust?'var(--danger)':'var(--accent2)';
    const scoreText=isBust?'BUST':('-'+r.score_thrown);
    const throwsHtml=r.throws?('<span style="font-size:11px;color:var(--muted)">'+r.throws.join(' + ')+'</span>'):'';
    return'<div class="round-item" style="'+(isBust?'opacity:0.55':'')+'">'
      +'<span class="ri-rnd">Runda '+r.round_number+'</span>'
      +'<span class="ri-score" style="color:'+scoreColor+'">'+scoreText+'</span>'
      +'<span class="ri-after">'+r.score_after+' pkt</span>'
      +throwsHtml
      +'</div>';
  }).join('');
}

function npPress(d){
  if(!S.match){showToast('🏹 Najpierw utwórz mecz');return}
  const mode=S.user?.input_mode||'series';
  const maxLen=mode==='single'?2:3;
  if(npBuffer.length>=maxLen)return;
  console.log('[NUMPAD] press: d='+d+', buffer='+npBuffer+', mode='+mode+', current='+S.match.current_score);

  const candidate=npBuffer+d;
  const candidateVal=parseInt(candidate);

  if(mode==='single'){
    // Blokuj wartości >60 już podczas wpisywania
    if(candidateVal>60){
      // Pokoloruj display na czerwono jako feedback
      const disp=document.getElementById('np-display');
      disp.style.color='var(--danger)';
      setTimeout(()=>disp.style.color='',600);
      showToast('⚠️ Max 60 pkt na rzut (T20)');
      return;
    }
  }else{
    // Seria: blokuj >180
    if(candidateVal>180){
      const disp=document.getElementById('np-display');
      disp.style.color='var(--danger)';
      setTimeout(()=>disp.style.color='',600);
      showToast('⚠️ Max 180 pkt na serię');
      return;
    }
  }

  npBuffer=candidate;
  document.getElementById('np-display').textContent=npBuffer;
}

function npDel(){
  npBuffer=npBuffer.slice(0,-1);
  document.getElementById('np-display').textContent=npBuffer||'—';
}

async function npConfirm(){
  if(!S.match){await caAlert('Kliknij przycisk Nowy aby rozpocząć mecz.','🏹','Brak meczu');return}
  const mode=S.user?.input_mode||'series';
  const val=parseInt(npBuffer);
  console.log('[NUMPAD] confirm: val='+val+', mode='+mode+', current='+S.match.current_score+', singleThrows='+JSON.stringify(singleThrows));

  if(isNaN(val)||val<0){
    await caAlert('Wpisz wynik rzutu na klawiaturze.','🎯','Brak wyniku');npBuffer='';
    document.getElementById('np-display').textContent='—';return;
  }

  if(mode==='single'){
    if(val>60){await caAlert('Maksymalny wynik jednego rzutu to 60 punktów (T20).','⚠️','Za dużo');npBuffer='';document.getElementById('np-display').textContent='—';return}
    singleThrows.push(val);
    npBuffer='';
    document.getElementById('np-display').textContent='—';

    const partialSum=singleThrows.reduce((a,b)=>a+b,0);
    const current=S.match.current_score;
    const scoreAfter=current-partialSum;
    console.log('[MATCH-SINGLE] Rzut '+singleThrows.length+'/3: val='+val+', partialSum='+partialSum+', current='+current+', scoreAfter='+scoreAfter);

    // Przekroczenie — seria przepada, zapisz rundę z 0 pkt
    if(scoreAfter<0){
      console.log('[MATCH-SINGLE] BUST! scoreAfter='+scoreAfter+', saving bust round...');
      showToast('💥 BUST po '+singleThrows.length+'. rzucie! Seria przepada. Zostało: '+current+' pkt.');
      const bustNum = matchRounds.length + 1;
      try{
        const bustRow = await dbPost('match_rounds',{
  match_id: S.match.id,
  round_number: bustNum,
  score_thrown: 0,
  score_after: current
});
// ZMIANA: obsługa null gdy odpowiedź 204
const bustSaved = bustRow ? { ...bustRow[0], bust: true } : { round_number: bustNum, score_thrown: 0, score_after: current, bust: true };
matchRounds.push(bustSaved);
console.log('[MATCH-SINGLE] Bust round '+bustNum+' saved, score stays: '+current);
      }catch(e){
        console.warn('[MATCH-SINGLE] Bust save failed:', e.message);
      }
      singleThrows=[];
      npBuffer='';
      document.getElementById('np-display').textContent='—';
      renderMatch();
      return;
    }

    // WYGRANA — kończymy natychmiast bez czekania na pozostałe rzuty
    if(scoreAfter===0){
      console.log('[MATCH] Wygrana w trybie rzut! rzut='+val+', partialSum='+partialSum+', rzutów w serii='+singleThrows.length);
      const throwsSnapshot=[...singleThrows];
      singleThrows=[];
      await saveRound(partialSum, throwsSnapshot);
      return;
    }

    // Wynik 1 niemożliwy — seria przepada, zapisz rundę z 0 pkt
    if(scoreAfter===1){
      console.log('[MATCH-SINGLE] BUST scoreAfter=1, saving bust round...');
      showToast('💥 BUST! Wynik 1 pkt niemożliwy. Seria przepada. Zostało: '+current+' pkt.');
      const bn1=matchRounds.length+1;
      try{
        const br1=await dbPost('match_rounds',{match_id:S.match.id,round_number:bn1,score_thrown:0,score_after:current});
        matchRounds.push({...br1[0],bust:true});
        console.log('[MATCH-SINGLE] Bust-1 round '+bn1+' saved, score stays: '+current);
      }catch(e){console.warn('[MATCH-SINGLE] Bust-1 save failed:',e.message);}
      singleThrows=[];npBuffer='';
      document.getElementById('np-display').textContent='—';
      renderMatch();return;
    }

    // Czekaj na kolejny rzut (max 3)
    if(singleThrows.length<3){renderMatch();return;}

    // 3 rzuty zużyte — zapisz serię
    const throwsSnapshot=[...singleThrows];
    singleThrows=[];
    await saveRound(partialSum, throwsSnapshot);

  }else{
    // Tryb co seria
    if(val>180){await caAlert('Maksymalny wynik serii 3 rzutów to 180 punktów.','⚠️','Za dużo');npBuffer='';document.getElementById('np-display').textContent='—';return}
    const curForLog = Number(S.match.current_score);
    console.log('[MATCH] Seria zatwierdzona. val='+val+', current='+curForLog+', after='+(curForLog-val));
    npBuffer='';
    document.getElementById('np-display').textContent='—';
    await saveRound(val, null);
  }
}

async function saveRound(thrown, throwsArr){
  const current = Number(S.match.current_score);
  const after = current - thrown;

  console.log('[MATCH] saveRound called:', {thrown, current, after, throwsArr});

    // BUST — za dużo lub wynik 1 (niemożliwy checkout)
  if(after < 0 || after === 1){
    const bustMsg = after < 0
      ? '💥 BUST! '+thrown+' > '+current+' pkt. Seria przepada!'
      : '💥 BUST! Wynik 1 pkt niemożliwy. Seria przepada!';
    console.log('[MATCH] BUST! after='+after+', thrown='+thrown+', current='+current);
    showToast(bustMsg);

    // Zapisz bust jako rundę z 0 pkt żeby licznik rund rósł
    const bustRoundNum = matchRounds.length + 1;
    try{
      const bustRow = await dbPost('match_rounds',{
  match_id: S.match.id,
  round_number: bustRoundNum,
  score_thrown: 0,
  score_after: current
});
// ZMIANA: obsługa null gdy odpowiedź 204
const bustSaved = bustRow ? { ...bustRow[0], bust: true } : { round_number: bustRoundNum, score_thrown: 0, score_after: current, bust: true };
matchRounds.push(bustSaved);
console.log('[MATCH] Bust saved as round '+bustRoundNum+', score stays: '+current);
    }catch(e){
      console.warn('[MATCH] Bust save failed:', e.message);
    }

    singleThrows = [];
    npBuffer = '';
    document.getElementById('np-display').textContent = '—';
    renderMatch();
    return;
  }

  
  console.log('[MATCH] Saving round to DB... roundNum='+(matchRounds.length+1));
  loading(true, 'Zapisywanie rundy...');

  try{
    const roundNum = matchRounds.length + 1;
   const roundRow = await dbPost('match_rounds',{
  match_id: S.match.id,
  round_number: roundNum,
  score_thrown: thrown,
  score_after: after
});
// ZMIANA: obsługa null
const savedRound = roundRow ? { ...roundRow[0] } : { round_number: roundNum, score_thrown: thrown, score_after: after };
if(throwsArr) savedRound.throws = throwsArr;
matchRounds.push(savedRound);

    const isWin = (after === 0);
    console.log('[MATCH] isWin='+isWin+', after='+after);

    await dbPatch('matches', 'id=eq.'+S.match.id, {
      current_score: after,
      status: isWin ? 'finished' : 'active',
      finished_at: isWin ? new Date().toISOString() : null
    });
    console.log('[MATCH] Match updated in DB: current_score='+after+', status='+(isWin?'finished':'active'));

    S.match.current_score = after;
    S.match.status = isWin ? 'finished' : 'active';
    loading(false);

    if(isWin){
      console.log('[MATCH] 🏆 WYGRANA! Wyświetlam UI wygranej...');

      // Reset bufferów
      npBuffer = ''; singleThrows = [];
      document.getElementById('np-display').textContent = '—';

      // Aktualizuj licznik na 0
      document.getElementById('match-score').textContent = '0';
      document.getElementById('match-sub').textContent = '🏆 WYGRANA!';
      document.getElementById('hint-area').innerHTML = '';
      document.getElementById('rounds-list').innerHTML = '';

      // Zablokuj klawiaturę
      document.querySelectorAll('.np-btn').forEach(b => b.disabled = true);
      console.log('[MATCH] Klawiatura zablokowana, czekam 400ms na popup...');

      const startScore = S.match.start_score || 501;

      // Popup po opóźnieniu
      setTimeout(async function(){
        console.log('[MATCH] Pokazuję popup wygranej...');
        const choice = await caShow(
          '🏆', 'Wygrana!',
          'Mecz '+startScore+' ukończony w '+roundNum+' rundach! Ostatni rzut: '+thrown+' pkt',
          [
            {label:'🔁 Zagraj ponownie', cls:'primary'},
            {label:'⚔️ Gra Online', cls:'outline'},
            {label:'← Menu', cls:'outline'}
          ]
        );
        console.log('[MATCH] Wybór w popupie:', choice);

        // Odblokuj klawiaturę
        document.querySelectorAll('.np-btn').forEach(b => b.disabled = false);
        S.match = null; matchRounds = []; singleThrows = []; npBuffer = '';

        if(choice === 0){
          console.log('[MATCH] Nowy mecz solo:', startScore);
          await startNewMatch(startScore);
        } else if(choice === 1){
          console.log('[MATCH] Przejście do multiplayer');
          goTab('multiplayer');
        } else {
          console.log('[MATCH] Powrót do menu');
          goTab('home');
        }
      }, 400);

      return;
    }

    // Kontynuuj grę
    console.log('[MATCH] Kontynuacja gry. Zostało: '+after+' pkt. Runda '+(roundNum+1));
    renderMatch();

  }catch(e){
    loading(false);
    console.error('[MATCH] Błąd zapisu:', e);
    showToast('❌ Błąd zapisu: ' + e.message);
    singleThrows = [];
    npBuffer = '';
    renderMatch();
  }
}

// ═══════════════════════════════════════════════
//  ADMIN
// ═══════════════════════════════════════════════
function aTab(t){
  document.querySelectorAll('.atab').forEach((el,i)=>el.classList.toggle('on',['exercises','leaderboard'][i]===t));
  document.getElementById('tab-exercises').classList.toggle('on',t==='exercises');
  document.getElementById('tab-leaderboard').classList.toggle('on',t==='leaderboard');
  if(t==='leaderboard')renderLB();
}
function selNewType(t){
  S.newType=t;
  document.getElementById('admin-type-shanghai').classList.toggle('on',t==='shanghai');
  document.getElementById('admin-type-doubles').classList.toggle('on',t==='doubles');
  initNewRules(t);
}
async function addExercise(){
  const name=document.getElementById('admin-ex-name').value.trim();
  const desc=document.getElementById('admin-ex-description').value.trim();
  const rules=document.getElementById('new-rl').value.trim();
  const tgRaw=document.getElementById('admin-ex-targets').value.trim();
  if(!name){await caAlert('Wpisz nazwę ćwiczenia.','✏️','Brak nazwy');return}
  if(!tgRaw){await caAlert('Wpisz sektory oddzielone przecinkami, np. 10,11,12.','🎯','Brak sektorów');return}
  const targets=tgRaw.split(',').map(t=>{const s=t.trim();return s==='BULL'?'BULL':parseInt(s)}).filter(t=>t==='BULL'||!isNaN(t));
  if(!targets.length){await caAlert('Sektory muszą być liczbami lub słowem BULL, oddzielonymi przecinkami.','⚠️','Błąd sektorów');return}
  if(!NEW_RULES.length){await caAlert('Musisz dodać co najmniej jedną regułę punktacji.','⚡','Brak reguł');return}
  const colors=['c1','c2','c3','c4','c5'];
  loading(true,'Zapisywanie...');
  try{
    await dbPost('exercises',{
      name,description:desc,type:S.newType,
      targets:JSON.stringify(targets),
      throws_per_target:S.newType==='doubles'?1:3,
      color:colors[S.exercises.length%5],enabled:true,
      scoring:JSON.stringify(NEW_RULES),rules,
      sort_order:S.exercises.length+1
    });
    await loadExercises();
    ['admin-ex-name','admin-ex-description','admin-ex-targets','new-rl'].forEach(id=>document.getElementById(id).value='');
    initNewRules(S.newType);renderAdminEx();showToast('✅ Ćwiczenie dodane!');
  }catch(e){await caAlert(e.message,'❌','Błąd');}
  finally{loading(false);}
}

function renderAdminEx(){
  document.getElementById('admin-ex-list').innerHTML=S.exercises.map((ex,i)=>{
    const rules=getRules(ex);
    return`<div class="ecard" id="ecard-${ex.id}">
      <div class="ecard-hdr" onclick="toggleCard('${ex.id}')">
        <div class="ecard-title"><em>${i+1}.</em> ${ex.name}
          <span id="saving-dot-${ex.id}" class="saving-dot" style="display:none"></span>
        </div>
        <div class="ecard-right">
          <label class="tog" onclick="event.stopPropagation()">
            <input type="checkbox" ${ex.enabled!==false?'checked':''} onchange="toggleEx('${ex.id}',this.checked)">
            <span class="tog-sl"></span>
          </label>
          <span class="chevron" id="chev-${ex.id}">▼</span>
        </div>
      </div>
      <div class="ecard-body" id="ebody-${ex.id}">
        <div class="erow"><label class="lbl">Nazwa</label>
          <input class="inp" data-id="${ex.id}" data-f="name" value="${ex.name}" oninput="localUpdate(this);scheduleAutoSave('${ex.id}')"/></div>
        <div class="erow"><label class="lbl">Opis</label>
          <input class="inp" data-id="${ex.id}" data-f="description" value="${ex.description||''}" oninput="localUpdate(this);scheduleAutoSave('${ex.id}')"/></div>
        <div class="erow"><label class="lbl">Typ</label>
          <div style="font-size:13px;color:var(--muted);padding:8px 0">${ex.type==='shanghai'?'🎯 Shanghai (3 lotki / liczba)':'✌️ Doublesy (1 lotka / double)'}</div></div>
        <div class="erow"><label class="lbl">Sektory</label>
          <div style="font-size:13px;color:var(--muted);padding:8px 0">${ex.targets.join(', ')}</div></div>
        <div class="scoring-panel">
          <div class="sp-title">⚡ Reguły punktacji
            <button onclick="addExRule('${ex.id}')">+ Dodaj regułę</button>
          </div>
          <div id="rules-list-${ex.id}">${rules.map((r,ri)=>ruleRowHTML(r,ri,ex.id)).join('')}</div>
        </div>
        <div class="erow"><label class="lbl">Własne zasady (puste = auto)</label>
          <textarea class="inp" data-id="${ex.id}" data-f="rules" rows="2"
            oninput="localUpdate(this);scheduleAutoSave('${ex.id}')">${ex.rules||''}</textarea></div>
        <div class="g10" style="margin-top:4px">
          ${S.exercises.length>1?`<button class="block-btn bb-danger" onclick="deleteEx('${ex.id}')">🗑 Usuń ćwiczenie</button>`:''}
        </div>
      </div>
    </div>`;
  }).join('');
}

function toggleCard(id){
  const body=document.getElementById('ebody-'+id);const chev=document.getElementById('chev-'+id);
  const isOpen=body.classList.contains('open');
  body.classList.toggle('open',!isOpen);chev.classList.toggle('open',!isOpen);
}
function localUpdate(el){const ex=S.exercises.find(e=>e.id===el.dataset.id);if(ex)ex[el.dataset.f]=el.value;}
async function toggleEx(id,enabled){
  const ex=S.exercises.find(e=>e.id===id);if(!ex)return;
  ex.enabled=enabled;
  try{await dbPatch('exercises',`id=eq.${id}`,{enabled});}catch(e){await caAlert(e.message,'❌','Błąd');}
}
async function saveAll(){
  loading(true,'Zapisywanie...');
  try{
    for(const ex of S.exercises){
      // NOWY KOD:
const scoringData=getRules(ex);
      await dbPatch('exercises',`id=eq.${ex.id}`,{
        name:ex.name,description:ex.description,rules:ex.rules||null,
        scoring:scoringData,enabled:ex.enabled
      });
    }
    showToast('✅ Zapisano!');renderAdminEx();
  }catch(e){await caAlert(e.message,'❌','Błąd');}
  finally{loading(false);}
}
async function deleteEx(id){
  const _dc=await caDanger('Ćwiczenie zostanie trwale usunięte. Tej operacji nie można cofnąć.');if(_dc!==1)return;
  loading(true,'Usuwanie...');
  try{await dbDelete('exercises',`id=eq.${id}`);await loadExercises();renderAdminEx();showToast('🗑 Usunięto');}
  catch(e){await caAlert(e.message,'❌','Błąd');}
  finally{loading(false);}
}

async function renderLB(){
  const el=document.getElementById('admin-lb');
  el.innerHTML='<div class="empty"><div class="spinner" style="margin:20px auto"></div></div>';
  try{
    const users=await dbGet('users','is_admin=eq.false&select=id,username,streak,first_name');
    if(!users||!users.length){el.innerHTML='<div class="empty"><span class="empty-ic">🏆</span><div class="empty-t">Brak zawodników</div></div>';return}
    const sessions=await dbGet('sessions','select=user_id,total_score');
    const sessMap={};
    (sessions||[]).forEach(s=>{
      if(!sessMap[s.user_id])sessMap[s.user_id]={best:0,count:0};
      sessMap[s.user_id].best=Math.max(sessMap[s.user_id].best,s.total_score);
      sessMap[s.user_id].count++;
    });
    const ranked=users.map(u=>({
      name:u.first_name?`${u.first_name} (${u.username})`:u.username,
      best:sessMap[u.id]?.best||0,sessions:sessMap[u.id]?.count||0,streak:u.streak||0
    })).sort((a,b)=>b.best-a.best);
    el.innerHTML=ranked.map((r,i)=>`
      <div class="lbi">
        <div class="lb-rank" style="color:${i===0?'var(--accent)':i===1?'#bbb':'#cd7f32'}">${i+1}</div>
        <div><div class="lb-nm">${r.name}</div><div class="lb-sub">${r.sessions} sesji | 🔥 ${r.streak} dni</div></div>
        <div class="lb-sc">${r.best}</div>
      </div>`).join('');
  }catch(e){el.innerHTML='<div class="empty"><span class="empty-ic">⚠️</span><div class="empty-t">Błąd</div></div>';}
}

// ═══════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════
// ═══════════════════════════════════════════════
//  MULTIPLAYER
// ═══════════════════════════════════════════════
let MP={room:null,isHost:false,myThrows:[],npBuffer:'',_pollInterval:null};
let mpSelectedScore=501;

function initMpLobby(){
  document.getElementById('create-room-card').style.display='block';
  document.getElementById('waiting-card').style.display='none';
  document.getElementById('guest-waiting-card').style.display='none';
  document.getElementById('mp-join-code').value='';
  MP.npBuffer='';MP.myThrows=[];
  if(MP.room&&MP.room.status==='active'){showScreen('mp-game');renderMpGame();}
  else if(MP.room&&MP.room.status==='waiting'&&MP.isHost){showWaitingCard();}
}

function selectMpScore(score){
  mpSelectedScore=score;
  [301,501,701].forEach(s=>{
    const btn=document.getElementById('mp-'+s);
    if(btn){btn.style.borderColor=s===score?'var(--accent)':'';btn.style.background=s===score?'rgba(232,255,71,.08)':'';}
  });
}

async function createRoom(){
  loading(true,'Tworzenie pokoju...');
  try{
    // Generate unique code
    let code='';
    const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for(let i=0;i<4;i++) code+=chars[Math.floor(Math.random()*chars.length)];
    // Check uniqueness
    const existing=await dbGet('rooms',`code=eq.${code}&status=in.(waiting,active)`);
    if(existing&&existing.length) code+=chars[Math.floor(Math.random()*chars.length)];
    const rows=await dbPost('rooms',{
      code,host_id:S.user.id,
      host_name:S.user.first_name||S.user.username,
      start_score:mpSelectedScore,host_score:mpSelectedScore,
      guest_score:mpSelectedScore,status:'waiting'
    });
    MP.room=rows[0];MP.isHost=true;
    showWaitingCard();
    startPolling(MP.room.id);
  }catch(e){await caAlert(e.message,'❌','Błąd tworzenia pokoju');}
  finally{loading(false);}
}

function showWaitingCard(){
  document.getElementById('create-room-card').style.display='none';
  document.getElementById('waiting-card').style.display='block';
  document.getElementById('guest-waiting-card').style.display='none';
  document.getElementById('room-code-display').textContent=MP.room.code;
}

async function copyRoomCode(){
  try{await navigator.clipboard.writeText(MP.room.code);showToast('📋 Kod '+MP.room.code+' skopiowany!');}
  catch{showToast('Kod: '+MP.room.code);}
}

async function cancelRoom(){
  if(!MP.room)return;
  loading(true,'Anulowanie...');
  try{await dbPatch('rooms',`id=eq.${MP.room.id}`,{status:'abandoned'});stopPolling();MP.room=null;MP.isHost=false;initMpLobby();}
  catch(e){await caAlert(e.message,'❌','Błąd');}
  finally{loading(false);}
}

async function joinRoom(){
  const code=document.getElementById('mp-join-code').value.trim().toUpperCase();
  if(code.length!==4){await caAlert('Wpisz 4-literowy kod pokoju.','❓','Brak kodu');return}
  loading(true,'Szukam pokoju...');
  try{
    const rooms=await dbGet('rooms',`code=eq.${code}&status=eq.waiting`);
    if(!rooms||!rooms.length){await caAlert('Pokój '+code+' nie istnieje lub gra już się rozpoczęła.','🔍','Nie znaleziono');return}
    const room=rooms[0];
    if(room.host_id===S.user.id){await caAlert('Nie możesz dołączyć do własnego pokoju.','😅','Błąd');return}
    const updated=await dbPatch('rooms',`id=eq.${room.id}`,{
      guest_id:S.user.id,guest_name:S.user.first_name||S.user.username,
      status:'active',current_turn:room.host_id
    });
    MP.room=updated[0];MP.isHost=false;
    document.getElementById('create-room-card').style.display='none';
    document.getElementById('guest-waiting-card').style.display='block';
    document.getElementById('guest-waiting-msg').textContent='Połączono z '+MP.room.host_name+'!';
    startPolling(MP.room.id);
    setTimeout(()=>{showScreen('mp-game');renderMpGame();},800);
  }catch(e){await caAlert(e.message,'❌','Błąd');}
  finally{loading(false);}
}

function leaveLobby(){
  if(MP.room&&MP.room.status==='waiting'&&MP.isHost){cancelRoom();return;}
  stopPolling();MP.room=null;goTab('home');
}

// ── POLLING ──
function startPolling(roomId){
  stopPolling();
  MP._pollInterval=setInterval(async()=>{
    try{
      const rows=await dbGet('rooms',`id=eq.${roomId}`);
      if(rows&&rows[0]) onRoomChange(rows[0]);
    }catch{}
  },1500);
}
function stopPolling(){
  if(MP._pollInterval){clearInterval(MP._pollInterval);MP._pollInterval=null;}
}

function onRoomChange(room){
  if(!room)return;
  const prev=MP.room;
  MP.room=room;
  if(room.status==='finished'){onMpGameFinished(room);return;}
  const lobbyActive=document.getElementById('screen-mp-lobby').classList.contains('active');
  if(room.status==='active'&&lobbyActive&&MP.isHost){
    stopPolling();startPolling(room.id);
    showScreen('mp-game');renderMpGame();return;
  }
  if(document.getElementById('screen-mp-game').classList.contains('active')) renderMpGame();
}

// ── GAME ──
function renderMpGame(){
  if(!MP.room)return;
  const room=MP.room,myId=S.user.id,isHost=room.host_id===myId;
  const myScore=isHost?room.host_score:room.guest_score;
  const theirScore=isHost?room.guest_score:room.host_score;
  const myName=(isHost?room.host_name:room.guest_name)||'Ja';
  const theirName=(isHost?room.guest_name:room.host_name)||'Przeciwnik';
  const isMyTurn=room.current_turn===myId;
  document.getElementById('mp-game-title').textContent=room.start_score+' Online';
  document.getElementById('mp-room-code-hdr').textContent='#'+room.code;
  document.getElementById('mp-my-name').textContent=myName+' (Ty)';
  document.getElementById('mp-their-name').textContent=theirName;
  const mySc=document.getElementById('mp-my-score');
  const thSc=document.getElementById('mp-their-score');
  mySc.textContent=myScore;thSc.textContent=theirScore;
  mySc.className='vs-player-score me'+(myScore<=170?' danger':'');
  thSc.className='vs-player-score them'+(theirScore<=170?' danger':'');
  const turnEl=document.getElementById('mp-turn-info');
  const overlay=document.getElementById('mp-numpad-overlay');
  if(isMyTurn){
    turnEl.className='vs-turn my-turn';turnEl.textContent='🟢 Twoja tura!';
    overlay.style.display='none';renderMpHint(myScore);
  }else{
    turnEl.className='vs-turn their-turn';turnEl.textContent='⏳ Tura '+theirName+'...';
    overlay.style.display='flex';
    document.getElementById('mp-overlay-msg').textContent='Tura '+theirName+'...';
    document.getElementById('mp-hint-area').innerHTML='';
  }
  const mode=S.user?.input_mode||'series';
  const tcWrap=document.getElementById('mp-throw-counter-wrap');
  if(tcWrap) tcWrap.style.display=(mode==='single'&&isMyTurn)?'block':'none';
  if(mode==='single'&&isMyTurn){
    document.getElementById('mp-throw-label').textContent='Rzut '+(MP.myThrows.length+1)+' z 3';
    [0,1,2].forEach(i=>{
      const dot=document.getElementById('mp-tdot-'+i);
      if(dot) dot.className='throw-dot'+(i<MP.myThrows.length?' done':i===MP.myThrows.length?' current':'');
    });
  }
  document.getElementById('mp-np-display').textContent=MP.npBuffer||'—';
  renderMpRounds(myId);
}

async function renderMpRounds(myId){
  const el=document.getElementById('mp-rounds-list');
  if(!MP.room){el.innerHTML='';return}
  try{
    const rounds=await dbGet('room_rounds',`room_id=eq.${MP.room.id}&order=created_at.desc&limit=10`);
    if(!rounds||!rounds.length){el.innerHTML='<div class="empty"><span class="empty-ic">🏹</span><div class="empty-t">Brak rund</div></div>';return}
    el.innerHTML=rounds.map(r=>{
      const isMe=r.player_id===myId;
      return`<div class="room-round-item"><div><div class="rri-name">${r.player_name||'?'} · Runda ${r.round_number}</div></div><div style="text-align:right"><div class="rri-score ${isMe?'me':'them'}">-${r.score_thrown}</div><div style="font-size:11px;color:var(--muted)">${r.score_after} pkt</div></div></div>`;
    }).join('');
  }catch{}
}

function renderMpHint(score){
  const el=document.getElementById('mp-hint-area');
  if(!el||score>170||score<=1){if(el)el.innerHTML='';return}
  const checkout=getCheckout(score);
  if(checkout===null){el.innerHTML=`<div class="hint-box"><div class="hint-title">💡 Checkout</div><div class="hint-no">❌ Brak możliwości z ${score} pkt</div></div>`;return}
  if(!checkout){el.innerHTML='';return}
  const favCo=getFavCheckout(score);
  el.innerHTML=`<div class="hint-box"><div class="hint-title">💡 Checkout z ${score} pkt <button class="hint-info-btn" onclick="showAllCheckouts(${score})">ℹ️</button></div>${favCo&&favCo!==checkout?`<div class="hint-fav">⭐ ${favCo}</div>`:''}<div class="hint-main">${favCo||checkout}</div></div>`;
}

// ── MULTIPLAYER NUMPAD ──
function mpNpPress(d){
  const mode=S.user?.input_mode||'series';
  const maxLen=mode==='single'?2:3;
  if(MP.npBuffer.length>=maxLen)return;
  const candidate=MP.npBuffer+d,val=parseInt(candidate);
  if(mode==='single'&&val>60){const disp=document.getElementById('mp-np-display');disp.style.color='var(--danger)';setTimeout(()=>disp.style.color='',600);showToast('⚠️ Max 60 pkt na rzut');return;}
  if(mode!=='single'&&val>180){const disp=document.getElementById('mp-np-display');disp.style.color='var(--danger)';setTimeout(()=>disp.style.color='',600);showToast('⚠️ Max 180 pkt na serię');return;}
  MP.npBuffer=candidate;
  document.getElementById('mp-np-display').textContent=MP.npBuffer;
}
function mpNpDel(){MP.npBuffer=MP.npBuffer.slice(0,-1);document.getElementById('mp-np-display').textContent=MP.npBuffer||'—';}
async function mpNpConfirm(){
  if(!MP.room)return;
  const mode=S.user?.input_mode||'series';
  const val=parseInt(MP.npBuffer);
  if(isNaN(val)||val<0){await caAlert('Wpisz wynik.','🎯','Brak wyniku');return}
  MP.npBuffer='';document.getElementById('mp-np-display').textContent='—';
  if(mode==='single'){
    if(val>60){await caAlert('Max 60 pkt na rzut (T20).','⚠️','Za dużo');return}
    MP.myThrows.push(val);
    if(MP.myThrows.length<3){renderMpGame();return;}
    const total=MP.myThrows.reduce((a,b)=>a+b,0);MP.myThrows=[];
    await mpSaveRound(total);
  }else{
    if(val>180){await caAlert('Max 180 pkt na serię.','⚠️','Za dużo');return}
    await mpSaveRound(val);
  }
}

async function mpSaveRound(thrown){
  if(!MP.room)return;
  const room=MP.room,myId=S.user.id,isHost=room.host_id===myId;
  const myCurrentScore=isHost?room.host_score:room.guest_score;
  const after=myCurrentScore-thrown;
  console.log('[MP] mpSaveRound: thrown='+thrown+', myCurrentScore='+myCurrentScore+', after='+after+', isHost='+isHost);
  if(after<0){await caOver(`Masz ${myCurrentScore} pkt, a wpisałeś ${thrown}. Przekroczenie!`);MP.myThrows=[];renderMpGame();return;}
  if(after===1){await caOver('Wynik 1 pkt jest niemożliwy. Wpisz mniej.');MP.myThrows=[];renderMpGame();return;}
  loading(true,'Zapisywanie tury...');
  try{
    const existing=await dbGet('room_rounds',`room_id=eq.${room.id}&player_id=eq.${myId}&select=id`)||[];
    const roundNum=existing.length+1;
    await dbPost('room_rounds',{room_id:room.id,player_id:myId,player_name:S.user.first_name||S.user.username,round_number:roundNum,score_thrown:thrown,score_after:after});
    const opponentId=isHost?room.guest_id:room.host_id;
    const patch=isHost?{host_score:after}:{guest_score:after};
    patch.current_turn=opponentId;
    if(after===0){patch.status='finished';patch.winner_id=myId;patch.winner_name=S.user.first_name||S.user.username;patch.finished_at=new Date().toISOString();}
    const updated=await dbPatch('rooms',`id=eq.${room.id}`,patch);
    MP.room=updated[0];
    if(after===0) onMpGameFinished(MP.room);
    else renderMpGame();
  }catch(e){await caAlert(e.message,'❌','Błąd zapisu');}
  finally{loading(false);}
}

async function onMpGameFinished(room){
  stopPolling();
  const myId=S.user.id,iWon=room.winner_id===myId;
  const rounds=await dbGet('room_rounds',`room_id=eq.${room.id}&player_id=eq.${myId}&select=score_thrown`)||[];
  const totalThrown=rounds.reduce((a,r)=>a+r.score_thrown,0);
  const avg=rounds.length?Math.round(totalThrown/rounds.length):0;
  const opName=room.host_id===myId?room.guest_name:room.host_name;
  if(iWon) await caWin(`Pokonałeś ${opName}!\n${rounds.length} rund | śr. ${avg} pkt/serię`);
  else await caShow('🎯','Dobry mecz!',`${room.winner_name} wygrał!\nTwój śr. wynik: ${avg} pkt/serię`,[{label:'OK',cls:'outline'}]);
  MP.room=null;goTab('home');
}

async function confirmLeaveGame(){
  const c=await caConfirm('Na pewno chcesz opuścić grę? Przeciwnik wygra automatycznie.','⚠️','Opuścić grę?');
  if(c!==1)return;
  if(MP.room){
    const opponentId=MP.room.host_id===S.user.id?MP.room.guest_id:MP.room.host_id;
    await dbPatch('rooms',`id=eq.${MP.room.id}`,{status:'finished',winner_id:opponentId,finished_at:new Date().toISOString()}).catch(()=>{});
  }
  stopPolling();MP.room=null;goTab('home');
}

// ═══════════════════════════════════════════════
//  DARTBOARD SVG
// ═══════════════════════════════════════════════
const BOARD_SVG=`<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:min(200px, 50vw);display:block;margin:0 auto"><defs><filter id="glow-f"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter><style>.zone-highlight{animation:zPulse .75s ease-in-out infinite}@keyframes zPulse{0%,100%{opacity:0.4;filter:brightness(1.5) drop-shadow(0 0 4px #e8ff47)}50%{opacity:1;filter:brightness(3) drop-shadow(0 0 12px #e8ff47) drop-shadow(0 0 24px rgba(232,255,71,0.8))}}</style></defs><circle cx="200" cy="200" r="195" fill="#111111" stroke="#333" stroke-width="2"/><path d="M172.2,24.2A178,178 0 0,1 227.8,24.2L230.0,10.4A192,192 0 0,0 170.0,10.4Z" fill="#1a1a1a" stroke="#0a0a0a" stroke-width="0.5"/>
<path d="M175.0,42.0A160,160 0 0,1 225.0,42.0L227.8,24.2A178,178 0 0,0 172.2,24.2Z" fill="#c0392b" stroke="#0a0a0a" stroke-width="0.5" class="zone-d-20"/>
<path d="M181.5,83.5A118,118 0 0,1 218.5,83.5L225.0,42.0A160,160 0 0,0 175.0,42.0Z" fill="#1c1c1c" stroke="#0a0a0a" stroke-width="0.5" class="zone-s-20"/>
<path d="M184.4,101.2A100,100 0 0,1 215.6,101.2L218.5,83.5A118,118 0 0,0 181.5,83.5Z" fill="#c0392b" stroke="#0a0a0a" stroke-width="0.5" class="zone-t-20"/>
<path d="M196.2,176.3A24,24 0 0,1 203.8,176.3L215.6,101.2A100,100 0 0,0 184.4,101.2Z" fill="#1c1c1c" stroke="#0a0a0a" stroke-width="0.5" class="zone-s-20"/>
<text x="200.0" y="13.0" text-anchor="middle" dominant-baseline="middle" fill="#cccccc" font-size="11" font-weight="bold" font-family="Arial,sans-serif">20</text>
<path d="M227.8,24.2A178,178 0 0,1 280.8,41.4L287.2,28.9A192,192 0 0,0 230.0,10.4Z" fill="#1a1a1a" stroke="#0a0a0a" stroke-width="0.5"/>
<path d="M225.0,42.0A160,160 0 0,1 272.6,57.4L280.8,41.4A178,178 0 0,0 227.8,24.2Z" fill="#1e8449" stroke="#0a0a0a" stroke-width="0.5" class="zone-d-1"/>
<path d="M218.5,83.5A118,118 0 0,1 253.6,94.9L272.6,57.4A160,160 0 0,0 225.0,42.0Z" fill="#e8dfc0" stroke="#0a0a0a" stroke-width="0.5" class="zone-s-1"/>
<path d="M215.6,101.2A100,100 0 0,1 245.4,110.9L253.6,94.9A118,118 0 0,0 218.5,83.5Z" fill="#1e8449" stroke="#0a0a0a" stroke-width="0.5" class="zone-t-1"/>
<path d="M203.8,176.3A24,24 0 0,1 210.9,178.6L245.4,110.9A100,100 0 0,0 215.6,101.2Z" fill="#e8dfc0" stroke="#0a0a0a" stroke-width="0.5" class="zone-s-1"/>
<text x="257.8" y="22.2" text-anchor="middle" dominant-baseline="middle" fill="#cccccc" font-size="11" font-weight="bold" font-family="Arial,sans-serif">1</text>
<path d="M280.8,41.4A178,178 0 0,1 325.9,74.1L335.8,64.2A192,192 0 0,0 287.2,28.9Z" fill="#1a1a1a" stroke="#0a0a0a" stroke-width="0.5"/>
<path d="M272.6,57.4A160,160 0 0,1 313.1,86.9L325.9,74.1A178,178 0 0,0 280.8,41.4Z" fill="#c0392b" stroke="#0a0a0a" stroke-width="0.5" class="zone-d-18"/>
<path d="M253.6,94.9A118,118 0 0,1 283.4,116.6L313.1,86.9A160,160 0 0,0 272.6,57.4Z" fill="#1c1c1c" stroke="#0a0a0a" stroke-width="0.5" class="zone-s-18"/>
<path d="M245.4,110.9A100,100 0 0,1 270.7,129.3L283.4,116.6A118,118 0 0,0 253.6,94.9Z" fill="#c0392b" stroke="#0a0a0a" stroke-width="0.5" class="zone-t-18"/>
<path d="M210.9,178.6A24,24 0 0,1 217.0,183.0L270.7,129.3A100,100 0 0,0 245.4,110.9Z" fill="#1c1c1c" stroke="#0a0a0a" stroke-width="0.5" class="zone-s-18"/>
<text x="309.9" y="48.7" text-anchor="middle" dominant-baseline="middle" fill="#cccccc" font-size="11" font-weight="bold" font-family="Arial,sans-serif">18</text>
<path d="M325.9,74.1A178,178 0 0,1 358.6,119.2L371.1,112.8A192,192 0 0,0 335.8,64.2Z" fill="#1a1a1a" stroke="#0a0a0a" stroke-width="0.5"/>
<path d="M313.1,86.9A160,160 0 0,1 342.6,127.4L358.6,119.2A178,178 0 0,0 325.9,74.1Z" fill="#1e8449" stroke="#0a0a0a" stroke-width="0.5" class="zone-d-4"/>
<path d="M283.4,116.6A118,118 0 0,1 305.1,146.4L342.6,127.4A160,160 0 0,0 313.1,86.9Z" fill="#e8dfc0" stroke="#0a0a0a" stroke-width="0.5" class="zone-s-4"/>
<path d="M270.7,129.3A100,100 0 0,1 289.1,154.6L305.1,146.4A118,118 0 0,0 283.4,116.6Z" fill="#1e8449" stroke="#0a0a0a" stroke-width="0.5" class="zone-t-4"/>
<path d="M217.0,183.0A24,24 0 0,1 221.4,189.1L289.1,154.6A100,100 0 0,0 270.7,129.3Z" fill="#e8dfc0" stroke="#0a0a0a" stroke-width="0.5" class="zone-s-4"/>
<text x="351.3" y="90.1" text-anchor="middle" dominant-baseline="middle" fill="#cccccc" font-size="11" font-weight="bold" font-family="Arial,sans-serif">4</text>
<path d="M358.6,119.2A178,178 0 0,1 375.8,172.2L389.6,170.0A192,192 0 0,0 371.1,112.8Z" fill="#1a1a1a" stroke="#0a0a0a" stroke-width="0.5"/>
<path d="M342.6,127.4A160,160 0 0,1 358.0,175.0L375.8,172.2A178,178 0 0,0 358.6,119.2Z" fill="#c0392b" stroke="#0a0a0a" stroke-width="0.5" class="zone-d-13"/>
<path d="M305.1,146.4A118,118 0 0,1 316.5,181.5L358.0,175.0A160,160 0 0,0 342.6,127.4Z" fill="#1c1c1c" stroke="#0a0a0a" stroke-width="0.5" class="zone-s-13"/>
<path d="M289.1,154.6A100,100 0 0,1 298.8,184.4L316.5,181.5A118,118 0 0,0 305.1,146.4Z" fill="#c0392b" stroke="#0a0a0a" stroke-width="0.5" class="zone-t-13"/>
<path d="M221.4,189.1A24,24 0 0,1 223.7,196.2L298.8,184.4A100,100 0 0,0 289.1,154.6Z" fill="#1c1c1c" stroke="#0a0a0a" stroke-width="0.5" class="zone-s-13"/>
<text x="377.8" y="142.2" text-anchor="middle" dominant-baseline="middle" fill="#cccccc" font-size="11" font-weight="bold" font-family="Arial,sans-serif">13</text>
<path d="M375.8,172.2A178,178 0 0,1 375.8,227.8L389.6,230.0A192,192 0 0,0 389.6,170.0Z" fill="#1a1a1a" stroke="#0a0a0a" stroke-width="0.5"/>
<path d="M358.0,175.0A160,160 0 0,1 358.0,225.0L375.8,227.8A178,178 0 0,0 375.8,172.2Z" fill="#1e8449" stroke="#0a0a0a" stroke-width="0.5" class="zone-d-6"/>
<path d="M316.5,181.5A118,118 0 0,1 316.5,218.5L358.0,225.0A160,160 0 0,0 358.0,175.0Z" fill="#e8dfc0" stroke="#0a0a0a" stroke-width="0.5" class="zone-s-6"/>
<path d="M298.8,184.4A100,100 0 0,1 298.8,215.6L316.5,218.5A118,118 0 0,0 316.5,181.5Z" fill="#1e8449" stroke="#0a0a0a" stroke-width="0.5" class="zone-t-6"/>
<path d="M223.7,196.2A24,24 0 0,1 223.7,203.8L298.8,215.6A100,100 0 0,0 298.8,184.4Z" fill="#e8dfc0" stroke="#0a0a0a" stroke-width="0.5" class="zone-s-6"/>
<text x="387.0" y="200.0" text-anchor="middle" dominant-baseline="middle" fill="#cccccc" font-size="11" font-weight="bold" font-family="Arial,sans-serif">6</text>
<path d="M375.8,227.8A178,178 0 0,1 358.6,280.8L371.1,287.2A192,192 0 0,0 389.6,230.0Z" fill="#1a1a1a" stroke="#0a0a0a" stroke-width="0.5"/>
<path d="M358.0,225.0A160,160 0 0,1 342.6,272.6L358.6,280.8A178,178 0 0,0 375.8,227.8Z" fill="#c0392b" stroke="#0a0a0a" stroke-width="0.5" class="zone-d-10"/>
<path d="M316.5,218.5A118,118 0 0,1 305.1,253.6L342.6,272.6A160,160 0 0,0 358.0,225.0Z" fill="#1c1c1c" stroke="#0a0a0a" stroke-width="0.5" class="zone-s-10"/>
<path d="M298.8,215.6A100,100 0 0,1 289.1,245.4L305.1,253.6A118,118 0 0,0 316.5,218.5Z" fill="#c0392b" stroke="#0a0a0a" stroke-width="0.5" class="zone-t-10"/>
<path d="M223.7,203.8A24,24 0 0,1 221.4,210.9L289.1,245.4A100,100 0 0,0 298.8,215.6Z" fill="#1c1c1c" stroke="#0a0a0a" stroke-width="0.5" class="zone-s-10"/>
<text x="377.8" y="257.8" text-anchor="middle" dominant-baseline="middle" fill="#cccccc" font-size="11" font-weight="bold" font-family="Arial,sans-serif">10</text>
<path d="M358.6,280.8A178,178 0 0,1 325.9,325.9L335.8,335.8A192,192 0 0,0 371.1,287.2Z" fill="#1a1a1a" stroke="#0a0a0a" stroke-width="0.5"/>
<path d="M342.6,272.6A160,160 0 0,1 313.1,313.1L325.9,325.9A178,178 0 0,0 358.6,280.8Z" fill="#1e8449" stroke="#0a0a0a" stroke-width="0.5" class="zone-d-15"/>
<path d="M305.1,253.6A118,118 0 0,1 283.4,283.4L313.1,313.1A160,160 0 0,0 342.6,272.6Z" fill="#e8dfc0" stroke="#0a0a0a" stroke-width="0.5" class="zone-s-15"/>
<path d="M289.1,245.4A100,100 0 0,1 270.7,270.7L283.4,283.4A118,118 0 0,0 305.1,253.6Z" fill="#1e8449" stroke="#0a0a0a" stroke-width="0.5" class="zone-t-15"/>
<path d="M221.4,210.9A24,24 0 0,1 217.0,217.0L270.7,270.7A100,100 0 0,0 289.1,245.4Z" fill="#e8dfc0" stroke="#0a0a0a" stroke-width="0.5" class="zone-s-15"/>
<text x="351.3" y="309.9" text-anchor="middle" dominant-baseline="middle" fill="#cccccc" font-size="11" font-weight="bold" font-family="Arial,sans-serif">15</text>
<path d="M325.9,325.9A178,178 0 0,1 280.8,358.6L287.2,371.1A192,192 0 0,0 335.8,335.8Z" fill="#1a1a1a" stroke="#0a0a0a" stroke-width="0.5"/>
<path d="M313.1,313.1A160,160 0 0,1 272.6,342.6L280.8,358.6A178,178 0 0,0 325.9,325.9Z" fill="#c0392b" stroke="#0a0a0a" stroke-width="0.5" class="zone-d-2"/>
<path d="M283.4,283.4A118,118 0 0,1 253.6,305.1L272.6,342.6A160,160 0 0,0 313.1,313.1Z" fill="#1c1c1c" stroke="#0a0a0a" stroke-width="0.5" class="zone-s-2"/>
<path d="M270.7,270.7A100,100 0 0,1 245.4,289.1L253.6,305.1A118,118 0 0,0 283.4,283.4Z" fill="#c0392b" stroke="#0a0a0a" stroke-width="0.5" class="zone-t-2"/>
<path d="M217.0,217.0A24,24 0 0,1 210.9,221.4L245.4,289.1A100,100 0 0,0 270.7,270.7Z" fill="#1c1c1c" stroke="#0a0a0a" stroke-width="0.5" class="zone-s-2"/>
<text x="309.9" y="351.3" text-anchor="middle" dominant-baseline="middle" fill="#cccccc" font-size="11" font-weight="bold" font-family="Arial,sans-serif">2</text>
<path d="M280.8,358.6A178,178 0 0,1 227.8,375.8L230.0,389.6A192,192 0 0,0 287.2,371.1Z" fill="#1a1a1a" stroke="#0a0a0a" stroke-width="0.5"/>
<path d="M272.6,342.6A160,160 0 0,1 225.0,358.0L227.8,375.8A178,178 0 0,0 280.8,358.6Z" fill="#1e8449" stroke="#0a0a0a" stroke-width="0.5" class="zone-d-17"/>
<path d="M253.6,305.1A118,118 0 0,1 218.5,316.5L225.0,358.0A160,160 0 0,0 272.6,342.6Z" fill="#e8dfc0" stroke="#0a0a0a" stroke-width="0.5" class="zone-s-17"/>
<path d="M245.4,289.1A100,100 0 0,1 215.6,298.8L218.5,316.5A118,118 0 0,0 253.6,305.1Z" fill="#1e8449" stroke="#0a0a0a" stroke-width="0.5" class="zone-t-17"/>
<path d="M210.9,221.4A24,24 0 0,1 203.8,223.7L215.6,298.8A100,100 0 0,0 245.4,289.1Z" fill="#e8dfc0" stroke="#0a0a0a" stroke-width="0.5" class="zone-s-17"/>
<text x="257.8" y="377.8" text-anchor="middle" dominant-baseline="middle" fill="#cccccc" font-size="11" font-weight="bold" font-family="Arial,sans-serif">17</text>
<path d="M227.8,375.8A178,178 0 0,1 172.2,375.8L170.0,389.6A192,192 0 0,0 230.0,389.6Z" fill="#1a1a1a" stroke="#0a0a0a" stroke-width="0.5"/>
<path d="M225.0,358.0A160,160 0 0,1 175.0,358.0L172.2,375.8A178,178 0 0,0 227.8,375.8Z" fill="#c0392b" stroke="#0a0a0a" stroke-width="0.5" class="zone-d-3"/>
<path d="M218.5,316.5A118,118 0 0,1 181.5,316.5L175.0,358.0A160,160 0 0,0 225.0,358.0Z" fill="#1c1c1c" stroke="#0a0a0a" stroke-width="0.5" class="zone-s-3"/>
<path d="M215.6,298.8A100,100 0 0,1 184.4,298.8L181.5,316.5A118,118 0 0,0 218.5,316.5Z" fill="#c0392b" stroke="#0a0a0a" stroke-width="0.5" class="zone-t-3"/>
<path d="M203.8,223.7A24,24 0 0,1 196.2,223.7L184.4,298.8A100,100 0 0,0 215.6,298.8Z" fill="#1c1c1c" stroke="#0a0a0a" stroke-width="0.5" class="zone-s-3"/>
<text x="200.0" y="387.0" text-anchor="middle" dominant-baseline="middle" fill="#cccccc" font-size="11" font-weight="bold" font-family="Arial,sans-serif">3</text>
<path d="M172.2,375.8A178,178 0 0,1 119.2,358.6L112.8,371.1A192,192 0 0,0 170.0,389.6Z" fill="#1a1a1a" stroke="#0a0a0a" stroke-width="0.5"/>
<path d="M175.0,358.0A160,160 0 0,1 127.4,342.6L119.2,358.6A178,178 0 0,0 172.2,375.8Z" fill="#1e8449" stroke="#0a0a0a" stroke-width="0.5" class="zone-d-19"/>
<path d="M181.5,316.5A118,118 0 0,1 146.4,305.1L127.4,342.6A160,160 0 0,0 175.0,358.0Z" fill="#e8dfc0" stroke="#0a0a0a" stroke-width="0.5" class="zone-s-19"/>
<path d="M184.4,298.8A100,100 0 0,1 154.6,289.1L146.4,305.1A118,118 0 0,0 181.5,316.5Z" fill="#1e8449" stroke="#0a0a0a" stroke-width="0.5" class="zone-t-19"/>
<path d="M196.2,223.7A24,24 0 0,1 189.1,221.4L154.6,289.1A100,100 0 0,0 184.4,298.8Z" fill="#e8dfc0" stroke="#0a0a0a" stroke-width="0.5" class="zone-s-19"/>
<text x="142.2" y="377.8" text-anchor="middle" dominant-baseline="middle" fill="#cccccc" font-size="11" font-weight="bold" font-family="Arial,sans-serif">19</text>
<path d="M119.2,358.6A178,178 0 0,1 74.1,325.9L64.2,335.8A192,192 0 0,0 112.8,371.1Z" fill="#1a1a1a" stroke="#0a0a0a" stroke-width="0.5"/>
<path d="M127.4,342.6A160,160 0 0,1 86.9,313.1L74.1,325.9A178,178 0 0,0 119.2,358.6Z" fill="#c0392b" stroke="#0a0a0a" stroke-width="0.5" class="zone-d-7"/>
<path d="M146.4,305.1A118,118 0 0,1 116.6,283.4L86.9,313.1A160,160 0 0,0 127.4,342.6Z" fill="#1c1c1c" stroke="#0a0a0a" stroke-width="0.5" class="zone-s-7"/>
<path d="M154.6,289.1A100,100 0 0,1 129.3,270.7L116.6,283.4A118,118 0 0,0 146.4,305.1Z" fill="#c0392b" stroke="#0a0a0a" stroke-width="0.5" class="zone-t-7"/>
<path d="M189.1,221.4A24,24 0 0,1 183.0,217.0L129.3,270.7A100,100 0 0,0 154.6,289.1Z" fill="#1c1c1c" stroke="#0a0a0a" stroke-width="0.5" class="zone-s-7"/>
<text x="90.1" y="351.3" text-anchor="middle" dominant-baseline="middle" fill="#cccccc" font-size="11" font-weight="bold" font-family="Arial,sans-serif">7</text>
<path d="M74.1,325.9A178,178 0 0,1 41.4,280.8L28.9,287.2A192,192 0 0,0 64.2,335.8Z" fill="#1a1a1a" stroke="#0a0a0a" stroke-width="0.5"/>
<path d="M86.9,313.1A160,160 0 0,1 57.4,272.6L41.4,280.8A178,178 0 0,0 74.1,325.9Z" fill="#1e8449" stroke="#0a0a0a" stroke-width="0.5" class="zone-d-16"/>
<path d="M116.6,283.4A118,118 0 0,1 94.9,253.6L57.4,272.6A160,160 0 0,0 86.9,313.1Z" fill="#e8dfc0" stroke="#0a0a0a" stroke-width="0.5" class="zone-s-16"/>
<path d="M129.3,270.7A100,100 0 0,1 110.9,245.4L94.9,253.6A118,118 0 0,0 116.6,283.4Z" fill="#1e8449" stroke="#0a0a0a" stroke-width="0.5" class="zone-t-16"/>
<path d="M183.0,217.0A24,24 0 0,1 178.6,210.9L110.9,245.4A100,100 0 0,0 129.3,270.7Z" fill="#e8dfc0" stroke="#0a0a0a" stroke-width="0.5" class="zone-s-16"/>
<text x="48.7" y="309.9" text-anchor="middle" dominant-baseline="middle" fill="#cccccc" font-size="11" font-weight="bold" font-family="Arial,sans-serif">16</text>
<path d="M41.4,280.8A178,178 0 0,1 24.2,227.8L10.4,230.0A192,192 0 0,0 28.9,287.2Z" fill="#1a1a1a" stroke="#0a0a0a" stroke-width="0.5"/>
<path d="M57.4,272.6A160,160 0 0,1 42.0,225.0L24.2,227.8A178,178 0 0,0 41.4,280.8Z" fill="#c0392b" stroke="#0a0a0a" stroke-width="0.5" class="zone-d-8"/>
<path d="M94.9,253.6A118,118 0 0,1 83.5,218.5L42.0,225.0A160,160 0 0,0 57.4,272.6Z" fill="#1c1c1c" stroke="#0a0a0a" stroke-width="0.5" class="zone-s-8"/>
<path d="M110.9,245.4A100,100 0 0,1 101.2,215.6L83.5,218.5A118,118 0 0,0 94.9,253.6Z" fill="#c0392b" stroke="#0a0a0a" stroke-width="0.5" class="zone-t-8"/>
<path d="M178.6,210.9A24,24 0 0,1 176.3,203.8L101.2,215.6A100,100 0 0,0 110.9,245.4Z" fill="#1c1c1c" stroke="#0a0a0a" stroke-width="0.5" class="zone-s-8"/>
<text x="22.2" y="257.8" text-anchor="middle" dominant-baseline="middle" fill="#cccccc" font-size="11" font-weight="bold" font-family="Arial,sans-serif">8</text>
<path d="M24.2,227.8A178,178 0 0,1 24.2,172.2L10.4,170.0A192,192 0 0,0 10.4,230.0Z" fill="#1a1a1a" stroke="#0a0a0a" stroke-width="0.5"/>
<path d="M42.0,225.0A160,160 0 0,1 42.0,175.0L24.2,172.2A178,178 0 0,0 24.2,227.8Z" fill="#1e8449" stroke="#0a0a0a" stroke-width="0.5" class="zone-d-11"/>
<path d="M83.5,218.5A118,118 0 0,1 83.5,181.5L42.0,175.0A160,160 0 0,0 42.0,225.0Z" fill="#e8dfc0" stroke="#0a0a0a" stroke-width="0.5" class="zone-s-11"/>
<path d="M101.2,215.6A100,100 0 0,1 101.2,184.4L83.5,181.5A118,118 0 0,0 83.5,218.5Z" fill="#1e8449" stroke="#0a0a0a" stroke-width="0.5" class="zone-t-11"/>
<path d="M176.3,203.8A24,24 0 0,1 176.3,196.2L101.2,184.4A100,100 0 0,0 101.2,215.6Z" fill="#e8dfc0" stroke="#0a0a0a" stroke-width="0.5" class="zone-s-11"/>
<text x="13.0" y="200.0" text-anchor="middle" dominant-baseline="middle" fill="#cccccc" font-size="11" font-weight="bold" font-family="Arial,sans-serif">11</text>
<path d="M24.2,172.2A178,178 0 0,1 41.4,119.2L28.9,112.8A192,192 0 0,0 10.4,170.0Z" fill="#1a1a1a" stroke="#0a0a0a" stroke-width="0.5"/>
<path d="M42.0,175.0A160,160 0 0,1 57.4,127.4L41.4,119.2A178,178 0 0,0 24.2,172.2Z" fill="#c0392b" stroke="#0a0a0a" stroke-width="0.5" class="zone-d-14"/>
<path d="M83.5,181.5A118,118 0 0,1 94.9,146.4L57.4,127.4A160,160 0 0,0 42.0,175.0Z" fill="#1c1c1c" stroke="#0a0a0a" stroke-width="0.5" class="zone-s-14"/>
<path d="M101.2,184.4A100,100 0 0,1 110.9,154.6L94.9,146.4A118,118 0 0,0 83.5,181.5Z" fill="#c0392b" stroke="#0a0a0a" stroke-width="0.5" class="zone-t-14"/>
<path d="M176.3,196.2A24,24 0 0,1 178.6,189.1L110.9,154.6A100,100 0 0,0 101.2,184.4Z" fill="#1c1c1c" stroke="#0a0a0a" stroke-width="0.5" class="zone-s-14"/>
<text x="22.2" y="142.2" text-anchor="middle" dominant-baseline="middle" fill="#cccccc" font-size="11" font-weight="bold" font-family="Arial,sans-serif">14</text>
<path d="M41.4,119.2A178,178 0 0,1 74.1,74.1L64.2,64.2A192,192 0 0,0 28.9,112.8Z" fill="#1a1a1a" stroke="#0a0a0a" stroke-width="0.5"/>
<path d="M57.4,127.4A160,160 0 0,1 86.9,86.9L74.1,74.1A178,178 0 0,0 41.4,119.2Z" fill="#1e8449" stroke="#0a0a0a" stroke-width="0.5" class="zone-d-9"/>
<path d="M94.9,146.4A118,118 0 0,1 116.6,116.6L86.9,86.9A160,160 0 0,0 57.4,127.4Z" fill="#e8dfc0" stroke="#0a0a0a" stroke-width="0.5" class="zone-s-9"/>
<path d="M110.9,154.6A100,100 0 0,1 129.3,129.3L116.6,116.6A118,118 0 0,0 94.9,146.4Z" fill="#1e8449" stroke="#0a0a0a" stroke-width="0.5" class="zone-t-9"/>
<path d="M178.6,189.1A24,24 0 0,1 183.0,183.0L129.3,129.3A100,100 0 0,0 110.9,154.6Z" fill="#e8dfc0" stroke="#0a0a0a" stroke-width="0.5" class="zone-s-9"/>
<text x="48.7" y="90.1" text-anchor="middle" dominant-baseline="middle" fill="#cccccc" font-size="11" font-weight="bold" font-family="Arial,sans-serif">9</text>
<path d="M74.1,74.1A178,178 0 0,1 119.2,41.4L112.8,28.9A192,192 0 0,0 64.2,64.2Z" fill="#1a1a1a" stroke="#0a0a0a" stroke-width="0.5"/>
<path d="M86.9,86.9A160,160 0 0,1 127.4,57.4L119.2,41.4A178,178 0 0,0 74.1,74.1Z" fill="#c0392b" stroke="#0a0a0a" stroke-width="0.5" class="zone-d-12"/>
<path d="M116.6,116.6A118,118 0 0,1 146.4,94.9L127.4,57.4A160,160 0 0,0 86.9,86.9Z" fill="#1c1c1c" stroke="#0a0a0a" stroke-width="0.5" class="zone-s-12"/>
<path d="M129.3,129.3A100,100 0 0,1 154.6,110.9L146.4,94.9A118,118 0 0,0 116.6,116.6Z" fill="#c0392b" stroke="#0a0a0a" stroke-width="0.5" class="zone-t-12"/>
<path d="M183.0,183.0A24,24 0 0,1 189.1,178.6L154.6,110.9A100,100 0 0,0 129.3,129.3Z" fill="#1c1c1c" stroke="#0a0a0a" stroke-width="0.5" class="zone-s-12"/>
<text x="90.1" y="48.7" text-anchor="middle" dominant-baseline="middle" fill="#cccccc" font-size="11" font-weight="bold" font-family="Arial,sans-serif">12</text>
<path d="M119.2,41.4A178,178 0 0,1 172.2,24.2L170.0,10.4A192,192 0 0,0 112.8,28.9Z" fill="#1a1a1a" stroke="#0a0a0a" stroke-width="0.5"/>
<path d="M127.4,57.4A160,160 0 0,1 175.0,42.0L172.2,24.2A178,178 0 0,0 119.2,41.4Z" fill="#1e8449" stroke="#0a0a0a" stroke-width="0.5" class="zone-d-5"/>
<path d="M146.4,94.9A118,118 0 0,1 181.5,83.5L175.0,42.0A160,160 0 0,0 127.4,57.4Z" fill="#e8dfc0" stroke="#0a0a0a" stroke-width="0.5" class="zone-s-5"/>
<path d="M154.6,110.9A100,100 0 0,1 184.4,101.2L181.5,83.5A118,118 0 0,0 146.4,94.9Z" fill="#1e8449" stroke="#0a0a0a" stroke-width="0.5" class="zone-t-5"/>
<path d="M189.1,178.6A24,24 0 0,1 196.2,176.3L184.4,101.2A100,100 0 0,0 154.6,110.9Z" fill="#e8dfc0" stroke="#0a0a0a" stroke-width="0.5" class="zone-s-5"/>
<text x="142.2" y="22.2" text-anchor="middle" dominant-baseline="middle" fill="#cccccc" font-size="11" font-weight="bold" font-family="Arial,sans-serif">5</text>
<circle cx="200" cy="200" r="22" fill="#1e8449" stroke="#0a0a0a" stroke-width="0.5" class="zone-bull"/>
<circle cx="200" cy="200" r="10" fill="#c0392b" stroke="#0a0a0a" stroke-width="0.5" class="zone-bull-d"/></svg>`;

function renderDartboard(target){
  const c=document.getElementById('dartboard-container');
  if(!c)return;
  c.innerHTML=BOARD_SVG;
  highlightTarget(target);
}

function highlightTarget(target){
  document.querySelectorAll('.zone-highlight').forEach(el=>el.classList.remove('zone-highlight'));
  if(target==='BULL'||target==='bull'){
    document.querySelectorAll('.zone-bull,.zone-bull-d').forEach(el=>el.classList.add('zone-highlight'));
  }else{
    const n=typeof target==='number'?target:parseInt(target);
    if(isNaN(n))return;
    document.querySelectorAll(`.zone-s-${n},.zone-d-${n},.zone-t-${n}`).forEach(el=>el.classList.add('zone-highlight'));
    const wrap=document.getElementById('board-wrap');
    if(wrap)setTimeout(()=>wrap.scrollIntoView({behavior:'smooth',block:'nearest'}),150);
  }
}

// ═══════════════════════════════════════════════
//  SESSION PERSISTENCE
// ═══════════════════════════════════════════════
const SESSION_KEY='dartpro_session';
const SESSION_TTL=8*60*60*1000; // 8 godzin

function saveSession(userId){
  sessionStorage.setItem(SESSION_KEY,JSON.stringify({userId,ts:Date.now()}));
  // też localStorage jako backup
  localStorage.setItem(SESSION_KEY,JSON.stringify({userId,ts:Date.now()}));
}

function clearSession(){
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_KEY);
}

function loadSession(){
  // sessionStorage pierwsze, potem localStorage
  let raw=sessionStorage.getItem(SESSION_KEY)||localStorage.getItem(SESSION_KEY);
  if(!raw)return null;
  try{
    const s=JSON.parse(raw);
    if(Date.now()-s.ts>SESSION_TTL){clearSession();return null;}
    return s;
  }catch{return null;}
}

async function tryAutoLogin(){
  const session=loadSession();
  if(!session)return false;
  try{
    const users=await dbGet('users',`id=eq.${session.userId}&select=*`);
    if(!users||!users.length){clearSession();return false;}
    S.user=users[0];S.isAdmin=S.user.is_admin;
    await updateStreak();
    await loadExercises();
    saveSession(S.user.id); // odśwież timestamp
    startInactivityTimer();
    return true;
  }catch(e){clearSession();return false;}
}

// ═══════════════════════════════════════════════
//  INACTIVITY TIMER — wylogowanie po 8h braku aktywności
// ═══════════════════════════════════════════════
let inactivityTimer=null;
const INACTIVITY_LIMIT=8*60*60*1000; // 8 godzin

function startInactivityTimer(){
  resetInactivityTimer();
  // Nasłuchuj aktywności użytkownika
  ['touchstart','click','keydown','scroll'].forEach(ev=>{
    document.addEventListener(ev,resetInactivityTimer,{passive:true});
  });
  // Sprawdzaj czas przy powrocie z tła
  document.addEventListener('visibilitychange',onVisibilityChange);
}

function resetInactivityTimer(){
  if(!S.user)return;
  clearTimeout(inactivityTimer);
  // Zapisz czas ostatniej aktywności
  localStorage.setItem('dartpro_last_active',Date.now().toString());
  inactivityTimer=setTimeout(()=>{
    showToast('⏱ Sesja wygasła — zaloguj się ponownie');
    setTimeout(()=>logout(),2000);
  },INACTIVITY_LIMIT);
}

async function onVisibilityChange(){
  if(document.hidden)return; // wchodzi w tło — nic nie rób
  if(!S.user)return;
  // Wróciło z tła — sprawdź czy sesja nie wygasła
  const lastActive=parseInt(localStorage.getItem('dartpro_last_active')||'0');
  const elapsed=Date.now()-lastActive;
  if(elapsed>INACTIVITY_LIMIT){
    showToast('⏱ Sesja wygasła — zaloguj się ponownie');
    setTimeout(()=>logout(),1500);
    return;
  }
  // Sprawdź czy token sesji nadal ważny
  const session=loadSession();
  if(!session&&S.user){
    showToast('⏱ Sesja wygasła — zaloguj się ponownie');
    setTimeout(()=>logout(),1500);
  } else if(session){
    saveSession(S.user.id); // odśwież timestamp
  }
}

// ═══════════════════════════════════════════════
//  SYSTEM BACK BUTTON
// ═══════════════════════════════════════════════
const SCREEN_BACK={
  'history':'home',
  'profile':'home',
  'match':'home',
  'summary':'home',
  'training':'home',
  'admin':'login',
};

window.addEventListener('popstate',(e)=>{
  const screen=e.state?.screen;
  if(!screen||screen==='login'){
    // Jeśli zalogowany i próbuje wyjść — zostań
    if(S.user){
      history.pushState({screen:'home'},'',window.location.pathname+'#home');
      goTab('home');
    }else{
      showScreen('login');
    }
    return;
  }
  // Specjalna obsługa — jeśli był na training/summary wróć do home
  if(screen==='training'||screen==='summary'){
    if(S.training&&S.training.sessScore>0&&document.getElementById('screen-training').classList.contains('active')){
      caConfirm('Masz niezapisany wynik. Na pewno chcesz wyjść?','⚠️','Trening w toku').then(r=>{
        if(r!==1){
          history.pushState({screen:'training'},'',window.location.pathname+'#training');
          return;
        }
        goTab('home');
      });
    }else{
      goTab('home');
    }
    return;
  }
  if(S.user){
    // Zalogowany — nawiguj do odpowiedniego ekranu
    if(screen==='home')goTab('home');
    else if(screen==='history')goTab('history');
    else if(screen==='profile')goTab('profile');
    else if(screen==='match')goTab('match');
    else showScreen(screen);
  }else{
    showScreen('login');
  }
});

// ═══════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════
// Block pull-to-refresh during active sessions
document.addEventListener('touchmove', function(e){
  // Block pull-to-refresh only when training or match is active
  const training = document.getElementById('screen-training');
  const match = document.getElementById('screen-match');
  const mpGame = document.getElementById('screen-mp-game');
  if((training && training.classList.contains('active')) ||
     (match && match.classList.contains('active')) ||
     (mpGame && mpGame.classList.contains('active'))){
    // Allow scroll inside scrollable containers
    let el = e.target;
    let scrollable = false;
    while(el && el !== document.body){
      if(el.scrollHeight > el.clientHeight && 
         getComputedStyle(el).overflowY !== 'hidden'){
        scrollable = true; break;
      }
      el = el.parentElement;
    }
    if(!scrollable) e.preventDefault();
  }
}, {passive: false});

(async()=>{
  loading(true,'Łączenie z bazą...');
  try{
    await loadExercises();
    // Próbuj auto-login z zapisanej sesji
    const autoLogged=await tryAutoLogin();
    if(autoLogged){
      if(S.isAdmin){
        history.replaceState({screen:'admin'},'',window.location.pathname+'#admin');
        showScreen('admin');renderAdminEx();renderLB();
      }else{
        history.replaceState({screen:'home'},'',window.location.pathname+'#home');
        showScreen('home');await renderHome();
      }
    }else{
      history.replaceState({screen:'login'},'',window.location.pathname+'#login');
      showScreen('login');
    }
  }catch(e){console.warn('Błąd inicjalizacji:',e.message);showScreen('login');}
  finally{loading(false);initNewRules('shanghai');}
})();
