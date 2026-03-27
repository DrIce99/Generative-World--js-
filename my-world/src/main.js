import * as THREE from 'three';
import { createWorld, updateWorld, worldDataMap, CHUNK_SIZE, loadedChunks } from './world.js';
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
const sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
sunLight.castShadow = false; // Disattiva per ora per performance
scene.add(sunLight);

const ambientLight = new THREE.AmbientLight(0x404040, 0.8);
scene.add(ambientLight);

let dayTime = 0; 
const dayDuration = 0.0005;

const sunGeo = new THREE.SphereGeometry(10, 16, 16); // Leggermente più grandi
const sunMat = new THREE.MeshBasicMaterial({ color: 0xffdd00 });
const sunMesh = new THREE.Mesh(sunGeo, sunMat);
scene.add(sunMesh);

const moonGeo = new THREE.SphereGeometry(8, 16, 16);
const moonMat = new THREE.MeshBasicMaterial({ color: 0xeeeeee });
const moonMesh = new THREE.Mesh(moonGeo, moonMat);
scene.add(moonMesh);

// --- STELLE ---
const starGeo = new THREE.BufferGeometry();
const starPositions = [];
for (let i = 0; i < 2000; i++) {
    const x = (Math.random() - 0.5) * 1000;
    const y = Math.random() * 500 + 100; // Solo sopra l'orizzonte
    const z = (Math.random() - 0.5) * 1000;
    starPositions.push(x, y, z);
}
starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.8, transparent: true });
const starField = new THREE.Points(starGeo, starMat);
scene.add(starField);

// Colori per le fasi
const skyColors = {
    dawn: new THREE.Color(0xff7e5f),  // Arancio alba
    noon: new THREE.Color(0x87ceeb),  // Azzurro mezzogiorno
    dusk: new THREE.Color(0x2c3e50),  // Blu scuro tramonto
    night: new THREE.Color(0x050505)  // Nero notte
};

camera.far = 2000;
camera.updateProjectionMatrix();

function animate(time) {
    requestAnimationFrame(animate);

    loadedChunks.forEach(chunkGroup => {
        const water = chunkGroup.children.find(c => c.userData.isWater);
        if (water) {
            water.position.y = 3.5 + Math.sin(time * 0.002 + water.position.x) * 0.2;
        }
    });

    player.update();

    updateWorld(player.mesh.position, sceneGroup);

    updateEnvironment(sunLight, scene);

    drawMinimap(player);

    const dist = 6;

    // Calcoliamo la posizione relativa basandoci sulle rotazioni X e Y del mouse
    const relativeCameraOffset = new THREE.Vector3(
        Math.sin(player.rotationY) * Math.cos(player.rotationX) * dist,
        Math.sin(player.rotationX) * dist + 2, // Abbassata anche l'altezza (era 5)
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

function updateEnvironment(sunLight, scene) {
    dayTime += dayDuration;
    if (dayTime > 2) dayTime = 0;

    const angle = dayTime * Math.PI;
    const distance = 300; // Distanza visibile (dentro il far della camera)

    // 1. CALCOLO POSIZIONI ORBITALI
    const sX = Math.cos(angle) * distance;
    const sY = Math.sin(angle) * distance;
    const mX = Math.cos(angle + Math.PI) * distance;
    const mY = Math.sin(angle + Math.PI) * distance;

    // Posizioniamo le mesh relative al player
    sunMesh.position.set(player.mesh.position.x + sX, player.mesh.position.y + sY, player.mesh.position.z);
    moonMesh.position.set(player.mesh.position.x + mX, player.mesh.position.y + mY, player.mesh.position.z);

    // 2. DIREZIONE DELLA LUCE
    // La luce deve provenire dalla posizione del sole (o della luna di notte)
    if (sY > 0) {
        // GIORNO: Luce dal sole
        sunLight.position.copy(sunMesh.position);
        sunLight.intensity = Math.max(0.2, (sY / distance) * 1.5);
    } else {
        // NOTTE CHIARA: Luce dalla luna
        sunLight.position.copy(moonMesh.position);
        sunLight.intensity = Math.max(0.4, (mY / distance) * 0.8); // Notte luminosa
    }
    sunLight.target = player.mesh; // La luce punta sempre al giocatore

    // 3. COLORI, NEBBIA E STELLE (Come prima)
    let targetColor = new THREE.Color();
    let targetNear = 80;
    let targetFar = 300; // Aumentato per non nascondere gli astri

    if (sY > -50 && sY < 50) { 
        // ALBA / TRAMONTO (Transizione arancio)
        const t = (sY + 50) / 100; // t va da 0 a 1
        targetColor.lerpColors(new THREE.Color(0xff7e5f), new THREE.Color(0x87ceeb), t);
        targetNear = 15; // Morning Fog
        targetFar = 120;
    } else if (sY >= 50) { 
        // GIORNO PIENO
        targetColor.set(0x87ceeb);
        targetNear = 100;
        targetFar = 400;
    } else { 
        // NOTTE
        targetColor.set(0x1a1a2e);
        targetNear = 50;
        targetFar = 250;
    }

    scene.background.copy(targetColor, 0.05);
    scene.fog.color.copy(targetColor, 0.05);
    scene.fog.near = THREE.MathUtils.lerp(scene.fog.near, targetNear, 0.02);
    scene.fog.far = THREE.MathUtils.lerp(scene.fog.far, targetFar, 0.02);

    // Visibilità stelle
    starField.position.copy(player.mesh.position);
    starField.material.opacity = (sY < 0) ? 1 : 0;
}

animate();