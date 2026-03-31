// enemies.js — Nemici con AI base

import * as THREE from 'three';
import { Stats } from './stats.js';

// ────────────────────────────────────────────────────────────────────────────
// TEMPLATE NEMICI
// ────────────────────────────────────────────────────────────────────────────
const ENEMY_TYPES = {
    goblin: {
        name:      'Goblin',
        color:     0x44aa44,
        scale:     0.7,
        maxHp:     30,
        attack:    6,
        speed:     2.2,
        attackRange: 1.8,
        attackCooldown: 1.2,
        detectionRange: 15,
        xpReward:  15,
        tier:      1,
    },
    orc: {
        name:      'Orco',
        color:     0x226622,
        scale:     1.2,
        maxHp:     80,
        attack:    14,
        speed:     1.5,
        attackRange: 2.2,
        attackCooldown: 1.8,
        detectionRange: 12,
        xpReward:  40,
        tier:      2,
    },
    iceWolf: {
        name:      'Lupo Glaciale',
        color:     0xaaddff,
        scale:     0.9,
        maxHp:     45,
        attack:    10,
        speed:     3.5,
        attackRange: 1.5,
        attackCooldown: 0.9,
        detectionRange: 20,
        xpReward:  30,
        tier:      2,
    },
    lavaGolem: {
        name:      'Golem di Lava',
        color:     0xff3300,
        scale:     1.8,
        maxHp:     200,
        attack:    28,
        speed:     0.9,
        attackRange: 3.0,
        attackCooldown: 2.5,
        detectionRange: 18,
        xpReward:  120,
        tier:      3,
    },
    swampTroll: {
        name:      'Troll della Palude',
        color:     0x336633,
        scale:     1.4,
        maxHp:     120,
        attack:    18,
        speed:     1.2,
        attackRange: 2.5,
        attackCooldown: 2.0,
        detectionRange: 14,
        xpReward:  70,
        tier:      3,
    },
};

// Bioma → tipi di nemici possibili
const BIOME_ENEMIES = {
    FORESTA: ['goblin', 'goblin', 'orc'],
    DESERTO: ['goblin', 'orc'],
    TUNDRA:  ['iceWolf', 'iceWolf', 'orc'],
    VULCANO: ['lavaGolem', 'orc'],
    PALUDE:  ['swampTroll', 'goblin'],
    MONTAGNA:['orc', 'iceWolf'],
};

// ────────────────────────────────────────────────────────────────────────────
// ENEMY CLASS
// ────────────────────────────────────────────────────────────────────────────
export class Enemy {
    constructor(type, position) {
        const tmpl = ENEMY_TYPES[type] || ENEMY_TYPES.goblin;
        this.type     = type;
        this.template = tmpl;
        this.alive    = true;
        this.xpReward = tmpl.xpReward;

        // Stats semplificati (non usa la classe Stats per leggerezza)
        this.stats = {
            hp:     tmpl.maxHp,
            maxHp:  tmpl.maxHp,
            attack: tmpl.attack,
            takeDamage(d) {
                this.hp = Math.max(0, this.hp - d);
                return this.hp <= 0;
            },
        };

        // Mesh
        this.mesh = this._buildMesh(tmpl);
        this.mesh.position.copy(position);
        this.mesh.position.y += 0.5;

        // AI
        this._state              = 'idle';  // idle | chase | attack | stunned
        this._attackTimer        = 0;
        this._lastAttackTime     = -999;
        this._stunTimer          = 0;
        this._wanderTarget       = null;
        this._wanderTimer        = 0;

        // HP bar (3D Billboard sopra il nemico)
        this._hpBar = this._buildHpBar();
        this.mesh.add(this._hpBar.group);
    }

    // ────────────────────────────────────────────────────────────────
    // MESH
    // ────────────────────────────────────────────────────────────────
    _buildMesh(tmpl) {
        const group = new THREE.Group();

        // Corpo
        const bodyGeo = new THREE.CapsuleGeometry(0.3, 0.6, 4, 8);
        const bodyMat = new THREE.MeshPhongMaterial({ color: tmpl.color, flatShading: true });
        const body    = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.6;
        group.add(body);

        // "Occhi" per indicare direzione
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        [-0.12, 0.12].forEach(ox => {
            const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 4, 4), eyeMat);
            eye.position.set(ox, 0.85, -0.28 * tmpl.scale);
            group.add(eye);
        });

        group.scale.setScalar(tmpl.scale);
        return group;
    }

    // ────────────────────────────────────────────────────────────────
    // HP BAR 3D
    // ────────────────────────────────────────────────────────────────
    _buildHpBar() {
        const group = new THREE.Group();
        group.position.y = 1.8 / this.template.scale;

        // Background
        const bgGeo = new THREE.PlaneGeometry(1.2, 0.18);
        const bgMat = new THREE.MeshBasicMaterial({ color: 0x330000, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
        const bg    = new THREE.Mesh(bgGeo, bgMat);
        group.add(bg);

        // Fill
        const fillGeo = new THREE.PlaneGeometry(1.2, 0.18);
        const fillMat = new THREE.MeshBasicMaterial({ color: 0xff2222, side: THREE.DoubleSide });
        const fill    = new THREE.Mesh(fillGeo, fillMat);
        fill.position.z = 0.01;
        group.add(fill);

        return { group, fill };
    }

    _updateHpBar(camera) {
        const ratio = Math.max(0, this.stats.hp / this.stats.maxHp);
        this._hpBar.fill.scale.x = ratio;
        this._hpBar.fill.position.x = (ratio - 1) * 0.6;

        // Billboard: guarda sempre la camera
        if (camera) {
            this._hpBar.group.quaternion.copy(camera.quaternion);
        }
    }

    // ────────────────────────────────────────────────────────────────
    // AI UPDATE
    // ────────────────────────────────────────────────────────────────
    update(dt, playerPos, combatController, camera) {
        if (!this.alive) return;

        this._updateHpBar(camera);

        const now  = performance.now() / 1000;
        const dist = this.mesh.position.distanceTo(playerPos);

        // ── Stun ────────────────────────────────────────────────────
        if (this._state === 'stunned') {
            this._stunTimer -= dt;
            if (this._stunTimer <= 0) this._state = 'idle';
            return;
        }

        // ── Macchina a stati ─────────────────────────────────────────
        if (dist < this.template.detectionRange) {
            if (dist <= this.template.attackRange) {
                this._state = 'attack';
            } else {
                this._state = 'chase';
            }
        } else {
            this._state = 'idle';
        }

        if (this._state === 'chase') {
            const dir = playerPos.clone().sub(this.mesh.position).normalize();
            dir.y = 0;
            this.mesh.position.addScaledVector(dir, this.template.speed * dt);
            this.mesh.lookAt(new THREE.Vector3(playerPos.x, this.mesh.position.y, playerPos.z));
        }

        if (this._state === 'attack') {
            if (now - this._lastAttackTime >= this.template.attackCooldown) {
                this._lastAttackTime = now;
                // Infliggi danno al player
                combatController.takeDamage(this.template.attack);
            }
        }

        if (this._state === 'idle') {
            // Wander casuale
            this._wanderTimer -= dt;
            if (this._wanderTimer <= 0 || !this._wanderTarget) {
                this._wanderTimer = 2 + Math.random() * 3;
                const angle = Math.random() * Math.PI * 2;
                this._wanderTarget = this.mesh.position.clone().add(
                    new THREE.Vector3(Math.cos(angle) * 4, 0, Math.sin(angle) * 4)
                );
            }
            if (this._wanderTarget) {
                const dir = this._wanderTarget.clone().sub(this.mesh.position);
                dir.y = 0;
                if (dir.length() > 0.2) {
                    dir.normalize();
                    this.mesh.position.addScaledVector(dir, this.template.speed * 0.3 * dt);
                }
            }
        }
    }
}

// ────────────────────────────────────────────────────────────────────────────
// ENEMY SPAWNER
// ────────────────────────────────────────────────────────────────────────────
export class EnemySpawner {
    constructor(scene, combatController) {
        this.scene             = scene;
        this.combatController  = combatController;
        this._spawnedChunks    = new Set();
        this._maxEnemies       = 40;
    }

    /**
     * Spawna nemici per i chunk appena caricati.
     * @param {Map} loadedChunks   - La mappa globale dei chunk
     * @param {Function} getBiome  - Funzione biome(x,z) da world.js
     * @param {Function} getHeight - Funzione getHeight(x,z) da world.js
     * @param {number} CHUNK_SIZE
     */
    updateSpawns(loadedChunks, getBiome, getHeight, CHUNK_SIZE) {
        if (this.combatController.enemies.length >= this._maxEnemies) return;

        for (const [key] of loadedChunks) {
            if (this._spawnedChunks.has(key)) continue;
            this._spawnedChunks.add(key);

            const [cx, cz] = key.split(',').map(Number);
            const offsetX  = cx * CHUNK_SIZE;
            const offsetZ  = cz * CHUNK_SIZE;

            // Bioma al centro del chunk
            const biomeData = getBiome(offsetX + CHUNK_SIZE / 2, offsetZ + CHUNK_SIZE / 2);
            const pool      = BIOME_ENEMIES[biomeData.type];
            if (!pool) continue;

            // Spawna 1-3 nemici per chunk (se bioma lo prevede)
            const count = 1 + Math.floor(Math.random() * 2);
            for (let i = 0; i < count; i++) {
                const type = pool[Math.floor(Math.random() * pool.length)];
                const sx   = offsetX + 5 + Math.random() * (CHUNK_SIZE - 10);
                const sz   = offsetZ + 5 + Math.random() * (CHUNK_SIZE - 10);
                const sy   = getHeight(sx, sz);

                if (sy < 4.5) continue; // Non spawnare in acqua

                const pos   = new THREE.Vector3(sx, sy, sz);
                const enemy = new Enemy(type, pos);
                this.scene.add(enemy.mesh);
                this.combatController.enemies.push(enemy);
            }
        }
    }

    /**
     * Update AI di tutti i nemici.
     */
    updateEnemies(dt, playerPos, camera) {
        for (const enemy of this.combatController.enemies) {
            enemy.update(dt, playerPos, this.combatController, camera);
        }
    }
}