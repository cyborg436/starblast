import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * AssetManager — chargement centralisé de tous les assets.
 * Basé sur THREE.LoadingManager : la progression globale alimente
 * l'écran de chargement HTML (LoadingScreen).
 *
 * Usage :
 *   await assets.preload([
 *     { type: 'gltf',    name: 'player', url: '...' },
 *     { type: 'texture', name: 'grass',  url: '...' },
 *     { type: 'audio',   name: 'theme',  url: '...' },
 *   ]);
 *   const gltf = assets.get('player');
 */
export class AssetManager {
  constructor(loadingScreen) {
    this.cache = new Map();

    this.manager = new THREE.LoadingManager();
    this.manager.onProgress = (url, loaded, total) => {
      loadingScreen?.setProgress(loaded / total, url.split('/').pop());
    };
    this.manager.onError = (url) => {
      console.error(`[AssetManager] échec de chargement : ${url}`);
    };

    this.gltfLoader = new GLTFLoader(this.manager);
    this.textureLoader = new THREE.TextureLoader(this.manager);
    this.audioLoader = new THREE.AudioLoader(this.manager);
  }

  /** Charge un manifeste d'assets ; résout quand tout est prêt. */
  async preload(manifest) {
    if (!manifest || manifest.length === 0) return;

    const jobs = manifest.map((entry) => this._loadOne(entry));
    await Promise.all(jobs);
  }

  async _loadOne({ type, name, url }) {
    let asset;
    switch (type) {
      case 'gltf':
        asset = await this.gltfLoader.loadAsync(url);
        break;
      case 'texture':
        asset = await this.textureLoader.loadAsync(url);
        asset.colorSpace = THREE.SRGBColorSpace;
        break;
      case 'audio':
        asset = await this.audioLoader.loadAsync(url);
        break;
      default:
        throw new Error(`[AssetManager] type inconnu : ${type}`);
    }
    this.cache.set(name, asset);
    return asset;
  }

  /** Récupère un asset préchargé par son nom. */
  get(name) {
    const asset = this.cache.get(name);
    if (!asset) throw new Error(`[AssetManager] asset non chargé : ${name}`);
    return asset;
  }

  has(name) {
    return this.cache.has(name);
  }
}
