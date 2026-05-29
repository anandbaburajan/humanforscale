import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import './styles.css';

const OBJECTS = [
  { name: 'Car', shape: 'car', length: 5.021, width: 1.987, height: 1.43, color: '#ffb45f', x: 0, z: 0, scaleHuman: true },
  { name: '100 m', shape: 'track', length: 100, lanes: 4, laneWidth: 1.22, height: 0.18, color: '#b9573f', x: 0, z: -8 },
];
const GROUND_SIZE = 420;
const GRID_BOX_SIZE = 5;
const LABEL_GAP = 1.2;
const LABEL_WIDTH = 6.4;
const LABEL_HEIGHT = 1.85;
const HUMAN_SCALE = {
  length: 0.3,
  width: 0.45,
  height: 1.75,
};

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
    worldGroup.add(createScaleObject(item));
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

function createLowPolyMaterial(color, opacity = 1) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.72,
    metalness: 0.02,
    flatShading: true,
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

function createScaleObject(item) {
  if (item.shape === 'human') {
    return createHumanSilhouette(item);
  }

  if (item.shape === 'car') {
    return createCarSilhouette(item);
  }

  if (item.shape === 'track') {
    return createRaceTrack(item);
  }

  return createSolidCuboid(item);
}

function createSolidCuboid(item) {
  const geometry = new THREE.BoxGeometry(item.length, item.height, item.width);
  const mesh = new THREE.Mesh(geometry, createMaterial(item.color));
  mesh.position.set(item.x + item.length / 2, item.height / 2, item.z);

  const group = new THREE.Group();
  group.add(mesh);
  group.add(createEdges(geometry, item.color, mesh.position));
  return group;
}

function createRaceTrack(item) {
  const trackWidth = item.lanes * item.laneWidth;
  const track = { ...item, width: trackWidth };
  const group = createSolidCuboid(track);
  const trackTopY = item.height + 0.012;
  const laneLineWidth = 0.035;
  const endLineLength = 0.08;
  const lineMaterial = createLowPolyMaterial('#eef3ff');

  for (let lane = 1; lane < item.lanes; lane += 1) {
    const divider = new THREE.Mesh(
      new THREE.BoxGeometry(item.length, 0.018, laneLineWidth),
      lineMaterial,
    );
    divider.position.set(
      item.x + item.length / 2,
      trackTopY,
      item.z - trackWidth / 2 + lane * item.laneWidth,
    );
    group.add(divider);
  }

  [item.x + endLineLength / 2, item.x + item.length - endLineLength / 2].forEach((x) => {
    const line = new THREE.Mesh(
      new THREE.BoxGeometry(endLineLength, 0.02, trackWidth),
      lineMaterial,
    );
    line.position.set(x, trackTopY + 0.004, item.z);
    group.add(line);
  });

  for (let lane = 0; lane < item.lanes; lane += 1) {
    const runner = createHumanSilhouette({
      ...HUMAN_SCALE,
      color: lane % 2 === 0 ? '#51e4d4' : '#9fe870',
      x: item.x + 0.48 + lane * 0.08,
      z: item.z - trackWidth / 2 + item.laneWidth * (lane + 0.5),
    });
    runner.position.y = item.height;
    group.add(runner);
  }

  return group;
}

function createHumanSilhouette(item) {
  const group = new THREE.Group();
  const shirtColor = item.color;
  const pantsColor = '#25364c';
  const skinColor = '#f0b98f';
  const centerX = item.x + item.length / 2;
  const centerZ = item.z;

  const hipY = item.height * 0.49;
  const waistY = item.height * 0.55;
  const shoulderY = item.height * 0.81;
  const neckY = item.height * 0.85;
  const headRadius = Math.min(item.length * 0.34, item.width * 0.2, item.height * 0.075);
  const armRadius = Math.min(item.length, item.width) * 0.07;
  const shoulderHalfWidth = item.width / 2 - armRadius;

  group.add(createLowPolyMesh(
    new THREE.IcosahedronGeometry(headRadius, 1),
    skinColor,
    centerX,
    item.height - headRadius,
    centerZ,
  ));
  group.add(createLowPolyMesh(
    new THREE.CylinderGeometry(item.length * 0.1, item.length * 0.11, item.height * 0.055, 7),
    skinColor,
    centerX,
    neckY,
    centerZ,
  ));
  group.add(createTaperedPrism(
    centerX,
    (waistY + shoulderY) / 2,
    centerZ,
    item.length * 0.55,
    item.length * 0.72,
    item.width * 0.34,
    item.width * 0.72,
    shoulderY - waistY,
    shirtColor,
  ));
  group.add(createTaperedPrism(
    centerX,
    (hipY + waistY) / 2,
    centerZ,
    item.length * 0.58,
    item.length * 0.5,
    item.width * 0.46,
    item.width * 0.34,
    waistY - hipY,
    pantsColor,
  ));
  group.add(createLowPolyMesh(
    new THREE.BoxGeometry(item.length * 0.64, hipY, item.width * 0.42),
    pantsColor,
    centerX,
    hipY / 2,
    centerZ,
  ));

  [-1, 1].forEach((side) => {
    const shoulderZ = centerZ + side * shoulderHalfWidth;
    const elbowY = item.height * 0.61;
    const wristY = item.height * 0.39;

    group.add(createLimb(
      new THREE.Vector3(centerX, shoulderY, shoulderZ),
      new THREE.Vector3(centerX + item.length * 0.02, elbowY, shoulderZ - side * item.width * 0.015),
      armRadius,
      shirtColor,
    ));
    group.add(createLimb(
      new THREE.Vector3(centerX + item.length * 0.02, elbowY, shoulderZ - side * item.width * 0.015),
      new THREE.Vector3(centerX + item.length * 0.01, wristY, shoulderZ),
      armRadius * 0.9,
      skinColor,
    ));
    group.add(createLowPolyMesh(
      new THREE.IcosahedronGeometry(armRadius * 1.25, 0),
      skinColor,
      centerX + item.length * 0.01,
      wristY - armRadius * 0.9,
      shoulderZ,
    ));
  });

  return group;
}

function createCarSilhouette(item) {
  const group = new THREE.Group();
  const bodyColor = item.color;
  const bodyAccent = new THREE.Color(item.color).offsetHSL(0.015, -0.08, -0.12);
  const glassColor = '#17202c';
  const wheelColor = '#080b11';
  const hubColor = '#aeb7c6';
  const bodyWidth = item.width * 0.9;
  const glassWidth = item.width * 0.66;
  const wheelRadius = item.height * 0.235;
  const wheelDepth = item.width * 0.13;
  const hubDepth = wheelDepth * 0.2;
  const bodyBottomY = wheelRadius * 0.5;
  const beltY = item.height * 0.58;

  group.add(createCarBody(item, bodyBottomY, beltY, bodyWidth, bodyColor));
  group.add(createCarCabin(item, beltY, glassWidth, glassColor));
  group.add(createLowPolyMesh(
    new THREE.BoxGeometry(item.length * 0.62, item.height * 0.055, bodyWidth * 1.02),
    bodyAccent,
    item.x + item.length * 0.52,
    bodyBottomY + item.height * 0.02,
    item.z,
  ));

  [item.x + item.length * 0.22, item.x + item.length * 0.77].forEach((x) => {
    [-1, 1].forEach((side) => {
      const z = item.z + side * (item.width / 2 - wheelDepth / 2);
      group.add(createWheel(x, wheelRadius, z, wheelRadius, wheelDepth, wheelColor));
      group.add(createWheel(x, wheelRadius, item.z + side * (item.width / 2 - hubDepth / 2), wheelRadius * 0.42, hubDepth, hubColor));
      group.add(createWheelArch(x, wheelRadius, item.z + side * (bodyWidth / 2 + 0.012), wheelRadius * 1.15, side, bodyAccent));
    });
  });

  [-1, 1].forEach((side) => {
    group.add(createLowPolyMesh(
      new THREE.BoxGeometry(item.length * 0.008, item.height * 0.05, item.width * 0.18),
      '#e64747',
      item.x + item.length * 0.004,
      item.height * 0.37,
      item.z + side * bodyWidth * 0.32,
    ));
    group.add(createLowPolyMesh(
      new THREE.BoxGeometry(item.length * 0.008, item.height * 0.05, item.width * 0.18),
      '#fff0a8',
      item.x + item.length * 0.996,
      item.height * 0.34,
      item.z + side * bodyWidth * 0.32,
    ));
  });

  if (item.scaleHuman) {
    group.add(createReferenceHumanForCar(item));
  }

  return group;
}

function createReferenceHumanForCar(item) {
  const sideGap = 0.35;
  return createHumanSilhouette({
    ...HUMAN_SCALE,
    color: '#51e4d4',
    x: item.x + item.length * 0.42,
    z: item.z + item.width / 2 + sideGap,
  });
}

function createCarBody(item, bottomY, topY, width, color) {
  return createExtrudedProfile([
    [item.x, bottomY + item.height * 0.22],
    [item.x + item.length * 0.02, bottomY + item.height * 0.1],
    [item.x + item.length * 0.12, bottomY],
    [item.x + item.length * 0.86, bottomY],
    [item.x + item.length * 0.965, bottomY + item.height * 0.04],
    [item.x + item.length, bottomY + item.height * 0.16],
    [item.x + item.length * 0.88, topY - item.height * 0.09],
    [item.x + item.length * 0.67, topY - item.height * 0.01],
    [item.x + item.length * 0.28, topY],
    [item.x + item.length * 0.1, topY - item.height * 0.05],
  ], width, item.z, color);
}

function createCarCabin(item, baseY, width, color) {
  return createExtrudedProfile([
    [item.x + item.length * 0.18, baseY],
    [item.x + item.length * 0.32, item.height * 0.97],
    [item.x + item.length * 0.47, item.height],
    [item.x + item.length * 0.57, item.height * 0.92],
    [item.x + item.length * 0.69, baseY - item.height * 0.01],
  ], width, item.z, color);
}

function createTaperedPrism(centerX, centerY, centerZ, bottomDepth, topDepth, bottomWidth, topWidth, height, color) {
  const yMin = centerY - height / 2;
  const yMax = centerY + height / 2;
  const bottomX = bottomDepth / 2;
  const topX = topDepth / 2;
  const bottomZ = bottomWidth / 2;
  const topZ = topWidth / 2;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    centerX - bottomX, yMin, centerZ - bottomZ,
    centerX + bottomX, yMin, centerZ - bottomZ,
    centerX + bottomX, yMin, centerZ + bottomZ,
    centerX - bottomX, yMin, centerZ + bottomZ,
    centerX - topX, yMax, centerZ - topZ,
    centerX + topX, yMax, centerZ - topZ,
    centerX + topX, yMax, centerZ + topZ,
    centerX - topX, yMax, centerZ + topZ,
  ], 3));
  geometry.setIndex([
    0, 1, 2, 0, 2, 3,
    4, 6, 5, 4, 7, 6,
    0, 4, 5, 0, 5, 1,
    1, 5, 6, 1, 6, 2,
    2, 6, 7, 2, 7, 3,
    3, 7, 4, 3, 4, 0,
  ]);
  geometry.computeVertexNormals();

  return new THREE.Mesh(geometry, createLowPolyMaterial(color));
}

function createExtrudedProfile(points, width, centerZ, color) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  points.slice(1).forEach(([x, y]) => shape.lineTo(x, y));
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: width,
    bevelEnabled: false,
    curveSegments: 1,
  });
  geometry.translate(0, 0, centerZ - width / 2);
  geometry.computeVertexNormals();

  return new THREE.Mesh(geometry, createLowPolyMaterial(color));
}

function createWheelArch(x, y, z, radius, side, color) {
  const arch = new THREE.Mesh(
    new THREE.TorusGeometry(radius, radius * 0.045, 4, 14, Math.PI),
    createLowPolyMaterial(color),
  );
  arch.position.set(x, y, z);
  arch.rotation.y = side > 0 ? 0 : Math.PI;
  return arch;
}

function createWheel(x, y, z, radius, depth, color) {
  const wheel = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, depth, 10),
    createLowPolyMaterial(color),
  );
  wheel.position.set(x, y, z);
  wheel.rotation.x = Math.PI / 2;
  return wheel;
}

function createLowPolyMesh(geometry, color, x, y, z) {
  const mesh = new THREE.Mesh(geometry, createLowPolyMaterial(color));
  mesh.position.set(x, y, z);
  return mesh;
}

function createLimb(start, end, radius, color) {
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();
  const limb = createLowPolyMesh(new THREE.CylinderGeometry(radius, radius, length, 6), color, 0, 0, 0);
  limb.position.copy(start).add(end).multiplyScalar(0.5);
  limb.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return limb;
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
