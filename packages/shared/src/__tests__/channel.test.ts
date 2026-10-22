/** channel 域 zod + IM 回调归一矩阵（CHNL-001 §5）。 */
import { describe, expect, it } from "vitest";
import { channelCreateInput, extractChannelText } from "../channel";

describe("channelCreateInput", () => {
  it("合法:平台枚举;非法平台拒绝", () => {
    expect(
      channelCreateInput.parse({ name: "客服群", platform: "feishu", employeeId: "e1" }).enabled,
    ).toBeUndefined();
    expect(
      channelCreateInput.safeParse({ name: "x", platform: "slack", employeeId: "e1" }).success,
    ).toBe(false);
  });
});

describe("extractChannelText（IM 回调归一矩阵）", () => {
  it("宽松:text+user 直取", () => {
    expect(extractChannelText({ text: "你好", user: "u1" })).toEqual({
      text: "你好",
      extUserId: "u1",
    });
  });
  it("钉钉:{text:{content},senderStaffId}", () => {
    expect(extractChannelText({ text: { content: "工单查询" }, senderStaffId: "s1" })).toEqual({
      text: "工单查询",
      extUserId: "s1",
    });
  });
  it("飞书:event.message.content(JSON 嵌 text)+open_id", () => {
    const body = {
      event: {
        message: { content: JSON.stringify({ text: "退款进度" }) },
        sender: { sender_id: { open_id: "ou1" } },
      },
    };
    expect(extractChannelText(body)).toEqual({ text: "退款进度", extUserId: "ou1" });
  });
  it("飞书原生 text 字符串 content", () => {
    const body = { event: { message: { content: "纯文本" } } };
    expect(extractChannelText(body)?.text).toBe("纯文本");
  });
  it("未识别形态:null（调用方 422）", () => {
    expect(extractChannelText({})).toBeNull();
    expect(extractChannelText("str")).toBeNull();
    expect(extractChannelText({ text: "" })).toBeNull();
  });
});
