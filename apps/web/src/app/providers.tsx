"use client";

// React 19 兼容补丁必须在任何 antd 组件渲染前导入（rules/react-nextjs 技术栈约束）
import "@ant-design/v5-patch-for-react-19";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App as AntdApp, ConfigProvider } from "antd";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { antdThemeConfigs, type RwThemeMode } from "./theme/antd-theme";

/**
 * 客户端 Provider 收口（MASTER §6）：
 * - QueryClient：服务端状态（rules/react-nextjs §4）
 * - ConfigProvider：antd 主题穿透（cssVar + 亮暗 algorithm，key=mode 强制重建）
 * - AntdApp：App.useApp() 的 message/modal 必须有 <App> 祖先——缺省时返回空对象，
 *   onSuccess 里 message.success 抛 TypeError 静默中断（曾致创建员工 201 后弹窗不关闭）
 */
const RwThemeContext = createContext<{ mode: RwThemeMode; toggle: () => void }>({
  mode: "light",
  toggle: () => {},
});

export function useRwTheme() {
  return useContext(RwThemeContext);
}

const THEME_STORAGE_KEY = "rw-theme";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
      }),
  );
  const [mode, setMode] = useState<RwThemeMode>("light");

  // 初始值与 layout 防闪脚本同一决策链（localStorage > prefers-color-scheme）
  useEffect(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === "dark" || saved === "light") setMode(saved);
    else if (matchMedia("(prefers-color-scheme: dark)").matches) setMode("dark");
  }, []);

  // 模式 → html.dark class（tokens.css 双套由此激活；antd 侧由 key 重建）
  useEffect(() => {
    document.documentElement.classList.toggle("dark", mode === "dark");
  }, [mode]);

  const toggle = useCallback(() => {
    setMode((m) => {
      const next = m === "dark" ? "light" : "dark";
      localStorage.setItem(THEME_STORAGE_KEY, next);
      return next;
    });
  }, []);

  return (
    <RwThemeContext.Provider value={{ mode, toggle }}>
      <QueryClientProvider client={queryClient}>
        <ConfigProvider key={mode} theme={antdThemeConfigs[mode]}>
          <AntdApp>{children}</AntdApp>
        </ConfigProvider>
      </QueryClientProvider>
    </RwThemeContext.Provider>
  );
}
