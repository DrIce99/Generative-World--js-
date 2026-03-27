import * as THREE from 'three';
import { createWorld, updateWorld } from './world.js';
import { Player } from './player.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a1a);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const sceneGroup = new THREE.Group();
scene.add(sceneGroup);

// Inizializzazione
createWorld(sceneGroup);
const player = new Player(scene);

// Luci
const sun = new THREE.DirectionalLight(0xffffff, 1.5);
sun.position.set(50, 100, 50);
scene.add(sun);
scene.add(new THREE.AmbientLight(0x404040, 0.8));

function animate() {
    requestAnimationFrame(animate);
    player.update();

    updateWorld(player.mesh.position, sceneGroup);

    const dist = 15;

    // Calcoliamo la posizione relativa basandoci sulle rotazioni X e Y del mouse
    const relativeCameraOffset = new THREE.Vector3(
        Math.sin(player.rotationY) * Math.cos(player.rotationX) * dist,
        Math.sin(player.rotationX) * -dist + 5, // +5 per tenerla un po' alta
        Math.cos(player.rotationY) * Math.cos(player.rotationX) * dist
    );

    const cameraPos = player.mesh.position.clone().add(relativeCameraOffset);
    camera.position.copy(cameraPos);
    camera.lookAt(player.mesh.position.clone().add(new THREE.Vector3(0, 2, 0))); // Guarda un po' sopra i piedi

    renderer.render(scene, camera);
}
animate();
