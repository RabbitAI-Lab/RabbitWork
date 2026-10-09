export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-enum": [
      2,
      "always",
      [
        // 工程与横切
        "infra",
        "qa",
        "tool",
        "docs",
        "deps",
        "ci",
        // 分包
        "web",
        "db",
        "shared",
        "ui",
        // 基线域（随首个域规格评审扩展业务模块缩写，与 docs/sprint-*/ 编号一致）
        "sys",
        "proj",
        "api",
      ],
    ],
  },
};
