import * as THREE from "three";
import CurvePath from "./CurvePath";

const mainColor = new THREE.Color(0x80ffc8);

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
    float z = min(1.0, max(vPosition.z / 2.0 - 3., 0.0));

    vec3 lightColor = mix(colorLight, colorHighlight, smoothstep(1.0, 0.0, pow(vNormal.z, 2.0)));
    vec3 darkColor = mix(colorDark, colorHighlight,  smoothstep(0.3, 0.1, vNormal.z));

    gl_FragColor = vec4(mix(darkColor, lightColor, z).xyz, 1.0);
  }
`;

class DNA {
  private readonly radius: number;
  private readonly density: number;
  private readonly length: number;
  private readonly sphereRadius: number;
  private readonly tubeRadius: number;

  // private readonly path: DNAPath;
  // private readonly particles: DNAParticles;

  private readonly materialGreen: THREE.LineBasicMaterial;
  private readonly materialRed: THREE.LineBasicMaterial;

  private leftCurveLine: THREE.Mesh;
  private rightCurveLine: THREE.Mesh;
  private leftCurveSpheres: THREE.Mesh[];
  private rightCurveSpheres: THREE.Mesh[];
  private connectionLines: THREE.Mesh[];

  constructor(readonly path: CurvePath) {
    this.path = path;

    this.radius = 5;
    this.density = 0.8;
    this.length = 100;
    this.tubeRadius = 0.2;
    this.sphereRadius = 0.6;

    // this.particles = new DNAParticles(this.path);

    this.materialGreen = new THREE.LineBasicMaterial({ color: 0x00ff00 });
    this.materialRed = new THREE.LineBasicMaterial({ color: 0xff0000 });

    this.leftCurveLine = null as any;
    this.rightCurveLine = null as any;

    this.leftCurveSpheres = [];
    this.rightCurveSpheres = [];
    this.connectionLines = [];
  }

  // hide() {
  //   this.path.hide();
  // }

  // show() {
  //   this.path.show();
  // }

  render(scene: THREE.Scene) {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        colorHighlight: { value: mainColor },
        colorLight: { value: new THREE.Color(0xffffff) },
        colorDark: { value: new THREE.Color(0x000000) },
      },
      vertexShader,
      fragmentShader,
      depthTest: true,
    });

    // Get the points from the DNA path
    const points = this.path.getPoints();
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

      // this.particles.createParticle(
      //   new THREE.Vector3(
      //     0,
      //     curvePointPosition.y,
      //     Math.random() * 100
      //   ).applyQuaternion(quaternion),
      //   new THREE.Color(0xffffff)
      // );

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
        8,
        false
      );

      const connectionLine = new THREE.Mesh(connectionLineGeometry, material);
      connectionLine.geometry.computeVertexNormals();

      connectionLines.push(connectionLine);

      scene.add(connectionLine);
    }

    // this.particles.render(scene);

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
    const points = this.path.getPoints();
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
        16,
        false
      );
    }

    this.leftCurveLine.geometry.dispose();
    this.leftCurveLine.geometry = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(leftCurvePoints),
      this.length,
      this.tubeRadius,
      16,
      false
    );

    this.rightCurveLine.geometry.dispose();
    this.rightCurveLine.geometry = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(rightCurvePoints),
      this.length,
      this.tubeRadius,
      16,
      false
    );

    // this.particles.update(timeElapsed);
  }
}

export default DNA;
