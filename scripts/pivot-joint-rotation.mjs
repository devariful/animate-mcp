import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const client = new Client({ name: "pivot-research2", version: "0" });
await client.connect(new StdioClientTransport({ command: "node", args: ["dist/index.js"], env: process.env }));
const call = async (name, args = {}) => {
  const res = await client.callTool({ name, arguments: args }, undefined, { timeout: 90_000 });
  return JSON.parse(res.content[0].text);
};

const result = await call("animate_exec", {
  project: "rigging-research",
  timeout_seconds: 60,
  script: `
var doc = fl.createDocument("timeline");
doc.width = 400; doc.height = 400;
doc.addNewRectangle({left:100, top:190, right:300, bottom:210}, 0); // 200x20 horizontal arm, left end at x=100
doc.setSelectionRect({left:100, top:190, right:300, bottom:210}, true);
doc.convertToSymbol("graphic", "Arm", "center left"); // registration at the LEFT-center = the shoulder end
log("converted with registration 'center left'");

doc.setSelectionRect({left:100, top:190, right:300, bottom:210}, true);
var inst = doc.selection[0];
log("instance x=" + inst.x + " y=" + inst.y + " (should read ~100,200 - the left end - if registration worked)");
doc.exportPNG(OUTPUT_DIR + "/pivot2-before.png", true, false);

inst.rotation = 45;
doc.exportPNG(OUTPUT_DIR + "/pivot2-after.png", true, false);
log("rotated 45deg, exported");
`,
});
console.log(JSON.stringify(result, null, 2));
await client.close();
process.exit(0);
