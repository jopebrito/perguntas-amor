/* ======================================================
   PEDRO & RITA – O Nosso Jogo
   Daily questions, calendar, compare mode
   PIN auth, Firebase sync, sounds
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

const PER_DAY = 15;
const TOTAL_DAYS = Math.ceil(QUESTIONS.length / PER_DAY);

// ── Sweet messages for Rita ──
const RITA_MSGS = [
    'Gosto tanto de ti, sabias? 💕',
    'A pessoa mais bonita do mundo acabou de entrar 🥰',
    'O meu coração bate mais forte quando estás aqui 💓',
    'Mesmo longe, estás sempre comigo 🌍❤️',
    'Tenho tantas saudades tuas... 🥺💕',
    'Tu és a melhor coisa que me aconteceu 💖',
    'Estou a contar os dias para te abraçar 🤗',
    'O meu sorriso preferido é o teu 😊',
    'Obrigado por existires na minha vida ✨',
    'Cada resposta tua faz-me gostar mais de ti 💝',
    'Tu fazes os meus dias melhores, mesmo a 10.759km 🌏',
    'Adoro descobrir coisas novas sobre ti 🔍💕',
    'Se pudesse, teletransportava-me para ao pé de ti agora 🚀',
    'O teu sorriso é o meu lugar favorito 🏠❤️',
    'Quando crescer, quero ser o teu vizinho do lado 😏💕',
    'Mais um dia a apaixonar-me mais por ti 📈❤️',
    'Rita, és especial. Não te esqueças disso nunca 💫',
    'A distância é temporária, nós somos para sempre 💪❤️',
    'Hoje é mais um dia perfeito porque tu existes 🌟',
    'Sabes o que tenho de bom? Tu. 💕',
];

const CATEGORIES = {
    preferences: { name: "Preferências", emoji: "💫" },
    us:          { name: "Sobre Nós",    emoji: "💑" },
    dreams:      { name: "Sonhos",       emoji: "✨" },
    memories:    { name: "Memórias",     emoji: "📸" },
    food:        { name: "Gostos",       emoji: "🍷" },
    entertainment:{ name: "Entretenimento", emoji: "🎬" },
    whatif:      { name: "E Se...",      emoji: "🤔" },
    intimacy:    { name: "Intimidade",   emoji: "🔥" },
    travel:      { name: "Viagens",      emoji: "✈️" },
    personality: { name: "Personalidade", emoji: "🧠" },
    spicy:       { name: "Picante",      emoji: "🌶️" }
};

// ── Sounds ──
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
    pin()     { this._t(1200, 0.04, 'sine', 0.03); }
};

// ── App ──
const App = {
    db: null, fbOk: false,
    user: null,
    answers: {},
    partnerAnswers: {},
    pins: {},
    startDate: null,
    currentDay: null,   // day being viewed/answered
    qIdx: 0,            // question index within day
    dayQuestions: [],    // questions for current day
    _pin: '',
    _selUser: null,
    _saveTimer: null,
    _savePending: false,
    _refreshTimer: null,

    // ══════════ INIT ══════════
    async init() {
        this.hearts();

        // Firebase
        try {
            if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY") {
                firebase.initializeApp(firebaseConfig);
                this.db = firebase.firestore();
                this.fbOk = true;
            }
        } catch(e) { console.warn('Firebase:', e); }

        // Load PINs
        try { this.pins = JSON.parse(localStorage.getItem('pr_pins') || '{}'); } catch(e) { this.pins = {}; }

        // Load start date
        try { this.startDate = localStorage.getItem('pr_start'); } catch(e) {}

        // Resume session
        const sess = localStorage.getItem('pr_session');
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

        // Save on leave
        window.addEventListener('beforeunload', () => this._flushSave());
        document.addEventListener('visibilitychange', () => { if (document.hidden) this._flushSave(); });
    },

    // ══════════ NAVIGATION ══════════
    go(id) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const el = document.getElementById('screen-' + id);
        if (el) { el.classList.add('active'); window.scrollTo(0, 0); }
        if (id === 'dashboard') this.renderCalendar();
        if (id === 'day')      this.renderQ();
    },

    // ══════════ DAY HELPERS ══════════
    getDayQuestions(day) {
        const start = (day - 1) * PER_DAY;
        return QUESTIONS.slice(start, start + PER_DAY);
    },

    // Get today's date string in Portugal timezone (YYYY-MM-DD)
    _ptToday() {
        return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Lisbon' });
    },

    getUnlockedDays() {
        if (!this.startDate) return 1;
        const now = new Date(this._ptToday() + 'T00:00:00');
        const start = new Date(this.startDate + 'T00:00:00');
        const diff = Math.floor((now - start) / 86400000) + 1;
        return Math.min(Math.max(diff, 1), TOTAL_DAYS);
    },

    async ensureStartDate() {
        if (this.startDate) return;
        this.startDate = this._ptToday();
        localStorage.setItem('pr_start', this.startDate);
        if (this.fbOk) {
            try {
                const doc = await this.db.collection('config').doc('settings').get();
                if (doc.exists && doc.data().startDate) {
                    this.startDate = doc.data().startDate;
                    localStorage.setItem('pr_start', this.startDate);
                } else {
                    await this.db.collection('config').doc('settings').set(
                        { startDate: this.startDate }, { merge: true }
                    );
                }
            } catch(e) {}
        }
    },

    // ══════════ AUTH ══════════
    selectUser(who) {
        Sound.tap();
        this._selUser = who;
        this._pin = '';
        document.getElementById('card-pedro').classList.toggle('selected', who === 'pedro');
        document.getElementById('card-rita').classList.toggle('selected', who === 'rita');
        document.getElementById('pin-area').style.display = '';
        document.getElementById('pin-label').textContent = `PIN ${who === 'pedro' ? 'do Pedro' : 'da Rita'}`;
        this.updatePinDots();
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
        document.querySelectorAll('#pin-dots .dot').forEach((d, i) => d.classList.toggle('filled', i < this._pin.length));
    },

    async tryLogin() {
        const who = this._selUser;
        const pin = this._pin;
        if (pin.length !== 4) { this.toast('PIN tem de ter 4 dígitos'); return; }

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

        if (!stored) {
            this.pins[who] = pin;
            localStorage.setItem('pr_pins', JSON.stringify(this.pins));
            if (this.fbOk) {
                try { await this.db.collection('config').doc('pins').set(this.pins, { merge: true }); } catch(e) {}
            }
        }

        this.user = who;
        localStorage.setItem('pr_session', who);
        localStorage.setItem('pr_pins', JSON.stringify(this.pins));
        await this.ensureStartDate();
        await this.loadAll();
        Sound.success();
        this.go('dashboard');
        if (who === 'rita') {
            const msg = RITA_MSGS[Math.floor(Math.random() * RITA_MSGS.length)];
            this.toast(msg);
        } else {
            this.toast('Olá Pedro! 💪 Bora jogar!');
        }
    },

    logout() {
        Sound.tap();
        this._flushSave();
        clearInterval(this._refreshTimer);
        this._refreshTimer = null;
        this.user = null;
        this.answers = {};
        this.partnerAnswers = {};
        localStorage.removeItem('pr_session');
        this._pin = '';
        this._selUser = null;
        document.getElementById('pin-area').style.display = 'none';
        document.querySelectorAll('.card-login').forEach(c => c.classList.remove('selected'));
        this.go('login');
    },

    // ══════════ DATA ══════════
    async loadAll() {
        if (!this.user) return;
        const p = this.user === 'pedro' ? 'rita' : 'pedro';

        try { this.answers = JSON.parse(localStorage.getItem('pr_a_' + this.user) || '{}'); } catch(e) { this.answers = {}; }

        if (this.fbOk) {
            try {
                // Load start date
                const cfg = await this.db.collection('config').doc('settings').get();
                if (cfg.exists && cfg.data().startDate) {
                    this.startDate = cfg.data().startDate;
                    localStorage.setItem('pr_start', this.startDate);
                }

                // Own answers – merge
                const d = await this.db.collection('players').doc(this.user).get();
                if (d.exists && d.data().answers) {
                    this.answers = { ...d.data().answers, ...this.answers };
                }

                // Partner answers
                const pd = await this.db.collection('players').doc(p).get();
                if (pd.exists && pd.data().answers) this.partnerAnswers = pd.data().answers;
                else this.partnerAnswers = {};
            } catch(e) {
                console.warn('FB load:', e);
                this.partnerAnswers = {};
            }
            this._scheduleFBSave();
        }

        localStorage.setItem('pr_a_' + this.user, JSON.stringify(this.answers));
        this._startRefresh();
    },

    // Refresh partner data every 30s
    _startRefresh() {
        if (this._refreshTimer) return;
        this._refreshTimer = setInterval(() => this._refreshPartner(), 30000);
    },

    async _refreshPartner() {
        if (!this.fbOk || !this.user) return;
        const p = this.user === 'pedro' ? 'rita' : 'pedro';
        try {
            const pd = await this.db.collection('players').doc(p).get();
            if (pd.exists && pd.data().answers) {
                this.partnerAnswers = pd.data().answers;
                // Update calendar if visible
                if (document.getElementById('screen-dashboard').classList.contains('active')) {
                    this.renderCalendar();
                }
                // Update compare button if in day view
                if (document.getElementById('screen-day').classList.contains('active')) {
                    this._updateCompareBtn();
                }
            }
        } catch(e) {}
    },

    async saveAnswer(qId, val) {
        this.answers[qId] = val;
        localStorage.setItem('pr_a_' + this.user, JSON.stringify(this.answers));
        this._scheduleFBSave();
    },

    _scheduleFBSave() {
        if (!this.fbOk) return;
        this._savePending = true;
        clearTimeout(this._saveTimer);
        this._saveTimer = setTimeout(() => this._doFBSave(), 800);
    },

    _flushSave() {
        if (this._savePending && this.fbOk) {
            clearTimeout(this._saveTimer);
            this._doFBSave();
        }
    },

    async _doFBSave() {
        if (!this._savePending || !this.fbOk || !this.user) return;
        this._savePending = false;
        try {
            await this.db.collection('players').doc(this.user).set({
                answers: this.answers,
                user: this.user,
                answeredCount: Object.keys(this.answers).length,
                updated: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        } catch(e) {
            console.warn('FB save:', e);
            this._savePending = true;
            this._saveTimer = setTimeout(() => this._doFBSave(), 3000);
        }
    },

    // ══════════ CALENDAR ══════════
    renderCalendar() {
        const isP = this.user === 'pedro';
        document.getElementById('dash-avatar').innerHTML = isP
            ? '<img src="pedro.jpg" class="av-dash" onerror="this.outerHTML=\'🧔\'">'
            : '<img src="rita.jpg" class="av-dash" onerror="this.outerHTML=\'👩\'">';
        document.getElementById('dash-name').textContent = isP ? 'Pedro' : 'Rita';

        const unlocked = this.getUnlockedDays();
        const myTotal = Object.keys(this.answers).length;
        document.getElementById('cal-stats').innerHTML =
            `<span class="stat">${myTotal}/${QUESTIONS.length} respondidas</span>` +
            `<span class="stat">Dia ${unlocked} de ${TOTAL_DAYS}</span>`;

        const grid = document.getElementById('calendar-grid');
        grid.innerHTML = '';

        for (let day = 1; day <= TOTAL_DAYS; day++) {
            const qs = this.getDayQuestions(day);
            const myDone = qs.filter(q => this.answers[q.id] !== undefined).length;
            const partnerDone = qs.filter(q => this.partnerAnswers[q.id] !== undefined).length;
            const locked = day > unlocked;
            const allMine = myDone === qs.length;
            const allPartner = partnerDone === qs.length;
            const bothDone = allMine && allPartner;

            let state = 'locked';
            if (!locked) {
                if (bothDone) state = 'both';
                else if (allMine) state = 'done';
                else if (myDone > 0) state = 'progress';
                else state = 'new';
            }
            if (!locked && day === unlocked) state = myDone > 0 ? state : 'today';

            const el = document.createElement('button');
            el.className = `cal-day cal-${state}`;
            el.disabled = locked;
            el.onclick = locked ? null : () => { Sound.tap(); this.openDay(day); };

            let icon = '';
            if (locked) icon = '🔒';
            else if (bothDone) icon = '💕';
            else if (allMine) icon = '✓';
            else if (myDone > 0) icon = `${myDone}`;
            else icon = '';

            el.innerHTML = `<span class="cal-num">${day}</span>` +
                (icon ? `<span class="cal-icon">${icon}</span>` : '') +
                (!locked && myDone > 0 && !allMine ? `<div class="cal-mini-bar"><div class="cal-mini-fill" style="width:${myDone/qs.length*100}%"></div></div>` : '');

            grid.appendChild(el);
        }
    },

    openDay(day) {
        this.currentDay = day;
        this.dayQuestions = this.getDayQuestions(day);
        const first = this.dayQuestions.find(q => this.answers[q.id] === undefined);
        this.qIdx = first ? this.dayQuestions.indexOf(first) : 0;
        this.go('day');
        this._updateCompareBtn();
    },

    _updateCompareBtn() {
        const qs = this.dayQuestions;
        const myDone = qs.filter(q => this.answers[q.id] !== undefined).length;
        const partnerDone = qs.filter(q => this.partnerAnswers[q.id] !== undefined).length;
        const bothDone = myDone === qs.length && partnerDone === qs.length;
        const btn = document.getElementById('btn-compare');
        if (btn) btn.style.display = bothDone ? '' : 'none';
    },

    // ══════════ ANSWER MODE ══════════
    renderQ() {
        if (!this.dayQuestions.length) return;
        const q = this.dayQuestions[this.qIdx];
        if (!q) return;
        const cat = CATEGORIES[q.cat] || { name: q.cat, emoji: '❓' };

        document.getElementById('day-badge').textContent = `Dia ${this.currentDay}`;
        document.getElementById('q-count').textContent = `${this.qIdx + 1}/${this.dayQuestions.length}`;
        document.getElementById('q-bar-fill').style.width = `${((this.qIdx + 1) / this.dayQuestions.length) * 100}%`;
        document.getElementById('q-cat').innerHTML = `<span class="q-cat-emoji">${cat.emoji}</span> ${cat.name}`;
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
        } else if (q.type === 'text') {
            area.innerHTML = `<div class="ans-text-wrap">
                <textarea class="ans-textarea" id="ta" placeholder="Escreve a tua resposta...">${this._esc(saved || '')}</textarea>
                <button class="btn btn-sm btn-accent" onclick="App.pickText(${q.id})">Guardar ✓</button></div>`;
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
        btn.parentElement.querySelectorAll('.ans-btn').forEach(b => b.classList.remove('sel'));
        btn.classList.add('sel');
        document.getElementById('btn-skip').style.display = 'none';
        document.getElementById('btn-next').style.display = '';
        setTimeout(() => {
            if (this.qIdx < this.dayQuestions.length - 1) this.next();
            else this._dayComplete();
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
        setTimeout(() => {
            if (this.qIdx < this.dayQuestions.length - 1) this.next();
        }, 400);
    },

    next() {
        if (this.qIdx < this.dayQuestions.length - 1) {
            this.qIdx++;
            Sound.whoosh();
            this.renderQ();
            window.scrollTo(0, 0);
        } else {
            this._dayComplete();
        }
    },
    prev() {
        if (this.qIdx > 0) { this.qIdx--; Sound.whoosh(); this.renderQ(); window.scrollTo(0, 0); }
    },

    _dayComplete() {
        const qs = this.dayQuestions;
        const done = qs.filter(q => this.answers[q.id] !== undefined).length;
        if (done === qs.length) {
            Sound.complete();
            this.confetti();
            this.toast('Dia completo! 🎉');
            setTimeout(() => this.go('dashboard'), 1200);
        } else {
            this.toast(`Faltam ${qs.length - done} perguntas neste dia`);
            this.go('dashboard');
        }
    },

    // ══════════ COMPARE ══════════
    renderCompare(day) {
        document.getElementById('compare-badge').textContent = `Dia ${day}`;
        const qs = this.getDayQuestions(day);
        const list = document.getElementById('compare-list');

        // Match percentage (only for non-text questions)
        const comparable = qs.filter(q => q.type !== 'text' &&
            this.answers[q.id] !== undefined && this.partnerAnswers[q.id] !== undefined);
        let matches = 0;
        comparable.forEach(q => {
            const a = String(this.answers[q.id]);
            const b = String(this.partnerAnswers[q.id]);
            if (a === b) matches++;
        });

        const matchEl = document.getElementById('compare-match');
        if (comparable.length > 0) {
            const pct = Math.round(matches / comparable.length * 100);
            matchEl.style.display = '';
            document.getElementById('compare-pct').textContent = pct + '%';
        } else {
            matchEl.style.display = 'none';
        }

        const isP = this.user === 'pedro';
        list.innerHTML = qs.map(q => {
            const pedroAns = isP ? this.answers[q.id] : this.partnerAnswers[q.id];
            const ritaAns  = isP ? this.partnerAnswers[q.id] : this.answers[q.id];
            const cat = CATEGORIES[q.cat] || { emoji: '❓' };
            const bothAnswered = pedroAns !== undefined && ritaAns !== undefined;
            const isMatch = bothAnswered && q.type !== 'text' && String(pedroAns) === String(ritaAns);
            const isDiff = bothAnswered && q.type !== 'text' && String(pedroAns) !== String(ritaAns);

            return `<div class="cmp-item ${isMatch ? 'cmp-match' : ''} ${isDiff ? 'cmp-diff' : ''}">
                <div class="cmp-cat">${cat.emoji}</div>
                <div class="cmp-q">${this._esc(q.text)}</div>
                <div class="cmp-answers">
                    <div class="cmp-ans cmp-pedro">
                        <div class="cmp-who">Pedro</div>
                        <div class="cmp-val">${pedroAns !== undefined ? this._esc(String(pedroAns)) : '<em>-</em>'}</div>
                    </div>
                    <div class="cmp-ans cmp-rita">
                        <div class="cmp-who">Rita</div>
                        <div class="cmp-val">${ritaAns !== undefined ? this._esc(String(ritaAns)) : '<em>-</em>'}</div>
                    </div>
                </div>
                ${isMatch ? '<div class="cmp-badge-match">Iguais! 💚</div>' : ''}
            </div>`;
        }).join('');
    },

    // ══════════ RESET ══════════
    resetPinConfirm() {
        document.getElementById('modal').style.display = '';
        document.getElementById('modal-msg').textContent = `Redefinir o PIN de ${this.user === 'pedro' ? 'Pedro' : 'Rita'}? Vais ter de criar um novo PIN.`;
        document.getElementById('modal-confirm').onclick = () => this.doResetPin();
    },

    async doResetPin() {
        this.modalClose();
        delete this.pins[this.user];
        localStorage.setItem('pr_pins', JSON.stringify(this.pins));
        if (this.fbOk) {
            try {
                await this.db.collection('config').doc('pins').set(this.pins);
            } catch(e) { console.warn('Reset PIN FB:', e); }
        }
        Sound.tap();
        this.toast('PIN apagado! Faz login de novo para criar um novo. 🔑');
        this.logout();
    },

    resetConfirm() {
        document.getElementById('modal').style.display = '';
        document.getElementById('modal-msg').textContent = `Apagar TODAS as respostas de ${this.user === 'pedro' ? 'Pedro' : 'Rita'}? Esta ação não pode ser desfeita!`;
        document.getElementById('modal-confirm').onclick = () => this.doReset();
    },
    modalClose() { document.getElementById('modal').style.display = 'none'; },

    async doReset() {
        this.modalClose();
        this.answers = {};
        localStorage.setItem('pr_a_' + this.user, '{}');
        if (this.fbOk) {
            try {
                await this.db.collection('players').doc(this.user).set({
                    answers: {}, user: this.user, answeredCount: 0,
                    updated: firebase.firestore.FieldValue.serverTimestamp()
                });
            } catch(e) { console.warn('Reset FB:', e); }
        }
        Sound.tap();
        this.toast('Tudo apagado! 🔄');
        this.renderCalendar();
    },

    // ══════════ HELPERS ══════════
    _esc(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; },

    hearts() {
        const c = document.getElementById('hearts-bg');
        const hs = ['💖','💕','💗','💓','💝','♥️','💘'];
        for (let i = 0; i < 15; i++) {
            const s = document.createElement('span'); s.className = 'fh';
            s.textContent = hs[Math.floor(Math.random()*hs.length)];
            s.style.left = Math.random()*100+'%';
            s.style.fontSize = (12+Math.random()*14)+'px';
            s.style.animationDuration = (12+Math.random()*20)+'s';
            s.style.animationDelay = Math.random()*14+'s';
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
    }
};

window.addEventListener('DOMContentLoaded', () => App.init());
