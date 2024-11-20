import * as THREE from "three";
import { createNoise4D } from "simplex-noise";

function vector3ArrayToFloat32BufferAttribute(arr: THREE.Vector3[]) {
  const buffer = [];
  for (let i = 0; i < arr.length; i++) {
    const vector = arr[i].normalize();
    buffer.push(vector.x, vector.y, vector.z);
  }

  return new THREE.Float32BufferAttribute(buffer, 3);
}

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
    vec3 darkColor = mix(colorDark, colorHighlight, smoothstep(1.0, 0.5, vNormal.z));

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

    console.log(this.leftCurveLine);
    // this.leftCurveLine.geometry.computeVertexNormals();

    // this.leftCurveLine.geometry.setAttribute(
    //   "normals",
    //   vector3ArrayToFloat32BufferAttribute(this.leftCurveLine.geometry.normals)
    // );

    this.rightCurveLine.geometry.dispose();
    this.rightCurveLine.geometry = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(rightCurvePoints),
      this.length,
      this.tubeRadius,
      4,
      false
    );
    // this.rightCurveLine.geometry.computeVertexNormals();
    // this.rightCurveLine.geometry.setAttribute(
    //   "normals",
    //   vector3ArrayToFloat32BufferAttribute(this.rightCurveLine.geometry.normals)
    // );

    // updateCurveLines()
  }
}

export default DNA;
