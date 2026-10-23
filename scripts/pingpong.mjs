import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const client = new Client({ name: "pingpong", version: "0" });
await client.connect(new StdioClientTransport({ command: "node", args: ["dist/index.js"], env: process.env }));
const call = async (name, args = {}) => {
  const res = await client.callTool({ name, arguments: args }, undefined, { timeout: 240_000 });
  return JSON.parse(res.content[0].text);
};

console.log("1. exec: build the 5s (120-frame) ping pong bounce");
const exec = await call("animate_exec", {
  project: "pingpong",
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

for (var i = 1; i < frames.length; i++) {
  tl.insertKeyframe(frames[i]);
  doc.currentFrame = frames[i];
  doc.selectAll();
  var inst = doc.selection[0];
  inst.x = xs[i];
  inst.y = ys[i];
}
log("placed " + frames.length + " keyframes");

for (var j = 0; j < frames.length - 1; j++) {
  tl.layers[0].frames[frames[j]].tweenType = "motion";
}
log("tweens set, frameCount=" + tl.frameCount);

doc.exportPNG(OUTPUT_DIR + "/pingpong.png", true, false);
log("exported frame sequence");
`,
});
console.log(JSON.stringify(exec, null, 2));

console.log("\\n2. assemble into a 5s video at 24fps");
const assembled = await call("animate_assemble_video", {
  project: "pingpong",
  base_name: "pingpong",
  fps: 24,
  output_name: "pingpong-ball",
});
console.log(JSON.stringify(assembled, null, 2));

await client.close();
process.exit(0);
