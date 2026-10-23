import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const client = new Client({ name: "animate-mcp-test", version: "0" });
await client.connect(new StdioClientTransport({ command: "node", args: ["dist/index.js"], env: process.env }));
const call = async (name, args = {}) => {
  const res = await client.callTool({ name, arguments: args }, undefined, { timeout: 120_000 });
  return JSON.parse(res.content[0].text);
};

console.log("STATUS:", JSON.stringify(await call("animate_status"), null, 2).slice(0, 300));

const result = await call("animate_exec", {
  project: "mcp-smoke-test",
  script: `
log("starting");
var doc = fl.createDocument("timeline");
doc.addNewRectangle({left:150, top:150, right:450, bottom:350}, 20);
doc.exportPNG(OUTPUT_DIR + "/smoke-test.png", true, true);
log("exported png");
`,
});
console.log("EXEC RESULT:", JSON.stringify(result, null, 2));

await client.close();
process.exit(0);
