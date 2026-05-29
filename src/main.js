import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import './styles.css';

const OBJECTS = [
  { name: 'Human', length: 0.3, width: 0.45, height: 1.75, color: '#51e4d4', x: 0, z: 5 },
  { name: 'Car', length: 5.021, width: 1.987, height: 1.43, color: '#ffb45f', x: 0, z: 0 },
  { name: '100 m', length: 100, width: 3, height: 0.18, color: '#8ba4ff', x: 0, z: -5 },
];
const GROUND_SIZE = 420;
const GRID_BOX_SIZE = 5;
const LABEL_GAP = 1.2;
const LABEL_WIDTH = 6.4;
const LABEL_HEIGHT = 1.85;

const sceneRoot = document.querySelector('#app');

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(sceneRoot.clientWidth, sceneRoot.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
sceneRoot.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#05070d');
scene.fog = new THREE.Fog('#05070d', 90, 280);

const camera = new THREE.PerspectiveCamera(48, sceneRoot.clientWidth / sceneRoot.clientHeight, 0.01, 5000);
camera.position.set(56, 34, 72);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.075;
controls.maxPolarAngle = Math.PI * 0.48;
controls.minDistance = 0.8;
controls.maxDistance = 320;
controls.target.set(50, 0.9, 0);

const ambient = new THREE.HemisphereLight('#9ebaff', '#10131c', 1.55);
scene.add(ambient);

const keyLight = new THREE.DirectionalLight('#ffffff', 2.6);
keyLight.position.set(20, 35, 22);
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight('#5b7dff', 1.1);
rimLight.position.set(-18, 15, -14);
scene.add(rimLight);

const worldGroup = new THREE.Group();
scene.add(worldGroup);

buildScene();
fitCameraToScene(false);
animate();

function buildScene() {
  OBJECTS.forEach((item) => {
    worldGroup.add(createCuboid(item));
  });

  const groundGeometry = new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE);
  const groundMaterial = new THREE.MeshBasicMaterial({
    color: '#080a0e',
  });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.position.set(50, -0.014, 0);
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const grid = new THREE.GridHelper(GROUND_SIZE, GROUND_SIZE / GRID_BOX_SIZE, '#1d222b', '#1d222b');
  grid.position.set(50, -0.002, 0);
  scene.add(grid);

  OBJECTS.forEach((item) => {
    scene.add(createGroundText(item.name, item.x - LABEL_GAP - LABEL_WIDTH / 2, item.z));
  });

  window.addEventListener('resize', onResize);
}

function fitCameraToScene(animated) {
  const box = new THREE.Box3().setFromObject(worldGroup);
  if (box.isEmpty()) return;

  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y * 12, size.z * 5, 2.5);
  const fov = THREE.MathUtils.degToRad(camera.fov);
  const fitHeightDistance = maxDim / (2 * Math.tan(fov / 2));
  const fitWidthDistance = fitHeightDistance / camera.aspect;
  const distance = Math.max(fitHeightDistance, fitWidthDistance) * (camera.aspect < 0.75 ? 1.28 : 1.08);
  const direction = new THREE.Vector3(0.72, 0.42, 1).normalize();
  const targetPosition = center.clone().add(direction.multiplyScalar(distance));

  camera.near = Math.max(0.01, distance / 8000);
  camera.far = Math.max(5000, distance * 8);
  camera.updateProjectionMatrix();

  controls.target.copy(center);
  camera.position.copy(targetPosition);
  controls.update();
}

function createMaterial(color, opacity = 1) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.58,
    metalness: 0.06,
    transparent: opacity < 1,
    opacity,
  });
}

function createGroundText(text, x, z) {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 220;

  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = 'rgba(194, 204, 220, 0.88)';
  context.font = '700 116px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
  context.textAlign = 'right';
  context.textBaseline = 'middle';
  context.fillText(text, canvas.width - 28, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);

  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(LABEL_WIDTH, LABEL_HEIGHT),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  label.position.set(x, 0.018, z);
  label.rotation.x = -Math.PI / 2;
  return label;
}

function createCuboid(item) {
  const geometry = new THREE.BoxGeometry(item.length, item.height, item.width);
  const mesh = new THREE.Mesh(geometry, createMaterial(item.color));
  mesh.position.set(item.x + item.length / 2, item.height / 2, item.z);

  const group = new THREE.Group();
  group.add(mesh);
  group.add(createEdges(geometry, item.color, mesh.position));
  return group;
}

function createEdges(geometry, color, position) {
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry),
    new THREE.LineBasicMaterial({ color: new THREE.Color(color).offsetHSL(0, 0, 0.16), transparent: true, opacity: 0.45 }),
  );
  edges.position.copy(position);
  return edges;
}

function onResize() {
  const width = sceneRoot.clientWidth;
  const height = sceneRoot.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  fitCameraToScene(false);
}

function animate() {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
