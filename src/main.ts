import "./style.css";

import * as THREE from "three";

import DNA from "./models/dna";

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

var light = new THREE.DirectionalLight(0xffffff);
light.position.set(-1, 0, 0).normalize();
scene.add(light);
const dna = new DNA(camera);

dna.render(scene);

const scrollPercent = () => {
  const bodyST = document.body.scrollTop;
  const docST = document.documentElement.scrollTop;
  const docSH = document.documentElement.scrollHeight;
  const docCH = document.documentElement.clientHeight;

  return (docST + bodyST) / (docSH - docCH);
};

function animate(time: number) {
  const s = scrollPercent();

  camera.position.y = -40 - s * 50;

  dna.update(time);

  renderer.render(scene, camera);
}

// requestAnimationFrame(animate);
