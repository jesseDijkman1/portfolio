import * as THREE from "three";

export function getDistance2D(vec1: THREE.Vector3, vec2: THREE.Vector3) {
  const xDist = vec1.x - vec2.x;
  const yDist = vec1.y - vec2.y;
  return Math.sqrt(xDist * xDist + yDist * yDist);
}

export function ease(x: number) {
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

export function getScrollProgression() {
  const { body, documentElement } = document;

  return (
    (documentElement.scrollTop + body.scrollTop) /
    (documentElement.scrollHeight - documentElement.clientHeight)
  );
}
