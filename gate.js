// OOBE Emulator - gate.js (standalone module)
// Splash screen: liability disclaimer + admin password gate.
// Usage:  import { runGate } from './gate.js';
//         await runGate(document.body);   // resolves once the user is let in
//
// The password itself is NOT stored here, only its SHA-256 hash.
// To change the password, run in a browser console:
//   crypto.subtle.digest('SHA-256', new TextEncoder().encode('NEWPASS'))
//     .then(b => console.log([...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')))
// and paste the result into PASSWORD_SHA256 below.
// NOTE: a browser-side check is a speed bump, not real security.

export const PASSWORD_SHA256 =
  'a65d976f2dd32bd857ad55063ee0d5edc7ac3ec9d4f2356fb81bb9ec46d86322';

const UNLOCK_KEY = 'oobe.unlockedUntil';
const UNLOCK_HOURS = 24;

const DISCLAIMER_HTML = `
<h2>Before You Leave Your Body</h2>
<p><strong>OOBE Emulator is an experimental hobby project provided "AS IS", with no warranty of any kind.
By continuing, you agree that you use it entirely at your own risk and that its creators accept no
liability for any injury, illness, loss or damage arising from its use.</strong></p>
<h3>Health</h3>
<ul>
<li>VR and live camera feeds can cause motion sickness, dizziness, nausea, disorientation, eye strain and headaches.</li>
<li>Flashing or flickering imagery may trigger seizures in people with photosensitive epilepsy, including people with no prior history.</li>
<li>Do not use if you are pregnant, elderly, have heart, vision, balance or psychiatric conditions, or are under the influence of alcohol or drugs, without first consulting a doctor. Follow your headset manufacturer's health and safety warnings.</li>
<li><strong>Stop immediately</strong> at the first sign of discomfort. Do not drive or operate machinery until fully recovered.</li>
<li>Not suitable for children.</li>
</ul>
<h3>Physical Safety</h3>
<ul>
<li>Stay seated. Clear your surroundings of obstacles, stairs, people and pets.</li>
<li>Never wear the headset while personally piloting a drone or moving vehicle. Flying beyond your own direct line of sight may be illegal where you live.</li>
</ul>
<h3>Camera Feeds</h3>
<ul>
<li>Feeds may lag, freeze, distort or drop without warning. Never rely on them for navigation or safety.</li>
<li>You are responsible for having permission to film any people, places and property, and for following local laws.</li>
</ul>
<h3>Privacy</h3>
<ul>
<li>Camera video is processed in your browser. This app does not record or upload your video.</li>
<li>Any network streaming you set up yourself (phones, drones, relays) is outside this app's control.</li>
</ul>`;

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function stillUnlocked() {
  try { return Number(localStorage.getItem(UNLOCK_KEY) || 0) > Date.now(); } catch { return false; }
}
function rememberUnlock() {
  try { localStorage.setItem(UNLOCK_KEY, String(Date.now() + UNLOCK_HOURS * 3600e3)); } catch {}
}

export function runGate(root = document.body) {
  return new Promise(resolve => {
    const wrap = document.createElement('div');
    wrap.className = 'oobe-gate';
    wrap.innerHTML = `
      <div class="oobe-gate-card">
        <h1 class="oobe-title">OOBE Emulator</h1>
        <p class="oobe-sub">Out of Body Experience Emulator</p>
        <div class="oobe-disclaimer">${DISCLAIMER_HTML}</div>
        <label class="oobe-check"><input type="checkbox" id="oobeAccept">
          I have read and understood the above, I accept all risks, and I agree the creators bear no liability.</label>
        <div class="oobe-pass-row">
          <input type="password" id="oobePass" placeholder="Admin password" autocomplete="off">
          <button id="oobeEnter" disabled>Enter</button>
        </div>
        <p class="oobe-err" id="oobeErr"></p>
      </div>`;
    root.appendChild(wrap);

    const accept = wrap.querySelector('#oobeAccept');
    const pass = wrap.querySelector('#oobePass');
    const btn = wrap.querySelector('#oobeEnter');
    const err = wrap.querySelector('#oobeErr');
    const unlocked = stillUnlocked();
    if (unlocked) { pass.style.display = 'none'; }

    const refresh = () => { btn.disabled = !accept.checked || (!unlocked && !pass.value); };
    accept.addEventListener('change', refresh);
    pass.addEventListener('input', refresh);

    const tryEnter = async () => {
      if (btn.disabled) return;
      if (!unlocked && (await sha256Hex(pass.value)) !== PASSWORD_SHA256) {
        err.textContent = 'Incorrect password.';
        pass.value = ''; refresh();
        return;
      }
      rememberUnlock();
      wrap.remove();
      resolve();
    };
    btn.addEventListener('click', tryEnter);
    pass.addEventListener('keydown', e => { if (e.key === 'Enter') tryEnter(); });
  });
}
