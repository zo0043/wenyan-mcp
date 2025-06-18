import express, { Request, Response } from 'express';
import cors from 'cors';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { Theme, themes } from './theme.js';
// @ts-ignore
import { initMarkdownRenderer, renderMarkdown, handleFrontMatter } from './main.js';
import { publishToDraft } from './publish.js';

// 配置日志级别
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const LOG_LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
};

// 日志函数
function log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any) {
    const currentLevel = LOG_LEVELS[LOG_LEVEL as keyof typeof LOG_LEVELS] || 1;
    const messageLevel = LOG_LEVELS[level];
    
    if (messageLevel >= currentLevel) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
        
        if (data) {
            console.log(logMessage, data);
        } else {
            console.log(logMessage);
        }
    }
}

const app = express();
const port = process.env.PORT || 3000;

// 请求日志中间件
app.use((req: Request, res: Response, next) => {
    const start = Date.now();
    log('info', `Incoming ${req.method} request to ${req.url}`);
    
    // 记录请求体
    if (req.body && Object.keys(req.body).length > 0) {
        log('debug', 'Request body:', req.body);
    }
    
    // 记录响应
    res.on('finish', () => {
        const duration = Date.now() - start;
        log('info', `${req.method} ${req.url} ${res.statusCode} - ${duration}ms`);
    });
    
    next();
});

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
log('info', 'Markdown renderer initialized');

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
    log('debug', 'Health check requested');
    res.status(200).json({ status: 'ok' });
});

// SSE endpoint for real-time updates
app.get('/events', (req: Request, res: Response) => {
    log('info', 'New SSE connection established');
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Send initial connection message
    res.write('event: connected\ndata: Connected to SSE\n\n');
    log('debug', 'Sent initial SSE connection message');

    // Keep connection alive
    const keepAlive = setInterval(() => {
        res.write(': keepalive\n\n');
        log('debug', 'Sent SSE keepalive message');
    }, 30000);

    // Clean up on client disconnect
    req.on('close', () => {
        log('info', 'SSE connection closed');
        clearInterval(keepAlive);
    });
});

// List themes endpoint
app.get('/themes', (_req: Request, res: Response) => {
    log('info', 'Themes list requested');
    const themeList = Object.entries(themes).map(([id, theme]) => ({
        id,
        name: theme.name,
        description: theme.description
    }));
    log('debug', 'Available themes:', themeList);
    res.json(themeList);
});

// Publish article endpoint
app.post('/publish', async (req: Request, res: Response) => {
    try {
        log('info', 'Publish article request received');
        const { content, theme_id } = req.body;

        if (!content) {
            log('warn', 'Publish request missing content');
            return res.status(400).json({ error: 'Content is required' });
        }

        log('debug', 'Publishing with theme:', theme_id || 'default');

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
            log('warn', `Invalid theme ID: ${theme_id}`);
            return res.status(400).json({ error: 'Invalid theme ID' });
        }

        log('debug', 'Processing front matter');
        const preHandlerContent = handleFrontMatter(content);
        log('debug', 'Front matter processed:', {
            title: preHandlerContent.title,
            hasCover: !!preHandlerContent.cover
        });

        log('debug', 'Rendering markdown');
        const html = await renderMarkdown(preHandlerContent.body, theme.id);
        const title = preHandlerContent.title ?? "Untitled";
        const cover = preHandlerContent.cover ?? "";

        log('info', `Publishing article: ${title}`);
        const response = await publishToDraft(title, html, cover);
        log('info', 'Article published successfully', { media_id: response.media_id });

        res.json({
            success: true,
            message: 'Article published successfully',
            media_id: response.media_id
        });
    } catch (error) {
        log('error', 'Publish error:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        });
    }
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: Function) => {
    log('error', 'Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// Start server
export function startServer() {
    app.listen(port, () => {
        log('info', `Server is running on port ${port}`);
        log('info', `Environment: ${process.env.NODE_ENV}`);
        log('info', `Log level: ${LOG_LEVEL}`);
    });
} 