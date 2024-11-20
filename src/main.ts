import "./style.css";
import { createNoise4D } from "simplex-noise";

import * as THREE from "three";

import CurvePath from "./models/CurvePath";
import DNA from "./models/DNA";

import { getDistance2D, ease, getScrollProgression } from "./lib/utils";

const getNoise4D = createNoise4D();

const section = document.getElementById("section");

const width = window.innerWidth,
  height = window.innerHeight;

// init
const camera = new THREE.PerspectiveCamera(70, width / height, 0.01, 1000);
camera.position.z = 50;
camera.position.y = -50;
camera.position.x = 50;

const scene = new THREE.Scene();

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(width, height);
renderer.setAnimationLoop(animate);
document.body.appendChild(renderer.domElement);

const curvePath = new CurvePath(
  [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -150, 0)],
  10
);

curvePath.addPointsTransformer("gravitateToCamera", (point, { strength }) => {
  const dist = getDistance2D(point, camera.position);
  const offsetN = Math.pow((100 - dist) / 50, 3);

  const s = ease(strength);

  return point
    .setX(point.x + 30 * offsetN * s)
    .setZ(point.z + 10 * offsetN * s);
});

curvePath.addPointsTransformer("applyNoiseX", (point, { state, strength }) => {
  const noiseValue = getNoise4D(
    point.x / 100,
    point.y / 100,
    point.z / 100,
    state.timeElapsed
  );

  const s = ease(strength);

  return point.setX(point.x + 15 * noiseValue * s);
});

curvePath.definePipeline("start", ["gravitateToCamera", "applyNoiseX"], true);
curvePath.definePipeline("noise", ["applyNoiseX"]);
curvePath.definePipeline("none", []);

const dna = new DNA(curvePath);

dna.render(scene);

let a = true;
window.onclick = () => {
  a = !a;
  if (a) {
    curvePath.setPipeline("start");
  } else {
    curvePath.setPipeline("none");
  }
};

function animate(time: number) {
  const s = getScrollProgression();

  camera.position.y = -40 - s * 50;

  // dna.update(time);

  curvePath.update(time / 10000);
  dna.update(time);

  renderer.render(scene, camera);
}

// requestAnimationFrame(animate);
