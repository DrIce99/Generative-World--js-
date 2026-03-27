import * as THREE from 'three';
import Delaunator from 'delaunator';
import { createNoise2D } from 'simplex-noise';
import { createTree, createRock } from './objects.js';

const noise2D = createNoise2D();
const biomeNoise = createNoise2D();

export const SIZE = 150;
const NUM_POINTS = 800;

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
    const waterGeo = new THREE.PlaneGeometry(SIZE, SIZE);
    const waterMat = new THREE.MeshPhongMaterial({
        color: 0x00aaff,
        transparent: true,
        opacity: 0.6,
        shininess: 80
    });
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.y = 3.5;
    sceneGroup.add(water);

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
        const y = getHeight(x, z);
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
    terrain.add(wireframe);

    // --- 4. OGGETTI ---
    for (let i = 0; i < delaunay.triangles.length; i += 3) {
        const p1 = points[delaunay.triangles[i]];
        const p2 = points[delaunay.triangles[i+1]];
        const p3 = points[delaunay.triangles[i+2]];

        const cx = (p1[0] + p2[0] + p3[0]) / 3;
        const cz = (p1[1] + p2[1] + p3[1]) / 3;
        const cy = getHeight(cx, cz);
        const biome = getBiomeData(cx, cz);

        if (cy > 3.8 && Math.random() < biome.treeProb) {
            const tree = createTree();
            tree.position.set(cx, cy, cz);
            sceneGroup.add(tree);
        } else if (cy > 3.8 && Math.random() < biome.rockProb) {
            const rock = createRock();
            rock.position.set(cx, cy, cz);
            sceneGroup.add(rock);
        }
    }
}
