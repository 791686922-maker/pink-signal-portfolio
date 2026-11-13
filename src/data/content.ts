import type {
  GreenhouseProject,
  SignalArticle,
  SocialLink,
  ToolShedItem,
} from '../types/content'

export const signalArticles: SignalArticle[] = [
  {
    id: 'agent-boundaries',
    signal: '边界',
    title: '当模型开始操作电脑，我们该怎样设计它的边界',
    summary:
      '从一次普通的文件整理任务出发，拆开权限、确认与撤销三个环节，看看真正可靠的智能体体验应该长什么样。',
    takeaway: '让高风险动作变得可见、可停、可恢复。',
    readingTime: '约 8 分钟',
    note: '可替换示例文章',
  },
  {
    id: 'observable-ai-workflow',
    signal: '流程',
    title: '我把一周的 AI 工作流拆成了四个可观察环节',
    summary:
      '问题通常不在模型会不会做，而在上下文怎样进入、工具怎样调用、结果怎样检查，以及经验怎样留到下一次。',
    takeaway: '先把循环看清楚，再谈自动化。',
    readingTime: '约 6 分钟',
    note: '可替换示例文章',
  },
  {
    id: 'small-model-placement',
    signal: '部署',
    title: '小模型真正适合放在哪里',
    summary:
      '比起追逐参数规模，更值得先问延迟、隐私、成本与失败代价。本文用三个日常场景判断本地模型的合适位置。',
    takeaway: '模型选择是系统取舍，不是排行榜选择。',
    readingTime: '约 7 分钟',
    note: '可替换示例文章',
  },
]

export const greenhouseProjects: GreenhouseProject[] = [
  {
    id: 'spark-lab',
    title: 'BBB 实验室',
    summary: '把文章、原型和复盘组织成一张可漫游的个人知识地图。',
    status: '主实验',
    badge: '示例内容',
    layout: 'featured',
    detail: '适合替换为你的代表项目、真实截图和公开链接。',
  },
  {
    id: 'model-observatory',
    title: '模型观察站',
    summary: '用固定任务记录模型更新后的真实变化，不只抄写发布说明。',
    status: '观察中',
    badge: '示例内容',
    layout: 'tall',
    detail: '可以接入真实评测记录，也可以保留为长期内容栏目。',
  },
  {
    id: 'prompt-lost-and-found',
    title: '提示词失物招领处',
    summary: '保存那些有效过一次，却经不起复用的提示词，并标出失败条件。',
    status: '小型原型',
    badge: '示例内容',
    layout: 'compact',
    detail: '适合展示轻量工具、周末实验或公开笔记。',
  },
  {
    id: 'personal-ai-desk',
    title: '个人 AI 工作台',
    summary: '将资料、任务、工具调用和交付检查收进一个可追踪的工作循环。',
    status: '案例草稿',
    badge: '示例内容',
    layout: 'wide',
    detail: '替换时请使用真实流程和真实边界，不需要虚构效率数字。',
  },
  {
    id: 'weekly-report-planter',
    title: '会自己写周报的花盆',
    summary: '它能收集碎片，却无法分辨什么真正值得写进一周的复盘。',
    status: '未完成实验',
    badge: '示例内容',
    layout: 'failed',
    detail: '停止原因：自动收集放大了噪声，最后仍需要人重新判断重点。',
    isFailed: true,
  },
]

export const toolShedItems: ToolShedItem[] = [
  {
    id: 'about-xiaoliangdian',
    kind: 'about',
    shortLabel: '我',
    label: '关于 BBB',
    title: '一位持续做实验的科技内容创作者',
    description: '这里使用的是可替换示例介绍，请换成你的真实经历与表达。',
    details: ['关注 AI 产品、模型能力与个人工作流', '习惯先做原型，再写结论', '愿意公开有效方法，也记录失败条件'],
  },
  {
    id: 'working-stack',
    kind: 'stack',
    shortLabel: '栈',
    label: '工作技术栈',
    title: '用足够少的工具完成清楚的表达',
    description: '不展示熟练度进度条，只说明这些工具当前承担什么工作。',
    details: ['Vue 与 TypeScript：交互原型', 'Canvas：像素场景与轻量粒子', '模型 API：内容实验与自动化', 'Markdown：文章、研究与长期记录'],
  },
  {
    id: 'collaboration',
    kind: 'work',
    shortLabel: '合',
    label: '合作方式',
    title: '适合一起把复杂技术讲明白',
    description: '合作信息也是示例，请根据真实业务范围、周期与联系方式替换。',
    details: ['科技内容策划与深度文章', 'AI 产品体验与原型共创', '技术品牌叙事与演示', '公开分享或内部工作坊'],
  },
  {
    id: 'current-research',
    kind: 'research',
    shortLabel: '研',
    label: '正在研究',
    title: '怎样让智能体的工作过程更容易被人理解',
    description: '当前方向可以随真实研究变化，不需要伪造完成度或精确数据。',
    details: ['操作权限与确认时机', '长任务的状态表达', '跨会话记忆的可控边界', '人工判断应当保留在哪里'],
  },
]

export const socialLinks: SocialLink[] = [
  { label: 'GitHub', hint: '替换为你的代码主页', href: 'https://github.com/' },
  { label: 'Bilibili', hint: '替换为你的视频主页', href: 'https://www.bilibili.com/' },
  { label: 'RSS', hint: '替换为你的订阅地址', href: '/feed.xml' },
]
