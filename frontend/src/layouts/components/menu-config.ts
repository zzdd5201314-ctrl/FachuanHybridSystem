import {
  Briefcase,
  Cog,
  FileSearch,
  FileText,
  Inbox,
  LayoutDashboard,
  Settings,
  Shield,
  User,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react'

import { PATHS } from '@/routes/paths'

export interface MenuItem {
  id: string
  icon: LucideIcon
  label: string
  path: string
  badge?: number
}

export interface MenuGroup {
  id: string
  label: string
  icon?: LucideIcon
  items: MenuItem[]
}

export interface TopLevelMenuItem {
  id: string
  icon: LucideIcon
  label: string
  path: string
  badge?: number
}

export type MenuConfig = (TopLevelMenuItem | MenuGroup)[]

export function isMenuGroup(item: TopLevelMenuItem | MenuGroup): item is MenuGroup {
  return 'items' in item
}

export const menuConfig: MenuConfig = [
  {
    id: 'dashboard',
    icon: LayoutDashboard,
    label: '仪表盘',
    path: PATHS.ADMIN_DASHBOARD,
  },
  {
    id: 'inbox',
    icon: Inbox,
    label: '收件箱',
    path: PATHS.ADMIN_INBOX,
  },
  {
    id: 'business',
    label: '业务',
    icon: Briefcase,
    items: [
      {
        id: 'clients',
        icon: Users,
        label: '当事人',
        path: PATHS.ADMIN_CLIENTS,
      },
      {
        id: 'contracts',
        icon: FileText,
        label: '合同',
        path: PATHS.ADMIN_CONTRACTS,
      },
      {
        id: 'cases',
        icon: Briefcase,
        label: '案件',
        path: PATHS.ADMIN_CASES,
      },
      {
        id: 'logs',
        icon: FileText,
        label: '日志',
        path: PATHS.ADMIN_LOGS,
      },
    ],
  },
  {
    id: 'automation',
    label: '自动化工具',
    icon: Zap,
    items: [
      {
        id: 'preservation-quotes',
        icon: Shield,
        label: '财产保全报价',
        path: PATHS.ADMIN_AUTOMATION_QUOTES,
      },
      {
        id: 'document-recognition',
        icon: FileSearch,
        label: '文书智能识别',
        path: PATHS.ADMIN_AUTOMATION_RECOGNITION,
      },
    ],
  },
  {
    id: 'settings',
    label: '设置',
    icon: Settings,
    items: [
      {
        id: 'user-settings',
        icon: User,
        label: '用户设置',
        path: PATHS.ADMIN_SETTINGS_USER,
      },
      {
        id: 'system-settings',
        icon: Cog,
        label: '系统设置',
        path: PATHS.ADMIN_SETTINGS_SYSTEM,
      },
    ],
  },
]

export function getAllMenuPaths(): string[] {
  const paths: string[] = []

  menuConfig.forEach((item) => {
    if (isMenuGroup(item)) {
      item.items.forEach((subItem) => {
        paths.push(subItem.path)
      })
    } else {
      paths.push(item.path)
    }
  })

  return paths
}

export function findGroupByPath(pathname: string): string | null {
  for (const item of menuConfig) {
    if (isMenuGroup(item)) {
      for (const subItem of item.items) {
        if (pathname.startsWith(subItem.path)) {
          return item.id
        }
      }
    }
  }

  return null
}
