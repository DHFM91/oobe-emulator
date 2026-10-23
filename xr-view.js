// OOBE Emulator - xr-view.js (standalone module)
// Shows a <video> element as a giant floating screen inside VR (WebXR),
// in a dark ethereal void with drifting motes and a faint silver cord.
// Works with HTC Vive through SteamVR in Chrome or Edge.
// Usage:
//   import { isVRSupported, enterOOBE } from './xr-view.js';
//   if (await isVRSupported()) await enterOOBE(videoEl, { onExit });
// Exit: press either controller's grip/squeeze button, or end the session.

import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

export async function isVRSupported() {
  try { return !!(navigator.xr && await navigator.xr.isSessionSupported('immersive-vr')); }
  catch { return false; }
}

export async function enterOOBE(video, { onExit, screenDistance = 3.2, screenWidth = 4.2 } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local');
  renderer.domElement.className = 'oobe-xr-canvas';
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05040b);
  scene.fog = new THREE.FogExp2(0x05040b, 0.06);
  const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 200);

  // Everything except the headset moves inside "world", so we can drift it for the detachment effect.
  const world = new THREE.Group();
  scene.add(world);

  // --- Floating video screen ---
  const tex = new THREE.VideoTexture(video);
  tex.colorSpace = THREE.SRGBColorSpace;
  const aspect = (video.videoWidth || 16) / (video.videoHeight || 9);
  const screenH = screenWidth / aspect;
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(screenWidth, screenH),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0 })
  );
  screen.position.set(0, 0, -screenDistance);
  world.add(screen);

  // Soft glow halo behind the screen
  const halo = new THREE.Mesh(
    new THREE.PlaneGeometry(screenWidth * 1.25, screenH * 1.35),
    new THREE.MeshBasicMaterial({ color: 0x9fb8ff, transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending })
  );
  halo.position.set(0, 0, -screenDistance - 0.05);
  world.add(halo);

  // --- Drifting motes ---
  const N = 600, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 30;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 20;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 30;
  }
  const motesGeo = new THREE.BufferGeometry();
  motesGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const motes = new THREE.Points(motesGeo, new THREE.PointsMaterial({
    color: 0xc8d6ff, size: 0.035, transparent: true, opacity: 0.55, depthWrite: false }));
  world.add(motes);

  // --- Silver cord: trails from just below the viewer down into the void ("back to your body") ---
  const cordPts = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    cordPts.push(new THREE.Vector3(Math.sin(t * 6) * 0.15 * t, -0.6 - t * 6, 0.4 + t * 2.5));
  }
  const cord = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cordPts), 80, 0.008, 6),
    new THREE.MeshBasicMaterial({ color: 0xdfe6f5, transparent: true, opacity: 0.35,
      blending: THREE.AdditiveBlending, depthWrite: false })
  );
  scene.add(cord); // attached to the viewer's space, not the world, so it always trails "home"

  // --- Session ---
  const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor'] });
  await renderer.xr.setSession(session);

  // Grip/squeeze on either controller = Return to Body
  session.addEventListener('squeeze', () => session.end());

  const start = performance.now();
  renderer.setAnimationLoop(() => {
    const t = (performance.now() - start) / 1000;
    // Detachment sequence (first ~4s): the world sinks away as you "rise", screen fades in.
    const d = Math.min(t / 4, 1), ease = 1 - Math.pow(1 - d, 3);
    world.position.y = -1.2 * ease + 1.2;   // starts 1.2m high, settles at eye level
    screen.material.opacity = ease;
    halo.material.opacity = 0.08 + Math.sin(t * 1.3) * 0.03 * ease;
    // Gentle bob so the scene feels weightless (kept tiny to avoid sickness)
    screen.position.y = Math.sin(t * 0.6) * 0.03;
    motes.rotation.y = t * 0.01;
    cord.material.opacity = 0.25 + Math.sin(t * 2.1) * 0.08;
    renderer.render(scene, camera);
  });

  session.addEventListener('end', () => {
    renderer.setAnimationLoop(null);
    tex.dispose(); renderer.dispose();
    renderer.domElement.remove();
    onExit?.();
  });
  return session;
}
