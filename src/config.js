import * as THREE from 'three';

export const OBJECTS = [
  { name: 'Car', shape: 'car', length: 5.021, width: 1.987, height: 1.43, color: '#ffb45f', x: 0, z: 0, scaleHuman: true },
  { name: 'Soccer field', shape: 'soccerField', length: 105, width: 68, height: 0.32, color: '#28733f', x: 0, z: -55 },
  { name: '100 m', shape: 'track', length: 100, lanes: 8, laneWidth: 1.22, height: 0.32, color: '#b9573f', x: 0, z: -8 },
  { name: '1 km', shape: 'distancePlane', length: 1000, width: 18, height: 0.32, color: '#172335', x: 0, z: -112 },
  { name: '1 mile', shape: 'distancePlane', length: 1609.344, width: 18, height: 0.32, color: '#1b2b43', x: 0, z: -136 },
  { name: 'Boeing 737-800', shape: 'boeing737', length: 39.47, width: 35.79, height: 12.55, fuselageDiameter: 3.76, color: '#f6f8fb', x: 0, z: -180 },
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
export const CUSTOM_OBJECT_COLOR = '#cfcfcf';
export const CUSTOM_OBJECT_ROW_GAP = 8;
export const GROUND_SIZE = 6000;
export const GROUND_CENTER_X = 800;
export const GRID_BOX_SIZE = 10;
export const LABEL_GAP = 1.2;
export const LABEL_WIDTH = 6.4;
export const LABEL_HEIGHT = 1.85;
export const HUMAN_SCALE = {
  length: 0.3,
  width: 0.45,
  height: 1.75,
};
export const CAMERA_NEAR = 0.01;
export const CAMERA_FAR = 2600;
export const MIN_CAMERA_DISTANCE = 0.025;
export const MAX_CAMERA_DISTANCE = 2400;
export const MIN_ORBIT_TARGET_DISTANCE = 0.12;
export const WHEEL_ZOOM_SPEED = 0.004;
export const WHEEL_LINE_HEIGHT = 16;
export const PINCH_ZOOM_POWER = 1.45;
export const INITIAL_CAMERA_TARGET = new THREE.Vector3(50, 5, -55);
export const INITIAL_CAMERA_POSITION = new THREE.Vector3(-20, 14, 35);
export const WORLD_FOCUS_CENTER = new THREE.Vector3(GROUND_CENTER_X, 0, -75);
export const WORLD_FOCUS_RADIUS = GROUND_SIZE * 0.72;
export const TAP_FOCUS_MAX_DURATION = 280;
export const TAP_FOCUS_MAX_MOVEMENT = 10;
export const DOUBLE_TAP_MAX_DELAY = 360;
export const DOUBLE_TAP_MAX_MOVEMENT = 34;
export const FOCUS_DISTANCE_SCALE = 0.45;
export const FOCUS_MIN_DISTANCE = 1.2;
export const FOCUS_MAX_DISTANCE = 180;
