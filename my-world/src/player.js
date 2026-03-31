// player.js — Movimento + integrazione Combat

import * as THREE from 'three';
import { getPreciseHeight } from './world.js';
import { Stats } from './stats.js';
import { SkillTree, SKILLS } from './skilltree.js';
import { CombatController } from './combat.js';
import { HUD } from './hud.js';

const waterLevel = 3.5;

export class Player {
    constructor(scene, camera) {
        this.camera = camera;

        // ── Mesh ──────────────────────────────────────────────────
        this.mesh = new THREE.Group();
        const body = new THREE.Mesh(
            new THREE.CapsuleGeometry(0.25, 0.5, 4, 8),
            new THREE.MeshPhongMaterial({ color: 0xffff00, flatShading: true })
        );
        body.position.y = 0.5;
        this.mesh.add(body);
        scene.add(this.mesh);
        this.mesh.position.set(0, 20, 0);

        // ── Fisica ────────────────────────────────────────────────
        this.velocityV = 0;
        this.rotationY = 0;
        this.rotationX = 0;

        // ── RPG ───────────────────────────────────────────────────
        this.stats     = new Stats();
        this.skillTree = new SkillTree(this.stats);

        // Sblocca le due skill base all'inizio
        this.skillTree.skillPoints = 2;
        this.skillTree.unlock('quickSlash');
        this.skillTree.unlock('heavySlam');
        this.skillTree.assignToSlot('quickSlash', 0);
        this.skillTree.assignToSlot('heavySlam', 1);

        // ── HUD ───────────────────────────────────────────────────
        this.hud = new HUD(this.stats, this.skillTree);
        this.hud.setSkills(SKILLS);

        // ── Combat ────────────────────────────────────────────────
        this.combat = new CombatController(this.stats, this.skillTree, this.mesh, this.hud);

        // ── Input ─────────────────────────────────────────────────
        this.keys = { w: false, a: false, s: false, d: false, shift: false };

        window.addEventListener('keydown', (e) => {
            const k = e.key.toLowerCase();
            if (k in this.keys) this.keys[k] = true;
            if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.keys.shift = true;
        });
        window.addEventListener('keyup', (e) => {
            const k = e.key.toLowerCase();
            if (k in this.keys) this.keys[k] = false;
            if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.keys.shift = false;
        });

        // Mouse
        document.addEventListener('mousemove', (e) => {
            if (document.pointerLockElement === document.body) {
                this.rotationY -= e.movementX * 0.002;
                this.rotationX += e.movementY * 0.002;
                this.rotationX  = Math.max(-Math.PI / 3, Math.min(Math.PI / 4, this.rotationX));
            }
        });
        document.addEventListener('click', () => {
            if (!document.getElementById('skilltree-panel')?.classList.contains('open')) {
                document.body.requestPointerLock();
            }
        });

        this._prevTime = performance.now();
    }

    // ────────────────────────────────────────────────────────────────
    // UPDATE
    // ────────────────────────────────────────────────────────────────
    async update() {
        const now = performance.now();
        const dt  = Math.min((now - this._prevTime) / 1000, 0.05);
        this._prevTime = now;

        const speed       = this.keys.shift ? 0.82 : 0.15; // sprint con shift
        const gravity     = -0.015;
        const jumpForce   = 0.25;
        const playerRadius = 0.3;
        const maxSlope    = 0.2;

        // Direzioni
        const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.rotationY);
        const right   = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.rotationY);

        let moveVec = new THREE.Vector3();
        if (this.keys.w) moveVec.add(forward);
        if (this.keys.s) moveVec.add(forward.clone().negate());
        if (this.keys.a) moveVec.add(right.clone().negate());
        if (this.keys.d) moveVec.add(right);

        // Direzione di movimento per dodge/dash
        let moveDir = moveVec.clone();
        if (moveDir.lengthSq() < 0.01) moveDir = forward.clone();
        else moveDir.normalize();

        // ── Combat update (attacchi, dodge, ecc.) ─────────────────
        if (!this.combat._isDodging) {
            // Movimento normale
            if (moveVec.length() > 0) {
                moveVec.normalize().multiplyScalar(speed);
                const nextPos = this.mesh.position.clone().add(moveVec);
                if (!this._collides(nextPos, maxSlope)) {
                    this.mesh.position.copy(nextPos);
                } else {
                    const tryX = this.mesh.position.clone().add(new THREE.Vector3(moveVec.x, 0, 0));
                    if (!this._collides(tryX, maxSlope)) this.mesh.position.x = tryX.x;
                    const tryZ = this.mesh.position.clone().add(new THREE.Vector3(0, 0, moveVec.z));
                    if (!this._collides(tryZ, maxSlope)) this.mesh.position.z = tryZ.z;
                }
            }
        }

        this.combat.update(dt, moveDir);

        // ── Gravità ───────────────────────────────────────────────
        this.velocityV += gravity;
        this.mesh.position.y += this.velocityV;

        const ground = getPreciseHeight(this.mesh.position.x, this.mesh.position.z);
        if (this.mesh.position.y <= ground.height) {
            this.mesh.position.y = ground.height;
            this.velocityV = 0;
            if (this.keys[' ']) this.velocityV = jumpForce;
        }

        // ── Danno da lava ─────────────────────────────────────────
        if (this.mesh.position.y < 6.5) {
            const { getBiome } = await import('./world.js').catch(() => ({}));
            // Controllo semplice: danno lava gestito in main.js
        }

        // ── HUD update ────────────────────────────────────────────
        this.hud.update();

        // Rotazione
        this.mesh.rotation.y = this.rotationY;
    }

    _collides(pos, maxSlope) {
        const ground = getPreciseHeight(pos.x, pos.z);
        if (ground.normal.y < maxSlope) return true;
        if (ground.height - this.mesh.position.y > 0.4) return true;
        return false;
    }
}