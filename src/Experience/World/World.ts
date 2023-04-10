import { Scene } from 'three';
import Experience from '../Experience.js';
import Resources from '../Utils/Resources.js';
import Globe from './Globe';

export default class World {
  experience: Experience;
  scene: Scene;
  resources: Resources;
  globe: Globe;
  constructor() {
    this.experience = new Experience();
    this.scene = this.experience.scene;
    this.resources = this.experience.resources;

    // Wait for resources
    // This wont instantiate meshes if there's no resource to load
    this.resources.on('ready', () => {
      // Setup
      this.globe = new Globe();
    });
  }

  update() {
    if (this.globe) {
      this.globe.update();
    }
  }
}
