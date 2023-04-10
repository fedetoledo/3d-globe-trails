import * as THREE from 'three';
import Experience from '../Experience';

export default class Cube {
  constructor() {
    this.experience = new Experience();
    this.scene = this.experience.scene;

    this.setCube();
  }

  setCube() {
    this.cube = new THREE.Mesh(
      new THREE.BoxGeometry(2, 2, 2),
      new THREE.MeshBasicMaterial({ color: 'red' })
    );

    this.scene.add(this.cube);
  }

  update() {
    this.cube.rotation.y += 0.01;
    this.cube.rotation.x += 0.01;
  }
}
