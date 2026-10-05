// Chapter 6: four ways to change gear without a clutch pedal. A torque converter with a planetary
// gear set, a belt CVT, a dual-clutch gearbox, and an automated manual (AMT).
import { THREE, M, rod, box, sphere, latheX, swarm, approach, clamp, canvasTexture } from '../kit.js';
import { makeGearbox, gear, gearMat, glow, meshAngle, meshInner, zrod, fit, isNarrow, trim, isReel, plotFrame, board, COL, CAR, FINAL, ENGINE, KMH, TAU, DEG, ratioOf, torqueAt, fmt } from '../gearbox.js';

const YA = 4.4, SHOWN = 1 / 40;
// ---- torque converter. Typical car values: the turbine gets about twice the engine's torque when
// the car is held still (stall torque ratio 1.9 to 2.5), falling to 1 at the coupling point, where the
// turbine has reached about 85 to 90 % of the pump's speed (Bosch Automotive Handbook; Heisler,
// Advanced Vehicle Technology). Beyond that it is a plain fluid coupling that always slips a little.
const STALL_TR = 2.0, COUPLE = 0.85;
const torqueRatio = (sr) => (sr < COUPLE ? STALL_TR - ((STALL_TR - 1) * sr) / COUPLE : 1);
// ---- one planetary set (an example: 32-tooth sun, four 20-tooth planets, 72-tooth ring; the ring
// must have sun + 2 × planet teeth). Ratios from the Willis equation: (ωsun − ωcarrier) × S = −(ωring − ωcarrier) × R.
const PS = { S: 32, P: 20, R: 72, n: 4 };
const PMODES = {
  low: { name: 'Ring held: low gear', ratio: 1 + PS.R / PS.S, f: `1 + ${PS.R}/${PS.S}`, held: 'ring', inp: 'sun', out: 'carrier', w: (n) => ({ s: n, c: (n * PS.S) / (PS.S + PS.R), r: 0 }) },
  direct: { name: 'Two parts locked together: direct', ratio: 1, f: 'all turn as one', held: null, inp: 'sun', out: 'carrier', w: (n) => ({ s: n, c: n, r: n }) },
  od: { name: 'Sun held: overdrive', ratio: PS.R / (PS.R + PS.S), f: `${PS.R}/(${PS.R}+${PS.S})`, held: 'sun', inp: 'carrier', out: 'ring', w: (n) => ({ s: 0, c: n, r: (n * (PS.S + PS.R)) / PS.R }) },
  rev: { name: 'Carrier held: reverse', ratio: -PS.R / PS.S, f: `−${PS.R}/${PS.S}`, held: 'carrier', inp: 'sun', out: 'ring', w: (n) => ({ s: n, c: 0, r: (-n * PS.S) / PS.R }) },
};
// ---- CVT. Steel push-belt CVTs span roughly 2.4 (low) to 0.4 (high), with pulley faces sloped at 11 degrees
// (Van Doorne / Bosch push-belt data). One scene unit is 40 mm.
const CVT = { lo: 2.4, hi: 0.42, a: 4.4, r0: 1.45, cone: 11 * DEG, mm: 40 };
const beltLen = (r1, r2, a) => { const d = r2 - r1; return 2 * Math.sqrt(a * a - d * d) + Math.PI * (r1 + r2) + 2 * d * Math.asin(d / a); };
const CVT_L = beltLen(CVT.r0, CVT.r0, CVT.a);
function cvtRadii(i) { let lo = 0.3, hi = 3; for (let k = 0; k < 40; k++) { const r1 = (lo + hi) / 2; if (beltLen(r1, r1 * i, CVT.a) > CVT_L) hi = r1; else lo = r1; } return [lo, lo * i]; }
// ---- dual clutch: six example pairs sharing one centre distance (each pair adds up to 60 teeth).
// Odd gears sit on the inner input shaft (clutch 1), even gears on the hollow outer one (clutch 2).
const DCT = { 1: [13, 47], 2: [20, 40], 3: [26, 34], 4: [31, 29], 5: [35, 25], 6: [38, 22] };
const dRatio = (g) => DCT[g][1] / DCT[g][0];
const DX = { 2: -3.9, 4: -2.9, 6: -1.5, 1: 0.5, 3: 1.5, 5: 2.9 };
const wheelRpm = (kmh) => ((kmh / KMH) / (TAU * CAR.tyreR)) * 60;
const SHIFT_GAP = { amt: 0.7, dct: 0.05 };     // seconds with reduced drive: AMTs pause for roughly half a second to a second; a dual clutch hands over in a few hundredths
const G = (v) => (/^\d+$/.test(String(v)) ? +v : v);
const ord = (g) => g + ['', 'st', 'nd', 'rd', 'th', 'th', 'th'][g];

export default {
  id: 'auto',
  short: 'Automatics',
  title: 'Four ways to lose the clutch pedal',
  subtitle: 'Fluid and planet gears, a belt on cones, two clutches, or a robot on a manual box.',
  view: { get pos() { return VIEW().pos; }, get target() { return VIEW().target; } },
  learn: `<p>"Automatic" is not one machine. It is four different answers to the same question: how do you change the ratio without the driver working a clutch?</p>
    <p><b>1. Torque converter and planetary gears</b>, the classic automatic. Instead of a clutch there is a doughnut full of oil. The engine spins a <b>pump</b>; the oil it flings out drives a <b>turbine</b> facing it. Because only oil joins them, the car can stand still with the engine running. A small <b>stator</b> between them turns the returning oil round so it helps the pump, and that <b>multiplies torque</b>, about twice at a standstill. The gears are <b>planetary sets</b>: a <b>sun</b> gear, <b>planet</b> gears on a carrier, and a toothed <b>ring</b> around them. Hold one of the three, drive another, and the third gives a new ratio. Clutches and bands inside do the holding, so the gears never unmesh.</p>
    <p><b>2. CVT</b> (continuously variable transmission). Two pulleys, each a pair of cones, joined by a steel belt. Squeeze one pair together and the belt rides higher on it while the other pair opens. The ratio changes smoothly, with no steps at all, so the engine can sit at its best speed. Scooters do the same with a rubber belt: see <a href="https://glassbox.how/motorcycleclear/" target="_blank" rel="noopener">MotorcycleClear</a>.</p>
    <p><b>3. Dual clutch.</b> Two gearboxes in one case: odd gears on one input shaft, even gears on another, each with its own clutch. While you drive in 2nd, 3rd is already engaged on the other shaft, waiting. A shift is just one clutch letting go as the other grips, so the push to the wheels hardly pauses.</p>
    <p><b>4. AMT</b> (automated manual), common in Indian small cars since 2014. It is the ordinary manual gearbox and clutch from the earlier chapters, with electric or hydraulic <b>actuators</b> doing the work of your left foot and left hand. It is cheap and efficient, but it must cut the power, open the clutch, move the collar and close the clutch, just as you would. That is the pause, the little nod of the head, on every change. (The clutch itself: <a href="https://glassbox.how/clutchclear/" target="_blank" rel="noopener">ClutchClear</a>.)</p>
    <p class="tip"><b>Try it:</b> in the planetary set, try each thing to hold and check the ratio against the tooth counts. Then compare a gear change in the dual clutch and the AMT on the chart.</p>`,
  terms: [
    { t: 'Torque converter', d: 'A sealed, oil-filled coupling with a pump, a turbine and a stator. It lets the engine run with the car stopped and multiplies torque when pulling away.' },
    { t: 'Stator', d: 'The small vaned wheel between turbine and pump. It redirects returning oil; a one-way clutch lets it freewheel once the speeds are close.' },
    { t: 'Planetary gear set', d: 'A sun gear, planet gears on a carrier and a ring gear with teeth inside. Also called an epicyclic set.' },
    { t: 'CVT', d: 'Continuously variable transmission: a belt on two cone pulleys gives every ratio between its lowest and highest.' },
    { t: 'Dual-clutch gearbox', d: 'Two input shafts with a clutch each, one for odd gears and one for even. The next gear is selected before it is needed.' },
    { t: 'AMT', d: 'Automated manual transmission: a normal manual gearbox and clutch worked by computer-controlled actuators.' },
  ],
  defaults: { kind: 'tc', rpm: 2500, sr: 40, pmode: 'low', cvt: 1.6, kmh: 40, g6: 2 },
  onChange(s) { s.g6 = G(s.g6); },
  controls: [
    { key: 'kind', type: 'seg', label: 'Which automatic', options: [{ v: 'tc', label: 'Converter' }, { v: 'cvt', label: 'CVT' }, { v: 'dct', label: 'Dual clutch' }, { v: 'amt', label: 'AMT' }], fmt: (v) => ({ tc: 'torque converter + planetary set', cvt: 'belt and cone pulleys', dct: 'two clutches, six gears', amt: 'robot on a manual gearbox' }[v]) },
    { key: 'rpm', type: 'range', label: 'Engine speed (converter and CVT)', min: 800, max: 6000, step: 50, fmt: (v) => fmt(v) + ' rpm' },
    { key: 'sr', type: 'range', label: 'Converter: turbine speed as a share of pump speed', min: 0, max: 97, step: 1, ends: ['car held still', 'cruising'], fmt: (v) => v + '%' },
    { key: 'pmode', type: 'seg', label: 'Planetary set: what is held', options: [{ v: 'low', label: 'Ring' }, { v: 'direct', label: 'Locked' }, { v: 'od', label: 'Sun' }, { v: 'rev', label: 'Carrier' }], fmt: (v) => `${PMODES[v].ratio.toFixed(3)} to 1` },
    { key: 'cvt', type: 'range', label: 'CVT: pulley ratio', min: CVT.hi, max: CVT.lo, step: 0.01, ends: ['high (fast)', 'low (strong)'], fmt: (v) => v.toFixed(2) + ' to 1' },
    { key: 'g6', type: 'seg', label: 'Dual clutch and AMT: gear', options: [1, 2, 3, 4, 5, 6].map((v) => ({ v: String(v), label: String(v) })), fmt: (v, s) => (s.kind === 'amt' && G(v) > 5 ? 'the AMT has five gears' : '') },
    { key: 'kmh', type: 'range', label: 'Dual clutch and AMT: road speed', min: 10, max: 160, step: 1, fmt: (v) => v + ' km/h' },
  ],
  quiz: [
    { q: 'A planetary set has a 32-tooth sun and a 72-tooth ring. The ring is held, the sun is driven and the carrier is the output. What is the ratio?', options: ['2.25 to 1', '3.25 to 1', '0.69 to 1', '1 to 1'], answer: 1, why: 'With the ring held, ratio = 1 + ring ÷ sun = 1 + 72/32 = 3.25. The carrier creeps round slowly as the planets walk inside the still ring.' },
    { q: 'Why can a car with a torque converter stand still in gear with the engine running?', options: ['Its clutch is pressed by a robot', 'Only oil links the pump and the turbine, so they can turn at different speeds', 'The gears are in neutral', 'The engine is switched off'], answer: 1, why: 'The pump flings oil at the turbine. At idle that push is too gentle to beat the brakes, so the turbine stays still while the pump turns.' },
    { q: 'Why does an AMT pause during a gear change when a dual-clutch gearbox does not?', options: ['Its engine is weaker', 'It has one clutch and one set of shafts, so it must cut the drive, change, and reconnect', 'It uses a belt', 'It has no gears'], answer: 1, why: 'An AMT does exactly what a driver does with a manual. A dual clutch has the next gear waiting on a second shaft and simply swaps clutches.' },
  ],
  reel: [
    { ms: 5800, caption: 'A classic automatic swaps the clutch for a doughnut of oil, and picks ratios by holding parts of a planetary gear set.', set: { kind: 'tc', rpm: 2500, pmode: 'low' }, anim: { sr: [0, 90] }, spin: 0.3 },
    { ms: 5600, caption: 'A CVT has no steps at all: a steel belt rides up and down two pairs of cones.', set: { kind: 'cvt', rpm: 3000 }, anim: { cvt: [2.4, 0.42] }, spin: 0.2 },
  ],

  build({ stage }) {
    const root = new THREE.Group(); root.position.y = YA; stage.root.add(root);
    const narrow = isNarrow();
    const K = { tc: new THREE.Group(), cvt: new THREE.Group(), dct: new THREE.Group(), amt: new THREE.Group() };
    Object.values(K).forEach((g) => root.add(g));
    K.dct.position.set(-0.9, 0.9, 0); K.amt.scale.setScalar(0.85); K.amt.position.set(-0.4, -1.5, 0);
    const L = (text, pos, parent, cls) => stage.label(text, pos, parent, cls);
    const base = { amber: COL.input, cyan: COL.main, green: COL.fork, lay: COL.lay, free: COL.free };
    const HOT = new THREE.Color(0xffa028);
    const lit = (m, k) => { m.color.setHex(m.userData.base).lerp(HOT, 0.7 * k); glow(m, 0.35 * k); };
    const mat = (c, o) => { const m = gearMat(c, o); m.userData.base = c; return m; };

    // ================================================= 1. torque converter + planetary set
    const tc = (() => {
      const g = K.tc, XC = -3.6, XP = 1.0;
      const amber = mat(base.amber), cyan = mat(base.cyan), green = mat(base.green);
      const pump = new THREE.Group(), turb = new THREE.Group(), stat = new THREE.Group();
      [pump, turb, stat].forEach((p) => { p.position.x = XC; g.add(p); });
      const vanes = (grp, n, x, r0, r1, m, tilt) => { for (let k = 0; k < n; k++) { const h = new THREE.Group(); h.rotation.x = (k / n) * TAU; const v = box(Math.abs(x) * 1.7, r1 - r0, 0.06, m); v.position.set(x, (r0 + r1) / 2, 0); v.rotation.y = tilt; h.add(v); grp.add(h); } };
      vanes(pump, 16, 0.5, 0.95, 2.3, amber, 0.25); vanes(turb, 16, -0.5, 0.95, 2.3, cyan, -0.25); vanes(stat, 10, 0, 0.5, 0.95, green, 0.8);
      pump.add(latheX([[1.05, 0.45], [1.05, 2.2], [0.75, 2.62], [-0.75, 2.62], [-1.05, 2.2], [-1.05, 0.2]], M.clear(base.amber, 0.14), { seg: 48 }));
      pump.add(rod(-2.6, -1.05, 0.3, 0.3, amber), rod(-2.9, -2.6, 1.3, 1.3, gearMat(0x566070)));          // crankshaft stub and engine flange
      turb.add(rod(-0.7, XP - XC - 0.2, 0.22, 0.22, cyan), rod(-0.75, -0.6, 0.95, 0.95, cyan));
      stat.add(rod(-0.2, 0.2, 0.5, 0.5, green));
      const oil = swarm(170, new THREE.SphereGeometry(0.055, 6, 5), M.glow(0x8ef0ff)); g.add(oil);
      const seeds = Array.from({ length: 170 }, (_, i) => ({ u: (i * 0.618) % 1, th: (i * 2.399) % TAU, w: 0.7 + ((i * 7) % 10) / 16 }));
      // planetary set, in the plane x = XP
      const m = 5.0 / PS.R, rc = (m * (PS.S + PS.P)) / 2;
      const sunM = mat(base.amber), ringM = mat(0xa9b4c6), carM = mat(base.cyan), plM = mat(base.green), brake = gearMat(COL.sleeve);
      const sun = gear(PS.S, m, 0.6, sunM, { bore: 0.3 }); sun.position.x = XP; g.add(sun);
      const ring = gear(PS.R, m, 0.6, ringM, { internal: true, rim: (m * PS.R) / 2 + 0.42 }); ring.position.x = XP; g.add(ring);
      const car = new THREE.Group(); car.position.x = XP; g.add(car);
      const planets = [];
      for (let k = 0; k < PS.n; k++) {
        const d = (k / PS.n) * TAU, p = gear(PS.P, m, 0.6, plM, { bore: 0.14 }); p.position.set(0, rc * Math.cos(d), rc * Math.sin(d)); car.add(p); planets.push({ p, d });
        const pin = rod(-0.2, 0.75, 0.13, 0.13, carM, 12); pin.position.y = rc * Math.cos(d); pin.position.z = rc * Math.sin(d); car.add(pin);
        const arm = box(0.14, rc, 0.32, carM); arm.position.set(0.68, (rc / 2) * Math.cos(d), (rc / 2) * Math.sin(d)); arm.rotation.x = d; car.add(arm);
      }
      car.add(rod(0.6, 0.76, 0.6, 0.6, carM));
      const outS = new THREE.Group(); outS.position.x = XP; g.add(outS);
      const outM = mat(base.cyan); outS.add(rod(0.9, 2.6, 0.25, 0.25, outM), rod(2.4, 2.6, 0.7, 0.7, outM));
      const omk = box(0.9, 0.07, 0.12, M.glow(0x8ef0ff)); omk.position.set(1.7, 0.27, 0); outS.add(omk);
      const band = new THREE.Mesh(new THREE.TorusGeometry((m * PS.R) / 2 + 0.5, 0.09, 8, 60), brake); band.rotation.y = Math.PI / 2; band.position.x = XP; g.add(band);
      const lHeld = L('', [XP, -3.3, 0], g, 'hot'), lTc = L('', [XC, 3.2, 0], g, 'hot');
      const names = [L('Pump, turned by the engine', [XC + 1.3, -3.0, 0.8], g), L('Turbine, turns the gearbox', [XC - 1.6, -3.6, 0.8], g), L('Stator', [XC, 1.0, 1.4], g), L('Sun', [XP, 0.2, 1.2], g), L('Planets on the carrier', [XP + 0.4, 2.0, 1.6], g), L('Ring gear', [XP, 3.3, 0.6], g)];
      let thP = 0, thT = 0, thSt = 0, thC = 0, a = 0, thO = 0, circ = 0;
      const q = (s) => { const sr = s.sr / 100, tr = torqueRatio(sr), te = torqueAt(s.rpm), nT = s.rpm * sr, pm = PMODES[s.pmode]; return { sr, tr, te, nT, pm, eta: tr * sr, out: nT / pm.ratio, tOut: te * tr * Math.abs(pm.ratio) }; };
      return {
        q,
        update(dt, s) {
          const c = q(s), w = (rpm) => (rpm / 60) * TAU * SHOWN * dt, W = c.pm.w(c.nT);
          thP += w(s.rpm); thT += w(c.nT);
          thSt += c.sr >= COUPLE ? w(c.nT * 0.9) : 0;                // past the coupling point the stator freewheels with the flow
          pump.rotation.x = thP; turb.rotation.x = thT; stat.rotation.x = thSt;
          // Oil circulates round the doughnut faster the more the two halves differ in speed.
          circ = 0.25 + 1.6 * (1 - c.sr) * (s.rpm / 3000);
          seeds.forEach((p, i) => {
            p.u = (p.u + circ * p.w * dt * 0.35) % 1; const ps = p.u * TAU, inPump = Math.sin(ps) > 0;
            p.th += w(inPump ? s.rpm : c.nT) + 0.004;
            const r = 1.6 - 0.72 * Math.cos(ps) * (0.75 + 0.25 * p.w), x = XC + 0.52 * Math.sin(ps) * (0.6 + 0.4 * p.w);
            oil.place(i, [x, r * Math.cos(p.th), r * Math.sin(p.th)]);
          }); oil.done();
          thC += w(W.c); a += w(W.s - W.c);
          car.rotation.x = thC; sun.rotation.x = thC + a;
          planets.forEach(({ p, d }) => { p.rotation.x = meshAngle(a, PS.S, PS.P, d); });
          ring.rotation.x = thC + meshInner(meshAngle(a, PS.S, PS.P, 0), PS.P, PS.R, 0);
          thO += w(c.out); outS.rotation.x = thO;
          const parts = { sun: sunM, ring: ringM, carrier: carM };
          for (const [k, mm] of Object.entries(parts)) { mm.color.setHex(mm.userData.base); glow(mm, 0); if (k === c.pm.inp) lit(mm, 0.9); if (k === c.pm.held) { mm.color.setHex(0x8a3a30); } }
          band.visible = c.pm.held === 'ring';
          lit(green, c.sr < COUPLE ? 0.8 : 0);
          lHeld.element.textContent = c.pm.name; lTc.element.textContent = c.sr < COUPLE ? `Stator locked: torque × ${c.tr.toFixed(2)}` : 'Stator freewheels: fluid coupling';
          names.forEach((l) => { l.visible = !narrow; });
        },
        readout(s) {
          const c = q(s);
          return `<div class="big">Torque × ${c.tr.toFixed(2)}, then × ${Math.abs(c.pm.ratio).toFixed(2)}</div>
            <div class="row"><span>Pump (engine)</span><b>${fmt(s.rpm)} rpm, ${fmt(c.te)} N·m</b></div>
            <div class="row"><span>Turbine</span><b>${fmt(c.nT)} rpm, ${fmt(c.te * c.tr)} N·m</b></div>
            <div class="row"><span>Converter efficiency</span><b>${Math.round(c.eta * 100)}%${c.sr < 0.05 ? ' (all heat at stall)' : ''}</b></div>
            <div class="row"><span>Planetary: sun ${PS.S}, ring ${PS.R}</span><b>${c.pm.f} = ${c.pm.ratio.toFixed(3)}</b></div>
            <div class="row"><span>Output shaft</span><b>${fmt(Math.abs(c.out))} rpm${c.out < 0 ? ', backwards' : ''}</b></div>
            <div class="row"><span>Output torque</span><b>${fmt(c.tOut)} N·m</b></div>`;
        },
        chart(g, w, h, s) {
          const c = q(s), a2 = plotFrame(g, w, h, { x0: 0, x1: 1, y0: 0, y1: 2.2, xTicks: [0, 0.25, 0.5, 0.75, 1], yTicks: [0, 0.5, 1, 1.5, 2], xFmt: (v) => Math.round(v * 100) + '%', title: 'Torque converter: what the oil does', xLabel: 'turbine speed ÷ pump speed' });
          a2.line(torqueRatio, 0, 0.97, '#ffb547', 6); a2.line((x) => torqueRatio(x) * x, 0, 0.97, '#5ce1a9', 6);
          a2.text('torque multiplied', a2.X(0.3), a2.Y(torqueRatio(0.3)) - 14, '#ffb547'); a2.text('efficiency', a2.X(0.42), a2.Y(0.42) + 30, '#5ce1a9');
          a2.dot(c.sr, c.tr, '#ffb547'); a2.dot(c.sr, c.eta, '#5ce1a9');
        },
      };
    })();

    // ================================================= 2. CVT
    const cvt = (() => {
      const g = K.cvt, X1 = -CVT.a / 2, X2 = CVT.a / 2, RS = 2.17, TAN = Math.tan(CVT.cone), WB = 0.36;
      const mkPulley = (x, color, fixedSide) => {
        const grp = new THREE.Group(); grp.position.x = x; g.add(grp);
        const m = mat(color), see = gearMat(color, { transparent: true, opacity: 0.3, depthWrite: false }), half = (sgn) => { const h = new THREE.Group(); const c = latheX([[0, 0.3], [0, 0.34], [RS * TAN, RS], [RS * TAN + 0.25, RS], [RS * TAN + 0.25, 0.3]], sgn > 0 ? see : m, { seg: 56 }); c.castShadow = sgn < 0; c.rotation.y = -sgn * Math.PI / 2; h.add(c); grp.add(h); return h; };
        const fix = half(fixedSide), mov = half(-fixedSide);
        grp.add(zrod(-2.4, 2.4, 0.3, 0.3, m));
        const mk = box(0.1, 0.5, 0.1, M.glow(color === base.amber ? 0xffb547 : 0x8ef0ff)); mk.position.set(0, RS - 0.3, fixedSide * (RS * TAN + 0.27)); fix.add(mk);
        return { grp, fix, mov, m, fixedSide };
      };
      const p1 = mkPulley(X1, base.amber, 1), p2 = mkPulley(X2, base.cyan, -1);
      const N = 110, belt = swarm(N, new THREE.BoxGeometry(0.1, 0.3, WB), gearMat(0xd7dce6, { metalness: 0.85, roughness: 0.25 })); g.add(belt);
      const l1 = L('', [X1, -3.2, 0], g, 'hot'), l2 = L('', [X2, -3.2, 0], g, 'hot'), l3 = L('Steel belt', [0, 2.6, 0.6], g), l4 = L('Each pulley: one fixed cone, one that slides', [0, 3.6, 0], g);
      let th1 = 0, th2 = 0, sPos = 0, ratio = 1.6;
      const FINAL_CVT = 5.0;                                   // CVT cars use a tall final drive, typically 5 to 6
      return {
        update(dt, s) {
          ratio = approach(ratio, s.cvt, 6, dt);
          const [r1, r2] = cvtRadii(ratio), w = (rpm) => (rpm / 60) * TAU * SHOWN * dt;
          th1 -= w(s.rpm); th2 -= w(s.rpm / ratio);
          p1.grp.rotation.z = th1; p2.grp.rotation.z = th2;
          // The belt has a fixed width, so the cones must sit closer for it to ride at a larger radius.
          for (const [p, r] of [[p1, r1], [p2, r2]]) { const z = WB / 2 - r * TAN; p.fix.position.z = p.fixedSide * z; p.mov.position.z = -p.fixedSide * z; }
          const d = r2 - r1, phi = Math.asin(d / CVT.a), st = Math.sqrt(CVT.a * CVT.a - d * d), arc1 = r1 * (Math.PI - 2 * phi), arc2 = r2 * (Math.PI + 2 * phi), total = 2 * st + arc1 + arc2;
          sPos = (sPos + (s.rpm / 60) * TAU * SHOWN * dt * r1) % total;
          for (let i = 0; i < N; i++) {
            let u = (sPos + (i / N) * total) % total, x, y, ang;
            if (u < arc1) { const al = Math.PI / 2 + phi + u / r1; x = X1 + r1 * Math.cos(al); y = r1 * Math.sin(al); ang = al + Math.PI / 2; }
            else if ((u -= arc1) < st) { const al = -Math.PI / 2 - phi, k = u / st; x = X1 + r1 * Math.cos(al) + (X2 + r2 * Math.cos(al) - X1 - r1 * Math.cos(al)) * k; y = r1 * Math.sin(al) + (r2 - r1) * Math.sin(al) * k; ang = Math.atan2((r2 - r1) * Math.sin(al), X2 - X1 + (r2 - r1) * Math.cos(al)); }
            else if ((u -= st) < arc2) { const al = -Math.PI / 2 - phi + u / r2; x = X2 + r2 * Math.cos(al); y = r2 * Math.sin(al); ang = al + Math.PI / 2; }
            else { u -= arc2; const al = Math.PI / 2 + phi, k = u / st; x = X2 + r2 * Math.cos(al) + (X1 + r1 * Math.cos(al) - X2 - r2 * Math.cos(al)) * k; y = r2 * Math.sin(al) + (r1 - r2) * Math.sin(al) * k; ang = Math.atan2((r1 - r2) * Math.sin(al), X1 - X2 + (r1 - r2) * Math.cos(al)); }
            belt.place(i, [x, y, 0], [0, 0, ang]);
          }
          belt.done();
          l1.element.textContent = `Engine pulley: belt at ${fmt(r1 * CVT.mm)} mm`; l2.element.textContent = `Wheel pulley: belt at ${fmt(r2 * CVT.mm)} mm`;
          l3.visible = l4.visible = !narrow;
        },
        readout(s) {
          const [r1, r2] = cvtRadii(s.cvt), out = s.rpm / s.cvt, kmh = ((out / FINAL_CVT) * TAU * CAR.tyreR * 60) / 1000;
          return `<div class="big">${s.cvt.toFixed(2)} to 1, and every ratio between</div>
            <div class="row"><span>Belt radius: engine pulley</span><b>${fmt(r1 * CVT.mm)} mm</b></div>
            <div class="row"><span>Belt radius: wheel pulley</span><b>${fmt(r2 * CVT.mm)} mm</b></div>
            <div class="row"><span>Ratio = second ÷ first</span><b>${(r2 / r1).toFixed(2)}</b></div>
            <div class="row"><span>Engine</span><b>${fmt(s.rpm)} rpm</b></div>
            <div class="row"><span>Output pulley</span><b>${fmt(out)} rpm</b></div>
            <div class="row"><span>Road speed (final drive ${FINAL_CVT.toFixed(1)})</span><b>${fmt(kmh)} km/h</b></div>
            <div class="row"><span>Spread, lowest ÷ highest</span><b>${(CVT.lo / CVT.hi).toFixed(1)}</b></div>`;
        },
        chart(g, w, h, s) {
          const sp = (i) => ((s.rpm / i / FINAL_CVT) * TAU * CAR.tyreR * 60) / 1000;
          const a2 = plotFrame(g, w, h, { x0: 0, x1: 200, y0: 0, y1: 7000, xTicks: [0, 50, 100, 150, 200], yTicks: [0, 2000, 4000, 6000], yFmt: (v) => v / 1000 + 'k', title: 'CVT: any engine speed at any road speed', xLabel: 'road speed (km/h)', yLabel: 'engine rpm' });
          g.fillStyle = 'rgba(142,240,255,.14)'; g.beginPath(); g.moveTo(a2.X(0), a2.Y(0));
          const kv = (i) => (1000 / i / FINAL_CVT) * TAU * CAR.tyreR * 0.06;      // km/h per 1,000 rpm at ratio i
          g.lineTo(a2.X(Math.min(200, kv(CVT.lo) * 6.5)), a2.Y(6500)); g.lineTo(a2.X(200), a2.Y(6500)); g.lineTo(a2.X(200), a2.Y(Math.min(6500, (200 / kv(CVT.hi)) * 1000))); g.closePath(); g.fill();
          a2.line((v) => (v / kv(CVT.lo)) * 1000, 0, kv(CVT.lo) * 6.5, '#ff7a59', 4); a2.line((v) => (v / kv(CVT.hi)) * 1000, 0, 200, '#8ef0ff', 4);
          a2.text('lowest ratio', a2.X(22), a2.Y(5200), '#ff7a59'); a2.text('highest ratio', a2.X(120), a2.Y(1500), '#8ef0ff');
          a2.line(() => s.rpm, 0, 200, 'rgba(255,255,255,.5)', 2, [8, 8]); a2.dot(sp(s.cvt), s.rpm, '#ffffff');
        },
      };
    })();

    // ================================================= 3. dual clutch
    const hist = [];                                         // rolling trace of the push at the wheels, shared by DCT and AMT
    const pushChart = (title) => (g, w, h) => {
      const a2 = plotFrame(g, w, h, { x0: -6, x1: 0, y0: 0, y1: 1.25, xTicks: [-6, -4, -2, 0], yTicks: [0, 0.5, 1], xFmt: (v) => (v ? v + ' s' : 'now'), yFmt: (v) => Math.round(v * 100) + '%', title, xLabel: 'the last six seconds' });
      const t1 = hist.length ? hist[hist.length - 1][0] : 0;
      a2.poly(hist.filter((p) => p[0] > t1 - 6).map((p) => [p[0] - t1, p[1]]), '#ffb547', 6);
    };
    const dct = (() => {
      const g = K.dct, mod = 0.08, CDd = (mod * 60) / 2;
      const m1 = mat(base.amber), m2 = mat(base.lay), eng = mat(0x6c7484), outM = mat(base.cyan), red = gearMat(COL.sleeve);
      const drum = new THREE.Group(), s1 = new THREE.Group(), s2 = new THREE.Group(), out = new THREE.Group(); out.position.y = -CDd; g.add(drum, s1, s2, out);
      drum.add(rod(-7.2, -6.6, 0.3, 0.3, eng), latheX([[-6.6, 0.3], [-6.6, 1.9], [-4.95, 1.9], [-4.95, 1.75], [-6.45, 1.75], [-6.45, 0.3]], eng, { seg: 40, phiLength: Math.PI * 1.25 }));
      const c1 = rod(-6.2, -6.05, 1.55, 1.55, m1), c2 = rod(-5.5, -5.35, 1.55, 1.55, m2); s1.add(c1); s2.add(c2);
      s1.add(rod(-6.2, 3.6, 0.2, 0.2, m1)); s2.add(rod(-5.5, -0.9, 0.38, 0.38, m2));
      out.add(rod(-4.6, 4.6, 0.26, 0.26, outM), rod(4.4, 4.6, 0.7, 0.7, outM));
      const fg = {}, fm = {};
      for (const k of [1, 2, 3, 4, 5, 6]) {
        const [a, b] = DCT[k], sh = k % 2 ? s1 : s2, sm = k % 2 ? m1 : m2;
        const gi = gear(a, mod, 0.34, sm, { helix: 22 * DEG, hand: 1, bore: 0.2 }); gi.position.x = DX[k]; sh.add(gi);
        fm[k] = mat(base.free); const go = gear(b, mod, 0.34, fm[k], { helix: 22 * DEG, hand: -1, bore: 0.27 }); go.position.set(DX[k], -CDd, 0); g.add(go); fg[k] = go;
      }
      // Collars on the output shaft: one between 2 and 4, one for 6, one between 1 and 3, one for 5 (a real one would share it with reverse).
      const collars = [[-3.4, 2, 4], [-0.95, 6, 0], [1.0, 1, 3], [3.45, 5, 0]].map(([x, lo, hi]) => { const c = rod(-0.16, 0.16, 0.5, 0.5, red, 24); c.position.x = x; out.add(c); return { c, x, lo, hi, p: 0 }; });
      const lA = L('', [-6.1, 2.4, 0], g, 'hot'), lB = L('', [-5.4, -2.7, 1.6], g, 'hot'), lO = L('', [4.2, -CDd - 1.1, 0], g), lN = L('', [0, 2.2, 0], g);
      const lI = [L('Hollow shaft: gears 2, 4, 6', [-2.9, 1.5, 0.8], g), L('Inner shaft: gears 1, 3, 5', [1.7, 1.7, 0.8], g)];
      let cur = 2, pre = 3, blend = 1, thE = 0, th1 = 0, th2 = 0, thO = 0, tSince = 9, drive = 1;
      const nextOf = (gNow, want) => (want > gNow ? gNow + 1 : want < gNow ? gNow - 1 : gNow < 6 ? gNow + 1 : gNow - 1);
      return {
        get gear() { return cur; },
        update(dt, s) {
          const want = clamp(s.g6, 1, 6), outRpm = wheelRpm(s.kmh) * FINAL;
          tSince += dt;
          // Step one gear at a time towards the wanted gear: the next one is always waiting on the other shaft.
          if (want !== cur && blend >= 1 && tSince > 0.6) { const nx = nextOf(cur, want); if (pre !== nx) pre = nx; else { const old = cur; cur = nx; pre = nextOf(cur, want === cur ? (cur > old ? 7 : 0) : want); pre = clamp(pre, 1, 6); if (pre === cur) pre = old; blend = 0; tSince = 0; } }
          if (want === cur && pre % 2 === cur % 2) pre = cur < 6 ? cur + 1 : cur - 1;
          blend = Math.min(1, blend + dt / 0.35);                  // drawn slower than real: the true hand-over takes a few hundredths of a second
          drive = blend < 1 ? 0.93 : 1;
          const eRpm = outRpm * dRatio(cur), odd = cur % 2 === 1, w = (rpm) => (rpm / 60) * TAU * SHOWN * dt;
          const n1 = outRpm * dRatio(odd ? cur : pre), n2 = outRpm * dRatio(odd ? pre : cur);
          thE += w(eRpm); th1 += w(n1); th2 += w(n2); thO -= w(outRpm);
          drum.rotation.x = thE; s1.rotation.x = th1; s2.rotation.x = th2; out.rotation.x = thO;
          for (const k of [1, 2, 3, 4, 5, 6]) { fg[k].rotation.x = meshAngle(k % 2 ? th1 : th2, DCT[k][0], DCT[k][1], Math.PI); lit(fm[k], k === cur ? 0.9 : 0); }
          collars.forEach((c) => { const t = c.lo === cur || c.lo === pre ? -1 : c.hi === cur || c.hi === pre ? 1 : 0; c.p = approach(c.p, t, 10, dt); c.c.position.x = c.x + c.p * 0.26; });
          const k1 = odd ? blend : 1 - blend;                      // how firmly clutch 1 grips
          c1.position.x = -6.125 - 0.22 * k1; c2.position.x = -5.425 + 0.3 * k1;
          lit(m1, odd ? 0.85 : 0); lit(m2, odd ? 0 : 0.85); lit(outM, 0.6);
          lA.element.textContent = `Clutch 1 (odd gears): ${odd ? 'gripping' : 'open'}`; lB.element.textContent = `Clutch 2 (even gears): ${odd ? 'open' : 'gripping'}`;
          lO.element.textContent = `Output: ${fmt(outRpm)} rpm`; lN.element.textContent = `Driving in ${ord(cur)}, with ${ord(pre)} already engaged and waiting`;
          lI.forEach((l) => { l.visible = !narrow; }); lO.visible = !narrow;
          this.info = { eRpm, outRpm, n1, n2, odd, cur, pre, drive };
        },
        info: { eRpm: 0, outRpm: 0, n1: 0, n2: 0, odd: false, cur: 2, pre: 3, drive: 1 },
        readout(s) {
          const i = this.info, over = i.eRpm > ENGINE.redline, under = i.eRpm < ENGINE.idle;
          return `<div class="big">${ord(i.cur)} driving, ${ord(i.pre)} waiting</div>
            <div class="row"><span>${ord(i.cur)}: ${DCT[i.cur][0]} → ${DCT[i.cur][1]} teeth</span><b>${dRatio(i.cur).toFixed(3)} to 1</b></div>
            <div class="row"><span>Engine</span><b>${fmt(i.eRpm)} rpm${over ? ': too fast, change up' : under ? ': too slow, change down' : ''}</b></div>
            <div class="row"><span>Shaft 1 (odd), shaft 2 (even)</span><b>${fmt(i.n1)}, ${fmt(i.n2)} rpm</b></div>
            <div class="row"><span>Output shaft</span><b>${fmt(i.outRpm)} rpm</b></div>
            <div class="row"><span>Break in drive per change</span><b>about ${SHIFT_GAP.dct * 1000} ms</b></div>`;
        },
        chart: pushChart('Dual clutch: push at the wheels through a change'),
        get drive() { return drive; },
      };
    })();

    // ================================================= 4. AMT
    const amt = (() => {
      const g = K.amt, gb = makeGearbox({ casing: false });
      gb.group.scale.setScalar(0.92); g.add(gb.group);
      const sc = 0.92, eng = gearMat(0x6c7484), fric = M.matte(0xb8763c), robot = M.plastic(0x2f6fed);
      const fly = new THREE.Group(), plate = new THREE.Group(), press = new THREE.Group(); g.add(fly, plate, press);
      fly.add(rod(-7.6, -6.9, 0.32, 0.32, eng), rod(-6.9, -6.5, 2.0, 2.0, eng));
      plate.add(rod(-6.42, -6.28, 1.75, 1.75, fric), rod(-6.42, -5.2, 0.34, 0.34, gearMat(COL.input)));
      press.add(rod(-6.2, -5.95, 1.85, 1.85, gearMat(0x8a93a3)));
      // Two actuators: one pushes the clutch release fork, one moves the gear lever.
      const act1 = box(1.5, 0.7, 0.7, robot); act1.position.set(-6.0, -3.0, 1.2); g.add(act1);
      const push = rod(0, 1, 0.09, 0.09, gearMat(0xd7dce6), 10); const pushG = new THREE.Group(); pushG.position.set(-6.0, -2.65, 1.2); pushG.rotation.z = Math.PI / 2; pushG.add(push); g.add(pushG);
      const act2 = box(1.6, 0.8, 1.4, robot); act2.position.set(X_LEVER * sc, 4.75 * sc + 0.5, 0); g.add(act2);
      const ecu = box(1.3, 0.25, 0.9, M.plastic(0x1f9d6b)); ecu.position.set(-1.2, 3.6, -1.2); g.add(ecu);
      const lC = L('', [-6.0, -3.9, 1.2], g, 'hot'), lS = L('Shift actuator: moves the lever', [X_LEVER * sc, 6.0, 0], g), lE = L('Computer', [-1.2, 4.1, -1.2], g), lN = L('', [0.6, -4.3, 0], g);
      let cur = 2, phase = 'drive', t = 0, cl = 1, thE = 0, thI = 0, thO = 0, eRpm = 2000, inRpm = 2000, drive = 1;
      return {
        update(dt, s) {
          const want = clamp(s.g6, 1, 5), outRpm = wheelRpm(s.kmh) * FINAL, target = outRpm * ratioOf(cur);
          // The same four steps a driver makes: lift off and declutch, move the lever, re-engage, power back on.
          if (phase === 'drive' && want !== cur) { phase = 'open'; t = 0; }
          t += dt;
          if (phase === 'open') { cl = Math.max(0, cl - dt / 0.18); if (cl === 0) { phase = 'shift'; cur += Math.sign(want - cur); } }
          else if (phase === 'shift') { if (gb.shiftStep(cur, dt, 5.5)) phase = 'close'; }
          else if (phase === 'close') { cl = Math.min(1, cl + dt / 0.28); if (cl === 1) phase = 'drive'; }
          else gb.shiftStep(cur, dt, 5.5);
          drive = phase === 'drive' ? 1 : phase === 'close' ? cl * 0.8 : 0;
          const engd = gb.engaged();
          inRpm = engd === 'N' ? approach(inRpm, inRpm * 0.98, 1, dt) : approach(inRpm, outRpm * ratioOf(engd), 25, dt);
          eRpm = cl > 0.5 ? approach(eRpm, inRpm, 12, dt) : approach(eRpm, outRpm * ratioOf(cur), 4, dt);
          const w = (rpm) => (rpm / 60) * TAU * SHOWN * dt;
          thE += w(eRpm); thI += w(inRpm); thO += w(outRpm);
          fly.rotation.x = thE; press.rotation.x = thE; plate.rotation.x = thI;
          press.position.x = (1 - cl) * 0.3; pushG.scale.y = 1; push.scale.x = 0.5 + (1 - cl) * 0.7; push.position.x = 0.5 * push.scale.x;
          gb.pose(thI, thO); gb.setPath(engd, cl > 0.9 ? 0.85 : 0, true);
          lC.element.textContent = `Clutch actuator: ${cl > 0.95 ? 'clutch gripping' : cl < 0.05 ? 'clutch open' : 'moving'}`;
          lN.element.textContent = phase === 'drive' ? `${ord(cur)} gear: power on` : phase === 'open' ? '1. Cut the power, open the clutch' : phase === 'shift' ? '2. Slide the collar out, across and in' : '3. Close the clutch, power back on';
          lS.visible = lE.visible = !narrow;
          this.info = { cur, eRpm, outRpm, phase };
        },
        info: { cur: 2, eRpm: 0, outRpm: 0, phase: 'drive' },
        readout(s) {
          const i = this.info, r = ratioOf(i.cur), e = i.outRpm * r;
          return `<div class="big">${i.phase === 'drive' ? `${ord(i.cur)} gear, clutch gripping` : 'Changing: no push for a moment'}</div>
            <div class="row"><span>Ratio from the teeth</span><b>${r.toFixed(3)} to 1</b></div>
            <div class="row"><span>Engine</span><b>${fmt(i.eRpm)} rpm${e > ENGINE.redline ? ': too fast, change up' : e < ENGINE.idle ? ': too slow, change down' : ''}</b></div>
            <div class="row"><span>Output shaft</span><b>${fmt(i.outRpm)} rpm</b></div>
            <div class="row"><span>Break in drive per change</span><b>about ${SHIFT_GAP.amt} s</b></div>
            <div class="row"><span>Added to a manual box</span><b>2 actuators, a computer</b></div>`;
        },
        chart: pushChart('AMT: push at the wheels through a change'),
        get drive() { return drive; },
      };
    })();

    const all = { tc, cvt, dct, amt };
    const cs = { s: null };
    const chart = canvasTexture(760, 520, (g, w, h) => { if (cs.s) all[cs.s.kind].chart(g, w, h, cs.s); });
    const cb = board(chart.tex, 7.2, 4.93); root.add(cb);
    let kind = '', tick = 0, clock = 0;
    return {
      update(dt, s) {
        dt = Math.max(0, dt);
        if (s.kind !== kind) { kind = s.kind; for (const [k, g] of Object.entries(K)) g.visible = k === kind; hist.length = 0; }
        cs.s = s; clock += dt;
        all[kind].update(dt, s);
        if (kind === 'dct' || kind === 'amt') { hist.push([clock, all[kind].drive]); if (hist.length > 900) hist.shift(); }
        const nar = isNarrow();
        cb.position.set(...({ tc: nar ? [-1, 6.6, -2] : [0.2, 6.5, -3.5], cvt: nar ? [0, 6.4, -2] : [0.2, 6.3, -3.5], dct: nar ? [-1, 6.0, -2] : [0.4, 6.1, -3.5], amt: nar ? [-1, 7.4, -2] : [2.2, 7.0, -3.5] }[kind]));
        if (isReel()) { cb.scale.setScalar(1.6); cb.position.set(-1.2, 7.8, -2); }
        if (tick++ % 3 === 0) chart.redraw();
      },
      readout: (s) => trim(all[s.kind].readout(s), 4),
    };
  },
};
const X_LEVER = 2.75;
const VIEW = () => (isReel() ? fit([-1.2, YA + 4.4, 0], [0.8, 0.25, 1], 12.5, 15.5) : isNarrow() ? fit([-1.0, YA + 2.4, 0], [0.8, 0.25, 1], 13.5, 14.5) : fit([-1.2, YA + 2.2, 0], [0.8, 0.25, 1], 14.6, 13, { pad: 1.05 }));
