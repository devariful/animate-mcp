import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const client = new Client({ name: "character-parts-test", version: "0" });
await client.connect(new StdioClientTransport({ command: "node", args: ["dist/index.js"], env: process.env }));
const call = async (name, args = {}) => {
  const res = await client.callTool({ name, arguments: args }, undefined, { timeout: 150_000 });
  return JSON.parse(res.content[0].text);
};

// Each part: layer name, symbol name, shape fn, bounding box. Drawn in back-to-front order (legs/torso first,
// arms and head on top) by adding each new layer ABOVE the previous, since Animate layers stack with later-added
// on top by default.
const parts = [
  { name: "LeftLeg",  shape: "rect", box: [360, 350, 400, 480] },
  { name: "RightLeg", shape: "rect", box: [400, 350, 440, 480] },
  { name: "Torso",    shape: "rect", box: [350, 200, 450, 350] },
  { name: "LeftArm",  shape: "rect", box: [280, 210, 350, 330] },
  { name: "RightArm", shape: "rect", box: [450, 210, 520, 330] },
  { name: "Head",     shape: "oval", box: [350, 100, 450, 200] },
];

const partScript = parts
  .map(
    (p) => `
log("layer: ${p.name}");
var layer_${p.name} = tl.addNewLayer("${p.name}", "normal", false);
tl.setSelectedLayers(layer_${p.name});
doc.${p.shape === "oval" ? "addNewOval" : "addNewRectangle"}({left:${p.box[0]}, top:${p.box[1]}, right:${p.box[2]}, bottom:${p.box[3]}}${p.shape === "oval" ? ", false" : ", 10"});
doc.selectAll();
doc.convertToSymbol("graphic", "${p.name}", "center");
log("  drawn + converted to symbol '${p.name}'");`,
  )
  .join("\n");

const result = await call("animate_exec", {
  project: "character-parts",
  timeout_seconds: 150,
  script: `
log("creating document");
var doc = fl.createDocument("timeline");
doc.width = 800; doc.height = 600;
var tl = doc.getTimeline();

${partScript}

// deleteLayer(0) only works once more than one layer exists - Animate refuses to delete the last remaining
// layer, so removing the default "Layer_1" has to happen AFTER the real part layers are added, not before.
tl.deleteLayer(0);
log("removed default layer");

log("layers now: " + tl.layers.map(function(l){return l.name;}).join(", "));

doc.exportPNG(OUTPUT_DIR + "/character.png", true, false);
log("exported preview");
`,
});
console.log(JSON.stringify(result, null, 2));
await client.close();
process.exit(0);
