import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { createNotionClient } from './notionClient';
import { renderMermaidToSVG } from './renderer/mermaid';
import { renderPlantUMLToSVG } from './renderer/plantuml';
import { v4 as uuidv4 } from 'uuid';
import pLimit from 'p-limit';

type Options = {
  notionToken: string;
  databaseId: string;
  filePropertyName: string;
  outputDir: string;
  publicBaseUrl: string;
  maxConcurrency?: number;
};

export class NotionProcessor {
  private client: ReturnType<typeof createNotionClient>;
  private opts: Options;
  private limit: ReturnType<typeof pLimit>;

  constructor(opts: Options) {
    this.opts = opts;
    this.client = createNotionClient(opts.notionToken);
    this.limit = pLimit(opts.maxConcurrency || 3);
    if (!fs.existsSync(opts.outputDir)) fs.mkdirSync(opts.outputDir, { recursive: true });
  }

  startPolling(intervalSeconds: number) {
    if (!this.opts.databaseId) {
      console.warn('No NOTION_DATABASE_ID configured — skipping polling.');
      return;
    }
    console.log(`Starting poll every ${intervalSeconds}s for database ${this.opts.databaseId}`);
    this.pollLoop(intervalSeconds).catch((e) => console.error('Poll loop error', e));
  }

  private async pollLoop(intervalSeconds: number) {
    while (true) {
      try {
        await this.scanDatabaseAndProcess();
      } catch (err) {
        console.error('Error scanning database:', err);
      }
      await new Promise((r) => setTimeout(r, intervalSeconds * 1000));
    }
  }

  async scanDatabaseAndProcess() {
    const dbId = this.opts.databaseId;
    if (!dbId) return;
    const pages = await this.client.databases.query({ database_id: dbId });
    if (!pages.results) return;
    for (const page of pages.results) {
      const pageId = page.id;
      await this.limit(() => this.processPageById(pageId));
    }
  }

  async processPageById(pageId: string) {
    const page = await this.client.pages.retrieve({ page_id: pageId }) as any;
    const props = page.properties || {};
    const fileProp = props[this.opts.filePropertyName];
    if (!fileProp) return;
    const files = (fileProp as any).files || [];
    if (!files.length) return;

    for (const f of files) {
      const url = f.file?.url || f.external?.url;
      const name = f.name || `diagram-${uuidv4()}.mmd`;
      if (!url) continue;
      const ext = path.extname(name).toLowerCase();
      if (ext === '.mmd' || ext === '.mermaid') {
        try {
          console.log(`Processing mermaid file for page ${pageId}: ${name}`);
          await this.processMermaidFile(pageId, url, name);
        } catch (err) {
          console.error('Error processing file', name, err);
        }
      } else if (ext === '.puml' || ext === '.plantuml' || ext === '.uml') {
        try {
          console.log(`Processing plantuml file for page ${pageId}: ${name}`);
          await this.processPlantUmlFile(pageId, url, name);
        } catch (err) {
          console.error('Error processing PlantUML file', name, err);
        }
      } else {
        console.log(`Skipping unsupported extension ${ext} for file ${name}`);
      }
    }
  }

  private async downloadText(url: string): Promise<string> {
    const res = await axios.get(url, { responseType: 'text' });
    return res.data;
  }

  private async processMermaidFile(pageId: string, url: string, name: string) {
    const code = await this.downloadText(url);
    const svg = await renderMermaidToSVG(code);
    const filename = `${uuidv4()}.svg`;
    const outPath = path.join(this.opts.outputDir, filename);
    fs.writeFileSync(outPath, svg, 'utf-8');

    const imageUrl = `${this.opts.publicBaseUrl.replace(/\/$/, '')}/images/${filename}`;
    await this.addImageBlockToPage(pageId, imageUrl, `Generated diagram from ${name}`);
  }

  private async processPlantUmlFile(pageId: string, url: string, name: string) {
    const code = await this.downloadText(url);
    const svg = await renderPlantUMLToSVG(code);
    const filename = `${uuidv4()}.svg`;
    const outPath = path.join(this.opts.outputDir, filename);
    fs.writeFileSync(outPath, svg, 'utf-8');

    const imageUrl = `${this.opts.publicBaseUrl.replace(/\/$/, '')}/images/${filename}`;
    await this.addImageBlockToPage(pageId, imageUrl, `Generated PlantUML diagram from ${name}`);
  }

  private async addImageBlockToPage(pageId: string, imageUrl: string, altText?: string) {
    try {
      await this.client.blocks.children.append({
        block_id: pageId,
        children: [
          {
            object: 'block',
            type: 'image',
            image: {
              type: 'external',
              external: { url: imageUrl },
              caption: altText ? [{ type: 'text', text: { content: altText } }] : [],
            },
          },
        ],
      } as any);
      console.log('Appended image block to page', pageId);
    } catch (err) {
      console.error('Failed to append image block to page', pageId, err);
    }
  }
}
