import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const client = new Client({ name: "continuity-test", version: "0" });
await client.connect(new StdioClientTransport({ command: "node", args: ["dist/index.js"], env: process.env }));
const call = async (name, args = {}) => {
  const res = await client.callTool({ name, arguments: args }, undefined, { timeout: 120_000 });
  return JSON.parse(res.content[0].text);
};

function timed(label, fn) {
  const t0 = Date.now();
  return fn().then((r) => { console.log(`${label}: ${((Date.now() - t0) / 1000).toFixed(1)}s`); return r; });
}

console.log("call 1: getDoc() creates a fresh doc, draw a blue circle, leave it open");
console.log(JSON.stringify(await timed("call 1", () => call("animate_exec", {
  project: "continuity-test",
  script: `
var doc = getDoc();
doc.width = 800; doc.height = 450;
doc.addNewOval({left:50, top:50, right:150, bottom:150}, false);
log("docs open: " + fl.documents.length + " - drew circle #1");
`,
})), null, 2));

console.log("\\ncall 2: getDoc() should return the SAME doc, add a second shape alongside the first");
console.log(JSON.stringify(await timed("call 2", () => call("animate_exec", {
  project: "continuity-test",
  script: `
var doc = getDoc();
doc.addNewRectangle({left:300, top:300, right:400, bottom:400}, 0);
log("docs open: " + fl.documents.length + " - added rectangle #2 alongside circle #1");
doc.exportPNG(OUTPUT_DIR + "/both.png", true, false);
`,
})), null, 2));

await client.close();
process.exit(0);
