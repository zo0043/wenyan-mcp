#!/bin/bash

# 设置错误时退出
set -e

echo "🚀 开始重新构建和启动 wenyan-mcp 服务..."

# 停止并删除现有容器
echo "📦 停止并删除现有容器..."
docker-compose down

npm install

npm run build 


# 重新构建镜像
echo "🔨 重新构建 Docker 镜像..."
docker-compose build --no-cache

# 启动新容器
echo "🚀 启动新容器..."
docker-compose up -d

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 5

# 检查服务状态
echo "🔍 检查服务状态..."
docker-compose ps

# 显示容器日志
echo "📝 显示容器日志..."
docker-compose logs -f 