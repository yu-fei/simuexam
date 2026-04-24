# 项目规则

## 环境配置
- **Python 环境：必须使用 conda 的 `common` 环境运行项目**
- **禁止使用系统 Python 环境**
- **正确启动方式**：
  ```bash
  conda activate common
  python app.py
  ```

## 项目技术栈
- 后端：Flask (Python)
- 数据库：SQLite (exam_system.db)
- 前端：原生 JavaScript + HTML/CSS

## 常用命令
- 安装依赖：`conda activate common` 然后 `pip install flask`
- 运行项目（默认端口 8000）：`conda activate common` 然后 `python app.py`
- 运行项目（指定端口）：`conda activate common` 然后 `python app.py --port 8001`
- 测试运行：启动后访问 http://127.0.0.1:8000
- 运行测试（自动使用 8001 端口）：`conda activate common` 然后 `pytest tests/ -v`

## 重要规则
- **自动化测试完成后必须停止服务**
- **测试完成后执行 `pkill -9 -f "python app.py"` 停止 Flask 服务器**
- **自动化测试默认使用 8001 端口**