import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const client = new Client({ name: "pingpong-v2", version: "0" });
await client.connect(new StdioClientTransport({ command: "node", args: ["dist/index.js"], env: process.env }));
const call = async (name, args = {}) => {
  const res = await client.callTool({ name, arguments: args }, undefined, { timeout: 240_000 });
  return JSON.parse(res.content[0].text);
};

console.log("1. exec: 5s ping pong bounce with squash/stretch + easing");
const exec = await call("animate_exec", {
  project: "pingpong-v2",
  timeout_seconds: 220,
  script: `
var doc = fl.createDocument("timeline");
doc.width = 800; doc.height = 450;
var tl = doc.getTimeline();

doc.addNewOval({left:40, top:310, right:80, bottom:350}, false);
doc.selectAll();
doc.convertToSymbol("graphic", "Ball", "center");

var frames = [0,15,30,45,60,75,90,105,119];
var xs    = [60,145,230,315,400,485,570,655,740];
var ys    = [330,100,330,100,330,100,330,100,330];
// Squash (wide/short) at ground contacts, round/normal at the peaks - the textbook squash-and-stretch pose pair.
var sx    = [1.3,1,  1.3,1,  1.3,1,  1.3,1,  1.3];
var sy    = [0.65,1, 0.65,1, 0.65,1, 0.65,1, 0.65];

for (var i = 1; i < frames.length; i++) {
  tl.insertKeyframe(frames[i]);
  doc.currentFrame = frames[i];
  doc.selectAll();
  var inst = doc.selection[0];
  inst.x = xs[i];
  inst.y = ys[i];
  inst.scaleX = sx[i];
  inst.scaleY = sy[i];
}
log("placed " + frames.length + " keyframes with squash/stretch poses");

// Set the initial pose (frame 0) to the squashed ground pose too, matching the others.
doc.currentFrame = 0;
doc.selectAll();
doc.selection[0].scaleX = sx[0];
doc.selection[0].scaleY = sy[0];

// Ease out (positive) going UP off the ground (decelerating against gravity), ease in (negative) coming DOWN
// (accelerating back toward the ground) - alternating by segment.
for (var j = 0; j < frames.length - 1; j++) {
  tl.layers[0].frames[frames[j]].tweenType = "motion";
  tl.layers[0].frames[frames[j]].tweenEasing = (j % 2 === 0) ? 100 : -100;
}
log("tweens + easing set, frameCount=" + tl.frameCount);

doc.exportPNG(OUTPUT_DIR + "/pingpong2.png", true, false);
log("exported frame sequence");
`,
});
console.log(JSON.stringify(exec, null, 2));

console.log("\\n2. assemble into a 5s video at 24fps");
const assembled = await call("animate_assemble_video", {
  project: "pingpong-v2",
  base_name: "pingpong2",
  fps: 24,
  output_name: "pingpong-v2",
});
console.log(JSON.stringify(assembled, null, 2));

await client.close();
process.exit(0);
