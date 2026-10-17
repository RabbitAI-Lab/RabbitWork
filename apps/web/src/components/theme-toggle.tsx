"use client";

import { MoonOutlined, SunOutlined } from "@ant-design/icons";
import { Tooltip } from "antd";
import { useRwTheme } from "@/app/providers";

/** 亮暗主题切换（MASTER §6.3）：html.dark + localStorage + 跟随系统。 */
export function ThemeToggle() {
  const { mode, toggle } = useRwTheme();
  return (
    <Tooltip title={mode === "dark" ? "切换亮色" : "切换暗色"} placement="right">
      <button
        type="button"
        onClick={toggle}
        aria-label="切换主题"
        data-testid="theme-toggle"
        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-rw-sm border border-rw-border text-rw-fg-muted transition-all duration-[140ms] ease-out hover:border-rw-border-strong hover:text-rw-fg active:scale-90"
      >
        {mode === "dark" ? <SunOutlined /> : <MoonOutlined />}
      </button>
    </Tooltip>
  );
}
