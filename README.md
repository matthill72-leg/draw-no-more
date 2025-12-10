```markdown
# draw-no-more-mcp

A small microservice (MCP-style) to generate diagrams from Notion database file uploads.

Features:
- Poll a Notion database (or accept forwarded webhooks) for pages with a file property.
- Download uploaded diagram definition files (Mermaid .mmd/.mermaid) and PlantUML (.puml/.plantuml/.uml).
- Render Mermaid diagrams to SVG using Puppeteer.
- Render PlantUML diagrams via the PlantUML server (encoded and fetched as SVG).
- Serve generated images and attach them back to the Notion page as external images.

Getting started:
1. Copy .env.example to .env and fill in values (NOTION_TOKEN, NOTION_DATABASE_ID, PUBLIC_BASE_URL).
2. Optionally set PLANTUML_SERVER_URL to a self-hosted PlantUML server; otherwise the public server is used.
3. Install dependencies:
   npm install
4. Development:
   npm run dev
5. Build and run:
   npm run build
   npm start

API:
- POST /webhook
  - Accepts JSON events with { page_id: string } (useful if you forward Notion events via Make/Zapier).
- GET /health
  - Health check endpoint.
- GET /images/:name
  - Serves generated image files.

Notes:
- PlantUML rendering uses the configured PlantUML server (default: https://www.plantuml.com/plantuml). For production or privacy-sensitive data, self-host PlantUML or run it in your network.
- Consider uploading generated images to S3 instead of serving directly from the app for durability and scalability.
```
