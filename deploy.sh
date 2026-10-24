#!/bin/bash
set -e

echo "=== 停止旧容器 ==="
docker stop rsshub 2>/dev/null || true
docker rm rsshub 2>/dev/null || true

echo "=== 拉取最新镜像 ==="
docker pull ghcr.io/xatlaz-com/rsshub:latest

echo "=== 启动新容器 ==="
docker run -d \
  --name rsshub \
  -p 1200:1200 \
  -e SLACK_TOKEN_company="xoxc-xxx" \
  -e SLACK_ACCESS_KEY="your-secret-key" \
  --restart always \
  ghcr.io/xatlaz-com/rsshub:latest

echo "=== 等待服务启动 ==="
sleep 5

echo "=== 检查状态 ==="
docker ps | grep rsshub
echo ""
echo "=== 测试访问 ==="
curl -s http://localhost:1200/ | head -1 || echo "服务启动中，请稍后再试"

echo ""
echo "=== 部署完成 ==="
echo "访问地址: http://155.248.215.125:1200"
