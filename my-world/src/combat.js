// combat.js — Sistema di combattimento souls-like

import * as THREE from 'three';

// ────────────────────────────────────────────────────────────────────────────
// COSTANTI
// ────────────────────────────────────────────────────────────────────────────
const DODGE_STAMINA_COST  = 10;
const DODGE_DURATION      = 0.4;   // secondi
const DODGE_SPEED         = 40;
const DODGE_INVINCIBILITY = 0.3;   // finestre di i-frame (secondi)
const COMBO_WINDOW        = 1.0;   // secondi per concatenare attacchi

// ────────────────────────────────────────────────────────────────────────────
// COMBAT CONTROLLER
// ────────────────────────────────────────────────────────────────────────────
export class CombatController {
    /**
     * @param {Stats}      stats       - Stats del player
     * @param {SkillTree}  skillTree   - SkillTree del player
     * @param {THREE.Group} playerMesh - Mesh del player
     * @param {HUD}        hud         - Rifermento HUD per feedback
     */
    constructor(stats, skillTree, playerMesh, hud) {
        this.stats      = stats;
        this.skillTree  = skillTree;
        this.mesh       = playerMesh;
        this.hud        = hud;

        // ── Stato combo ──────────────────────────────────────────────
        this._comboIndex     = 0;     // quale slot della combo stiamo per eseguire
        this._lastAttackTime = 0;
        this._attackCooldownUntil = 0;
        this._isAttacking    = false;

        // ── Stato dodge ──────────────────────────────────────────────
        this._isDodging        = false;
        this._dodgeTimer       = 0;
        this._dodgeDir         = new THREE.Vector3();
        this._invincibleUntil  = 0;

        // ── Dash offensivo (durante attacco) ─────────────────────────
        this._dashForwardActive = false;
        this._dashForwardTimer  = 0;
        this._dashForwardDir    = new THREE.Vector3();
        this._dashForwardDist   = 0;

        // ── Input ────────────────────────────────────────────────────
        this._keys = { attack: false, dodge: false };
        this._justPressedAttack = false;
        this._justPressedDodge  = false;

        document.addEventListener('mousedown', (e) => {
            if (e.button === 0) this._justPressedAttack = true;
        });
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space') this._justPressedDodge = true;
        });

        // ── Effetti visivi temporanei (hitbox debug / fx) ────────────
        this._fxMeshes = [];

        // ── Nemici nel mondo (riferimento esterno da aggiornare) ─────
        this.enemies = [];   // array di { mesh, stats, ai }
    }

    // ────────────────────────────────────────────────────────────────────────
    // UPDATE — chiamato ogni frame
    // ────────────────────────────────────────────────────────────────────────
    update(dt, forwardDir) {
        const now = performance.now() / 1000;
        this.stats.updateStamina(now);

        // ── Pulizia FX temporanei ────────────────────────────────────
        this._fxMeshes = this._fxMeshes.filter(f => {
            f.life -= dt;
            if (f.mesh.material) f.mesh.material.opacity = Math.max(0, f.life / f.maxLife);
            if (f.life <= 0) {
                if (f.mesh.parent) f.mesh.parent.remove(f.mesh);
                return false;
            }
            return true;
        });

        // ── DODGE ────────────────────────────────────────────────────
        if (this._isDodging) {
            this._dodgeTimer -= dt;
            const speed = DODGE_SPEED * (this._dodgeTimer / DODGE_DURATION);
            this.mesh.position.addScaledVector(this._dodgeDir, speed * dt);
            if (this._dodgeTimer <= 0) this._isDodging = false;
        } else if (this._justPressedDodge) {
            this._tryDodge(forwardDir);
        }

        // ── DASH OFFENSIVO (da attacco) ──────────────────────────────
        if (this._dashForwardActive) {
            this._dashForwardTimer -= dt;
            this.mesh.position.addScaledVector(
                this._dashForwardDir,
                this._dashForwardDist * dt / 0.15
            );
            if (this._dashForwardTimer <= 0) this._dashForwardActive = false;
        }

        // ── ATTACCO ──────────────────────────────────────────────────
        if (this._justPressedAttack && now >= this._attackCooldownUntil && !this._isDodging) {
            this._tryAttack(now, forwardDir);
        }

        // Reset input one-shot
        this._justPressedAttack = false;
        this._justPressedDodge  = false;

        // Reset combo se finestra scaduta
        if (now - this._lastAttackTime > COMBO_WINDOW && this._comboIndex !== 0) {
            this._comboIndex = 0;
            if (this.hud) this.hud.resetCombo();
        }
    }

    // ────────────────────────────────────────────────────────────────────────
    // DODGE
    // ────────────────────────────────────────────────────────────────────────
    _tryDodge(forwardDir) {
        if (this._isDodging) return;
        if (!this.stats.useStamina(DODGE_STAMINA_COST)) {
            if (this.hud) this.hud.showMessage('Stamina insufficiente!', 0xff4444);
            return;
        }

        this._isDodging       = true;
        this._dodgeTimer      = DODGE_DURATION;
        this._invincibleUntil = performance.now() / 1000 + DODGE_INVINCIBILITY;

        // Direzione dodge: usa input movimento se disponibile (passato da player.js)
        this._dodgeDir = forwardDir.clone().normalize();
        if (this._dodgeDir.lengthSq() < 0.01) {
            // Dodge indietro di default
            this._dodgeDir.copy(forwardDir).negate();
        }

        if (this.hud) this.hud.showDodgeFlash();
    }

    // ────────────────────────────────────────────────────────────────────────
    // ATTACCO
    // ────────────────────────────────────────────────────────────────────────
    _tryAttack(now, forwardDir) {
        const slots = this.skillTree.getActiveSlots();
        if (!slots || slots.length === 0) return;

        // Seleziona lo slot corrente nella sequenza combo
        const slotData = slots[this._comboIndex % slots.length];
        if (!slotData) return;

        if (!this.stats.useStamina(slotData.staminaCost)) {
            if (this.hud) this.hud.showMessage('Stamina!', 0xff4444);
            this._comboIndex = 0;
            return;
        }

        this._lastAttackTime     = now;
        this._attackCooldownUntil = now + slotData.cooldown;
        this._isAttacking        = true;

        // Avanza combo
        this._comboIndex = (this._comboIndex + 1) % slots.length;

        // Dash offensivo
        if (slotData.dashForward > 0) {
            this._dashForwardActive = true;
            this._dashForwardTimer  = 0.15;
            this._dashForwardDir    = forwardDir.clone().normalize();
            this._dashForwardDist   = slotData.dashForward;
        }

        // Spawna effetto visivo hitbox
        this._spawnHitboxFX(slotData, forwardDir);

        // Calcola e applica danno ai nemici nell'hitbox
        const hits = this._resolveHits(slotData, forwardDir);
        hits.forEach(enemy => {
            const { damage, isCrit } = this.stats.calcOutgoingDamage(slotData.damageMultiplier);
            const isDead = enemy.stats.takeDamage(damage);
            if (this.hud) this.hud.showDamageNumber(damage, isCrit, enemy.mesh.position);
            if (isDead) this._onEnemyKilled(enemy);
        });

        if (this.hud) this.hud.showComboHit(this._comboIndex, slotData.label);

        setTimeout(() => { this._isAttacking = false; }, slotData.cooldown * 1000);
    }

    // ────────────────────────────────────────────────────────────────────────
    // HIT DETECTION (hitbox geometriche)
    // ────────────────────────────────────────────────────────────────────────
    _resolveHits(slotData, forwardDir) {
        const hits = [];
        const origin = this.mesh.position.clone();
        const fwd    = forwardDir.clone().normalize();

        for (const enemy of this.enemies) {
            if (!enemy.alive) continue;
            const toEnemy = enemy.mesh.position.clone().sub(origin);
            const dist    = toEnemy.length();

            if (dist > slotData.hitboxDepth + 1) continue; // Quick reject

            const hit = this._checkHitbox(slotData, origin, fwd, enemy.mesh.position, dist);
            if (hit) hits.push(enemy);
        }
        return hits;
    }

    _checkHitbox(slotData, origin, fwd, targetPos, dist) {
        const toTarget = targetPos.clone().sub(origin);
        toTarget.y = 0; // Ignora altezza per semplicità
        const flatFwd = new THREE.Vector3(fwd.x, 0, fwd.z).normalize();

        switch (slotData.hitboxShape) {
            case 'circle':
                return dist <= slotData.hitboxDepth;

            case 'arc':
            case 'cone': {
                if (dist > slotData.hitboxDepth) return false;
                const angle = THREE.MathUtils.radToDeg(
                    toTarget.normalize().angleTo(flatFwd)
                );
                return angle <= slotData.hitboxAngle / 2;
            }

            case 'line': {
                const cross = new THREE.Vector3().crossVectors(flatFwd, toTarget.normalize());
                const width = cross.length() * dist;
                return dist <= slotData.hitboxDepth && width < 1.0;
            }

            default:
                return dist <= slotData.range;
        }
    }

    // ────────────────────────────────────────────────────────────────────────
    // FX HITBOX (visivo temporaneo)
    // ────────────────────────────────────────────────────────────────────────
    _spawnHitboxFX(slotData, forwardDir) {
        let geo, color;

        switch (slotData.hitboxShape) {
            case 'circle':
                geo   = new THREE.RingGeometry(0.1, slotData.hitboxDepth, 16);
                color = 0xffd700;
                break;
            case 'arc':
            case 'cone':
                geo   = new THREE.CircleGeometry(slotData.hitboxDepth, 16, 0,
                        THREE.MathUtils.degToRad(slotData.hitboxAngle));
                color = 0xff6600;
                break;
            case 'line':
                geo   = new THREE.PlaneGeometry(0.6, slotData.hitboxDepth);
                color = 0x00ddff;
                break;
            default:
                geo   = new THREE.CircleGeometry(slotData.range, 12);
                color = 0xffffff;
        }

        const mat  = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2;

        // Orienta verso la direzione di attacco
        const angle = Math.atan2(forwardDir.x, forwardDir.z);
        mesh.rotation.z = -angle;

        const pos = this.mesh.position.clone();
        pos.y += 0.05;

        if (slotData.hitboxShape === 'line') {
            pos.addScaledVector(forwardDir, slotData.hitboxDepth / 2);
        }

        mesh.position.copy(pos);
        if (this.mesh.parent) this.mesh.parent.add(mesh);

        this._fxMeshes.push({ mesh, life: 0.18, maxLife: 0.18 });
    }

    // ────────────────────────────────────────────────────────────────────────
    // NEMICO UCCISO
    // ────────────────────────────────────────────────────────────────────────
    _onEnemyKilled(enemy) {
        enemy.alive = false;
        const xp = enemy.xpReward || 20;
        this.stats.addXp(xp);
        if (this.hud) this.hud.showMessage(`+${xp} XP`, 0x88ff44);

        // Rimuovi mesh dal parent dopo un breve ritardo
        setTimeout(() => {
            if (enemy.mesh.parent) enemy.mesh.parent.remove(enemy.mesh);
            this.enemies = this.enemies.filter(e => e !== enemy);
        }, 500);
    }

    // ────────────────────────────────────────────────────────────────────────
    // INVINCIBILITÀ (per i-frame dodge)
    // ────────────────────────────────────────────────────────────────────────
    isInvincible() {
        return performance.now() / 1000 < this._invincibleUntil;
    }

    // ────────────────────────────────────────────────────────────────────────
    // RICEVI DANNO (chiamato dall'AI nemico)
    // ────────────────────────────────────────────────────────────────────────
    takeDamage(rawDamage) {
        if (this.isInvincible()) return false;
        const dead = this.stats.takeDamage(rawDamage);
        if (this.hud) this.hud.flashDamage();
        return dead;
    }
}