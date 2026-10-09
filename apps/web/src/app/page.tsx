export default function HomePage() {
  return (
    <main
      data-testid="home-main"
      className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50"
    >
      <h1 data-testid="home-title" className="text-4xl font-bold text-slate-900">
        RabbitWork
      </h1>
      <p data-testid="home-subtitle" className="text-base text-slate-500">
        工程脚手架已就绪 —— 按 AGENTS.md 门禁从第一份功能规格开始
      </p>
    </main>
  );
}
