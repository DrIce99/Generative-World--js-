// skilltree.js — Skill Tree modulare

// ---------------------------------------------------------------------------
// DEFINIZIONE DI TUTTE LE SKILL
// ---------------------------------------------------------------------------
export const SKILLS = {
    // ── ATTACCHI BASE ──────────────────────────────────────────────────────
    quickSlash: {
        id: 'quickSlash',
        name: 'Fendente Rapido',
        description: 'Colpo veloce a bassa stamina. Danni leggeri.',
        tier: 1,
        requires: [],
        cost: 1,           // punti skill
        type: 'attack',
        attackData: {
            label:        'Q',
            damageMultiplier: 0.8,
            staminaCost:  8,
            cooldown:     0.35,  // secondi
            range:        1.8,
            aoe:          false,
            dashForward:  0,
            windupFrames: 3,
            hitboxShape:  'arc',   // 'arc' | 'circle' | 'line' | 'cone'
            hitboxAngle:  70,      // gradi
            hitboxDepth:  1.8,
            fx:           'slash_light',
        },
    },

    heavySlam: {
        id: 'heavySlam',
        name: 'Martellata Pesante',
        description: 'Attacco caricato. Alta stamina, alto danno.',
        tier: 1,
        requires: [],
        cost: 1,
        type: 'attack',
        attackData: {
            label:        'H',
            damageMultiplier: 1.8,
            staminaCost:  24,
            cooldown:     0.9,
            range:        2.0,
            aoe:          false,
            dashForward:  0.5,
            windupFrames: 18,
            hitboxShape:  'cone',
            hitboxAngle:  60,
            hitboxDepth:  2.2,
            fx:           'slam_heavy',
        },
    },

    spinAttack: {
        id: 'spinAttack',
        name: 'Rotazione Devastante',
        description: 'Attacco ad area intorno al giocatore.',
        tier: 2,
        requires: ['quickSlash'],
        cost: 2,
        type: 'attack',
        attackData: {
            label:        'S',
            damageMultiplier: 1.2,
            staminaCost:  20,
            cooldown:     1.1,
            range:        2.5,
            aoe:          true,
            dashForward:  0,
            windupFrames: 10,
            hitboxShape:  'circle',
            hitboxAngle:  360,
            hitboxDepth:  2.5,
            fx:           'spin_aoe',
        },
    },

    dashStrike: {
        id: 'dashStrike',
        name: 'Assalto Fulmineo',
        description: 'Dash offensivo: ti lancia in avanti e colpisci.',
        tier: 2,
        requires: ['quickSlash'],
        cost: 2,
        type: 'attack',
        attackData: {
            label:        'D',
            damageMultiplier: 1.4,
            staminaCost:  18,
            cooldown:     0.7,
            range:        4.5,
            aoe:          false,
            dashForward:  4.0,
            windupFrames: 5,
            hitboxShape:  'line',
            hitboxAngle:  30,
            hitboxDepth:  4.5,
            fx:           'dash_strike',
        },
    },

    risingSlash: {
        id: 'risingSlash',
        name: 'Fendente Ascendente',
        description: 'Colpo dal basso verso l\'alto, lancia il nemico.',
        tier: 2,
        requires: ['heavySlam'],
        cost: 2,
        type: 'attack',
        attackData: {
            label:        'R',
            damageMultiplier: 1.3,
            staminaCost:  16,
            cooldown:     0.8,
            range:        2.0,
            aoe:          false,
            dashForward:  0.8,
            windupFrames: 8,
            hitboxShape:  'arc',
            hitboxAngle:  80,
            hitboxDepth:  2.0,
            launchEnemy:  true,
            fx:           'rising_slash',
        },
    },

    nova: {
        id: 'nova',
        name: 'Nova',
        description: 'Esplosione di energia. Area enorme, alta stamina.',
        tier: 3,
        requires: ['spinAttack', 'risingSlash'],
        cost: 3,
        type: 'attack',
        attackData: {
            label:        'N',
            damageMultiplier: 2.5,
            staminaCost:  45,
            cooldown:     3.5,
            range:        5.0,
            aoe:          true,
            dashForward:  0,
            windupFrames: 30,
            hitboxShape:  'circle',
            hitboxAngle:  360,
            hitboxDepth:  5.0,
            fx:           'nova_burst',
        },
    },

    // ── PASSIVE ────────────────────────────────────────────────────────────
    ironSkin: {
        id: 'ironSkin',
        name: 'Pelle di Ferro',
        description: '+20 HP massimi.',
        tier: 1,
        requires: [],
        cost: 1,
        type: 'passive',
        apply: (stats) => { stats.bonusMaxHp += 20; },
        unapply: (stats) => { stats.bonusMaxHp -= 20; },
    },

    athleteStamina: {
        id: 'athleteStamina',
        name: 'Resistenza Atletica',
        description: '+25 Stamina massima.',
        tier: 1,
        requires: [],
        cost: 1,
        type: 'passive',
        apply: (stats) => { stats.bonusMaxStamina += 25; },
        unapply: (stats) => { stats.bonusMaxStamina -= 25; },
    },

    sharpBlade: {
        id: 'sharpBlade',
        name: 'Lama Affilata',
        description: '+8 Attacco base.',
        tier: 2,
        requires: ['quickSlash'],
        cost: 2,
        type: 'passive',
        apply: (stats) => { stats.bonusAttack += 8; },
        unapply: (stats) => { stats.bonusAttack -= 8; },
    },

    luckyCrit: {
        id: 'luckyCrit',
        name: 'Fortuna del Combattente',
        description: '+10% Crit Rate, +25% Crit Damage.',
        tier: 2,
        requires: ['heavySlam'],
        cost: 2,
        type: 'passive',
        apply: (stats) => { stats.bonusCritRate += 0.10; stats.bonusCritDamage += 0.25; },
        unapply: (stats) => { stats.bonusCritRate -= 0.10; stats.bonusCritDamage -= 0.25; },
    },
};

// ---------------------------------------------------------------------------
// SKILL TREE MANAGER
// ---------------------------------------------------------------------------
export class SkillTree {
    constructor(stats) {
        this.stats          = stats;
        this.skillPoints    = 0;       // punti disponibili
        this.unlockedSkills = new Set(); // id delle skill sbloccate
        this.attackSlots    = [null, null, null, null]; // max 4 slot combo
        this._maxSlots      = 2;       // inizia con 2 slot, cresce con livello
    }

    // ----------------------------------------------------------------
    // Punti skill guadagnati al level-up
    // ----------------------------------------------------------------
    onLevelUp(level) {
        this.skillPoints += 1;
        // Sblocca più slot combo ogni 5 livelli
        this._maxSlots = Math.min(4, 2 + Math.floor(level / 5));
    }

    // ----------------------------------------------------------------
    // Sblocca una skill (se requisiti soddisfatti)
    // ----------------------------------------------------------------
    unlock(skillId) {
        const skill = SKILLS[skillId];
        if (!skill) return { ok: false, reason: 'Skill non trovata' };
        if (this.unlockedSkills.has(skillId)) return { ok: false, reason: 'Già sbloccata' };
        if (this.skillPoints < skill.cost) return { ok: false, reason: 'Punti insufficienti' };

        for (const req of skill.requires) {
            if (!this.unlockedSkills.has(req)) {
                return { ok: false, reason: `Richiede: ${SKILLS[req]?.name}` };
            }
        }

        this.skillPoints -= skill.cost;
        this.unlockedSkills.add(skillId);

        // Applica passive subito
        if (skill.type === 'passive' && skill.apply) {
            skill.apply(this.stats);
            this.stats.recalculate();
        }

        return { ok: true };
    }

    // ----------------------------------------------------------------
    // Assegna una skill d'attacco ad uno slot della combo
    // ----------------------------------------------------------------
    assignToSlot(skillId, slotIndex) {
        if (slotIndex < 0 || slotIndex >= this._maxSlots) return false;
        if (!this.unlockedSkills.has(skillId)) return false;
        const skill = SKILLS[skillId];
        if (!skill || skill.type !== 'attack') return false;
        this.attackSlots[slotIndex] = skill.attackData;
        return true;
    }

    // ----------------------------------------------------------------
    // Ritorna gli slot attivi (non-null)
    // ----------------------------------------------------------------
    getActiveSlots() {
        return this.attackSlots.slice(0, this._maxSlots);
    }

    // ----------------------------------------------------------------
    // Lista skill disponibili per sblocco
    // ----------------------------------------------------------------
    getAvailableToUnlock() {
        return Object.values(SKILLS).filter(s => {
            if (this.unlockedSkills.has(s.id)) return false;
            return s.requires.every(r => this.unlockedSkills.has(r));
        });
    }

    toJSON() {
        return {
            skillPoints:    this.skillPoints,
            unlockedSkills: [...this.unlockedSkills],
            attackSlots:    this.attackSlots,
        };
    }
}