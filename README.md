# 模拟考试系统

一个基于 Flask + SQLite 的在线模拟考试系统，支持单选题、多选题、判断题等多种题型。

## 功能特性

- **用户管理** - 简单的账号登录系统
- **科目管理** - 创建、删除考试科目
- **题库导入** - 支持从 TXT 文件批量导入试题
- **多种考试模式**
  - 全量考题：作答某科目的所有题目
  - 随机练习：随机抽取指定数量的题目
  - 错题集：练习之前答错的题目
  - 未考过题：练习尚未作答过的题目
- **考试记录** - 查看历史考试成绩和正确率
- **断点续考** - 支持中断后恢复考试
- **题目管理** - 支持单题编辑、删除、新增

## 项目结构

```
SimuExam/
├── app.py              # Flask 主应用
├── routes/             # 路由模块
│   └── question.py     # 题目相关 API
├── services/           # 业务逻辑
│   └── question_service.py
├── templates/           # 前端页面和静态资源
│   ├── index.html      # 主页面
│   ├── css/style.css   # 样式文件
│   └── js/             # JavaScript 模块
│       ├── api.js      # API 封装
│       ├── admin.js    # 题目管理
│       ├── exam.js     # 考试功能
│       ├── history.js  # 历史记录
│       └── main.js     # 主逻辑
├── models/             # 数据模型
├── utils/              # 工具函数
├── tests/              # 单元测试
├── uploads/            # 上传文件目录
└── exam_system.db      # SQLite 数据库
```

## 安装运行

### 依赖

- Python 3.8+

### 安装步骤

```bash
# 克隆项目
git clone <repository-url>
cd SimuExam

# 安装依赖
pip install -r requirements.txt

# 运行应用
python app.py
```

### 访问

打开浏览器访问: http://127.0.0.1:8000

## 试题格式

导入的 TXT 文件支持以下格式：

### 判断题

```
正确 这是一道判断题
错误 地球是平的
```

### 单选题

```
A 以下哪个是Python的列表方法?
A、append()
B、add()
C、insertFirst()
D、pushBack()
```

### 多选题

```
AB 以下哪些是Python的数据类型?
A、int
B、str
C、char
D、list
```

### 题目选项说明

- 单选题答案：`A`、`B`、`C`、`D`
- 多选题答案：`AB`、`AC`、`BCD` 等组合
- 判断题答案：`正确`/`对`/`是`/`T`/`True`/`✓`/`√` 或 `错误`/`错`/`否`/`F`/`False`/`✗`/`×`
- 选项支持中文逗号：`A、选项1，B、选项2，C、选项3，D、选项4`
- 支持俄文字符自动转换：`А→A`，`В→B`，`С→C` 等

## 技术栈

- **后端**: Flask, Python
- **数据库**: SQLite
- **前端**: 原生 JavaScript, HTML, CSS

## License

MIT License
