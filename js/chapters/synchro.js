// Chapter 4: synchromesh, slowly. A brass ring rubs on a cone until the free gear and the shaft
// turn at the same speed; only then can the collar's teeth slide over the gear's dog teeth.
import { THREE, M, rod, beam, latheX, arrow, approach, clamp, canvasTexture } from '../kit.js';
import { gear, gearMat, glow, fit, isNarrow, trim, isReel, plotFrame, board, COL, T, ratioOf, TAU, DEG, fmt } from '../gearbox.js';

// ---- the physics, with typical figures for a small car's gearbox
// Cone clutch: torque = μ·F·R ÷ sin(α) (any machine-design text; Bosch Automotive Handbook, "Synchronizers").
const MU = 0.1;                    // brass on steel in gear oil: about 0.08 to 0.12
const ALPHA = 6.5 * DEG;           // cone half-angle: usually 6 to 7 degrees, shallow enough to wedge hard yet still let go
const R_CONE = 0.03;               // mean cone radius, m (a 60 mm cone)
const LEVER = 7;                   // gear lever and linkage multiply the hand's push about 7 times at the collar
const J_IN = 0.006;                // kg·m²: clutch plate, input shaft and layshaft cluster, measured at the input shaft
const DRAG_IN = 5;                 // N·m at the input shaft from a clutch that has not fully let go
const OIL_IN = 0.8;                // N·m of oil churning that slows the free-spinning shafts in neutral
const CLASH = 3;                   // N·m: clashing dog teeth scrape the two speeds together, slowly and noisily
// Each shift: [gear you leave, gear you want, engine rpm just before the change].
const SHIFTS = { 23: [2, 3, 4000], 12: [1, 2, 4000], 32: [3, 2, 2500], 21: [2, 1, 2000] };
const setup = (s) => {
  const [from, to, rpm] = SHIFTS[s.shift], shaft = rpm / ratioOf(from), gear0 = rpm / ratioOf(to);
  const J = J_IN * ratioOf(to) ** 2, F = s.push * LEVER, Tc = (MU * F * R_CONE) / Math.sin(ALPHA), Td = (s.drag ? DRAG_IN : 0) * ratioOf(to);
  const dw = Math.abs(gear0 - shaft) * TAU / 60, net = Tc - Td;
  return { from, to, rpm, shaft, gear0, J, F, Tc, Td, dw, net, time: net > 0 ? (J * dw) / net : Infinity, heat: 0.5 * J * dw * dw };
};

const NT = 24, RT = 1.75, PITCH = TAU / NT, YA = 4.3;
const XB = 0.17, XD = 0.58, XF = 0.95;       // collar positions: baulked on the ring, at the dog teeth, fully home
// A ring of N straight teeth around the X axis: each a bar L long, pointed at the chosen ends.
function teeth(N, R, L, w, hgt, mat, pl = 0, pr = 0) {
  const sh = new THREE.Shape(), c = w * 0.75;
  sh.moveTo(-L / 2 + (pl ? c : 0), -w / 2); sh.lineTo(L / 2 - (pr ? c : 0), -w / 2); if (pr) sh.lineTo(L / 2, 0); sh.lineTo(L / 2 - (pr ? c : 0), w / 2); sh.lineTo(-L / 2 + (pl ? c : 0), w / 2); if (pl) sh.lineTo(-L / 2, 0); sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: hgt, bevelEnabled: false });
  const m = new THREE.InstancedMesh(g, mat, N), o = new THREE.Object3D();
  for (let i = 0; i < N; i++) { const a = i * (TAU / N); o.rotation.set(a - Math.PI / 2, 0, 0); o.position.set(0, R * Math.cos(a), R * Math.sin(a)); o.updateMatrix(); m.setMatrixAt(i, o.matrix); }
  m.castShadow = true;
  return m;
}
const G = (v) => String(v);

export default {
  id: 'synchro',
  short: 'Synchromesh',
  title: 'Synchromesh: matching speeds first',
  subtitle: 'A brass ring rubs on a cone until gear and shaft turn together. Then the collar slides in.',
  view: { get pos() { return VIEW().pos; }, get target() { return VIEW().target; } },
  learn: `<p>Here is the catch with sliding collars. The collar turns with the main shaft, at the speed the <b>road</b> sets. The gear you want is spinning at the speed the <b>engine side</b> left it. Changing from 2nd to 3rd at 4,000 rpm, the shaft turns at 1,926 rpm and the 3rd gear at 3,058 rpm. Push the collar's teeth at teeth going 1,100 rpm faster and they clash: the famous <b>crunch</b>.</p>
    <p><b>Synchromesh</b> fixes this with friction. The gear carries a polished steel <b>cone</b>. A brass <b>baulk ring</b> (synchro ring) sits over it. When you push the lever, the collar first shoves the ring onto the cone. The ring rubs, like a tiny brake or clutch, and drags the gear towards the shaft's speed. You have pressed the clutch pedal, so the gear only has to slow a few light parts, not the engine.</p>
    <p>While they still differ, friction twists the ring a quarter of a tooth sideways, so its pointed teeth sit right in the path of the collar's teeth. That is the <b>baulk</b>: the harder you push, the harder it rubs, but the collar cannot pass. The moment the speeds match, the drag vanishes, the ring lines up, and the collar slips through and over the gear's <b>dog teeth</b>. All in a fraction of a second.</p>
    <p>If the clutch is <b>dragging</b> (pedal not fully down, or a worn clutch: see <a href="https://glassbox.how/clutchclear/" target="_blank" rel="noopener">ClutchClear</a>), the engine keeps pulling the gear away and the ring may never win. Old lorries, buses and early cars had no synchromesh at all. Their drivers <b>double-declutched</b>: clutch down, into neutral, clutch up, blip the throttle (or wait) to match the speeds by ear, clutch down again, and in.</p>
    <p class="tip"><b>Try it:</b> press Change gear and watch the two speed lines meet. Then switch synchromesh off and try a downshift without matching the revs.</p>`,
  terms: [
    { t: 'Synchromesh', d: 'A small friction clutch built into each gear that matches the gear’s speed to the shaft before the collar engages.' },
    { t: 'Baulk ring', d: 'The brass synchro ring. It rubs on the gear’s cone and blocks the collar until the speeds are equal.' },
    { t: 'Cone', d: 'The tapered, polished surface on the side of a gear that the baulk ring grips.' },
    { t: 'Dog teeth', d: 'The ring of small teeth on the side of a gear that the collar slides over to lock it to the shaft.' },
    { t: 'Double-declutching', d: 'Pressing the clutch twice, with a pause in neutral to match engine and gear speeds by hand. Needed on gearboxes without synchromesh.' },
    { t: 'Clutch drag', d: 'A clutch that does not fully release, so the engine keeps turning the gearbox input a little.' },
  ],
  defaults: { shift: '23', push: 60, synchro: true, drag: false, slow: 30, cut: true, go: 0, back: 0, match: 0 },
  onChange(s, key) { s.shift = G(s.shift); if (key === 'shift' || key === 'synchro' || key === 'drag') s.back = (s.back || 0) + 1; },
  controls: [
    { type: 'buttons', label: 'Gear lever', items: [{ label: 'Change gear', act: (s) => { s.go = (s.go || 0) + 1; } }, { label: 'Back to neutral', act: (s) => { s.back = (s.back || 0) + 1; } }, { label: 'Match the revs', act: (s) => { s.match = (s.match || 0) + 1; } }] },
    { key: 'shift', type: 'seg', label: 'Which change', options: [{ v: '12', label: '1 → 2' }, { v: '23', label: '2 → 3' }, { v: '32', label: '3 → 2' }, { v: '21', label: '2 → 1' }], fmt: (v) => { const [a, b, r] = SHIFTS[v]; return `at ${fmt(r)} rpm, ${b > a ? 'gear must slow' : 'gear must speed up'}`; } },
    { key: 'push', type: 'range', label: 'Push of your hand on the lever', min: 20, max: 120, step: 5, ends: ['gentle', 'firm'], fmt: (v) => `${v} N (${fmt(v * LEVER)} N at the collar)` },
    { key: 'synchro', type: 'toggle', label: 'Synchromesh fitted', hint: 'Off: a plain "crash" gearbox, as on early cars and many old lorries.' },
    { key: 'drag', type: 'toggle', label: 'Clutch dragging (pedal not fully down)' },
    { key: 'slow', type: 'log', label: 'Slow motion', min: 5, max: 120, ends: ['5× slower', '120× slower'], fmt: (v) => `${Math.round(v)}× slower than real` },
    { key: 'cut', type: 'toggle', label: 'See-through collar' },
  ],
  quiz: [
    { q: 'What does the brass baulk ring do?', options: ['It carries the engine’s power to the wheels', 'It rubs on the gear’s cone to match speeds, and blocks the collar until they match', 'It holds the gear on the shaft', 'It stops oil leaking'], answer: 1, why: 'It is a small cone clutch. Friction pulls the gear to the shaft’s speed, and while they differ the ring’s teeth stand in the collar’s way.' },
    { q: 'Why must you press the clutch pedal to change gear with synchromesh?', options: ['To stop the wheels', 'So the little ring only has to speed up or slow down a few light parts, not the whole engine', 'To cool the gearbox', 'To move the gear lever'], answer: 1, why: 'With the clutch released, the gear is tied to the heavy, powerful engine. Disconnected, only the clutch plate and gearbox shafts need matching, which the ring can do in about a tenth of a second.' },
    { q: 'A gearbox has no synchromesh. What happens if you push the lever while gear and shaft speeds differ a lot?', options: ['It slides in silently', 'The dog teeth clash and grind until the speeds are close', 'The engine stalls', 'The gearbox selects reverse'], answer: 1, why: 'Teeth passing each other at hundreds of rpm cannot drop into mesh. They crunch. Drivers of such gearboxes match the speeds first by double-declutching.' },
  ],
  reel: [
    { ms: 7000, caption: 'Synchromesh: a brass ring rubs on a cone until the gear and the shaft turn at exactly the same speed.', set: { shift: '23', push: 60, synchro: true, drag: false, slow: 30, cut: true }, act: (s) => { s.back = (s.back || 0) + 1; s.go = (s.go || 0) + 1; }, spin: 0 },
    { ms: 5600, caption: 'Without it the teeth clash: the crunch that drivers once avoided by double-declutching.', set: { shift: '32', push: 60, synchro: false, drag: false, slow: 30, cut: true }, act: (s) => { s.back = (s.back || 0) + 1; s.go = (s.go || 0) + 1; }, spin: 0 },
  ],

  build({ stage }) {
    const root = new THREE.Group(); root.position.y = YA; stage.root.add(root);
    const narrow = isNarrow();
    // ---- shaft, hub and collar: these turn together
    const shaftG = new THREE.Group(); root.add(shaftG);
    const cyan = gearMat(COL.main);
    shaftG.add(rod(-4.6, 5.0, 0.7, 0.7, cyan), rod(-0.5, 0.5, RT, RT, cyan), teeth(NT, RT, 1.0, 0.24, 0.28, cyan));
    for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU, sp = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.1, 0.16), cyan); sp.position.set(-3.1, 0.72 * Math.cos(a), 0.72 * Math.sin(a)); sp.rotation.x = a; shaftG.add(sp); }
    const sleeveG = new THREE.Group(); shaftG.add(sleeveG);
    const red = gearMat(COL.sleeve), shellMat = gearMat(COL.sleeve, { transparent: true, opacity: 0.3, depthWrite: false });
    const sTeeth = teeth(NT, RT, 1.3, 0.24, 0.3, red, 1, 1); sTeeth.rotation.x = PITCH / 2; sleeveG.add(sTeeth);
    const shell = latheX([[-0.65, 2.05], [-0.65, 2.55], [-0.2, 2.55], [-0.2, 2.3], [0.2, 2.3], [0.2, 2.55], [0.65, 2.55], [0.65, 2.05], [-0.65, 2.05]], shellMat, { seg: 56 }); shell.castShadow = false; sleeveG.add(shell);
    // ---- fork and rod (do not turn)
    const forkG = new THREE.Group(); root.add(forkG);
    const green = gearMat(COL.fork, { metalness: 0.3 });
    const yg = new THREE.TorusGeometry(2.48, 0.17, 8, 30, Math.PI * 0.8); yg.rotateZ(Math.PI * 0.1); yg.rotateY(Math.PI / 2);
    forkG.add(new THREE.Mesh(yg, green), beam([0, 2.6, 0], [0, 3.4, 0], 0.17, green, 10));
    const selRod = rod(-3.4, 4.2, 0.16, 0.16, gearMat(COL.steel), 16); selRod.position.y = 3.4; forkG.add(selRod);
    const push = arrow(0xffb547, 1.2, 0.4, 0.09); push.rotation.z = -Math.PI / 2; push.position.set(-3.6, 4.0, 0); forkG.add(push);
    // ---- baulk ring: turns with the hub, but can clock a little either way
    const ringG = new THREE.Group(); root.add(ringG);
    const brass = gearMat(COL.brass, { metalness: 0.75, roughness: 0.3 });
    ringG.add(teeth(NT, RT, 0.3, 0.24, 0.28, brass, 1, 0), latheX([[-0.17, 1.32], [-0.17, RT], [0.17, RT], [0.17, 1.44], [-0.17, 1.32]], brass, { seg: 48 }));
    // ---- the free gear with its cone and dog teeth
    const gearG = new THREE.Group(); root.add(gearG);
    const silver = gearMat(COL.free), coneMat = gearMat(0xe9edf3, { metalness: 0.85, roughness: 0.2 });
    const big = gear(26, 0.235, 1.0, silver, { helix: 24 * DEG, hand: -1, bore: 0.72 }); big.position.x = 2.3; gearG.add(big);
    gearG.add(rod(1.2, 1.8, RT, RT, silver));
    const dogs = teeth(NT, RT, 0.42, 0.24, 0.28, silver, 1, 0); dogs.position.x = 1.45; gearG.add(dogs);
    gearG.add(latheX([[0.52, 0.72], [0.52, 1.22], [1.2, 1.42], [1.2, 0.72]], coneMat, { seg: 48 }));
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.3), M.glow(0xffb547)); stripe.position.set(2.3, 3.3, 0); gearG.add(stripe);
    const sMark = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.2), M.glow(0x8ef0ff)); sMark.position.set(-2.6, 0.75, 0); shaftG.add(sMark);

    // ---- board: the teeth unrolled flat, and the two speeds against time
    const P = { xs: 0, clock: 0, rel: 0, ringX: 0, hist: [], t: 0, phase: 'neutral', c: setup({ shift: '23', push: 60, drag: false }), flash: 0 };
    const chart = canvasTexture(900, 760, (g, w, h) => {
      g.clearRect(0, 0, w, h); g.fillStyle = 'rgba(8,10,16,.88)'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#e8eef8'; g.font = 'bold 25px sans-serif'; g.fillText('The teeth, unrolled flat (seen from outside)', 20, 34);
      const X0 = 150, SC = 260, Y0 = 60, PH = 62, px = (x) => X0 + (x + 0.8) * SC;
      g.save(); g.beginPath(); g.rect(20, Y0, w - 40, 4 * PH); g.clip();
      const bar = (x0, x1, yc, col, pl, pr) => { const hw = PH * 0.25, c = 16; g.fillStyle = col; g.beginPath(); g.moveTo(px(x0) + (pl ? c : 0), yc - hw); g.lineTo(px(x1) - (pr ? c : 0), yc - hw); if (pr) g.lineTo(px(x1), yc); g.lineTo(px(x1) - (pr ? c : 0), yc + hw); g.lineTo(px(x0) + (pl ? c : 0), yc + hw); if (pl) g.lineTo(px(x0), yc); g.closePath(); g.fill(); };
      for (let k = -1; k < 6; k++) {
        bar(-0.5, 0.5, Y0 + k * PH, 'rgba(88,196,224,.28)', 0, 0);
        bar(0.72 + P.ringX * 0.05, 1.02 + P.ringX * 0.05, Y0 + (k + P.clock * 0.3) * PH, '#d9b25a', 1, 0);
        bar(1.25, 1.67, Y0 + (k + (((P.rel / PITCH) % 1) + 1) % 1) * PH, '#cdd3dd', 1, 0);
        bar(P.xs - 0.65, P.xs + 0.65, Y0 + (k + 0.5) * PH, P.flash > 0 ? '#ffd9a0' : '#f0604a', 1, 1);
      }
      g.restore();
      g.font = '19px sans-serif'; g.fillStyle = '#58c4e0'; g.fillText('hub', px(-0.74), Y0 + 4 * PH + 24); g.fillStyle = '#f0604a'; g.fillText('collar teeth', px(-0.3), Y0 + 4 * PH + 24);
      g.fillStyle = '#d9b25a'; g.fillText('baulk ring', px(0.62), Y0 + 4 * PH + 24); g.fillStyle = '#cdd3dd'; g.fillText('dog teeth of the gear', px(1.2), Y0 + 4 * PH + 24);
      const c = P.c, lo = Math.min(c.shaft, c.gear0), hi = Math.max(c.shaft, c.gear0), pad = (hi - lo) * 0.25 + 60, span = Math.max(0.3, Number.isFinite(c.time) ? c.time * 1.9 : 0.6, P.t * 1.05);
      const a = plotFrame(g, w, h, { clear: false, by: 350, bh: 410, x0: 0, x1: span * 1000, y0: lo - pad, y1: hi + pad, top: 62, bottom: 58, left: 100, xTicks: [0, 0.25, 0.5, 0.75, 1].map((k) => Math.round(span * 1000 * k)), yTicks: [lo, hi].map(Math.round), yFmt: (v) => fmt(v), title: 'Speeds during the change', xLabel: 'time since you pushed the lever (thousandths of a second)' });
      a.poly(P.hist.map((p) => [p[0] * 1000, c.shaft]), '#58c4e0', 5); a.poly(P.hist.map((p) => [p[0] * 1000, p[1]]), '#ffb547', 5);
      a.text('main shaft and collar', a.left + 12, a.Y(c.shaft) + (c.shaft > c.gear0 ? -12 : 26), '#58c4e0'); a.text('the free gear', a.left + 12, a.Y(c.gear0) + (c.shaft > c.gear0 ? 26 : -12), '#ffb547');
    });
    const cb = board(chart.tex, 8.2, 6.92); cb.position.set(narrow ? 0.4 : 4.7, narrow ? 7.6 : 4.9, -3.2); root.add(cb);
    if (isReel()) { cb.scale.setScalar(1.25); cb.position.set(0.3, 8.7, -3.2); }
    const lRing = stage.label('Baulk ring (brass)', [0.9, -2.5, 1.2], root), lCone = stage.label('Cone', [0.75, 2.0, 1.6], root), lDog = stage.label('Dog teeth', [1.6, -2.7, 0.6], root);
    const lGear = stage.label('', [2.9, 3.9, 0], root, 'hot'), lShaft = stage.label('', [-3.4, -1.5, 0], root, 'hot'), lColl = stage.label('Collar, on the hub', [-0.9, 3.0, 1.4], root), lFork = stage.label('Selector fork', [-1.6, 3.9, 0], root);

    let go = 0, back = 0, match = 0, thS = 0, thG = 0, wg = 0, tick = 0, matching = 0;
    const reset = (s) => { P.c = setup(s); wg = P.c.gear0; P.xs = 0; P.clock = 0; P.ringX = 0; P.hist = []; P.t = 0; P.phase = 'neutral'; matching = 0; };
    reset({ shift: '23', push: 60, drag: false });
    return {
      update(dt, s) {
        dt = Math.max(0, dt);
        if (s.back !== back) { back = s.back; reset(s); }
        if (s.go !== go) { go = s.go; if (P.phase === 'neutral') { P.c = setup(s); P.phase = 'approach'; P.hist = []; P.t = 0; } }
        if (s.match !== match) { match = s.match; if (P.phase === 'neutral' || P.phase === 'crunch') matching = 1; }
        const c = P.phase === 'neutral' ? (P.c = { ...setup(s), gear0: P.c.gear0 }) : P.c;
        const h = dt / s.slow, ws = c.shaft, rpmPerS = (T_) => ((T_ / c.J) * 60) / TAU, mv = (v, t, sp) => (Math.abs(t - v) < sp * dt ? t : v + Math.sign(t - v) * sp * dt);
        let d = wg - ws;
        // Double-declutching: with the clutch up in neutral, the driver's right foot brings the gear to the shaft's speed.
        if (matching) { wg = approach(wg, ws, 2.2 * s.slow / 30, dt); if (Math.abs(wg - ws) < 15) { matching = 0; } d = wg - ws; }
        const toward = (Tq) => { const step = rpmPerS(Tq) * h; wg = Math.abs(d) <= step ? ws : wg - Math.sign(d) * step; d = wg - ws; };
        if (P.phase !== 'neutral' && P.phase !== 'locked') { P.t += h; P.hist.push([P.t, wg]); if (P.hist.length > 1500) P.hist.splice(1, 1); }
        if (P.phase === 'approach') {
          if (s.synchro) { P.xs = mv(P.xs, XB, 0.5); P.ringX = clamp(P.xs / XB, 0, 1); P.clock = mv(P.clock, Math.sign(d || 1) * P.ringX, 3); if (P.xs >= XB) P.phase = Math.abs(d) < 1 ? 'release' : 'sync'; }
          else { P.xs = mv(P.xs, XD, 0.6); if (P.xs >= XD) P.phase = Math.abs(d) < 60 ? 'engage' : 'crunch'; }
        } else if (P.phase === 'sync') {
          // The cone's friction torque pulls the gear to the shaft's speed; a dragging clutch pulls it back.
          if (c.net > 0) toward(c.net);
          P.clock = Math.sign(d || P.clock);
          if (d === 0) P.phase = 'release';
        } else if (P.phase === 'release') {
          P.clock = mv(P.clock, 0, 2.2); P.xs = mv(P.xs, XB + (1 - Math.abs(P.clock)) * 0.12, 0.5);
          if (P.clock === 0) P.phase = 'engage';
        } else if (P.phase === 'crunch') {
          toward(CLASH + (c.to > c.from ? OIL_IN * ratioOf(c.to) : -OIL_IN * ratioOf(c.to) * 0.5));
          P.flash = 1; P.xs = XD - 0.05 + 0.05 * Math.sin(P.t * s.slow * 55);
          if (Math.abs(d) < 60) { wg = ws; d = 0; P.phase = 'engage'; }
        } else if (P.phase === 'engage') {
          wg = ws; d = 0;
          // The pointed ends nudge the gear the last fraction of a tooth so the collar can drop over the dog teeth.
          const off = ((((P.rel / PITCH) % 1) + 1.5) % 1) - 0.5;
          if (P.xs < XD || Math.abs(off) < 0.02) P.xs = mv(P.xs, XF, 0.55); 
          if (P.xs >= XD - 0.02) thG -= clamp(off, -1.6 * dt, 1.6 * dt) * PITCH;
          if (P.xs >= XF) P.phase = 'locked';
        }
        P.flash = P.phase === 'crunch' ? 1 : 0;
        thS += ((ws / 60) * TAU * dt) / s.slow; thG += ((wg / 60) * TAU * dt) / s.slow;
        P.rel = thG - thS; P.wg = wg;
        shaftG.rotation.x = thS; gearG.rotation.x = thG;
        sleeveG.position.x = P.xs; forkG.position.x = P.xs;
        ringG.rotation.x = thS + P.clock * 0.3 * PITCH; ringG.position.x = 0.87 + P.ringX * 0.05;
        shellMat.opacity = s.cut ? 0.28 : 1; shellMat.depthWrite = !s.cut; shellMat.transparent = s.cut;
        const hot = P.phase === 'sync' ? 0.6 + 0.3 * Math.sin(P.t * s.slow * 20) : 0;
        glow(brass, hot * 0.7); glow(coneMat, hot * 0.5); glow(red, P.flash * (0.5 + 0.5 * Math.sin(P.t * s.slow * 70)), 0xffe2a8); glow(silver, P.flash * 0.25, 0xffe2a8);
        push.visible = P.phase !== 'neutral' && P.phase !== 'locked'; push.set(0.5 + s.push / 80);
        if (tick++ % 2 === 0) chart.redraw();
        lGear.element.textContent = `Free gear: ${fmt(wg)} rpm`; lShaft.element.textContent = `Main shaft: ${fmt(ws)} rpm`;
        [lRing, lCone, lDog, lColl, lFork].forEach((l) => { l.visible = !narrow; });
        lCone.visible = !narrow && P.xs < 0.3;
      },
      readout: (s) => trim((() => {
        const c = P.c, d = (P.wg ?? c.gear0) - c.shaft;
        const head = { neutral: 'In neutral: speeds differ', approach: 'Collar moving…', sync: c.net > 0 ? 'Ring rubbing: speeds closing' : 'Blocked: the clutch is dragging', release: 'Speeds match: ring lets go', engage: 'Collar sliding over the dog teeth', locked: `${c.to}${['', 'st', 'nd', 'rd'][c.to]} gear locked`, crunch: 'CRUNCH: teeth clashing' }[P.phase];
        return `<div class="big">${head}</div>
          <div class="row"><span>Main shaft (set by the road)</span><b>${fmt(c.shaft)} rpm</b></div>
          <div class="row"><span>${c.to}${['', 'st', 'nd', 'rd'][c.to]} gear</span><b>${fmt(P.wg ?? c.gear0)} rpm</b></div>
          <div class="row"><span>Difference</span><b>${fmt(Math.abs(d))} rpm</b></div>
          ${s.synchro ? `<div class="row"><span>Cone friction torque</span><b>${c.Tc.toFixed(1)} N·m${c.Td ? `, drag ${c.Td.toFixed(1)}` : ''}</b></div>
          <div class="row"><span>Time to match</span><b>${Number.isFinite(c.time) ? fmt(c.time * 1000) + ' ms' : 'never: push harder'}</b></div>
          <div class="row"><span>Heat made in the ring</span><b>${fmt(c.heat)} J</b></div>` : `<div class="row"><span>No synchromesh</span><b>match the revs yourself</b></div>`}
          <div class="row"><span>Shown</span><b>${Math.round(s.slow)}× slower</b></div>`;
      })()),
    };
  },
};
const VIEW = () => (isReel() ? fit([0.2, YA + 5.0, 0], [0.2, 0.1, 1], 10.8, 17) : isNarrow() ? fit([0.3, YA + 4.0, 0], [0.2, 0.1, 1], 10.4, 14.8) : fit([1.9, YA + 2.5, 0], [0.16, 0.12, 1], 14.2, 11.8, { pad: 1.06 }));
