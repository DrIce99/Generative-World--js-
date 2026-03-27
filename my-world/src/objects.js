import * as THREE from 'three';

// Funzione per creare un albero stilizzato (tronco + chioma conica)
export function createTree() {
  const tree = new THREE.Group();
  
  const trunkGeo = new THREE.CylinderGeometry(0.2, 0.2, 1, 6);
  const trunkMat = new THREE.MeshPhongMaterial({ color: 0x5d4037, flatShading: true });
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.y = 0.5;
  tree.add(trunk);

  const leavesGeo = new THREE.ConeGeometry(0.8, 2, 6);
  const leavesMat = new THREE.MeshPhongMaterial({ color: 0x2e7d32, flatShading: true });
  const leaves = new THREE.Mesh(leavesGeo, leavesMat);
  leaves.position.y = 2;
  tree.add(leaves);

  return tree;
}

// Funzione per creare una roccia irregolare
export function createRock() {
  const geo = new THREE.IcosahedronGeometry(Math.random() * 0.5 + 0.3, 0);
  const mat = new THREE.MeshPhongMaterial({ color: 0x757575, flatShading: true });
  const rock = new THREE.Mesh(geo, mat);
  rock.scale.y = 0.5 + Math.random() * 0.5;
  return rock;
}
