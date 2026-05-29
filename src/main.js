import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import './styles.css';

const OBJECTS = [
  { name: 'Car', shape: 'car', length: 5.021, width: 1.987, height: 1.43, color: '#ffb45f', x: 0, z: 0, scaleHuman: true },
  { name: 'Soccer field', shape: 'soccerField', length: 105, width: 68, height: 0.32, color: '#28733f', x: 0, z: -55 },
  { name: '100 m', shape: 'track', length: 100, lanes: 8, laneWidth: 1.22, height: 0.32, color: '#b9573f', x: 0, z: -8 },
  { name: '1 km', shape: 'distancePlane', length: 1000, width: 18, height: 0.32, color: '#172335', x: 0, z: -112 },
  { name: '1 mile', shape: 'distancePlane', length: 1609.344, width: 18, height: 0.32, color: '#1b2b43', x: 0, z: -136 },
  { name: 'Boeing 737', shape: 'boeing737', length: 39.5, width: 35.8, height: 12.5, fuselageDiameter: 3.76, color: '#f6f8fb', x: 0, z: -180 },
  { name: 'Blue whale', shape: 'blueWhale', length: 29.9, width: 5.2, height: 4.2, color: '#416d92', x: 0, z: -220 },
  {
    name: 'Eiffel Tower',
    shape: 'eiffelTower',
    length: 124.9,
    width: 124.9,
    height: 330,
    footWidth: 25,
    archSpan: 74.24,
    floorHeights: [57.64, 115.73, 276.13],
    floorSides: [70.69, 40.96, 18.65],
    structuralHeight: 324,
    color: '#9d6b2f',
    x: 0,
    z: -320,
  },
];
const CUSTOM_OBJECT_COLOR = '#cfcfcf';
const CUSTOM_OBJECT_ROW_GAP = 8;
const GROUND_SIZE = 6000;
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

const scaleObjectGroups = [];
const scaleObjectLabels = [];
let customObjectDimensions = null;

buildScene();
setupBrandLabel();
setupCustomForm();
setupPointerFocus();
setInitialCameraView();
animate();

function buildScene() {
  rebuildScaleObjects();

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

  window.addEventListener('resize', onResize);
}

function setupBrandLabel() {
  const brandLabel = document.createElement('div');
  brandLabel.className = 'brand-label';
  brandLabel.textContent = 'HumanForScale';
  sceneRoot.appendChild(brandLabel);
}

function setupCustomForm() {
  const form = document.createElement('form');
  form.className = 'custom-dimensions-form';
  form.setAttribute('aria-label', 'Add custom cuboid');
  form.innerHTML = `
    <div class="custom-dimensions-form__title">Add a custom object</div>
    <label class="custom-dimensions-form__field">
      <span>Length <small>(m)</small></span>
      <input name="custom-length" type="number" inputmode="decimal" min="0.01" step="0.01" placeholder="5.00" required>
    </label>
    <label class="custom-dimensions-form__field">
      <span>Width <small>(m)</small></span>
      <input name="custom-width" type="number" inputmode="decimal" min="0.01" step="0.01" placeholder="2.00" required>
    </label>
    <label class="custom-dimensions-form__field">
      <span>Height <small>(m)</small></span>
      <input name="custom-height" type="number" inputmode="decimal" min="0.01" step="0.01" placeholder="1.80" required>
    </label>
    <button type="submit">Add</button>
    <p class="custom-dimensions-form__message" aria-live="polite"></p>
  `;
  form.addEventListener('submit', onCustomFormSubmit);
  sceneRoot.appendChild(form);
}

function onCustomFormSubmit(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const dimensions = getCustomDimensions(form);
  const message = form.querySelector('.custom-dimensions-form__message');

  if (!dimensions) {
    message.textContent = 'Use positive metre values.';
    return;
  }

  message.textContent = '';
  form.querySelector('button').textContent = 'Update';
  setCustomObject(dimensions);
}

function getCustomDimensions(form) {
  const values = ['length', 'width', 'height'].map((key) => {
    const input = form.elements.namedItem(`custom-${key}`);
    return Number.parseFloat(input.value);
  });

  if (values.some((value) => !Number.isFinite(value) || value <= 0)) {
    return null;
  }

  const [length, width, height] = values;
  return { length, width, height };
}

function setCustomObject(dimensions) {
  customObjectDimensions = dimensions;
  const [customObject] = rebuildScaleObjects();
  focusCameraOnItem(customObject);
}

function rebuildScaleObjects() {
  clearScaleObjects();

  const items = getVisibleScaleObjects();
  items.forEach((item) => {
    const scaleObject = createScaleObject(item);
    worldGroup.add(scaleObject);
    scaleObjectGroups.push(scaleObject);
    focusableObjects.push(scaleObject);
  });

  items.forEach((item) => {
    const label = createGroundText(item.name, item.x - LABEL_GAP - LABEL_WIDTH / 2, item.z);
    scene.add(label);
    scaleObjectLabels.push(label);
  });

  return items;
}

function clearScaleObjects() {
  scaleObjectGroups.splice(0).forEach((scaleObject) => {
    const focusIndex = focusableObjects.indexOf(scaleObject);
    if (focusIndex >= 0) {
      focusableObjects.splice(focusIndex, 1);
    }
    disposeSceneObject(scaleObject);
  });

  scaleObjectLabels.splice(0).forEach(disposeSceneObject);
}

function getVisibleScaleObjects() {
  if (!customObjectDimensions) {
    return OBJECTS.map((item) => ({ ...item }));
  }

  const customObject = createCustomObjectItem(customObjectDimensions);
  const firstObject = OBJECTS[0];
  const zOffset = -(customObject.width / 2 + firstObject.width / 2 + CUSTOM_OBJECT_ROW_GAP);
  const shiftedObjects = OBJECTS.map((item) => ({
    ...item,
    z: item.z + zOffset,
  }));

  return [customObject, ...shiftedObjects];
}

function createCustomObjectItem({ length, width, height }) {
  return {
    name: 'Custom',
    shape: 'customCuboid',
    length,
    width,
    height,
    color: CUSTOM_OBJECT_COLOR,
    x: 0,
    z: 0,
  };
}

function focusCameraOnItem(item) {
  const center = new THREE.Vector3(item.x + item.length / 2, item.height / 2, item.z);
  const largestDimension = Math.max(item.length, item.width, item.height, HUMAN_SCALE.height);
  const distance = THREE.MathUtils.clamp(largestDimension * 1.5, 4, MAX_CAMERA_DISTANCE * 0.9);
  const cameraDirection = new THREE.Vector3(-0.62, 0.42, 0.66).normalize();

  controls.target.copy(center);
  controls.cursor.copy(center);
  camera.position.copy(center).addScaledVector(cameraDirection, distance);
  controls.update();
}

function disposeSceneObject(object) {
  object.removeFromParent();
  object.traverse((node) => {
    if (node.geometry) {
      node.geometry.dispose();
    }

    const materials = Array.isArray(node.material) ? node.material : [node.material];
    materials.filter(Boolean).forEach((material) => {
      Object.values(material).forEach((value) => {
        if (value?.isTexture) {
          value.dispose();
        }
      });
      material.dispose();
    });
  });
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

  if (item.shape === 'eiffelTower') {
    return createEiffelTower(item);
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

  if (item.shape === 'customCuboid') {
    return createCustomCuboid(item);
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

function createCustomCuboid(item) {
  const group = createSolidCuboid(item);
  const sideGap = Math.max(0.45, Math.min(2.5, item.width * 0.06 + 0.4));
  const humanX = item.x + 1;
  const humanZ = item.z + item.width / 2 + sideGap;

  group.add(createHumanAt(humanX, humanZ, CUSTOM_OBJECT_COLOR));
  return group;
}

function createRaceTrack(item) {
  const trackWidth = item.lanes * item.laneWidth;
  const track = { ...item, width: trackWidth };
  const group = createSolidCuboid(track);
  const trackTopY = item.height + 0.012;
  const laneLineWidth = 0.05;
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

function createEiffelTower(item) {
  const group = new THREE.Group();
  const centerX = item.x + item.length / 2;
  const centerZ = item.z;
  const ironColor = item.color;
  const braceColor = '#5f3a18';
  const deckColor = '#b17b35';
  const shadowColor = '#4b2d12';
  const lightColor = '#97dcff';
  const [firstFloor, secondFloor, thirdFloor] = item.floorHeights;
  const [firstSide, secondSide, thirdSide] = item.floorSides;
  const footTopY = 4.6;
  const topCrownLowerBeltThickness = 2.25;
  const topCrownUpperBeltThickness = 2.85;
  const topCrownBeltGap = 0.8;
  const topCrownArcRise = 7.0;
  const topRodBaseY = item.structuralHeight - 1.4;
  const topCrownStructureY = topRodBaseY - topCrownArcRise - 0.2 - topCrownBeltGap - 2.25 * 1.5;
  const topCrownStructureSide = thirdSide * 0.95;
  const topCrownBeltY = topRodBaseY
    - topCrownArcRise
    - 0.2
    - topCrownBeltGap
    - topCrownLowerBeltThickness / 2
    - topCrownUpperBeltThickness;
  const topCrownUpperBeltSide = thirdSide * 0.88;
  const topCrownLowerBeltSide = thirdSide * 1.12;
  const upperShaftLowerY = THREE.MathUtils.lerp(secondFloor, thirdFloor, 0.21);
  const upperShaftUpperY = THREE.MathUtils.lerp(secondFloor, thirdFloor, 0.59);
  const levels = [
    { y: footTopY, side: item.length, radius: 2.3 },
    { y: 20, side: 112, radius: 2.0 },
    { y: 39, side: 90, radius: 1.65 },
    { y: firstFloor, side: firstSide, radius: 1.35 },
    { y: 85, side: 54, radius: 1.05 },
    { y: secondFloor, side: secondSide, radius: 0.82 },
    { y: upperShaftLowerY, side: 34, radius: 0.68 },
    { y: upperShaftUpperY, side: 24, radius: 0.52 },
    { y: thirdFloor, side: thirdSide, radius: 0.38 },
    { y: topCrownStructureY, side: topCrownStructureSide, radius: 0.26 },
  ];

  addEiffelFeet(group, centerX, centerZ, item.length, item.archSpan, shadowColor);
  addEiffelBaseFaces(group, centerX, centerZ, levels, item.archSpan, firstFloor, firstSide, ironColor, braceColor);

  for (let index = 0; index < levels.length - 1; index += 1) {
    const lower = levels[index];
    const upper = levels[index + 1];
    addEiffelCornerLegs(group, centerX, centerZ, levels, lower, upper, ironColor);

    if (lower.y >= firstFloor) {
      for (let face = 0; face < 4; face += 1) {
        if (upper.y <= secondFloor) {
          addEiffelMiddleVoidPanels(
            group,
            centerX,
            centerZ,
            levels,
            face,
            lower,
            upper,
            firstFloor,
            secondFloor,
            braceColor,
          );
        } else {
          addEiffelFacePanel(
            group,
            centerX,
            centerZ,
            levels,
            face,
            lower.y,
            upper.y,
            -lower.side / 2,
            lower.side / 2,
            -upper.side / 2,
            upper.side / 2,
            braceColor,
            Math.max(lower.radius * 0.28, 0.07),
            Math.max(2, Math.ceil((upper.y - lower.y) / 18)),
          );
        }
      }
    }
  }

  addEiffelBeltPlatform(group, centerX, centerZ, firstSide, firstFloor, deckColor, braceColor, lightColor, {
    heightAbove: 18,
    deckThickness: 3.6,
  });
  addEiffelBeltPlatform(group, centerX, centerZ, secondSide, secondFloor, deckColor, braceColor, lightColor, {
    heightAbove: 11.5,
    deckThickness: 2.7,
  });
  addEiffelTopCrown(
    group,
    centerX,
    centerZ,
    topCrownBeltY,
    topCrownUpperBeltSide,
    item.height,
    deckColor,
    braceColor,
    {
      beltGap: topCrownBeltGap,
      lowerBeltSide: topCrownLowerBeltSide,
      lowerBeltThickness: topCrownLowerBeltThickness,
      upperBeltThickness: topCrownUpperBeltThickness,
    },
  );
  group.add(createHumanAt(centerX - item.length / 2 + 9, centerZ + item.width / 2 + 3.2, '#51e4d4'));

  return group;
}

function addEiffelFeet(group, centerX, centerZ, baseSide, archSpan, color) {
  const footSize = (baseSide - archSpan) / 2;
  const footOffset = baseSide / 2 - footSize / 2;
  const footHeight = 4.6;

  [-1, 1].forEach((xSide) => {
    [-1, 1].forEach((zSide) => {
      group.add(createLowPolyMesh(
        new THREE.BoxGeometry(footSize, footHeight, footSize),
        color,
        centerX + xSide * footOffset,
        footHeight / 2,
        centerZ + zSide * footOffset,
      ));
    });
  });
}

function addEiffelCornerLegs(group, centerX, centerZ, levels, lower, upper, color) {
  const lowerCorners = getEiffelCorners(centerX, centerZ, levels, lower.y);
  const upperCorners = getEiffelCorners(centerX, centerZ, levels, upper.y);

  for (let index = 0; index < 4; index += 1) {
    addEiffelRodBetween(group, lowerCorners[index], upperCorners[index], lower.radius, color, 6);
  }
}

function addEiffelBaseFaces(group, centerX, centerZ, levels, archSpan, firstFloor, firstSide, ironColor, braceColor) {
  const baseY = levels[0].y;
  const baseHalf = getEiffelSideAt(levels, baseY) / 2;
  const archHalf = archSpan / 2;
  const topHalf = firstSide / 2;

  for (let face = 0; face < 4; face += 1) {
    addEiffelFacePanel(group, centerX, centerZ, levels, face, baseY, firstFloor, -baseHalf, -archHalf, -topHalf, -12, braceColor, 0.42, 5);
    addEiffelFacePanel(group, centerX, centerZ, levels, face, baseY, firstFloor, archHalf, baseHalf, 12, topHalf, braceColor, 0.42, 5);
    addEiffelBaseArch(group, centerX, centerZ, levels, face, archSpan, firstFloor, ironColor, braceColor);
  }
}

function addEiffelBaseArch(group, centerX, centerZ, levels, face, span, firstFloor, ironColor, braceColor) {
  const archPoints = [];
  const springY = levels[0].y + 1.6;
  const peakY = firstFloor - 6.5;

  for (let index = 0; index <= 20; index += 1) {
    const t = -1 + (index / 20) * 2;
    const y = springY + (peakY - springY) * Math.sqrt(Math.max(0, 1 - t * t));
    archPoints.push(getEiffelFacePoint(centerX, centerZ, levels, face, t * span / 2, y));
  }

  for (let index = 0; index < archPoints.length - 1; index += 1) {
    addEiffelRodBetween(group, archPoints[index], archPoints[index + 1], 1.45, ironColor, 6);
  }

  for (let index = 0; index < archPoints.length - 1; index += 1) {
    const innerStart = archPoints[index].clone().lerp(getEiffelFacePoint(centerX, centerZ, levels, face, 0, archPoints[index].y - 2.8), 0.12);
    const innerEnd = archPoints[index + 1].clone().lerp(getEiffelFacePoint(centerX, centerZ, levels, face, 0, archPoints[index + 1].y - 2.8), 0.12);
    addEiffelRodBetween(group, innerStart, innerEnd, 0.62, braceColor, 5);
  }

}

function addEiffelFacePanel(group, centerX, centerZ, levels, face, bottomY, topY, leftBottom, rightBottom, leftTop, rightTop, color, radius, panelCount) {
  const bottomLeft = getEiffelFacePoint(centerX, centerZ, levels, face, leftBottom, bottomY);
  const bottomRight = getEiffelFacePoint(centerX, centerZ, levels, face, rightBottom, bottomY);
  const topLeft = getEiffelFacePoint(centerX, centerZ, levels, face, leftTop, topY);
  const topRight = getEiffelFacePoint(centerX, centerZ, levels, face, rightTop, topY);

  addEiffelRodBetween(group, bottomLeft, topLeft, radius * 1.1, color, 4);
  addEiffelRodBetween(group, bottomRight, topRight, radius * 1.1, color, 4);

  for (let panel = 0; panel < panelCount; panel += 1) {
    const t0 = panel / panelCount;
    const t1 = (panel + 1) / panelCount;
    const y0 = THREE.MathUtils.lerp(bottomY, topY, t0);
    const y1 = THREE.MathUtils.lerp(bottomY, topY, t1);
    const left0 = THREE.MathUtils.lerp(leftBottom, leftTop, t0);
    const right0 = THREE.MathUtils.lerp(rightBottom, rightTop, t0);
    const left1 = THREE.MathUtils.lerp(leftBottom, leftTop, t1);
    const right1 = THREE.MathUtils.lerp(rightBottom, rightTop, t1);
    const lowerLeft = getEiffelFacePoint(centerX, centerZ, levels, face, left0, y0);
    const lowerRight = getEiffelFacePoint(centerX, centerZ, levels, face, right0, y0);
    const upperLeft = getEiffelFacePoint(centerX, centerZ, levels, face, left1, y1);
    const upperRight = getEiffelFacePoint(centerX, centerZ, levels, face, right1, y1);

    addEiffelRodBetween(group, lowerLeft, lowerRight, radius * 0.75, color, 4);
    addEiffelRodBetween(group, lowerLeft, upperRight, radius, color, 4);
    addEiffelRodBetween(group, lowerRight, upperLeft, radius, color, 4);
  }
}

function addEiffelMiddleVoidPanels(group, centerX, centerZ, levels, face, lower, upper, firstFloor, secondFloor, color) {
  const lowerVoidHalf = getEiffelMiddleVoidHalfWidth(lower.y, firstFloor, secondFloor);
  const upperVoidHalf = getEiffelMiddleVoidHalfWidth(upper.y, firstFloor, secondFloor);
  const radius = Math.max(lower.radius * 0.28, 0.08);
  const panelCount = Math.max(2, Math.ceil((upper.y - lower.y) / 15));

  addEiffelFacePanel(
    group,
    centerX,
    centerZ,
    levels,
    face,
    lower.y,
    upper.y,
    -lower.side / 2,
    -lowerVoidHalf,
    -upper.side / 2,
    -upperVoidHalf,
    color,
    radius,
    panelCount,
  );
  addEiffelFacePanel(
    group,
    centerX,
    centerZ,
    levels,
    face,
    lower.y,
    upper.y,
    lowerVoidHalf,
    lower.side / 2,
    upperVoidHalf,
    upper.side / 2,
    color,
    radius,
    panelCount,
  );
}

function getEiffelMiddleVoidHalfWidth(y, firstFloor, secondFloor) {
  const t = THREE.MathUtils.clamp((y - firstFloor) / (secondFloor - firstFloor), 0, 1);
  return THREE.MathUtils.lerp(20, 8.5, t);
}

function addEiffelPlatform(group, centerX, centerZ, side, y, thickness, deckColor, railColor, lightColor) {
  const beamWidth = THREE.MathUtils.clamp(side * 0.095, 1.3, 5.8);
  const halfSide = side / 2;
  const beamCenterOffset = halfSide - beamWidth / 2;
  const railY = y + thickness * 0.72;

  group.add(createLowPolyMesh(new THREE.BoxGeometry(side, thickness, beamWidth), deckColor, centerX, y, centerZ + beamCenterOffset));
  group.add(createLowPolyMesh(new THREE.BoxGeometry(side, thickness, beamWidth), deckColor, centerX, y, centerZ - beamCenterOffset));
  group.add(createLowPolyMesh(new THREE.BoxGeometry(beamWidth, thickness, side), deckColor, centerX + beamCenterOffset, y, centerZ));
  group.add(createLowPolyMesh(new THREE.BoxGeometry(beamWidth, thickness, side), deckColor, centerX - beamCenterOffset, y, centerZ));

  const corners = [
    new THREE.Vector3(centerX - halfSide, railY, centerZ + halfSide),
    new THREE.Vector3(centerX + halfSide, railY, centerZ + halfSide),
    new THREE.Vector3(centerX + halfSide, railY, centerZ - halfSide),
    new THREE.Vector3(centerX - halfSide, railY, centerZ - halfSide),
  ];
  for (let index = 0; index < 4; index += 1) {
    addEiffelRodBetween(group, corners[index], corners[(index + 1) % 4], 0.24, railColor, 4);
  }

  const lampCount = Math.max(4, Math.round(side / 7));
  for (let index = 0; index < lampCount; index += 1) {
    const offset = -side * 0.42 + (index / Math.max(1, lampCount - 1)) * side * 0.84;
    group.add(createLowPolyMesh(new THREE.BoxGeometry(0.7, 0.35, 0.18), lightColor, centerX + offset, railY + 0.45, centerZ + halfSide - beamWidth * 0.4));
  }
}

function addEiffelBeltPlatform(group, centerX, centerZ, side, y, deckColor, railColor, lightColor, options) {
  const beamWidth = THREE.MathUtils.clamp(side * 0.085, 3.8, 6.2);
  const halfSide = side / 2;
  const lowerY = y - options.heightAbove;
  const topY = y;
  const midY = lowerY + options.heightAbove * 0.48;

  addEiffelPlatform(group, centerX, centerZ, side, topY, options.deckThickness, deckColor, railColor, lightColor);

  for (let face = 0; face < 4; face += 1) {
    addEiffelBeltFace(group, centerX, centerZ, face, halfSide, topY, midY, lowerY, beamWidth, deckColor, railColor, lightColor);
  }
}

function addEiffelBeltFace(group, centerX, centerZ, face, halfSide, topY, midY, lowerY, depth, deckColor, railColor, lightColor) {
  const outerA = getSquareFacePoint(centerX, centerZ, face, -halfSide, halfSide + depth * 0.08);
  const outerB = getSquareFacePoint(centerX, centerZ, face, halfSide, halfSide + depth * 0.08);
  const lowerA = getSquareFacePoint(centerX, centerZ, face, -halfSide * 0.86, halfSide + depth * 0.02);
  const lowerB = getSquareFacePoint(centerX, centerZ, face, halfSide * 0.86, halfSide + depth * 0.02);

  addEiffelRodBetween(group, new THREE.Vector3(outerA.x, topY, outerA.z), new THREE.Vector3(outerB.x, topY, outerB.z), 0.42, railColor, 4);
  addEiffelRodBetween(group, new THREE.Vector3(lowerA.x, lowerY, lowerA.z), new THREE.Vector3(lowerB.x, lowerY, lowerB.z), 0.38, railColor, 4);

  const panelCount = 8;
  for (let index = 0; index < panelCount; index += 1) {
    const t0 = index / panelCount;
    const t1 = (index + 1) / panelCount;
    const u0 = THREE.MathUtils.lerp(-halfSide * 0.86, halfSide * 0.86, t0);
    const u1 = THREE.MathUtils.lerp(-halfSide * 0.86, halfSide * 0.86, t1);
    const uMid = (u0 + u1) / 2;
    const topLeft = getSquareFacePoint(centerX, centerZ, face, u0, halfSide + depth * 0.14);
    const topRight = getSquareFacePoint(centerX, centerZ, face, u1, halfSide + depth * 0.14);
    const midLeft = getSquareFacePoint(centerX, centerZ, face, u0, halfSide + depth * 0.06);
    const midRight = getSquareFacePoint(centerX, centerZ, face, u1, halfSide + depth * 0.06);
    const lowerLeft = getSquareFacePoint(centerX, centerZ, face, u0, halfSide);
    const lowerRight = getSquareFacePoint(centerX, centerZ, face, u1, halfSide);
    const lowerMid = getSquareFacePoint(centerX, centerZ, face, uMid, halfSide);

    addEiffelRodBetween(group, new THREE.Vector3(topLeft.x, topY, topLeft.z), new THREE.Vector3(lowerLeft.x, lowerY, lowerLeft.z), 0.28, railColor, 4);
    addEiffelRodBetween(group, new THREE.Vector3(topRight.x, topY, topRight.z), new THREE.Vector3(lowerRight.x, lowerY, lowerRight.z), 0.28, railColor, 4);
    addEiffelRodBetween(group, new THREE.Vector3(midLeft.x, midY, midLeft.z), new THREE.Vector3(lowerMid.x, lowerY, lowerMid.z), 0.22, railColor, 4);
    addEiffelRodBetween(group, new THREE.Vector3(midRight.x, midY, midRight.z), new THREE.Vector3(lowerMid.x, lowerY, lowerMid.z), 0.22, railColor, 4);

    if (index % 2 === 0) {
      const lampPoint = getSquareFacePoint(centerX, centerZ, face, uMid, halfSide + depth * 0.58);
      group.add(createLowPolyMesh(new THREE.BoxGeometry(0.64, 0.34, 0.2), lightColor, lampPoint.x, topY + 1.2, lampPoint.z));
    }
  }

  const archCount = 10;
  const archRadius = 0.18;
  for (let index = 0; index < archCount; index += 1) {
    const t0 = index / archCount;
    const t1 = (index + 1) / archCount;
    const u0 = THREE.MathUtils.lerp(-halfSide * 0.74, halfSide * 0.74, t0);
    const u1 = THREE.MathUtils.lerp(-halfSide * 0.74, halfSide * 0.74, t1);
    const arch = [
      getSquareFacePoint(centerX, centerZ, face, u0, halfSide + depth * 0.03),
      getSquareFacePoint(centerX, centerZ, face, (u0 + u1) / 2, halfSide + depth * 0.03),
      getSquareFacePoint(centerX, centerZ, face, u1, halfSide + depth * 0.03),
    ];
    addEiffelRodBetween(group, new THREE.Vector3(arch[0].x, lowerY + 1.2, arch[0].z), new THREE.Vector3(arch[1].x, lowerY + 3.3, arch[1].z), archRadius, railColor, 4);
    addEiffelRodBetween(group, new THREE.Vector3(arch[1].x, lowerY + 3.3, arch[1].z), new THREE.Vector3(arch[2].x, lowerY + 1.2, arch[2].z), archRadius, railColor, 4);
  }
}

function getSquareFacePoint(centerX, centerZ, face, u, halfSide) {
  if (face === 0) {
    return new THREE.Vector3(centerX + u, 0, centerZ + halfSide);
  }
  if (face === 1) {
    return new THREE.Vector3(centerX + halfSide, 0, centerZ - u);
  }
  if (face === 2) {
    return new THREE.Vector3(centerX - u, 0, centerZ - halfSide);
  }
  return new THREE.Vector3(centerX - halfSide, 0, centerZ + u);
}

function addEiffelTopCrown(group, centerX, centerZ, beltY, beltSide, totalHeight, beltColor, rodColor, options = {}) {
  const lowerBeltThickness = options.lowerBeltThickness ?? options.beltThickness ?? 2.8;
  const upperBeltThickness = options.upperBeltThickness ?? options.beltThickness ?? lowerBeltThickness;
  const beltGap = options.beltGap ?? 0.8;
  const lowerBeltSide = options.lowerBeltSide ?? beltSide;
  const upperBeltY = beltY + lowerBeltThickness / 2 + beltGap + upperBeltThickness / 2;
  const upperBeltTopY = upperBeltY + upperBeltThickness / 2;
  const rodBaseY = upperBeltTopY;
  const rodMidY = (rodBaseY + totalHeight) / 2;

  addEiffelPlatform(group, centerX, centerZ, lowerBeltSide, beltY, lowerBeltThickness, beltColor, rodColor, '#97dcff');
  addEiffelPlatform(group, centerX, centerZ, beltSide, upperBeltY, upperBeltThickness, beltColor, rodColor, '#97dcff');
  addEiffelCrownArcs(group, centerX, centerZ, beltSide, upperBeltTopY + 0.15, rodMidY, rodColor);
  group.add(createOrientedCylinder(
    new THREE.Vector3(centerX, rodBaseY, centerZ),
    new THREE.Vector3(centerX, totalHeight, centerZ),
    1.32,
    0.72,
    rodColor,
    8,
  ));
}

function addEiffelCrownArcs(group, centerX, centerZ, beltSide, baseY, rodMidY, color) {
  const halfSide = beltSide / 2;
  const end = new THREE.Vector3(centerX, rodMidY, centerZ);
  const radius = 0.36;
  const segments = 9;

  [
    new THREE.Vector3(centerX - halfSide, baseY, centerZ + halfSide),
    new THREE.Vector3(centerX + halfSide, baseY, centerZ + halfSide),
    new THREE.Vector3(centerX + halfSide, baseY, centerZ - halfSide),
    new THREE.Vector3(centerX - halfSide, baseY, centerZ - halfSide),
  ].forEach((start) => {
    let previous = start;
    const direction = new THREE.Vector2(start.x - centerX, start.z - centerZ).normalize();
    const arc = createCircularCrownArc(start.distanceTo(new THREE.Vector3(centerX, baseY, centerZ)), baseY, rodMidY, segments);

    for (let index = 1; index <= segments; index += 1) {
      const point = arc[index];
      const next = new THREE.Vector3(
        centerX + direction.x * point.radius,
        point.y,
        centerZ + direction.y * point.radius,
      );
      addEiffelRodBetween(group, previous, next, radius, color, 6);
      previous = next;
    }
  });
}

function createCircularCrownArc(startRadius, startY, endY, segments) {
  const start = new THREE.Vector2(startRadius, startY);
  const end = new THREE.Vector2(0, endY);
  const chord = start.distanceTo(end);
  const circleRadius = chord * 0.68;
  const midpoint = start.clone().add(end).multiplyScalar(0.5);
  const chordDirection = end.clone().sub(start).normalize();
  const normal = new THREE.Vector2(-chordDirection.y, chordDirection.x);
  const centerOffset = Math.sqrt(Math.max(0, circleRadius * circleRadius - (chord / 2) * (chord / 2)));
  const centers = [
    midpoint.clone().addScaledVector(normal, centerOffset),
    midpoint.clone().addScaledVector(normal, -centerOffset),
  ];
  let bestArc = null;

  centers.forEach((center) => {
    const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
    const endAngle = Math.atan2(end.y - center.y, end.x - center.x);
    let delta = endAngle - startAngle;

    if (delta > Math.PI) {
      delta -= Math.PI * 2;
    } else if (delta < -Math.PI) {
      delta += Math.PI * 2;
    }

    const points = [];
    for (let index = 0; index <= segments; index += 1) {
      const angle = startAngle + delta * (index / segments);
      points.push({
        radius: center.x + Math.cos(angle) * circleRadius,
        y: center.y + Math.sin(angle) * circleRadius,
      });
    }

    const midPoint = points[Math.floor(points.length / 2)];
    if (!bestArc || midPoint.y > bestArc.midPoint.y || (midPoint.y === bestArc.midPoint.y && midPoint.radius > bestArc.midPoint.radius)) {
      bestArc = { points, midPoint };
    }
  });

  return bestArc.points;
}

function getEiffelCorners(centerX, centerZ, levels, y) {
  const halfSide = getEiffelSideAt(levels, y) / 2;

  return [
    new THREE.Vector3(centerX - halfSide, y, centerZ + halfSide),
    new THREE.Vector3(centerX + halfSide, y, centerZ + halfSide),
    new THREE.Vector3(centerX + halfSide, y, centerZ - halfSide),
    new THREE.Vector3(centerX - halfSide, y, centerZ - halfSide),
  ];
}

function getEiffelFacePoint(centerX, centerZ, levels, face, u, y) {
  const halfSide = getEiffelSideAt(levels, y) / 2;

  if (face === 0) {
    return new THREE.Vector3(centerX + u, y, centerZ + halfSide);
  }
  if (face === 1) {
    return new THREE.Vector3(centerX + halfSide, y, centerZ - u);
  }
  if (face === 2) {
    return new THREE.Vector3(centerX - u, y, centerZ - halfSide);
  }
  return new THREE.Vector3(centerX - halfSide, y, centerZ + u);
}

function getEiffelFaceU(centerX, centerZ, levels, face, point) {
  if (face === 0) {
    return point.x - centerX;
  }
  if (face === 1) {
    return centerZ - point.z;
  }
  if (face === 2) {
    return centerX - point.x;
  }
  return point.z - centerZ;
}

function getEiffelSideAt(levels, y) {
  for (let index = 0; index < levels.length - 1; index += 1) {
    const lower = levels[index];
    const upper = levels[index + 1];

    if (y >= lower.y && y <= upper.y) {
      return THREE.MathUtils.lerp(lower.side, upper.side, (y - lower.y) / (upper.y - lower.y));
    }
  }

  return levels[levels.length - 1].side;
}

function addEiffelRodBetween(group, start, end, radius, color, radialSegments = 6) {
  group.add(createOrientedCylinder(start, end, radius, radius, color, radialSegments));
}

function createSoccerField(item) {
  const group = new THREE.Group();
  const topY = item.height + 0.012;
  const lineColor = '#eef3ff';
  const lineWidth = 0.28;
  const touchlineRunoff = 2.6;
  const goalLineRunoff = 3.25;
  const xMin = item.x + goalLineRunoff;
  const xMax = xMin + item.length;
  const zMin = item.z - item.width / 2;
  const zMax = item.z + item.width / 2;
  const surfaceXMin = item.x;
  const surfaceXMax = xMax + goalLineRunoff;
  const surfaceZMin = zMin - touchlineRunoff;
  const surfaceZMax = zMax + touchlineRunoff;
  const surfaceLength = surfaceXMax - surfaceXMin;
  const surfaceWidth = surfaceZMax - surfaceZMin;

  const bands = 12;
  for (let band = 0; band < bands; band += 1) {
    const bandLength = surfaceLength / bands;
    group.add(createLowPolyMesh(
      new THREE.BoxGeometry(bandLength, item.height, surfaceWidth),
      band % 2 === 0 ? '#2d8147' : '#23683a',
      surfaceXMin + bandLength * (band + 0.5),
      item.height / 2,
      item.z,
    ));
  }

  addRectLines(group, xMin, xMax, zMin, zMax, topY, lineWidth, lineColor);
  group.add(createFieldLine((xMin + xMax) / 2, item.z, lineWidth, item.width, topY, lineColor));
  group.add(createFieldCircle((xMin + xMax) / 2, item.z, 9.15, lineWidth * 0.42, topY, lineColor));
  group.add(createFieldSpot((xMin + xMax) / 2, item.z, 0.42, topY, lineColor));

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
  addSoccerGoal(group, xMin, item.z, -1, item.height, lineColor);
  addSoccerGoal(group, xMax, item.z, 1, item.height, lineColor);

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
    group.add(createHumanAt(xMin + x, item.z + z, color, item.height));
  });

  return group;
}

function addSoccerGoal(group, goalLineX, centerZ, direction, fieldHeight, color) {
  const goalWidth = 7.32;
  const goalHeight = 2.44;
  const goalDepth = 2.25;
  const postRadius = 0.09;
  const baseY = fieldHeight + postRadius;
  const topY = fieldHeight + goalHeight;
  const nearX = goalLineX;
  const farX = goalLineX + direction * goalDepth;
  const leftZ = centerZ - goalWidth / 2;
  const rightZ = centerZ + goalWidth / 2;

  const frontLeftBase = new THREE.Vector3(nearX, baseY, leftZ);
  const frontRightBase = new THREE.Vector3(nearX, baseY, rightZ);
  const frontLeftTop = new THREE.Vector3(nearX, topY, leftZ);
  const frontRightTop = new THREE.Vector3(nearX, topY, rightZ);
  const backLeftBase = new THREE.Vector3(farX, baseY, leftZ);
  const backRightBase = new THREE.Vector3(farX, baseY, rightZ);
  const backLeftTop = new THREE.Vector3(farX, topY, leftZ);
  const backRightTop = new THREE.Vector3(farX, topY, rightZ);

  [
    [frontLeftBase, frontLeftTop],
    [frontRightBase, frontRightTop],
    [frontLeftTop, frontRightTop],
    [frontLeftTop, backLeftTop],
    [frontRightTop, backRightTop],
    [backLeftTop, backRightTop],
    [backLeftBase, backLeftTop],
    [backRightBase, backRightTop],
    [frontLeftBase, backLeftBase],
    [frontRightBase, backRightBase],
  ].forEach(([start, end]) => {
    group.add(createOrientedCylinder(start, end, postRadius, postRadius, color, 8));
  });

  const netColor = '#dfe8f5';
  const sideNetMaterial = createLowPolyMaterial(netColor, 0.2);
  sideNetMaterial.side = THREE.DoubleSide;

  const backNet = new THREE.Mesh(
    new THREE.PlaneGeometry(goalWidth, goalHeight),
    sideNetMaterial,
  );
  backNet.position.set(farX, fieldHeight + goalHeight / 2, centerZ);
  backNet.rotation.y = Math.PI / 2;
  group.add(backNet);

  [leftZ, rightZ].forEach((z) => {
    const sideNet = new THREE.Mesh(
      new THREE.PlaneGeometry(goalDepth, goalHeight),
      sideNetMaterial.clone(),
    );
    sideNet.position.set((nearX + farX) / 2, fieldHeight + goalHeight / 2, z);
    sideNet.rotation.y = direction > 0 ? 0 : Math.PI;
    group.add(sideNet);
  });
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
  const halfSpan = item.width / 2;
  const noseX = item.x;
  const tailX = item.x + item.length;
  const wingRootY = fuselageY - fuselageRadius * 0.3;
  const tailplaneY = fuselageY + fuselageRadius * 0.5;
  const bodyColor = item.color;
  const bellyColor = '#123a73';
  const navy = '#123a73';
  const red = '#de2638';
  const wingColor = '#d9e0e9';
  const wingAccent = '#aeb8c6';
  const glassColor = '#09111e';
  const metalColor = '#aeb8c6';

  const fuselageSections = [
    { x: noseX, radius: fuselageRadius * 0.2, y: fuselageY - fuselageRadius * 0.18, upperRadiusScale: 0.72 },
    { x: item.x + item.length * 0.01, radius: fuselageRadius * 0.48, y: fuselageY - fuselageRadius * 0.13, upperRadiusScale: 0.58 },
    { x: item.x + item.length * 0.026, radius: fuselageRadius * 0.74, y: fuselageY - fuselageRadius * 0.07, upperRadiusScale: 0.64 },
    { x: item.x + item.length * 0.045, radius: fuselageRadius * 0.9, y: fuselageY - fuselageRadius * 0.03, upperRadiusScale: 0.7 },
    { x: item.x + item.length * 0.063, radius: fuselageRadius * 0.98, y: fuselageY - fuselageRadius * 0.005, upperRadiusScale: 0.94 },
    { x: item.x + item.length * 0.08, radius: fuselageRadius, y: fuselageY },
    { x: item.x + item.length * 0.75, radius: fuselageRadius, y: fuselageY },
    { x: item.x + item.length * 0.86, radius: fuselageRadius * 0.72, y: fuselageY + fuselageRadius * 0.08 },
    { x: item.x + item.length * 0.955, radius: fuselageRadius * 0.3, y: fuselageY + fuselageRadius * 0.18 },
    { x: tailX, radius: fuselageRadius * 0.11, y: fuselageY + fuselageRadius * 0.22 },
  ];

  group.add(createFuselageSurface(fuselageSections, item.z, 345, 555, bodyColor));
  group.add(createFuselageSurface(fuselageSections, item.z, 195, 345, bellyColor));
  group.add(createFuselageNoseCap(fuselageSections[0], item.z, bodyColor));

  [-1, 1].forEach((side) => {
    const outerZ = item.z + side * halfSpan;
    const rootZ = item.z + side * fuselageRadius * 0.82;
    const tipY = wingRootY + 1.12;
    const wingRootChordScale = 0.8;
    const wingTipChordScale = 0.6;
    const wingRootCenterX = item.x + item.length * 0.52;
    const wingTipCenterX = item.x + item.length * 0.6125;
    const wingRootChord = item.length * 0.21 * wingRootChordScale;
    const wingTipChord = item.length * 0.125 * wingTipChordScale;
    const wingRootTrailingX = wingRootCenterX + wingRootChord / 2;
    const wingRootLeadingX = wingRootCenterX - wingRootChord / 2;
    const wingTipTrailingX = wingTipCenterX + wingTipChord / 2;
    const wingTipLeadingX = wingTipCenterX - wingTipChord / 2;
    const wingPoints = side > 0
      ? [
          [wingRootLeadingX, wingRootY, rootZ],
          [wingRootTrailingX, wingRootY - 0.05, rootZ],
          [wingTipTrailingX, tipY, outerZ],
          [wingTipLeadingX, tipY + 0.04, outerZ],
        ]
      : [
          [wingRootLeadingX, wingRootY, rootZ],
          [wingRootTrailingX, wingRootY - 0.05, rootZ],
          [wingTipTrailingX, tipY, outerZ],
          [wingTipLeadingX, tipY + 0.04, outerZ],
        ];

    group.add(createVariablePrism(wingPoints, 0.32, wingColor));
    addWingPanelLines(group, wingPoints, side, wingAccent);

    const wingletThickness = 0.36;
    const wingletZ = item.z + side * (halfSpan - wingletThickness / 2);
    const wingletChordX = wingTipTrailingX - wingTipLeadingX;
    group.add(createPrismFromXY([
      [wingTipLeadingX + wingletChordX * 0.016, tipY],
      [wingTipTrailingX, tipY - 0.02],
      [wingTipLeadingX + wingletChordX * 0.928, tipY + 1.54],
      [wingTipLeadingX + wingletChordX * 0.2, tipY + 1.78],
    ], wingletZ, wingletThickness, navy));

    const stabilizerOuterZ = item.z + side * (item.width * 0.2);
    const stabilizerRootZ = item.z + side * fuselageRadius * 0.94;
    const stabilizerRootTrailingX = item.x + item.length * 0.955;
    const stabilizerTipTrailingX = item.x + item.length * 0.972;
    const stabilizerRootChord = item.length * 0.119;
    const stabilizerTipChord = stabilizerRootChord * 0.5;
    const stabilizerPoints = [
      [stabilizerRootTrailingX - stabilizerRootChord, tailplaneY, stabilizerRootZ],
      [stabilizerRootTrailingX, tailplaneY - 0.04, stabilizerRootZ],
      [stabilizerTipTrailingX, tailplaneY + 0.18, stabilizerOuterZ],
      [stabilizerTipTrailingX - stabilizerTipChord, tailplaneY + 0.32, stabilizerOuterZ],
    ];
    group.add(createVariablePrism(stabilizerPoints, 0.12, wingColor));

    addBoeingEngine(group, item, side, fuselageY, fuselageRadius, wingRootY, navy, metalColor, glassColor);
    addMainLandingGear(group, item, side, fuselageY, fuselageRadius, metalColor, glassColor);
  });

  addVerticalTail(group, item, fuselageY, fuselageRadius, navy, red);
  addBoeingWindshield(group, item, fuselageY, fuselageRadius);
  addBoeingWindowsAndDoors(group, item, fuselageY, fuselageRadius, glassColor, metalColor);
  addNoseLandingGear(group, item, fuselageY, fuselageRadius, metalColor, glassColor);
  group.add(createHumanAt(item.x + item.length * 0.1, item.z + fuselageRadius + 2.35, '#51e4d4'));

  return group;
}

function addBoeingEngine(group, item, side, fuselageY, fuselageRadius, wingRootY, navy, metalColor, glassColor) {
  const engineRadius = fuselageRadius * 0.52;
  const engineLength = item.length * 0.074;
  const engineFrontX = item.x + item.length * 0.43;
  const engineBackX = engineFrontX + engineLength;
  const engineY = Math.max(engineRadius + 0.34, fuselageY - fuselageRadius * 0.83);
  const engineZ = item.z + side * item.width * 0.16;
  const front = new THREE.Vector3(engineFrontX, engineY, engineZ);
  const back = new THREE.Vector3(engineBackX, engineY + 0.04, engineZ);

  group.add(createSmoothOrientedCylinder(front, back, engineRadius, engineRadius * 0.9, navy, 24));
  group.add(createSmoothOrientedCylinder(
    front.clone().add(new THREE.Vector3(-0.03, 0, 0)),
    front.clone().add(new THREE.Vector3(0.22, 0, 0)),
    engineRadius * 1.02,
    engineRadius * 0.95,
    metalColor,
    24,
  ));
  group.add(createSmoothOrientedCylinder(
    front.clone().add(new THREE.Vector3(-0.05, 0, 0)),
    front.clone().add(new THREE.Vector3(0.06, 0, 0)),
    engineRadius * 0.72,
    engineRadius * 0.67,
    glassColor,
    20,
  ));
  group.add(createSmoothOrientedCone(
    front.clone().add(new THREE.Vector3(0.1, 0, 0)),
    front.clone().add(new THREE.Vector3(-0.16, 0, 0)),
    engineRadius * 0.22,
    '#d7dde6',
    18,
  ));
  group.add(createTaperedPrism(
    engineFrontX + engineLength * 0.48,
    (wingRootY + engineY + engineRadius * 0.7) / 2,
    engineZ,
    0.68,
    0.42,
    0.36,
    0.2,
    Math.max(0.32, wingRootY - (engineY + engineRadius * 0.28)),
    metalColor,
  ));
}

function addMainLandingGear(group, item, side, fuselageY, fuselageRadius, metalColor, tireColor) {
  const gearX = item.x + item.length * 0.535;
  const strutTop = new THREE.Vector3(gearX, fuselageY - fuselageRadius * 0.78, item.z + side * 0.72);
  const strutBase = new THREE.Vector3(gearX, 0.88, item.z + side * 1.28);
  const wheelRadius = 0.43;
  const wheelDepth = 0.18;

  group.add(createLimb(strutTop, strutBase, 0.06, metalColor));
  group.add(createLimb(
    strutBase,
    new THREE.Vector3(gearX + 0.34, 0.42, item.z + side * 1.48),
    0.038,
    metalColor,
  ));

  [1.18, 1.48].forEach((offset) => {
    group.add(createWheel(gearX + 0.06, wheelRadius, item.z + side * offset, wheelRadius, wheelDepth, tireColor));
    group.add(createWheel(gearX + 0.06, wheelRadius, item.z + side * offset, wheelRadius * 0.45, wheelDepth * 1.08, '#c7d0dc'));
  });
}

function addNoseLandingGear(group, item, fuselageY, fuselageRadius, metalColor, tireColor) {
  const gearX = item.x + item.length * 0.175;
  const wheelRadius = 0.32;
  const wheelDepth = 0.12;

  group.add(createLimb(
    new THREE.Vector3(gearX, fuselageY - fuselageRadius * 0.82, item.z),
    new THREE.Vector3(gearX, 0.62, item.z),
    0.052,
    metalColor,
  ));
  [-1, 1].forEach((side) => {
    group.add(createWheel(gearX, wheelRadius, item.z + side * 0.16, wheelRadius, wheelDepth, tireColor));
    group.add(createWheel(gearX, wheelRadius, item.z + side * 0.16, wheelRadius * 0.42, wheelDepth * 1.08, '#c7d0dc'));
  });
}

function addVerticalTail(group, item, fuselageY, fuselageRadius, navy, red) {
  const finThickness = 0.5;
  const rootY = fuselageY + fuselageRadius * 0.52;
  const finPoints = [
    [item.x + item.length * 0.805, rootY],
    [item.x + item.length * 0.875, item.height],
    [item.x + item.length * 0.966, item.height - 0.48],
    [item.x + item.length * 0.982, rootY + 1.28],
  ];

  group.add(createPrismFromXY(finPoints, item.z, finThickness, navy));

  [-1, 1].forEach((side) => {
    const z = item.z + side * (finThickness / 2 + 0.07);
    group.add(createFlatPolygonFromXY([
      [item.x + item.length * 0.825, rootY + 0.96],
      [item.x + item.length * 0.954, rootY + 0.72],
      [item.x + item.length * 0.963, rootY + 2.48],
      [item.x + item.length * 0.878, rootY + 3.28],
      [item.x + item.length * 0.835, rootY + 2.18],
    ], z, red));
    group.add(createFlatPolygonFromXY([
      [item.x + item.length * 0.885, rootY + 3.18],
      [item.x + item.length * 0.95, rootY + 2.55],
      [item.x + item.length * 0.964, rootY + 3.52],
      [item.x + item.length * 0.91, rootY + 4.18],
    ], z, red));
  });
}

function addBoeingWindshield(group, item, fuselageY, fuselageRadius) {
  const windshieldColor = '#010205';
  const frontX = item.x + item.length * 0.044;
  const lowerY = fuselageY + fuselageRadius * 0.62;
  const upperY = fuselageY + fuselageRadius * 0.86;
  const frontLowerY = fuselageY + fuselageRadius * 0.52;
  const frontUpperY = fuselageY + fuselageRadius * 0.86;
  const frontLowerHalfWidth = fuselageRadius * 0.58;
  const frontUpperHalfWidth = fuselageRadius * 0.34;
  const frontWindshieldTilt = THREE.MathUtils.degToRad(40);

  const frontWindshieldPoints = [
    [frontX, frontLowerY, item.z - frontLowerHalfWidth],
    [frontX, frontUpperY, item.z - frontUpperHalfWidth],
    [frontX, frontUpperY, item.z + frontUpperHalfWidth],
    [frontX, frontLowerY, item.z + frontLowerHalfWidth],
  ].map(([x, y, z]) => {
    const backwardOffset = (y - frontLowerY) * Math.tan(frontWindshieldTilt);
    return [x + backwardOffset, y, z];
  });

  group.add(createFlatPolygonFromXYZ(frontWindshieldPoints, windshieldColor));

  [-1, 1].forEach((side) => {
    const sideWindshieldTilt = THREE.MathUtils.degToRad(15);
    const sideWindshieldBottomY = lowerY - fuselageRadius * 0.03;
    const sideZ = getFuselageSidePanelZ(
      item.z,
      side,
      fuselageRadius,
      fuselageY,
      (lowerY + upperY) / 2,
      0.06,
    );

    const sideWindshieldPoints = [
      [item.x + item.length * 0.049, lowerY - fuselageRadius * 0.03],
      [item.x + item.length * 0.085, lowerY + fuselageRadius * 0.04],
      [item.x + item.length * 0.099, upperY - fuselageRadius * 0.04],
      [item.x + item.length * 0.058, upperY + fuselageRadius * 0.02],
    ].map(([x, y]) => {
      const inwardOffset = Math.max(0, y - sideWindshieldBottomY) * Math.sin(sideWindshieldTilt);
      return [
        x,
        y,
        sideZ - side * inwardOffset,
      ];
    });

    group.add(createFlatPolygonFromXYZ(sideWindshieldPoints, windshieldColor));
  });
}

function addBoeingWindowsAndDoors(group, item, fuselageY, fuselageRadius, glassColor, metalColor) {
  const windowY = fuselageY + fuselageRadius * 0.45;
  const firstWindowX = item.x + item.length * 0.19;
  const lastWindowX = item.x + item.length * 0.78;
  const windowCount = 29;
  const passengerWindowWidth = 0.18;
  const passengerWindowHeight = 0.32;
  const passengerWindowRadius = 0.055;

  for (let windowIndex = 0; windowIndex < windowCount; windowIndex += 1) {
    const t = windowIndex / (windowCount - 1);
    const windowX = firstWindowX + (lastWindowX - firstWindowX) * t;
    if (Math.abs(windowX - (item.x + item.length * 0.47)) < 0.32) {
      continue;
    }

    [-1, 1].forEach((side) => {
      const windowZ = getFuselageSidePanelZ(
        item.z,
        side,
        fuselageRadius,
        fuselageY,
        windowY - passengerWindowHeight / 2,
        0.035,
      );
      group.add(createRoundedRectPanel(
        passengerWindowWidth,
        passengerWindowHeight,
        passengerWindowRadius,
        glassColor,
        windowX,
        windowY,
        windowZ,
      ));
    });
  }

  [-1, 1].forEach((side) => {
    addAircraftDoor(group, item.x + item.length * 0.145, fuselageY + fuselageRadius * 0.05, item.z, side, fuselageRadius, 0.76, 1.72, metalColor);
    addAircraftDoor(group, item.x + item.length * 0.83, fuselageY + fuselageRadius * 0.04, item.z, side, fuselageRadius * 0.82, 0.68, 1.55, metalColor);
    addAircraftDoor(group, item.x + item.length * 0.475, fuselageY + fuselageRadius * 0.05, item.z, side, fuselageRadius, 0.58, 1.08, metalColor);
    addAircraftDoor(group, item.x + item.length * 0.53, fuselageY + fuselageRadius * 0.05, item.z, side, fuselageRadius, 0.58, 1.08, metalColor);
  });
}

function addAircraftDoor(group, centerX, centerY, centerZ, side, radius, width, height, color) {
  const rail = 0.045;
  const topY = centerY + height / 2;
  const bottomY = centerY - height / 2;

  group.add(createFlatPanel(
    width,
    rail,
    color,
    centerX,
    topY,
    getFuselageSidePanelZ(centerZ, side, radius, centerY, topY),
  ));
  group.add(createFlatPanel(
    width,
    rail,
    color,
    centerX,
    bottomY,
    getFuselageSidePanelZ(centerZ, side, radius, centerY, bottomY),
  ));
  addCurvedVerticalPanelRail(group, centerX - width / 2, centerY, centerZ, side, radius, height, rail, color);
  addCurvedVerticalPanelRail(group, centerX + width / 2, centerY, centerZ, side, radius, height, rail, color);
}

function addCurvedVerticalPanelRail(group, x, centerY, centerZ, side, radius, height, width, color) {
  const segmentCount = 8;
  const segmentHeight = height / segmentCount;

  for (let index = 0; index < segmentCount; index += 1) {
    const y = centerY - height / 2 + segmentHeight * (index + 0.5);
    group.add(createFlatPanel(
      width,
      segmentHeight * 0.96,
      color,
      x,
      y,
      getFuselageSidePanelZ(centerZ, side, radius, centerY, y),
    ));
  }
}

function createRoundedRectPanel(width, height, radius, color, x, y, z) {
  const shape = new THREE.Shape();
  const left = -width / 2;
  const right = width / 2;
  const top = height / 2;
  const bottom = -height / 2;
  const r = Math.min(radius, width / 2, height / 2);

  shape.moveTo(left + r, top);
  shape.lineTo(right - r, top);
  shape.quadraticCurveTo(right, top, right, top - r);
  shape.lineTo(right, bottom + r);
  shape.quadraticCurveTo(right, bottom, right - r, bottom);
  shape.lineTo(left + r, bottom);
  shape.quadraticCurveTo(left, bottom, left, bottom + r);
  shape.lineTo(left, top - r);
  shape.quadraticCurveTo(left, top, left + r, top);

  const geometry = new THREE.ShapeGeometry(shape, 6);
  const material = createLowPolyMaterial(color);
  material.side = THREE.DoubleSide;
  material.polygonOffset = true;
  material.polygonOffsetFactor = -1;
  material.polygonOffsetUnits = -1;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  return mesh;
}

function createFlatPanel(width, height, color, x, y, z) {
  const geometry = new THREE.PlaneGeometry(width, height);
  const material = createLowPolyMaterial(color);
  material.side = THREE.DoubleSide;
  material.polygonOffset = true;
  material.polygonOffsetFactor = -1;
  material.polygonOffsetUnits = -1;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  return mesh;
}

function getFuselageSidePanelZ(centerZ, side, radius, centerY, panelY, surfaceGap = 0.012) {
  const dy = THREE.MathUtils.clamp(panelY - centerY, -radius * 0.98, radius * 0.98);
  return centerZ + side * (Math.sqrt(radius ** 2 - dy ** 2) + surfaceGap);
}

function getFuselageTopPanelY(centerZ, centerY, radius, panelZ, surfaceGap = 0.012) {
  const dz = THREE.MathUtils.clamp(panelZ - centerZ, -radius * 0.98, radius * 0.98);
  return centerY + Math.sqrt(radius ** 2 - dz ** 2) + surfaceGap;
}

function addWingPanelLines(group, points, side, color) {
  const topOffset = 0.2;
  const rootLeading = new THREE.Vector3(points[0][0], points[0][1] + topOffset, points[0][2]);
  const rootTrailing = new THREE.Vector3(points[1][0], points[1][1] + topOffset, points[1][2]);
  const tipTrailing = new THREE.Vector3(points[2][0], points[2][1] + topOffset, points[2][2]);
  const tipLeading = new THREE.Vector3(points[3][0], points[3][1] + topOffset, points[3][2]);
  const leadingInset = rootLeading.clone().lerp(tipLeading, 0.55);
  const trailingInset = rootTrailing.clone().lerp(tipTrailing, 0.55);

  group.add(createLimb(rootLeading.clone().lerp(rootTrailing, 0.48), leadingInset, 0.018, color));
  group.add(createLimb(rootLeading.clone().lerp(tipLeading, 0.66), rootTrailing.clone().lerp(tipTrailing, 0.66), 0.014, color));
  group.add(createLimb(trailingInset, tipTrailing.clone().lerp(tipLeading, side > 0 ? 0.35 : 0.65), 0.014, color));
}

function createHumanSilhouette(item) {
  const group = new THREE.Group();
  const topWearColor = '#00A8A9';
  const topWearShadow = '#007f82';
  const topWearHighlight = '#12c0c0';
  const pantsColor = '#4738A2';
  const pantsShadow = '#30266f';
  const skinColor = '#b98163';
  const hairColor = '#24150e';
  const hairDark = '#120b08';
  const shoeColor = '#11131c';
  const soleColor = '#2c2d36';
  const centerX = item.x + item.length / 2;
  const centerZ = item.z;
  const height = item.height;
  const bodyDepth = item.length;
  const shoulderWidth = item.width;

  // Approximate adult proportions for a 1.75 m reference figure.
  const footHeight = height * 0.037;
  const footLength = height * 0.154;
  const footWidth = shoulderWidth * 0.22;
  const soleHeight = footHeight * 0.34;
  const ankleY = footHeight;
  const kneeY = height * 0.305;
  const hipY = height * 0.54;
  const headSize = height * 0.132;
  const hairThickness = headSize * 0.062;
  const hairOverlap = headSize * 0.035;
  const headCenterX = centerX + bodyDepth * 0.03;
  const headTopY = height - hairThickness + hairOverlap;
  const headCenterY = headTopY - headSize / 2;
  const headBottomY = headTopY - headSize;
  const headFaceX = headCenterX + headSize / 2;
  const headBackX = headCenterX - headSize / 2;
  const headLeftZ = centerZ - headSize / 2;
  const headRightZ = centerZ + headSize / 2;
  const panelGap = 0.003;
  const panelDepth = 0.006;
  const torsoTopY = headBottomY - height * 0.045;
  const torsoBottomY = height * 0.54;
  const torsoHeight = torsoTopY - torsoBottomY;
  const torsoCenterY = torsoBottomY + torsoHeight / 2;
  const torsoDepth = bodyDepth * 0.64;
  const torsoWidth = shoulderWidth * 0.82;
  const shoulderY = torsoTopY - height * 0.015;
  const pelvisHeight = height * 0.085;
  const pelvisCenterY = torsoBottomY - pelvisHeight / 2;
  const armWidth = shoulderWidth * 0.18;
  const armDepth = bodyDepth * 0.42;
  const forearmWidth = shoulderWidth * 0.16;
  const forearmDepth = bodyDepth * 0.38;
  const thighDepth = bodyDepth * 0.42;
  const thighWidth = shoulderWidth * 0.24;
  const shinDepth = bodyDepth * 0.36;
  const shinWidth = shoulderWidth * 0.2;

  group.add(createHumanGroundShadow(centerX, centerZ, item));

  group.add(createHumanCuboid(
    topWearColor,
    centerX,
    torsoCenterY,
    centerZ,
    torsoDepth,
    torsoHeight,
    torsoWidth,
  ));
  group.add(createHumanCuboid(
    topWearShadow,
    centerX - bodyDepth * 0.31,
    torsoCenterY,
    centerZ,
    bodyDepth * 0.035,
    torsoHeight * 0.94,
    torsoWidth * 0.88,
  ));
  group.add(createHumanCuboid(
    topWearHighlight,
    centerX + bodyDepth * 0.33,
    torsoCenterY + torsoHeight * 0.04,
    centerZ,
    bodyDepth * 0.025,
    torsoHeight * 0.72,
    torsoWidth * 0.08,
  ));
  group.add(createHumanCuboid(
    pantsColor,
    centerX,
    pelvisCenterY,
    centerZ,
    bodyDepth * 0.66,
    pelvisHeight,
    shoulderWidth * 0.56,
  ));
  group.add(createHumanCuboid(
    pantsShadow,
    centerX - bodyDepth * 0.28,
    pelvisCenterY,
    centerZ,
    bodyDepth * 0.04,
    pelvisHeight * 0.88,
    shoulderWidth * 0.48,
  ));

  group.add(createHumanCuboid(
    skinColor,
    centerX,
    torsoTopY + (headBottomY - torsoTopY) / 2,
    centerZ,
    bodyDepth * 0.26,
    headBottomY - torsoTopY,
    shoulderWidth * 0.25,
  ));

  group.add(createHumanCuboid(
    skinColor,
    headCenterX,
    headCenterY,
    centerZ,
    headSize,
    headSize,
    headSize,
  ));

  const pixel = headSize / 8;
  const addFrontPixel = (color, centerY, centerZValue, sizeY, sizeZ, depth = panelDepth) => {
    group.add(createHumanCuboid(
      color,
      headFaceX + panelGap + depth / 2,
      centerY,
      centerZValue,
      depth,
      sizeY,
      sizeZ,
    ));
  };
  const addFrontCell = (color, row, column, rowSpan = 1, columnSpan = 1, depth = panelDepth) => {
    addFrontPixel(
      color,
      headTopY - (row + rowSpan / 2) * pixel,
      headLeftZ + (column + columnSpan / 2) * pixel,
      rowSpan * pixel,
      columnSpan * pixel,
      depth,
    );
  };
  const addSideHair = (color, side, centerXValue, centerYValue, sizeX, sizeY, depth = hairThickness) => {
    group.add(createHumanCuboid(
      color,
      centerXValue,
      centerYValue,
      side > 0 ? headRightZ + depth / 2 - hairOverlap : headLeftZ - depth / 2 + hairOverlap,
      sizeX,
      sizeY,
      depth,
    ));
  };

  group.add(createHumanCuboid(
    hairColor,
    headCenterX,
    headTopY + hairThickness / 2 - hairOverlap,
    centerZ,
    headSize + hairOverlap * 2,
    hairThickness,
    headSize + hairOverlap * 2,
  ));
  group.add(createHumanCuboid(
    hairColor,
    headFaceX + hairThickness / 2 - hairOverlap,
    height - pixel * 0.85,
    centerZ,
    hairThickness,
    pixel * 1.7,
    headSize + hairOverlap * 2,
  ));
  group.add(createHumanCuboid(
    hairDark,
    headBackX - hairThickness / 2 + hairOverlap,
    height - (headSize + hairOverlap) / 2,
    centerZ,
    hairThickness,
    headSize + hairOverlap,
    headSize + hairOverlap * 2,
  ));

  [-1, 1].forEach((side) => {
    addSideHair(hairColor, side, headCenterX, height - headSize * 0.36, headSize + hairOverlap * 2, headSize * 0.72);
    addSideHair(hairDark, side, headCenterX - headSize * 0.31, headCenterY - headSize * 0.2, headSize * 0.3, headSize * 0.4, hairThickness * 1.08);
  });

  addFrontCell(hairDark, 1, 2, 1, 2, panelDepth * 1.5);
  addFrontCell(hairColor, 1, 0, 2, 1, panelDepth * 1.5);
  addFrontCell(hairColor, 1, 7, 2, 1, panelDepth * 1.5);
  addFrontCell(hairColor, 2, 0, 1, 1, panelDepth * 1.5);
  addFrontCell(hairColor, 2, 7, 1, 1, panelDepth * 1.5);

  [-1, 1].forEach((side) => {
    const footCenterZ = centerZ + side * shoulderWidth * 0.18;
    const ankle = new THREE.Vector3(centerX + bodyDepth * 0.02, ankleY, footCenterZ);
    const knee = new THREE.Vector3(centerX, kneeY, centerZ + side * shoulderWidth * 0.15);
    const hip = new THREE.Vector3(centerX - bodyDepth * 0.02, hipY, centerZ + side * shoulderWidth * 0.14);
    const shoulder = new THREE.Vector3(centerX + bodyDepth * 0.01, shoulderY, centerZ + side * (shoulderWidth / 2 - armWidth / 2));
    const elbow = new THREE.Vector3(centerX + bodyDepth * 0.02, height * 0.635, centerZ + side * (shoulderWidth / 2 - armWidth / 2));
    const wrist = new THREE.Vector3(centerX + bodyDepth * 0.065, height * 0.455, centerZ + side * (shoulderWidth / 2 - forearmWidth / 2));
    const footAngle = 0;

    group.add(createHumanCuboidBetween(hip, knee, thighDepth, thighWidth, pantsColor));
    group.add(createHumanCuboid(
      pantsShadow,
      knee.x,
      knee.y,
      knee.z,
      thighDepth * 0.88,
      height * 0.035,
      thighWidth * 0.94,
    ));
    group.add(createHumanCuboidBetween(knee, ankle, shinDepth, shinWidth, pantsColor));
    group.add(createHumanCuboid(
      pantsShadow,
      ankle.x,
      ankle.y,
      ankle.z,
      shinDepth * 0.9,
      height * 0.026,
      shinWidth,
    ));

    const sole = createHumanCuboid(
      soleColor,
      centerX,
      soleHeight / 2,
      footCenterZ,
      footLength,
      soleHeight,
      footWidth,
    );
    sole.rotation.y = footAngle;
    group.add(sole);

    const shoe = createHumanCuboid(
      shoeColor,
      centerX,
      soleHeight + (footHeight - soleHeight) / 2,
      footCenterZ,
      footLength * 0.92,
      footHeight - soleHeight,
      footWidth * 0.92,
    );
    shoe.rotation.y = footAngle;
    group.add(shoe);

    group.add(createHumanCuboidBetween(shoulder, elbow, armDepth, armWidth, topWearColor));
    group.add(createHumanCuboid(
      topWearShadow,
      elbow.x,
      elbow.y,
      elbow.z,
      armDepth * 0.92,
      height * 0.028,
      armWidth,
    ));
    group.add(createHumanCuboidBetween(elbow, wrist, forearmDepth, forearmWidth, skinColor));
  });

  return group;
}

function createHumanCuboid(color, x, y, z, sizeX, sizeY, sizeZ) {
  return createLowPolyMesh(
    new THREE.BoxGeometry(sizeX, sizeY, sizeZ),
    color,
    x,
    y,
    z,
  );
}

function createHumanCuboidBetween(start, end, sizeX, sizeZ, color) {
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();
  const cuboid = createHumanCuboid(color, 0, 0, 0, sizeX, length, sizeZ);
  cuboid.position.copy(start).add(end).multiplyScalar(0.5);
  cuboid.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return cuboid;
}

function createHumanGroundShadow(centerX, centerZ, item) {
  const shadow = new THREE.Mesh(
    new THREE.BoxGeometry(item.length * 1.75, 0.01, item.width * 1.05),
    new THREE.MeshBasicMaterial({
      color: '#02040a',
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
    }),
  );
  shadow.position.set(centerX, 0.006, centerZ);
  return shadow;
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
      const hubZ = item.z + side * (item.width / 2 + hubDepth / 2 + 0.012);
      group.add(createWheel(x, wheelRadius, z, wheelRadius, wheelDepth, wheelColor));
      group.add(createWheel(x, wheelRadius, hubZ, wheelRadius * 0.42, hubDepth, hubColor));
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

function createSmoothOrientedCylinder(start, end, startRadius, endRadius, color, radialSegments = 20) {
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();
  const geometry = new THREE.CylinderGeometry(endRadius, startRadius, length, radialSegments, 1);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, createMaterial(color));
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return mesh;
}

function createSmoothOrientedCone(base, tip, radius, color, radialSegments = 18) {
  const direction = new THREE.Vector3().subVectors(tip, base);
  const length = direction.length();
  const geometry = new THREE.ConeGeometry(radius, length, radialSegments, 1);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, createMaterial(color));
  mesh.position.copy(base).add(tip).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return mesh;
}

function createFuselageSurface(sections, centerZ, startAngleDegrees, endAngleDegrees, color) {
  const radialSegments = 28;
  const startAngle = THREE.MathUtils.degToRad(startAngleDegrees);
  const endAngle = THREE.MathUtils.degToRad(endAngleDegrees);
  const positions = [];
  const indices = [];

  sections.forEach((section) => {
    for (let step = 0; step <= radialSegments; step += 1) {
      const t = step / radialSegments;
      const angle = startAngle + (endAngle - startAngle) * t;
      const point = getFuselageSectionPoint(section, centerZ, angle);
      positions.push(point.x, point.y, point.z);
    }
  });

  const rowLength = radialSegments + 1;
  for (let sectionIndex = 0; sectionIndex < sections.length - 1; sectionIndex += 1) {
    for (let step = 0; step < radialSegments; step += 1) {
      const a = sectionIndex * rowLength + step;
      const b = a + 1;
      const c = a + rowLength;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const material = createMaterial(color);
  material.side = THREE.DoubleSide;
  return new THREE.Mesh(geometry, material);
}

function createFuselageNoseCap(section, centerZ, color) {
  const radialSegments = 28;
  const positions = [section.x, section.y, centerZ];
  const indices = [];

  for (let step = 0; step <= radialSegments; step += 1) {
    const angle = (Math.PI * 2 * step) / radialSegments;
    const point = getFuselageSectionPoint(section, centerZ, angle);
    positions.push(point.x, point.y, point.z);
  }

  for (let step = 1; step <= radialSegments; step += 1) {
    indices.push(0, step, step + 1);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const material = createMaterial(color);
  material.side = THREE.DoubleSide;
  return new THREE.Mesh(geometry, material);
}

function getFuselageSectionPoint(section, centerZ, angle) {
  const sin = Math.sin(angle);
  const verticalScale = sin >= 0
    ? section.upperRadiusScale ?? 1
    : section.lowerRadiusScale ?? 1;

  return {
    x: section.x,
    y: section.y + sin * section.radius * verticalScale,
    z: centerZ + Math.cos(angle) * section.radius,
  };
}

function createVariablePrism(points, thickness, color) {
  const halfThickness = thickness / 2;
  const positions = [
    ...points.flatMap(([x, y, z]) => [x, y - halfThickness, z]),
    ...points.flatMap(([x, y, z]) => [x, y + halfThickness, z]),
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(createPrismIndices(points.length));
  geometry.computeVertexNormals();
  const material = createMaterial(color);
  material.side = THREE.DoubleSide;
  return new THREE.Mesh(geometry, material);
}

function createFlatPolygonFromXY(points, z, color) {
  const geometry = new THREE.BufferGeometry();
  const indices = [];
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points.flatMap(([x, y]) => [x, y, z]), 3));
  for (let index = 1; index < points.length - 1; index += 1) {
    indices.push(0, index, index + 1);
  }
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const material = createLowPolyMaterial(color);
  material.side = THREE.DoubleSide;
  return new THREE.Mesh(geometry, material);
}

function createFlatPolygonFromXYZ(points, color) {
  const geometry = new THREE.BufferGeometry();
  const indices = [];
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points.flatMap(([x, y, z]) => [x, y, z]), 3));
  for (let index = 1; index < points.length - 1; index += 1) {
    indices.push(0, index, index + 1);
  }
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const material = createLowPolyMaterial(color);
  material.side = THREE.DoubleSide;
  material.polygonOffset = true;
  material.polygonOffsetFactor = -1;
  material.polygonOffsetUnits = -1;
  return new THREE.Mesh(geometry, material);
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
