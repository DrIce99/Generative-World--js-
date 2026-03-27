import * as THREE from 'three';
import { createWorld, updateWorld, worldDataMap, CHUNK_SIZE } from './world.js';
import { Player } from './player.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a1a);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const fogColor = 0x1a1a1a; // Stesso colore dello sfondo
const fogNear = 50;        // Dove inizia la nebbia
const fogFar = 150;        // Dove tutto diventa nero (deve essere < RENDER_DISTANCE * CHUNK_SIZE)

const sceneGroup = new THREE.Group();

scene.fog = new THREE.Fog(fogColor, fogNear, fogFar);
scene.background = new THREE.Color(fogColor);

scene.add(sceneGroup);

const minimapCanvas = document.getElementById('minimap');
const ctx = minimapCanvas.getContext('2d');
minimapCanvas.width = 200;
minimapCanvas.height = 200;

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

    drawMinimap(player);

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

function drawMinimap(player) {
    ctx.clearRect(0, 0, 200, 200);
    const mapScale = 0.5; // Zoom (più basso = vedi più lontano)
    const centerX = 100;
    const centerY = 100;
    const res = 10; // Deve corrispondere alla resolution in world.js
    const pixelSize = (CHUNK_SIZE / res) * mapScale;

    const pX = player.mesh.position.x;
    const pZ = player.mesh.position.z;

    worldDataMap.forEach((gridData, key) => {
        const [cx, cz] = key.split(',').map(Number);
        const offsetX = cx * CHUNK_SIZE;
        const offsetZ = cz * CHUNK_SIZE;

        gridData.forEach((data, index) => {
            const i = Math.floor(index / res);
            const j = index % res;

            // Posizione a schermo relativa al player
            const drawX = centerX + (offsetX + i * (CHUNK_SIZE / res) - pX) * mapScale;
            const drawZ = centerY + (offsetZ + j * (CHUNK_SIZE / res) - pZ) * mapScale;

            // Saltiamo il disegno se fuori dal canvas circolare (ottimizzazione)
            const distFromCenter = Math.sqrt(Math.pow(drawX - 100, 2) + Math.pow(drawZ - 100, 2));
            if (distFromCenter > 95) return;

            // Effetto Ombreggiatura (Shadowing) per i rilievi
            // Se l'altezza è alta, schiariamo il colore
            let color = new THREE.Color(data.color);
            if (data.h > 12) color.lerp(new THREE.Color(0xffffff), 0.3); // Neve/Roccia chiara
            if (data.h < 3.5) color.lerp(new THREE.Color(0x000033), 0.2); // Acqua profonda

            ctx.fillStyle = `#${color.getHexString()}`;
            ctx.fillRect(drawX, drawZ, pixelSize + 0.5, pixelSize + 0.5);
        });
    });

    // Maschera Circolare (Opzionale ma professionale)
    ctx.globalCompositeOperation = 'destination-in';
    ctx.beginPath();
    ctx.arc(100, 100, 95, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    // Indicatore Direzione Player (Freccia)
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(-player.rotationY);  // Usa la rotazione del player
    ctx.fillStyle = 'white';
    ctx.shadowBlur = 5;
    ctx.shadowColor = "black";
    ctx.beginPath();
    ctx.moveTo(0, -10);  // Punta della freccia
    ctx.lineTo(6, 7);    // Angolo basso destro
    ctx.lineTo(0, 3);    // Incavo posteriore
    ctx.lineTo(-6, 7);   // Angolo basso sinistro
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

animate();