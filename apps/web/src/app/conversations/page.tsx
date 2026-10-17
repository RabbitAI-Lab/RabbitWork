import { redirect } from "next/navigation";

/** 会话列表已并入办公室工位门户,旧路径重定向。 */
export default function ConversationsPage() {
  redirect("/office");
}
