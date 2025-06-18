import express, { Request, Response } from 'express';
import cors from 'cors';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { Theme, themes } from './theme.js';
// @ts-ignore
import { initMarkdownRenderer, renderMarkdown, handleFrontMatter } from './main.js';
import { publishToDraft } from './publish.js';

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Create MCP server instance
const mcpServer = new Server(
    {
        name: "wenyan-mcp",
        version: "0.1.0",
    },
    {
        capabilities: {
            resources: {},
            tools: {},
            prompts: {},
        },
    }
);

// Initialize markdown renderer
initMarkdownRenderer();

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
});

// SSE endpoint for real-time updates
app.get('/sse', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Send initial connection message
    res.write('event: connected\ndata: Connected to SSE\n\n');

    // Keep connection alive
    const keepAlive = setInterval(() => {
        res.write(': keepalive\n\n');
    }, 30000);

    // Clean up on client disconnect
    req.on('close', () => {
        clearInterval(keepAlive);
    });
});

// List themes endpoint
app.get('/themes', (_req: Request, res: Response) => {
    const themeList = Object.entries(themes).map(([id, theme]) => ({
        id,
        name: theme.name,
        description: theme.description
    }));
    res.json(themeList);
});

// Publish article endpoint
app.post('/publish', async (req: Request, res: Response) => {
    try {
        const { content, theme_id } = req.body;

        if (!content) {
            return res.status(400).json({ error: 'Content is required' });
        }

        let theme: Theme | undefined = themes["default"];
        if (theme_id) {
            theme = themes[theme_id];
            if (!theme) {
                theme = Object.values(themes).find(
                    theme => theme.name.toLowerCase() === theme_id.toLowerCase()
                );
            }
        }

        if (!theme) {
            return res.status(400).json({ error: 'Invalid theme ID' });
        }

        const preHandlerContent = handleFrontMatter(content);
        const html = await renderMarkdown(preHandlerContent.body, theme.id);
        const title = preHandlerContent.title ?? "Untitled";
        const cover = preHandlerContent.cover ?? "";

        const response = await publishToDraft(title, html, cover);

        res.json({
            success: true,
            message: 'Article published successfully',
            media_id: response.media_id
        });
    } catch (error) {
        console.error('Publish error:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        });
    }
});

// Start server
export function startServer() {
    app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });
} 