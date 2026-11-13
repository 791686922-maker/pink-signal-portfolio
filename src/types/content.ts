export type ArticleSignal = '边界' | '流程' | '部署'

export interface SignalArticle {
  id: string
  signal: ArticleSignal
  title: string
  summary: string
  takeaway: string
  readingTime: string
  note: string
}

export type ProjectLayout = 'featured' | 'tall' | 'wide' | 'compact' | 'failed'

export interface GreenhouseProject {
  id: string
  title: string
  summary: string
  status: string
  badge: '示例内容'
  layout: ProjectLayout
  detail: string
  isFailed?: boolean
}

export type ToolKind = 'about' | 'stack' | 'work' | 'research'

export interface ToolShedItem {
  id: string
  kind: ToolKind
  shortLabel: string
  label: string
  title: string
  description: string
  details: string[]
}

export interface SocialLink {
  label: string
  hint: string
  href: string
}
