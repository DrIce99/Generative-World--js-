import * as THREE from 'three';
import { getPreciseHeight } from './world.js';

const waterLevel = 3.5;

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
                this.rotationX -= e.movementY * 0.002;
                // Limita la rotazione verticale per non capovolgere la camera
                this.rotationX = Math.max(-Math.PI/3, Math.min(Math.PI/4, this.rotationX));
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
        const speed = 0.4;
        const gravity = -0.015;
        const maxSlope = 0.7;
        const jumpForce = 0.25;

        const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.rotationY);
        const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.rotationY);

        let moveVec = new THREE.Vector3(0,0,0);
        if (this.keys.w) this.mesh.position.add(forward.multiplyScalar(speed));
        if (this.keys.s) this.mesh.position.add(forward.multiplyScalar(-speed));
        if (this.keys.a) this.mesh.position.add(right.multiplyScalar(-speed));
        if (this.keys.d) this.mesh.position.add(right.multiplyScalar(speed));

        moveVec.normalize().multiplyScalar(speed);

        // --- CONTROLLO PENDENZA ---
        const nextPos = this.mesh.position.clone().add(moveVec);
        const groundData = getPreciseHeightWithNormal(nextPos.x, nextPos.z);
        
        // Se la normale Y è troppo bassa, il prisma è troppo ripido
        if (groundData.normal.y > maxSlope) {
            this.mesh.position.x = nextPos.x;
            this.mesh.position.z = nextPos.z;
        }

        this.mesh.rotation.y = this.rotationY;

        // Facciamo ruotare il corpo del player verso la direzione della camera (opzionale)
        this.mesh.rotation.y = this.rotationY;

        // Gravità e Salto
        this.velocityV += gravity;
        this.mesh.position.y += this.velocityV;

        const groundH = getPreciseHeight(this.mesh.position.x, this.mesh.position.z);

        if (this.mesh.position.y <= groundData.height) {
            this.mesh.position.y = groundData.height;
            this.velocityV = 0;

            if (this.keys[' ']) this.velocityV = 0.2; 
        }
    }
}
