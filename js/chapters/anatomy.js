// Chapter 1: take a five-speed manual gearbox apart. Three shafts, every gear pair always in mesh.
import { THREE, M, exploder, approach, clamp } from '../kit.js';
import { makeGearbox, fit, isNarrow, trim, T, K0, ratioOf, CD, X, IDLER, CENTRE_MM, TAU, fmt } from '../gearbox.js';

const Y0 = 5.5;                              // height of the main shaft in the scene
const SHOWN = 1 / 40;                        // everything turns 40 times slower than real

export default {
  id: 'anatomy',
  short: 'Inside a gearbox',
  title: 'Inside a manual gearbox',
  subtitle: 'Three shafts, thirteen gears that never unmesh, and three sliding collars.',
  view: fit([-0.4, Y0 + 0.2, 0], [0.42, 0.32, 1], 16.5, 9.8, { top: 0.16, shiftX: 2.3 }),
  learn: `<p>Open a classic rear-wheel-drive gearbox and you find <b>three shafts</b>. The <b>input shaft</b> (amber) comes from the clutch and ends in one small gear. That gear drives the <b>layshaft</b> (violet) below it, a single solid bar with a row of gears cut along it. Whenever the input turns, the whole layshaft turns.</p>
    <p>Above the layshaft lies the <b>main shaft</b> (blue), which goes out to the wheels. Its gears (silver) are the surprise: each one is <b>always in mesh</b> with its partner below, but it rides on the shaft like a ring on a finger. It spins freely and drives nothing. This is called a <b>constant-mesh</b> gearbox.</p>
    <p>To pick a gear, a red <b>sliding collar</b> is pushed sideways until it grips the little teeth on the side of one free gear. The collar is splined to the main shaft, so now that gear and the shaft must turn together. Three collars cover five forward gears and reverse. Each is moved by a green <b>selector fork</b> on a rod, and the <b>gear lever</b> picks a rod and pushes it.</p>
    <p>The tooth counts here are from a real five-speed (the notes in the code say which). Leave the box in neutral and look: every silver gear turns at a different speed, and the output shaft sits still.</p>
    <p class="tip"><b>Try it:</b> pull the gearbox apart, then rev the engine. Which free gear spins fastest? Why does the smallest one on the main shaft win?</p>`,
  terms: [
    { t: 'Input shaft', d: 'The shaft the clutch turns. It carries one gear, which drives the layshaft.' },
    { t: 'Layshaft', d: 'Also called the countershaft. One solid cluster of gears that turns whenever the input shaft turns.' },
    { t: 'Main shaft', d: 'The output shaft, in line with the input shaft. Its gears spin freely until a collar locks one of them to it.' },
    { t: 'Constant mesh', d: 'A gearbox whose gear pairs stay meshed all the time. You change gear by locking a different gear to its shaft.' },
    { t: 'Sliding collar', d: 'A toothed sleeve, also called a dog clutch, that slides along a hub on the shaft to grip a gear.' },
    { t: 'Selector fork', d: 'A forked arm that sits in a groove in the collar and slides it when the gear lever moves its rod.' },
  ],
  defaults: { explode: 0, rpm: 1500, shell: false },
  controls: [
    { key: 'explode', type: 'range', label: 'Take it apart', min: 0, max: 1, step: 0.01, ends: ['together', 'exploded'], fmt: (v) => Math.round(v * 100) + '%' },
    { key: 'rpm', type: 'range', label: 'Engine speed (in neutral)', min: 0, max: 4000, step: 50, ends: ['stopped', '4,000 rpm'], fmt: (v) => fmt(v) + ' rpm' },
    { key: 'shell', type: 'toggle', label: 'Solid aluminium casing', hint: 'Off: the casing is drawn as glass so you can see in.' },
  ],
  quiz: [
    { q: 'The engine is running, the clutch is up and the gearbox is in neutral. What is turning inside?', options: ['Nothing at all', 'Only the input shaft', 'The input shaft, the layshaft and every free gear, but not the main shaft', 'Everything, including the main shaft'], answer: 2, why: 'All the pairs are always in mesh, so every gear spins. No collar is gripping a gear, so none of them can turn the main shaft.' },
    { q: 'What does a sliding collar do?', options: ['It pushes two gears into mesh', 'It locks one free-spinning gear to the main shaft', 'It disconnects the engine', 'It oils the gears'], answer: 1, why: 'The gears are already meshed. The collar is splined to the shaft and slides over the small teeth on the side of a gear, so the two turn as one.' },
    { q: 'The input gear has 22 teeth and the layshaft gear it drives has 31. How do their speeds compare?', options: ['The layshaft turns 1.41 times faster', 'The layshaft turns 1.41 times slower, and the other way', 'They turn at the same speed', 'The layshaft turns 9 times slower'], answer: 1, why: '31 ÷ 22 = 1.41. The bigger gear turns slower, and two gears in mesh always turn in opposite directions.' },
  ],
  reel: [
    { ms: 5600, caption: 'A manual gearbox has three shafts, and every gear pair inside it is always in mesh.', set: { rpm: 1500, shell: false }, anim: { explode: [0, 0.9] }, view: fit([-0.4, Y0 + 0.3, 0], [0.9, 0.35, 1], 10.4, 11), spin: 0.5 },
  ],

  build({ stage }) {
    const gb = makeGearbox();
    gb.group.position.y = Y0; stage.root.add(gb.group);
    const setExplode = exploder([
      { obj: gb.inAsm, off: [-1.7, 0, 0] },
      { obj: gb.layAsm, off: [0, -1.5, 0] },
      { obj: gb.idlerAsm, off: [0, -0.9, 1.9] },
      { obj: gb.selAsm, off: [0, 1.9, 0] },
      { obj: gb.caseAsm, off: [0, 0, -1.2] },
    ]);
    const L = (text, parent, pos, cls) => stage.label(text, pos, parent, cls);
    const main = [
      L('Input shaft, from the clutch', gb.inAsm, [-5.2, 0.9, 0], 'hot'),
      L('Layshaft: one solid cluster', gb.layAsm, [-1.6, -CD - 1.5, 0.4]),
      L('Main shaft, to the wheels', gb.mainAsm, [4.6, 1.15, 0], 'hot'),
      L('Gear lever', gb.selAsm, [X.lever + 0.2, 4.95, 0]),
    ];
    const more = [
      L('Sliding collar', gb.mainAsm, [X.hubB, -0.05, 1.0]),
      L('Free gears: they spin on the shaft', gb.mainAsm, [-0.9, 1.25, 1.3]),
      L('Selector forks and rods', gb.selAsm, [-1.9, 2.3, 0.3]),
      L('Reverse idler', gb.idlerAsm, [X.R + 0.2, IDLER.y - 0.9, IDLER.z + 0.3]),
      L('Bell housing: the clutch lives here', gb.caseAsm, [-5.2, -2.9, 1.6]),
    ];
    let thIn = 0, rpm = 0;
    return {
      update(dt, s) {
        dt = Math.max(0, dt);
        setExplode(s.explode);
        rpm = approach(rpm, s.rpm, 3, dt);
        thIn += (rpm / 60) * TAU * SHOWN * dt;
        gb.pose(thIn, 0, [0, 0, 0], 0);
        gb.setPath('N', 0.5, rpm > 20);
        const op = s.shell ? clamp(0.97 - s.explode * 3, 0.1, 0.97) : 0.1 * (1 - s.explode * 0.6);
        gb.caseMat.opacity = op; gb.caseMat.depthWrite = op > 0.9;
        const narrow = isNarrow();
        more.forEach((l) => { l.visible = !narrow && !(s.shell && s.explode < 0.2); });
        main.forEach((l, i) => { l.visible = !(narrow && i === 1); });
      },
      readout: (s) => trim((() => {
        const row = (g) => `<div class="row"><span>${g === 'R' ? 'Reverse' : g + (['', 'st', 'nd', 'rd', 'th', 'th'][g])}</span><b>${g === 4 ? 'direct, 1.000' : `${T[g][0]} → ${T[g][1]} teeth, ${Math.abs(ratioOf(g)).toFixed(3)}`}</b></div>`;
        return `<div class="big">${s.rpm < 20 ? 'Engine stopped' : `Neutral: output shaft still`}</div>
          <div class="row"><span>Input → layshaft</span><b>${T.drive[0]} → ${T.drive[1]} teeth, ${K0.toFixed(3)}</b></div>
          ${[1, 2, 3, 4, 5, 'R'].map(row).join('')}
          <div class="row"><span>Layshaft now</span><b>${fmt(s.rpm / K0)} rpm</b></div>`;
      })(), 4),
    };
  },
};
