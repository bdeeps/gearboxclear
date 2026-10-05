// Chapter 3: the power path. Pick a gear and follow the glowing parts from clutch to propeller shaft.
import { THREE, approach, clamp } from '../kit.js';
import { makeGearbox, fit, isNarrow, trim, T, K0, ratioOf, etaOf, gearName, torqueAt, speedAt, CD, X, IDLER, KMH, TAU, fmt } from '../gearbox.js';

const Y0 = 5.5, SHOWN = 1 / 40;
const formula = (g) => (g === 'N' ? 'no collar engaged' : g === 4 ? 'collar grips the input gear: 1.000' : `${T.drive[1]}/${T.drive[0]} × ${T[g][1]}/${T[g][0]} = ${Math.abs(ratioOf(g)).toFixed(3)}`);
const G = (v) => (/^\d$/.test(String(v)) ? +v : v);

export default {
  id: 'path',
  short: 'The power path',
  title: 'Follow the power through each gear',
  subtitle: 'The lever slides one collar, the collar locks one gear, and the glow shows the route.',
  view: fit([-0.4, Y0 + 0.2, 0], [0.4, 0.34, 1], 16.5, 9.8, { top: 0.16, shiftX: 2.3 }),
  learn: `<p>Pick a gear and watch what the lever really does. It never moves a gear. It moves a <b>selector rod</b>, whose fork slides a red <b>collar</b> onto the side of one free gear. From that instant the gear is locked to the main shaft, and the parts that carry the engine's twist light up.</p>
    <p><b>First to third, and fifth:</b> the power goes down from the input gear to the layshaft, along it, then back up through the chosen pair. Two meshes, so two ratios multiply. First is 31/22 × 33/14 = <b>3.32</b>: the engine turns 3.32 times for each turn of the output, and the twist is multiplied 3.32 times (less a few percent lost as heat).</p>
    <p><b>Fourth is direct.</b> The collar grips the input gear itself, so the input and main shafts become one bar: <b>1 to 1</b>, with no teeth carrying load. The layshaft still spins, but idly. <b>Fifth is an overdrive</b>: a big layshaft gear drives a small one, so the output turns <i>faster</i> than the engine (0.86) for relaxed, frugal cruising.</p>
    <p><b>Reverse</b> adds a third gear, the yellow <b>idler</b>, between the pair. Two gears in mesh turn opposite ways, so one extra gear flips the output backwards. Reverse gears are usually <b>straight-cut</b>: cheap and strong, but their teeth meet all at once, which makes the whine you hear when backing up. The forward gears are <b>helical</b>, with slanted teeth that slide into contact a little at a time, so they run quietly.</p>
    <p class="tip"><b>Try it:</b> go from 3rd to 4th and see the layshaft stop glowing. Then pick reverse and trace the three gears that turn the output the other way.</p>`,
  terms: [
    { t: 'Gear ratio', d: 'Turns of the input shaft for one turn of the output shaft. It is worked out from tooth counts: driven teeth ÷ driving teeth, multiplied along the path.' },
    { t: 'Direct drive', d: 'A gear where the input and output shafts are locked together and turn at the same speed: here, fourth.' },
    { t: 'Overdrive', d: 'A gear whose ratio is below 1, so the output turns faster than the engine: here, fifth at 0.864.' },
    { t: 'Idler gear', d: 'An extra gear between two others. It does not change the ratio, only the direction.' },
    { t: 'Helical gear', d: 'A gear with slanted teeth. They take up the load gradually, so they are quiet.' },
    { t: 'H-pattern', d: 'The shape the gear lever moves in: across to pick a selector rod, then forward or back to slide its collar.' },
  ],
  defaults: { gear: 1, rpm: 2500, only: false },
  onChange(s) { s.gear = G(s.gear); },
  controls: [
    { key: 'gear', type: 'seg', label: 'Gear lever', options: ['R', 'N', 1, 2, 3, 4, 5].map((v) => ({ v: String(v), label: String(v) })), fmt: (v) => gearName(G(v)) },
    { key: 'rpm', type: 'range', label: 'Engine speed', min: 800, max: 6500, step: 50, ends: ['idle', 'redline'], fmt: (v) => fmt(v) + ' rpm' },
    { key: 'only', type: 'toggle', label: 'Fade everything except the power path' },
  ],
  quiz: [
    { q: 'In fourth gear of this gearbox, which gear teeth carry the engine’s power?', options: ['The fourth gear pair', 'The input pair and the fourth pair', 'None: the collar joins the input shaft straight to the main shaft', 'The reverse idler'], answer: 2, why: 'Fourth is direct drive. The collar locks the main shaft to the input gear, so the two shafts turn as one and the layshaft just idles.' },
    { q: 'First gear uses 22 → 31 teeth, then 14 → 33 teeth. What is its ratio?', options: ['1.41', '2.36', '3.32', '6.00'], answer: 2, why: '31 ÷ 22 = 1.409 and 33 ÷ 14 = 2.357. The power passes through both pairs, so multiply them: 3.32.' },
    { q: 'Why does the output shaft turn backwards in reverse?', options: ['The engine runs backwards', 'An extra idler gear sits between the pair and flips the direction', 'The collar spins the other way', 'The layshaft stops'], answer: 1, why: 'Each mesh reverses the direction of rotation. Forward gears use two meshes; reverse uses three, so the output ends up turning the other way.' },
  ],
  reel: [
    { ms: 5600, caption: 'Push the lever and a collar slides sideways, locking one free-spinning gear to the output shaft.', set: { rpm: 2500, only: false }, anim: { gear: ['N', '1'] }, view: fit([-0.6, Y0 + 0.3, 0], [0.3, 0.3, 1], 9.5, 8.6), spin: 0.25 },
    { ms: 5600, caption: 'Fourth gear is direct: the two shafts lock into one bar and no gear teeth carry the load.', set: { rpm: 3000, only: true }, anim: { gear: ['3', '4'] }, view: fit([-1.2, Y0 - 0.3, 0], [0.5, 0.3, 1], 8.4, 7), spin: 0.25 },
  ],

  build({ stage }) {
    const gb = makeGearbox();
    gb.group.position.y = Y0; stage.root.add(gb.group);
    gb.caseMat.opacity = 0.06;
    Object.values(gb.mats).forEach((m) => { m.transparent = true; });
    const L = (text, parent, pos, cls) => stage.label(text, pos, parent, cls);
    const lIn = L('', gb.group, [-5.3, 1.0, 0], 'hot'), lOut = L('', gb.group, [4.7, 1.2, 0], 'hot'), lLay = L('', gb.group, [-3.3, -CD - 1.6, 0.4]);
    const lGear = L('', gb.group, [0, 2.6, 0]), lIdler = L('Idler: flips the direction', gb.group, [X.R + 0.3, IDLER.y - 1.0, IDLER.z + 0.3]);
    const lColl = L('', gb.group, [0, -0.2, 1.1]);
    let thIn = 0, thOut = 0, rpm = 2500, out = 0, done = false;
    const state = { out: 0 };
    return {
      update(dt, s) {
        dt = Math.max(0, dt);
        const g = G(s.gear);
        rpm = approach(rpm, s.rpm, 4, dt);
        done = gb.shiftStep(g, dt, 2.2);
        const now = gb.engaged(), pr = gb.progress(g);
        // Once the collar's synchro ring touches (about a third of the travel), the two speeds are pulled together.
        if (g !== 'N' && pr > 0.3) out = approach(out, rpm / ratioOf(g), now === g ? 30 : 7, dt);
        else out = approach(out, 0, 0.5, dt);
        state.out = out;
        thIn += (rpm / 60) * TAU * SHOWN * dt; thOut += (out / 60) * TAU * SHOWN * dt;
        gb.pose(thIn, thOut);
        gb.setPath(now, 0.85);
        Object.values(gb.mats).forEach((m) => { m.opacity = s.only && m.emissiveIntensity === 0 ? 0.14 : 1; m.depthWrite = m.opacity > 0.5; });
        const narrow = isNarrow();
        lIn.element.textContent = `In: ${fmt(rpm)} rpm`;
        lOut.element.textContent = `Out: ${fmt(Math.abs(out))} rpm${out < -1 ? ', backwards' : ''}`;
        lLay.element.textContent = `Layshaft: ${fmt(rpm / K0)} rpm${now === 4 ? ', idling' : ''}`;
        lLay.visible = !narrow;
        lIdler.visible = now === 'R' && !narrow;
        const show = now !== 'N' && now !== 4 && !narrow;
        lGear.visible = show;
        if (show) { lGear.position.set(X[now], gb.free[now].main.userData.rp + 0.75, 0); lGear.element.textContent = `${gearName(now)} gear: ${T[now][0]} → ${T[now][1]} teeth`; }
        lColl.visible = !narrow && g !== 'N';
        if (g !== 'N') { const h = gb.hubs[{ 1: 1, 2: 1, 3: 0, 4: 0, 5: 2, R: 2 }[g]]; lColl.position.set(h.sleeve.position.x, -0.15, 1.15); lColl.element.textContent = now === g ? 'Collar locked' : 'Collar sliding'; }
      },
      readout: (s) => trim((() => {
        const g = gb.engaged(), want = G(s.gear), r = ratioOf(g);
        if (g === 'N') return `<div class="big">${want === 'N' ? 'Neutral' : 'Changing gear…'}</div>
          <div class="row"><span>Input shaft</span><b>${fmt(s.rpm)} rpm</b></div>
          <div class="row"><span>Layshaft</span><b>${fmt(s.rpm / K0)} rpm</b></div>
          <div class="row"><span>Output shaft</span><b>${fmt(Math.abs(state.out))} rpm, no drive</b></div>
          Every gear is turning, but no collar is gripping one.`;
        const tq = torqueAt(s.rpm), tOut = tq * Math.abs(r) * etaOf(g);
        const others = [1, 2, 3, 5].filter((k) => k !== g).map((k) => `${k}: ${fmt(s.rpm / ratioOf(k))}`).join(', ');
        return `<div class="big">${gearName(g)}: ${Math.abs(r).toFixed(3)} to 1${g === 'R' ? ', backwards' : ''}</div>
          <div class="row"><span>From the teeth</span><b>${formula(g)}</b></div>
          <div class="row"><span>Input shaft</span><b>${fmt(s.rpm)} rpm</b></div>
          <div class="row"><span>Output shaft</span><b>${fmt(s.rpm / Math.abs(r))} rpm</b></div>
          <div class="row"><span>Twist in (full throttle)</span><b>${fmt(tq)} N·m</b></div>
          <div class="row"><span>Twist out</span><b>${fmt(tOut)} N·m (${Math.round(etaOf(g) * 100)}% efficient)</b></div>
          <div class="row"><span>Road speed</span><b>${fmt(speedAt(s.rpm, g) * KMH)} km/h</b></div>
          <div class="row"><span>Free gears now (rpm)</span><b>${others}</b></div>`;
      })()),
    };
  },
};
