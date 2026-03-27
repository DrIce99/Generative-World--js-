import * as THREE from 'three';
import Delaunator from 'delaunator';
import { createNoise2D } from 'simplex-noise';

import { createTree, createRock } from './objects.js';

const noise2D = createNoise2D();
const biomeNoise = createNoise2D();

export const CHUNK_SIZE = 50;
export const RENDER_DISTANCE = 2;
const POINTS_PER_CHUNK = 200;
const SAMPLES_PER_EDGE = 10;   // Quanti punti fissi mettere sui bordi

export const loadedChunks = new Map();
export const visitedChunks = new Map();
export const worldDataMap = new Map();

export let worldTriangles = [];

export const SIZE = 150;
const NUM_POINTS = 800;

const terrainMat = new THREE.MeshPhongMaterial({ vertexColors: true, flatShading: true });
const waterMat = new THREE.MeshPhongMaterial({ color: 0x00aaff, transparent: true, opacity: 0.6, shininess: 80 });
const wireMat = new THREE.MeshBasicMaterial({ color: 0x000000, wireframe: true, transparent: true, opacity: 0.15 });

const chunkQueue = []; // Coda dei chunk da generare

export const getBiomeData = (x, z) => {
    const v = biomeNoise(x * 0.01, z * 0.01);
    if (v < -0.3) return { type: 'OCEANO', heightMult: 0.2, color: 0x3366ff, treeProb: 0 };
    if (v < 0.1)  return { type: 'DESERTO', heightMult: 0.5, color: 0xd4af37, treeProb: 0, rockProb: 0.02 };
    if (v < 0.6)  return { type: 'FORESTA', heightMult: 1.2, color: 0x228b22, treeProb: 0.1, rockProb: 0.01 };
    return { type: 'MONTAGNA', heightMult: 2.5, color: 0x888888, treeProb: 0.02, rockProb: 0.05 };
};

export const getHeight = (x, z) => {
    const biome = getBiomeData(x, z);
    const detail = noise2D(x * 0.02, z * 0.02);
    let y = (detail + 1) * 5 * biome.heightMult;
    if (biome.type === 'DESERTO') y += Math.sin(x * 0.1) * 0.5;
    return y;
};

export function createWorld(sceneGroup) {
    // --- 1. ACQUA ---
    // const waterGeo = new THREE.PlaneGeometry(SIZE, SIZE);
    // const waterMat = new THREE.MeshPhongMaterial({
    //     color: 0x00aaff,
    //     transparent: true,
    //     opacity: 0.6,
    //     shininess: 80
    // });
    // const water = new THREE.Mesh(waterGeo, waterMat);
    // water.rotation.x = -Math.PI / 2;
    // water.position.y = 3.5;
    // sceneGroup.add(water);

    // --- 2. TERRENO ---
    const points = [];
    for (let i = 0; i < NUM_POINTS; i++) {
        points.push([Math.random() * SIZE - SIZE/2, Math.random() * SIZE - SIZE/2]);
    }

    const delaunay = Delaunator.from(points);
    const vertices = [];
    const colors = [];

    for (let i = 0; i < delaunay.triangles.length; i++) {
        const pIndex = delaunay.triangles[i];
        const x = points[pIndex][0];
        const z = points[pIndex][1];
        const y = getPreciseHeight(x, z).height;
        vertices.push(x, y, z);
        const c = new THREE.Color(getBiomeData(x, z).color);
        colors.push(c.r, c.g, c.b);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    const terrain = new THREE.Mesh(geometry, new THREE.MeshPhongMaterial({ 
        vertexColors: true, 
        flatShading: true 
    }));
    sceneGroup.add(terrain);

    // --- 3. WIREFRAME (STROKE) ---
    const wireframeMat = new THREE.MeshBasicMaterial({ 
        color: 0x000000, 
        wireframe: true, 
        transparent: true, 
        opacity: 0.2 
    });
    const wireframe = new THREE.Mesh(geometry, wireframeMat);
    wireframe.scale.set(1.001, 1.001, 1.001);
    // terrain.add(wireframe);

    worldTriangles = [];

    // --- 4. OGGETTI ---
    for (let i = 0; i < delaunay.triangles.length; i += 3) {
        const i1 = delaunay.triangles[i];
        const i2 = delaunay.triangles[i + 1];
        const i3 = delaunay.triangles[i + 2];

        // const p1 = { x: points[i1][0], z: points[i1][1], y: getHeight(points[i1][0], points[i1][1]) };
        // const p2 = { x: points[i2][0], z: points[i2][1], y: getHeight(points[i2][0], points[i2][1]) };
        // const p3 = { x: points[i3][0], z: points[i3][1], y: getHeight(points[i3][0], points[i3][1]) };

        const v1 = { x: points[i1][0], z: points[i1][1] };
        const v2 = { x: points[i2][0], z: points[i2][1] };
        const v3 = { x: points[i3][0], z: points[i3][1] };

        const h1 = getPreciseHeight(v1.x, v1.z);
        const h2 = getPreciseHeight(v2.x, v2.z);
        const h3 = getPreciseHeight(v3.x, v3.z);

        // Salviamo i dati dei vertici per ogni triangolo
        worldTriangles.push({
            p1: { ...v1, y: h1 },
            p2: { ...v2, y: h2 },
            p3: { ...v3, y: h3 }
        });

        const cx = (v1.x + v2.x + v3.x) / 3;
        const cz = (v1.z + v2.z + v3.z) / 3;
        const cy = (h1 + h2 + h3) / 3;
        const biome = getBiomeData(cx, cz);

        if (cy > 4.0) { // Un po' più alto dell'acqua (3.5)
            const rand = Math.random();
            if (rand < biome.treeProb) {
                const tree = createTree();
                tree.position.set(cx, cy, cz);
                // Ruota l'albero casualmente per varietà
                tree.rotation.y = Math.random() * Math.PI; 
                sceneGroup.add(tree);
            } else if (rand < biome.treeProb + biome.rockProb) {
                const rock = createRock();
                rock.position.set(cx, cy, cz);
                rock.rotation.set(Math.random(), Math.random(), Math.random());
                sceneGroup.add(rock);
            }
        }
    }
}

// funzione per l'altezza precisa sulla superficie
export function getPreciseHeight(x, z) {
    for (const tri of worldTriangles) {
        if (isPointInTriangle(x, z, tri.p1, tri.p2, tri.p3)) {
            const h = barycentricInterpolation(x, z, tri.p1, tri.p2, tri.p3);
            
            if (!isFinite(h)) {
                return { height: getHeight(x, z), normal: new THREE.Vector3(0, 1, 0) };
            }

            // Calcolo veloce della normale del triangolo
            const vA = new THREE.Vector3(tri.p1.x, tri.p1.y, tri.p1.z);
            const vB = new THREE.Vector3(tri.p2.x, tri.p2.y, tri.p2.z);
            const vC = new THREE.Vector3(tri.p3.x, tri.p3.y, tri.p3.z);
            const normal = new THREE.Vector3().crossVectors(
                vB.clone().sub(vA), 
                vC.clone().sub(vA)
            ).normalize();

            return { height: h, normal: normal };
        }
    }
    return { height: getHeight(x, z), normal: new THREE.Vector3(0, 1, 0) };
}

function isPointInTriangle(px, pz, p1, p2, p3) {
    const area = 0.5 * (-p2.z * p3.x + p1.z * (p3.x - p2.x) + p1.x * (p2.z - p3.z) + p2.x * p3.z);
    const s = 1 / (2 * area) * (p1.z * p3.x - p1.x * p3.z + (p3.z - p1.z) * px + (p1.x - p3.x) * pz);
    const t = 1 / (2 * area) * (p1.x * p2.z - p1.z * p2.x + (p1.z - p2.z) * px + (p2.x - p1.x) * pz);
    return s > 0 && t > 0 && (1 - s - t) > 0;
}

function barycentricInterpolation(px, pz, p1, p2, p3) {
    const det = (p2.z - p3.z) * (p1.x - p3.x) + (p3.x - p2.x) * (p1.z - p3.z);

    if (Math.abs(det) < 1e-6) {
        return p1.y; // fallback safe
    }

    const l1 = ((p2.z - p3.z) * (px - p3.x) + (p3.x - p2.x) * (pz - p3.z)) / det;
    const l2 = ((p3.z - p1.z) * (px - p3.x) + (p1.x - p3.x) * (pz - p3.z)) / det;
    const l3 = 1 - l1 - l2;

    return l1 * p1.y + l2 * p2.y + l3 * p3.y;
}

export function updateWorld(playerPos, sceneGroup) {
    const pX = Math.floor(playerPos.x / CHUNK_SIZE);
    const pZ = Math.floor(playerPos.z / CHUNK_SIZE);

    const activeKeys = new Set();

    for (let x = -RENDER_DISTANCE; x <= RENDER_DISTANCE; x++) {
        for (let z = -RENDER_DISTANCE; z <= RENDER_DISTANCE; z++) {
            const key = `${pX + x},${pZ + z}`;
            activeKeys.add(key);
            if (!loadedChunks.has(key) && !chunkQueue.includes(key)) {
                chunkQueue.push(key); // Aggiungi alla lista d'attesa
            }
        }
    }

    if (chunkQueue.length > 0) {
        const nextKey = chunkQueue.shift();
        const [cx, cz] = nextKey.split(',').map(Number);
        const chunk = createChunk(cx, cz);
        sceneGroup.add(chunk);
        loadedChunks.set(nextKey, chunk);
    }

    // PULIZIA MEMORIA: Rimuovi chunk lontani
    for (const [key, chunkGroup] of loadedChunks) {
        if (!activeKeys.has(key)) {
            sceneGroup.remove(chunkGroup);
            chunkGroup.traverse((obj) => {
                if (obj.isMesh) obj.geometry.dispose();
                // Non facciamo il dispose dei materiali qui perché sono condivisi!
            });
            loadedChunks.delete(key);
        }
    }
}

function createChunk(cx, cz) {
    const points = [];
    const chunkGroup = new THREE.Group();
    const offsetX = cx * CHUNK_SIZE;
    const offsetZ = cz * CHUNK_SIZE;

    const resolution = 10; // 10x10 punti di dettaglio per ogni chunk
    const gridData = [];
    const step = CHUNK_SIZE / resolution;

    for (let i = 0; i < resolution; i++) {
        for (let j = 0; j < resolution; j++) {
            const sampleX = offsetX + i * step;
            const sampleZ = offsetZ + j * step;
            const h = getHeight(sampleX, sampleZ);
            const b = getBiomeData(sampleX, sampleZ);
            gridData.push({ h, color: b.color });
        }
    }
    worldDataMap.set(`${cx},${cz}`, gridData);

    // 1. AGGIUNGI PUNTI SUI BORDI (Per farli combaciare)
    for (let i = 0; i <= SAMPLES_PER_EDGE; i++) {
        const t = (i / SAMPLES_PER_EDGE) * CHUNK_SIZE;
        points.push([offsetX, offsetZ + t]);              // Ovest
        points.push([offsetX + CHUNK_SIZE, offsetZ + t]); // Est
        points.push([offsetX + t, offsetZ]);              // Nord
        points.push([offsetX + t, offsetZ + CHUNK_SIZE]); // Sud
    }

    // 2. AGGIUNGI PUNTI CASUALI INTERNI
    for (let i = 0; i < POINTS_PER_CHUNK; i++) {
        points.push([
            offsetX + Math.random() * CHUNK_SIZE,
            offsetZ + Math.random() * CHUNK_SIZE
        ]);
    }

    const delaunay = Delaunator.from(points);
    const vertices = [];
    const colors = [];

    // 3. COSTRUISCI MESH
    for (let i = 0; i < delaunay.triangles.length; i++) {
        const pIdx = delaunay.triangles[i];
        const x = points[pIdx][0];
        const z = points[pIdx][1];
        const y = getPreciseHeight(x, z).height;

        vertices.push(x, y, z);
        const c = new THREE.Color(getBiomeData(x, z).color);
        colors.push(c.r, c.g, c.b);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const mesh = new THREE.Mesh(geo, terrainMat);
    chunkGroup.add(mesh);

    // 2. Creiamo una mesh che usa la STESSA geometria del terreno
    const wireframe = new THREE.Mesh(geo, wireMat);

    // 3. Trick del "Z-fighting": lo scagliamo leggermente più grande
    wireframe.scale.set(1.0005, 1.0005, 1.0005);

    // 4. Lo aggiungiamo al gruppo del chunk
    chunkGroup.add(wireframe);

    // --- C. ACQUA DEL CHUNK ---
    const waterGeo = new THREE.PlaneGeometry(CHUNK_SIZE - 0.05, CHUNK_SIZE - 0.05);
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.userData.isWater = true;
    water.rotation.x = -Math.PI / 2;
    // Posizioniamo l'acqua al centro del chunk
    water.position.set(offsetX + CHUNK_SIZE / 2, 3.5, offsetZ + CHUNK_SIZE / 2);
    chunkGroup.add(water);

    // --- D. OGGETTI (ALBERI E ROCCE) ---
    // Usiamo una logica di probabilità basata sul noise del bioma nel chunk
    for (let i = 0; i < delaunay.triangles.length; i += 3) {
        const i1 = delaunay.triangles[i];
        const i2 = delaunay.triangles[i+1];
        const i3 = delaunay.triangles[i+2];
        
        const cx_obj = (points[i1][0] + points[i2][0] + points[i3][0]) / 3;
        const cz_obj = (points[i1][1] + points[i2][1] + points[i3][1]) / 3;
        const cy_obj = (
            getPreciseHeight(points[i1][0], points[i1][1]).height +
            getPreciseHeight(points[i2][0], points[i2][1]).height +
            getPreciseHeight(points[i3][0], points[i3][1]).height
        ) / 3;

        const biome = getBiomeData(cx_obj, cz_obj);

        if (cy_obj > 4.0) { // Solo fuori dall'acqua
            const rand = Math.random();
            if (rand < biome.treeProb) {
                const tree = createTree();
                tree.position.set(cx_obj, cy_obj, cz_obj);
                chunkGroup.add(tree);
            } else if (rand < biome.treeProb + biome.rockProb) {
                const rock = createRock();
                rock.position.set(cx_obj, cy_obj, cz_obj);
                chunkGroup.add(rock);
            }
        }
    }

    return chunkGroup;
}