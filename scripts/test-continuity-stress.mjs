import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const client = new Client({ name: "stress-test", version: "0" });
await client.connect(new StdioClientTransport({ command: "node", args: ["dist/index.js"], env: process.env }));
const call = async (name, args = {}) => {
  const res = await client.callTool({ name, arguments: args }, undefined, { timeout: 120_000 });
  return JSON.parse(res.content[0].text);
};

for (let i = 3; i <= 7; i++) {
  const t0 = Date.now();
  const r = await call("animate_exec", {
    project: "continuity-test",
    script: `
var doc = getDoc();
doc.addNewOval({left:${50 + i * 60}, top:${150}, right:${100 + i * 60}, bottom:${200}}, false);
log("call ${i}: docs=" + fl.documents.length + " layerFrames shapes so far on stage");
`,
  });
  console.log(`call ${i}: ${((Date.now() - t0) / 1000).toFixed(1)}s ->`, JSON.stringify(r.log || r.error));
}

const final = await call("animate_exec", {
  project: "continuity-test",
  script: `
var doc = getDoc();
doc.exportPNG(OUTPUT_DIR + "/stress-final.png", true, false);
log("exported final state after 5 more calls");
`,
});
console.log("final export:", JSON.stringify(final, null, 2));

await client.close();
process.exit(0);
