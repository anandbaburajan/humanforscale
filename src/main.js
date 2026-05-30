import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import './styles.css';

import {
  CAMERA_FAR,
  CAMERA_NEAR,
  CUSTOM_OBJECT_COLOR,
  CUSTOM_OBJECT_ROW_GAP,
  GRID_BOX_SIZE,
  GROUND_CENTER_X,
  GROUND_SIZE,
  HUMAN_SCALE,
  INITIAL_CAMERA_POSITION,
  INITIAL_CAMERA_TARGET,
  LABEL_GAP,
  LABEL_WIDTH,
  MAX_CAMERA_DISTANCE,
  MIN_CAMERA_DISTANCE,
  OBJECTS,
  WORLD_FOCUS_CENTER,
  WORLD_FOCUS_RADIUS,
} from './config.js';
import { setupCameraInteractions } from './camera-interactions.js';
import { createGroundText, createScaleObject } from './scale-objects.js';

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

const focusableObjects = [];

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
let customForm = null;
let customFormToggle = null;
let customFormBackdrop = null;
const mobileCustomFormQuery = window.matchMedia('(max-width: 520px)');

buildScene();
setupBrandLabel();
setupCoffeeButton();
setupCustomForm();
setupCameraInteractions({ renderer, camera, controls, focusableObjects });
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

function setupCoffeeButton() {
  const coffeeButton = document.createElement('a');
  coffeeButton.className = 'coffee-button';
  coffeeButton.href = 'https://buymeacoffee.com/anandbaburajan';
  coffeeButton.target = '_blank';
  coffeeButton.rel = 'noreferrer';
  coffeeButton.textContent = 'Buy me a coffee';
  sceneRoot.appendChild(coffeeButton);
}

function setupCustomForm() {
  customFormToggle = document.createElement('button');
  customFormToggle.className = 'custom-object-toggle';
  customFormToggle.type = 'button';
  customFormToggle.textContent = '+';
  customFormToggle.setAttribute('aria-label', 'Add custom object');
  customFormToggle.setAttribute('aria-controls', 'custom-dimensions-form');
  customFormToggle.setAttribute('aria-expanded', 'false');
  customFormToggle.addEventListener('click', openCustomFormDialog);

  customFormBackdrop = document.createElement('div');
  customFormBackdrop.className = 'custom-dimensions-backdrop';
  customFormBackdrop.hidden = true;
  customFormBackdrop.addEventListener('click', closeCustomFormDialog);

  const form = document.createElement('form');
  customForm = form;
  form.id = 'custom-dimensions-form';
  form.className = 'custom-dimensions-form';
  form.setAttribute('aria-label', 'Add custom cuboid');
  form.setAttribute('aria-labelledby', 'custom-dimensions-title');
  form.innerHTML = `
    <div class="custom-dimensions-form__header">
      <div id="custom-dimensions-title" class="custom-dimensions-form__title">Add a custom object</div>
      <button class="custom-dimensions-form__close" type="button" aria-label="Close custom object dialog"></button>
    </div>
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
    <button class="custom-dimensions-form__submit" type="submit">Add</button>
    <p class="custom-dimensions-form__message" aria-live="polite"></p>
  `;
  form.addEventListener('submit', onCustomFormSubmit);
  form.querySelector('.custom-dimensions-form__close').addEventListener('click', closeCustomFormDialog);
  window.addEventListener('keydown', onCustomFormKeyDown);
  sceneRoot.appendChild(customFormToggle);
  sceneRoot.appendChild(customFormBackdrop);
  sceneRoot.appendChild(form);
}

function openCustomFormDialog() {
  customForm.classList.add('is-open');
  customForm.setAttribute('role', 'dialog');
  customForm.setAttribute('aria-modal', 'true');
  customFormBackdrop.hidden = false;
  customFormToggle.setAttribute('aria-expanded', 'true');

  const firstInput = customForm.elements.namedItem('custom-length');
  requestAnimationFrame(() => firstInput?.focus());
}

function closeCustomFormDialog() {
  customForm.classList.remove('is-open');
  customForm.removeAttribute('role');
  customForm.removeAttribute('aria-modal');
  customFormBackdrop.hidden = true;
  customFormToggle.setAttribute('aria-expanded', 'false');
  customFormToggle.focus();
}

function onCustomFormKeyDown(event) {
  if (event.key !== 'Escape' || !customForm.classList.contains('is-open')) {
    return;
  }

  event.preventDefault();
  closeCustomFormDialog();
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
  form.querySelector('.custom-dimensions-form__submit').textContent = 'Update';
  setCustomObject(dimensions);

  if (mobileCustomFormQuery.matches) {
    closeCustomFormDialog();
  }
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
    const label = createGroundText(
      item.name,
      item.x - LABEL_GAP - LABEL_WIDTH / 2,
      item.z,
      renderer.capabilities.getMaxAnisotropy(),
    );
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
