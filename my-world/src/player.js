import * as THREE from 'three';
import { getPreciseHeight, getNearbyTriangles } from './world.js';
import { step } from 'three/src/nodes/math/MathNode.js';

const waterLevel = 3.5;
const radius = 0.3;
const height = 1.0;

export class Player {

    constructor(scene, camera) {
        this.camera = camera;
        this.mesh = new THREE.Group();
        const body = new THREE.Mesh(
            new THREE.CapsuleGeometry(0.25, 0.5, 4, 8), // Dimensioni dimezzate
            new THREE.MeshPhongMaterial({ color: 0xffff00, flatShading: true })
        );
        body.position.y = 0.5;
        this.mesh.add(body);
        scene.add(this.mesh);

        this.mesh.position.set(0, 10, 0);
        this.velocityV = 0;
        this.rotationY = 0; // Rotazione orizzontale
        this.rotationX = 0; // Rotazione verticale (su/giù)

        // Gestione Mouse
        document.addEventListener('mousemove', (e) => {
            if (document.pointerLockElement === document.body) {
                this.rotationY -= e.movementX * 0.002;
                this.rotationX += e.movementY * 0.002;
                // Limita la rotazione verticale per non capovolgere la camera
                this.rotationX = Math.max(-Math.PI / 3, Math.min(Math.PI / 4, this.rotationX));
            }
        });

        // Clicca per attivare il controllo camera
        document.addEventListener('click', () => {
            document.body.requestPointerLock();
        });

        this.mesh.position.set(0, 20, 0);
        this.velocityV = 0;
        this.keys = { w: false, a: false, s: false, d: false, ' ': false };

        window.addEventListener('keydown', (e) => this.keys[e.key.toLowerCase()] = true);
        window.addEventListener('keyup', (e) => this.keys[e.key.toLowerCase()] = false);
    }

    update() {
        const speed = 0.15;
        const gravity = -0.015;
        const jumpForce = 0.25;

        const playerRadius = 0.3;
        const playerHeight = 1.0;
        const maxSlope = 0.7;

        // Direzioni
        const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.rotationY);
        const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.rotationY);

        // Movimento input
        let moveVec = new THREE.Vector3(0, 0, 0);

        if (this.keys.w) moveVec.add(forward);
        if (this.keys.s) moveVec.add(forward.clone().multiplyScalar(-1));
        if (this.keys.a) moveVec.add(right.clone().multiplyScalar(-1));
        if (this.keys.d) moveVec.add(right);

        if (moveVec.length() > 0) {
            moveVec.normalize().multiplyScalar(speed);

            const nextPos = this.mesh.position.clone().add(moveVec);

            if (!this.collides(nextPos, playerRadius, playerHeight, maxSlope)) {
                this.mesh.position.copy(nextPos);
            } else {
                // prova solo X
                const tryX = this.mesh.position.clone().add(new THREE.Vector3(moveVec.x, 0, 0));
                if (!this.collides(tryX, playerRadius, playerHeight, maxSlope)) {
                    this.mesh.position.x = tryX.x;
                }

                // prova solo Z
                const tryZ = this.mesh.position.clone().add(new THREE.Vector3(0, 0, moveVec.z));
                if (!this.collides(tryZ, playerRadius, playerHeight, maxSlope)) {
                    this.mesh.position.z = tryZ.z;
                }
            }
        }

        // --- GRAVITÀ ---
        this.velocityV += gravity;
        this.mesh.position.y += this.velocityV;

        const ground = getPreciseHeight(this.mesh.position.x, this.mesh.position.z);

        if (this.mesh.position.y <= ground.height) {
            this.mesh.position.y = ground.height;
            this.velocityV = 0;

            if (this.keys[' ']) {
                this.velocityV = jumpForce;
            }
        }

        // Rotazione
        this.mesh.rotation.y = this.rotationY;
    }

    collides(pos, maxSlope) {
        const ground = getPreciseHeight(pos.x, pos.z);

        // 1. Blocco Pendenza: se il triangolo è troppo ripido
        if (ground.normal.y < maxSlope) return true;

        // 2. Blocco Gradino: se il terreno davanti è più alto di 0.4 unità rispetto a dove sono ora
        // (permette di salire piccoli sbalzi ma non muri)
        const currentHeight = this.mesh.position.y;
        if (ground.height - currentHeight > 0.4) return true;

        return false;
    }
}