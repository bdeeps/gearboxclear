// Chapter 2: why a car needs gears. One engine curve, five ratios, a tacho and a speedo,
// and the sawtooth an engine draws as it climbs through the gears.
import { THREE, M, rod, box, approach, clamp, canvasTexture } from '../kit.js';
import { makeGearbox, makeFinalDrive, makeWheel, zrod, fit, isNarrow, trim, isReel, plotFrame, board, gearMat, COL, ENGINE, CAR, FINAL, G0, KMH, TAU, GEAR_COLORS, ratioOf, etaOf, torqueAt, kW, speedAt, rpmAt, wheelTorque, roadLoad, fmt } from '../gearbox.js';

const SHOWN = 1 / 40, YA = 2.0, WR = 2.0;
const SHIFT_AT = 6200, SHIFT_S = 0.5;        // the test driver changes up here, and each change takes about half a second
const VIEW = () => (isReel() ? fit([-0.2, 10.2, 0], [0.1, 0.06, 1], 17.6, 21) : isNarrow() ? fit([2.6, 5.6, 0], [0.1, 0.06, 1], 12, 11.4) : fit([-0.2, 6.5, 0], [0.1, 0.1, 1], 17.2, 15, { pad: 1.04 }));
const thrust = (rpm, g) => wheelTorque(rpm, g) / CAR.tyreR;
const thrustAtV = (v, g) => { const r = rpmAt(v, g); return r < ENGINE.idle || r > ENGINE.redline ? null : thrust(r, g); };

export default {
  id: 'ratios',
  short: 'Why gears?',
  title: 'Why a car needs gears at all',
  subtitle: 'An engine is only strong in a narrow band of speeds. Gears stretch that band over the whole road.',
  view: { get pos() { return VIEW().pos; }, get target() { return VIEW().target; } },
  learn: `<p>A petrol engine cannot run below about <b>800 rpm</b> and must not go past its <b>redline</b>, here 6,500 rpm. Its twisting force, the <b>torque</b>, is weak at the bottom and best in the middle. But the wheels have to do everything from 0 to well over 150 km/h, and they need a huge shove to get a tonne of car moving and only a small one to cruise. (How an engine makes torque is in <a href="https://glassbox.how/carclear/" target="_blank" rel="noopener">CarClear</a>; what torque is, in <a href="https://glassbox.how/torqueclear/" target="_blank" rel="noopener">TorqueClear</a>.)</p>
    <p>Gears are levers that go round. A small gear driving a big one trades speed for twist:</p>
    <p><b>wheel torque = engine torque × gear ratio × final drive</b> (less a few percent of friction), and <b>road speed = engine rpm ÷ (gear ratio × final drive) × the tyre's circumference</b>.</p>
    <p>In <b>first</b> the engine's 141 N·m becomes about 1,700 N·m at the wheels, but the engine hits the redline at 54 km/h. In <b>fifth</b> the same engine could reach 200 km/h on paper, with only a quarter of the push. So you climb through the gears, and the rev counter draws a <b>sawtooth</b>: up, change, drop, up again. A bicycle does the same thing with its sprockets: see <a href="https://glassbox.how/cycleclear/" target="_blank" rel="noopener">CycleClear</a>.</p>
    <p>Driving sense falls out of the charts. Too high a gear at low revs and the engine <b>lugs</b>: it shudders, with little push to spare. Too low a gear and it screams near the redline, burning fuel. A <b>high gear</b> at a steady speed saves fuel because the engine turns slowly. A <b>low gear</b> downhill makes the engine hold the car back, which rests the brakes (see <a href="https://glassbox.how/brakeclear/" target="_blank" rel="noopener">BrakeClear</a>).</p>
    <p>The heavier the load, the more ratios help. A loaded lorry or a tractor has a very low <b>crawler</b> gear for pulling away, and many heavy trucks add a second small gearbox (a range-change or splitter) that doubles the number of ratios.</p>
    <p>An electric motor pulls hard from zero rpm and spins to 15,000 or more, so most electric cars need just <b>one fixed gear</b>.</p>
    <p class="tip"><b>Try it:</b> press the full-throttle run and watch the sawtooth appear. Then set a steep slope and find the highest gear that can still climb it.</p>`,
  terms: [
    { t: 'Torque', d: 'Twisting force, measured in newton metres (N·m). It is what turns the wheels.' },
    { t: 'rpm', d: 'Revolutions per minute: how many turns the engine makes each minute. The rev counter (tachometer) shows it.' },
    { t: 'Redline', d: 'The highest engine speed that is safe. Past it, parts can be damaged.' },
    { t: 'Final drive', d: 'The last pair of gears, in the axle. Here 39 teeth to 10: it slows every gear by 3.9 and multiplies the twist by 3.9.' },
    { t: 'Tractive effort', d: 'The forward push of the driven tyres on the road: wheel torque divided by the tyre’s radius.' },
    { t: 'Lugging', d: 'Asking for a lot of push at very low revs in a high gear. The engine shudders and strains.' },
  ],
  defaults: { gear: 2, rpm: 3000, slope: 0, run: 0, auto: false },
  onChange(s, key) { if (key === 'gear' || key === 'rpm') s.auto = false; },
  controls: [
    { key: 'gear', type: 'seg', label: 'Gear', options: [1, 2, 3, 4, 5].map((v) => ({ v, label: String(v) })), fmt: (v) => `${Math.abs(ratioOf(v)).toFixed(3)} × ${FINAL.toFixed(2)} = ${(Math.abs(ratioOf(v)) * FINAL).toFixed(2)} overall` },
    { key: 'rpm', type: 'range', label: 'Engine speed, full throttle', min: 800, max: 6500, step: 50, ends: ['idle', 'redline'], fmt: (v) => fmt(v) + ' rpm' },
    { key: 'slope', type: 'range', label: 'Slope of the road', min: 0, max: 30, step: 1, ends: ['level', 'steep ghat'], fmt: (v) => v + '%' },
    { type: 'buttons', label: 'Test track', items: [{ label: 'Full-throttle run through the gears', act: (s) => { s.run = (s.run || 0) + 1; s.auto = true; } }] },
  ],
  quiz: [
    { q: 'Why can a car not simply use one gear for everything, as most electric cars do?', options: ['Petrol engines are too heavy', 'A petrol engine only pulls well in a band of rpm, and cannot run at all near zero', 'Gears make the engine more powerful', 'It could; gears are only for comfort'], answer: 1, why: 'The engine needs to stay between idle and the redline while the wheels go from standstill to top speed. Several ratios let it stay in its useful band.' },
    { q: 'The engine makes 140 N·m. First gear is 3.32 and the final drive is 3.9. Ignoring friction, what torque reaches the wheels?', options: ['About 140 N·m', 'About 465 N·m', 'About 1,800 N·m', 'About 18,000 N·m'], answer: 2, why: '140 × 3.32 × 3.9 ≈ 1,813 N·m. The two ratios multiply. The price is speed: the wheels turn 13 times slower than the engine.' },
    { q: 'You are cruising at a steady 80 km/h. Which gear uses the least fuel?', options: ['First', 'Third', 'The highest gear the engine can pull smoothly', 'It makes no difference'], answer: 2, why: 'A higher gear turns the engine more slowly for the same road speed, so it loses less to friction and pumping. Go too high, though, and the engine lugs.' },
  ],
  reel: [
    { ms: 5800, caption: 'An engine is only strong between about 2,000 and 6,000 rpm, but the wheels must go from zero to top speed.', set: { gear: 1, slope: 0, auto: false }, anim: { rpm: [900, 6400] }, spin: 0 },
    { ms: 6400, caption: 'So the car climbs through its gears, and the rev counter draws a sawtooth.', set: { slope: 0 }, act: (s) => { s.run = (s.run || 0) + 1; s.auto = true; }, spin: 0 },
  ],

  build({ stage }) {
    const root = new THREE.Group(); stage.root.add(root);
    const narrow = isNarrow();
    // ---- engine stub and flywheel
    const eng = box(2.0, 2.6, 2.2, M.metal(0x566070, { roughness: 0.6 })); eng.position.set(-7.7, YA + 0.5, 0); root.add(eng);
    const head = box(1.8, 0.5, 1.5, M.plastic(0xd8412f)); head.position.set(-7.7, YA + 2.05, 0); root.add(head);
    const crank = new THREE.Group(); crank.position.y = YA; root.add(crank);
    crank.add(rod(-6.65, -6.35, 1.25, 1.25, gearMat(0x6c7484)), rod(-6.35, -6.05, 0.16, 0.16, gearMat(COL.input)));
    const fm = box(0.2, 0.3, 0.14, M.glow(0xffb547)); fm.position.set(-6.33, 1.05, 0); crank.add(fm);
    // ---- the gearbox from the other chapters, at half size
    const gb = makeGearbox({ casing: false });
    gb.group.scale.setScalar(0.5); gb.group.position.set(-3.25, YA, 0); root.add(gb.group);
    // ---- propeller shaft, final drive, axle and wheels
    const OX = 5.4, fd = makeFinalDrive(1.15);
    fd.group.position.set(OX, YA, 0); root.add(fd.group);
    const prop = new THREE.Group(); prop.position.y = YA; root.add(prop);
    prop.add(rod(-0.77, OX - 1.3, 0.13, 0.13, gearMat(COL.main)));
    const pm = box(0.6, 0.06, 0.1, M.glow(0x8ef0ff)); pm.position.set(2.2, 0.14, 0); prop.add(pm);
    const axle = new THREE.Group(); fd.crownSpin.add(axle);
    axle.add(zrod(-3.0, 3.0, 0.14, 0.14, gearMat(COL.steel)));
    for (const sgn of [-1, 1]) { const w = makeWheel(WR, 0.9); w.position.z = sgn * 3.0; axle.add(w); }
    const housing = new THREE.Mesh(new THREE.SphereGeometry(1.5, 28, 14), M.clear(COL.case, 0.1)); housing.position.set(OX, YA, 0.15); root.add(housing);

    // ---- charts
    const cur = { g: 2, rpm: 3000, v: 0, slope: 0 }; let trace = [];
    const chart = canvasTexture(820, 700, (g, w, h) => {
      const a = plotFrame(g, w, h, { x0: 0, x1: 220, y0: 0, y1: 7000, bh: 350, top: 60, bottom: 44, xTicks: [0, 40, 80, 120, 160, 200], yTicks: [0, 2000, 4000, 6000], yFmt: (v) => v / 1000 + 'k', title: 'Engine speed in each gear (rpm against km/h)' });
      g.fillStyle = 'rgba(255,90,70,.16)'; g.fillRect(a.left, a.Y(7000), a.pw, a.Y(ENGINE.redline) - a.Y(7000));
      for (const k of [1, 2, 3, 4, 5]) { a.line((v) => { const r = rpmAt(v / KMH, k); return r < ENGINE.idle || r > ENGINE.redline ? null : r; }, 0, 220, GEAR_COLORS[k], k === cur.g ? 7 : 3, null, 220); a.text(String(k), a.X(Math.min(212, speedAt(ENGINE.redline, k) * KMH)) - 6, a.Y(ENGINE.redline) - 8, GEAR_COLORS[k], 'bold 24px sans-serif'); }
      a.poly(trace.map((p) => [p[0], p[1]]), '#ffffff', 4);
      a.dot(cur.v * KMH, cur.rpm, '#ffffff', 10);
      const b = plotFrame(g, w, h, { clear: false, by: 350, bh: 350, x0: 0, x1: 220, y0: 0, y1: 7, top: 60, bottom: 54, xTicks: [0, 40, 80, 120, 160, 200], yTicks: [0, 2, 4, 6], yFmt: (v) => v + ' kN', title: 'Push at the tyres, and what the road asks for', xLabel: 'road speed (km/h)' });
      for (const k of [1, 2, 3, 4, 5]) b.line((v) => { const f = thrustAtV(v / KMH, k); return f === null ? null : f / 1000; }, 0, 220, GEAR_COLORS[k], k === cur.g ? 7 : 3, null, 220);
      b.line((v) => roadLoad(v / KMH, cur.slope) / 1000, 0, 220, 'rgba(255,255,255,.85)', 3, [10, 8]);
      b.text(`needed on a ${cur.slope}% slope`, b.X(105), b.Y(roadLoad(150 / KMH, cur.slope) / 1000) - 12, 'rgba(255,255,255,.85)', '20px sans-serif');
      b.dot(cur.v * KMH, thrust(cur.rpm, cur.g) / 1000, '#ffffff', 10);
    });
    const cb = board(chart.tex, 10.6, 9.1); cb.position.set(2.9, 9.2, -3.4); root.add(cb);
    if (isReel()) { cb.scale.setScalar(1.5); cb.position.set(-0.2, 14.6, -3.4); }
    if (narrow) { cb.scale.setScalar(0.8); cb.position.set(2.9, 8.1, -3.4); }
    const dials = canvasTexture(900, 440, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      const dial = (cx, label, val, max, unit, step, red) => {
        const r = 190, a0 = Math.PI * 0.8, a1 = Math.PI * 2.2, A = (v) => a0 + (a1 - a0) * clamp(v / max, 0, 1);
        g.fillStyle = 'rgba(8,10,16,.9)'; g.beginPath(); g.arc(cx, 225, r + 16, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 5; g.beginPath(); g.arc(cx, 225, r, a0, a1); g.stroke();
        if (red) { g.strokeStyle = '#ff5a46'; g.lineWidth = 12; g.beginPath(); g.arc(cx, 225, r - 8, A(red), a1); g.stroke(); }
        g.fillStyle = '#e8eef8'; g.font = '24px sans-serif'; g.textAlign = 'center';
        for (let v = 0; v <= max; v += step) { const a = A(v); g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 4; g.beginPath(); g.moveTo(cx + Math.cos(a) * (r - 20), 225 + Math.sin(a) * (r - 20)); g.lineTo(cx + Math.cos(a) * r, 225 + Math.sin(a) * r); g.stroke(); g.fillText(String(max > 100 ? v : v), cx + Math.cos(a) * (r - 46), 233 + Math.sin(a) * (r - 46)); }
        const a = A(val); g.strokeStyle = '#ff7a59'; g.lineWidth = 9; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx - Math.cos(a) * 26, 225 - Math.sin(a) * 26); g.lineTo(cx + Math.cos(a) * (r - 30), 225 + Math.sin(a) * (r - 30)); g.stroke(); g.lineCap = 'butt';
        g.fillStyle = '#e8eef8'; g.beginPath(); g.arc(cx, 225, 14, 0, TAU); g.fill();
        g.font = 'bold 30px sans-serif'; g.fillText(label, cx, 330); g.font = '22px sans-serif'; g.fillStyle = 'rgba(255,255,255,.65)'; g.fillText(unit, cx, 362);
      };
      dial(225, fmt(cur.rpm), cur.rpm / 1000, 7, 'rpm × 1,000', 1, 6.5);
      dial(675, fmt(cur.v * KMH), cur.v * KMH, 220, 'km/h', 20, 0);
      g.textAlign = 'left';
    });
    const db = board(dials.tex, 5.6, 2.74); db.position.set(-5.6, 6.3, -3.4); db.visible = !narrow; root.add(db);
    if (isReel()) db.position.set(-0.2, 5.8, -3.4);
    const lG = stage.label('', [-3.2, YA + 2.2, 0.5], root, 'hot'), lE = stage.label('Engine', [-7.7, YA + 2.8, 0], root), lF = stage.label('Final drive 39 : 10', [OX, YA + 2.6, 0], root);
    const lNote = stage.label('Parts not to scale', [0.6, 0.5, 2.2], root);

    let thE = 0, thO = 0, out = 0, run = 0, sim = null, tick = 0, shown = { rpm: 3000 };
    const info = { t100: null, top: 0, time: 0 };
    return {
      update(dt, s) {
        dt = Math.max(0, dt);
        if (s.run !== run) { run = s.run; sim = { v: 0, g: 1, t: 0, pause: 0 }; trace = []; info.t100 = null; info.time = 0; }
        if (sim && !s.auto) sim = null;
        let g = s.gear, rpm = s.rpm, v;
        if (sim) {
          // A full-throttle run: F = m·a with the engine's push in the current gear, less air drag and rolling
          // resistance. Below about 1,500 rpm in first the clutch is slipping, so the engine is held there.
          const steps = Math.max(1, Math.ceil(dt / 0.004)), h = dt / steps;
          for (let i = 0; i < steps; i++) {
            let r = Math.max(1500, rpmAt(sim.v, sim.g));
            if (sim.pause > 0) sim.pause -= h;
            else if (r >= SHIFT_AT && sim.g < 5) { sim.g++; sim.pause = SHIFT_S; r = rpmAt(sim.v, sim.g); }
            const F = sim.pause > 0 ? 0 : thrust(Math.min(r, ENGINE.redline), sim.g) * (r >= ENGINE.redline ? 0 : 1);
            // Rotating parts add a little to the mass that must be speeded up (about 5 % in the high gears, more in first).
            const mEff = CAR.mass * (1.04 + 0.0025 * (ratioOf(sim.g) * FINAL) ** 2);
            sim.v = Math.max(0, sim.v + ((F - roadLoad(sim.v, s.slope)) / mEff) * h); sim.t += h;
            if (!info.t100 && sim.v * KMH >= 100) info.t100 = sim.t;
          }
          g = sim.g; v = sim.v; rpm = Math.max(1500, rpmAt(v, g)); info.time = sim.t; info.top = v;
          if (trace.length < 3000) trace.push([v * KMH, rpm]);
          if (sim.t > 75) { s.auto = false; s.gear = g; s.rpm = clamp(Math.round(rpm / 50) * 50, 800, 6500); sim = null; }
        } else v = speedAt(rpm, g);
        shown.rpm = approach(shown.rpm, rpm, 10, dt);
        Object.assign(cur, { g, rpm: sim ? rpm : shown.rpm, v: sim ? v : speedAt(shown.rpm, g), slope: s.slope });
        gb.shiftStep(g, dt, 5);
        const pr = gb.progress(g), now = gb.engaged();
        out = pr > 0.3 ? approach(out, cur.rpm / ratioOf(g), now === g ? 40 : 9, dt) : out;
        thE += (cur.rpm / 60) * TAU * SHOWN * dt; thO += (out / 60) * TAU * SHOWN * dt;
        crank.rotation.x = thE; gb.pose(thE, thO); gb.setPath(now, 0.8); prop.rotation.x = thO; fd.set(thO);
        if (tick++ % 2 === 0) { chart.redraw(); if (!narrow) dials.redraw(); }
        lG.element.textContent = `${g}${['', 'st', 'nd', 'rd', 'th', 'th'][g]} gear: ${Math.abs(ratioOf(g)).toFixed(2)} to 1`;
        lE.visible = lF.visible = lNote.visible = !narrow;
      },
      readout: (s) => trim((() => {
        const g = cur.g, rpm = cur.rpm, v = cur.v, tq = torqueAt(rpm), wt = wheelTorque(rpm, g), F = wt / CAR.tyreR, need = roadLoad(v, s.slope), spare = F - need;
        if (sim) return `<div class="big">${fmt(v * KMH)} km/h in ${g}${['', 'st', 'nd', 'rd', 'th', 'th'][g]}</div>
          <div class="row"><span>Engine</span><b>${fmt(rpm)} rpm</b></div>
          <div class="row"><span>Time</span><b>${info.time.toFixed(1)} s</b></div>
          <div class="row"><span>0 to 100 km/h</span><b>${info.t100 ? info.t100.toFixed(1) + ' s' : 'not yet'}</b></div>
          <div class="row"><span>Push, less drag</span><b>${fmt(F)} − ${fmt(need)} N</b></div>`;
        const acc = spare / CAR.mass;
        return `<div class="big">${fmt(v * KMH)} km/h at ${fmt(rpm)} rpm</div>
          <div class="row"><span>Engine torque, power</span><b>${fmt(tq)} N·m, ${fmt(kW(tq, rpm))} kW</b></div>
          <div class="row"><span>× gear × final drive</span><b>× ${Math.abs(ratioOf(g)).toFixed(2)} × ${FINAL.toFixed(1)}</b></div>
          <div class="row"><span>Wheel torque</span><b>${fmt(wt)} N·m</b></div>
          <div class="row"><span>Push on the road</span><b>${fmt(F)} N</b></div>
          <div class="row"><span>Needed on ${s.slope}% slope</span><b>${fmt(need)} N</b></div>
          <div class="row"><span>${spare >= 0 ? 'Spare: it can speed up at' : 'Not enough'}</span><b>${spare >= 0 ? acc.toFixed(1) + ' m/s²' : 'change down'}</b></div>`;
      })(), 4),
    };
  },
};
