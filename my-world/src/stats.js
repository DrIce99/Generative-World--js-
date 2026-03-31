// stats.js — Sistema di statistiche e progressione del personaggio

export const BASE_STATS = {
    maxHp:       100,
    maxStamina:  100,
    attack:      10,
    critRate:    0.05,   // 5%
    critDamage:  1.5,    // 150%
};

// XP necessari per salire di livello: formula esponenziale
const xpForLevel = (level) => Math.floor(100 * Math.pow(1.35, level - 1));

export class Stats {
    constructor() {
        this.level   = 1;
        this.xp      = 0;
        this.xpToNext = xpForLevel(1);

        // Valori correnti
        this.maxHp       = BASE_STATS.maxHp;
        this.hp          = this.maxHp;
        this.maxStamina  = BASE_STATS.maxStamina;
        this.stamina     = this.maxStamina;
        this.attack      = BASE_STATS.attack;
        this.critRate    = BASE_STATS.critRate;
        this.critDamage  = BASE_STATS.critDamage;

        // Stamina recovery
        this._staminaRegenRate  = 12;   // per secondo
        this._staminaRegenDelay = 1.2;  // secondi dopo l'ultimo uso
        this._lastStaminaUse    = -999;

        // Skill bonuses (applicati dallo skill tree)
        this.bonusAttack     = 0;
        this.bonusCritRate   = 0;
        this.bonusCritDamage = 0;
        this.bonusMaxHp      = 0;
        this.bonusMaxStamina = 0;

        this.onLevelUp = null; // callback
    }

    // ----------------------------------------------------------------
    // XP & LEVELING
    // ----------------------------------------------------------------
    addXp(amount) {
        this.xp += amount;
        while (this.xp >= this.xpToNext) {
            this.xp -= this.xpToNext;
            this._levelUp();
        }
    }

    _levelUp() {
        this.level++;
        this.xpToNext = xpForLevel(this.level);

        // Crescita statistiche base per livello
        this.maxHp      = BASE_STATS.maxHp      + this.level * 8  + this.bonusMaxHp;
        this.maxStamina = BASE_STATS.maxStamina  + this.level * 4  + this.bonusMaxStamina;
        this.attack     = BASE_STATS.attack       + this.level * 2  + this.bonusAttack;

        // Heal completo al level up
        this.hp      = this.maxHp;
        this.stamina = this.maxStamina;

        if (this.onLevelUp) this.onLevelUp(this.level);
    }

    // Ricalcola i massimi quando lo skill tree aggiunge bonus
    recalculate() {
        const prevHpRatio      = this.hp      / this.maxHp;
        const prevStamRatio    = this.stamina / this.maxStamina;

        this.maxHp      = BASE_STATS.maxHp      + this.level * 8  + this.bonusMaxHp;
        this.maxStamina = BASE_STATS.maxStamina  + this.level * 4  + this.bonusMaxStamina;
        this.attack     = BASE_STATS.attack       + this.level * 2  + this.bonusAttack;
        this.critRate   = BASE_STATS.critRate    + this.bonusCritRate;
        this.critDamage = BASE_STATS.critDamage  + this.bonusCritDamage;

        this.hp      = this.maxHp      * prevHpRatio;
        this.stamina = this.maxStamina * prevStamRatio;
    }

    // ----------------------------------------------------------------
    // DANNO & CURE
    // ----------------------------------------------------------------
    takeDamage(rawDamage) {
        this.hp = Math.max(0, this.hp - rawDamage);
        return this.hp <= 0; // ritorna true se morto
    }

    heal(amount) {
        this.hp = Math.min(this.maxHp, this.hp + amount);
    }

    // ----------------------------------------------------------------
    // STAMINA
    // ----------------------------------------------------------------
    useStamina(amount) {
        if (this.stamina < amount) return false; // non abbastanza
        this.stamina -= amount;
        this._lastStaminaUse = performance.now() / 1000;
        return true;
    }

    updateStamina(nowSec) {
        if (nowSec - this._lastStaminaUse >= this._staminaRegenDelay) {
            this.stamina = Math.min(this.maxStamina, this.stamina + this._staminaRegenRate / 60);
        }
    }

    // ----------------------------------------------------------------
    // CALCOLO DANNO in uscita (con critico)
    // ----------------------------------------------------------------
    calcOutgoingDamage(baseMultiplier = 1.0) {
        const raw = this.attack * baseMultiplier;
        const isCrit = Math.random() < this.critRate;
        const final  = isCrit ? raw * this.critDamage : raw;
        return { damage: Math.round(final), isCrit };
    }

    // ----------------------------------------------------------------
    // Serializzazione (salvataggio futuro)
    // ----------------------------------------------------------------
    toJSON() {
        return {
            level:       this.level,
            xp:          this.xp,
            hp:          this.hp,
            stamina:     this.stamina,
            bonusAttack:      this.bonusAttack,
            bonusCritRate:    this.bonusCritRate,
            bonusCritDamage:  this.bonusCritDamage,
            bonusMaxHp:       this.bonusMaxHp,
            bonusMaxStamina:  this.bonusMaxStamina,
        };
    }

    fromJSON(data) {
        Object.assign(this, data);
        this.recalculate();
    }
}