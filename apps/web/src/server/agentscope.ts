/** AgentScope Provider 服务端单例（蓝图 §5.1：运行面唯一出口；浏览器零直连）。
 *  挂 globalThis：Next dev 按路由分包会各持一份模块实例，mock 状态必须跨路由共享
 *  （与 prisma 单例同一先例）。 */
import { createAgentScopeProvider, type AgentScopeProvider } from "@rabbit/agentscope";

const globalForAgentscope = globalThis as unknown as { __rwAgentscope?: AgentScopeProvider };

export function getAgentScope(): AgentScopeProvider {
  globalForAgentscope.__rwAgentscope ??= createAgentScopeProvider();
  return globalForAgentscope.__rwAgentscope;
}
