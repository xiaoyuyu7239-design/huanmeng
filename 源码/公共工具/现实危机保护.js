// 浏览器与服务端共用同一组高召回危机边界。明确的自伤/轻生想法、计划或行为
// 直接离开角色扮演，不发送模型；这不是诊断器，模糊输入仍由服务端安全策略兜底。
const 现实危机模式 = /(?:不想活(?:了|下去)?|活不下去|想死|自杀|轻生|寻死|结束(?:自己|我的)?生命|伤害自己|自残|一了百了|割(?:开|破)?(?:手腕|腕)|割腕|跳楼|从.{0,10}(?:楼|高处|天台|桥).{0,10}跳(?:下|下去)|(?:吞|吃|服).{0,12}(?:很多|大量|过量|一整瓶|整瓶|一把).{0,8}(?:安眠药|药片|药物|药)|(?:吞|吃|服).{0,8}[1-9]\d{1,2}\s*(?:片|颗).{0,6}(?:药|安眠药)?|(?:吞|吃|服).{0,8}(?:毒药|农药)|上吊|吊死|勒死自己|烧炭|开煤气|喝农药|服毒|kill\s+myself|end\s+my\s+life|take\s+my\s+own\s+life|suicid(?:e|al)|self[-\s]?harm|cut\s+my\s+wrists?|jump\s+off.{0,20}(?:roof|building|bridge)|overdos(?:e|ed|ing)|(?:took|take|swallow(?:ed)?).{0,20}(?:too\s+many|a\s+lot\s+of|a\s+whole\s+bottle\s+of|a\s+handful\s+of).{0,10}(?:pills?|medication)|(?:took|swallow(?:ed)?)\s+[1-9]\d{1,2}\s+(?:pills?|tablets?)|hang\s+myself|poison\s+myself)/iu;

export function 是现实危机表达(值) {
  if (typeof 值 !== 'string') return false;
  const 文本 = 值.normalize('NFKC').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/gu, ' ').trim();
  return 现实危机模式.test(文本);
}

export function 创建现实危机安全回应() {
  return {
    ok: true,
    source: 'safety',
    serviceStatus: 'guarded',
    intent: 'pause',
    intentLabel: '暂停对话',
    reply: '这听起来可能不只是剧情里的压力。请先暂停游戏并联系身边可信任的人；如果你已经实施伤害、服用了过量药物或正处于紧迫危险中，请立即联系当地急救服务，并尽量不要独处。这里无法替代现实中的危机支持。',
    memoryCandidate: '',
    safety: 'fallback',
    reason: 'real_world_crisis',
    notice: '这段输入不会发送给角色，也不会改变剧情。',
  };
}
