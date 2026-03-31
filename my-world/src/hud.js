/* hud.js — HUD di gioco + UI Skill Tree
   Usa solo HTML/CSS/JS puro, si aggancia al DOM. */

// ────────────────────────────────────────────────────────────────────────────
// INJECT CSS
// ────────────────────────────────────────────────────────────────────────────
const CSS = `
/* ── Reset / Base ─────────────────────────────────────────────────────── */
#hud-root * { box-sizing: border-box; user-select: none; }

/* ── Root ─────────────────────────────────────────────────────────────── */
#hud-root {
  position: fixed; inset: 0; pointer-events: none;
  font-family: 'Segoe UI', system-ui, sans-serif;
  z-index: 100;
}

/* ── BOTTOM LEFT: HP / STAMINA / XP ──────────────────────────────────── */
#hud-bars {
  position: absolute; bottom: 28px; left: 28px;
  display: flex; flex-direction: column; gap: 8px;
  width: 260px;
}

.bar-row { display: flex; align-items: center; gap: 8px; }
.bar-label {
  width: 22px; font-size: 11px; font-weight: 700;
  color: #ffffffcc; letter-spacing: .04em;
}
.bar-track {
  flex: 1; height: 10px; background: #ffffff18;
  border-radius: 99px; overflow: hidden;
  border: 1px solid #ffffff22;
}
.bar-fill {
  height: 100%; border-radius: 99px;
  transition: width .12s ease;
}
#hp-fill    { background: linear-gradient(90deg,#e74c3c,#c0392b); }
#stam-fill  { background: linear-gradient(90deg,#f39c12,#d68910); }
#xp-fill    { background: linear-gradient(90deg,#2ecc71,#27ae60); }

/* ── LEVEL badge ──────────────────────────────────────────────────────── */
#level-badge {
  position: absolute; bottom: 108px; left: 28px;
  background: #ffffff15; backdrop-filter: blur(4px);
  border: 1px solid #ffffff30; border-radius: 8px;
  padding: 4px 12px; font-size: 13px; font-weight: 700;
  color: #ffd700; letter-spacing: .05em;
}

/* ── COMBO SLOTS (bottom center) ─────────────────────────────────────── */
#combo-slots {
  position: absolute; bottom: 28px; left: 50%; transform: translateX(-50%);
  display: flex; gap: 10px;
}
.combo-slot {
  width: 52px; height: 52px; border-radius: 10px;
  background: #ffffff12; border: 2px solid #ffffff30;
  display: flex; align-items: center; justify-content: center;
  font-size: 18px; font-weight: 900; color: #ffffffaa;
  transition: border-color .1s, transform .1s, background .1s;
  position: relative;
}
.combo-slot.active {
  border-color: #ffd700; background: #ffd70022;
  color: #ffd700; transform: scale(1.08);
}
.combo-slot .slot-label {
  font-size: 10px; position: absolute; top: 3px; left: 6px;
  color: #ffffff55; font-weight: 600;
}
.combo-slot.empty { opacity: .35; }

/* ── TOP CENTER: flash messaggi ──────────────────────────────────────── */
#msg-area {
  position: absolute; top: 20px; left: 50%; transform: translateX(-50%);
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  pointer-events: none;
}
.msg-pop {
  padding: 4px 16px; border-radius: 99px;
  background: #00000066; backdrop-filter: blur(4px);
  font-size: 13px; font-weight: 700; color: white;
  animation: msgFade 1.6s ease forwards;
}
@keyframes msgFade {
  0%   { opacity:0; transform: translateY(-8px); }
  15%  { opacity:1; transform: translateY(0); }
  70%  { opacity:1; }
  100% { opacity:0; }
}

/* ── DAMAGE NUMBERS ──────────────────────────────────────────────────── */
.dmg-num {
  position: fixed; font-weight: 900; pointer-events: none;
  text-shadow: 0 2px 6px #000a;
  animation: dmgFloat 0.9s ease forwards;
}
@keyframes dmgFloat {
  0%   { opacity:1; transform: translateY(0) scale(1); }
  100% { opacity:0; transform: translateY(-55px) scale(.8); }
}

/* ── SCREEN FLASH (danno ricevuto) ───────────────────────────────────── */
#damage-flash {
  position: fixed; inset: 0;
  background: radial-gradient(ellipse at center, transparent 40%, #e74c3c88 100%);
  opacity: 0; pointer-events: none;
  transition: opacity .08s;
}

/* ── SKILL TREE PANEL ────────────────────────────────────────────────── */
#skilltree-panel {
  position: fixed; inset: 0;
  background: #00000099; backdrop-filter: blur(6px);
  display: none; align-items: center; justify-content: center;
  z-index: 200; pointer-events: all;
}
#skilltree-panel.open { display: flex; }

#skilltree-inner {
  background: #12131a; border: 1px solid #ffffff20;
  border-radius: 18px; padding: 28px 32px;
  max-width: 820px; width: 95vw; max-height: 90vh;
  overflow-y: auto; color: white;
}
#skilltree-inner h2 {
  margin: 0 0 4px; font-size: 22px; font-weight: 800;
  letter-spacing: .06em; color: #ffd700;
}
#st-points { font-size: 13px; color: #ffffffaa; margin-bottom: 20px; }

.st-tier { margin-bottom: 24px; }
.st-tier-label {
  font-size: 11px; font-weight: 700; letter-spacing: .12em;
  color: #ffffff55; margin-bottom: 10px; text-transform: uppercase;
}
.st-skills { display: flex; flex-wrap: wrap; gap: 12px; }

.skill-card {
  width: 170px; background: #1c1d2a; border: 2px solid #ffffff18;
  border-radius: 12px; padding: 14px; cursor: pointer;
  transition: border-color .15s, background .15s;
  position: relative;
}
.skill-card:hover { border-color: #ffffff44; background: #22243a; }
.skill-card.unlocked { border-color: #ffd70080; background: #1e1d12; }
.skill-card.unavailable { opacity: .45; cursor: not-allowed; }

.skill-card .sk-name { font-size: 14px; font-weight: 700; margin-bottom: 4px; }
.skill-card .sk-desc { font-size: 11px; color: #ffffffaa; line-height: 1.45; }
.skill-card .sk-cost {
  margin-top: 10px; font-size: 11px; font-weight: 700;
  color: #ffd700;
}
.skill-card.unlocked .sk-cost { color: #2ecc71; }

/* Slot assegnazione attacchi */
#st-slots { margin-top: 22px; border-top: 1px solid #ffffff15; padding-top: 18px; }
#st-slots h3 { font-size: 14px; font-weight: 700; margin: 0 0 10px; color: #ffffffcc; }
#slot-grid { display: flex; gap: 10px; flex-wrap: wrap; }

.slot-assign {
  background: #1c1d2a; border: 2px dashed #ffffff30;
  border-radius: 10px; padding: 10px 14px; min-width: 130px;
  cursor: pointer; transition: border-color .15s;
}
.slot-assign:hover { border-color: #ffd700; }
.slot-assign .sa-index { font-size: 10px; color: #ffffff44; margin-bottom: 4px; }
.slot-assign .sa-name  { font-size: 13px; font-weight: 700; }
.slot-assign.filled { border-style: solid; border-color: #ffd70066; }

#st-close {
  margin-top: 22px; padding: 10px 28px; border-radius: 99px;
  background: #ffd700; color: #111; font-weight: 800; font-size: 14px;
  border: none; cursor: pointer; transition: background .1s;
}
#st-close:hover { background: #ffe03a; }
`;

// ────────────────────────────────────────────────────────────────────────────
// HUD CLASS
// ────────────────────────────────────────────────────────────────────────────
export class HUD {
    constructor(stats, skillTree) {
        this.stats     = stats;
        this.skillTree = skillTree;

        this._injectCSS();
        this._buildDOM();
        this._bindSkillTreeToggle();

        // Callback level-up
        this.stats.onLevelUp = (level) => {
            this.showMessage(`⬆ Livello ${level}!`, 0xffd700);
            this.skillTree.onLevelUp(level);
            this.skillTree.skillPoints += 1; // già fatto in SkillTree, ma assicuriamo
            this._renderSkillTree();
        };
    }

    _injectCSS() {
        const style = document.createElement('style');
        style.textContent = CSS;
        document.head.appendChild(style);
    }

    // ────────────────────────────────────────────────────────────────
    // DOM BUILD
    // ────────────────────────────────────────────────────────────────
    _buildDOM() {
        // Root
        const root = document.createElement('div');
        root.id = 'hud-root';
        document.body.appendChild(root);

        // ── Barre ─────────────────────────────────────────────────
        root.innerHTML += `
        <div id="hud-bars">
          <div class="bar-row">
            <span class="bar-label">HP</span>
            <div class="bar-track"><div class="bar-fill" id="hp-fill"></div></div>
          </div>
          <div class="bar-row">
            <span class="bar-label">ST</span>
            <div class="bar-track"><div class="bar-fill" id="stam-fill"></div></div>
          </div>
          <div class="bar-row">
            <span class="bar-label">XP</span>
            <div class="bar-track"><div class="bar-fill" id="xp-fill"></div></div>
          </div>
        </div>
        <div id="level-badge">LV 1</div>
        <div id="combo-slots"></div>
        <div id="msg-area"></div>
        <div id="damage-flash"></div>
        `;

        // ── Skill Tree Panel ──────────────────────────────────────
        const stPanel = document.createElement('div');
        stPanel.id = 'skilltree-panel';
        stPanel.innerHTML = `
          <div id="skilltree-inner">
            <h2>🌳 SKILL TREE</h2>
            <div id="st-points"></div>
            <div id="st-tiers"></div>
            <div id="st-slots">
              <h3>Slot Combo</h3>
              <div id="slot-grid"></div>
            </div>
            <button id="st-close">Chiudi</button>
          </div>
        `;
        document.body.appendChild(stPanel);

        this._refs = {
            hpFill:    document.getElementById('hp-fill'),
            stamFill:  document.getElementById('stam-fill'),
            xpFill:    document.getElementById('xp-fill'),
            level:     document.getElementById('level-badge'),
            comboSlots:document.getElementById('combo-slots'),
            msgArea:   document.getElementById('msg-area'),
            flash:     document.getElementById('damage-flash'),
            stPanel,
            stPoints:  document.getElementById('st-points'),
            stTiers:   document.getElementById('st-tiers'),
            slotGrid:  document.getElementById('slot-grid'),
        };

        document.getElementById('st-close').addEventListener('click', () => this.closeSkillTree());
    }

    // ────────────────────────────────────────────────────────────────
    // UPDATE (chiamato ogni frame)
    // ────────────────────────────────────────────────────────────────
    update() {
        const s = this.stats;

        this._refs.hpFill.style.width   = `${(s.hp   / s.maxHp)      * 100}%`;
        this._refs.stamFill.style.width = `${(s.stamina / s.maxStamina) * 100}%`;
        this._refs.xpFill.style.width   = `${(s.xp   / s.xpToNext)   * 100}%`;
        this._refs.level.textContent    = `LV ${s.level}`;

        this._updateComboSlots();
    }

    // ────────────────────────────────────────────────────────────────
    // COMBO SLOTS
    // ────────────────────────────────────────────────────────────────
    _updateComboSlots() {
        const slots = this.skillTree.getActiveSlots();
        const maxSlots = this.skillTree._maxSlots;
        const container = this._refs.comboSlots;

        // Rebuild solo se cambia
        if (container.children.length !== maxSlots) {
            container.innerHTML = '';
            for (let i = 0; i < maxSlots; i++) {
                const div = document.createElement('div');
                div.className = 'combo-slot';
                div.dataset.idx = i;
                container.appendChild(div);
            }
        }

        Array.from(container.children).forEach((el, i) => {
            const slot = slots[i];
            if (slot) {
                el.classList.remove('empty');
                el.innerHTML = `<span class="slot-label">${i + 1}</span>${slot.label}`;
            } else {
                el.classList.add('empty');
                el.innerHTML = `<span class="slot-label">${i + 1}</span>—`;
            }
        });
    }

    showComboHit(comboIndex, label) {
        const slots = this._refs.comboSlots.children;
        Array.from(slots).forEach((el, i) => {
            el.classList.toggle('active', i === (comboIndex - 1 + slots.length) % slots.length);
        });
    }

    resetCombo() {
        Array.from(this._refs.comboSlots.children).forEach(el => el.classList.remove('active'));
    }

    // ────────────────────────────────────────────────────────────────
    // MESSAGGI
    // ────────────────────────────────────────────────────────────────
    showMessage(text, colorHex = 0xffffff) {
        const color = `#${colorHex.toString(16).padStart(6, '0')}`;
        const el = document.createElement('div');
        el.className = 'msg-pop';
        el.style.color = color;
        el.textContent = text;
        this._refs.msgArea.appendChild(el);
        setTimeout(() => el.remove(), 1700);
    }

    showDodgeFlash() {
        this.showMessage('⚡ Schivata', 0x00ccff);
    }

    flashDamage() {
        const f = this._refs.flash;
        f.style.opacity = '1';
        setTimeout(() => { f.style.opacity = '0'; }, 150);
    }

    // ────────────────────────────────────────────────────────────────
    // DAMAGE NUMBERS (proiettati su schermo)
    // ────────────────────────────────────────────────────────────────
    showDamageNumber(damage, isCrit, worldPos) {
        const el = document.createElement('div');
        el.className = 'dmg-num';
        el.textContent = isCrit ? `💥 ${damage}` : `${damage}`;
        el.style.fontSize  = isCrit ? '22px' : '16px';
        el.style.color     = isCrit ? '#ffd700' : '#ffffff';
        el.style.left      = `${40 + Math.random() * 20}vw`;
        el.style.top       = `${30 + Math.random() * 20}vh`;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 950);
    }

    // ────────────────────────────────────────────────────────────────
    // SKILL TREE UI
    // ────────────────────────────────────────────────────────────────
    _bindSkillTreeToggle() {
        window.addEventListener('keydown', (e) => {
            if (e.code === 'KeyT') this.toggleSkillTree();
        });
    }

    toggleSkillTree() {
        const panel = this._refs.stPanel;
        if (panel.classList.contains('open')) {
            this.closeSkillTree();
        } else {
            this._renderSkillTree();
            panel.classList.add('open');
            // Sblocca puntatore
            if (document.pointerLockElement) document.exitPointerLock();
        }
    }

    closeSkillTree() {
        this._refs.stPanel.classList.remove('open');
    }

    _renderSkillTree() {
        const { stPoints, stTiers, slotGrid } = this._refs;
        const st = this.skillTree;

        stPoints.textContent = `Punti disponibili: ${st.skillPoints}`;

        // Raggruppa per tier
        const tiers = {};
        Object.values(this._getSkillsModule()).forEach(skill => {
            if (!tiers[skill.tier]) tiers[skill.tier] = [];
            tiers[skill.tier].push(skill);
        });

        stTiers.innerHTML = '';
        Object.entries(tiers).sort((a, b) => a[0] - b[0]).forEach(([tier, skills]) => {
            const div = document.createElement('div');
            div.className = 'st-tier';
            div.innerHTML = `<div class="st-tier-label">Tier ${tier}</div><div class="st-skills"></div>`;
            const grid = div.querySelector('.st-skills');

            skills.forEach(skill => {
                const unlocked   = st.unlockedSkills.has(skill.id);
                const canUnlock  = !unlocked && skill.requires.every(r => st.unlockedSkills.has(r)) && st.skillPoints >= skill.cost;
                const card = document.createElement('div');
                card.className = `skill-card ${unlocked ? 'unlocked' : canUnlock ? '' : 'unavailable'}`;
                card.innerHTML = `
                  <div class="sk-name">${skill.name}</div>
                  <div class="sk-desc">${skill.description}</div>
                  <div class="sk-cost">${unlocked ? '✓ Sbloccata' : `Costo: ${skill.cost} pt`}</div>
                `;
                if (canUnlock) {
                    card.addEventListener('click', () => {
                        const res = st.unlock(skill.id);
                        if (res.ok) {
                            this.showMessage(`Sbloccato: ${skill.name}`, 0xffd700);
                            this._renderSkillTree();
                        }
                    });
                }
                grid.appendChild(card);
            });

            stTiers.appendChild(div);
        });

        // Slot combo
        slotGrid.innerHTML = '';
        const slots = st.getActiveSlots();
        for (let i = 0; i < st._maxSlots; i++) {
            const sa = document.createElement('div');
            sa.className = `slot-assign ${slots[i] ? 'filled' : ''}`;
            sa.innerHTML = `
              <div class="sa-index">Slot ${i + 1}</div>
              <div class="sa-name">${slots[i]?.label ? `[${slots[i].label}] ` : ''}${slots[i] ? this._skillNameById(slots[i].fx) : '— Vuoto —'}</div>
            `;
            // Click: apri selettore attacchi sbloccati
            sa.addEventListener('click', () => this._openSlotPicker(i));
            slotGrid.appendChild(sa);
        }
    }

    _openSlotPicker(slotIndex) {
        const st = this.skillTree;
        const attackSkills = [...st.unlockedSkills]
            .map(id => this._getSkillsModule()[id])
            .filter(s => s && s.type === 'attack');

        if (attackSkills.length === 0) {
            this.showMessage('Nessuna skill d\'attacco sbloccata!', 0xff4444);
            return;
        }

        const choice = attackSkills[0]; // semplificato: assegna il primo disponibile
        // In un gioco reale mostreremmo una modale; per ora cicliamo
        const current = st.attackSlots[slotIndex];
        const idx = attackSkills.findIndex(s => s.attackData === current);
        const next = attackSkills[(idx + 1) % attackSkills.length];
        st.assignToSlot(next.id, slotIndex);
        this._renderSkillTree();
    }

    _skillNameById(fx) {
        const map = {
            slash_light:  'Fendente Rapido',
            slam_heavy:   'Martellata Pesante',
            spin_aoe:     'Rotazione Dev.',
            dash_strike:  'Assalto Fulmineo',
            rising_slash: 'Fendente Asc.',
            nova_burst:   'Nova',
        };
        return map[fx] || fx;
    }

    // Lazy-load del modulo SKILLS (evita circular dep)
    _getSkillsModule() {
        // Importato dinamicamente o passato come param — qui usiamo una copia locale
        // L'utente deve importare SKILLS da skilltree.js e passarli al costruttore HUD
        return this._skills || {};
    }

    setSkills(skills) {
        this._skills = skills;
    }
}