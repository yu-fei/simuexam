#!/bin/bash
# 运行自动化测试脚本

# 初始化环境
source ~/miniconda3/etc/profile.d/conda.sh && conda activate common

echo "=== 开始运行自动化测试 ==="

# 确保8001端口没有占用
echo "检查8001端口..."
pkill -9 -f "python app.py"

# 启动后端服务在8001端口
echo "启动后端服务..."
python app.py --port 8001 &
SERVER_PID=$!

# 等待服务启动
sleep 3

# 运行测试用例
echo "运行测试用例..."
pytest tests/ -v

# 停止后端服务
echo "停止后端服务..."
pkill -9 -f "python app.py"

echo "=== 自动化测试完成 ==="