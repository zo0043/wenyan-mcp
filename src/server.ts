import express, { Request, Response } from 'express';
import cors from 'cors';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { Theme, themes } from './theme.js';
// @ts-ignore
import { initMarkdownRenderer, renderMarkdown, handleFrontMatter } from './main.js';
import { publishToDraft } from './publish.js';
import { uploadMedia, getMedia, uploadPermanentMedia } from './upload.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { log } from './logger.js';

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
        log('debug', 'Publish request params:', { content, theme_id });

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

// 配置文件上传
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// 上传临时素材
app.post('/media/upload', upload.single('media'), async (req: Request, res: Response) => {
    try {
        log('info', 'Media upload request received');
        
        if (!req.file) {
            log('warn', 'No file uploaded');
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const type = req.body.type || 'image';
        if (!['image', 'voice', 'video', 'thumb'].includes(type)) {
            log('warn', `Invalid media type: ${type}`);
            return res.status(400).json({ error: 'Invalid media type' });
        }

        log('debug', `Uploading media file: ${req.file.path}, type: ${type}`);
        const result = await uploadMedia(process.env.WECHAT_ACCESS_TOKEN || '', type as any, req.file.path);
        log('info', 'Media uploaded successfully', { media_id: result.media_id });

        res.json({
            success: true,
            media_id: result.media_id,
            type: result.type,
            created_at: result.created_at
        });
    } catch (error) {
        log('error', 'Media upload error:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        });
    }
});

// 获取临时素材
app.get('/media/:mediaId', async (req: Request, res: Response) => {
    try {
        log('info', 'Media download request received', { media_id: req.params.mediaId });
        
        const mediaId = req.params.mediaId;
        const savePath = path.join('downloads', `${mediaId}.tmp`);

        log('debug', `Downloading media to: ${savePath}`);
        await getMedia(process.env.WECHAT_ACCESS_TOKEN || '', mediaId, savePath);
        log('info', 'Media downloaded successfully');

        res.download(savePath, (err) => {
            if (err) {
                log('error', 'Error sending file:', err);
            }
            // 删除临时文件
            fs.unlink(savePath, (unlinkErr) => {
                if (unlinkErr) {
                    log('error', 'Error deleting temporary file:', unlinkErr);
                }
            });
        });
    } catch (error) {
        log('error', 'Media download error:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        });
    }
});

// 上传永久素材
app.post('/material/upload', upload.single('media'), async (req: Request, res: Response) => {
    try {
        log('info', 'Permanent material upload request received');
        if (!req.file) {
            log('warn', 'No file uploaded');
            return res.status(400).json({ error: 'No file uploaded' });
        }
        const type = req.body.type || 'image';
        if (!['image', 'voice', 'video', 'thumb'].includes(type)) {
            log('warn', `Invalid material type: ${type}`);
            return res.status(400).json({ error: 'Invalid material type' });
        }
        let description;
        if (type === 'video' && req.body.description) {
            try {
                description = JSON.parse(req.body.description);
            } catch (e) {
                log('warn', 'Invalid description JSON');
                return res.status(400).json({ error: 'Invalid description JSON' });
            }
        }
        log('debug', `Uploading permanent material file: ${req.file.path}, type: ${type}`);
        const result = await uploadPermanentMedia(
            process.env.WECHAT_ACCESS_TOKEN || '',
            type as any,
            req.file.path,
            description
        );
        log('info', 'Permanent material uploaded successfully', result);
        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        log('error', 'Permanent material upload error:', error);
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
        log('info', `Log level: ${process.env.LOG_LEVEL}`);
    });
} 