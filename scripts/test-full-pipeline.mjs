import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const client = new Client({ name: "full-pipeline-test", version: "0" });
await client.connect(new StdioClientTransport({ command: "node", args: ["dist/index.js"], env: process.env }));
const call = async (name, args = {}) => {
  const res = await client.callTool({ name, arguments: args }, undefined, { timeout: 150_000 });
  return JSON.parse(res.content[0].text);
};

console.log("1. exec: build an animated scene (ball moves + grows)");
const exec = await call("animate_exec", {
  project: "demo-anim",
  timeout_seconds: 120,
  script: `
var doc = fl.createDocument("timeline");
doc.width = 800; doc.height = 450;
var tl = doc.getTimeline();
doc.addNewOval({left:50, top:175, right:150, bottom:275}, false);
doc.selectAll();
doc.convertToSymbol("graphic", "Ball", "center");

tl.insertKeyframe(36);
doc.currentFrame = 35;
doc.selectAll();
var inst = doc.selection[0];
inst.x += 600;
inst.scaleX = 1.8;
inst.scaleY = 1.8;

tl.layers[0].frames[0].tweenType = "motion";
log("built: ball moves right and grows over 36 frames");

doc.exportPNG(OUTPUT_DIR + "/demo.png", true, false);
log("exported frame sequence");
`,
});
console.log(JSON.stringify(exec, null, 2));

console.log("\\n2. assemble into video");
const assembled = await call("animate_assemble_video", {
  project: "demo-anim",
  base_name: "demo",
  fps: 24,
  output_name: "ball-demo",
});
console.log(JSON.stringify(assembled, null, 2));

await client.close();
process.exit(0);
