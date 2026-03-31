// main.js

import * as THREE from 'three';
import { createWorld, updateWorld, worldDataMap, CHUNK_SIZE, loadedChunks, lavaMat, getBiomeData, getHeight } from './world.js';
import { Player } from './player.js';
import { EnemySpawner } from './enemies.js';
import { getBiome } from './world.js';

// ────────────────────────────────────────────────────────────────────────────
// SCENE SETUP
// ────────────────────────────────────────────────────────────────────────────
const scene    = new THREE.Scene();
const camera   = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

const sceneGroup = new THREE.Group();
scene.add(sceneGroup);

// Nebbia
const fogColor = new THREE.Color(0x1a1a1a);
scene.fog        = new THREE.Fog(fogColor, 50, 150);
scene.background = new THREE.Color(fogColor);

// ────────────────────────────────────────────────────────────────────────────
// MINIMAP
// ────────────────────────────────────────────────────────────────────────────
const minimapCanvas = document.getElementById('minimap');
const ctx = minimapCanvas.getContext('2d');
minimapCanvas.width  = 200;
minimapCanvas.height = 200;

// ────────────────────────────────────────────────────────────────────────────
// LUCI
// ────────────────────────────────────────────────────────────────────────────
const sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
scene.add(sunLight);

const ambientLight = new THREE.AmbientLight(0x404040, 0.8);
scene.add(ambientLight);

// Punto luce per effetto lava (aggiornato dinamicamente)
const lavaGlow = new THREE.PointLight(0xff4400, 0, 30);
scene.add(lavaGlow);

// ────────────────────────────────────────────────────────────────────────────
// CORPI CELESTI & STELLE
// ────────────────────────────────────────────────────────────────────────────
let dayTime = 0;
const dayDuration = 0.00005;

const sunMesh  = new THREE.Mesh(new THREE.SphereGeometry(10, 16, 16), new THREE.MeshBasicMaterial({ color: 0xffdd00 }));
const moonMesh = new THREE.Mesh(new THREE.SphereGeometry(8, 16, 16),  new THREE.MeshBasicMaterial({ color: 0xeeeeee }));
scene.add(sunMesh);
scene.add(moonMesh);

const starGeo = new THREE.BufferGeometry();
const starPos = [];
for (let i = 0; i < 2000; i++) {
    starPos.push((Math.random() - 0.5) * 1000, Math.random() * 500 + 100, (Math.random() - 0.5) * 1000);
}
starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
const starField = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.8, transparent: true }));
scene.add(starField);

// ────────────────────────────────────────────────────────────────────────────
// PARTICELLE NEVE (Tundra)
// ────────────────────────────────────────────────────────────────────────────
const SNOW_COUNT = 600;
const snowGeo    = new THREE.BufferGeometry();
const snowPos    = new Float32Array(SNOW_COUNT * 3);
for (let i = 0; i < SNOW_COUNT; i++) {
    snowPos[i * 3]     = (Math.random() - 0.5) * 40;
    snowPos[i * 3 + 1] = Math.random() * 20;
    snowPos[i * 3 + 2] = (Math.random() - 0.5) * 40;
}
snowGeo.setAttribute('position', new THREE.Float32BufferAttribute(snowPos, 3));
const snowMat   = new THREE.PointsMaterial({ color: 0xffffff, size: 0.2, transparent: true, opacity: 0 });
const snowField = new THREE.Points(snowGeo, snowMat);
scene.add(snowField);

// ────────────────────────────────────────────────────────────────────────────
// PARTICELLE CENERE (Vulcano)
// ────────────────────────────────────────────────────────────────────────────
const ASH_COUNT = 400;
const ashGeo    = new THREE.BufferGeometry();
const ashPos    = new Float32Array(ASH_COUNT * 3);
for (let i = 0; i < ASH_COUNT; i++) {
    ashPos[i * 3]     = (Math.random() - 0.5) * 30;
    ashPos[i * 3 + 1] = Math.random() * 15;
    ashPos[i * 3 + 2] = (Math.random() - 0.5) * 30;
}
ashGeo.setAttribute('position', new THREE.Float32BufferAttribute(ashPos, 3));
const ashMat   = new THREE.PointsMaterial({ color: 0x555555, size: 0.25, transparent: true, opacity: 0 });
const ashField = new THREE.Points(ashGeo, ashMat);
scene.add(ashField);

// ────────────────────────────────────────────────────────────────────────────
// INIT
// ────────────────────────────────────────────────────────────────────────────
createWorld(sceneGroup);
const player  = new Player(scene, camera);

// Enemy spawner (usa il combat controller del player)
const spawner = new EnemySpawner(scene, player.combat);

// ────────────────────────────────────────────────────────────────────────────
// ANIMATE
// ────────────────────────────────────────────────────────────────────────────
let lastTime = performance.now();

function animate(time) {
    requestAnimationFrame(animate);

    const now = performance.now();
    const dt  = Math.min((now - lastTime) / 1000, 0.05);
    lastTime  = now;

    // ── Acqua animata ──────────────────────────────────────────────
    loadedChunks.forEach(chunkGroup => {
        // 1. Controllo sicurezza: il chunkGroup deve esistere e avere figli
        if (chunkGroup && chunkGroup.children) {
            chunkGroup.children.forEach(c => {
                // 2. Usiamo i metadati impostati durante la creazione del chunk
                if (c.userData.isWater) {
                    // Acqua: oscillazione standard
                    c.position.y = 3.5 + Math.sin(time * 0.002 + c.position.x) * 0.15;
                }
                else if (c.userData.isSwamp) {
                    // Palude: movimento più lento e denso
                    c.position.y = 3.8 + Math.sin(time * 0.001 + c.position.z) * 0.05;
                }
                else if (c.userData.isLava) {
                    // Lava: onde pesanti e lente
                    c.position.y = 6.0 + Math.sin(time * 0.0008 + c.position.x) * 0.2;
                }
            });
        }
    });

    // ── Lava material pulsazione ──────────────────────────────────
    lavaMat.emissiveIntensity = 0.5 + Math.sin(time * 0.002) * 0.2;

    // ── Player update ─────────────────────────────────────────────
    player.update();

    // ── Danno da lava al player ───────────────────────────────────
    const playerBiome = getBiomeData(player.mesh.position.x, player.mesh.position.z);
    if (playerBiome.type === 'VULCANO' && player.mesh.position.y < 7.5) {
        if (Math.floor(time / 1000) !== Math.floor((time - dt * 1000) / 1000)) {
            player.combat.takeDamage(5); // 5 danno/secondo nella lava
        }
    }

    // ── World chunk streaming ─────────────────────────────────────
    updateWorld(player.mesh.position, sceneGroup);

    // ── Enemy spawning & AI ───────────────────────────────────────
    spawner.updateSpawns(loadedChunks, getBiomeData, getHeight, CHUNK_SIZE);
    spawner.updateEnemies(dt, player.mesh.position, camera);

    // ── Ambiente (sole/luna/nebbia) ────────────────────────────────
    updateEnvironment(dt, time);

    // ── Particelle bioma ──────────────────────────────────────────
    updateBiomeParticles(dt, time);

    // ── Minimap ───────────────────────────────────────────────────
    drawMinimap(player);

    // ── Camera terza persona ──────────────────────────────────────
    const dist = 6;
    const camOffset = new THREE.Vector3(
        Math.sin(player.rotationY) * Math.cos(player.rotationX) * dist,
        Math.sin(player.rotationX) * dist + 2,
        Math.cos(player.rotationY) * Math.cos(player.rotationX) * dist
    );
    camera.position.copy(player.mesh.position.clone().add(camOffset));
    camera.lookAt(player.mesh.position.clone().add(new THREE.Vector3(0, 2, 0)));

    renderer.render(scene, camera);
}

// ────────────────────────────────────────────────────────────────────────────
// ENVIRONMENT
// ────────────────────────────────────────────────────────────────────────────
function updateEnvironment(dt, time) {
    dayTime += dayDuration;
    if (dayTime > 2) dayTime = 0;

    const angle    = dayTime * Math.PI;
    const distance = 300;

    const sX = Math.cos(angle) * distance;
    const sY = Math.sin(angle) * distance;
    const mX = Math.cos(angle + Math.PI) * distance;
    const mY = Math.sin(angle + Math.PI) * distance;

    sunMesh.position.set( player.mesh.position.x + sX, player.mesh.position.y + sY, player.mesh.position.z);
    moonMesh.position.set(player.mesh.position.x + mX, player.mesh.position.y + mY, player.mesh.position.z);

    if (sY > 0) {
        sunLight.position.copy(sunMesh.position);
        sunLight.intensity = Math.max(0.2, (sY / distance) * 1.5);
    } else {
        sunLight.position.copy(moonMesh.position);
        sunLight.intensity = Math.max(0.4, (mY / distance) * 0.8);
    }
    sunLight.target = player.mesh;

    let targetColor = new THREE.Color();
    let targetNear  = 80, targetFar = 300;

    if (sY > -50 && sY < 50) {
        const t = (sY + 50) / 100;
        targetColor.lerpColors(new THREE.Color(0xff7e5f), new THREE.Color(0x87ceeb), t);
        targetNear = 15; targetFar = 120;
    } else if (sY >= 50) {
        targetColor.set(0x87ceeb);
        targetNear = 100; targetFar = 400;
    } else {
        targetColor.set(0x1a1a2e);
        targetNear = 50; targetFar = 250;
    }

    scene.background.lerp(targetColor, 0.05);
    scene.fog.color.copy(scene.background);
    scene.fog.near = THREE.MathUtils.lerp(scene.fog.near, targetNear, 0.02);
    scene.fog.far  = THREE.MathUtils.lerp(scene.fog.far,  targetFar,  0.02);

    starField.position.copy(player.mesh.position);
    starField.material.opacity = (sY < 0) ? 1 : 0;
}

// ────────────────────────────────────────────────────────────────────────────
// BIOME PARTICLES
// ────────────────────────────────────────────────────────────────────────────
function updateBiomeParticles(dt, time) {
    const biome = getBiomeData(player.mesh.position.x, player.mesh.position.z);

    // Neve (Tundra)
    snowField.position.copy(player.mesh.position);
    snowMat.opacity = biome.type === 'TUNDRA' ? 0.7 : 0;
    if (biome.type === 'TUNDRA') {
        const arr = snowGeo.attributes.position.array;
        for (let i = 0; i < SNOW_COUNT; i++) {
            arr[i * 3 + 1] -= dt * 2;
            if (arr[i * 3 + 1] < -2) arr[i * 3 + 1] = 20;
            arr[i * 3] += Math.sin(time * 0.001 + i) * 0.01;
        }
        snowGeo.attributes.position.needsUpdate = true;
    }

    // Cenere (Vulcano)
    ashField.position.copy(player.mesh.position);
    ashMat.opacity = biome.type === 'VULCANO' ? 0.5 : 0;
    if (biome.type === 'VULCANO') {
        const arr = ashGeo.attributes.position.array;
        for (let i = 0; i < ASH_COUNT; i++) {
            arr[i * 3 + 1] -= dt * 0.8;
            if (arr[i * 3 + 1] < -2) arr[i * 3 + 1] = 15;
            arr[i * 3] += (Math.random() - 0.5) * 0.05;
        }
        ashGeo.attributes.position.needsUpdate = true;

        // Glow lava
        lavaGlow.position.set(player.mesh.position.x, 7, player.mesh.position.z);
        lavaGlow.intensity = 3 + Math.sin(time * 0.003) * 1.5;
    } else {
        lavaGlow.intensity = 0;
    }
}

// ────────────────────────────────────────────────────────────────────────────
// MINIMAP
// ────────────────────────────────────────────────────────────────────────────
function drawMinimap(player) {
    ctx.clearRect(0, 0, 200, 200);
    const mapScale = 0.5;
    const pX = player.mesh.position.x;
    const pZ = player.mesh.position.z;
    const res = 10;
    const pixelSize = (CHUNK_SIZE / res) * mapScale;

    worldDataMap.forEach((gridData, key) => {
        const [cx, cz] = key.split(',').map(Number);
        const offsetX  = cx * CHUNK_SIZE;
        const offsetZ  = cz * CHUNK_SIZE;

        gridData.forEach((data, index) => {
            const i = Math.floor(index / res);
            const j = index % res;
            const drawX = 100 + (offsetX + i * (CHUNK_SIZE / res) - pX) * mapScale;
            const drawZ = 100 + (offsetZ + j * (CHUNK_SIZE / res) - pZ) * mapScale;

            if (Math.hypot(drawX - 100, drawZ - 100) > 95) return;

            let color = new THREE.Color(data.color);
            if (data.h > 12) color.lerp(new THREE.Color(0xffffff), 0.3);
            if (data.h < 3.5) color.lerp(new THREE.Color(0x000033), 0.2);

            ctx.fillStyle = `#${color.getHexString()}`;
            ctx.fillRect(drawX, drawZ, pixelSize + 0.5, pixelSize + 0.5);
        });
    });

    // Nemici sulla minimap
    for (const enemy of player.combat.enemies) {
        if (!enemy.alive) continue;
        const ex = 100 + (enemy.mesh.position.x - pX) * mapScale;
        const ez = 100 + (enemy.mesh.position.z - pZ) * mapScale;
        if (Math.hypot(ex - 100, ez - 100) > 95) continue;
        ctx.fillStyle = '#ff4444';
        ctx.beginPath();
        ctx.arc(ex, ez, 2.5, 0, Math.PI * 2);
        ctx.fill();
    }

    // Maschera circolare
    ctx.globalCompositeOperation = 'destination-in';
    ctx.beginPath();
    ctx.arc(100, 100, 95, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    // Freccia player
    ctx.save();
    ctx.translate(100, 100);
    ctx.rotate(-player.rotationY);
    ctx.fillStyle = 'white';
    ctx.shadowBlur = 5;
    ctx.shadowColor = 'black';
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(6, 7);
    ctx.lineTo(0, 3);
    ctx.lineTo(-6, 7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

animate();