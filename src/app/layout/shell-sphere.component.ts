import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, ViewChild, inject } from '@angular/core';
import * as THREE from 'three';

@Component({
  selector: 'app-shell-sphere',
  templateUrl: './shell-sphere.component.html',
  styleUrl: './shell-sphere.component.scss'
})
export class ShellSphereComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true }) private readonly canvasRef!: ElementRef<HTMLCanvasElement>;

  private readonly hostRef = inject(ElementRef<HTMLElement>);
  private readonly zone = inject(NgZone);
  private readonly baseRotation = new THREE.Euler(-0.84, -0.1, -0.34);

  private renderer?: THREE.WebGLRenderer;
  private scene?: THREE.Scene;
  private camera?: THREE.OrthographicCamera;
  private sphere?: THREE.Group<THREE.Object3DEventMap>;
  private material?: THREE.MeshStandardMaterial;
  private resizeObserver?: ResizeObserver;
  private animationFrame?: number;
  private animationStart = 0;

  ngAfterViewInit() {
    this.zone.runOutsideAngular(() => this.initializeScene());
  }

  ngOnDestroy() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
    this.resizeObserver?.disconnect();
    this.sphere?.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
      }
    });
    this.material?.dispose();
    this.renderer?.dispose();
  }

  private initializeScene() {
    const canvas = this.canvasRef.nativeElement;
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true
    });

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.78;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap;
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();

    const camera = new THREE.OrthographicCamera(-2.4, 2.4, 2.4, -2.4, 0.1, 120);
    camera.position.set(0, 0, 6);
    camera.lookAt(0, 0, 0);

    const material = this.createMaterial();
    const sphere = this.createCrossSectionSphere(material, {
      radius: 1.44,
      count: 13,
      zLimitRatio: 0.93,
      thickness: 0.018
    });

    sphere.rotation.copy(this.baseRotation);

    scene.add(sphere);
    this.addLights(scene);

    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.material = material;
    this.sphere = sphere;

    this.resizeObserver = new ResizeObserver(() => this.resizeAndRender());
    this.resizeObserver.observe(this.hostRef.nativeElement);
    this.resizeAndRender();
    this.startAnimation();
  }

  private resizeAndRender() {
    if (!this.renderer || !this.camera || !this.scene) {
      return;
    }

    const host = this.hostRef.nativeElement;
    const width = Math.max(host.clientWidth, 1);
    const height = Math.max(host.clientHeight, 1);
    const aspect = width / height;
    const viewSize = 1.9;

    this.camera.left = -viewSize * aspect;
    this.camera.right = viewSize * aspect;
    this.camera.top = viewSize;
    this.camera.bottom = -viewSize;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.render(this.scene, this.camera);
  }

  private startAnimation() {
    const renderFrame = (timestamp: number) => {
      if (!this.renderer || !this.camera || !this.scene || !this.sphere) {
        return;
      }

      if (this.animationStart === 0) {
        this.animationStart = timestamp;
      }

      const elapsed = (timestamp - this.animationStart) / 1000;
      this.sphere.rotation.x = this.baseRotation.x + Math.sin(elapsed * 0.16) * 0.055;
      this.sphere.rotation.y = this.baseRotation.y + Math.cos(elapsed * 0.13) * 0.035;
      this.sphere.rotation.z = this.baseRotation.z + elapsed * 0.065 + Math.sin(elapsed * 0.11) * 0.08;

      this.renderer.render(this.scene, this.camera);
      this.animationFrame = requestAnimationFrame(renderFrame);
    };

    this.animationFrame = requestAnimationFrame(renderFrame);
  }

  private addLights(scene: THREE.Scene) {
    const topLightDir = new THREE.Vector3(-0.78, 0.59, 0.21).normalize();
    const lightDistance = 36;

    const ambient = new THREE.AmbientLight(0xffffff, 0.018);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xffffff, 6.2);
    keyLight.position.copy(topLightDir).multiplyScalar(lightDistance);
    keyLight.target.position.set(0, 0, 0);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 4096;
    keyLight.shadow.mapSize.height = 4096;
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 80;
    keyLight.shadow.camera.left = -3.2;
    keyLight.shadow.camera.right = 3.2;
    keyLight.shadow.camera.top = 3.2;
    keyLight.shadow.camera.bottom = -3.2;
    keyLight.shadow.radius = 9;
    keyLight.shadow.blurSamples = 32;
    keyLight.shadow.intensity = 0.62;
    keyLight.shadow.bias = -0.00018;
    keyLight.shadow.normalBias = 0.028;

    scene.add(keyLight);
    scene.add(keyLight.target);

    const softTopFill = new THREE.DirectionalLight(0xffffff, 0.045);
    softTopFill.position.set(1.8, 3.8, 4);
    scene.add(softTopFill);
  }

  private createMaterial() {
    const sliceOpacity = 0.83;
    const translucency = 0.14;
    const topLightDir = new THREE.Vector3(-0.78, 0.59, 0.21).normalize();

    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0.56, 0.56, 0.53),
      roughness: 0.98,
      metalness: 0,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: sliceOpacity,
      depthWrite: false,
      depthTest: true
    });

    material.shadowSide = THREE.DoubleSide;

    material.onBeforeCompile = (shader: THREE.WebGLProgramParametersWithUniforms) => {
      shader.uniforms['uWorldLightDir'] = { value: topLightDir.clone() };
      shader.uniforms['uTranslucency'] = { value: translucency };

      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `
        #include <common>

        attribute vec3 aSpherePos;
        attribute float aDiskRatio;

        varying vec3 vSpherePos;
        varying float vDiskRatio;
        varying vec3 vPseudoWorldNormal;
        `
      );

      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>

        vSpherePos = aSpherePos;
        vDiskRatio = aDiskRatio;

        vec3 safeSpherePos = aSpherePos;
        if (length(safeSpherePos) < 0.0001) {
          safeSpherePos = vec3(0.0, 0.0, 1.0);
        }

        vPseudoWorldNormal = normalize(mat3(modelMatrix) * normalize(safeSpherePos));
        `
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `
        #include <common>

        uniform vec3 uWorldLightDir;
        uniform float uTranslucency;

        varying vec3 vSpherePos;
        varying float vDiskRatio;
        varying vec3 vPseudoWorldNormal;

        float hash31(vec3 p) {
          p = fract(p * 0.1031);
          p += dot(p, p.yzx + 33.33);
          return fract((p.x + p.y) * p.z);
        }

        float noise3d(vec3 p) {
          vec3 i = floor(p);
          vec3 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);

          float n000 = hash31(i + vec3(0.0, 0.0, 0.0));
          float n100 = hash31(i + vec3(1.0, 0.0, 0.0));
          float n010 = hash31(i + vec3(0.0, 1.0, 0.0));
          float n110 = hash31(i + vec3(1.0, 1.0, 0.0));
          float n001 = hash31(i + vec3(0.0, 0.0, 1.0));
          float n101 = hash31(i + vec3(1.0, 0.0, 1.0));
          float n011 = hash31(i + vec3(0.0, 1.0, 1.0));
          float n111 = hash31(i + vec3(1.0, 1.0, 1.0));

          float nx00 = mix(n000, n100, f.x);
          float nx10 = mix(n010, n110, f.x);
          float nx01 = mix(n001, n101, f.x);
          float nx11 = mix(n011, n111, f.x);
          float nxy0 = mix(nx00, nx10, f.y);
          float nxy1 = mix(nx01, nx11, f.y);

          return mix(nxy0, nxy1, f.z);
        }

        float fbm(vec3 p) {
          float value = 0.0;
          float amp = 0.5;

          for (int i = 0; i < 5; i++) {
            value += amp * noise3d(p);
            p *= 2.03;
            amp *= 0.5;
          }

          return value;
        }
        `
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        `
        #include <color_fragment>

        vec3 p = vSpherePos;

        float cloud = fbm(p * 3.7 + vec3(1.7, -0.4, 2.1));
        float grain = hash31(floor(p * 160.0));
        float fine = hash31(floor(p * 330.0 + vec3(4.0, 1.0, 9.0)));
        float speckle = smoothstep(0.84, 1.0, fine);

        float textureValue = 0.66;
        textureValue += (cloud - 0.5) * 0.44;
        textureValue += (grain - 0.5) * 0.32;
        textureValue += speckle * 0.09;
        textureValue = clamp(textureValue, 0.22, 1.18);

        float sphereLight = dot(normalize(vPseudoWorldNormal), normalize(uWorldLightDir)) * 0.5 + 0.5;
        float sphereShade = 0.18 + pow(sphereLight, 2.05) * 1.12;

        float edge = smoothstep(0.82, 1.0, vDiskRatio);
        float edgeDarken = mix(1.0, 0.82, edge);
        float edgeLight = smoothstep(0.88, 1.0, vDiskRatio) * pow(max(sphereLight, 0.0), 2.0) * 0.08;

        diffuseColor.rgb *= textureValue * sphereShade * edgeDarken;
        diffuseColor.rgb += edgeLight;

        float localAlpha = mix(0.88, 0.98, edge);
        localAlpha += (textureValue - 0.66) * 0.05;
        diffuseColor.a *= clamp(localAlpha, 0.82, 0.98);
        `
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        `
        #include <emissivemap_fragment>

        vec3 transNormal = normalize(vPseudoWorldNormal);
        vec3 transLight = normalize(uWorldLightDir);

        float backThrough = max(dot(-transNormal, transLight), 0.0);
        float frontThrough = max(dot(transNormal, transLight), 0.0) * 0.28;
        float throughLight = pow(max(backThrough, frontThrough), 1.45);

        float edgeTranslucency = mix(0.38, 1.0, smoothstep(0.42, 1.0, vDiskRatio));

        totalEmissiveRadiance += vec3(0.34, 0.34, 0.31)
          * throughLight
          * edgeTranslucency
          * uTranslucency;
        `
      );
    };

    material.customProgramCacheKey = () => 'cross-section-sphere-soft-top-light-v1';
    return material;
  }

  private createCrossSectionSphere(
    material: THREE.Material,
    config: {
      radius: number;
      count: number;
      zLimitRatio: number;
      thickness: number;
    }
  ) {
    const group = new THREE.Group();
    const minZ = -config.radius * config.zLimitRatio;
    const maxZ = config.radius * config.zLimitRatio;

    for (let i = 0; i < config.count; i++) {
      const t = config.count === 1 ? 0.5 : i / (config.count - 1);
      const sectionZ = THREE.MathUtils.lerp(minZ, maxZ, t);
      const diskRadius = Math.sqrt(Math.max(0, config.radius * config.radius - sectionZ * sectionZ));

      const geometry = this.createCrossSectionDiskGeometry({
        sectionZ,
        diskRadius,
        thickness: config.thickness,
        radialSegments: 192,
        rings: 36
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.z = sectionZ;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }

    return group;
  }

  private createCrossSectionDiskGeometry(config: {
    sectionZ: number;
    diskRadius: number;
    thickness: number;
    radialSegments: number;
    rings: number;
  }) {
    const positions: number[] = [];
    const normals: number[] = [];
    const spherePositions: number[] = [];
    const diskRatios: number[] = [];
    const indices: number[] = [];
    const halfThickness = config.thickness * 0.5;
    const row = config.radialSegments + 1;

    const pushVertex = (
      x: number,
      y: number,
      z: number,
      nx: number,
      ny: number,
      nz: number,
      sphereX: number,
      sphereY: number,
      sphereZ: number,
      diskRatio: number
    ) => {
      positions.push(x, y, z);
      normals.push(nx, ny, nz);
      spherePositions.push(sphereX, sphereY, sphereZ);
      diskRatios.push(diskRatio);
      return positions.length / 3 - 1;
    };

    const addCap = (localZOffset: number, normalZ: number) => {
      const start = positions.length / 3;

      for (let ring = 0; ring <= config.rings; ring++) {
        const t = ring / config.rings;
        const r = config.diskRadius * t;

        for (let i = 0; i <= config.radialSegments; i++) {
          const a = (i / config.radialSegments) * Math.PI * 2;
          const x = Math.cos(a) * r;
          const y = Math.sin(a) * r;

          pushVertex(x, y, localZOffset, 0, 0, normalZ, x, y, config.sectionZ, t);
        }
      }

      for (let ring = 0; ring < config.rings; ring++) {
        for (let i = 0; i < config.radialSegments; i++) {
          const a = start + ring * row + i;
          const b = start + (ring + 1) * row + i;
          const c = start + (ring + 1) * row + i + 1;
          const d = start + ring * row + i + 1;

          if (normalZ > 0) {
            indices.push(a, b, d, b, c, d);
          } else {
            indices.push(a, d, b, b, d, c);
          }
        }
      }
    };

    const addOuterWall = () => {
      const start = positions.length / 3;

      for (let j = 0; j <= 1; j++) {
        const z = j === 0 ? halfThickness : -halfThickness;

        for (let i = 0; i <= config.radialSegments; i++) {
          const a = (i / config.radialSegments) * Math.PI * 2;
          const x = Math.cos(a) * config.diskRadius;
          const y = Math.sin(a) * config.diskRadius;
          const nx = Math.cos(a);
          const ny = Math.sin(a);

          pushVertex(x, y, z, nx, ny, 0, x, y, config.sectionZ, 1);
        }
      }

      for (let i = 0; i < config.radialSegments; i++) {
        const a = start + i;
        const b = start + i + 1;
        const c = start + row + i;
        const d = start + row + i + 1;

        indices.push(a, c, b, b, c, d);
      }
    };

    addCap(halfThickness, 1);
    addCap(-halfThickness, -1);
    addOuterWall();

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('aSpherePos', new THREE.Float32BufferAttribute(spherePositions, 3));
    geometry.setAttribute('aDiskRatio', new THREE.Float32BufferAttribute(diskRatios, 1));
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();

    return geometry;
  }
}
