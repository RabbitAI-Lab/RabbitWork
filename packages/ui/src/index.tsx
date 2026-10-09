import { Empty } from "antd";

/**
 * 通用组件沉淀处（rules/react-nextjs §5.1）：packages/ui 不得依赖业务 Store 与 api-client；
 * 业务组件放 apps/web/src/components/{domain}/。
 */

/** 空态占位（列表/详情无数据时的统一形态）。 */
export function EmptyHint({ description }: { description: string }) {
  return <Empty description={description} />;
}
