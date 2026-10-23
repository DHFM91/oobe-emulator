// OOBE Emulator - cameras.js (standalone module)
// Lists and opens any camera the browser can see: webcams, USB cameras,
// and USB capture cards (e.g. a drone controller's HDMI-out -> capture card).
// Usage:
//   import { listCameras, openCamera, stopStream } from './cameras.js';
//   const cams = await listCameras();             // [{deviceId, label}]
//   const stream = await openCamera(cams[0].deviceId);
//   videoEl.srcObject = stream;

export async function listCameras() {
  if (!navigator.mediaDevices?.enumerateDevices) {
    throw new Error('This browser cannot access cameras.');
  }
  let devices = await navigator.mediaDevices.enumerateDevices();
  // Labels stay blank until permission is granted once; ask briefly, then release.
  if (devices.some(d => d.kind === 'videoinput' && !d.label)) {
    try {
      const tmp = await navigator.mediaDevices.getUserMedia({ video: true });
      tmp.getTracks().forEach(t => t.stop());
      devices = await navigator.mediaDevices.enumerateDevices();
    } catch (e) {
      throw new Error('Camera permission was denied.');
    }
  }
  return devices
    .filter(d => d.kind === 'videoinput')
    .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Camera ${i + 1}` }));
}

export async function openCamera(deviceId, { width = 1920, height = 1080 } = {}) {
  return navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      deviceId: deviceId ? { exact: deviceId } : undefined,
      width: { ideal: width },
      height: { ideal: height },
      frameRate: { ideal: 60 },
    },
  });
}

export function stopStream(stream) {
  stream?.getTracks().forEach(t => t.stop());
}

// Fills a <select> with cameras; returns the list.
export async function fillCameraSelect(selectEl) {
  const cams = await listCameras();
  selectEl.innerHTML = cams.length
    ? cams.map(c => `<option value="${c.deviceId}">${c.label.replace(/</g, '&lt;')}</option>`).join('')
    : '<option value="">No cameras found</option>';
  return cams;
}

// Re-run a callback when cameras are plugged in or removed.
export function onCamerasChanged(cb) {
  navigator.mediaDevices?.addEventListener('devicechange', cb);
}
