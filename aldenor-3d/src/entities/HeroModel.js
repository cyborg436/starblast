import * as THREE from 'three';
import { AnimationController, MixerBackend, ProceduralBackend } from './AnimationController.js';

/**
 * HeroModel — charge le modèle du héros et construit son AnimationController.
 *
 * Pipeline .glb (Mixamo) : déposez votre export dans
 *   public/models/hero.glb
 * avec les animations dans le même fichier, clips nommés (insensible à la
 * casse, correspondance par inclusion) : idle, walk, run, jump, fall,
 * attack_light_1/2/3 (ou attack1…), attack_heavy, dodge (ou roll), hit,
 * dead. Le modèle est auto-mis à l'échelle à 1,80 m et orienté +Z.
 *
 * Sans fichier : fallback héros low-poly procédural (mêmes états d'anim).
 */
export async function loadHeroModel(assets) {
  const url = `${import.meta.env.BASE_URL}models/hero.glb`;
  try {
    const gltf = await assets.gltfLoader.loadAsync(url);
    return buildFromGltf(gltf);
  } catch {
    console.info('[héros] pas de public/models/hero.glb — héros low-poly procédural utilisé.');
    return buildProcedural();
  }
}

/* ---------- .glb riggé ---------- */
function buildFromGltf(gltf) {
  const root = gltf.scene;

  // auto-échelle vers 1,80 m
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  const s = size.y > 0.01 ? 1.8 / size.y : 1;
  root.scale.setScalar(s);
  // pieds à y=0
  const box2 = new THREE.Box3().setFromObject(root);
  root.position.y -= box2.min.y;

  root.traverse(o => {
    if (o.isMesh || o.isSkinnedMesh) { o.castShadow = true; o.frustumCulled = false; }
  });

  const group = new THREE.Group();
  group.add(root);
  const anim = new AnimationController(new MixerBackend(root, gltf.animations || []));
  return { group, anim, source: 'glb' };
}

/* ---------- fallback low-poly procédural ---------- */
function flat(color) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 1 });
}

function buildProcedural() {
  const PEAU = '#f2c18e', TUNIQUE = '#3a7bd8', PANTALON = '#5a4632',
    CHEVEUX = '#8a5a2a', CUIR = '#7a5230', METAL = '#c8d2dc';

  const group = new THREE.Group();
  const model = new THREE.Group();
  group.add(model);

  const legL = new THREE.Group(); legL.position.set(-0.13, 0.85, 0);
  const legR = new THREE.Group(); legR.position.set(0.13, 0.85, 0);
  for (const leg of [legL, legR]) {
    const cuisse = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.75, 6), flat(PANTALON));
    cuisse.position.y = -0.38;
    const botte = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.3), flat(CUIR));
    botte.position.set(0, -0.78, 0.05);
    leg.add(cuisse, botte);
    model.add(leg);
  }

  const torse = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.72, 7), flat(TUNIQUE));
  torse.position.y = 1.24;
  const ceinture = new THREE.Mesh(new THREE.CylinderGeometry(0.245, 0.255, 0.1, 7), flat(CUIR));
  ceinture.position.y = 0.95;
  model.add(torse, ceinture);

  const armL = new THREE.Group(); armL.position.set(-0.3, 1.52, 0);
  const armR = new THREE.Group(); armR.position.set(0.3, 1.52, 0);
  for (const arm of [armL, armR]) {
    const manche = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.065, 0.6, 6), flat(TUNIQUE));
    manche.position.y = -0.28;
    const main = new THREE.Mesh(new THREE.SphereGeometry(0.075, 6, 5), flat(PEAU));
    main.position.y = -0.6;
    arm.add(manche, main);
    model.add(arm);
  }

  const head = new THREE.Group(); head.position.y = 1.78;
  const crane = new THREE.Mesh(new THREE.IcosahedronGeometry(0.21, 1), flat(PEAU));
  crane.position.y = 0.1;
  const cheveux = new THREE.Mesh(new THREE.SphereGeometry(0.22, 7, 5, 0, Math.PI * 2, 0, Math.PI * 0.55), flat(CHEVEUX));
  cheveux.position.y = 0.14;
  cheveux.scale.set(1.05, 1, 1.05);
  head.add(crane, cheveux);
  model.add(head);

  // épée dans le dos
  const epee = new THREE.Group();
  const lame = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.85, 0.012), flat(METAL));
  lame.position.y = 0.45;
  const garde = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.04), flat(CUIR));
  const poignee = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.16, 5), flat(CUIR));
  poignee.position.y = -0.1;
  epee.add(lame, garde, poignee);
  epee.position.set(0, 1.35, -0.28);
  epee.rotation.z = 0.45;
  model.add(epee);

  group.traverse(o => { if (o.isMesh) o.castShadow = true; });

  const anim = new AnimationController(new ProceduralBackend({ model, legL, legR, armL, armR, head }));
  return { group, anim, source: 'procedural', model };
}
