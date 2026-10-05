// Shared models for GearboxClear: gears that really mesh (spur, helical, internal and bevel),
// a three-shaft five-speed gearbox with real tooth counts, the engine and car numbers used by
// the readouts, and small chart helpers. Every shaft in the gearbox runs along X: the engine is
// at -X, the wheels at +X. Angles about X are measured from +Y towards +Z.
import { THREE, M, rod, beam, box, latheX, sphere, clamp, canvasTexture } from './kit.js';

export const TAU = Math.PI * 2, DEG = Math.PI / 180;

// ---------------------------------------------------------------- the numbers
// Tooth counts follow the Nissan FS5W71B five-speed (the "71" is its 71 mm shaft centre distance),
// a classic rear-drive box used from the 1970s Datsun Z cars and pickups onward. The mid-ratio set
// has a 22-tooth main drive gear on a 31-tooth counter gear, and the factory ratios 3.321, 2.077,
// 1.308, 1.000 and 0.864 with reverse 3.382 (Nissan service data, quoted on hybridz.org,
// ratsun.net and nissandiesel.dyndns.org: "main shaft 36 teeth, counter shaft 15 teeth, idler 21").
// The pairs below reproduce those ratios exactly: 31/22 × 33/14 = 3.321, × 28/19 = 2.077,
// × 26/28 = 1.308, × 36/15 = 3.382. The overdrive pair (19 on the main shaft, 31 on the layshaft)
// is the pair that gives the published 0.864; Nissan used several overdrive sets over the years.
// Each entry is [teeth on the layshaft gear, teeth on the main-shaft gear]; drive is [input, layshaft].
export const T = { drive: [22, 31], 1: [14, 33], 2: [19, 28], 3: [28, 26], 5: [31, 19], R: [15, 36], idler: 21 };
export const K0 = T.drive[1] / T.drive[0];                       // the layshaft always turns 31/22 = 1.409 times slower than the input
export const GEARS = ['R', 'N', 1, 2, 3, 4, 5];
// Turns of the input shaft for one turn of the output shaft. Negative means the output turns backwards.
export const ratioOf = (g) => (g === 'N' ? null : g === 4 ? 1 : g === 'R' ? -K0 * T.R[1] / T.R[0] : K0 * T[g][1] / T[g][0]);
export const gearName = (g) => ({ R: 'Reverse', N: 'Neutral', 1: '1st', 2: '2nd', 3: '3rd', 4: '4th', 5: '5th' }[g]);
export const CENTRE_MM = 71;
// Loss in the teeth: about 1 to 2 % of the power at each loaded mesh (Bosch Automotive Handbook
// gives 98 to 99 % for a ground spur or helical pair). Direct drive loads no gear teeth at all.
export const ETA_MESH = 0.98;
export const etaOf = (g) => (g === 'N' ? 0 : g === 4 ? 0.99 : g === 'R' ? ETA_MESH ** 3 : ETA_MESH ** 2);

// A typical naturally aspirated 1.5 litre petrol engine at full throttle: about 141 N·m near
// 4,200 rpm and 80 kW at 6,000 rpm. The shape (weak at the bottom, a hump in the middle, falling
// away near the redline) is the usual one for such engines; the exact figures are illustrative.
export const ENGINE = { idle: 800, redline: 6500 };
const TQ = [[800, 95], [1500, 112], [2500, 128], [3500, 138], [4200, 141], [5000, 137], [6000, 127], [6500, 115]];
export function torqueAt(rpm) {
  if (rpm < 500) return 0;
  rpm = clamp(rpm, TQ[0][0], TQ[TQ.length - 1][0]);
  let i = 1; while (TQ[i][0] < rpm) i++;
  const [x0, y0] = TQ[i - 1], [x1, y1] = TQ[i], k = (rpm - x0) / (x1 - x0);
  return y0 + (y1 - y0) * (k * k * (3 - 2 * k));
}
export const kW = (nm, rpm) => (nm * rpm) / 9549;                // P = T·ω; 9,549 = 60,000 / 2π
// A small rear-drive car. Final drive 39:10 = 3.90 (a common hypoid set; it is also the axle ratio
// Nissan paired with this gearbox). Tyre 175/65 R14: 0.5 × 355.6 mm + 0.65 × 175 mm = 291.6 mm
// unloaded, about 285 mm rolling. Drag area and rolling resistance are typical small-saloon values
// (Gillespie, Fundamentals of Vehicle Dynamics: Cd·A about 0.6 to 0.8 m², Crr about 0.010 to 0.015).
export const CAR = { mass: 1150, final: [10, 39], tyreR: 0.285, cdA: 0.68, crr: 0.012, rho: 1.2, etaAxle: 0.96 };
export const FINAL = CAR.final[1] / CAR.final[0];
export const G0 = 9.81;
export const speedAt = (rpm, g) => (g === 'N' ? 0 : (rpm / (Math.abs(ratioOf(g)) * FINAL)) * TAU * CAR.tyreR / 60);        // m/s
export const rpmAt = (v, g) => (v / (TAU * CAR.tyreR)) * 60 * Math.abs(ratioOf(g)) * FINAL;
export const wheelTorque = (rpm, g, throttle = 1) => (g === 'N' ? 0 : torqueAt(rpm) * throttle * Math.abs(ratioOf(g)) * FINAL * etaOf(g) * CAR.etaAxle);
export const roadLoad = (v, gradePct = 0) => 0.5 * CAR.rho * CAR.cdA * v * v + CAR.mass * G0 * (CAR.crr + gradePct / 100);    // N
export const KMH = 3.6;

// ---------------------------------------------------------------- gears
// A gear with its axis along X, centred on the origin. N teeth of module m: pitch radius m·N/2.
// Tooth 0 points along +Y. helix: the teeth are cut at this angle to the axis (hand ±1); two gears
// mesh when their hands are opposite. internal: teeth point inwards (a ring gear) and `rim` is the
// smooth outside radius. taper: half-angle of the pitch cone for a bevel gear; the teeth shrink
// towards the cone's tip, which lies on the +X side.
export function gearGeo(N, m, w, { helix = 0, hand = 1, bore = 0.3, internal = false, rim = 0, add = 1, ded = 1.25, taper = 0, crown = 0.1 } = {}) {
  const rp = (m * N) / 2, p = TAU / N;
  const ra = internal ? rp - add * m : rp + add * m, rf = internal ? rp + ded * m : rp - ded * m;
  const other = internal ? rim || rp + 3.2 * m : bore;
  const prof = [[rf, -0.3], [rp, -0.25], [ra, -crown], [ra, crown], [rp, 0.25], [rf, 0.3]];
  const ns = helix ? 4 : 1, P = N * prof.length, tw = (hand * Math.tan(helix)) / rp;
  const ring = [], inner = [];
  for (let j = 0; j <= ns; j++) {
    const x = -w / 2 + (w * j) / ns, sc = taper ? 1 - ((x + w / 2) * Math.tan(taper)) / rp : 1, a0 = tw * x;
    const A = [], B = [];
    for (let i = 0; i < N; i++) for (const [r, k] of prof) {
      const a = (i + k) * p + a0, c = Math.cos(a), s = Math.sin(a), ro = taper && !internal ? Math.min(other, rf * sc * 0.8) : other * (internal ? sc : 1);
      A.push([x, r * sc * c, r * sc * s]); B.push([x, ro * c, ro * s]);
    }
    ring.push(A); inner.push(B);
  }
  const pos = [];
  const quad = (a, b, c, d) => pos.push(...a, ...b, ...c, ...a, ...c, ...d);
  for (let i = 0; i < P; i++) {
    const k = (i + 1) % P;
    for (let j = 0; j < ns; j++) { quad(ring[j][i], ring[j][k], ring[j + 1][k], ring[j + 1][i]); quad(inner[j][k], inner[j][i], inner[j + 1][i], inner[j + 1][k]); }
    quad(ring[0][k], ring[0][i], inner[0][i], inner[0][k]);
    quad(ring[ns][i], ring[ns][k], inner[ns][k], inner[ns][i]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}
export const gearMat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, metalness: 0.55, roughness: 0.42, side: THREE.DoubleSide, emissive: 0xff7a1a, emissiveIntensity: 0, ...o });
export function gear(N, m, w, mat, o = {}) { const g = new THREE.Mesh(gearGeo(N, m, w, o), mat); g.castShadow = true; g.receiveShadow = true; g.userData = { N, m, rp: (m * N) / 2 }; return g; }
// The angle gear B must take so its teeth sit in gear A's gaps. A (NA teeth) is at angle thA;
// B (NB teeth) lies in direction d from A (measured like every angle here) and turns the other way.
export const meshAngle = (thA, NA, NB, d) => d + Math.PI + Math.PI / NB - ((thA - d) * NA) / NB;
// The same for a ring gear B (internal teeth) around a planet A: both turn the same way.
export const meshInner = (thA, NA, NB, d) => d - Math.PI / NB + ((thA - d) * NA) / NB;

// Glow a material to show it is carrying torque.
const HOT = new THREE.Color(0xffa028);
export const glow = (mat, k, color = 0xff7a1a) => { mat.emissive.setHex(color); mat.emissiveIntensity = k; };

// ---------------------------------------------------------------- the five-speed gearbox
// Colours: amber for the engine side, violet for the layshaft, steel for the free gears,
// cyan for the main (output) shaft and its hubs, red for the three sliding collars.
export const COL = { input: 0xf0a640, lay: 0xa493e0, free: 0xcdd3dd, main: 0x58c4e0, sleeve: 0xf0604a, brass: 0xd9b25a, idler: 0xe6d25a, fork: 0x6fdc9a, steel: 0x8f98a8, case: 0xbfc8d6 };
export const CD = 2.0;                                           // layshaft sits this far below the main shaft (71 mm in the real box)
export const MM = CENTRE_MM / CD;                                // millimetres per scene unit
export const X = { drive: -3.6, hubA: -2.85, 3: -2.1, 2: -1.5, hubB: -0.75, 1: 0, plate: 0.62, R: 1.25, hubC: 2.0, 5: 2.75, lever: 2.75 };
export const TRAVEL = 0.32;                                      // how far a collar slides to lock a gear
export const HELIX = 24 * DEG;                                   // a usual helix angle for car gears (about 20 to 30 degrees)
const GW = 0.4, DOG_R = 0.6, DOG_N = 30;
// Which collar and which way for each gear. Collar A: 3rd and 4th; B: 1st and 2nd; C: 5th and reverse.
// dir +1 slides the collar towards the wheels (+X).
export const SHIFT = { 1: [1, 1], 2: [1, -1], 3: [0, 1], 4: [0, -1], 5: [2, 1], R: [2, -1], N: [0, 0] };
const ROD_Z = [0, -0.42, 0.42];                                  // selector rods: 3/4 in the middle, 1/2 and 5/R on either side
const modOf = (pair) => (2 * CD) / (pair[0] + pair[1]);          // each pair's tooth size is set so it spans the same centre distance
const MOD_R = 0.068;                                             // the reverse set is smaller so the two gears leave room for the idler
// The idler's axis: it must touch both reverse gears, which do not touch each other.
const dLI = (MOD_R * (T.R[0] + T.idler)) / 2, dIM = (MOD_R * (T.idler + T.R[1])) / 2;
const IY = (dLI * dLI - dIM * dIM + CD * CD) / (2 * CD), IZ = Math.sqrt(dLI * dLI - IY * IY);
export const IDLER = { y: -CD + IY, z: IZ };
const dirLI = Math.atan2(IZ, IY), dirIM = Math.atan2(-IZ, CD - IY);

// The gear on the main-shaft axis that each forward gear and reverse uses, with its dog teeth and cone.
function dogRing(mat, brassMat, side) {
  const g = new THREE.Group();
  const dogs = gear(DOG_N, (2 * DOG_R) / DOG_N, 0.13, mat, { bore: 0.4, crown: 0.02 }); dogs.position.x = side * (GW / 2 + 0.065); g.add(dogs);
  const cone = latheX([[0, 0.34], [0, 0.53], [0.15, 0.46], [0.15, 0.34]], mat, { seg: 40 }); cone.scale.x = side; cone.position.x = side * (GW / 2 + 0.13); g.add(cone);
  if (brassMat) { const ring = gear(DOG_N, (2 * DOG_R) / DOG_N, 0.1, brassMat, { bore: 0.5, crown: 0.02 }); ring.position.x = side * (GW / 2 + 0.24); g.add(ring); }
  return g;
}

export function makeGearbox({ casing = true, lever = true } = {}) {
  const group = new THREE.Group();
  const mats = {}, mk = (name, color, o) => { const m = (mats[name] = gearMat(color, o)); m.userData.base = color; return m; };
  const inAsm = new THREE.Group(), layAsm = new THREE.Group(), mainAsm = new THREE.Group(), idlerAsm = new THREE.Group(), selAsm = new THREE.Group(), caseAsm = new THREE.Group();
  group.add(inAsm, layAsm, mainAsm, idlerAsm, selAsm, caseAsm);
  const brass = gearMat(COL.brass, { metalness: 0.7, roughness: 0.35 });

  // ---- input shaft and its gear (one piece, turned by the clutch)
  const inRot = new THREE.Group(); inAsm.add(inRot);
  mk('in', COL.input);
  inRot.add(rod(-5.7, X.drive + GW / 2, 0.3, 0.3, mats.in));
  for (let k = 0; k < 10; k++) { const a = (k / 10) * TAU, sp = box(0.7, 0.07, 0.09, mats.in); sp.position.set(-5.3, 0.31 * Math.cos(a), 0.31 * Math.sin(a)); sp.rotation.x = a; inRot.add(sp); }   // splines for the clutch plate
  const mD = modOf(T.drive);
  const inGear = gear(T.drive[0], mD, GW, mats.in, { helix: HELIX, hand: -1 }); inGear.position.x = X.drive; inRot.add(inGear);
  const inDog = dogRing(mats.in, brass, 1); inDog.position.x = X.drive; inRot.add(inDog);

  // ---- layshaft: one solid cluster of six gears
  const layRot = new THREE.Group(); layRot.position.y = -CD; layAsm.add(layRot);
  const laySegs = [], layStops = [-4.15, X.drive, X[3], X[2], X[1], X.R, X[5], 3.45];
  for (let i = 0; i < layStops.length - 1; i++) { const m = mk('laySeg' + i, COL.lay); laySegs.push(m); layRot.add(rod(layStops[i], layStops[i + 1], 0.3, 0.3, m)); }
  mk('layDrive', COL.lay);
  const layDrive = gear(T.drive[1], mD, GW, mats.layDrive, { helix: HELIX, hand: 1 }); layDrive.position.x = X.drive; layRot.add(layDrive);
  const free = {};
  // ---- main shaft: hubs splined to it, collars sliding on the hubs
  const mainRot = new THREE.Group(); mainAsm.add(mainRot);
  const mainStops = [X.drive + GW / 2 + 0.06, X.hubA, X.hubB, X.hubC, 4.9], mainSegs = [];
  for (let i = 0; i < 4; i++) { const m = mk('mainSeg' + i, COL.main); mainSegs.push(m); mainRot.add(rod(mainStops[i], mainStops[i + 1], i ? 0.3 : 0.27, 0.3, m)); }
  const flange = rod(4.7, 4.9, 0.75, 0.75, mats.mainSeg3); mainRot.add(flange);
  for (let k = 0; k < 4; k++) { const a = (k / 4) * TAU + 0.4, b = rod(4.9, 4.98, 0.1, 0.1, gearMat(COL.steel), 12); b.position.y = 0.52 * Math.cos(a); b.position.z = 0.52 * Math.sin(a); mainRot.add(b); }
  const mark = box(0.5, 0.06, 0.1, M.glow(0x8ef0ff)); mark.position.set(4.3, 0.31, 0); mainRot.add(mark);
  const inMark = box(0.5, 0.06, 0.1, M.glow(0xffb547)); inMark.position.set(-4.5, 0.31, 0); inRot.add(inMark);

  for (const g of [1, 2, 3, 5, 'R']) {
    const pair = T[g], rev = g === 'R', m = rev ? MOD_R : modOf(pair), o = rev ? {} : { helix: HELIX };
    const lm = mk('lay' + g, COL.lay), fm = mk('free' + g, COL.free);
    const lg = gear(pair[0], m, GW, lm, { ...o, hand: 1, bore: 0.25 }); lg.position.x = X[g]; layRot.add(lg);
    const mg = gear(pair[1], m, GW, fm, { ...o, hand: -1, bore: 0.31 }); mg.position.x = X[g]; mainAsm.add(mg);
    const side = Math.sign(X[['hubB', 'hubB', 'hubA', null, 'hubC'][g - 1] || 'hubC'] - X[g]);
    mg.add(dogRing(fm, brass, side));
    free[g] = { lay: lg, main: mg, pair, m };
  }
  mk('idler', COL.idler);
  const idler = gear(T.idler, MOD_R, GW + 0.1, mats.idler, { bore: 0.16 }); idler.position.set(X.R, IDLER.y, IDLER.z); idlerAsm.add(idler);
  const idlerPin = rod(X.R - 0.55, X.R + 0.55, 0.15, 0.15, gearMat(COL.steel)); idlerPin.position.y = IDLER.y; idlerPin.position.z = IDLER.z; idlerAsm.add(idlerPin);

  const hubs = [X.hubA, X.hubB, X.hubC].map((x, i) => {
    const hm = mk('hub' + i, COL.main), sm = mk('sleeve' + i, COL.sleeve);
    const hub = gear(DOG_N, (2 * DOG_R) / DOG_N, 0.36, hm, { bore: 0.3, crown: 0.02 }); hub.position.x = x; mainRot.add(hub);
    const sleeve = latheX([[-0.23, 0.63], [-0.23, 0.8], [-0.08, 0.8], [-0.08, 0.72], [0.08, 0.72], [0.08, 0.8], [0.23, 0.8], [0.23, 0.63], [-0.23, 0.63]], sm, { seg: 48 });
    sleeve.position.x = x; mainRot.add(sleeve);
    return { x, hub, sleeve };
  });

  // ---- selector rods, forks and the gear lever
  const forkMat = gearMat(COL.fork, { metalness: 0.3 }), steel = gearMat(COL.steel);
  const RY = 1.82;
  const rods = hubs.map((h, i) => {
    const g = new THREE.Group(); selAsm.add(g);
    const r = rod(-3.5, 3.35, 0.075, 0.075, steel, 16); r.position.y = RY; r.position.z = ROD_Z[i]; g.add(r);
    const yg = new THREE.TorusGeometry(0.8, 0.065, 8, 28, Math.PI * 0.9); yg.rotateZ(Math.PI * 0.05); yg.rotateY(Math.PI / 2);
    const yoke = new THREE.Mesh(yg, forkMat); yoke.position.x = h.x; yoke.castShadow = true; g.add(yoke);
    g.add(beam([h.x, 0.84, 0], [h.x, RY, ROD_Z[i]], 0.075, forkMat, 10));
    const boss = box(0.3, 0.22, 0.22, forkMat); boss.position.set(h.x, RY, ROD_Z[i]); g.add(boss);
    for (const s of [-1, 1]) { const lug = box(0.12, 0.3, 0.3, steel); lug.position.set(X.lever + s * 0.17, RY + 0.2, ROD_Z[i]); g.add(lug); }   // the gate the lever's finger sits in
    return g;
  });
  const leverPivot = new THREE.Group(); leverPivot.position.set(X.lever, 3.05, 0); selAsm.add(leverPivot);
  const FINGER = 1.02;
  if (lever) {
    leverPivot.add(beam([0, -FINGER, 0], [0, 1.55, 0], 0.07, steel, 12), sphere(0.2, steel, 16));
    const knob = sphere(0.27, M.plastic(0x23262e), 20); knob.position.y = 1.65; leverPivot.add(knob);
    const tower = box(0.9, 0.9, 1.3, M.clear(COL.case, 0.16)); tower.position.set(X.lever, 2.65, 0); tower.castShadow = false; caseAsm.add(tower);
  }

  // ---- casing and bearings
  const caseMat = M.clear(COL.case, 0.1, { roughness: 0.5 });
  if (casing) {
    const shell = box(7.9, 5.9, 4.5, caseMat); shell.position.set(-0.35, -0.75, 0.1); shell.castShadow = false; caseAsm.add(shell);
    const bell = latheX([[-5.9, 2.9], [-4.3, 2.3]], caseMat, { seg: 40 }); bell.position.y = -0.4; bell.castShadow = false; caseAsm.add(bell);
    const plate = box(0.12, 5.6, 4.2, M.clear(COL.case, 0.16)); plate.position.set(X.plate, -0.75, 0.1); plate.castShadow = false; caseAsm.add(plate);
  }
  const bearMat = gearMat(0x555c69, { metalness: 0.8 });
  for (const [x, y, r] of [[-4.15, 0, 0.55], [-4.15, -CD, 0.5], [X.plate, 0, 0.5], [X.plate, -CD, 0.5], [3.45, 0, 0.5], [3.45, -CD, 0.5]]) {
    const b = latheX([[-0.12, r - 0.18], [-0.12, r], [0.12, r], [0.12, r - 0.18], [-0.12, r - 0.18]], bearMat, { seg: 28 }); b.position.set(x, y, 0); caseAsm.add(b);
  }

  // ---- posing
  const st = { thr: [0, 0, 0], gz: 0 };
  function pose(thIn, thOut, thr = st.thr, gz = st.gz) {
    st.thr = thr; st.gz = gz;
    inRot.rotation.x = thIn;
    const thLay = meshAngle(thIn, T.drive[0], T.drive[1], Math.PI);
    layRot.rotation.x = thLay;
    for (const g of [1, 2, 3, 5]) free[g].main.rotation.x = meshAngle(thLay, T[g][0], T[g][1], 0);
    const thI = meshAngle(thLay, T.R[0], T.idler, dirLI);
    idler.rotation.x = thI;
    free.R.main.rotation.x = meshAngle(thI, T.idler, T.R[1], dirIM);
    mainRot.rotation.x = thOut;
    hubs.forEach((h, i) => { h.sleeve.position.x = h.x + thr[i] * TRAVEL; rods[i].position.x = thr[i] * TRAVEL; });
    // The lever's finger sits in the gate of the rod at z = gz, and follows that rod.
    let k = 0; ROD_Z.forEach((z, i) => { if (Math.abs(z - gz) < Math.abs(ROD_Z[k] - gz)) k = i; });
    const dx = thr[k] * TRAVEL;
    leverPivot.rotation.set(-Math.asin(clamp(gz / FINGER, -1, 1)), 0, Math.asin(clamp(dx / FINGER, -1, 1)));
  }
  // Light up everything that carries torque in gear g (k = 0…1). Returns the list of glowing parts.
  function setPath(g, k = 1, turning = true) {
    for (const m of Object.values(mats)) { m.emissiveIntensity = 0; m.color.setHex(m.userData.base); }
    if (!turning) return;
    const on = (name) => { const m = mats[name]; if (m) { m.color.lerp(HOT, 0.75 * k); glow(m, 0.38 * k); } };
    on('in');
    if (g === 'N') return;
    const [hub] = SHIFT[g];
    on('hub' + hub); on('sleeve' + hub);
    for (let i = hub + 1; i < 4; i++) on('mainSeg' + i);
    if (g === 4) return;                                      // direct drive: the layshaft idles
    on('layDrive'); on('lay' + g); on('free' + g);
    const stop = { 3: 1, 2: 2, 1: 3, R: 4, 5: 5 }[g];
    for (let i = 1; i < stop; i++) on('laySeg' + i);
    if (g === 'R') on('idler');
  }
  // Moves the lever and collars one step towards gear g, the way a hand does: back to neutral,
  // across the gate, then into gear. Returns true once the collar is fully home.
  function shiftStep(g, dt, rate = 2.6) {
    const [ri, dir] = SHIFT[g], thr = st.thr, zT = g === 'N' ? 0 : ROD_Z[ri];
    const step = rate * dt, to = (v, t) => (Math.abs(t - v) <= step ? t : v + Math.sign(t - v) * step);
    const here = Math.abs(st.gz - zT) < 1e-3;
    let busy = false;
    for (let i = 0; i < 3; i++) { const keep = dir && i === ri && here && thr[i] * dir >= 0; if (!keep && thr[i] !== 0) { thr[i] = to(thr[i], 0); busy = true; } }
    if (busy) return false;
    if (!here) { st.gz = to(st.gz, zT); return false; }
    if (!dir) return true;
    thr[ri] = to(thr[ri], dir);
    return thr[ri] === dir;
  }
  const engaged = () => { for (const g of [1, 2, 3, 4, 5, 'R']) { const [ri, dir] = SHIFT[g]; if (st.thr[ri] * dir > 0.9) return g; } return 'N'; };
  // How far the collar for gear g has travelled towards it (0 to 1).
  const progress = (g) => (g === 'N' ? 0 : clamp(st.thr[SHIFT[g][0]] * SHIFT[g][1], 0, 1));
  pose(0, 0);
  return { group, inAsm, layAsm, mainAsm, idlerAsm, selAsm, caseAsm, caseMat, mats, free, hubs, rods, idler, leverPivot, st, pose, setPath, shiftStep, engaged, progress, RY };
}

// ---------------------------------------------------------------- small shared parts
// A road wheel with its axle along Z.
export function makeWheel(R = 1, width = 0.55) {
  const g = new THREE.Group();
  const prof = [[R * 0.62, -width / 2], [R * 0.93, -width / 2], [R, -width * 0.3], [R, width * 0.3], [R * 0.93, width / 2], [R * 0.62, width / 2]];
  const tg = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 40); tg.rotateX(Math.PI / 2);
  const tyre = new THREE.Mesh(tg, M.matte(0x1c1e24, { side: THREE.DoubleSide })); tyre.castShadow = true; g.add(tyre);
  const tread = new THREE.InstancedMesh(new THREE.BoxGeometry(0.07, 0.04, width * 0.8), M.matte(0x3a3e48), 24), o = new THREE.Object3D();
  for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU; o.position.set(Math.cos(a) * R, Math.sin(a) * R, 0); o.rotation.set(0, 0, a); o.updateMatrix(); tread.setMatrixAt(i, o.matrix); }
  g.add(tread);
  const rimMat = M.metal(0xc9ced8, { roughness: 0.3 });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.62, R * 0.62, width * 0.5, 32), M.metal(0x7c8594, { roughness: 0.5 })); disc.rotation.x = Math.PI / 2; g.add(disc);
  for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU; for (const s of [-1, 1]) g.add(beam([0, 0, s * width * 0.27], [Math.cos(a) * R * 0.6, Math.sin(a) * R * 0.6, s * width * 0.27], R * 0.07, rimMat, 8)); }
  return g;
}
// A cylinder along Z.
export function zrod(z0, z1, r0, r1 = r0, mat, seg = 32) { const m = rod(z0, z1, r0, r1, mat, seg); m.position.set(0, 0, m.position.x); m.rotation.y = -Math.PI / 2; return m; }

// ---------------------------------------------------------------- framing and charts
export const isNarrow = () => { const el = document.getElementById('stage'); return !!el && el.clientWidth < 560 && !document.body.classList.contains('gb-reel'); };
export const isReel = () => document.body.classList.contains('gb-reel');
// A camera that frames a w × h region centred on c, seen from direction dir, whatever the shape of
// the stage. top: the share of the height kept clear above the model (for the readout).
export function fit(c, dir, w, h, { shiftX = 0, top = 0, pad = 1.15, phoneTop = 0.42 } = {}) {
  const TAN = Math.tan(21 * DEG), n = Math.hypot(...dir);
  const calc = () => {
    const el = document.getElementById('stage'), a = el && el.clientHeight ? el.clientWidth / el.clientHeight : 1.4;
    const reel = isReel(), phone = !reel && isNarrow();
    const r = reel ? 0 : phone ? phoneTop : top, p = reel ? 1.04 : pad;
    const ww = reel || phone ? w - 2 * Math.abs(shiftX) : w;                // no room is kept beside the model when nothing overlaps it
    const D = (p * Math.max(h / (1 - r), ww / a)) / (2 * TAN), k = Math.min(2.5, Math.max(1, 1.45 / Math.max(0.3, a)));
    const tg = [c[0] - (reel || phone ? 0 : shiftX), c[1] + r * D * TAN * 0.9, c[2] || 0];
    return { tg, pos: tg.map((t, i) => t + ((dir[i] / n) * D) / k) };
  };
  return { get target() { return calc().tg; }, get pos() { return calc().pos; } };
}
// A dark board with plot axes. Returns helpers mapping data to canvas pixels.
export function plotFrame(g, w, h, { x0, x1, y0, y1, left = 86, right = 30, top = 70, bottom = 64, xTicks = [], yTicks = [], xFmt = String, yFmt = String, title = '', xLabel = '', yLabel = '', clear = true, bh = h, by = 0 }) {
  if (clear) { g.clearRect(0, 0, w, h); g.fillStyle = 'rgba(8,10,16,.88)'; g.fillRect(0, 0, w, h); }
  const pw = w - left - right, ph = bh - top - bottom;
  const PX = (x) => left + ((x - x0) / (x1 - x0)) * pw, PY = (y) => by + top + ph - ((y - y0) / (y1 - y0)) * ph;
  g.setLineDash([]); g.lineWidth = 1.5; g.strokeStyle = 'rgba(255,255,255,.13)'; g.fillStyle = 'rgba(255,255,255,.66)'; g.font = '20px sans-serif';
  g.textAlign = 'right';
  for (const t of yTicks) { g.beginPath(); g.moveTo(left, PY(t)); g.lineTo(left + pw, PY(t)); g.stroke(); g.fillText(yFmt(t), left - 10, PY(t) + 7); }
  g.textAlign = 'center';
  for (const t of xTicks) { g.beginPath(); g.moveTo(PX(t), by + top); g.lineTo(PX(t), by + top + ph); g.stroke(); g.fillText(xFmt(t), PX(t), by + top + ph + 26); }
  g.fillStyle = 'rgba(255,255,255,.55)'; g.font = '18px sans-serif';
  if (xLabel) g.fillText(xLabel, left + pw / 2, by + bh - 8);
  g.textAlign = 'left';
  if (title) { g.fillStyle = '#e8eef8'; g.font = 'bold 25px sans-serif'; g.fillText(title, 20, by + 34); }
  if (yLabel) { g.fillStyle = 'rgba(255,255,255,.55)'; g.font = '18px sans-serif'; g.fillText(yLabel, 12, by + top - 12); }
  const line = (fn, from, to, color, width = 5, dash = null, n = 100) => {
    g.strokeStyle = color; g.lineWidth = width; g.setLineDash(dash || []); g.beginPath();
    let started = false;
    for (let i = 0; i <= n; i++) {
      const x = from + ((to - from) * i) / n, y = fn(x);
      if (y === null || !Number.isFinite(y)) { started = false; continue; }
      const px = PX(x), py = PY(clamp(y, y0, y1));
      if (!started) { g.moveTo(px, py); started = true; } else g.lineTo(px, py);
    }
    g.stroke(); g.setLineDash([]);
  };
  const poly = (pts, color, width = 4) => { if (pts.length < 2) return; g.strokeStyle = color; g.lineWidth = width; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(PX(x), PY(clamp(y, y0, y1))) : g.moveTo(PX(x), PY(clamp(y, y0, y1))))); g.stroke(); };
  const dot = (x, y, color, r = 10) => { g.fillStyle = color; g.beginPath(); g.arc(PX(clamp(x, x0, x1)), PY(clamp(y, y0, y1)), r, 0, TAU); g.fill(); g.strokeStyle = 'rgba(8,10,16,.9)'; g.lineWidth = 3; g.stroke(); };
  const text = (s, x, y, color, font = 'bold 20px sans-serif', align = 'left') => { g.fillStyle = color; g.font = font; g.textAlign = align; g.fillText(s, x, y); g.textAlign = 'left'; };
  return { X: PX, Y: PY, line, poly, dot, text, pw, ph, left, top: by + top };
}
export function board(tex, w, h) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, side: THREE.DoubleSide }));
  return m;
}
// On a phone the readout covers much of the stage, so keep its headline and first rows only.
export const trim = (html, n = 3) => { if (!isNarrow()) return html; let k = 0; return html.replace(/<div class="row">[\s\S]*?<\/div>/g, (m) => (k++ < n ? m : '')); };
export const GEAR_COLORS = { 1: '#ff7a59', 2: '#ffb547', 3: '#e6e25a', 4: '#5ce1a9', 5: '#8ef0ff', R: '#c49bff' };
export const fmt = (v, d = 0) => v.toLocaleString('en', { minimumFractionDigits: d, maximumFractionDigits: d });
export { canvasTexture };

// ---------------------------------------------------------------- final drive (bevel pair)
// A pinion on the X axis driving a crown wheel on the Z axis. The group's origin is the point
// where both pitch cones meet. Positive pinion rotation (the engine's direction) gives positive
// crown rotation about Z, which rolls a wheel towards -X: the front of the car.
export function makeFinalDrive(rC = 1.2, [NP, NC] = CAR.final, { pinionMat, crownMat, crownBore = 0.62, face = 0.3 } = {}) {
  const group = new THREE.Group(), m = (2 * rC) / NC, rP = (m * NP) / 2;
  const gP = Math.atan(NP / NC), gC = Math.atan(NC / NP), F = face * Math.hypot(rP, rC);
  const wP = F * Math.cos(gP), wC = F * Math.cos(gC);
  const pinion = gear(NP, m, wP, pinionMat || gearMat(COL.main), { taper: gP, bore: 0.12 }); pinion.position.x = -rC + wP / 2; group.add(pinion);
  const crownSpin = new THREE.Group(); group.add(crownSpin);
  const crown = gear(NC, m, wC, crownMat || gearMat(COL.brass), { taper: gC, bore: rC * crownBore }); crown.rotation.y = Math.PI / 2; crown.position.z = rP - wC / 2; crownSpin.add(crown);
  const set = (thP) => { pinion.rotation.x = thP; const phi = Math.PI / 2 + Math.PI / NC + ((thP - Math.PI / 2) * NP) / NC; crownSpin.rotation.z = phi; return phi; };
  set(0);
  // The pinion angle that meshes with a crown held at angle phi.
  const pinionFor = (phi) => Math.PI / 2 + ((phi - Math.PI / 2 - Math.PI / NC) * NC) / NP;
  return { group, pinion, crownSpin, crown, rP, rC, wC, wP, set, pinionFor, ratio: NC / NP };
}
