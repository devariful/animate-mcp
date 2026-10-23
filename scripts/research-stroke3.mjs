import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const client = new Client({ name: "stroke-research3", version: "0" });
await client.connect(new StdioClientTransport({ command: "node", args: ["dist/index.js"], env: process.env }));
const call = async (name, args = {}) => {
  const res = await client.callTool({ name, arguments: args }, undefined, { timeout: 90_000 });
  return JSON.parse(res.content[0].text);
};

const result = await call("animate_exec", {
  project: "brush-research",
  timeout_seconds: 60,
  script: `
var doc = fl.createDocument("timeline"); // deliberately fresh, not getDoc(), to isolate this test
doc.setStrokeColor("#5C3A21");
doc.setFillColor("#E8B48C");
doc.addNewOval({left:50, top:50, right:150, bottom:150}, false);
doc.selectAll();
doc.setCustomStroke({style:"solid", thickness:4, color:"#5C3A21"});
var s = doc.getCustomStroke();
for (var k in s) { log("after setCustomStroke, stroke." + k + " = " + s[k]); }
doc.exportPNG(OUTPUT_DIR + "/stroketest3.png", true, false);
log("exported");
`,
});
console.log(JSON.stringify(result, null, 2));
await client.close();
process.exit(0);
