// Writes js/moves3d.js: the 3D moves the game draws its stick men with
// (one stick plan step F), sampled from Quaternius's Universal Animation
// Library 1 and 2 (CC0). The .glb files stay outside the repo.
//
// Run: node tools/moves3d_extract.mjs <UAL1_Standard.glb> <UAL2_Standard.glb>
//
// Each move's joints are sampled MOVES3D_FPS times a second as world
// positions in metres (y up, the figure facing +z, standing on y 0),
// rounded to the centimetre, one flat [x, y, z, x, y, z, ...] list a frame
// in MOVE_JOINTS' order. Adapted from glbpose.mjs (ideas/reference/ual-tools
// outside the repo).

import fs from 'fs';

const FPS = 12;
const MOVES = ['Idle_Loop', 'Walk_Loop', 'Crouch_Idle_Loop', 'Crouch_Fwd_Loop', 'Hit_Head', 'Hit_Chest', 'Death01', 'Punch_Cross'];
const JOINTS = {
  head: 'Head', neck: 'neck_01', chest: 'spine_03', pelvis: 'pelvis',
  elL: 'lowerarm_l', haL: 'hand_l', elR: 'lowerarm_r', haR: 'hand_r',
  knL: 'calf_l', ftL: 'foot_l', knR: 'calf_r', ftR: 'foot_r',
};

const NC = { SCALAR: 1, VEC3: 3, VEC4: 4, MAT4: 16 };
const qmul = (a, b) => [a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1], a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0], a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3], a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];
const qrot = (q, v) => { const p = qmul(qmul(q, [...v, 0]), [-q[0], -q[1], -q[2], q[3]]); return [p[0], p[1], p[2]]; };
const lerp = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);
function slerp(a, b, t) {
  let d = a[0]*b[0]+a[1]*b[1]+a[2]*b[2]+a[3]*b[3];
  if (d < 0) { b = b.map(x => -x); d = -d; }
  const r = a.map((x, i) => x + (b[i] - x) * t), m = Math.hypot(...r);
  return r.map(x => x / m);
}

// The moves in one .glb file that MOVES asks for: name -> frames.
function sample(file) {
  const buf = fs.readFileSync(file);
  const jlen = buf.readUInt32LE(12);
  const j = JSON.parse(buf.slice(20, 20 + jlen).toString());
  const bin = buf.slice(20 + jlen + 8);
  const acc = (i) => {
    const a = j.accessors[i], bv = j.bufferViews[a.bufferView], n = NC[a.type];
    const off = (bv.byteOffset || 0) + (a.byteOffset || 0), stride = bv.byteStride || n * 4, out = [];
    for (let k = 0; k < a.count; k++) {
      const v = [];
      for (let c = 0; c < n; c++) v.push(bin.readFloatLE(off + k * stride + c * 4));
      out.push(n === 1 ? v[0] : v);
    }
    return out;
  };
  const parent = {};
  j.nodes.forEach((n, i) => (n.children || []).forEach(c => { parent[c] = i; }));
  const idx = {};
  j.nodes.forEach((n, i) => { idx[n.name] = i; });
  const result = {};
  for (const an of j.animations) {
    if (!MOVES.includes(an.name)) continue;
    const ch = an.channels.map(c => {
      const s = an.samplers[c.sampler];
      return { node: c.target.node, path: c.target.path, t: acc(s.input), v: acc(s.output), interp: s.interpolation };
    });
    const dur = Math.max(...ch.map(c => c.t[c.t.length - 1]));
    const count = Math.max(1, Math.round(dur * FPS));
    const frames = [];
    for (let f = 0; f < count; f++) {
      const time = f / FPS;
      const trs = j.nodes.map(nd => ({ t: nd.translation || [0, 0, 0], r: nd.rotation || [0, 0, 0, 1], s: nd.scale || [1, 1, 1] }));
      for (const c of ch) {
        const k = c.t.findIndex(x => x > time);
        let v;
        if (k === -1) v = c.v[c.v.length - 1];
        else if (k === 0) v = c.v[0];
        else {
          const u = (time - c.t[k - 1]) / (c.t[k] - c.t[k - 1]);
          v = c.interp === 'STEP' ? c.v[k - 1] : c.path === 'rotation' ? slerp(c.v[k - 1], c.v[k], u) : lerp(c.v[k - 1], c.v[k], u);
        }
        trs[c.node][c.path === 'translation' ? 't' : c.path === 'rotation' ? 'r' : 's'] = v;
      }
      const world = {};
      const W = (i) => {
        if (world[i]) return world[i];
        const l = trs[i];
        let w;
        if (parent[i] === undefined) w = { p: l.t, q: l.r, s: l.s };
        else {
          const P = W(parent[i]);
          w = { p: P.p.map((x, a) => x + qrot(P.q, l.t.map((y, b) => y * P.s[b]))[a]), q: qmul(P.q, l.r), s: P.s.map((x, a) => x * l.s[a]) };
        }
        return (world[i] = w);
      };
      frames.push(Object.values(JOINTS).flatMap(name => W(idx[name]).p.map(x => Math.round(x * 100) / 100)));
    }
    result[an.name] = { ms: Math.round(dur * 1000), frames };
  }
  return result;
}

const [ual1, ual2] = process.argv.slice(2);
const moves = { ...sample(ual2), ...sample(ual1) };
const missing = MOVES.filter(m => !moves[m]);
if (missing.length) throw new Error('missing moves: ' + missing.join(', '));
const body = MOVES.map(m => '  ' + m + ': { ms: ' + moves[m].ms + ', frames: ' + JSON.stringify(moves[m].frames) + ' },').join('\n');
fs.writeFileSync(new URL('../js/moves3d.js', import.meta.url), `// The 3D moves the stick men are drawn with (one stick plan step F):
// Quaternius's Universal Animation Library 1 and 2 (CC0), sampled by
// tools/moves3d_extract.mjs; generated, don't edit by hand. Each move has
// its length in ms and its frames, MOVES3D_FPS a second: one flat list of
// joint positions in metres (y up, the figure facing +z, feet on y 0) a
// frame, three numbers a joint in MOVE_JOINTS' order. figure3d.js reads
// it. Data only.

export const MOVES3D_FPS = ${FPS};
export const MOVE_JOINTS = ${JSON.stringify(Object.keys(JOINTS))};
export const MOVES3D = {
${body}
};
`);
console.log(MOVES.map(m => m + ' ' + moves[m].frames.length + ' frames ' + moves[m].ms + ' ms').join('\n'));
