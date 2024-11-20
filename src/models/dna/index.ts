import * as THREE from "three";
import { createNoise4D } from "simplex-noise";

function ease(x: number): number {
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

class DNAPath {
  private readonly points: THREE.Vector3[];
  private readonly getNoise: ReturnType<typeof createNoise4D>;

  private readonly divisions: number;
  private readonly camera: THREE.PerspectiveCamera;

  private visible: boolean;
  private visibilityOffset: number;
  private lastTimestamp: number;

  constructor(divisions: number, camera: THREE.PerspectiveCamera) {
    this.divisions = divisions;
    this.camera = camera;

    this.visible = true;
    this.visibilityOffset = 1;
    this.lastTimestamp = 0;

    this.points = this.subdividePoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, -150, 0),
    ]);
    this.getNoise = createNoise4D();
  }

  hide() {
    this.visible = false;
  }

  show() {
    this.visible = true;
  }

  subdividePoints(points: THREE.Vector3[]) {
    const curve = new THREE.CatmullRomCurve3(points);
    return curve.getSpacedPoints(this.divisions);
  }

  applyNoise(points: THREE.Vector3[], t: number) {
    return points.map((point) => {
      const noiseValue = this.getNoise(
        point.x / 100,
        point.y / 100,
        point.z / 100,
        t
      );
      const noiseVector = new THREE.Vector3(
        15 * noiseValue + -30 * ease(this.visibilityOffset),
        0,
        0
      );

      return point.clone().add(noiseVector);
    });
  }

  applyCameraAttraction(points: THREE.Vector3[]) {
    return points.map((point) => {
      const xDist = point.x - this.camera.position.x;
      const yDist = point.y - this.camera.position.y;
      const dist = Math.sqrt(xDist * xDist + yDist * yDist);

      const offsetN = Math.pow((100 - dist) / 50, 3);

      return point
        .clone()
        .setX(point.x + 30 * offsetN + -60 * ease(this.visibilityOffset));
    });
  }

  updateVisibility(timeElapsed: number) {
    const t = (timeElapsed - this.lastTimestamp) * 10;

    if (this.visible && this.visibilityOffset > 0) {
      this.visibilityOffset = this.visibilityOffset - t;
    } else if (!this.visible && this.visibilityOffset < 1) {
      this.visibilityOffset = this.visibilityOffset + t;
    }

    this.lastTimestamp = timeElapsed;
  }

  getPoints(timeElapsed: number) {
    this.updateVisibility(timeElapsed);

    const pointsWithCameraAttraction = this.applyCameraAttraction(this.points);
    const pointsWithNoise = this.applyNoise(
      pointsWithCameraAttraction,
      timeElapsed
    );

    return pointsWithNoise;
  }
}

const particlesVertexShader = `
  attribute float size;
  attribute vec3 color;
  uniform float time;
  
  varying vec3 vColor;
  varying vec3 vPosition;

  float mod289(float x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
  vec4 mod289(vec4 x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
  vec4 perm(vec4 x){return mod289(((x * 34.0) + 1.0) * x);}

  float noise(vec3 p){
    vec3 a = floor(p);
    vec3 d = p - a;
    d = d * d * (3.0 - 2.0 * d);

    vec4 b = a.xxyy + vec4(0.0, 1.0, 0.0, 1.0);
    vec4 k1 = perm(b.xyxy);
    vec4 k2 = perm(k1.xyxy + b.zzww);

    vec4 c = k2 + a.zzzz;
    vec4 k3 = perm(c);
    vec4 k4 = perm(c + 1.0);

    vec4 o1 = fract(k3 * (1.0 / 41.0));
    vec4 o2 = fract(k4 * (1.0 / 41.0));

    vec4 o3 = o2 * d.z + o1 * (1.0 - d.z);
    vec2 o4 = o3.yw * d.x + o3.xz * (1.0 - d.x);

    return o4.y * d.y + o4.x * (1.0 - d.y);
  }

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );

    float n = noise(vec3(mvPosition.xz, time));
    gl_PointSize = size * n * ( 100.0 / -mvPosition.z ) ;
    gl_Position = projectionMatrix * mvPosition;
  
    
    
    vPosition = mvPosition.xyz;
    vColor = color;

  }
`;

const particlesFragmentShader = `
  float mod289(float x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
  vec4 mod289(vec4 x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
  vec4 perm(vec4 x){return mod289(((x * 34.0) + 1.0) * x);}

  float noise(vec3 p){
      vec3 a = floor(p);
      vec3 d = p - a;
      d = d * d * (3.0 - 2.0 * d);

      vec4 b = a.xxyy + vec4(0.0, 1.0, 0.0, 1.0);
      vec4 k1 = perm(b.xyxy);
      vec4 k2 = perm(k1.xyxy + b.zzww);

      vec4 c = k2 + a.zzzz;
      vec4 k3 = perm(c);
      vec4 k4 = perm(c + 1.0);

      vec4 o1 = fract(k3 * (1.0 / 41.0));
      vec4 o2 = fract(k4 * (1.0 / 41.0));

      vec4 o3 = o2 * d.z + o1 * (1.0 - d.z);
      vec2 o4 = o3.yw * d.x + o3.xz * (1.0 - d.x);

      return o4.y * d.y + o4.x * (1.0 - d.y);
  }

  varying vec3 vColor;
  varying vec3 vPosition;

  uniform float time;

  void main() {
    if ( length( gl_PointCoord - vec2( 0.5, 0.5 ) ) > 0.475 ) discard;
    float n = noise(vec3(vPosition.xz, time));
    gl_FragColor = vec4(vColor, n );
  }
`;

class DNAParticles {
  private particles: Array<{
    position: THREE.Vector3;
    color: THREE.Color;
    size: number;
  }>;
  private readonly geometry: THREE.BufferGeometry;
  private readonly material: THREE.ShaderMaterial;
  private readonly points: THREE.Points;

  constructor() {
    this.particles = [];

    this.geometry = new THREE.BufferGeometry();
    this.material = new THREE.ShaderMaterial({
      vertexShader: particlesVertexShader,
      fragmentShader: particlesFragmentShader,
      blending: THREE.AdditiveBlending,
      depthTest: true,
      depthWrite: false,
      uniforms: {
        time: { value: 0 },
      },
      // transparent: true,
      // vertexColors: true,
    });

    this.geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute([], 3)
    );
    this.geometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute([], 3)
    );
    this.geometry.setAttribute(
      "size",
      new THREE.Float32BufferAttribute([], 1).setUsage(THREE.DynamicDrawUsage)
    );

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    // this.scene.add(this.points);
  }

  createParticle(position: THREE.Vector3, color: THREE.Color) {
    this.particles.push({ position, color, size: 5 });
  }

  render(scene: THREE.Scene) {
    scene.add(this.points);
  }

  update(timeElapsed: number) {
    const positions: number[] = [];
    const colors: number[] = [];
    const sizes: number[] = [];

    for (let i = 0; i < this.particles.length; i++) {
      const { position, color, size } = this.particles[i];

      positions.push(position.x, position.y, position.z);
      colors.push(color.r, color.g, color.b);
      sizes.push(size);
    }

    this.geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3)
    );

    this.geometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(colors, 3)
    );

    this.geometry.setAttribute(
      "size",
      new THREE.Float32BufferAttribute(sizes, 1).setUsage(
        THREE.DynamicDrawUsage
      )
    );
    this.material.uniforms.time.value = timeElapsed / 1000;

    // this.geometry.attributes.position.needsUpdate = true;
    // this.geometry.attributes.size.needsUpdate = true;
  }
}

const vertexShader = `
  varying vec3 vUv; 
  varying vec3 vPosition; 
  varying vec3 vNormal;

  void main() {
    vec4 modelViewPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * modelViewPosition; 
    
    vUv = position; 
    vPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    vNormal = normal;
  }
`;

const fragmentShader = `
  uniform vec3 colorHighlight; 
  uniform vec3 colorLight; 
  uniform vec3 colorDark; 

  varying vec3 vUv;
  varying vec3 vPosition;
  varying vec3 vNormal;
  
  void main() {
    float z = min(1.0, max(vPosition.z / 2.0 + 1., 0.0));

    vec3 lightColor = mix(colorLight, colorHighlight, smoothstep(1.0, 0.5, vNormal.z));
    vec3 darkColor = mix(colorDark, colorHighlight,  smoothstep(1.0, 0.5, z));

    gl_FragColor = vec4(mix(darkColor, lightColor, z).xyz, 1.0);
  }
`;

class DNA {
  private readonly radius: number;
  private readonly density: number;
  private readonly length: number;
  private readonly sphereRadius: number;
  private readonly tubeRadius: number;

  private readonly path: DNAPath;
  private readonly particles: DNAParticles;

  private readonly materialGreen: THREE.LineBasicMaterial;
  private readonly materialRed: THREE.LineBasicMaterial;

  private leftCurveLine: THREE.Mesh;
  private rightCurveLine: THREE.Mesh;
  private leftCurveSpheres: THREE.Mesh[];
  private rightCurveSpheres: THREE.Mesh[];
  private connectionLines: THREE.Mesh[];

  constructor(readonly camera: THREE.PerspectiveCamera) {
    this.radius = 5;
    this.density = 0.8;
    this.length = 100;
    this.tubeRadius = 0.2;
    this.sphereRadius = 0.6;

    this.path = new DNAPath(100, camera);
    this.particles = new DNAParticles();

    this.materialGreen = new THREE.LineBasicMaterial({ color: 0x00ff00 });
    this.materialRed = new THREE.LineBasicMaterial({ color: 0xff0000 });

    this.leftCurveLine = null as any;
    this.rightCurveLine = null as any;

    this.leftCurveSpheres = [];
    this.rightCurveSpheres = [];
    this.connectionLines = [];
  }

  hide() {
    this.path.hide();
  }

  show() {
    this.path.show();
  }

  render(scene: THREE.Scene) {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        colorHighlight: { value: new THREE.Color(0xd4dcff) },
        colorLight: { value: new THREE.Color(0xffffff) },
        colorDark: { value: new THREE.Color(0x7bc2ed) },
      },
      vertexShader,
      fragmentShader,
      depthTest: true,
    });

    // Get the points from the DNA path
    const points = this.path.getPoints(0);
    const curve = new THREE.CatmullRomCurve3(points);

    const leftCurvePoints = [];
    const rightCurvePoints = [];
    const leftCurveSpheres = [];
    const rightCurveSpheres = [];
    const connectionLines = [];

    for (let i = 0; i <= this.length; i++) {
      const angle = (Math.PI / 12) * i;
      const curveIndex = i / this.length;
      const curvePointPosition = curve.getPointAt(curveIndex);
      const curvePointTangent = curve.getTangentAt(curveIndex);

      const quaternion = new THREE.Quaternion();
      quaternion.setFromAxisAngle(curvePointTangent, angle);

      this.particles.createParticle(
        new THREE.Vector3(
          0,
          curvePointPosition.y,
          Math.random() * 100
        ).applyQuaternion(quaternion),
        new THREE.Color(0xffffff)
      );

      const leftCurvePoint = curvePointPosition
        .clone()
        .add(new THREE.Vector3(0, 0, this.radius).applyQuaternion(quaternion));
      const rightCurvePoint = curvePointPosition
        .clone()
        .add(new THREE.Vector3(0, 0, -this.radius).applyQuaternion(quaternion));

      leftCurvePoints.push(leftCurvePoint);
      rightCurvePoints.push(rightCurvePoint);

      // Spheres
      const sphereGeometry = new THREE.SphereGeometry(
        this.sphereRadius,
        32,
        16
      );
      const sphereLeft = new THREE.Mesh(sphereGeometry, material);
      const sphereRight = sphereLeft.clone();

      sphereLeft.position.copy(leftCurvePoint);
      sphereRight.position.copy(rightCurvePoint);

      leftCurveSpheres.push(sphereLeft);
      rightCurveSpheres.push(sphereRight);

      sphereLeft.geometry.computeVertexNormals();
      sphereRight.geometry.computeVertexNormals();

      scene.add(sphereLeft, sphereRight);

      // Connection lines
      const connectionLineGeometry = new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([leftCurvePoint, rightCurvePoint]),
        1,
        this.tubeRadius,
        4,
        false
      );

      const connectionLine = new THREE.Mesh(connectionLineGeometry, material);
      connectionLine.geometry.computeVertexNormals();

      connectionLines.push(connectionLine);

      scene.add(connectionLine);

      this.particles.render(scene);
    }

    const leftCurveGeometry = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(leftCurvePoints),
      this.length,
      this.tubeRadius,
      4,
      false
    );

    const rightCurveGeometry = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(rightCurvePoints),
      this.length,
      this.tubeRadius,
      4,
      false
    );

    this.leftCurveLine = new THREE.Mesh(leftCurveGeometry, material);
    this.rightCurveLine = new THREE.Mesh(rightCurveGeometry, material);

    this.leftCurveLine.geometry.computeVertexNormals();
    this.rightCurveLine.geometry.computeVertexNormals();

    this.leftCurveSpheres = leftCurveSpheres;
    this.rightCurveSpheres = rightCurveSpheres;
    this.connectionLines = connectionLines;

    scene.add(this.leftCurveLine, this.rightCurveLine);
  }

  updateCurveLines() {}

  update(timeElapsed: number) {
    const points = this.path.getPoints(timeElapsed / 10000);
    const curve = new THREE.CatmullRomCurve3(points);

    // Update curve lines
    const leftCurvePoints = [];
    const rightCurvePoints = [];

    for (let i = 0; i <= this.length; i++) {
      const angle = (Math.PI / 12) * i + timeElapsed / 1000;
      const curveIndex = i / this.length;
      const curvePointPosition = curve.getPointAt(curveIndex);
      const curvePointTangent = curve.getTangentAt(curveIndex);

      const quaternion = new THREE.Quaternion();
      quaternion.setFromAxisAngle(curvePointTangent, angle);

      const leftCurvePoint = curvePointPosition
        .clone()
        .add(new THREE.Vector3(0, 0, this.radius).applyQuaternion(quaternion));
      const rightCurvePoint = curvePointPosition
        .clone()
        .add(new THREE.Vector3(0, 0, -this.radius).applyQuaternion(quaternion));

      leftCurvePoints.push(leftCurvePoint);
      rightCurvePoints.push(rightCurvePoint);

      this.leftCurveSpheres[i].position.copy(leftCurvePoint);
      this.rightCurveSpheres[i].position.copy(rightCurvePoint);

      // Update connection line
      this.connectionLines[i].geometry.dispose();
      this.connectionLines[i].geometry = new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([leftCurvePoint, rightCurvePoint]),
        1,
        this.tubeRadius,
        4,
        false
      );
    }

    this.leftCurveLine.geometry.dispose();
    this.leftCurveLine.geometry = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(leftCurvePoints),
      this.length,
      this.tubeRadius,
      4,
      false
    );

    this.rightCurveLine.geometry.dispose();
    this.rightCurveLine.geometry = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(rightCurvePoints),
      this.length,
      this.tubeRadius,
      4,
      false
    );

    this.particles.update(timeElapsed);
  }
}

export default DNA;
