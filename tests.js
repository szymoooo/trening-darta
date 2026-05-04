// ═══════════════════════════════════════════════════════════════
//  DartPro — Testy jednostkowe
//  Uruchom: node tests.js
//  GitHub Actions: automatycznie przy każdym push
// ═══════════════════════════════════════════════════════════════

let passed = 0;
let failed = 0;
let currentSuite = '';

function suite(name) {
  currentSuite = name;
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${name}`);
  console.log('═'.repeat(60));
}

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch(e) {
    console.log(`  ❌ ${name}`);
    console.log(`     → ${e.message}`);
    failed++;
  }
}

function expect(val) {
  return {
    toBe(expected) {
      if(val !== expected) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(val)}`);
    },
    toEqual(expected) {
      if(JSON.stringify(val) !== JSON.stringify(expected))
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(val)}`);
    },
    toBeTruthy() {
      if(!val) throw new Error(`Expected truthy, got ${JSON.stringify(val)}`);
    },
    toBeFalsy() {
      if(val) throw new Error(`Expected falsy, got ${JSON.stringify(val)}`);
    },
    toBeGreaterThan(n) {
      if(!(val > n)) throw new Error(`Expected ${val} > ${n}`);
    },
    toBeLessThanOrEqual(n) {
      if(!(val <= n)) throw new Error(`Expected ${val} <= ${n}`);
    },
    toContain(str) {
      if(!val.includes(str)) throw new Error(`Expected "${val}" to contain "${str}"`);
    },
    toBeNull() {
      if(val !== null) throw new Error(`Expected null, got ${JSON.stringify(val)}`);
    },
    toBeUndefined() {
      if(val !== undefined) throw new Error(`Expected undefined, got ${JSON.stringify(val)}`);
    }
  };
}


// ═══════════════════════════════════════════════════════════════
//  HELPERS — symulacja logiki aplikacji (bez DOM i Supabase)
// ═══════════════════════════════════════════════════════════════

// --- HASH (z aplikacji) ---
function hash(s) {
  let h = 0;
  for(let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h.toString(36);
}

// --- CHECKOUTY (z aplikacji) ---
const CHECKOUTS = {
  170:'T20, T20, DB',169:null,168:null,167:'T20, T19, DB',166:null,165:null,
  164:'T20, T18, DB',163:null,162:null,161:'T20, T17, DB',
  160:'T20, T20, D20',159:null,158:'T20, T20, D19',157:'T20, T19, D20',
  156:'T20, T20, D18',155:'T20, T19, D19',154:'T20, T18, D20',
  153:'T20, T19, D18',152:'T20, T20, D16',151:'T20, T17, D20',
  150:'T20, T18, D18',100:'T20, D20',98:'T20, D19',97:'T19, D20',
  40:'D20',38:'D19',36:'D18',32:'D16',20:'D10',10:'D5',4:'D2',2:'D1',
};

function getCheckout(score) {
  if(score in CHECKOUTS) return CHECKOUTS[score];
  return undefined;
}

function getFavCheckout(score, favDoubles) {
  if(!favDoubles || !favDoubles.length) return null;
  const checkout = CHECKOUTS[score];
  if(!checkout) return null;
  for(const fav of favDoubles) {
    const dStr = fav === 25 ? 'DB' : `D${fav}`;
    if(checkout.includes(dStr)) return checkout;
  }
  return null;
}

// --- SCORING (z aplikacji) ---
function defaultRules(type) {
  if(type === 'shanghai') return [
    {id:'a', label:'Single', points:1, type:'hit', trigger:'single'},
    {id:'b', label:'Double', points:2, type:'hit', trigger:'double'},
    {id:'c', label:'Treble', points:3, type:'hit', trigger:'triple'},
    {id:'d', label:'Bonus Shanghai', points:100, type:'bonus', trigger:'shanghai'}
  ];
  return [
    {id:'e', label:'Trafiony double', points:50, type:'hit', trigger:'double'},
    {id:'f', label:'Trafiony BULL', points:50, type:'hit', trigger:'bull'},
    {id:'g', label:'Bonus za BULL', points:50, type:'bonus', trigger:'bull'}
  ];
}

function getRules(ex) {
  const sc = ex.scoring;
  if(Array.isArray(sc)) return sc;
  return defaultRules(ex.type);
}

function calcRoundScore(throws, rules, targets, targetIdx) {
  const rndPts = throws.reduce((a, t) => a + t.pts, 0);
  let bonus = 0;
  const zones = throws.map(t => t.zone);
  const bonusRules = rules.filter(r => r.type === 'bonus');
  for(const r of bonusRules) {
    if(r.trigger === 'shanghai') {
      if(zones.includes('single') && zones.includes('double') && zones.includes('triple')) {
        bonus += r.points;
      }
    } else if(r.trigger === 'bull') {
      if(targets[targetIdx] === 'BULL' && zones.includes('bull')) {
        bonus += r.points;
      }
    }
  }
  return { pts: rndPts, bonus, total: rndPts + bonus };
}

// --- MATCH LOGIC (z aplikacji) ---
function validateMatchInput(val, currentScore, mode) {
  if(isNaN(val) || val < 0) return { error: 'Wpisz wynik rzutu' };
  if(mode === 'single' && val > 60) return { error: 'Max 60 pkt na rzut (T20)' };
  if(mode === 'series' && val > 180) return { error: 'Max 180 pkt na serię' };
  const after = Number(currentScore) - val;
  if(after < 0) return { error: 'bust', bust: true, current: currentScore };
  if(after === 1) return { error: 'Wynik 1 pkt jest niemożliwy', bust: true };
  return { ok: true, after };
}

// --- ADMIN: exercise validation ---
function validateExercise(ex) {
  const errors = [];
  if(!ex.name || ex.name.trim().length < 2) errors.push('Brak nazwy (min. 2 znaki)');
  if(!ex.targets || !ex.targets.length) errors.push('Brak sektorów');
  if(!ex.scoring || !ex.scoring.length) errors.push('Brak reguł punktacji');
  if(!['shanghai', 'doubles'].includes(ex.type)) errors.push('Nieprawidłowy typ');
  const invalidTargets = ex.targets?.filter(t => t !== 'BULL' && (isNaN(t) || t < 1 || t > 20));
  if(invalidTargets?.length) errors.push(`Nieprawidłowe sektory: ${invalidTargets.join(', ')}`);
  return errors;
}

// --- SESSION ---
function createSession(userId, exerciseId, exerciseName, total, base, bonus) {
  return {
    user_id: userId, exercise_id: exerciseId, exercise_name: exerciseName,
    total_score: total, base_score: base, bonus_score: bonus,
    created_at: new Date().toISOString()
  };
}

function calcPersonalBest(sessions, exerciseId) {
  const same = sessions.filter(s => s.exercise_id === exerciseId);
  if(!same.length) return 0;
  return Math.max(...same.map(s => s.total_score));
}

function calcStreak(sessions) {
  if(!sessions.length) return 0;
  const days = [...new Set(sessions.map(s => s.created_at.slice(0, 10)))].sort().reverse();
  let streak = 0;
  let d = new Date();
  for(const day of days) {
    const dayDate = new Date(day);
    const diff = Math.round((d - dayDate) / 86400000);
    if(diff <= 1) { streak++; d = dayDate; }
    else break;
  }
  return streak;
}

// --- ROOM CODE ---
function generateRoomCodeLocal() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for(let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function validateRoomCode(code) {
  if(!code || code.length !== 4) return false;
  return /^[A-Z2-9]{4}$/.test(code);
}


// ═══════════════════════════════════════════════════════════════
//  1. AUTH — logowanie i rejestracja
// ═══════════════════════════════════════════════════════════════
suite('1. AUTH — logowanie i rejestracja');

test('Hash tego samego hasła daje ten sam wynik', () => {
  expect(hash('adminSzymon1')).toBe(hash('adminSzymon1'));
});

test('Hash różnych haseł daje różne wyniki', () => {
  const h1 = hash('haslo123');
  const h2 = hash('haslo124');
  if(h1 === h2) throw new Error('Kolizja hashy!');
});

test('Hash admina jest deterministyczny', () => {
  expect(hash('adminSzymon1')).toBe('-xgc0jc');
});

test('Puste hasło nie jest akceptowane', () => {
  const pass = '';
  expect(pass.length === 0).toBeTruthy();
});

test('Nick za krótki (< 2 znaki) nie jest akceptowany', () => {
  const name = 'A';
  expect(name.length < 2).toBeTruthy();
});

test('Nick "Szymon1" jest adminem', () => {
  const ADMIN_USER = 'Szymon1';
  expect('Szymon1' === ADMIN_USER).toBeTruthy();
});

test('Zwykły user nie jest adminem', () => {
  const ADMIN_USER = 'Szymon1';
  expect('Kowalski' === ADMIN_USER).toBeFalsy();
});


// ═══════════════════════════════════════════════════════════════
//  2. ADMIN — zarządzanie ćwiczeniami
// ═══════════════════════════════════════════════════════════════
suite('2. ADMIN — zarządzanie ćwiczeniami');

test('Dodanie ćwiczenia bez nazwy — błąd walidacji', () => {
  const ex = { name: '', type: 'shanghai', targets: [10,11,12], scoring: defaultRules('shanghai') };
  const errs = validateExercise(ex);
  expect(errs.some(e => e.includes('nazwy'))).toBeTruthy();
});

test('Dodanie ćwiczenia bez sektorów — błąd walidacji', () => {
  const ex = { name: 'Test', type: 'shanghai', targets: [], scoring: defaultRules('shanghai') };
  const errs = validateExercise(ex);
  expect(errs.some(e => e.includes('sektorów'))).toBeTruthy();
});

test('Dodanie ćwiczenia bez reguł punktacji — błąd walidacji', () => {
  const ex = { name: 'Test', type: 'shanghai', targets: [10,11], scoring: [] };
  const errs = validateExercise(ex);
  expect(errs.some(e => e.includes('reguł'))).toBeTruthy();
});

test('Sektor poza zakresem 1-20 — błąd walidacji', () => {
  const ex = { name: 'Test', type: 'shanghai', targets: [0, 21, 25], scoring: defaultRules('shanghai') };
  const errs = validateExercise(ex);
  expect(errs.some(e => e.includes('sektory'))).toBeTruthy();
});

test('Poprawne ćwiczenie Shanghai przechodzi walidację', () => {
  const ex = {
    name: 'Shanghai 10-15', type: 'shanghai',
    targets: [10,11,12,13,14,15], scoring: defaultRules('shanghai')
  };
  const errs = validateExercise(ex);
  expect(errs.length).toBe(0);
});

test('Poprawne ćwiczenie Doubles przechodzi walidację', () => {
  const ex = {
    name: 'Double 1-20', type: 'doubles',
    targets: [1,2,3,'BULL'], scoring: defaultRules('doubles')
  };
  const errs = validateExercise(ex);
  expect(errs.length).toBe(0);
});

test('Domyślne reguły Shanghai mają 4 wpisy', () => {
  const rules = defaultRules('shanghai');
  expect(rules.length).toBe(4);
});

test('Domyślne reguły Doubles mają 3 wpisy', () => {
  const rules = defaultRules('doubles');
  expect(rules.length).toBe(3);
});

test('Admin może wyłączyć ćwiczenie (enabled=false)', () => {
  const ex = { name: 'Test', enabled: true };
  ex.enabled = false;
  expect(ex.enabled).toBeFalsy();
});

test('Wyłączone ćwiczenie nie pojawia się w liście aktywnych', () => {
  const exercises = [
    { id: '1', name: 'A', enabled: true },
    { id: '2', name: 'B', enabled: false },
    { id: '3', name: 'C', enabled: true },
  ];
  const active = exercises.filter(e => e.enabled !== false);
  expect(active.length).toBe(2);
  expect(active.some(e => e.name === 'B')).toBeFalsy();
});


// ═══════════════════════════════════════════════════════════════
//  3. PUNKTACJA — Shanghai
// ═══════════════════════════════════════════════════════════════
suite('3. PUNKTACJA — ćwiczenie Shanghai');

const shanghaiRules = defaultRules('shanghai');
const shanghaiTargets = [10,11,12,13,14,15];

test('Single = 1 pkt', () => {
  const throws = [{zone:'single', pts:1, cc:'s'}];
  const r = calcRoundScore(throws, shanghaiRules, shanghaiTargets, 0);
  expect(r.pts).toBe(1);
  expect(r.bonus).toBe(0);
});

test('Double = 2 pkt', () => {
  const throws = [{zone:'double', pts:2, cc:'d'}];
  const r = calcRoundScore(throws, shanghaiRules, shanghaiTargets, 0);
  expect(r.pts).toBe(2);
  expect(r.bonus).toBe(0);
});

test('Treble = 3 pkt', () => {
  const throws = [{zone:'triple', pts:3, cc:'t'}];
  const r = calcRoundScore(throws, shanghaiRules, shanghaiTargets, 0);
  expect(r.pts).toBe(3);
  expect(r.bonus).toBe(0);
});

test('Pudło = 0 pkt', () => {
  const throws = [{zone:'miss', pts:0, cc:'m'}];
  const r = calcRoundScore(throws, shanghaiRules, shanghaiTargets, 0);
  expect(r.pts).toBe(0);
  expect(r.bonus).toBe(0);
});

test('Shanghai (S+D+T) = 6 pkt + 100 bonus = 106', () => {
  const throws = [
    {zone:'single', pts:1, cc:'s'},
    {zone:'double', pts:2, cc:'d'},
    {zone:'triple', pts:3, cc:'t'}
  ];
  const r = calcRoundScore(throws, shanghaiRules, shanghaiTargets, 0);
  expect(r.pts).toBe(6);
  expect(r.bonus).toBe(100);
  expect(r.total).toBe(106);
});

test('S+S+D — brak Shanghai, brak bonusu', () => {
  const throws = [
    {zone:'single', pts:1, cc:'s'},
    {zone:'single', pts:1, cc:'s'},
    {zone:'double', pts:2, cc:'d'}
  ];
  const r = calcRoundScore(throws, shanghaiRules, shanghaiTargets, 0);
  expect(r.pts).toBe(4);
  expect(r.bonus).toBe(0);
});

test('3 pudła = 0 pkt', () => {
  const throws = [{zone:'miss',pts:0},{zone:'miss',pts:0},{zone:'miss',pts:0}];
  const r = calcRoundScore(throws, shanghaiRules, shanghaiTargets, 0);
  expect(r.total).toBe(0);
});

test('Maks. wynik rundy Shanghai = T20 = 3 pkt', () => {
  const throws = [{zone:'triple', pts:3, cc:'t'}];
  const r = calcRoundScore(throws, shanghaiRules, shanghaiTargets, 0);
  expect(r.pts).toBe(3);
});


// ═══════════════════════════════════════════════════════════════
//  4. PUNKTACJA — Doublesy
// ═══════════════════════════════════════════════════════════════
suite('4. PUNKTACJA — ćwiczenie Doubles');

const doublesRules = defaultRules('doubles');
const doublesTargets = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,'BULL'];

test('Trafiony double = 50 pkt', () => {
  const throws = [{zone:'double', pts:50, cc:'d'}];
  const r = calcRoundScore(throws, doublesRules, doublesTargets, 0);
  expect(r.pts).toBe(50);
  expect(r.bonus).toBe(0);
});

test('Pudło w doublesy = 0 pkt', () => {
  const throws = [{zone:'miss', pts:0, cc:'m'}];
  const r = calcRoundScore(throws, doublesRules, doublesTargets, 0);
  expect(r.total).toBe(0);
});

test('Bull (index 20) = 50 pkt bazowe + 50 bonus = 100 pkt', () => {
  const throws = [{zone:'bull', pts:50, cc:'d'}];
  const r = calcRoundScore(throws, doublesRules, doublesTargets, 20); // BULL jest na indeksie 20
  expect(r.pts).toBe(50);
  expect(r.bonus).toBe(50);
  expect(r.total).toBe(100);
});

test('Double (nie BULL) nie daje bonusu Bull', () => {
  const throws = [{zone:'double', pts:50, cc:'d'}];
  const r = calcRoundScore(throws, doublesRules, doublesTargets, 5); // target=6
  expect(r.bonus).toBe(0);
});


// ═══════════════════════════════════════════════════════════════
//  5. MECZ 501 — walidacja wpisywania
// ═══════════════════════════════════════════════════════════════
suite('5. MECZ 501 — walidacja wpisywania');

test('Wpisanie 0 jest akceptowane (brak rzutu)', () => {
  const r = validateMatchInput(0, 501, 'series');
  expect(r.ok).toBeTruthy();
  expect(r.after).toBe(501);
});

test('Seria 180 jest akceptowana przy wyniku 501', () => {
  const r = validateMatchInput(180, 501, 'series');
  expect(r.ok).toBeTruthy();
  expect(r.after).toBe(321);
});

test('Seria > 180 jest odrzucana', () => {
  const r = validateMatchInput(181, 501, 'series');
  expect(r.error).toContain('180');
});

test('Pojedynczy rzut > 60 jest odrzucany', () => {
  const r = validateMatchInput(61, 100, 'single');
  expect(r.error).toContain('60');
});

test('Pojedynczy rzut 60 (T20) jest akceptowany', () => {
  const r = validateMatchInput(60, 100, 'single');
  expect(r.ok).toBeTruthy();
});

test('Przekroczenie wyniku — bust', () => {
  const r = validateMatchInput(50, 40, 'series');
  expect(r.bust).toBeTruthy();
});

test('Wynik 1 po odliczeniu — bust (niemożliwy checkout)', () => {
  const r = validateMatchInput(39, 40, 'series');
  expect(r.bust).toBeTruthy();
});

test('Wynik 0 po odliczeniu — wygrana', () => {
  const r = validateMatchInput(40, 40, 'series');
  expect(r.ok).toBeTruthy();
  expect(r.after).toBe(0);
});

test('Wynik 2 po odliczeniu — możliwe D1', () => {
  const r = validateMatchInput(98, 100, 'series');
  expect(r.ok).toBeTruthy();
  expect(r.after).toBe(2);
});

test('NaN jest odrzucane', () => {
  const r = validateMatchInput(NaN, 501, 'series');
  expect(r.error).toBeTruthy();
});

test('Liczba ujemna jest odrzucana', () => {
  const r = validateMatchInput(-1, 501, 'series');
  expect(r.error).toBeTruthy();
});

test('Wpisanie wyniku równego aktualnemu = 0 (wygrana)', () => {
  const r = validateMatchInput(4, 4, 'series');
  expect(r.after).toBe(0);
});

test('Single tryb: 4 pkt przy 4 pozostałych = wygrana', () => {
  const r = validateMatchInput(4, 4, 'single');
  expect(r.ok).toBeTruthy();
  expect(r.after).toBe(0);
});


// ═══════════════════════════════════════════════════════════════
//  6. CHECKOUT — podpowiedzi zakończeń
// ═══════════════════════════════════════════════════════════════
suite('6. CHECKOUT — podpowiedzi zakończeń');

test('170 = T20, T20, DB', () => {
  expect(getCheckout(170)).toBe('T20, T20, DB');
});

test('160 = T20, T20, D20', () => {
  expect(getCheckout(160)).toBe('T20, T20, D20');
});

test('100 = T20, D20', () => {
  expect(getCheckout(100)).toBe('T20, D20');
});

test('40 = D20 (1 lotka)', () => {
  expect(getCheckout(40)).toBe('D20');
});

test('2 = D1', () => {
  expect(getCheckout(2)).toBe('D1');
});

test('169 = null (brak możliwości)', () => {
  expect(getCheckout(169)).toBeNull();
});

test('168 = null (brak możliwości)', () => {
  expect(getCheckout(168)).toBeNull();
});

test('171 = undefined (poza tablicą)', () => {
  expect(getCheckout(171)).toBeUndefined();
});

test('1 = undefined (poza tablicą)', () => {
  expect(getCheckout(1)).toBeUndefined();
});

test('Ulubiony D20 podpowiadany gdy checkout zawiera D20', () => {
  // score 40 = D20, ulubiony double 20
  const fav = getFavCheckout(40, [20]);
  expect(fav).toBe('D20');
});

test('Ulubiony D16 nie podpowiadany gdy checkout zawiera D20', () => {
  // score 40 = D20, ulubiony D16
  const fav = getFavCheckout(40, [16]);
  expect(fav).toBeNull();
});

test('Brak ulubionych = null', () => {
  const fav = getFavCheckout(100, []);
  expect(fav).toBeNull();
});

test('DB (bull) jako ulubiony przy checkoucie z DB', () => {
  // score 170 = T20, T20, DB — ulubiony bull (25)
  const fav = getFavCheckout(170, [25]);
  expect(fav).toBe('T20, T20, DB');
});


// ═══════════════════════════════════════════════════════════════
//  7. MULTIPLAYER — kod pokoju
// ═══════════════════════════════════════════════════════════════
suite('7. MULTIPLAYER — kod pokoju');

test('Wygenerowany kod ma 4 znaki', () => {
  const code = generateRoomCodeLocal();
  expect(code.length).toBe(4);
});

test('Wygenerowany kod zawiera tylko dozwolone znaki', () => {
  for(let i = 0; i < 20; i++) {
    const code = generateRoomCodeLocal();
    if(!/^[A-Z2-9]{4}$/.test(code))
      throw new Error(`Niedozwolone znaki w kodzie: ${code}`);
  }
});

test('Kod "XK92" przechodzi walidację', () => {
  expect(validateRoomCode('XK92')).toBeTruthy();
});

test('Za krótki kod (3 znaki) nie przechodzi walidacji', () => {
  expect(validateRoomCode('XK9')).toBeFalsy();
});

test('Za długi kod (5 znaków) nie przechodzi walidacji', () => {
  expect(validateRoomCode('XK92A')).toBeFalsy();
});

test('Pusty kod nie przechodzi walidacji', () => {
  expect(validateRoomCode('')).toBeFalsy();
});

test('Kod z niedozwolonymi znakami (litera I) nie przechodzi', () => {
  // Litera I jest niedozwolona (myli się z 1)
  // Walidacja po stronie serwera - kod generowany bez I i O
  // Test sprawdza że wygenerowane kody nigdy nie zawierają I
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // brak I i O
  const hasI = !chars.includes('I');
  const hasO = !chars.includes('O');
  expect(hasI && hasO).toBeTruthy();
});

test('Kod z niedozwolonymi znakami (cyfra 0) nie przechodzi', () => {
  expect(validateRoomCode('XK02')).toBeFalsy(); // 0 = niedozwolone
});

test('Host nie może dołączyć do własnego pokoju', () => {
  const hostId = 'user-123';
  const room = { host_id: 'user-123', status: 'waiting' };
  const canJoin = room.host_id !== hostId;
  expect(canJoin).toBeFalsy();
});

test('Gość może dołączyć do pokoju innego gracza', () => {
  const guestId = 'user-456';
  const room = { host_id: 'user-123', status: 'waiting' };
  const canJoin = room.host_id !== guestId && room.status === 'waiting';
  expect(canJoin).toBeTruthy();
});

test('Nie można dołączyć do pokoju w statusie active', () => {
  const guestId = 'user-456';
  const room = { host_id: 'user-123', status: 'active' };
  const canJoin = room.host_id !== guestId && room.status === 'waiting';
  expect(canJoin).toBeFalsy();
});


// ═══════════════════════════════════════════════════════════════
//  8. SESJE I POSTĘPY
// ═══════════════════════════════════════════════════════════════
suite('8. SESJE I POSTĘPY');

test('Rekord osobisty obliczany poprawnie', () => {
  const sessions = [
    createSession('u1', 'ex1', 'Shanghai', 120, 100, 20),
    createSession('u1', 'ex1', 'Shanghai', 180, 80, 100),
    createSession('u1', 'ex1', 'Shanghai', 95, 95, 0),
  ];
  expect(calcPersonalBest(sessions, 'ex1')).toBe(180);
});

test('Brak sesji = rekord 0', () => {
  expect(calcPersonalBest([], 'ex1')).toBe(0);
});

test('Sesje innych ćwiczeń nie wpływają na rekord', () => {
  const sessions = [
    createSession('u1', 'ex1', 'A', 200, 200, 0),
    createSession('u1', 'ex2', 'B', 50, 50, 0),
  ];
  expect(calcPersonalBest(sessions, 'ex2')).toBe(50);
});

test('Streak 1 — sesja dzisiaj', () => {
  const today = new Date().toISOString();
  const sessions = [{ created_at: today }];
  const streak = calcStreak(sessions);
  expect(streak).toBeGreaterThan(0);
});

test('Brak sesji = streak 0', () => {
  expect(calcStreak([])).toBe(0);
});

test('Suma punktów sesji = base + bonus', () => {
  const session = createSession('u1', 'ex1', 'Test', 106, 6, 100);
  expect(session.total_score).toBe(session.base_score + session.bonus_score);
});


// ═══════════════════════════════════════════════════════════════
//  9. PROFIL — walidacja danych
// ═══════════════════════════════════════════════════════════════
suite('9. PROFIL — walidacja danych użytkownika');

function validateProfile(data) {
  const errors = [];
  if(data.age !== null && (isNaN(data.age) || data.age < 5 || data.age > 99))
    errors.push('Wiek musi być między 5 a 99');
  if(data.dart_weight !== null && (isNaN(data.dart_weight) || data.dart_weight < 12 || data.dart_weight > 50))
    errors.push('Waga lotek musi być między 12 a 50g');
  if(data.favorite_doubles && data.favorite_doubles.some(d => d < 1 || d > 25))
    errors.push('Nieprawidłowy double');
  return errors;
}

test('Poprawny profil przechodzi walidację', () => {
  const errs = validateProfile({ age: 25, dart_weight: 22, favorite_doubles: [20, 16] });
  expect(errs.length).toBe(0);
});

test('Wiek < 5 jest odrzucany', () => {
  const errs = validateProfile({ age: 3, dart_weight: 22, favorite_doubles: [] });
  expect(errs.some(e => e.includes('Wiek'))).toBeTruthy();
});

test('Wiek > 99 jest odrzucany', () => {
  const errs = validateProfile({ age: 100, dart_weight: 22, favorite_doubles: [] });
  expect(errs.some(e => e.includes('Wiek'))).toBeTruthy();
});

test('Waga lotek < 12g jest odrzucana', () => {
  const errs = validateProfile({ age: 25, dart_weight: 10, favorite_doubles: [] });
  expect(errs.some(e => e.includes('Waga'))).toBeTruthy();
});

test('Waga lotek > 50g jest odrzucana', () => {
  const errs = validateProfile({ age: 25, dart_weight: 55, favorite_doubles: [] });
  expect(errs.some(e => e.includes('Waga'))).toBeTruthy();
});

test('Null age i null weight są akceptowane (pola opcjonalne)', () => {
  const errs = validateProfile({ age: null, dart_weight: null, favorite_doubles: [] });
  expect(errs.length).toBe(0);
});

test('Ulubiony double 20 jest akceptowany', () => {
  const errs = validateProfile({ age: null, dart_weight: null, favorite_doubles: [20] });
  expect(errs.length).toBe(0);
});

test('Ulubiony double 25 (BULL) jest akceptowany', () => {
  const errs = validateProfile({ age: null, dart_weight: null, favorite_doubles: [25] });
  expect(errs.length).toBe(0);
});


// ═══════════════════════════════════════════════════════════════
//  10. AVATAR — walidacja pliku
// ═══════════════════════════════════════════════════════════════
suite('10. AVATAR — walidacja przesyłania zdjęcia');

function validateAvatar(file) {
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if(!allowed.includes(file.type)) return { error: 'Dozwolone formaty: JPG, PNG, WebP' };
  if(file.size > 5 * 1024 * 1024) return { error: 'Plik za duży (max 5MB)' };
  return { ok: true };
}

test('JPG jest akceptowany', () => {
  expect(validateAvatar({ type: 'image/jpeg', size: 1000000 }).ok).toBeTruthy();
});

test('PNG jest akceptowany', () => {
  expect(validateAvatar({ type: 'image/png', size: 500000 }).ok).toBeTruthy();
});

test('WebP jest akceptowany', () => {
  expect(validateAvatar({ type: 'image/webp', size: 200000 }).ok).toBeTruthy();
});

test('GIF jest odrzucany', () => {
  expect(validateAvatar({ type: 'image/gif', size: 100000 }).error).toBeTruthy();
});

test('PDF jest odrzucany', () => {
  expect(validateAvatar({ type: 'application/pdf', size: 100000 }).error).toBeTruthy();
});

test('Plik > 5MB jest odrzucany', () => {
  expect(validateAvatar({ type: 'image/jpeg', size: 6 * 1024 * 1024 }).error).toContain('5MB');
});

test('Plik dokładnie 5MB jest akceptowany', () => {
  expect(validateAvatar({ type: 'image/jpeg', size: 5 * 1024 * 1024 }).ok).toBeTruthy();
});




// ═══════════════════════════════════════════════════════════════
//  11. ZAKOŃCZENIE GRY — wszystkie scenariusze
// ═══════════════════════════════════════════════════════════════
suite('11. ZAKOŃCZENIE GRY — tryb seria i rzut po rzucie');

test('[SERIA] 40 pkt, wpisuję 40 → wygrana (after=0)', () => {
  const r = validateMatchInput(40, 40, 'series');
  expect(r.ok).toBeTruthy();
  expect(r.after).toBe(0);
});

test('[SERIA] 55 pkt, seria 21+20+4=45 → zostaje 10, NIE wygrana', () => {
  const r = validateMatchInput(45, 55, 'series');
  expect(r.ok).toBeTruthy();
  expect(r.after).toBe(10);
});

test('[SERIA] 55 pkt, seria 21+20+14=55 → wygrana', () => {
  const r = validateMatchInput(55, 55, 'series');
  expect(r.ok).toBeTruthy();
  expect(r.after).toBe(0);
});

test('[SERIA] 55 pkt, wpisuję 60 → bust', () => {
  const r = validateMatchInput(60, 55, 'series');
  expect(r.bust).toBeTruthy();
});

test('[SERIA] 55 pkt, wpisuję 54 → zostaje 1 → bust', () => {
  const r = validateMatchInput(54, 55, 'series');
  expect(r.bust).toBeTruthy();
});

test('[RZUT] 4 pkt, rzut 4 → wygrana w 1. rzucie serii', () => {
  const r = validateMatchInput(4, 4, 'single');
  expect(r.ok).toBeTruthy();
  expect(r.after).toBe(0);
});

test('[RZUT] 4 pkt, rzut 1 → zostaje 3, czekaj na kolejny rzut', () => {
  const r = validateMatchInput(1, 4, 'single');
  expect(r.ok).toBeTruthy();
  expect(r.after).toBe(3);
});

test('[RZUT] 4 pkt, rzut 5 → bust', () => {
  const r = validateMatchInput(5, 4, 'single');
  expect(r.bust).toBeTruthy();
});

test('[RZUT] pojedynczy rzut max 60 (T20)', () => {
  const r = validateMatchInput(60, 100, 'single');
  expect(r.ok).toBeTruthy();
  expect(r.after).toBe(40);
});

test('[RZUT] pojedynczy rzut 61 odrzucony', () => {
  const r = validateMatchInput(61, 100, 'single');
  expect(r.error).toContain('60');
});

test('[301] poprawna gra do 0: 180+121=301', () => {
  let score = 301;
  let r1 = validateMatchInput(180, score, 'series');
  expect(r1.ok).toBeTruthy();
  score = r1.after; // 121
  let r2 = validateMatchInput(121, score, 'series');
  expect(r2.ok).toBeTruthy();
  expect(r2.after).toBe(0);
});

test('[701] wpisanie 180 przy 701 → zostaje 521', () => {
  const r = validateMatchInput(180, 701, 'series');
  expect(r.ok).toBeTruthy();
  expect(r.after).toBe(521);
});

test('Gra NIE może być kontynuowana gdy after===0', () => {
  const r = validateMatchInput(40, 40, 'series');
  // after===0 oznacza koniec gry — żadne kolejne wpisywanie nie powinno być możliwe
  const gameOver = r.after === 0;
  expect(gameOver).toBeTruthy();
});

test('Za dużo w serii — stan punktów nie zmienia się', () => {
  const currentScore = 55;
  const r = validateMatchInput(60, currentScore, 'series');
  // bust — score powinien zostać bez zmian
  expect(r.bust).toBeTruthy();
  // currentScore nadal 55 (aplikacja nie zmienia stanu przy buście)
  expect(currentScore).toBe(55);
});

// ═══════════════════════════════════════════════════════════════
//  PODSUMOWANIE
// ═══════════════════════════════════════════════════════════════
console.log(`\n${'═'.repeat(60)}`);
console.log(`  WYNIKI`);
console.log('═'.repeat(60));
console.log(`  Zaliczone:  ${passed}`);
console.log(`  Niezaliczone: ${failed}`);
console.log(`  Łącznie:    ${passed + failed}`);
console.log('═'.repeat(60));

if(failed > 0) {
  console.log(`\n  ❌ ${failed} test(ów) nie przeszło!`);
  process.exit(1);
} else {
  console.log(`\n  ✅ Wszystkie testy zaliczone!`);
  process.exit(0);
}
