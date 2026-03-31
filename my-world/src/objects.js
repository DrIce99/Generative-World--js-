import * as THREE from 'three';

// ---------------------------------------------------------------------------
// ALBERO (Foresta)
// ---------------------------------------------------------------------------
export function createTree() {
    const tree = new THREE.Group();

    const trunkGeo = new THREE.CylinderGeometry(0.2, 0.25, 1.2, 6);
    const trunkMat = new THREE.MeshPhongMaterial({ color: 0x5d4037, flatShading: true });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 0.6;
    tree.add(trunk);

    // Doppio cono per più volume
    const leavesGeo1 = new THREE.ConeGeometry(1.0, 2.0, 7);
    const leavesMat  = new THREE.MeshPhongMaterial({ color: 0x2e7d32, flatShading: true });
    const leaves1 = new THREE.Mesh(leavesGeo1, leavesMat);
    leaves1.position.y = 2.2;
    tree.add(leaves1);

    const leavesGeo2 = new THREE.ConeGeometry(0.65, 1.4, 7);
    const leaves2 = new THREE.Mesh(leavesGeo2, leavesMat);
    leaves2.position.y = 3.2;
    tree.add(leaves2);

    return tree;
}

// ---------------------------------------------------------------------------
// ALBERO MORTO (Tundra)
// ---------------------------------------------------------------------------
export function createDeadTree() {
    const tree = new THREE.Group();

    const trunkMat = new THREE.MeshPhongMaterial({ color: 0x8d7b68, flatShading: true });

    // Tronco principale
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.25, 2.5, 5);
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 1.25;
    tree.add(trunk);

    // Rami storti
    const branchAngles = [0.5, -0.4, 0.3, -0.6];
    const branchHeights = [1.6, 2.0, 2.3, 1.8];
    branchAngles.forEach((angle, i) => {
        const brGeo = new THREE.CylinderGeometry(0.05, 0.08, 0.9, 4);
        const br = new THREE.Mesh(brGeo, trunkMat);
        br.position.set(Math.cos(i) * 0.15, branchHeights[i], Math.sin(i) * 0.15);
        br.rotation.z = angle;
        br.rotation.y = i * 1.3;
        tree.add(br);
    });

    // Tocco: cristalli di ghiaccio (piccole gemme traslucide)
    const iceMat = new THREE.MeshPhongMaterial({ color: 0xaaddff, transparent: true, opacity: 0.5, shininess: 120 });
    for (let i = 0; i < 4; i++) {
        const iceGeo = new THREE.OctahedronGeometry(0.07, 0);
        const ice = new THREE.Mesh(iceGeo, iceMat);
        ice.position.set((Math.random() - 0.5) * 0.6, 2.4 + Math.random() * 0.5, (Math.random() - 0.5) * 0.6);
        tree.add(ice);
    }

    return tree;
}

// ---------------------------------------------------------------------------
// ALBERO DI PALUDE
// ---------------------------------------------------------------------------
export function createSwampTree() {
    const tree = new THREE.Group();

    const trunkMat = new THREE.MeshPhongMaterial({ color: 0x3b4a2f, flatShading: true });

    // Tronco tozzo
    const trunkGeo = new THREE.CylinderGeometry(0.3, 0.4, 1.5, 6);
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 0.75;
    tree.add(trunk);

    // Radici (cilindri obliqui)
    const rootMat = new THREE.MeshPhongMaterial({ color: 0x2e3b22, flatShading: true });
    for (let i = 0; i < 5; i++) {
        const rootGeo = new THREE.CylinderGeometry(0.06, 0.04, 0.9, 4);
        const root = new THREE.Mesh(rootGeo, rootMat);
        const angle = (i / 5) * Math.PI * 2;
        root.position.set(Math.cos(angle) * 0.5, 0.2, Math.sin(angle) * 0.5);
        root.rotation.z = Math.cos(angle) * 0.5;
        root.rotation.x = Math.sin(angle) * 0.5;
        tree.add(root);
    }

    // Chioma piatta e scura (muschio)
    const leavesMat = new THREE.MeshPhongMaterial({ color: 0x4a6741, flatShading: true });
    const leavesGeo = new THREE.SphereGeometry(1.1, 6, 4);
    const leaves = new THREE.Mesh(leavesGeo, leavesMat);
    leaves.scale.y = 0.4;
    leaves.position.y = 2.3;
    tree.add(leaves);

    // Muschio pendente
    const mossMat = new THREE.MeshPhongMaterial({ color: 0x3a5e30, transparent: true, opacity: 0.7, flatShading: true });
    for (let i = 0; i < 6; i++) {
        const mossGeo = new THREE.CylinderGeometry(0.02, 0.01, 0.7 + Math.random() * 0.4, 3);
        const moss = new THREE.Mesh(mossGeo, mossMat);
        const angle = (i / 6) * Math.PI * 2;
        moss.position.set(Math.cos(angle) * 0.7, 1.8, Math.sin(angle) * 0.7);
        tree.add(moss);
    }

    return tree;
}

// ---------------------------------------------------------------------------
// ROCCIA normale
// ---------------------------------------------------------------------------
export function createRock() {
    const geo = new THREE.IcosahedronGeometry(Math.random() * 0.5 + 0.3, 0);
    const mat = new THREE.MeshPhongMaterial({ color: 0x757575, flatShading: true });
    const rock = new THREE.Mesh(geo, mat);
    rock.scale.y = 0.5 + Math.random() * 0.5;
    return rock;
}

// ---------------------------------------------------------------------------
// ROCCIA VULCANICA (scura + bagliore)
// ---------------------------------------------------------------------------
export function createVolcanicRock() {
    const group = new THREE.Group();

    const geo = new THREE.IcosahedronGeometry(Math.random() * 0.6 + 0.35, 0);
    const mat = new THREE.MeshPhongMaterial({
        color: 0x1a1a1a,
        emissive: 0xff2200,
        emissiveIntensity: Math.random() * 0.4 + 0.1,
        flatShading: true
    });
    const rock = new THREE.Mesh(geo, mat);
    rock.scale.y = 0.5 + Math.random() * 0.5;
    group.add(rock);

    return group;
}

// ---------------------------------------------------------------------------
// CACTUS
// ---------------------------------------------------------------------------
export function createCactus(x, y, z) {
    const cactusMat = new THREE.MeshStandardMaterial({ color: 0x2d5a27, roughness: 0.8 });
    const group = new THREE.Group();

    // Tronco principale
    const trunkGeo = new THREE.CylinderGeometry(0.15, 0.15, 1.2, 6);
    const trunk = new THREE.Mesh(trunkGeo, cactusMat);
    trunk.position.y = 0.6;
    group.add(trunk);

    // Braccio 1 (Sinistra)
    const arm1 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.4, 6), cactusMat);
    arm1.position.set(-0.25, 0.7, 0);
    arm1.rotation.z = Math.PI / 2;
    group.add(arm1);
    
    const arm1Up = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.4, 6), cactusMat);
    arm1Up.position.set(-0.4, 0.85, 0);
    group.add(arm1Up);

    // Braccio 2 (Destra)
    const arm2 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.4, 6), cactusMat);
    arm2.position.set(0.25, 0.5, 0);
    arm2.rotation.z = -Math.PI / 2;
    group.add(arm2);

    const arm2Up = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.4, 6), cactusMat);
    arm2Up.position.set(0.4, 0.65, 0);
    group.add(arm2Up);

    group.position.set(x, y, z);
    // Variazione casuale scala e rotazione
    const s = 0.8 + Math.random() * 0.5;
    group.scale.set(s, s, s);
    // group.rotation.y = Math.random() * Math.PI;
    
    return group;
}
