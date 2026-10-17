"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, Button, Form, Input } from "antd";
import { LockOutlined, MailOutlined } from "@ant-design/icons";
import { authApi } from "@rabbit/api-client";
import type { LoginInput } from "@rabbit/shared";
import { BrandMark } from "@/components/Brand";
import { ThemeToggle } from "@/components/theme-toggle";

/** SYS-001 登录页（DS v2.1）：全局极光氛围 + 居中卡片 + 主题穿透按钮 + 编排入场。 */
export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const login = useMutation({
    mutationFn: (input: LoginInput) => authApi.login(input),
    onSuccess: () => {
      const next = params.get("next");
      router.replace(next && next.startsWith("/") ? next : "/office");
    },
  });

  return (
    <div
      className="relative flex min-h-screen items-center justify-center px-4"
      data-testid="login-page"
    >
      <div className="absolute right-6 top-6 z-10">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-[400px]" data-testid="login-card">
        <div
          className="animate-fade-up mb-8 flex flex-col items-center gap-3"
          style={{ animationDelay: "0ms" }}
        >
          <BrandMark size={52} />
          <h1 className="font-display text-xl font-semibold tracking-tight text-rw-fg">
            RabbitWork 数字员工平台
          </h1>
          <p className="text-sm text-rw-fg-subtle">将岗位经验固化为可持续上岗的数字员工</p>
        </div>

        <div
          className="animate-fade-up rounded-rw-md border border-rw-border bg-rw-card p-7"
          style={{ animationDelay: "110ms" }}
        >
          {login.isError && (
            <Alert
              type="error"
              showIcon
              data-testid="login-error"
              message={login.error instanceof Error ? login.error.message : "登录失败"}
              className="!mb-5"
            />
          )}
          <Form<LoginInput>
            layout="vertical"
            requiredMark={false}
            onFinish={(v) => login.mutate(v)}
            initialValues={{ email: "admin@rabbitwork.local", password: "rabbit123" }}
          >
            <Form.Item
              name="email"
              label={<span className="text-[12px] text-rw-fg-muted">邮箱</span>}
              rules={[{ required: true, message: "请输入邮箱" }]}
            >
              <Input
                data-testid="login-email"
                size="large"
                prefix={<MailOutlined className="text-rw-fg-subtle" />}
                placeholder="admin@rabbitwork.local"
              />
            </Form.Item>
            <Form.Item
              name="password"
              label={<span className="text-[12px] text-rw-fg-muted">密码</span>}
              rules={[{ required: true, message: "请输入密码" }]}
            >
              <Input.Password
                data-testid="login-password"
                size="large"
                prefix={<LockOutlined className="text-rw-fg-subtle" />}
                placeholder="rabbit123"
              />
            </Form.Item>
            <Button
              type="primary"
              block
              size="large"
              htmlType="submit"
              loading={login.isPending}
              data-testid="login-submit"
              className="mt-1 !h-11 !rounded-rw-sm !text-[15px] !font-medium"
            >
              登 录
            </Button>
          </Form>
        </div>
        <p
          className="animate-fade-up mt-6 text-center font-mono text-xs text-rw-fg-subtle"
          style={{ animationDelay: "220ms", animationDuration: "0.44s" }}
        >
          种子账号 admin@rabbitwork.local · rabbit123
        </p>
      </div>
    </div>
  );
}
