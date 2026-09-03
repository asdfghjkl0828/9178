// 异色基准配色（按 gid 固定映射）
// 数据来源：百度百科 / 3DM / 各攻略站公开资料（异色为按物种固定的真实游戏配色）
// 说明：异色基准色是服务器里固定的；「炫彩」随机特效逐个体不同，免费源不存。
// 拉特/酷拉进化链：拉特(异色)→酷拉(异色炫彩)→风暴酷拉。
window.SHINY_COLORS = {
  // 粉白系（大耳帽兜 / 帽兜娃娃 / 雪影娃娃）
  "53264": { name: "大耳帽兜", base: "#FFC0D9", accent: "#FFF5FA",
    grad: "linear-gradient(135deg,#FFC0D9 0%,#FFF5FA 100%)",
    desc: "原版蓝白 → 异色粉白", type: "异色炫彩", src: "百度百科/3DM" },
  "54509": { name: "大耳帽兜", base: "#FFC0D9", accent: "#FFF5FA",
    grad: "linear-gradient(135deg,#FFC0D9 0%,#FFF5FA 100%)",
    desc: "原版蓝白 → 异色粉白", type: "异色炫彩", src: "百度百科/3DM" },
  "66091": { name: "帽兜娃娃", base: "#FFC0D9", accent: "#FFF5FA",
    grad: "linear-gradient(135deg,#FFC0D9 0%,#FFF5FA 100%)",
    desc: "原版蓝白 → 异色粉白", type: "异色炫彩", src: "百度百科/3DM" },
  "5332":  { name: "雪影娃娃", base: "#FFC0D9", accent: "#FFF5FA",
    grad: "linear-gradient(135deg,#FFC0D9 0%,#FFF5FA 100%)",
    desc: "原版蓝白 → 异色粉白", type: "异色炫彩", src: "百度百科/3DM" },
  "37147": { name: "雪影娃娃", base: "#FFC0D9", accent: "#FFF5FA",
    grad: "linear-gradient(135deg,#FFC0D9 0%,#FFF5FA 100%)",
    desc: "原版蓝白 → 异色粉白", type: "异色", src: "百度百科/3DM" },
  // 红黑撞色（菊花梨）
  "41982": { name: "菊花梨", base: "#C0392B", accent: "#1A1A1A",
    grad: "linear-gradient(135deg,#C0392B 0%,#1A1A1A 100%)",
    desc: "原版黄绿 → 异色红黑撞色", type: "异色炫彩", src: "3DM/7724" },
  // 粉白渐变（叮叮恶魔）
  "42929": { name: "叮叮恶魔", base: "#FFB6D5", accent: "#FFFFFF",
    grad: "linear-gradient(135deg,#FFB6D5 0%,#FFFFFF 100%)",
    desc: "原版黑色 → 异色粉白渐变", type: "异色炫彩", src: "18183/游侠" },
  // 黑黄高奢（酷拉）
  "2853":  { name: "酷拉", base: "#1C1C1C", accent: "#E8B923",
    grad: "linear-gradient(135deg,#1C1C1C 0%,#E8B923 100%)",
    desc: "原版蓝黄 → 异色黑黄（高奢金黑）", type: "异色炫彩", src: "百度百科/3DM" },
  // 深紫 + 蓝紫电流（拉特）
  "39052": { name: "拉特", base: "#4B0082", accent: "#7B68EE",
    grad: "linear-gradient(135deg,#4B0082 0%,#7B68EE 100%)",
    desc: "原版浅黄 → 异色深紫底+蓝紫电流", type: "异色", src: "百度百科" },
  "35690": { name: "拉特", base: "#4B0082", accent: "#7B68EE",
    grad: "linear-gradient(135deg,#4B0082 0%,#7B68EE 100%)",
    desc: "原版浅黄 → 异色深紫底+蓝紫电流", type: "异色", src: "百度百科" }
};
