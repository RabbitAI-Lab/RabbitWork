import { theme as antdTheme } from "antd";
import type { ThemeConfig } from "antd";

/**
 * antd 主题映射（MASTER §6）：token 具体值在此（antd 色板派生需要可计算值），
 * 亮暗切换 = 换配置对象 + ConfigProvider key 强制重建；cssVar 模式让组件样式走 CSS 变量。
 * 与 tokens.css 保持同值——修 token 必须两边同步（e2e 视觉断言锁定）。
 */
const SHARED: ThemeConfig = {
  cssVar: true,
  token: {
    fontFamily: "var(--font-body)",
    fontSize: 13,
    borderRadius: 4,
    borderRadiusLG: 12,
    controlHeight: 32,
    controlHeightSM: 26,
    lineWidth: 1,
    fontWeightStrong: 600,
    colorLink: "var(--rw-accent)",
    colorLinkHover: "var(--rw-accent-hover)",
  },
};

const LIGHT: ThemeConfig = {
  ...SHARED,
  algorithm: antdTheme.defaultAlgorithm,
  token: {
    ...SHARED.token,
    colorPrimary: "#10b981",
    colorSuccess: "#10b981",
    colorWarning: "#d97706",
    colorError: "#dc2626",
    colorInfo: "#10b981",
    colorBgLayout: "#fafafa",
    colorBgContainer: "#ffffff",
    colorBgElevated: "#ffffff",
    colorText: "#0f172a",
    colorTextSecondary: "#64748b",
    colorTextTertiary: "#94a3b8",
    colorTextQuaternary: "#cbd5e1",
    colorBorder: "#cbd5e1",
    colorBorderSecondary: "#e4e8ee",
  },
};

const DARK: ThemeConfig = {
  ...SHARED,
  algorithm: antdTheme.darkAlgorithm,
  token: {
    ...SHARED.token,
    colorPrimary: "#34d399",
    colorSuccess: "#34d399",
    colorWarning: "#f59e0b",
    colorError: "#f87171",
    colorInfo: "#34d399",
    colorBgLayout: "#0b0f1a",
    colorBgContainer: "#111827",
    colorBgElevated: "#16213a",
    colorText: "#f1f5f9",
    colorTextSecondary: "#94a3b8",
    colorTextTertiary: "#5b6b82",
    colorTextQuaternary: "#334155",
    colorBorder: "#334155",
    colorBorderSecondary: "#1e293b",
  },
};

export const antdThemeConfigs = { light: LIGHT, dark: DARK } as const;
export type RwThemeMode = keyof typeof antdThemeConfigs;
