import type { Metadata } from "next";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "RabbitWork",
  description: "RabbitWork 数字员工平台",
};

/** 亮暗主题防闪烁：与 Providers 同决策链（localStorage > 系统偏好），首帧前设 html.dark */
const THEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem('rw-theme');var d=s==='dark'||(!s&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d)}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="antialiased">
        {/* L4 环境氛围层：极光 + 噪点（MASTER §2，全局挂载一次） */}
        <div className="ambient" aria-hidden="true">
          <div className="aurora aurora-a1" />
          <div className="aurora aurora-a2" />
          <div className="grain" />
        </div>
        <AntdRegistry>
          <Providers>{children}</Providers>
        </AntdRegistry>
      </body>
    </html>
  );
}
