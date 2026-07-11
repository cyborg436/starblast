import RAPIER from '@dimforge/rapier3d-compat';

/**
 * Physics — monde rapier3d.
 * Le terrain streamé enregistre un collider trimesh PAR CHUNK (les mêmes
 * vertex que le rendu → collision exactement fidèle au relief, pentes et
 * marches comprises). Le joueur est une capsule cinématique pilotée par
 * le KinematicCharacterController de rapier.
 */

/* Groupes de collision (16 bits d'appartenance << 16 | 16 bits de filtre) */
export const G_TERRAIN = 0x0001;
export const G_PLAYER = 0x0002;
export const groups = (memberships, filter) => ((memberships & 0xffff) << 16) | (filter & 0xffff);

export class Physics {
  static async create() {
    await RAPIER.init();
    return new Physics();
  }

  constructor() {
    this.RAPIER = RAPIER;
    this.world = new RAPIER.World({ x: 0, y: -25, z: 0 });
    this._ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
  }

  step(dt) {
    this.world.timestep = Math.min(Math.max(dt, 1 / 240), 1 / 30);
    this.world.step();
  }

  /** Collider trimesh statique pour un chunk de terrain (coordonnées monde). */
  addTerrainMesh(positions, indices) {
    const desc = RAPIER.ColliderDesc.trimesh(positions, indices)
      .setCollisionGroups(groups(G_TERRAIN, 0xffff));
    return this.world.createCollider(desc);
  }

  removeCollider(collider) {
    if (collider) this.world.removeCollider(collider, false);
  }

  /**
   * Raycast contre le TERRAIN uniquement (caméra, sondes de sol).
   * Retourne la distance d'impact ou null.
   */
  raycastTerrain(origin, dir, maxToi) {
    this._ray.origin = origin;
    this._ray.dir = dir;
    const hit = this.world.castRay(this._ray, maxToi, true, undefined, groups(0xffff, G_TERRAIN));
    return hit ? hit.timeOfImpact : null;
  }

  /** Capsule cinématique + character controller pour le joueur. */
  createPlayerBody(x, y, z, halfHeight = 0.55, radius = 0.35) {
    const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y, z);
    const body = this.world.createRigidBody(bodyDesc);
    const collDesc = RAPIER.ColliderDesc.capsule(halfHeight, radius)
      .setCollisionGroups(groups(G_PLAYER, G_TERRAIN));
    const collider = this.world.createCollider(collDesc, body);

    const controller = this.world.createCharacterController(0.06); // marge de peau
    controller.enableAutostep(0.55, 0.25, true);        // marches ≤ 55 cm
    controller.enableSnapToGround(0.6);                  // colle au sol en descente
    controller.setMaxSlopeClimbAngle((52 * Math.PI) / 180);
    controller.setMinSlopeSlideAngle((58 * Math.PI) / 180);
    controller.setApplyImpulsesToDynamicBodies(false);

    return { body, collider, controller, capsuleOffset: halfHeight + radius };
  }
}
