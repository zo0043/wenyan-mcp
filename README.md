# Wenyan MCP Server

A Markdown formatting tool that allows AI assistants to apply elegant built-in themes and publish articles directly to 微信公众号.

## Features

- Markdown to HTML conversion with custom themes
- Direct publishing to 微信公众号 draft box
- HTTP SSE support for real-time updates
- RESTful API endpoints
- Docker support for easy deployment

## Prerequisites

- Node.js 20 or later
- Docker and Docker Compose (for containerized deployment)
- 微信公众号开发者账号

## Installation

### Local Development

1. Clone the repository:
```bash
git clone https://github.com/yourusername/wenyan-mcp.git
cd wenyan-mcp
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

4. Start the development server:
```bash
npm run dev
```

### Docker Deployment

#### Using Docker Compose (Recommended)

1. Create a `.env` file from the example:
```bash
cp .env.example .env
```

2. Edit the `.env` file and fill in your configuration:
```bash
# 微信公众号配置
WECHAT_APP_ID=your_app_id
WECHAT_APP_SECRET=your_app_secret

# 服务器配置
PORT=3000
NODE_ENV=production
```

3. Create the images directory:
```bash
mkdir -p images
```

4. Start the service:
```bash
docker-compose up -d
```

5. Check the service status:
```bash
docker-compose ps
```

#### Using Docker Directly

1. Build the Docker image:
```bash
docker build -t wenyan-mcp .
```

2. Run the container:
```bash
docker run -d -p 3000:3000 --name wenyan-mcp wenyan-mcp
```

## API Endpoints

### Health Check
```
GET /health
```
Returns the server health status.

### Server-Sent Events
```
GET /events
```
Establishes an SSE connection for real-time updates.

### List Themes
```
GET /themes
```
Returns a list of available themes.

### Publish Article
```
POST /publish
Content-Type: application/json

{
    "content": "Your markdown content",
    "theme_id": "theme_name"
}
```
Publishes an article to 微信公众号 draft box.

## Environment Variables

- `WECHAT_APP_ID`: 微信公众号平台的 App ID
- `WECHAT_APP_SECRET`: 微信公众号平台的 App Secret
- `HOST_IMAGE_PATH`: 本地图片目录的路径
- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment mode (development/production)

## Development

### Available Scripts

- `npm run build`: Build the project
- `npm run dev`: Start development server with hot reload
- `npm run test`: Run tests
- `npm start`: Start production server

### Project Structure

```
wenyan-mcp/
├── src/
│   ├── index.ts        # Main entry point
│   ├── server.ts       # HTTP server implementation
│   ├── main.js         # Markdown rendering logic
│   ├── publish.ts      # Publishing functionality
│   ├── theme.ts        # Theme definitions
│   └── themes/         # Theme assets
├── dist/               # Compiled output
├── test/              # Test files
├── images/            # Local images directory
├── Dockerfile         # Docker configuration
├── docker-compose.yml # Docker Compose configuration
└── .env.example       # Example environment variables
```

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
