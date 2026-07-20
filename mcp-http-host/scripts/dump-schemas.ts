/** Dev helper: dump each slug's tools + input schemas, to author probe calls. */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import expected from '../src/expected-tools.json' with { type: 'json' };

const BASE = process.env.PROBE_BASE ?? 'http://localhost:8080';

for (const slug of Object.keys(expected as Record<string, string[]>)) {
  const transport = new StreamableHTTPClientTransport(new URL(`${BASE}/mcp/${slug}`));
  const client = new Client({ name: 'schema-dump', version: '1.0.0' });
  await client.connect(transport);
  const { tools } = await client.listTools();
  console.log(`\n### ${slug}`);
  for (const t of tools) {
    const props = (t.inputSchema as any)?.properties ?? {};
    const required = (t.inputSchema as any)?.required ?? [];
    const fields = Object.entries(props)
      .map(([k, v]: [string, any]) => {
        const enums = v.enum ? `=${v.enum.slice(0, 6).join('|')}` : '';
        return `${k}:${v.type ?? '?'}${enums}${required.includes(k) ? '*' : ''}`;
      })
      .join(' ');
    console.log(`  ${t.name}  [${fields}]`);
  }
  await client.close();
}
