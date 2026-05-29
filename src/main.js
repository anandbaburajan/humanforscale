import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import './styles.css';

const OBJECTS = [
  { name: 'Car', shape: 'car', length: 5.021, width: 1.987, height: 1.43, color: '#ffb45f', x: 0, z: 0, scaleHuman: true },
  { name: 'Soccer field', shape: 'soccerField', length: 105, width: 68, height: 0.32, color: '#28733f', x: 0, z: -55 },
  { name: '100 m', shape: 'track', length: 100, lanes: 4, laneWidth: 1.22, height: 0.32, color: '#b9573f', x: 0, z: -8 },
  { name: '1 km', shape: 'distancePlane', length: 1000, width: 18, height: 0.32, color: '#172335', x: 0, z: -112 },
  { name: '1 mile', shape: 'distancePlane', length: 1609.344, width: 18, height: 0.32, color: '#1b2b43', x: 0, z: -136 },
  { name: 'Boeing 737', shape: 'boeing737', length: 39.5, width: 35.8, height: 12.5, fuselageDiameter: 3.76, color: '#d8e0ea', x: 0, z: -180 },
  { name: 'Blue whale', shape: 'blueWhale', length: 29.9, width: 5.2, height: 4.2, color: '#416d92', x: 0, z: -220 },
];
const GROUND_SIZE = 1900;
const GROUND_CENTER_X = 800;
const GRID_BOX_SIZE = 10;
const LABEL_GAP = 1.2;
const LABEL_WIDTH = 6.4;
const LABEL_HEIGHT = 1.85;
const HUMAN_SCALE = {
  length: 0.3,
  width: 0.45,
  height: 1.75,
};
const CAMERA_NEAR = 0.01;
const CAMERA_FAR = 2600;
const MIN_CAMERA_DISTANCE = 0.025;
const MAX_CAMERA_DISTANCE = 2400;
const MIN_ORBIT_TARGET_DISTANCE = 0.12;
const WHEEL_ZOOM_SPEED = 0.004;
const WHEEL_LINE_HEIGHT = 16;
const PINCH_ZOOM_POWER = 1.45;
const INITIAL_CAMERA_TARGET = new THREE.Vector3(50, 5, -55);
const INITIAL_CAMERA_POSITION = new THREE.Vector3(-20, 14, 35);
const WORLD_FOCUS_CENTER = new THREE.Vector3(GROUND_CENTER_X, 0, -75);
const WORLD_FOCUS_RADIUS = GROUND_SIZE * 0.72;
const TAP_FOCUS_MAX_DURATION = 280;
const TAP_FOCUS_MAX_MOVEMENT = 10;
const DOUBLE_TAP_MAX_DELAY = 360;
const DOUBLE_TAP_MAX_MOVEMENT = 34;
const FOCUS_DISTANCE_SCALE = 0.45;
const FOCUS_MIN_DISTANCE = 1.2;
const FOCUS_MAX_DISTANCE = 180;

const sceneRoot = document.querySelector('#app');

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: false,
  logarithmicDepthBuffer: true,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(sceneRoot.clientWidth, sceneRoot.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
sceneRoot.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#05070d');
scene.fog = new THREE.Fog('#05070d', 620, 1800);

const camera = new THREE.PerspectiveCamera(48, sceneRoot.clientWidth / sceneRoot.clientHeight, 0.01, 5000);
camera.position.set(56, 34, 72);

const controls = new OrbitControls(camera, renderer.domElement);
configureControls();

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const pointerRay = new THREE.Ray();
const cameraForward = new THREE.Vector3();
const dollyMove = new THREE.Vector3();
const focusableObjects = [];
const activePointers = new Set();
const activePointerPositions = new Map();
const tapStart = {
  pointerId: null,
  x: 0,
  y: 0,
  time: 0,
};
const lastTap = {
  x: 0,
  y: 0,
  time: -Infinity,
};
let pinchDistance = null;

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
setupPointerFocus();
setInitialCameraView();
animate();

function buildScene() {
  OBJECTS.forEach((item) => {
    const scaleObject = createScaleObject(item);
    worldGroup.add(scaleObject);
    focusableObjects.push(scaleObject);
  });

  const groundGeometry = new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE);
  const groundMaterial = new THREE.MeshBasicMaterial({
    color: '#080a0e',
  });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.position.set(GROUND_CENTER_X, -0.014, 0);
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  focusableObjects.push(ground);

  const grid = new THREE.GridHelper(GROUND_SIZE, GROUND_SIZE / GRID_BOX_SIZE, '#1d222b', '#1d222b');
  grid.position.set(GROUND_CENTER_X, -0.002, 0);
  scene.add(grid);

  OBJECTS.forEach((item) => {
    scene.add(createGroundText(item.name, item.x - LABEL_GAP - LABEL_WIDTH / 2, item.z));
  });

  window.addEventListener('resize', onResize);
}

function setInitialCameraView() {
  camera.near = CAMERA_NEAR;
  camera.far = CAMERA_FAR;
  camera.updateProjectionMatrix();

  controls.target.copy(INITIAL_CAMERA_TARGET);
  camera.position.copy(INITIAL_CAMERA_POSITION);
  controls.update();
  controls.saveState();
}

function configureControls() {
  controls.enableDamping = true;
  controls.dampingFactor = 0.055;
  controls.enablePan = true;
  controls.enableRotate = true;
  controls.enableZoom = false;
  controls.rotateSpeed = 0.62;
  controls.panSpeed = 0.95;
  controls.keyPanSpeed = 24;
  controls.screenSpacePanning = true;
  controls.zoomToCursor = false;
  controls.minPolarAngle = Math.PI * 0.018;
  controls.maxPolarAngle = Math.PI * 0.495;
  controls.minDistance = MIN_CAMERA_DISTANCE;
  controls.maxDistance = MAX_CAMERA_DISTANCE;
  controls.minTargetRadius = 0;
  controls.maxTargetRadius = WORLD_FOCUS_RADIUS;
  controls.cursor.copy(WORLD_FOCUS_CENTER);
  controls.mouseButtons = {
    LEFT: THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.PAN,
  };
  controls.touches = {
    ONE: THREE.TOUCH.ROTATE,
    TWO: THREE.TOUCH.DOLLY_PAN,
  };
  controls.listenToKeyEvents(window);
}

function setupPointerFocus() {
  renderer.domElement.addEventListener('wheel', onWheelDolly, { capture: true, passive: false });
  renderer.domElement.addEventListener('pointerdown', onPointerDown, { capture: true, passive: true });
  renderer.domElement.addEventListener('pointermove', onPointerMove, { capture: true, passive: true });
  renderer.domElement.addEventListener('pointerup', onPointerUp, { capture: true, passive: true });
  renderer.domElement.addEventListener('pointercancel', onPointerCancel, { capture: true, passive: true });
}

function onWheelDolly(event) {
  event.preventDefault();
  event.stopImmediatePropagation();

  const deltaY = getNormalizedWheelDelta(event);
  const scale = Math.exp(-deltaY * WHEEL_ZOOM_SPEED);
  dollyFromScreenPoint(event.clientX, event.clientY, scale);
}

function onPointerDown(event) {
  activePointers.add(event.pointerId);
  activePointerPositions.set(event.pointerId, {
    x: event.clientX,
    y: event.clientY,
  });

  if (event.pointerType === 'touch' && activePointers.size === 2) {
    pinchDistance = getPinchDistance();
    tapStart.pointerId = null;
    return;
  }

  if (!event.isPrimary || activePointers.size !== 1) {
    tapStart.pointerId = null;
    return;
  }

  tapStart.pointerId = event.pointerId;
  tapStart.x = event.clientX;
  tapStart.y = event.clientY;
  tapStart.time = window.performance.now();
}

function onPointerMove(event) {
  if (!activePointers.has(event.pointerId)) {
    return;
  }

  activePointerPositions.set(event.pointerId, {
    x: event.clientX,
    y: event.clientY,
  });

  if (event.pointerType !== 'touch' || activePointers.size < 2) {
    return;
  }

  const nextPinch = getPinchState();

  if (!nextPinch || !pinchDistance) {
    pinchDistance = nextPinch ? nextPinch.distance : null;
    return;
  }

  const scale = Math.pow(nextPinch.distance / pinchDistance, PINCH_ZOOM_POWER);
  pinchDistance = nextPinch.distance;

  if (Number.isFinite(scale) && scale > 0) {
    dollyFromScreenPoint(nextPinch.centerX, nextPinch.centerY, scale);
  }
}

function onPointerUp(event) {
  const wasSinglePointerTap = activePointers.size === 1 && tapStart.pointerId === event.pointerId;
  activePointers.delete(event.pointerId);
  activePointerPositions.delete(event.pointerId);

  if (activePointers.size < 2) {
    pinchDistance = null;
  }

  if (!wasSinglePointerTap || !event.isPrimary) {
    return;
  }

  const now = window.performance.now();
  const movement = getScreenDistance(event.clientX, event.clientY, tapStart.x, tapStart.y);
  const duration = now - tapStart.time;

  tapStart.pointerId = null;

  if (movement > TAP_FOCUS_MAX_MOVEMENT || duration > TAP_FOCUS_MAX_DURATION) {
    return;
  }

  const delay = now - lastTap.time;
  const tapDistance = getScreenDistance(event.clientX, event.clientY, lastTap.x, lastTap.y);
  const isDoubleTap = delay <= DOUBLE_TAP_MAX_DELAY && tapDistance <= DOUBLE_TAP_MAX_MOVEMENT;

  lastTap.x = event.clientX;
  lastTap.y = event.clientY;
  lastTap.time = now;

  if (isDoubleTap) {
    focusCameraAt(event.clientX, event.clientY);
    lastTap.time = -Infinity;
  }
}

function onPointerCancel(event) {
  activePointers.delete(event.pointerId);
  activePointerPositions.delete(event.pointerId);
  tapStart.pointerId = null;

  if (activePointers.size < 2) {
    pinchDistance = null;
  }
}

function focusCameraAt(clientX, clientY) {
  const focusPoint = getFocusPoint(clientX, clientY);

  if (!focusPoint) {
    return;
  }

  const cameraOffset = camera.position.clone().sub(controls.target);
  const currentDistance = cameraOffset.length();

  if (currentDistance <= 0.0001) {
    return;
  }

  const direction = cameraOffset.normalize();
  const nextDistance = THREE.MathUtils.clamp(
    currentDistance * FOCUS_DISTANCE_SCALE,
    FOCUS_MIN_DISTANCE,
    FOCUS_MAX_DISTANCE,
  );

  controls.target.copy(focusPoint);
  controls.cursor.copy(focusPoint);
  camera.position.copy(focusPoint).addScaledVector(direction, nextDistance);
  controls.update();
}

function dollyFromScreenPoint(clientX, clientY, scale) {
  if (!Number.isFinite(scale) || scale <= 0 || Math.abs(scale - 1) < 0.0001) {
    return;
  }

  const ray = getPointerRay(clientX, clientY);
  const hit = getFocusHit(clientX, clientY);
  const currentDistance = hit
    ? camera.position.distanceTo(hit.point)
    : camera.position.distanceTo(controls.target);

  if (!Number.isFinite(currentDistance) || (scale > 1 && currentDistance <= MIN_CAMERA_DISTANCE)) {
    return;
  }

  const nextDistance = THREE.MathUtils.clamp(
    currentDistance / scale,
    MIN_CAMERA_DISTANCE,
    MAX_CAMERA_DISTANCE,
  );
  const moveDistance = currentDistance - nextDistance;

  if (Math.abs(moveDistance) < 0.00001) {
    return;
  }

  dollyMove.copy(ray.direction).multiplyScalar(moveDistance);
  camera.position.add(dollyMove);

  const pivotDistance = getOrbitTargetDistance(hit ? hit.point : null, nextDistance);
  camera.getWorldDirection(cameraForward);
  controls.target.copy(camera.position).addScaledVector(cameraForward, pivotDistance);
  controls.cursor.copy(controls.target);
  controls.update();
}

function getOrbitTargetDistance(hitPoint, fallbackDistance) {
  if (!hitPoint) {
    return THREE.MathUtils.clamp(fallbackDistance, MIN_ORBIT_TARGET_DISTANCE, MAX_CAMERA_DISTANCE);
  }

  camera.getWorldDirection(cameraForward);
  const depth = hitPoint.clone().sub(camera.position).dot(cameraForward);
  return THREE.MathUtils.clamp(depth, MIN_ORBIT_TARGET_DISTANCE, MAX_CAMERA_DISTANCE);
}

function getPointerRay(clientX, clientY) {
  setPointerFromClient(clientX, clientY);
  raycaster.setFromCamera(pointer, camera);
  pointerRay.copy(raycaster.ray);
  return pointerRay;
}

function getFocusHit(clientX, clientY) {
  setPointerFromClient(clientX, clientY);
  raycaster.setFromCamera(pointer, camera);

  const hits = raycaster.intersectObjects(focusableObjects, true);
  return hits.length > 0 ? hits[0] : null;
}

function getFocusPoint(clientX, clientY) {
  const hit = getFocusHit(clientX, clientY);
  return hit ? hit.point : null;
}

function setPointerFromClient(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
}

function getScreenDistance(x1, y1, x2, y2) {
  return Math.hypot(x1 - x2, y1 - y2);
}

function getNormalizedWheelDelta(event) {
  if (event.deltaMode === 1) {
    return event.deltaY * WHEEL_LINE_HEIGHT;
  }

  if (event.deltaMode === 2) {
    return event.deltaY * renderer.domElement.clientHeight;
  }

  return event.deltaY;
}

function getPinchState() {
  const positions = [...activePointerPositions.values()];

  if (positions.length < 2) {
    return null;
  }

  const [first, second] = positions;
  return {
    centerX: (first.x + second.x) * 0.5,
    centerY: (first.y + second.y) * 0.5,
    distance: getScreenDistance(first.x, first.y, second.x, second.y),
  };
}

function getPinchDistance() {
  const pinch = getPinchState();
  return pinch ? pinch.distance : null;
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

  if (item.shape === 'blueWhale') {
    return createBlueWhale(item);
  }

  if (item.shape === 'soccerField') {
    return createSoccerField(item);
  }

  if (item.shape === 'distancePlane') {
    return createDistancePlane(item);
  }

  if (item.shape === 'boeing737') {
    return createBoeing737(item);
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

function createBlueWhale(item) {
  const group = new THREE.Group();
  const topColor = item.color;
  const bellyColor = '#8fb5c6';
  const finColor = '#2f5371';
  const bodyY = item.height * 0.52;

  group.add(createEllipsoidMesh(
    topColor,
    item.x + item.length * 0.42,
    bodyY,
    item.z,
    item.length * 0.42,
    item.height * 0.42,
    item.width * 0.46,
    18,
    9,
  ));
  group.add(createEllipsoidMesh(
    bellyColor,
    item.x + item.length * 0.35,
    item.height * 0.36,
    item.z,
    item.length * 0.31,
    item.height * 0.13,
    item.width * 0.37,
    14,
    6,
  ));
  group.add(createOrientedCylinder(
    new THREE.Vector3(item.x + item.length * 0.78, item.height * 0.54, item.z),
    new THREE.Vector3(item.x + item.length * 0.95, item.height * 0.49, item.z),
    item.height * 0.17,
    item.height * 0.065,
    finColor,
    8,
  ));

  const tailY = item.height * 0.51;
  const tailRootX = item.x + item.length * 0.92;
  const tailTipX = item.x + item.length;
  [-1, 1].forEach((side) => {
    const points = side > 0
      ? [
          [tailRootX, item.z + item.width * 0.04],
          [tailTipX, item.z + item.width * 0.56],
          [item.x + item.length * 0.88, item.z + item.width * 0.22],
        ]
      : [
          [tailRootX, item.z - item.width * 0.04],
          [item.x + item.length * 0.88, item.z - item.width * 0.22],
          [tailTipX, item.z - item.width * 0.56],
        ];
    group.add(createPrismFromXZ(points, tailY, item.height * 0.055, finColor));

    const finRootZ = item.z + side * item.width * 0.33;
    const finTipZ = item.z + side * item.width * 0.82;
    const finPoints = side > 0
      ? [
          [item.x + item.length * 0.34, finRootZ],
          [item.x + item.length * 0.49, finRootZ + item.width * 0.06],
          [item.x + item.length * 0.40, finTipZ],
        ]
      : [
          [item.x + item.length * 0.34, finRootZ],
          [item.x + item.length * 0.40, finTipZ],
          [item.x + item.length * 0.49, finRootZ - item.width * 0.06],
        ];
    group.add(createPrismFromXZ(finPoints, item.height * 0.34, item.height * 0.07, finColor));

    group.add(createEllipsoidMesh(
      '#06101b',
      item.x + item.length * 0.13,
      item.height * 0.62,
      item.z + side * item.width * 0.34,
      item.length * 0.008,
      item.height * 0.026,
      item.width * 0.018,
      6,
      4,
    ));
  });

  group.add(createPrismFromXY([
    [item.x + item.length * 0.59, item.height * 0.79],
    [item.x + item.length * 0.66, item.height * 0.98],
    [item.x + item.length * 0.71, item.height * 0.78],
  ], item.z, item.width * 0.065, finColor));
  group.add(createLowPolyMesh(
    new THREE.BoxGeometry(item.length * 0.024, item.height * 0.012, item.width * 0.075),
    '#172d42',
    item.x + item.length * 0.29,
    item.height * 0.9,
    item.z,
  ));
  group.add(createHumanAt(item.x + item.length * 0.14, item.z + item.width / 2 + 1.25, '#51e4d4'));

  return group;
}

function createSoccerField(item) {
  const group = new THREE.Group();
  const topY = item.height + 0.012;
  const lineColor = '#eef3ff';
  const lineWidth = 0.28;
  const xMin = item.x;
  const xMax = item.x + item.length;
  const zMin = item.z - item.width / 2;
  const zMax = item.z + item.width / 2;

  const bands = 10;
  for (let band = 0; band < bands; band += 1) {
    const bandLength = item.length / bands;
    group.add(createLowPolyMesh(
      new THREE.BoxGeometry(bandLength, item.height, item.width),
      band % 2 === 0 ? '#2d8147' : '#23683a',
      item.x + bandLength * (band + 0.5),
      item.height / 2,
      item.z,
    ));
  }

  addRectLines(group, xMin, xMax, zMin, zMax, topY, lineWidth, lineColor);
  group.add(createFieldLine(item.x + item.length / 2, item.z, lineWidth, item.width, topY, lineColor));
  group.add(createFieldCircle(item.x + item.length / 2, item.z, 9.15, lineWidth * 0.42, topY, lineColor));
  group.add(createFieldSpot(item.x + item.length / 2, item.z, 0.42, topY, lineColor));

  const penaltyDepth = 16.5;
  const penaltyWidth = 40.32;
  const goalDepth = 5.5;
  const goalAreaWidth = 18.32;
  const penaltySpotDistance = 11;
  addRectLines(group, xMin, xMin + penaltyDepth, item.z - penaltyWidth / 2, item.z + penaltyWidth / 2, topY, lineWidth, lineColor);
  addRectLines(group, xMax - penaltyDepth, xMax, item.z - penaltyWidth / 2, item.z + penaltyWidth / 2, topY, lineWidth, lineColor);
  addRectLines(group, xMin, xMin + goalDepth, item.z - goalAreaWidth / 2, item.z + goalAreaWidth / 2, topY, lineWidth, lineColor);
  addRectLines(group, xMax - goalDepth, xMax, item.z - goalAreaWidth / 2, item.z + goalAreaWidth / 2, topY, lineWidth, lineColor);
  group.add(createFieldSpot(xMin + penaltySpotDistance, item.z, 0.34, topY, lineColor));
  group.add(createFieldSpot(xMax - penaltySpotDistance, item.z, 0.34, topY, lineColor));

  [
    [7, 0, '#51e4d4'],
    [24, -18, '#51e4d4'],
    [24, 18, '#51e4d4'],
    [43, -9, '#51e4d4'],
    [43, 9, '#51e4d4'],
    [57, 0, '#51e4d4'],
    [98, 0, '#ffcf5c'],
    [81, -18, '#ffcf5c'],
    [81, 18, '#ffcf5c'],
    [62, -9, '#ffcf5c'],
    [62, 9, '#ffcf5c'],
    [48, 0, '#ffcf5c'],
  ].forEach(([x, z, color]) => {
    group.add(createHumanAt(item.x + x, item.z + z, color, item.height));
  });

  return group;
}

function createDistancePlane(item) {
  const group = new THREE.Group();
  const topY = item.height + 0.014;

  group.add(createLowPolyMesh(
    new THREE.BoxGeometry(item.length, item.height, item.width),
    item.color,
    item.x + item.length / 2,
    item.height / 2,
    item.z,
  ));

  group.add(createFieldLine(item.x + item.length / 2, item.z, item.length, 0.18, topY, '#4f8cc9'));

  group.add(createHumanAt(item.x + 2, item.z + item.width / 2 + 1.55, '#9fe870'));
  return group;
}

function createBoeing737(item) {
  const group = new THREE.Group();
  const fuselageRadius = item.fuselageDiameter / 2;
  const fuselageY = fuselageRadius + item.height * 0.08;
  const bodyColor = item.color;
  const bellyColor = '#aeb7c4';
  const wingColor = '#c3ccd8';
  const tailColor = '#3e73a9';
  const noseTip = new THREE.Vector3(item.x, fuselageY, item.z);
  const noseBase = new THREE.Vector3(item.x + item.length * 0.11, fuselageY, item.z);
  const bodyEnd = new THREE.Vector3(item.x + item.length * 0.84, fuselageY, item.z);
  const tailEnd = new THREE.Vector3(item.x + item.length * 0.97, fuselageY + fuselageRadius * 0.12, item.z);

  group.add(createOrientedCone(noseBase, noseTip, fuselageRadius, bodyColor, 12));
  group.add(createOrientedCylinder(noseBase, bodyEnd, fuselageRadius, fuselageRadius * 0.94, bodyColor, 14));
  group.add(createOrientedCylinder(bodyEnd, tailEnd, fuselageRadius * 0.94, fuselageRadius * 0.32, bodyColor, 10));
  group.add(createOrientedCylinder(
    new THREE.Vector3(item.x + item.length * 0.16, fuselageY - fuselageRadius * 0.64, item.z),
    new THREE.Vector3(item.x + item.length * 0.76, fuselageY - fuselageRadius * 0.64, item.z),
    fuselageRadius * 0.2,
    fuselageRadius * 0.16,
    bellyColor,
    8,
  ));

  [-1, 1].forEach((side) => {
    const innerZ = item.z + side * fuselageRadius * 0.55;
    const outerZ = item.z + side * item.width / 2;
    const wingPoints = side > 0
      ? [
          [item.x + item.length * 0.43, innerZ],
          [item.x + item.length * 0.56, item.z + side * fuselageRadius * 0.68],
          [item.x + item.length * 0.63, outerZ],
          [item.x + item.length * 0.52, outerZ],
        ]
      : [
          [item.x + item.length * 0.43, innerZ],
          [item.x + item.length * 0.52, outerZ],
          [item.x + item.length * 0.63, outerZ],
          [item.x + item.length * 0.56, item.z + side * fuselageRadius * 0.68],
        ];
    group.add(createPrismFromXZ(wingPoints, fuselageY - fuselageRadius * 0.08, 0.28, wingColor));

    const stabilizerPoints = side > 0
      ? [
          [item.x + item.length * 0.82, item.z + side * fuselageRadius * 0.45],
          [item.x + item.length * 0.96, item.z + side * item.width * 0.22],
          [item.x + item.length * 0.88, item.z + side * item.width * 0.24],
        ]
      : [
          [item.x + item.length * 0.82, item.z + side * fuselageRadius * 0.45],
          [item.x + item.length * 0.88, item.z + side * item.width * 0.24],
          [item.x + item.length * 0.96, item.z + side * item.width * 0.22],
        ];
    group.add(createPrismFromXZ(stabilizerPoints, fuselageY + fuselageRadius * 1.08, 0.22, wingColor));

    const engineStart = new THREE.Vector3(item.x + item.length * 0.48, fuselageY - fuselageRadius * 1.06, item.z + side * item.width * 0.22);
    const engineEnd = new THREE.Vector3(item.x + item.length * 0.57, fuselageY - fuselageRadius * 1.06, item.z + side * item.width * 0.22);
    group.add(createOrientedCylinder(engineStart, engineEnd, 0.82, 0.72, '#8793a3', 10));
    group.add(createOrientedCylinder(engineStart, engineStart.clone().add(new THREE.Vector3(0.12, 0, 0)), 0.66, 0.62, '#07101a', 10));

    const mainWheelZ = item.z + side * 1.15;
    group.add(createWheel(item.x + item.length * 0.53, 0.42, mainWheelZ, 0.42, 0.24, '#090c12'));
    group.add(createLimb(
      new THREE.Vector3(item.x + item.length * 0.53, fuselageY - fuselageRadius * 0.92, mainWheelZ),
      new THREE.Vector3(item.x + item.length * 0.53, 0.82, mainWheelZ),
      0.055,
      '#9aa5b2',
    ));
  });

  group.add(createPrismFromXY([
    [item.x + item.length * 0.82, fuselageY + fuselageRadius * 0.6],
    [item.x + item.length * 0.91, item.height],
    [item.x + item.length * 0.98, fuselageY + fuselageRadius * 0.86],
  ], item.z, 0.58, tailColor));

  for (let windowIndex = 0; windowIndex < 13; windowIndex += 1) {
    const windowX = item.x + item.length * (0.19 + windowIndex * 0.045);
    [-1, 1].forEach((side) => {
      group.add(createLowPolyMesh(
        new THREE.BoxGeometry(0.42, 0.22, 0.035),
        '#0d1724',
        windowX,
        fuselageY + fuselageRadius * 0.38,
        item.z + side * (fuselageRadius + 0.025),
      ));
    });
  }

  [-1, 1].forEach((side) => {
    group.add(createLowPolyMesh(
      new THREE.BoxGeometry(0.58, 0.28, 0.04),
      '#0d1724',
      item.x + item.length * 0.08,
      fuselageY + fuselageRadius * 0.45,
      item.z + side * (fuselageRadius + 0.03),
    ));
  });

  group.add(createWheel(item.x + item.length * 0.18, 0.33, item.z, 0.33, 0.22, '#090c12'));
  group.add(createLimb(
    new THREE.Vector3(item.x + item.length * 0.18, fuselageY - fuselageRadius * 0.86, item.z),
    new THREE.Vector3(item.x + item.length * 0.18, 0.65, item.z),
    0.052,
    '#9aa5b2',
  ));
  group.add(createHumanAt(item.x + item.length * 0.16, item.z + item.width / 2 + 1.7, '#51e4d4'));

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

function createHumanAt(centerX, centerZ, color, baseY = 0) {
  const human = createHumanSilhouette({
    ...HUMAN_SCALE,
    color,
    x: centerX - HUMAN_SCALE.length / 2,
    z: centerZ,
  });
  human.position.y = baseY;
  return human;
}

function createEllipsoidMesh(color, x, y, z, scaleX, scaleY, scaleZ, widthSegments = 12, heightSegments = 6) {
  const mesh = createLowPolyMesh(
    new THREE.SphereGeometry(1, widthSegments, heightSegments),
    color,
    x,
    y,
    z,
  );
  mesh.scale.set(scaleX, scaleY, scaleZ);
  return mesh;
}

function createOrientedCylinder(start, end, startRadius, endRadius, color, radialSegments = 8) {
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();
  const mesh = createLowPolyMesh(
    new THREE.CylinderGeometry(endRadius, startRadius, length, radialSegments),
    color,
    0,
    0,
    0,
  );
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return mesh;
}

function createOrientedCone(base, tip, radius, color, radialSegments = 8) {
  const direction = new THREE.Vector3().subVectors(tip, base);
  const length = direction.length();
  const mesh = createLowPolyMesh(
    new THREE.ConeGeometry(radius, length, radialSegments),
    color,
    0,
    0,
    0,
  );
  mesh.position.copy(base).add(tip).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return mesh;
}

function createPrismFromXZ(points, centerY, thickness, color) {
  const halfThickness = thickness / 2;
  const positions = [
    ...points.flatMap(([x, z]) => [x, centerY - halfThickness, z]),
    ...points.flatMap(([x, z]) => [x, centerY + halfThickness, z]),
  ];
  const geometry = new THREE.BufferGeometry();
  const indices = createPrismIndices(points.length);
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const material = createLowPolyMaterial(color);
  material.side = THREE.DoubleSide;
  return new THREE.Mesh(geometry, material);
}

function createPrismFromXY(points, centerZ, thickness, color) {
  const halfThickness = thickness / 2;
  const positions = [
    ...points.flatMap(([x, y]) => [x, y, centerZ - halfThickness]),
    ...points.flatMap(([x, y]) => [x, y, centerZ + halfThickness]),
  ];
  const geometry = new THREE.BufferGeometry();
  const indices = createPrismIndices(points.length);
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const material = createLowPolyMaterial(color);
  material.side = THREE.DoubleSide;
  return new THREE.Mesh(geometry, material);
}

function createPrismIndices(pointCount) {
  const indices = [];
  for (let index = 1; index < pointCount - 1; index += 1) {
    indices.push(0, index, index + 1);
    indices.push(pointCount, pointCount + index + 1, pointCount + index);
  }
  for (let index = 0; index < pointCount; index += 1) {
    const next = (index + 1) % pointCount;
    indices.push(index, next, pointCount + next);
    indices.push(index, pointCount + next, pointCount + index);
  }
  return indices;
}

function createFieldLine(centerX, centerZ, lengthX, lengthZ, y, color) {
  return createLowPolyMesh(
    new THREE.BoxGeometry(lengthX, 0.035, lengthZ),
    color,
    centerX,
    y,
    centerZ,
  );
}

function addRectLines(group, xMin, xMax, zMin, zMax, y, thickness, color) {
  const centerX = (xMin + xMax) / 2;
  const centerZ = (zMin + zMax) / 2;
  group.add(createFieldLine(centerX, zMin, xMax - xMin, thickness, y, color));
  group.add(createFieldLine(centerX, zMax, xMax - xMin, thickness, y, color));
  group.add(createFieldLine(xMin, centerZ, thickness, zMax - zMin, y, color));
  group.add(createFieldLine(xMax, centerZ, thickness, zMax - zMin, y, color));
}

function createFieldCircle(x, z, radius, tubeRadius, y, color) {
  const circle = new THREE.Mesh(
    new THREE.TorusGeometry(radius, tubeRadius, 4, 48),
    createLowPolyMaterial(color),
  );
  circle.position.set(x, y + 0.008, z);
  circle.rotation.x = Math.PI / 2;
  return circle;
}

function createFieldSpot(x, z, radius, y, color) {
  return createLowPolyMesh(
    new THREE.CylinderGeometry(radius, radius, 0.035, 12),
    color,
    x,
    y + 0.01,
    z,
  );
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
}

function animate() {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
