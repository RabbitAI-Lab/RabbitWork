"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Avatar, Dropdown } from "antd";
import {
  LogoutOutlined,
  UserOutlined,
  HomeOutlined,
  AppstoreOutlined,
  LineChartOutlined,
  BookOutlined,
  ThunderboltOutlined,
  ToolOutlined,
  RobotOutlined,
  ClockCircleOutlined,
  UserSwitchOutlined,
  AppstoreFilled,
  ApiOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { authApi } from "@rabbit/api-client";
import { BrandMark } from "@/components/Brand";
import { ThemeToggle } from "@/components/theme-toggle";

export type MenuKey =
  | "office"
  | "staffs"
  | "teams"
  | "runs"
  | "knowledge"
  | "skills"
  | "tools"
  | "mcp"
  | "models"
  | "cron"
  | "handoffs"
  | "gallery"
  | "channels"
  | "users";

const MENUS: Array<{
  key: MenuKey;
  href: string;
  label: string;
  icon: React.ReactNode;
  match: RegExp;
}> = [
  {
    key: "staffs",
    href: "/staffs",
    label: "我的数字员工",
    icon: <AppstoreOutlined />,
    match: /^\/staffs(\/|$)/,
  },
  {
    key: "teams",
    href: "/teams",
    label: "我的团队",
    icon: <TeamOutlined />,
    match: /^\/teams(\/|$)/,
  },
  {
    key: "office",
    href: "/office",
    label: "办公室",
    icon: <HomeOutlined />,
    match: /^\/(office|chat|conversations)(\/|$)/,
  },
  {
    key: "runs",
    href: "/runs",
    label: "运行观测",
    icon: <LineChartOutlined />,
    match: /^\/runs(\/|$)/,
  },
  {
    key: "knowledge",
    href: "/knowledge",
    label: "知识库",
    icon: <BookOutlined />,
    match: /^\/knowledge(\/|$)/,
  },
  {
    key: "skills",
    href: "/skills",
    label: "技能",
    icon: <ThunderboltOutlined />,
    match: /^\/skills(\/|$)/,
  },
  {
    key: "tools",
    href: "/tools",
    label: "工具",
    icon: <ToolOutlined />,
    match: /^\/tools(\/|$)/,
  },
  {
    key: "mcp",
    href: "/mcp",
    label: "MCP 服务",
    icon: <ApiOutlined />,
    match: /^\/mcp(\/|$)/,
  },
  {
    key: "models",
    href: "/models",
    label: "模型",
    icon: <RobotOutlined />,
    match: /^\/models(\/|$)/,
  },
  {
    key: "cron",
    href: "/scheduled-tasks",
    label: "定时任务",
    icon: <ClockCircleOutlined />,
    match: /^\/scheduled-tasks(\/|$)/,
  },
  {
    key: "handoffs",
    href: "/handoffs",
    label: "人工接管",
    icon: <UserSwitchOutlined />,
    match: /^\/handoffs(\/|$)/,
  },
  {
    key: "gallery",
    href: "/gallery",
    label: "广场",
    icon: <AppstoreFilled />,
    match: /^\/gallery(\/|$)/,
  },
  {
    key: "channels",
    href: "/channels",
    label: "渠道",
    icon: <ApiOutlined />,
    match: /^\/channels(\/|$)/,
  },
  {
    key: "users",
    href: "/users",
    label: "用户管理",
    icon: <TeamOutlined />,
    match: /^\/users(\/|$)/,
  },
];

/** 应用外壳（DS v2.1 MASTER §5.1）：侧栏 + 内容区；语义 token、激活指示条、主题切换。 */
export function AppShell({ children, active }: { children: React.ReactNode; active: MenuKey }) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: authApi.me, retry: false });
  const logout = useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      queryClient.clear();
      router.replace("/login");
    },
  });

  return (
    <div className="relative flex h-screen overflow-hidden bg-rw-bg" data-testid="app-shell">
      {/* 左侧菜单栏（玻璃质感 + 语义 token） */}
      <aside className="glass z-10 flex w-60 shrink-0 flex-col border-r border-rw-border">
        <Link
          href="/office"
          className="flex items-center gap-3 px-5 pb-5 pt-6"
          data-testid="app-brand"
        >
          <BrandMark size={32} />
          <span className="flex flex-col leading-tight">
            <span className="font-display text-[15px] font-semibold tracking-tight text-rw-fg">
              RabbitWork
            </span>
            <span className="text-[11px] text-rw-fg-subtle">数字员工平台</span>
          </span>
        </Link>

        <nav className="flex-1 space-y-1 px-3">
          {MENUS.map((m) => {
            const isActive = active === m.key && m.match.test(pathname) ? true : active === m.key;
            return (
              <Link
                key={m.key}
                href={m.href}
                data-testid={`nav-${m.key}`}
                aria-current={isActive ? "page" : undefined}
                className={`relative flex items-center gap-3 rounded-rw-md px-3.5 py-2 text-sm transition-colors duration-[140ms] ease-out ${
                  isActive
                    ? "bg-rw-accent-subtle font-medium text-rw-accent"
                    : "text-rw-fg-muted hover:bg-rw-muted-subtle hover:text-rw-fg"
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-rw-accent" />
                )}
                <span>{m.icon}</span>
                {m.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 border-t border-rw-border p-3">
          <Dropdown
            menu={{
              items: [
                {
                  key: "logout",
                  icon: <LogoutOutlined />,
                  label: "退出登录",
                  onClick: () => logout.mutate(),
                },
              ],
            }}
            placement="topRight"
          >
            <span
              className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-rw-md px-2 py-1.5 transition-colors duration-[140ms] ease-out hover:bg-rw-muted-subtle"
              data-testid="app-user"
            >
              <Avatar
                size={30}
                icon={<UserOutlined className="text-xs" />}
                className="avatar-accent !flex items-center justify-center"
              />
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="truncate text-[13px] font-medium text-rw-fg">
                  {me.data?.name ?? "..."}
                </span>
                <span className="text-[11px] text-rw-fg-subtle">
                  {me.data?.role === "ADMIN" ? "管理员" : "成员"}
                </span>
              </span>
            </span>
          </Dropdown>
          <ThemeToggle />
        </div>
      </aside>

      {/* 右侧内容区 */}
      <main className="scroll-slim relative z-[1] min-w-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
