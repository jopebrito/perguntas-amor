/* ======================================================
   500 PERGUNTAS DE AMOR  –  José & Rita
   2-phase game: Answer → Guess (Family Feud)
   PIN auth, Firebase, sounds, progress, reset
   ====================================================== */

// ── Firebase Config ──
const firebaseConfig = {
  apiKey: "AIzaSyD-RN1T3nfjAIRMY9c9hW_kmtz_KdXFHCA",
  authDomain: "perguntas-amor.firebaseapp.com",
  projectId: "perguntas-amor",
  storageBucket: "perguntas-amor.firebasestorage.app",
  messagingSenderId: "348271320422",
  appId: "1:348271320422:web:acce1f3d417efd865b7ca7"
};

const CATEGORIES = [
    { id: 0, name: "Gostos & Preferências", emoji: "🎨" },
    { id: 1, name: "Sobre Nós",             emoji: "💑" },
    { id: 2, name: "Sonhos & Futuro",       emoji: "✨" },
    { id: 3, name: "Recordações",           emoji: "📸" },
    { id: 4, name: "Comida & Bebida",       emoji: "🍕" },
    { id: 5, name: "Entretenimento",        emoji: "🎬" },
    { id: 6, name: "Cenários & Dilemas",    emoji: "🤔" },
    { id: 7, name: "Amor & Romance",        emoji: "💕" },
    { id: 8, name: "Viagens & Aventuras",   emoji: "✈️" },
    { id: 9, name: "Personalidade & Valores", emoji: "🧠" }
];

// ── Sounds (Web Audio API) ──
const Sound = {
    ctx: null, on: true,
    _i() { if (this.ctx) return; try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) { this.on = false; } },
    _t(f, d, ty, v) { if (!this.on) return; this._i(); if (!this.ctx) return;
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = ty || 'sine'; o.frequency.value = f; g.gain.value = v || 0.07;
        g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + d);
        o.connect(g); g.connect(this.ctx.destination); o.start(); o.stop(this.ctx.currentTime + d);
    },
    tap()     { this._t(800, 0.07, 'sine', 0.05); },
    select()  { this._t(600, 0.05, 'sine', 0.04); setTimeout(() => this._t(900, 0.08, 'sine', 0.04), 60); },
    success() { [523,659,784].forEach((f,i) => setTimeout(() => this._t(f, 0.12, 'sine', 0.06), i*100)); },
    wrong()   { this._t(200, 0.2, 'square', 0.04); setTimeout(() => this._t(160, 0.3, 'square', 0.04), 150); },
    complete(){ [523,659,784,1047].forEach((f,i) => setTimeout(() => this._t(f, 0.15, 'triangle', 0.07), i*110)); },
    whoosh()  { this._t(300, 0.12, 'sawtooth', 0.025); },
    pin()     { this._t(1200, 0.04, 'sine', 0.03); },
    reveal()  { this._t(440, 0.08, 'sine', 0.05); setTimeout(() => this._t(660, 0.08, 'sine', 0.05), 80);
                setTimeout(() => this._t(880, 0.15, 'sine', 0.05), 160); }
};

// ── App ──
const App = {
    db: null, fbOk: false, saving: false,
    user: null,             // 'jose' | 'rita'
    answers: {},            // own answers {qId: value}
    partnerAnswers: {},     // partner's answers
    guesses: {},            // own guesses of partner's answers {qId: value}
    pins: {},               // {jose: '1234', rita: '5678'}
    queue: [], qIdx: 0,     // question navigation
    gQueue: [], gIdx: 0,    // guess navigation
    gCorrect: 0, gWrong: 0, // guess score
    _pin: '',               // current PIN being entered
    _selUser: null,         // user being selected at login

    // ══════════ INIT ══════════
    async init() {
        this.hearts();
        this.countdown();
        setInterval(() => this.countdown(), 1000);

        // Firebase
        try {
            if (firebaseConfig.apiKey !== "YOUR_API_KEY") {
                firebase.initializeApp(firebaseConfig);
                this.db = firebase.firestore();
                this.fbOk = true;
            }
        } catch(e) { console.warn('Firebase:', e); }

        // Load PINs
        try { this.pins = JSON.parse(localStorage.getItem('lq_pins') || '{}'); } catch(e) { this.pins = {}; }

        // Resume session
        const sess = localStorage.getItem('lq_session');
        if (sess) {
            this.user = sess;
            await this.loadAll();
            this.go('dashboard');
        } else {
            this.go('welcome');
        }
        document.getElementById('loading').classList.add('hidden');

        // Unlock audio
        const u = () => { Sound._i(); document.removeEventListener('touchstart', u); document.removeEventListener('click', u); };
        document.addEventListener('touchstart', u, { once: true });
        document.addEventListener('click', u, { once: true });
    },

    // ══════════ NAVIGATION ══════════
    go(id) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const el = document.getElementById('screen-' + id);
        if (el) { el.classList.add('active'); window.scrollTo(0, 0); }
        if (id === 'dashboard') this.renderDash();
        if (id === 'question')  this.renderQ();
        if (id === 'guess')     this.renderGuessQ();
    },

    // ══════════ AUTH (PIN-based) ══════════
    selectUser(who) {
        Sound.tap();
        this._selUser = who;
        this._pin = '';

        // Highlight selected card
        document.getElementById('card-jose').classList.toggle('selected', who === 'jose');
        document.getElementById('card-rita').classList.toggle('selected', who === 'rita');

        // Show PIN pad
        document.getElementById('pin-area').style.display = '';
        document.getElementById('pin-label').textContent = `PIN ${who === 'jose' ? 'do José' : 'da Rita'}`;
        this.updatePinDots();

        // Hint
        const hasPin = this.pins[who];
        document.querySelector('.pin-hint').textContent = hasPin
            ? 'Introduz o teu PIN para entrar'
            : 'Primeira vez? O PIN que escreveres fica como teu.';
    },

    pinKey(k) {
        if (k === 'clear') { this._pin = ''; this.updatePinDots(); Sound.tap(); return; }
        if (k === 'go') { this.tryLogin(); return; }
        if (this._pin.length >= 4) return;
        this._pin += k;
        Sound.pin();
        if (navigator.vibrate) navigator.vibrate(10);
        this.updatePinDots();
        if (this._pin.length === 4) setTimeout(() => this.tryLogin(), 200);
    },

    updatePinDots() {
        const dots = document.querySelectorAll('#pin-dots .dot');
        dots.forEach((d, i) => d.classList.toggle('filled', i < this._pin.length));
    },

    async tryLogin() {
        const who = this._selUser;
        const pin = this._pin;
        if (pin.length !== 4) { this.toast('PIN tem de ter 4 dígitos'); return; }

        // Load remote PINs if available
        if (this.fbOk) {
            try {
                const doc = await this.db.collection('config').doc('pins').get();
                if (doc.exists) this.pins = { ...this.pins, ...doc.data() };
            } catch(e) {}
        }

        const stored = this.pins[who];
        if (stored && stored !== pin) {
            Sound.wrong();
            this.toast('PIN incorreto! ❌');
            this._pin = '';
            this.updatePinDots();
            return;
        }

        // First time: save PIN
        if (!stored) {
            this.pins[who] = pin;
            localStorage.setItem('lq_pins', JSON.stringify(this.pins));
            if (this.fbOk) {
                try { await this.db.collection('config').doc('pins').set(this.pins, { merge: true }); } catch(e) {}
            }
        }

        // Login
        this.user = who;
        localStorage.setItem('lq_session', who);
        localStorage.setItem('lq_pins', JSON.stringify(this.pins));
        await this.loadAll();
        Sound.success();
        this.go('dashboard');
        this.toast(`Olá ${who === 'jose' ? 'José' : 'Rita'}! 💖`);
    },

    logout() {
        Sound.tap();
        this.user = null;
        this.answers = {};
        this.partnerAnswers = {};
        this.guesses = {};
        localStorage.removeItem('lq_session');
        this._pin = '';
        this._selUser = null;
        document.getElementById('pin-area').style.display = 'none';
        document.querySelectorAll('.card-login').forEach(c => c.classList.remove('selected'));
        this.go('login');
    },

    // ══════════ DATA ══════════
    async loadAll() {
        if (!this.user) return;
        const p = this.user === 'jose' ? 'rita' : 'jose';

        // Local
        try { this.answers = JSON.parse(localStorage.getItem('lq_a_' + this.user) || '{}'); } catch(e) { this.answers = {}; }
        try { this.guesses = JSON.parse(localStorage.getItem('lq_g_' + this.user) || '{}'); } catch(e) { this.guesses = {}; }

        // Firebase
        if (this.fbOk) {
            try {
                const d = await this.db.collection('players').doc(this.user).get();
                if (d.exists) {
                    const data = d.data();
                    if (data.answers && Object.keys(data.answers).length >= Object.keys(this.answers).length)
                        this.answers = data.answers;
                    if (data.guesses && Object.keys(data.guesses).length >= Object.keys(this.guesses).length)
                        this.guesses = data.guesses;
                }
                // Partner answers (only load if both completed for guess mode)
                const pd = await this.db.collection('players').doc(p).get();
                if (pd.exists && pd.data().answers) this.partnerAnswers = pd.data().answers;
                else this.partnerAnswers = {};
            } catch(e) { console.warn('FB load:', e); this.partnerAnswers = {}; }
        }

        // Backup local
        localStorage.setItem('lq_a_' + this.user, JSON.stringify(this.answers));
        localStorage.setItem('lq_g_' + this.user, JSON.stringify(this.guesses));
    },

    async saveAnswer(qId, val) {
        this.answers[qId] = val;
        localStorage.setItem('lq_a_' + this.user, JSON.stringify(this.answers));
        if (this.fbOk && !this.saving) {
            this.saving = true;
            try {
                await this.db.collection('players').doc(this.user).set({
                    answers: this.answers,
                    guesses: this.guesses,
                    user: this.user,
                    answeredCount: Object.keys(this.answers).length,
                    updated: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            } catch(e) { console.warn('FB save:', e); }
            this.saving = false;
        }
    },

    async saveGuess(qId, val) {
        this.guesses[qId] = val;
        localStorage.setItem('lq_g_' + this.user, JSON.stringify(this.guesses));
        if (this.fbOk) {
            try {
                await this.db.collection('players').doc(this.user).set({
                    guesses: this.guesses,
                    updated: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            } catch(e) {}
        }
    },

    // ══════════ DASHBOARD ══════════
    renderDash() {
        const isJ = this.user === 'jose';
        document.getElementById('dash-emoji').textContent = isJ ? '🧔' : '👩';
        document.getElementById('dash-name').textContent = isJ ? 'José' : 'Rita';

        const myN = Object.keys(this.answers).length;
        const partnerN = Object.keys(this.partnerAnswers).length;
        const pct = (myN / 500) * 100;
        const bothDone = myN >= 500 && partnerN >= 500;

        // Ring
        document.getElementById('prog-num').textContent = myN;
        const circ = 2 * Math.PI * 52;
        document.getElementById('prog-fill').style.strokeDasharray = circ;
        document.getElementById('prog-fill').style.strokeDashoffset = circ - (pct / 100) * circ;

        // Messages
        const t = document.getElementById('prog-title');
        const m = document.getElementById('prog-msg');
        if (myN === 0) { t.textContent = "Vamos começar!"; m.textContent = "500 perguntas à tua espera"; }
        else if (pct < 25) { t.textContent = "Bom começo!"; m.textContent = `${myN} respondidas`; }
        else if (pct < 50) { t.textContent = "A ir bem! 💪"; m.textContent = `${myN}/500 – faltam ${500-myN}`; }
        else if (pct < 75) { t.textContent = "Mais de metade!"; m.textContent = `${myN}/500 feitas`; }
        else if (pct < 100) { t.textContent = "Quase lá! 🔥"; m.textContent = `Só faltam ${500-myN}!`; }
        else { t.textContent = "Tudo respondido! 🎉"; m.textContent = "Completaste as 500 perguntas!"; }

        // Daily goal
        const days = this.daysLeft();
        const g = document.getElementById('prog-goal');
        if (days > 0 && 500 - myN > 0) g.textContent = `Meta: ~${Math.ceil((500-myN)/days)}/dia`;
        else if (myN >= 500) g.textContent = '';
        else g.textContent = '';

        // Answer button
        const bt = document.getElementById('btn-answer-text');
        if (myN === 0) bt.textContent = 'Começar a responder';
        else if (myN >= 500) bt.textContent = 'Rever respostas';
        else bt.textContent = 'Continuar a responder';

        // Guess card (Phase 2)
        const lockEl = document.getElementById('guess-lock');
        const unlockEl = document.getElementById('guess-unlocked');
        if (bothDone) {
            lockEl.style.display = 'none';
            unlockEl.style.display = '';
            const gN = Object.keys(this.guesses).length;
            const guessable = QUESTIONS.filter(q => q.type !== 'text').length;
            document.getElementById('guess-score').textContent = gN > 0 ? `Já adivinhaste ${gN}/${guessable}` : '';
        } else {
            lockEl.style.display = '';
            unlockEl.style.display = 'none';
            const partnerName = isJ ? 'Rita' : 'José';
            document.getElementById('guess-msg').textContent =
                myN >= 500
                    ? `À espera que ${partnerName} termine (${partnerN}/500)...`
                    : `Responde às 500 perguntas para desbloquear. ${partnerName}: ${partnerN}/500`;
            document.getElementById('guess-progress').innerHTML =
                `<div class="gp-row"><span>🧔 José: ${isJ ? myN : partnerN}/500</span></div>` +
                `<div class="gp-row"><span>👩 Rita: ${isJ ? partnerN : myN}/500</span></div>`;
        }

        // Categories
        const grid = document.getElementById('cat-grid');
        grid.innerHTML = '';
        CATEGORIES.forEach(c => {
            const qs = QUESTIONS.filter(q => q.cat === c.id);
            const done = qs.filter(q => this.answers[q.id] !== undefined).length;
            const p2 = qs.length > 0 ? (done / qs.length) * 100 : 0;
            const ok = done === qs.length && qs.length > 0;
            const el = document.createElement('button');
            el.className = 'cat-card' + (ok ? ' done' : '');
            el.onclick = () => { Sound.tap(); this.startCat(c.id); };
            el.innerHTML = `<span class="cat-e">${c.emoji}</span><span class="cat-n">${c.name}</span>
                <div class="cat-bar"><div class="cat-bar-fill" style="width:${p2}%"></div></div>
                <span class="cat-c">${done}/${qs.length}${ok ? ' ✓' : ''}</span>`;
            grid.appendChild(el);
        });
    },

    // ══════════ ANSWER MODE ══════════
    continueAnswering() {
        Sound.tap();
        this.queue = QUESTIONS.map(q => q.id);
        const first = QUESTIONS.find(q => this.answers[q.id] === undefined);
        this.qIdx = first ? this.queue.indexOf(first.id) : 0;
        this.go('question');
    },
    startCat(catId) {
        const qs = QUESTIONS.filter(q => q.cat === catId);
        this.queue = qs.map(q => q.id);
        const first = qs.find(q => this.answers[q.id] === undefined);
        this.qIdx = first ? this.queue.indexOf(first.id) : 0;
        this.go('question');
    },

    renderQ() {
        if (!this.queue.length) return;
        const qId = this.queue[this.qIdx];
        const q = QUESTIONS.find(x => x.id === qId);
        if (!q) return;
        const cat = CATEGORIES[q.cat];

        document.getElementById('q-badge').textContent = `${cat.emoji} ${cat.name}`;
        document.getElementById('q-count').textContent = `${this.qIdx + 1}/${this.queue.length}`;
        document.getElementById('q-bar-fill').style.width = `${((this.qIdx + 1) / this.queue.length) * 100}%`;
        document.getElementById('q-num').textContent = `Pergunta ${q.id} de 500`;
        document.getElementById('q-text').textContent = q.text;

        const area = document.getElementById('q-answers');
        const saved = this.answers[q.id];

        if (q.type === 'thisorthat') {
            area.innerHTML = `<div class="ans-grid c2">${q.options.map(o =>
                `<button class="ans-btn${saved === o ? ' sel' : ''}" onclick="App.pick(${q.id}, this)">${this._esc(o)}</button>`
            ).join('')}</div>`;
        } else if (q.type === 'choice') {
            area.innerHTML = `<div class="ans-grid c1">${q.options.map(o =>
                `<button class="ans-btn${saved === o ? ' sel' : ''}" onclick="App.pick(${q.id}, this)">${this._esc(o)}</button>`
            ).join('')}</div>`;
        } else if (q.type === 'scale') {
            area.innerHTML = `<div class="ans-scale">
                <div class="scale-labels"><span>Nada</span><span>Muito</span></div>
                <div class="scale-row">${[1,2,3,4,5,6,7,8,9,10].map(n =>
                    `<button class="scale-btn${saved == n ? ' sel' : ''}" onclick="App.pick(${q.id}, this)">${n}</button>`
                ).join('')}</div></div>`;
        } else {
            area.innerHTML = `<div class="ans-text-wrap">
                <textarea class="ans-textarea" id="ta" placeholder="Escreve a tua resposta...">${this._esc(saved || '')}</textarea>
                <button class="btn btn-sm btn-accent" onclick="App.pickText(${q.id})">Guardar</button></div>`;
        }

        document.getElementById('btn-prev').style.display = this.qIdx > 0 ? '' : 'none';
        const has = this.answers[q.id] !== undefined;
        document.getElementById('btn-skip').style.display = has ? 'none' : '';
        document.getElementById('btn-next').style.display = has ? '' : 'none';

        const card = document.getElementById('q-card');
        card.classList.remove('pop'); void card.offsetWidth; card.classList.add('pop');
    },

    async pick(qId, btn) {
        const val = btn.textContent.trim();
        Sound.select();
        if (navigator.vibrate) navigator.vibrate(15);
        await this.saveAnswer(qId, val);
        btn.parentElement.querySelectorAll('.ans-btn, .scale-btn').forEach(b => b.classList.remove('sel'));
        btn.classList.add('sel');
        document.getElementById('btn-skip').style.display = 'none';
        document.getElementById('btn-next').style.display = '';
        setTimeout(() => {
            if (this.qIdx < this.queue.length - 1) this.next();
            else { Sound.complete(); this.toast('Secção completa! 🎉'); this.confetti(); setTimeout(() => this.go('dashboard'), 1000); }
        }, 350);
    },

    async pickText(qId) {
        const v = document.getElementById('ta').value.trim();
        if (!v) { this.toast('Escreve algo primeiro! ✍️'); return; }
        Sound.success();
        if (navigator.vibrate) navigator.vibrate(15);
        await this.saveAnswer(qId, v);
        this.toast('Guardado! ✓');
        document.getElementById('btn-skip').style.display = 'none';
        document.getElementById('btn-next').style.display = '';
        setTimeout(() => { if (this.qIdx < this.queue.length - 1) this.next(); }, 400);
    },

    next() {
        if (this.qIdx < this.queue.length - 1) { this.qIdx++; Sound.whoosh(); this.renderQ(); window.scrollTo(0,0); }
        else { Sound.complete(); this.toast('Secção completa! 🎉'); this.confetti(); setTimeout(() => this.go('dashboard'), 1000); }
    },
    prev() {
        if (this.qIdx > 0) { this.qIdx--; Sound.whoosh(); this.renderQ(); window.scrollTo(0,0); }
    },

    // ══════════ GUESS MODE (Family Feud) ══════════
    startGuess() {
        Sound.tap();
        // Only guessable questions (not text)
        const guessable = QUESTIONS.filter(q => q.type !== 'text' && this.guesses[q.id] === undefined);
        if (guessable.length === 0) {
            // All guessed, show results
            this.go('results');
            this.renderResults();
            return;
        }
        this.gQueue = guessable.map(q => q.id);
        this.gIdx = 0;
        this.gCorrect = 0;
        this.gWrong = 0;
        this.go('guess');
    },

    renderGuessQ() {
        if (!this.gQueue.length) return;
        const qId = this.gQueue[this.gIdx];
        const q = QUESTIONS.find(x => x.id === qId);
        if (!q) return;

        const isJ = this.user === 'jose';
        const partnerName = isJ ? 'a Rita' : 'o José';

        document.getElementById('g-count').textContent = `${this.gIdx + 1}/${this.gQueue.length}`;
        document.getElementById('g-bar-fill').style.width = `${((this.gIdx + 1) / this.gQueue.length) * 100}%`;
        document.getElementById('g-num').textContent = `Pergunta ${q.id}`;
        document.getElementById('g-text').textContent = q.text;
        document.getElementById('g-partner-name').textContent = `O que achas que ${partnerName} respondeu?`;

        // Hide reveal
        document.getElementById('reveal-area').style.display = 'none';

        // Score
        document.getElementById('score-correct').textContent = `✓ ${this.gCorrect}`;
        document.getElementById('score-wrong').textContent = `✗ ${this.gWrong}`;

        // Options
        const area = document.getElementById('g-answers');
        if (q.type === 'thisorthat') {
            area.innerHTML = `<div class="ans-grid c2">${q.options.map(o =>
                `<button class="ans-btn" onclick="App.guessAnswer(${q.id}, this)">${this._esc(o)}</button>`
            ).join('')}</div>`;
        } else if (q.type === 'choice') {
            area.innerHTML = `<div class="ans-grid c1">${q.options.map(o =>
                `<button class="ans-btn" onclick="App.guessAnswer(${q.id}, this)">${this._esc(o)}</button>`
            ).join('')}</div>`;
        } else if (q.type === 'scale') {
            area.innerHTML = `<div class="ans-scale">
                <div class="scale-labels"><span>Nada</span><span>Muito</span></div>
                <div class="scale-row">${[1,2,3,4,5,6,7,8,9,10].map(n =>
                    `<button class="scale-btn" onclick="App.guessAnswer(${q.id}, this)">${n}</button>`
                ).join('')}</div></div>`;
        }
        area.style.display = '';

        const card = document.getElementById('g-card');
        card.classList.remove('pop'); void card.offsetWidth; card.classList.add('pop');
    },

    async guessAnswer(qId, btn) {
        const guess = btn.textContent.trim();
        const q = QUESTIONS.find(x => x.id === qId);
        const actual = this.partnerAnswers[qId];
        if (actual === undefined) return;

        // Disable all buttons
        document.getElementById('g-answers').querySelectorAll('button').forEach(b => {
            b.disabled = true;
            b.style.pointerEvents = 'none';
        });

        let correct = false;
        if (q.type === 'scale') {
            correct = Math.abs(Number(guess) - Number(actual)) <= 1; // within 1 = correct
        } else {
            correct = String(guess) === String(actual);
        }

        if (correct) this.gCorrect++; else this.gWrong++;
        await this.saveGuess(qId, guess);

        // Mark correct/wrong
        btn.classList.add(correct ? 'guess-right' : 'guess-wrong');

        // Highlight actual answer
        if (!correct) {
            document.getElementById('g-answers').querySelectorAll('button').forEach(b => {
                if (b.textContent.trim() === String(actual)) b.classList.add('guess-actual');
            });
        }

        // Reveal
        if (navigator.vibrate) navigator.vibrate(correct ? [20, 30, 20] : [100]);
        setTimeout(() => {
            if (correct) { Sound.reveal(); } else { Sound.wrong(); }
            document.getElementById('g-answers').style.display = 'none';
            document.getElementById('reveal-area').style.display = '';
            document.getElementById('reveal-icon').textContent = correct ? '💚' : '💛';
            document.getElementById('reveal-label').textContent = correct ? 'Acertaste!' : 'Quase!';
            document.getElementById('reveal-answer').textContent =
                correct ? `Ambos: ${actual}` : `Respondeu: ${actual}`;
            document.getElementById('reveal-card').className = 'reveal-card ' + (correct ? 'reveal-correct' : 'reveal-wrong');

            document.getElementById('score-correct').textContent = `✓ ${this.gCorrect}`;
            document.getElementById('score-wrong').textContent = `✗ ${this.gWrong}`;

            if (correct) this.miniConfetti();
        }, 500);
    },

    nextGuess() {
        if (this.gIdx < this.gQueue.length - 1) {
            this.gIdx++;
            Sound.whoosh();
            this.renderGuessQ();
            window.scrollTo(0, 0);
        } else {
            Sound.complete();
            this.confetti();
            const total = this.gCorrect + this.gWrong;
            const pct = total > 0 ? Math.round(this.gCorrect / total * 100) : 0;
            this.toast(`Ronda completa! ${pct}% corretas 🎉`);
            setTimeout(() => this.go('dashboard'), 1500);
        }
    },

    // ══════════ RESULTS ══════════
    async renderResults() {
        await this.loadAll();
        const myN = Object.keys(this.answers).length;
        const pN = Object.keys(this.partnerAnswers).length;
        const isJ = this.user === 'jose';
        document.getElementById('rc-jose').textContent = `${isJ ? myN : pN}/500`;
        document.getElementById('rc-rita').textContent = `${isJ ? pN : myN}/500`;
        this.filterResults('all');
    },

    filterResults(f) {
        document.querySelectorAll('.fbtn').forEach(b => b.classList.toggle('active', b.dataset.f === f));
        const list = document.getElementById('results-list');
        const both = QUESTIONS.filter(q => this.answers[q.id] !== undefined && this.partnerAnswers[q.id] !== undefined);
        if (!both.length) { list.innerHTML = '<p class="empty-msg">Ambos precisam de responder para comparar! 💕</p>'; document.getElementById('match-box').style.display = 'none'; return; }

        const comp = both.filter(q => q.type !== 'text');
        let match = 0;
        comp.forEach(q => { if (String(this.answers[q.id]) === String(this.partnerAnswers[q.id])) match++; });
        const pct = comp.length ? Math.round(match / comp.length * 100) : 0;
        document.getElementById('match-box').style.display = '';
        document.getElementById('match-num').textContent = pct + '%';

        let items = both;
        if (f === 'match') items = both.filter(q => String(this.answers[q.id]) === String(this.partnerAnswers[q.id]));
        if (f === 'diff')  items = both.filter(q => String(this.answers[q.id]) !== String(this.partnerAnswers[q.id]));

        const isJ = this.user === 'jose';
        list.innerHTML = items.length === 0 ? '<p class="empty-msg">Nenhum resultado neste filtro.</p>'
            : items.map(q => {
                const my = this.answers[q.id], pa = this.partnerAnswers[q.id];
                const ok = String(my) === String(pa);
                return `<div class="res-item ${ok ? 'res-match' : 'res-diff'}">
                    <div class="res-q">${this._esc(q.text)}</div>
                    <div class="res-ans-row">
                        <div class="res-ans"><div class="res-who">🧔 José</div><div class="res-val">${this._esc(isJ ? my : pa)}</div></div>
                        <div class="res-ans"><div class="res-who">👩 Rita</div><div class="res-val">${this._esc(isJ ? pa : my)}</div></div>
                    </div></div>`;
            }).join('');
    },

    // ══════════ RESET ══════════
    resetConfirm() {
        document.getElementById('modal').style.display = '';
        document.getElementById('modal-msg').textContent = `Apagar TODAS as respostas de ${this.user === 'jose' ? 'José' : 'Rita'}? Esta ação não pode ser desfeita!`;
        document.getElementById('modal-confirm').onclick = () => this.doReset();
    },
    modalClose() { document.getElementById('modal').style.display = 'none'; },

    async doReset() {
        this.modalClose();
        this.answers = {};
        this.guesses = {};
        localStorage.setItem('lq_a_' + this.user, '{}');
        localStorage.setItem('lq_g_' + this.user, '{}');
        if (this.fbOk) {
            try {
                await this.db.collection('players').doc(this.user).set({
                    answers: {}, guesses: {},
                    user: this.user, answeredCount: 0,
                    updated: firebase.firestore.FieldValue.serverTimestamp()
                });
            } catch(e) { console.warn('Reset FB:', e); }
        }
        Sound.tap();
        this.toast('Tudo apagado! Começa de novo. 🔄');
        this.renderDash();
    },

    // ══════════ COUNTDOWN ══════════
    daysLeft() { const n = new Date(), v = new Date(n.getFullYear(),1,14,23,59,59); return n > v ? 0 : Math.ceil((v-n)/864e5); },
    countdown() {
        const now = new Date(), vd = new Date(now.getFullYear(),1,14,23,59,59), diff = vd - now;
        const we = document.getElementById('cd-welcome'), ti = document.getElementById('cd-timer');
        if (diff <= 0) {
            if (we) we.textContent = 'Feliz Dia dos Namorados! 💕';
            if (ti) ti.innerHTML = '<span class="cd-done">Feliz Dia dos Namorados! 💕</span>';
            return;
        }
        const d=Math.floor(diff/864e5),h=Math.floor(diff%864e5/36e5),m=Math.floor(diff%36e5/6e4),s=Math.floor(diff%6e4/1e3);
        if (we) we.textContent = `⏰ Faltam ${d} dias para o Dia dos Namorados!`;
        if (ti) ti.innerHTML =
            `<div class="cd-u"><span class="cd-n">${d}</span><span class="cd-l">dias</span></div>` +
            `<div class="cd-u"><span class="cd-n">${String(h).padStart(2,'0')}</span><span class="cd-l">horas</span></div>` +
            `<div class="cd-u"><span class="cd-n">${String(m).padStart(2,'0')}</span><span class="cd-l">min</span></div>` +
            `<div class="cd-u"><span class="cd-n">${String(s).padStart(2,'0')}</span><span class="cd-l">seg</span></div>`;
    },

    // ══════════ HELPERS ══════════
    _esc(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; },

    hearts() {
        const c = document.getElementById('hearts-bg');
        const hs = ['💖','💕','💗','💓','💝','♥️','💘'];
        for (let i = 0; i < 18; i++) {
            const s = document.createElement('span'); s.className = 'fh';
            s.textContent = hs[Math.floor(Math.random()*hs.length)];
            s.style.left = Math.random()*100+'%';
            s.style.fontSize = (12+Math.random()*16)+'px';
            s.style.animationDuration = (10+Math.random()*18)+'s';
            s.style.animationDelay = Math.random()*12+'s';
            c.appendChild(s);
        }
    },

    toast(msg) {
        const t = document.getElementById('toast');
        t.textContent = msg; t.classList.add('show');
        setTimeout(() => t.classList.remove('show'), 2500);
    },

    confetti() {
        const cols = ['#e91e63','#ff5252','#ffd54f','#7b1fa2','#4caf50','#2196f3','#ff9800'];
        for (let i = 0; i < 40; i++) {
            const d = document.createElement('div'); d.className = 'confetti';
            d.style.left = Math.random()*100+'vw';
            d.style.background = cols[Math.floor(Math.random()*cols.length)];
            d.style.animationDelay = Math.random()*1.5+'s';
            d.style.animationDuration = (2+Math.random()*2)+'s';
            document.body.appendChild(d);
            setTimeout(() => d.remove(), 4500);
        }
    },

    miniConfetti() {
        const cols = ['#4caf50','#ffd54f','#e91e63'];
        for (let i = 0; i < 12; i++) {
            const d = document.createElement('div'); d.className = 'confetti';
            d.style.left = (30+Math.random()*40)+'vw';
            d.style.background = cols[Math.floor(Math.random()*cols.length)];
            d.style.animationDelay = Math.random()*0.5+'s';
            d.style.animationDuration = (1.5+Math.random()*1.5)+'s';
            document.body.appendChild(d);
            setTimeout(() => d.remove(), 3000);
        }
    }
};

window.addEventListener('DOMContentLoaded', () => App.init());
