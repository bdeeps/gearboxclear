// Chapter 5: the final drive and the differential. A 10-tooth pinion turns a 39-tooth crown wheel;
// inside the crown's cage, two spider gears share the drive between two side gears, one per wheel.
import { THREE, M, rod, box, approach, clamp, canvasTexture } from '../kit.js';
import { makeFinalDrive, makeWheel, zrod, gearMat, glow, fit, isNarrow, trim, isReel, board, COL, CAR, FINAL, G0, KMH, TAU, fmt } from '../gearbox.js';

const SIDE_T = 16, SPIDER_T = 10;            // usual counts for a small car's differential
const TRACK = 1.3;                           // m between the two rear tyres
const SHOWN = 1 / 8, YA = 3.4, WZ = 5.2, WR = 3.4;
// Grip: dry tarmac about 0.8, wet mud about 0.1 (typical friction coefficients; see FrictionClear).
const MU = { road: 0.8, mud: 0.1 };
const W_WHEEL = CAR.mass * G0 * 0.5 / 2;     // N on each rear tyre: about half the car's weight sits on the rear axle
const NEED = CAR.mass * G0 * (0.08 + 0.03);  // N to climb out of a soft rut: an 8 % rise plus soft-ground rolling drag (about 0.03)

const calc = (s) => {
  const v = s.speed / KMH, wheel = (v / (TAU * CAR.tyreR)) * 60;                    // rpm of a wheel rolling at this speed
  const k = s.turn / 100, R = Math.abs(k) < 0.02 ? Infinity : 5 / Math.abs(k);     // turn radius at the middle of the axle, m
  const dir = Math.sign(k);                                                          // +1: turning left
  let L = wheel, Rr = wheel, cage = wheel, stuck = false, note = '';
  const tEach = MU.mud * W_WHEEL * CAR.tyreR, pushOpen = (2 * tEach) / CAR.tyreR, pushLock = (MU.mud + MU.road) * W_WHEEL;
  if (s.ground === 'mud') {
    if (s.lock) { L = Rr = cage = wheel; note = 'locked'; }
    else { L = 0; Rr = 2 * wheel; cage = wheel; stuck = true; }       // the car stands still; the engine turns the cage at this speed
  } else if (R !== Infinity) {
    const d = TRACK / (2 * R);
    L = wheel * (1 - dir * d); Rr = wheel * (1 + dir * d);
    if (s.lock) { L = Rr = wheel; note = 'scrub'; }
  }
  return { v, wheel, R, dir, L, Rr, cage, prop: cage * FINAL, spider: (Math.abs(Rr - L) / 2) * (SIDE_T / SPIDER_T), stuck, note, tEach, pushOpen, pushLock };
};

export default {
  id: 'diff',
  short: 'Differential',
  title: 'The final drive and the differential',
  subtitle: 'One more gear pair turns the drive through a right angle, then shares it between two wheels.',
  view: { get pos() { return VIEW().pos; }, get target() { return VIEW().target; } },
  learn: `<p>The gearbox's output still has two jobs left. In a rear-drive car a long <b>propeller shaft</b> carries the spin back to the axle. There a small <b>pinion</b> turns a big <b>crown wheel</b>. Here that is 10 teeth driving 39, so the <b>final drive</b> slows everything by 3.9 and multiplies the twist by 3.9, in every gear. It also turns the drive through a right angle, from along the car to across it.</p>
    <p>Now the puzzle. In a corner the outside wheel runs round a bigger circle than the inside one, so it must turn <b>faster</b>. Bolt both wheels to one solid axle and a tyre has to scrub and skid on every bend.</p>
    <p>The <b>differential</b> solves it. The crown wheel does not turn the wheels directly. It carries a <b>cage</b> with a cross pin, and on the pin sit two small <b>spider gears</b>. They mesh with two <b>side gears</b>, one on each half shaft. Going straight, the spiders do not spin on their pin: they just push both side gears round together, like a see-saw held level. In a corner they roll, adding speed to one side and taking exactly as much from the other. The <b>average</b> of the two wheel speeds always equals the cage's speed.</p>
    <p>The see-saw has a weakness. It always gives both wheels the <b>same twist</b>. Put one wheel on wet mud and it spins freely; the wheel with grip gets only the feeble twist the muddy one can take, and the car sits there. Tractors and off-road cars carry a <b>differential lock</b> that joins the two sides for exactly this. (How much a tyre can grip: <a href="https://glassbox.how/frictionclear/" target="_blank" rel="noopener">FrictionClear</a>. The whole car: <a href="https://glassbox.how/carclear/" target="_blank" rel="noopener">CarClear</a>.)</p>
    <p class="tip"><b>Try it:</b> steer hard left and watch the spider gears wake up. Then put the right wheel on mud, and free the car with the lock.</p>`,
  terms: [
    { t: 'Final drive', d: 'The pinion and crown wheel in the axle. Its ratio (here 39 ÷ 10 = 3.9) multiplies every gear’s ratio.' },
    { t: 'Crown wheel and pinion', d: 'A big and a small bevel gear at right angles. Real ones are usually hypoid: the pinion sits a little below centre and the teeth are curved.' },
    { t: 'Differential', d: 'Gears that split the drive between two wheels while letting them turn at different speeds.' },
    { t: 'Spider gears', d: 'The small bevel gears on the cross pin inside the cage. They spin only when the two wheels turn at different speeds.' },
    { t: 'Open differential', d: 'The plain kind. It always sends equal torque to both wheels, so one slipping wheel limits both.' },
    { t: 'Differential lock', d: 'A dog clutch that joins the two half shafts so both wheels must turn together.' },
  ],
  defaults: { speed: 30, turn: 0, ground: 'road', lock: false, shell: true },
  controls: [
    { key: 'turn', type: 'range', label: 'Steering', min: -100, max: 100, step: 2, ends: ['hard right', 'hard left'], fmt: (v) => (Math.abs(v) < 2 ? 'straight' : `${v > 0 ? 'left' : 'right'}, radius ${(500 / Math.abs(v)).toFixed(1)} m`) },
    { key: 'speed', type: 'range', label: 'Road speed', min: 5, max: 60, step: 1, fmt: (v) => v + ' km/h' },
    { key: 'ground', type: 'seg', label: 'Under the wheels', options: [{ v: 'road', label: 'Dry road' }, { v: 'mud', label: 'Right wheel on mud' }], fmt: () => '' },
    { key: 'lock', type: 'toggle', label: 'Differential lock' },
    { key: 'shell', type: 'toggle', label: 'Show the cage' },
  ],
  quiz: [
    { q: 'A car turns left. Which rear wheel turns faster?', options: ['The left (inner) wheel', 'The right (outer) wheel', 'Both the same', 'Neither turns'], answer: 1, why: 'The outer wheel follows a bigger circle in the same time, so it has further to go and must turn faster.' },
    { q: 'The cage turns at 250 rpm and the left wheel at 220 rpm. How fast is the right wheel turning?', options: ['220 rpm', '250 rpm', '280 rpm', '470 rpm'], answer: 2, why: 'The cage speed is always the average of the two wheels. (220 + 280) ÷ 2 = 250.' },
    { q: 'With an open differential, one wheel is on ice and spins. Why does the car not move?', options: ['The engine has stalled', 'The differential gives both wheels the same small torque that the slipping wheel can take', 'The gripping wheel is braked', 'The gearbox drops into neutral'], answer: 1, why: 'An open differential balances the torque side to side. The wheel on ice can take almost none, so the wheel with grip gets almost none too.' },
  ],
  reel: [
    { ms: 6000, caption: 'In a corner the outer wheel must turn faster, so little spider gears in the differential share out the speed.', set: { speed: 30, ground: 'road', lock: false, shell: false }, anim: { turn: [0, 100] }, spin: 0.3 },
  ],

  build({ stage }) {
    const root = new THREE.Group(); root.position.y = YA; stage.root.add(root);
    const narrow = isNarrow();
    const amber = gearMat(COL.input), brass = gearMat(COL.brass), green = gearMat(COL.fork), cyan = gearMat(COL.main), steel = gearMat(COL.steel);
    const fd = makeFinalDrive(3.0, CAR.final, { pinionMat: amber, crownMat: brass, crownBore: 0.66 });
    root.add(fd.group);
    const prop = new THREE.Group(); root.add(prop);
    prop.add(rod(-7.0, -2.7, 0.3, 0.3, amber));
    const pmk = box(1.2, 0.08, 0.16, M.glow(0xffb547)); pmk.position.set(-5, 0.32, 0); prop.add(pmk);
    // ---- the cage, bolted to the crown wheel
    const cage = fd.crownSpin;
    const shellMat = M.clear(COL.brass, 0.2), flange = new THREE.Mesh(new THREE.TorusGeometry(1.85, 0.2, 8, 40), brass);
    flange.position.set(0, 0, 0.62); cage.add(flange);
    const shell = new THREE.Mesh(new THREE.SphereGeometry(1.62, 32, 16), shellMat); cage.add(shell);
    const frame = new THREE.Mesh(new THREE.TorusGeometry(1.62, 0.1, 8, 40), brass); cage.add(frame);
    const pin = rod(-1.66, 1.66, 0.14, 0.14, steel, 16); pin.rotation.z = Math.PI / 2; pin.position.x = 0; cage.add(pin);
    // ---- spider and side gears: three copies of one meshing bevel pair, turned into place
    const pair = (q) => { const p = makeFinalDrive(1.15, [SPIDER_T, SIDE_T], { pinionMat: green, crownMat: cyan, crownBore: 0.3, face: 0.36 }); p.group.quaternion.copy(q); cage.add(p.group); return p; };
    const qZ = (a) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), a), qY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
    const A = pair(qZ(Math.PI / 2)), B = pair(qZ(-Math.PI / 2)), C = pair(qY.clone().multiply(qZ(Math.PI / 2)));
    B.group.remove(B.crownSpin); C.group.remove(C.pinion);
    // ---- half shafts and wheels
    const axL = new THREE.Group(), axR = new THREE.Group(); root.add(axL, axR);
    axL.add(zrod(0.5, WZ, 0.2, 0.2, cyan)); axR.add(zrod(-WZ, -0.5, 0.2, 0.2, cyan));
    const wL = makeWheel(WR, 0.9); wL.position.z = WZ; axL.add(wL); const wR = makeWheel(WR, 0.9); wR.position.z = -WZ; axR.add(wR);
    for (const [g, z] of [[axL, 2.6], [axR, -2.6]]) { const mk = box(0.16, 0.08, 1.4, M.glow(0x8ef0ff)); mk.position.set(0, 0.22, z); g.add(mk); }
    // The lock: a collar on the right half shaft that slides in to grip the cage.
    const lockC = zrod(-0.25, 0.25, 0.42, 0.42, gearMat(COL.sleeve), 24); root.add(lockC);
    const mud = box(4.4, 0.06, 2.6, M.matte(0x6b4a2b)); mud.position.set(0, -YA + 0.04, -WZ); root.add(mud);
    const tar = box(4.4, 0.05, 2.6, M.matte(0x2a2d35)); tar.position.set(0, -YA + 0.03, WZ); root.add(tar);
    const tar2 = box(4.4, 0.05, 2.6, M.matte(0x2a2d35)); tar2.position.set(0, -YA + 0.03, -WZ); root.add(tar2);

    // ---- plan view: the two wheel tracks round the bend
    const cur = { c: calc({ speed: 30, turn: 0, ground: 'road', lock: false }), a: 0 };
    const plan = canvasTexture(700, 520, (g, w, h) => {
      g.clearRect(0, 0, w, h); g.fillStyle = 'rgba(8,10,16,.88)'; g.fillRect(0, 0, w, h);
      const c = cur.c; g.fillStyle = '#e8eef8'; g.font = 'bold 25px sans-serif'; g.fillText('From above: the two rear wheel tracks', 20, 36);
      const cx = w / 2, by = h - 70, sc = 26;
      g.lineWidth = 6;
      if (c.R === Infinity) { for (const [sg, col] of [[-1, '#8ef0ff'], [1, '#ffb547']]) { g.strokeStyle = col; g.beginPath(); g.moveTo(cx + sg * TRACK * sc * 2, by); g.lineTo(cx + sg * TRACK * sc * 2, 70); g.stroke(); } }
      else { const ox = cx - c.dir * c.R * sc; for (const [sg, col] of [[-1, '#8ef0ff'], [1, '#ffb547']]) { g.strokeStyle = col; g.beginPath(); g.arc(ox, by, Math.abs(c.R + sg * c.dir * TRACK * 2) * sc, 0, TAU); g.stroke(); } }
      g.font = '21px sans-serif'; g.fillStyle = '#8ef0ff'; g.fillText(`left wheel: ${fmt(c.L)} rpm`, 20, h - 18); g.fillStyle = '#ffb547'; g.textAlign = 'right'; g.fillText(`right wheel: ${fmt(c.Rr)} rpm`, w - 20, h - 18); g.textAlign = 'left';
      g.fillStyle = 'rgba(255,255,255,.6)'; g.fillText(c.R === Infinity ? 'straight ahead: equal distances' : `turning ${c.dir > 0 ? 'left' : 'right'}: radius ${c.R.toFixed(1)} m (track drawn 4× wide)`, 20, 66);
    });
    const pb = board(plan.tex, 6.0, 4.46); pb.rotation.y = 2.16; pb.position.set(narrow ? -5 : -7.5, narrow ? 6.9 : 4.6, narrow ? 1.5 : -3.4); root.add(pb);
    if (isReel()) { pb.scale.setScalar(1.5); pb.position.set(-5, 7.6, 1.2); }
    const lP = stage.label('Pinion: 10 teeth', [-3.4, 1.3, 0], root), lC = stage.label('Crown wheel: 39 teeth', [0, 3.6, 0.6], root), lS = stage.label('', [0, -2.3, -0.6], root, 'hot');
    const lL = stage.label('', [0, WR + 0.5, WZ], root, 'hot'), lR = stage.label('', [0, WR + 0.5, -WZ], root, 'hot'), lSide = stage.label('Side gear', [0.6, 0.9, -1.9], root);

    let thP = 0, delta = 0, lockX = 0, tick = 0, sm = { L: 0, Rr: 0, cage: 0 };
    return {
      update(dt, s) {
        dt = Math.max(0, dt);
        const c = (cur.c = calc(s));
        for (const k of ['L', 'Rr', 'cage']) sm[k] = approach(sm[k], c[k], 5, dt);
        const w = (rpm) => (rpm / 60) * TAU * SHOWN * dt;
        thP += w(sm.cage * FINAL);
        const phiC = fd.set(thP);                               // pinion and crown (the cage turns with the crown)
        delta += w((sm.L - sm.Rr) / 2);                         // how far the left side gear has turned relative to the cage
        const phi = delta + 0.3;
        A.crownSpin.rotation.z = phi; A.pinion.rotation.x = A.pinionFor(phi);
        B.pinion.rotation.x = B.pinionFor(phi + Math.PI);
        C.crownSpin.rotation.z = phi;
        prop.rotation.x = thP;
        axL.rotation.z = phiC + delta; axR.rotation.z = phiC - delta;
        lockX = approach(lockX, s.lock ? 1 : 0, 6, dt); lockC.position.z = -2.8 + lockX * 0.95;
        shell.visible = s.shell; mud.visible = s.ground === 'mud'; tar2.visible = !mud.visible;
        const spin = Math.min(1, c.spider / 60);
        glow(green, spin * 0.5, 0x5cff9a);
        if (tick++ % 3 === 0) plan.redraw();
        lS.element.textContent = c.spider < 0.5 ? 'Spider gears: not spinning' : `Spider gears: ${fmt(c.spider)} rpm on their pin`;
        lL.element.textContent = `Left: ${fmt(c.L)} rpm`; lR.element.textContent = `Right: ${fmt(c.Rr)} rpm${c.stuck ? ', spinning' : ''}`;
        lP.visible = lC.visible = lSide.visible = !narrow;
      },
      readout: (s) => trim((() => {
        const c = calc(s);
        if (s.ground === 'mud') return `<div class="big">${s.lock ? 'Locked: it drives out' : 'Stuck: one wheel spins'}</div>
          <div class="row"><span>Grip, left / right tyre</span><b>${MU.road} / ${MU.mud}</b></div>
          <div class="row"><span>Torque each wheel can get</span><b>${s.lock ? `${fmt(MU.road * W_WHEEL * CAR.tyreR)} / ${fmt(c.tEach)}` : `${fmt(c.tEach)} / ${fmt(c.tEach)}`} N·m</b></div>
          <div class="row"><span>Push on the ground</span><b>${fmt(s.lock ? c.pushLock : c.pushOpen)} N</b></div>
          <div class="row"><span>Needed to climb out</span><b>${fmt(NEED)} N</b></div>
          <div class="row"><span>Left / right wheel</span><b>${fmt(c.L)} / ${fmt(c.Rr)} rpm</b></div>
          <div class="row"><span>Cage (their average)</span><b>${fmt(c.cage)} rpm</b></div>`;
        return `<div class="big">${c.note === 'scrub' ? 'Locked in a bend: tyres scrub' : c.R === Infinity ? 'Straight: both wheels equal' : `Outer wheel ${((Math.max(c.L, c.Rr) / Math.min(c.L, c.Rr) - 1) * 100).toFixed(1)}% faster`}</div>
          <div class="row"><span>Propeller shaft</span><b>${fmt(c.prop)} rpm</b></div>
          <div class="row"><span>÷ final drive 39/10</span><b>cage ${fmt(c.cage)} rpm</b></div>
          <div class="row"><span>Left wheel</span><b>${fmt(c.L)} rpm</b></div>
          <div class="row"><span>Right wheel</span><b>${fmt(c.Rr)} rpm</b></div>
          <div class="row"><span>Average of the two</span><b>${fmt((c.L + c.Rr) / 2)} rpm</b></div>
          <div class="row"><span>Spider gears on their pin</span><b>${fmt(c.spider)} rpm</b></div>`;
      })(), 4),
    };
  },
};
const VIEW = () => (isReel() ? fit([0, YA + 3.6, 0], [0.9, 0.5, -0.6], 13, 15) : isNarrow() ? fit([0, YA + 2.2, 0], [0.9, 0.5, -0.6], 13, 12.5) : fit([0, YA + 1.2, 0], [0.9, 0.5, -0.6], 15.5, 11.6, { pad: 1.05, top: 0.2 }));
