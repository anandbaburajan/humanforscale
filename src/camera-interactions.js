import * as THREE from 'three';
import {
  DOUBLE_TAP_MAX_DELAY,
  DOUBLE_TAP_MAX_MOVEMENT,
  FOCUS_DISTANCE_SCALE,
  FOCUS_MAX_DISTANCE,
  FOCUS_MIN_DISTANCE,
  MAX_CAMERA_DISTANCE,
  MIN_CAMERA_DISTANCE,
  MIN_ORBIT_TARGET_DISTANCE,
  PINCH_ZOOM_POWER,
  TAP_FOCUS_MAX_DURATION,
  TAP_FOCUS_MAX_MOVEMENT,
  WHEEL_LINE_HEIGHT,
  WHEEL_ZOOM_SPEED,
} from './config.js';

export function setupCameraInteractions({ renderer, camera, controls, focusableObjects }) {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const pointerRay = new THREE.Ray();
  const cameraForward = new THREE.Vector3();
  const dollyMove = new THREE.Vector3();
  const activePointers = new Set();
  const activePointerPositions = new Map();
  const tapStart = {
    pointerId: null,
    x: 0,
    y: 0,
    time: 0,
  };
  const lastTap = {
    pointerType: null,
    x: 0,
    y: 0,
    time: -Infinity,
  };
  const temporaryPanGesture = {
    pointerId: null,
    previousLeftMouseAction: null,
    previousOneTouchAction: null,
  };
  let pinchDistance = null;
  let isPanModifierActive = false;
  let isPointerPanDrag = false;

  setupPointerFocus();

  function setupPointerFocus() {
    renderer.domElement.addEventListener('wheel', onWheelDolly, { capture: true, passive: false });
    renderer.domElement.addEventListener('pointerdown', onPointerDown, { capture: true, passive: true });
    renderer.domElement.addEventListener('pointermove', onPointerMove, { capture: true, passive: true });
    renderer.domElement.addEventListener('pointerup', onPointerUp, { capture: true, passive: true });
    renderer.domElement.addEventListener('pointercancel', onPointerCancel, { capture: true, passive: true });
    renderer.domElement.addEventListener('lostpointercapture', onPointerCancel, { capture: true, passive: true });
    window.addEventListener('keydown', onPanModifierChange, { passive: true });
    window.addEventListener('keyup', onPanModifierChange, { passive: true });
    window.addEventListener('blur', clearPanCursorState, { passive: true });
  }

  function onWheelDolly(event) {
    event.preventDefault();
    event.stopImmediatePropagation();

    const deltaY = getNormalizedWheelDelta(event);
    const scale = Math.exp(-deltaY * WHEEL_ZOOM_SPEED);
    dollyFromScreenPoint(event.clientX, event.clientY, scale);
  }

  function onPointerDown(event) {
    const now = window.performance.now();

    activePointers.add(event.pointerId);
    activePointerPositions.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    if (event.pointerType === 'touch' && activePointers.size === 2) {
      if (temporaryPanGesture.pointerId !== null) {
        lastTap.time = -Infinity;
      }
      endTemporaryPanGesture();
      pinchDistance = getPinchDistance();
      tapStart.pointerId = null;
      return;
    }

    if (!event.isPrimary || activePointers.size !== 1) {
      tapStart.pointerId = null;
      return;
    }

    const isSecondTap = isRecentTap(event.pointerType, event.clientX, event.clientY, now);

    if (event.pointerType === 'touch' && isSecondTap) {
      startTemporaryPanGesture(event);
    }

    if (event.pointerType === 'mouse' && event.button === 0 && isSecondTap) {
      startTemporaryPanGesture(event);
    }

    if (event.pointerType === 'mouse') {
      isPointerPanDrag = temporaryPanGesture.pointerId === event.pointerId
        || event.button === 2
        || event.metaKey
        || event.ctrlKey
        || event.shiftKey;
      isPanModifierActive = event.metaKey || event.ctrlKey || event.shiftKey;
      updatePanCursor();
    }

    tapStart.pointerId = event.pointerId;
    tapStart.x = event.clientX;
    tapStart.y = event.clientY;
    tapStart.time = now;
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
    const wasTemporaryPanGesture = temporaryPanGesture.pointerId === event.pointerId;
    activePointers.delete(event.pointerId);
    activePointerPositions.delete(event.pointerId);

    if (event.pointerType === 'mouse') {
      isPointerPanDrag = false;
      updatePanCursor();
    }

    if (wasTemporaryPanGesture) {
      endTemporaryPanGesture();
    }

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
      if (wasTemporaryPanGesture) {
        lastTap.time = -Infinity;
      }
      return;
    }

    const delay = now - lastTap.time;
    const tapDistance = getScreenDistance(event.clientX, event.clientY, lastTap.x, lastTap.y);
    const isDoubleTap = lastTap.pointerType === event.pointerType
      && delay <= DOUBLE_TAP_MAX_DELAY
      && tapDistance <= DOUBLE_TAP_MAX_MOVEMENT;

    lastTap.pointerType = event.pointerType;
    lastTap.x = event.clientX;
    lastTap.y = event.clientY;
    lastTap.time = now;

    if (isDoubleTap) {
      focusCameraAt(event.clientX, event.clientY);
      lastTap.time = -Infinity;
    }
  }

  function onPointerCancel(event) {
    if (event.pointerType === 'mouse') {
      isPointerPanDrag = false;
      updatePanCursor();
    }

    if (temporaryPanGesture.pointerId === event.pointerId) {
      lastTap.time = -Infinity;
      endTemporaryPanGesture();
    }

    activePointers.delete(event.pointerId);
    activePointerPositions.delete(event.pointerId);
    tapStart.pointerId = null;

    if (activePointers.size < 2) {
      pinchDistance = null;
    }
  }

  function startTemporaryPanGesture(event) {
    if (temporaryPanGesture.pointerId !== null) {
      return;
    }

    temporaryPanGesture.pointerId = event.pointerId;

    if (event.pointerType === 'mouse') {
      temporaryPanGesture.previousLeftMouseAction = controls.mouseButtons.LEFT;
      controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
      return;
    }

    if (event.pointerType === 'touch') {
      temporaryPanGesture.previousOneTouchAction = controls.touches.ONE;
      controls.touches.ONE = THREE.TOUCH.PAN;
    }
  }

  function endTemporaryPanGesture() {
    if (temporaryPanGesture.pointerId === null) {
      return;
    }

    if (temporaryPanGesture.previousLeftMouseAction !== null) {
      controls.mouseButtons.LEFT = temporaryPanGesture.previousLeftMouseAction;
    }

    if (temporaryPanGesture.previousOneTouchAction !== null) {
      controls.touches.ONE = temporaryPanGesture.previousOneTouchAction;
    }

    temporaryPanGesture.pointerId = null;
    temporaryPanGesture.previousLeftMouseAction = null;
    temporaryPanGesture.previousOneTouchAction = null;
  }

  function onPanModifierChange(event) {
    if (!isPanModifierKey(event)) {
      return;
    }

    isPanModifierActive = event.metaKey || event.ctrlKey || event.shiftKey;
    updatePanCursor();
  }

  function clearPanCursorState() {
    isPanModifierActive = false;
    isPointerPanDrag = false;
    updatePanCursor();
  }

  function updatePanCursor() {
    renderer.domElement.classList.toggle('is-pan-cursor', isPanModifierActive || isPointerPanDrag);
    renderer.domElement.classList.toggle('is-panning', isPointerPanDrag);
  }

  function isPanModifierKey(event) {
    return event.key === 'Meta' || event.key === 'Control' || event.key === 'Shift';
  }

  function isRecentTap(pointerType, clientX, clientY, now) {
    const delay = now - lastTap.time;

    if (lastTap.pointerType !== pointerType || delay > DOUBLE_TAP_MAX_DELAY) {
      return false;
    }

    return getScreenDistance(clientX, clientY, lastTap.x, lastTap.y) <= DOUBLE_TAP_MAX_MOVEMENT;
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

}
