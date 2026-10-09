"use client";

// React 19 兼容补丁必须在任何 antd 组件渲染前导入（rules/react-nextjs 技术栈约束）
import "@ant-design/v5-patch-for-react-19";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

/** 客户端 Provider 收口：TanStack Query（服务端状态，rules/react-nextjs §4）。 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
      }),
  );
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
