import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const client = new Client({ name: "wave-hello", version: "0" });
await client.connect(new StdioClientTransport({ command: "node", args: ["dist/index.js"], env: process.env }));
const call = async (name, args = {}) => {
  const res = await client.callTool({ name, arguments: args }, undefined, { timeout: 240_000 });
  return JSON.parse(res.content[0].text);
};

const SKIN = "#E8B48C";
const SHIRT = "#4A7FBF";
const OUTLINE = "#5C3A21";
const STROKE_W = 3;
const TOTAL_FRAMES = 72; // 3s @ 24fps

// Each part: layer name, fill, shape, box, and registration point (pivot) chosen per the rigging skill:
// the pivot sits at the JOINT, not the shape's own center, so rotation looks natural.
const parts = [
  { name: "LeftLeg",  fill: SKIN,  shape: "rect", box: [360, 350, 400, 480], reg: "center" },
  { name: "RightLeg", fill: SKIN,  shape: "rect", box: [400, 350, 440, 480], reg: "center" },
  { name: "Torso",    fill: SHIRT, shape: "rect", box: [350, 200, 450, 350], reg: "center" },
  { name: "LeftArm",  fill: SKIN,  shape: "rect", box: [280, 210, 350, 330], reg: "center right" }, // shoulder at its right edge (touches torso)
  { name: "RightArm", fill: SKIN,  shape: "rect", box: [450, 210, 520, 330], reg: "center left" },  // shoulder at its left edge (touches torso) - THE WAVING ARM
  { name: "Head",     fill: SKIN,  shape: "oval", box: [350, 100, 450, 200], reg: "bottom center" }, // pivot at the neck
];

const buildScript = parts
  .map(
    (p) => `
log("building layer: ${p.name}");
var layer_${p.name} = tl.addNewLayer("${p.name}", "normal", false);
tl.currentLayer = layer_${p.name};
doc.${p.shape === "oval" ? "addNewOval" : "addNewRectangle"}({left:${p.box[0]}, top:${p.box[1]}, right:${p.box[2]}, bottom:${p.box[3]}}${p.shape === "oval" ? ", false" : ", 8"});
doc.setSelectionRect({left:${p.box[0]}, top:${p.box[1]}, right:${p.box[2]}, bottom:${p.box[3]}}, true);
doc.setCustomFill({style:"solid", color:"${p.fill}"});
doc.setCustomStroke({style:"solid", thickness:${STROKE_W}, color:"${OUTLINE}"});
doc.convertToSymbol("graphic", "${p.name}", "${p.reg}");
log("  done: fill ${p.fill}, pivot '${p.reg}'");`,
  )
  .join("\n");

const result = await call("animate_exec", {
  project: "wave-hello",
  timeout_seconds: 220,
  script: `
log("creating fresh document for the complete project");
var doc = fl.createDocument("timeline");
doc.width = 800; doc.height = 600;
var tl = doc.getTimeline();

${buildScript}

tl.deleteLayer(0);
log("layers: " + tl.layers.map(function(l){return l.name;}).join(", "));

// --- Extend every STATIC layer's content across the whole 3s so it doesn't vanish after frame 0 ---
var staticLayers = ["LeftLeg","RightLeg","Torso","LeftArm"];
for (var i = 0; i < staticLayers.length; i++) {
  var idx = -1;
  for (var j = 0; j < tl.layers.length; j++) { if (tl.layers[j].name === staticLayers[i]) { idx = j; break; } }
  tl.currentLayer = idx;
  tl.insertKeyframe(${TOTAL_FRAMES - 1});
}
log("extended static layers to frame ${TOTAL_FRAMES - 1}");

// --- Animate RightArm: a friendly wave, 3 swings, eased in/out, settling back down ---
var rightArmIdx = -1;
for (var k = 0; k < tl.layers.length; k++) { if (tl.layers[k].name === "RightArm") { rightArmIdx = k; break; } }
tl.currentLayer = rightArmIdx;
var waveFrames = [0, 12, 24, 36, 48, 60, ${TOTAL_FRAMES - 1}];
var waveRot    = [-15, 25, -20, 25, -20, 10, 0];
for (var w = 1; w < waveFrames.length; w++) {
  tl.insertKeyframe(waveFrames[w]);
  doc.currentFrame = waveFrames[w];
  tl.setSelectedLayers(rightArmIdx);
  doc.setSelectionRect({left:450, top:210, right:520, bottom:330}, true);
  if (doc.selection.length) doc.selection[0].rotation = waveRot[w];
}
// Set rotation on frame 0 too, and tween every segment with alternating ease for a lively, non-robotic swing.
doc.currentFrame = 0;
doc.setSelectionRect({left:450, top:210, right:520, bottom:330}, true);
if (doc.selection.length) doc.selection[0].rotation = waveRot[0];
for (var t = 0; t < waveFrames.length - 1; t++) {
  tl.layers[rightArmIdx].frames[waveFrames[t]].tweenType = "motion";
  tl.layers[rightArmIdx].frames[waveFrames[t]].tweenEasing = (t % 2 === 0) ? 60 : -60;
}
log("RightArm wave animated across " + waveFrames.length + " keyframes");

// --- Animate Head: a subtle tilt in time with the wave, for a touch of life ---
var headIdx = -1;
for (var m = 0; m < tl.layers.length; m++) { if (tl.layers[m].name === "Head") { headIdx = m; break; } }
tl.currentLayer = headIdx;
var headFrames = [0, 18, 42, ${TOTAL_FRAMES - 1}];
var headRot    = [0, -8, 8, 0];
for (var h = 1; h < headFrames.length; h++) {
  tl.insertKeyframe(headFrames[h]);
  doc.currentFrame = headFrames[h];
  tl.setSelectedLayers(headIdx);
  doc.setSelectionRect({left:350, top:100, right:450, bottom:200}, true);
  if (doc.selection.length) doc.selection[0].rotation = headRot[h];
}
for (var ht = 0; ht < headFrames.length - 1; ht++) {
  tl.layers[headIdx].frames[headFrames[ht]].tweenType = "motion";
}
log("Head tilt animated across " + headFrames.length + " keyframes");

// --- Verify structure before export: exactly one element per layer, correctly named ---
log("structure check:");
for (var v = 0; v < tl.layers.length; v++) {
  var el = tl.layers[v].frames[0].elements;
  log("  " + tl.layers[v].name + ": " + el.length + " element(s)");
}

doc.exportPNG(OUTPUT_DIR + "/wave.png", true, false);
log("exported " + ${TOTAL_FRAMES} + "-frame sequence");
`,
});
console.log(JSON.stringify(result, null, 2));

console.log("\\nassembling into video...");
const assembled = await call("animate_assemble_video", {
  project: "wave-hello",
  base_name: "wave",
  fps: 24,
  output_name: "subaita-waves-hello",
});
console.log(JSON.stringify(assembled, null, 2));

await client.close();
process.exit(0);
