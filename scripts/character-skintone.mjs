import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const client = new Client({ name: "character-skintone", version: "0" });
await client.connect(new StdioClientTransport({ command: "node", args: ["dist/index.js"], env: process.env }));
const call = async (name, args = {}) => {
  const res = await client.callTool({ name, arguments: args }, undefined, { timeout: 150_000 });
  return JSON.parse(res.content[0].text);
};

const SKIN = "#E8B48C";
const SHIRT = "#4A7FBF";
const OUTLINE = "#5C3A21";
const STROKE_W = 3;

// Each part: layer name, symbol name, fill color, shape type, bounding box.
const parts = [
  { name: "LeftLeg",  fill: SKIN,  shape: "rect", box: [360, 350, 400, 480] },
  { name: "RightLeg", fill: SKIN,  shape: "rect", box: [400, 350, 440, 480] },
  { name: "Torso",    fill: SHIRT, shape: "rect", box: [350, 200, 450, 350] },
  { name: "LeftArm",  fill: SKIN,  shape: "rect", box: [280, 210, 350, 330] },
  { name: "RightArm", fill: SKIN,  shape: "rect", box: [450, 210, 520, 330] },
  { name: "Head",     fill: SKIN,  shape: "oval", box: [350, 100, 450, 200] },
];

const partScript = parts
  .map(
    (p) => `
log("layer: ${p.name}");
var layer_${p.name} = tl.addNewLayer("${p.name}", "normal", false);
tl.setSelectedLayers(layer_${p.name});
doc.selectNone();
doc.${p.shape === "oval" ? "addNewOval" : "addNewRectangle"}({left:${p.box[0]}, top:${p.box[1]}, right:${p.box[2]}, bottom:${p.box[3]}}${p.shape === "oval" ? ", false" : ", 8"});
doc.selectAll();
doc.setCustomFill({style:"solid", color:"${p.fill}"});
doc.setCustomStroke({style:"solid", thickness:${STROKE_W}, color:"${OUTLINE}"});
doc.convertToSymbol("graphic", "${p.name}", "center");
log("  drawn (fill ${p.fill}, outline ${OUTLINE}) + converted to symbol '${p.name}'");`,
  )
  .join("\n");

const result = await call("animate_exec", {
  project: "character-skintone",
  timeout_seconds: 150,
  script: `
log("creating a fresh document for this character (not continuing old test shapes)");
var doc = fl.createDocument("timeline");
doc.width = 800; doc.height = 600;
var tl = doc.getTimeline();

${partScript}

tl.deleteLayer(0); // remove the default empty layer, only after the real ones exist
log("layers now: " + tl.layers.map(function(l){return l.name;}).join(", "));

doc.exportPNG(OUTPUT_DIR + "/character.png", true, false);
log("exported - Animate left open with this document for the next step");
`,
});
console.log(JSON.stringify(result, null, 2));
await client.close();
process.exit(0);
