import * as THREE from 'three';
import { getPreciseHeight } from './world.js';

const waterLevel = 3.5;

export class Player {
    constructor(scene, camera) {
        this.camera = camera;
        this.mesh = new THREE.Group();
        const body = new THREE.Mesh(
            new THREE.CapsuleGeometry(0.5, 1, 4, 8),
            new THREE.MeshPhongMaterial({ color: 0xffff00 })
        );
        body.position.y = 1;
        this.mesh.add(body);
        scene.add(this.mesh);

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
        const jumpForce = 0.25;

        const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.rotationY);
        const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.rotationY);

        if (this.keys.w) this.mesh.position.add(forward.multiplyScalar(speed));
        if (this.keys.s) this.mesh.position.add(forward.multiplyScalar(-speed));
        if (this.keys.a) this.mesh.position.add(right.multiplyScalar(-speed));
        if (this.keys.d) this.mesh.position.add(right.multiplyScalar(speed));

        // Facciamo ruotare il corpo del player verso la direzione della camera (opzionale)
        this.mesh.rotation.y = this.rotationY;

        // Gravità e Salto
        this.velocityV += gravity;
        this.mesh.position.y += this.velocityV;

        const groundH = getPreciseHeight(this.mesh.position.x, this.mesh.position.z);

        if (this.mesh.position.y <= groundH) {
            this.mesh.position.y = groundH;
            this.velocityV = 0;

            if (this.keys[' ']) {
                this.velocityV = jumpForce;
            }
        }
    }
}
