import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const client = new Client({ name: "verify-counts", version: "0" });
await client.connect(new StdioClientTransport({ command: "node", args: ["dist/index.js"], env: process.env }));
const call = async (name, args = {}) => {
  const res = await client.callTool({ name, arguments: args }, undefined, { timeout: 90_000 });
  return JSON.parse(res.content[0].text);
};

const result = await call("animate_exec", {
  project: "character-skintone",
  timeout_seconds: 60,
  script: `
var doc = getDoc();
var tl = doc.getTimeline();
for (var i = 0; i < tl.layers.length; i++) {
  var el = tl.layers[i].frames[0].elements;
  var names = [];
  for (var j = 0; j < el.length; j++) { names.push(el[j].libraryItem ? el[j].libraryItem.name : "?"); }
  log(tl.layers[i].name + ": " + el.length + " element(s) [" + names.join(", ") + "]");
}
`,
});
console.log(JSON.stringify(result, null, 2));
await client.close();
process.exit(0);
