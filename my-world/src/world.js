import * as THREE from 'three';
import Delaunator from 'delaunator';
import { createNoise2D } from 'simplex-noise';

import { createTree, createRock, createDeadTree, createVolcanicRock, createSwampTree, createCactus } from './objects.js';

const noise2D = createNoise2D();
const biomeNoise = createNoise2D();
const detailNoise = createNoise2D();

export const CHUNK_SIZE = 50;
export const RENDER_DISTANCE = 2;
const POINTS_PER_CHUNK = 200;
const SAMPLES_PER_EDGE = 10;

export const loadedChunks = new Map();
export const visitedChunks = new Map();
export const worldDataMap = new Map();

export let worldTriangles = new Map();

export const SIZE = 150;
const NUM_POINTS = 800;

const terrainMat = new THREE.MeshPhongMaterial({ vertexColors: true, flatShading: true });
const waterMat   = new THREE.MeshPhongMaterial({ color: 0x00aaff, transparent: true, opacity: 0.6, shininess: 80 });
const wireMat    = new THREE.MeshBasicMaterial({ color: 0x000000, wireframe: true, transparent: true, opacity: 0.15 });

// Lava material (animated in main.js via userData)
export const lavaMat = new THREE.MeshPhongMaterial({ color: 0xff4500, emissive: 0xff2200, emissiveIntensity: 0.6, transparent: true, opacity: 0.85 });

// Swamp water
const swampWaterMat = new THREE.MeshPhongMaterial({ color: 0x3a5f3a, transparent: true, opacity: 0.75, shininess: 20 });

const chunkQueue = [];

// ---------------------------------------------------------------------------
// BIOMI
// ---------------------------------------------------------------------------
export const getBiomeData = (x, z) => {
    const scale = 0.0015; // Scala per estensione biomi (più piccolo = biomi più grandi)
    
    // Asse 1: Elevazione/Temperatura (v)
    const e = biomeNoise(x * scale, z * scale);
    
    // Asse 2: Umidità (m) - sfasato di 10000 per non essere identico al primo
    const m = biomeNoise(x * scale + 10000, z * scale + 10000);

    // --- LOGICA OCEANO (Basata su elevazione molto bassa) ---
    if (e < -0.45) return { type: 'OCEANO', heightMult: 0.15, color: 0x3366ff, treeProb: 0 };

    // --- MAPPA DEI BIOMI A DUE VARIABILI ---
    
    // ZONA BASSA (Pianure, Paludi, Deserti)
    if (e < 0.2) {
        if (m < -0.2) return { type: 'DESERTO', heightMult: 0.5, color: 0xd4af37, cactusProb: 0.03 };
        if (m < 0.3)  return { type: 'PIANURA', heightMult: 0.7, color: 0x7cfc00, treeProb: 0.02 };
        return { type: 'PALUDE', heightMult: 0.3, color: 0x4a6741, treeProb: 0.08, swamp: true };
    }

    // ZONA MEDIA (Foreste, Tundra)
    if (e < 0.6) {
        // Qui inseriamo la logica dell'altopiano forestale
        const elev = noise2D(x * 0.001, z * 0.001);
        if (m > 0) return { 
            type: 'FORESTA', 
            heightMult: 1.1, color: 0x228b22, 
            treeProb: 0.15, elevationFactor: elev 
        };
        return { type: 'TUNDRA', heightMult: 1.0, color: 0xdce8ee, treeProb: 0.02 };
    }

    // ZONA ALTA (Montagne, Vulcani)
    if (e < 0.85) return { type: 'MONTAGNA', heightMult: 2.2, color: 0x888888, treeProb: 0.01 };
    
    return { type: 'VULCANO', heightMult: 2.8, color: 0x2a2a2a, treeProb: 0, volcanic: true };
};


// ---------------------------------------------------------------------------
// ALTEZZA
// ---------------------------------------------------------------------------
export const getHeight = (x, z) => {
    const biome = getBiomeData(x, z);
    
    // Rumore base più "morbido" per pianure più ampie
    const base = noise2D(x * 0.015, z * 0.015);
    const fine = detailNoise(x * 0.05, z * 0.05) * 0.2;
    const baseScale = 12;
    
    let y = (base + fine + 1) * baseScale * biome.heightMult;

    // Gestione Altopiano Forestale (Smoothstep)
    if (biome.type === 'FORESTA') {
        const t = Math.max(0, Math.min(1, (biome.elevationFactor - 0.1) / 0.4));
        const smoothStep = t * t * (3 - 2 * t);
        const low = y * 0.7;
        const high = y * 1.5 + 7;
        y = low + (high - low) * smoothStep;
    }

    // Correzione per Oceano: non deve mai superare il livello del mare
    if (biome.type === 'OCEANO') y = Math.min(y, 4.5);
    
    // Correzione Palude: sempre molto piatta
    if (biome.type === 'PALUDE') y = Math.min(y, 5.2);

    return y;
};

// ---------------------------------------------------------------------------
// CREATE WORLD (chunk statico iniziale — opzionale)
// ---------------------------------------------------------------------------
export function createWorld(sceneGroup) {
    const points = [];
    for (let i = 0; i < NUM_POINTS; i++) {
        points.push([Math.random() * SIZE - SIZE / 2, Math.random() * SIZE - SIZE / 2]);
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
    geometry.setAttribute('color',    new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    const terrain = new THREE.Mesh(geometry, new THREE.MeshPhongMaterial({ vertexColors: true, flatShading: true }));
    sceneGroup.add(terrain);

    worldTriangles.clear();

    for (let i = 0; i < delaunay.triangles.length; i += 3) {
        const i1 = delaunay.triangles[i];
        const i2 = delaunay.triangles[i + 1];
        const i3 = delaunay.triangles[i + 2];

        const v1 = { x: points[i1][0], z: points[i1][1] };
        const v2 = { x: points[i2][0], z: points[i2][1] };
        const v3 = { x: points[i3][0], z: points[i3][1] };

        const h1 = getPreciseHeight(v1.x, v1.z);
        const h2 = getPreciseHeight(v2.x, v2.z);
        const h3 = getPreciseHeight(v3.x, v3.z);

        const cx = (v1.x + v2.x + v3.x) / 3;
        const cz = (v1.z + v2.z + v3.z) / 3;
        const cy = (h1 + h2 + h3) / 3;
        const biome = getBiomeData(cx, cz);

        if (cy > 4.0) {
            const rand = Math.random();
            if (rand < biome.treeProb) {
                const tree = biome.type === 'TUNDRA'   ? createDeadTree()
                           : biome.type === 'PALUDE'   ? createSwampTree()
                           : createTree();
                tree.position.set(cx, cy, cz);
                tree.rotation.y = Math.random() * Math.PI;
                sceneGroup.add(tree);
            } else if (rand < biome.treeProb + biome.rockProb) {
                const rock = biome.volcanic ? createVolcanicRock() : createRock();
                rock.position.set(cx, cy, cz);
                rock.rotation.set(Math.random(), Math.random(), Math.random());
                sceneGroup.add(rock);
            } else if (rand < biome.cactusProb) {
                const cactus = createCactus();
                cactus.position.set(cx, cy, cz);
                cactus.rotation.set(Math.random(), Math.random(), Math.random());
                sceneGroup.add(cactus);
            }
        }
    }
}

// ---------------------------------------------------------------------------
// PRECISE HEIGHT (barycentric)
// ---------------------------------------------------------------------------
export function getPreciseHeight(x, z) {
    const nearby = getNearbyTriangles({ x, z });

    let best = null;
    let bestDist = Infinity;

    for (const tri of nearby) {
        if (isPointInTriangle(x, z, tri.p1, tri.p2, tri.p3)) {
            const h = barycentricInterpolation(x, z, tri.p1, tri.p2, tri.p3);

            const vA = new THREE.Vector3(tri.p1.x, tri.p1.y, tri.p1.z);
            const vB = new THREE.Vector3(tri.p2.x, tri.p2.y, tri.p2.z);
            const vC = new THREE.Vector3(tri.p3.x, tri.p3.y, tri.p3.z);

            const normal = new THREE.Vector3()
                .crossVectors(vB.clone().sub(vA), vC.clone().sub(vA))
                .normalize();

            const dx = (tri.p1.x + tri.p2.x + tri.p3.x) / 3 - x;
            const dz = (tri.p1.z + tri.p2.z + tri.p3.z) / 3 - z;
            const dist = dx * dx + dz * dz;

            if (dist < bestDist) {
                bestDist = dist;
                best = { height: h, normal };
            }
        }
    }

    if (best) return best;
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
    if (Math.abs(det) < 1e-6) return p1.y;
    const l1 = ((p2.z - p3.z) * (px - p3.x) + (p3.x - p2.x) * (pz - p3.z)) / det;
    const l2 = ((p3.z - p1.z) * (px - p3.x) + (p1.x - p3.x) * (pz - p3.z)) / det;
    const l3 = 1 - l1 - l2;
    return l1 * p1.y + l2 * p2.y + l3 * p3.y;
}

// ---------------------------------------------------------------------------
// UPDATE WORLD (streaming chunks)
// ---------------------------------------------------------------------------
export function updateWorld(playerPos, sceneGroup) {
    const pX = Math.floor(playerPos.x / CHUNK_SIZE);
    const pZ = Math.floor(playerPos.z / CHUNK_SIZE);

    const activeKeys = new Set();

    for (let x = -RENDER_DISTANCE; x <= RENDER_DISTANCE; x++) {
        for (let z = -RENDER_DISTANCE; z <= RENDER_DISTANCE; z++) {
            const key = `${pX + x},${pZ + z}`;
            activeKeys.add(key);
            if (!loadedChunks.has(key) && !chunkQueue.includes(key)) {
                chunkQueue.push(key);
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

    for (const [key, chunkGroup] of loadedChunks) {
        if (!activeKeys.has(key)) {
            sceneGroup.remove(chunkGroup);
            chunkGroup.traverse((obj) => {
                if (obj.isMesh) obj.geometry.dispose();
            });
            loadedChunks.delete(key);
            worldTriangles.delete(key);
        }
    }
}

// ---------------------------------------------------------------------------
// CREATE CHUNK
// ---------------------------------------------------------------------------
function createChunk(cx, cz) {
    const points = [];
    const chunkGroup = new THREE.Group();
    const chunkTriangles = [];
    const offsetX = cx * CHUNK_SIZE;
    const offsetZ = cz * CHUNK_SIZE;

    // Minimap data
    const resolution = 10;
    const gridData = [];
    const step = CHUNK_SIZE / resolution;
    for (let i = 0; i < resolution; i++) {
        for (let j = 0; j < resolution; j++) {
            const sampleX = offsetX + i * step;
            const sampleZ = offsetZ + j * step;
            gridData.push({ h: getHeight(sampleX, sampleZ), color: getBiomeData(sampleX, sampleZ).color });
        }
    }
    worldDataMap.set(`${cx},${cz}`, gridData);

    // Bordi + punti interni
    for (let i = 0; i <= SAMPLES_PER_EDGE; i++) {
        const t = (i / SAMPLES_PER_EDGE) * CHUNK_SIZE;
        points.push([offsetX, offsetZ + t]);
        points.push([offsetX + CHUNK_SIZE, offsetZ + t]);
        points.push([offsetX + t, offsetZ]);
        points.push([offsetX + t, offsetZ + CHUNK_SIZE]);
    }
    for (let i = 0; i < POINTS_PER_CHUNK; i++) {
        points.push([offsetX + Math.random() * CHUNK_SIZE, offsetZ + Math.random() * CHUNK_SIZE]);
    }

    const delaunay = Delaunator.from(points);
    const vertices = [];
    const colors   = [];

    // Campiona il bioma dominante del chunk
    const chunkCenterX = offsetX + CHUNK_SIZE / 2;
    const chunkCenterZ = offsetZ + CHUNK_SIZE / 2;
    const dominantBiome = getBiomeData(chunkCenterX, chunkCenterZ);

    for (let i = 0; i < delaunay.triangles.length; i += 3) {
        const i1 = delaunay.triangles[i];
        const i2 = delaunay.triangles[i + 1];
        const i3 = delaunay.triangles[i + 2];

        const pts = [points[i1], points[i2], points[i3]];
        const triCoords = pts.map(p => {
            const y = getHeight(p[0], p[1]);
            return { x: p[0], y, z: p[1] };
        });

        triCoords.forEach(v => {
            vertices.push(v.x, v.y, v.z);

            // Colore per vertice in base al bioma locale
            let col = new THREE.Color(getBiomeData(v.x, v.z).color);

            // Tundra: sfumatura blu-ghiaccio sulle cime
            if (getBiomeData(v.x, v.z).type === 'TUNDRA' && v.y > 12) {
                col.lerp(new THREE.Color(0xffffff), 0.5);
            }
            // Vulcano: incandescenza sulle pareti alte
            if (getBiomeData(v.x, v.z).type === 'VULCANO' && v.y > 20) {
                col.lerp(new THREE.Color(0xff3300), 0.4);
            }
            // Palude: tono più scuro in basso
            if (getBiomeData(v.x, v.z).type === 'PALUDE' && v.y < 4) {
                col.lerp(new THREE.Color(0x1a3a1a), 0.5);
            }

            colors.push(col.r, col.g, col.b);
        });

        chunkTriangles.push({ p1: triCoords[0], p2: triCoords[1], p3: triCoords[2] });
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.setAttribute('color',    new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const mesh = new THREE.Mesh(geo, terrainMat);
    chunkGroup.add(mesh);

    const wireframe = new THREE.Mesh(geo, wireMat);
    wireframe.scale.set(1.0005, 1.0005, 1.0005);
    chunkGroup.add(wireframe);

    // --- ACQUA/LAVA/PALUDE ---
    const waterGeo = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE);

    let surfaceMat = waterMat;
    let surfaceY   = 3.5;
    let isLava     = false;
    let isSwamp    = false;

    if (dominantBiome.type === 'VULCANO') {
        surfaceMat = lavaMat;
        surfaceY   = 6.0;
        isLava     = true;
    } else if (dominantBiome.type === 'PALUDE') {
        surfaceMat = swampWaterMat;
        surfaceY   = 3.5;
        isSwamp    = true;
    }

    const surface = new THREE.Mesh(waterGeo, surfaceMat);
    surface.rotation.x = -Math.PI / 2;
    surface.position.set(offsetX + CHUNK_SIZE / 2, surfaceY, offsetZ + CHUNK_SIZE / 2);
    surface.userData.isWater  = !isLava;
    surface.userData.isLava   = isLava;
    surface.userData.isSwamp  = isSwamp;
    chunkGroup.add(surface);

    // --- OGGETTI ---
    chunkTriangles.forEach(tri => {
        const tcx = (tri.p1.x + tri.p2.x + tri.p3.x) / 3;
        const tcz = (tri.p1.z + tri.p2.z + tri.p3.z) / 3;
        const tcy = (tri.p1.y + tri.p2.y + tri.p3.y) / 3;
        const biome = getBiomeData(tcx, tcz);

        if (tcy > 4.0) {
            const rand = Math.random();
            if (rand < biome.treeProb) {
                let tree;
                if (biome.type === 'TUNDRA')      tree = createDeadTree();
                else if (biome.type === 'PALUDE')  tree = createSwampTree();
                else                               tree = createTree();

                tree.position.set(tcx, tcy, tcz);
                tree.rotation.y = Math.random() * Math.PI * 2;
                chunkGroup.add(tree);
            } else if (rand < biome.treeProb + biome.rockProb) {
                const rock = biome.volcanic ? createVolcanicRock() : createRock();
                rock.position.set(tcx, tcy, tcz);
                rock.rotation.set(Math.random(), Math.random(), Math.random());
                chunkGroup.add(rock);
            } else if (rand < biome.cactusProb) {
                const cactus = createCactus();
                cactus.position.set(tcx, tcy, tcz);
                cactus.rotation.set(Math.random(), Math.random(), Math.random());
                chunkGroup.add(cactus);
            }
        }
    });

    worldTriangles.set(`${cx},${cz}`, chunkTriangles);
    return chunkGroup;
}

// ---------------------------------------------------------------------------
// NEARBY TRIANGLES (per collisioni player)
// ---------------------------------------------------------------------------
export function getNearbyTriangles(pos) {
    const result = [];
    for (const chunkArray of worldTriangles.values()) {
        if (!Array.isArray(chunkArray)) continue;
        for (const tri of chunkArray) {
            const tcx = (tri.p1.x + tri.p2.x + tri.p3.x) / 3;
            const tcz = (tri.p1.z + tri.p2.z + tri.p3.z) / 3;
            const dx = tcx - pos.x;
            const dz = tcz - pos.z;
            if (dx * dx + dz * dz < 25) result.push(tri);
        }
    }
    return result;
}

// ---------------------------------------------------------------------------
// UTILITY: biome al punto (esposta per nemici, combat, ecc.)
// ---------------------------------------------------------------------------
export { getBiomeData as getBiome };