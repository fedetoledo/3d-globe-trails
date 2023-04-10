import * as THREE from 'three';
import { Shader } from 'three';
import Experience from '../Experience';
import Debug from '../Utils/Debug';
import Resources from '../Utils/Resources';
import TWEEN from '@tweenjs/tween.js';

const MAX_IMPACT_AMOUNT = 10;

export default class Globe {
  dotCount = 30000;
  dotColors = [0x02aa82, 0x6c6af6];
  impacts: any[] = [];
  trails: any[] = [];
  uniforms: {
    impacts: { value: any[] };
    maxSize: { value: number };
    minSize: { value: number };
    waveHeight: { value: number };
    scaling: { value: number };
    gradInner: { value: THREE.Color };
    gradOuter: { value: THREE.Color };
  };
  params: {
    colors: {
      base: string;
      gradInner: string;
      gradOuter: string;
    };
  };

  points: THREE.Vector3[] = [];
  uvs: number[] = [];
  colorVector = [];
  experience: Experience;
  scene: THREE.Scene;
  resources: Resources;
  debug: Debug;
  debugFolder: any;
  globe: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;

  constructor() {
    this.experience = new Experience();
    this.scene = this.experience.scene;
    this.resources = this.experience.resources;
    this.debug = this.experience.debug;

    this.calculatePointsCoordinates();
    this.setGlobe();

    this.params = {
      colors: {
        base: '#555fff',
        gradInner: '#64ff64',
        gradOuter: '#64ffff',
      },
    };

    this.uniforms = {
      impacts: { value: this.impacts },
      maxSize: { value: 0.04 },
      minSize: { value: 0.03 },
      waveHeight: { value: 0.125 },
      scaling: { value: 2 },
      gradInner: { value: new THREE.Color(this.params.colors.gradInner) },
      gradOuter: { value: new THREE.Color(this.params.colors.gradOuter) },
    };

    this.generateImpacts();
    // this.makeGlobeOfPoints();

    // Debug
    if (this.debug.active) {
      this.debugFolder = this.debug.ui?.addFolder('globe');
      this.setDebug();
    }
  }

  setDebug() {
    throw new Error('Method not implemented.');
  }

  calculatePointsCoordinates() {
    const rad = 5;
    const sphericalCoordinates = new THREE.Spherical();

    const dlong = Math.PI * (3 - Math.sqrt(5));
    const dz = 2 / this.dotCount;

    let r = 0;
    let long = 0;
    let z = 1 - dz / 2;

    const colorConstructor = new THREE.Color();

    for (let i = 0; i < this.dotCount; i++) {
      r = Math.sqrt(1 - z * z);

      const x = Math.cos(long) * r;
      const y = z;
      const vz = -Math.sin(long) * r;

      const pointCoordinates: THREE.Vector3 = new THREE.Vector3(
        x,
        y,
        vz
      ).multiplyScalar(rad);

      this.points.push(pointCoordinates);

      z = z - dz;
      long = long + dlong;

      this.setPointColor(colorConstructor, i);

      sphericalCoordinates.setFromVector3(pointCoordinates);
      this.uvs.push(
        (sphericalCoordinates.theta + Math.PI) / (Math.PI * 2),
        1.0 - sphericalCoordinates.phi / Math.PI
      );
    }
  }

  setPointColor(colorConstructor: THREE.Color, i: number) {
    const randomNumber = Math.round(
      Math.random() * (this.dotColors.length - 1)
    );
    colorConstructor.setHex(this.dotColors[randomNumber]);
    colorConstructor.toArray(this.colorVector, i * 3);
    colorConstructor.convertSRGBToLinear();
  }

  setGlobe() {
    const geometry = new THREE.BufferGeometry().setFromPoints(this.points);
    geometry.setAttribute(
      'color',
      new THREE.Float32BufferAttribute(this.colorVector, 3)
    );
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));

    const material = new THREE.PointsMaterial(<THREE.MaterialParameters>{
      size: 0.1,
      vertexColors: true,
      onBeforeCompile: (shader: Shader) => {
        shader.uniforms.globeTexture = {
          value: this.resources.items.globeTexture,
        };
        shader.vertexShader = `
         	uniform sampler2D globeTexture;
           varying float vVisibility;
           varying vec3 vNormal;
           varying vec3 vMvPosition;
           ${shader.vertexShader}
         `.replace(
          `gl_PointSize = size;`,
          `
          	vVisibility = texture(globeTexture, uv).g; // get value from texture
            gl_PointSize = size * (vVisibility < 0.5 ? 1. : 0.0); // size depends on the value
            vNormal = normalMatrix * normalize(position) * 0.6;
            vMvPosition = -mvPosition.xyz;
            gl_PointSize *= 0.4 + (dot(normalize(vMvPosition), vNormal) * 0.6); // size depends position in camera space
          `
        );
        shader.fragmentShader = `
            varying float vVisibility;
            varying vec3 vNormal;
            varying vec3 vMvPosition;
            ${shader.fragmentShader}`.replace(
          `vec4 diffuseColor = vec4( diffuse, opacity );`,
          `
                bool circ = length(gl_PointCoord - 0.5) > .5; // make points round
                bool vis = dot(vMvPosition, vNormal) < 0.; // visible only on the front side of the sphere

                if (circ) discard;

                vec3 col = diffuse; // + (vVisibility > 0.5 ? 1.0 : .0); // make oceans brighter

                vec4 diffuseColor = vec4( col, opacity );
              `
        );
      },
    });

    this.globe = new THREE.Points(geometry, material);
    const glob = new THREE.Mesh(
      new THREE.SphereGeometry(10, 100, 100),
      new THREE.MeshBasicMaterial({
        color: 0x333333,
        opacity: 0.01,
        transparent: true,
      })
    );
    glob.scale.multiplyScalar(0.5);
    this.globe.add(glob);

    this.scene.add(this.globe);
  }

  generateImpacts() {
    for (let i = 0; i < MAX_IMPACT_AMOUNT; i++) {
      this.impacts.push({
        impactPosition: new THREE.Vector3()
          .random()
          .subScalar(0.5)
          .setLength(5),
        impactMaxRadius: 5 * THREE.MathUtils.randFloat(0.5, 0.75),
        impactRatio: 0,
        prevPosition: new THREE.Vector3().random().subScalar(0.5).setLength(5),
        trailRatio: { value: 0 },
        trailLength: { value: 0 },
      });
      this.makeTrail(i);
    }

    let tweens: any[] = [];

    for (let i = 0; i < MAX_IMPACT_AMOUNT; i++) {
      tweens.push({
        runTween: () => {
          let path = this.trails[i];
          let speed = 3;
          let len = path.geometry.attributes.lineDistance.array[99];
          let dur = len / speed;
          let tweenTrail = new TWEEN.Tween({ value: 0 })
            .to({ value: 1 }, dur * 1000)
            .onUpdate((val) => {
              this.impacts[i].trailRatio.value = val.value;
            });

          var tweenImpact = new TWEEN.Tween({ value: 0 })
            .to({ value: 1 }, THREE.MathUtils.randInt(2500, 5000))
            .onUpdate((val) => {
              this.uniforms.impacts.value[i].impactRatio = val.value;
            })
            .onComplete((val) => {
              this.impacts[i].prevPosition.copy(this.impacts[i].impactPosition);
              this.impacts[i].impactPosition
                .random()
                .subScalar(0.5)
                .setLength(5);
              this.setPath(
                path,
                this.impacts[i].prevPosition,
                this.impacts[i].impactPosition,
                1
              );
              this.uniforms.impacts.value[i].impactMaxRadius =
                5 * THREE.MathUtils.randFloat(0.5, 0.75);
              tweens[i].runTween();
            });

          tweenTrail.chain(tweenImpact);
          tweenTrail.start();
        },
      });
    }

    tweens.forEach((t) => {
      t.runTween();
    });

    this.trails.forEach((t) => this.scene.add(t));
  }

  makeTrail(idx: number) {
    let pts = new Array(100 * 3).fill(0);
    let g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    let m = new THREE.LineDashedMaterial(<THREE.MaterialParameters>{
      color: this.params.colors.gradOuter,
      transparent: true,
      onBeforeCompile: (shader: Shader) => {
        shader.uniforms.actionRatio = this.impacts[idx].trailRatio;
        shader.uniforms.lineLength = this.impacts[idx].trailLength;

        shader.fragmentShader = `
      	uniform float actionRatio;
        uniform float lineLength;
        ${shader.fragmentShader}
      `
          .replace(
            `if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}`,
            `
        	float halfDash = dashSize * 0.5;
          float currPos = (lineLength + dashSize) * actionRatio;
        	float d = (vLineDistance + halfDash) - currPos;
        	if (abs(d) > halfDash ) discard;
          
          float grad = ((vLineDistance + halfDash) - (currPos - halfDash)) / halfDash;
        `
          )
          .replace(
            `vec4 diffuseColor = vec4( diffuse, opacity );`,
            `
        vec4 diffuseColor = vec4( diffuse, grad );
        `
          );
      },
    });

    let line = new THREE.Line(g, m);
    line.userData.idx = idx;

    this.setPath(
      line,
      this.impacts[idx].prevPosition,
      this.impacts[idx].impactPosition,
      1
    );
    this.trails.push(line);
  }

  setPath(
    line: THREE.Line<THREE.BufferGeometry, THREE.LineDashedMaterial>,
    startPoint: THREE.Vector3,
    endPoint: THREE.Vector3,
    peakHeight: number,
    cycles?: number
  ) {
    let pos = line.geometry.attributes.position;
    let division = pos.count - 1;
    let cycle = cycles ?? 1;
    let peak = peakHeight || 1;

    let points = [];

    let radius = startPoint.length();
    let angle = startPoint.angleTo(endPoint);

    let arcLength = radius * angle;
    let diameterMinor = arcLength / Math.PI;
    let radiusMinor = (diameterMinor * 0.5) / cycle;

    let peakRatio = peak / radiusMinor;

    let radiusMajor = startPoint.length() + radiusMinor;
    let basisMajor = new THREE.Vector3()
      .copy(startPoint)
      .setLength(radiusMajor);

    let basisMinor = new THREE.Vector3()
      .copy(startPoint)
      .negate()
      .setLength(radiusMinor);

    // triangle (start, end, center)
    let tri = new THREE.Triangle(startPoint, endPoint, new THREE.Vector3());
    let nrm = new THREE.Vector3(); // normal
    tri.getNormal(nrm);

    // rotate startPoint around normal
    let angleStep = angle / division;
    let v3Major = new THREE.Vector3();
    let v3Minor = new THREE.Vector3();
    let v3Inter = new THREE.Vector3();
    let vFinal = new THREE.Vector3();
    for (let i = 0; i <= division; i++) {
      let divisionRatio = i / division;
      let angleValue = angle * divisionRatio;
      v3Major.copy(basisMajor).applyAxisAngle(nrm, angleValue);
      v3Minor
        .copy(basisMinor)
        .applyAxisAngle(nrm, angleValue + Math.PI * 2 * divisionRatio * cycle);

      v3Inter.addVectors(v3Major, v3Minor);
      let newLength = (v3Inter.length() - radius) * peakRatio + radius;

      vFinal.copy(v3Inter).setLength(newLength);

      pos.setXYZ(i, vFinal.x, vFinal.y, vFinal.z);
    }
    pos.needsUpdate = true;
    line.computeLineDistances();
    line.geometry.attributes.lineDistance.needsUpdate = true;
    this.impacts[line.userData.idx].trailLength.value =
      line.geometry.attributes.lineDistance.array[99];
    line.material.dashSize = 3;
  }

  update() {
    TWEEN.update();
  }
}
