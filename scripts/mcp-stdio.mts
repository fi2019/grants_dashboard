/**
 * Run the Forge Grants MCP server over stdio, for Claude Desktop or Claude Code:
 *   npm run mcp
 * Claude Desktop config (claude_desktop_config.json):
 *   { "mcpServers": { "forge-grants": { "command": "npm", "args": ["run", "--silent", "mcp", "--prefix", "/path/to/grants_dashboard"] } } }
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createForgeMcpServer } from "../src/lib/mcp/server.ts";

await createForgeMcpServer().connect(new StdioServerTransport());
