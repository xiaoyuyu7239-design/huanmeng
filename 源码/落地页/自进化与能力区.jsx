// 这个文件是落地页的"后厨参观通道"三连：EvoMap 区像展示厨房流程的转盘模型（五个工位绕圈转），
// 机制闭环区像墙上挂的卫生检查成绩单（四个大数字 + 六项打勾清单），
// 为谁而造区像门口的"适合人群"告示牌（玩家/创作者/智能体三张卡）。
import React from 'react';

// EvoMap 五个环上步骤：[left, top, 标题, 小字]，位置照原样抄线上内联 style
const 环上步骤 = [
  ['50%', '7%', '生成', 'Agent 写剧本'],
  ['90%', '34%', '发布', '可试玩游戏'],
  ['82%', '78%', '校验', '结构门禁'],
  ['18%', '78%', '枚举', '结局可达性'],
  ['10%', '34%', '沉淀', 'Skill / 测试'],
];

// 右侧四条说明：[序号符, 标题, 说明]
const 进化说明 = [
  ['①', '规划前召回经验', '提取 hidden-route、branch-and-bottleneck、route-reachability 等 signals，查找可复用的 Gene / Capsule。'],
  ['②', '生成中约束 Agent', '把召回经验写入 system prompt，提醒它如何设计隐藏路线、因果与全景素材需求。'],
  ['③', '生成后沉淀事件', '每次草稿生成与应用都写入本地 EvolutionEvent，记录 signals、节点数、选择数与校验结果。'],
  ['◆', '可降级边界', '没有 EvoMap token 时自动降级，本地 Skill、schema 校验与路线枚举仍是最终门禁。'],
];

// 自进化区：输入无 → 渲染左边慢转的环形图 + 右边四条说明 → 吐出 section#evolve
export function 自进化区() {
  return (
    <section className="band" id="evolve">
      <div className="wrap">
        <div className="band-head reveal">
          <span className="eyebrow">自进化工作流 · EvoMap</span>
          <h2 className="title">
            不是让模型更聪明，
            <br />
            而是让经验系统越来越厚。
          </h2>
          <p className="lead">
            每一次生成、校验、修正都会沉淀为 Skill、模板、测试与
            EvolutionEvent，下一次创作不再从零开始。
          </p>
        </div>
        <div className="evo-grid">
          <div className="ring reveal" aria-hidden="true">
            <div className="orbit" />
            <div className="center">
              <div>
                <b>EvoMap</b>
                <small>经验闭环</small>
              </div>
            </div>
            {环上步骤.map(([左, 上, 标题, 小字]) => (
              <div className="step" style={{ left: 左, top: 上 }} key={标题}>
                <div className="pin" />
                <b>{标题}</b>
                <small>{小字}</small>
              </div>
            ))}
          </div>
          <div className="evo-list reveal">
            {进化说明.map(([符号, 标题, 说明]) => (
              <div className="evo-item" key={标题}>
                <span className="k">{符号}</span>
                <div>
                  <b>{标题}</b>
                  <p>{说明}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// 能力清单数据：[标题, 说明]，照原样抄自线上代码
const 能力清单 = [
  ['选择反馈面板', '让每个选择都有可见后果'],
  ['命运地图', '已走路线与未显现的可能'],
  ['结局因果回放', '抵达结局后回看因果链'],
  ['Creator 机制编辑器', '配置剧情机制与素材'],
  ['条件选择与隐藏路线提示', '隐藏分支不再不可达'],
  ['结局路线自动枚举', '缺字段会被内容检查拦截'],
];

// 机制闭环区：输入无 → 渲染四格大数字指标 + 六项打勾能力清单 → 吐出 section#capability
export function 机制闭环区() {
  return (
    <section className="band" id="capability" style={{ paddingTop: 30 }}>
      <div className="wrap">
        <div className="band-head reveal">
          <span className="eyebrow">已完成的机制闭环</span>
          <h2 className="title">结构有效，还要真的能玩到。</h2>
        </div>
        <div className="metrics reveal">
          <div className="metric">
            <span>4</span>
            <small>结局演示路线自动枚举</small>
          </div>
          <div className="metric">
            <span>2</span>
            <small>命运机制回归测试套件</small>
          </div>
          <div className="metric">
            <span>100%</span>
            <small>结局必须被路线覆盖</small>
          </div>
          <div className="metric">
            <span>0</span>
            <small>不可达节点容忍度</small>
          </div>
        </div>
        <div className="caps reveal">
          {能力清单.map(([标题, 说明]) => (
            <div className="cap" key={标题}>
              <span className="ck">✓</span>
              <div>
                {标题} <em>—— {说明}</em>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// 为谁而造区：输入无 → 渲染玩家/创作者/智能体三张角色卡 → 吐出 section#audience
export function 为谁而造区() {
  return (
    <section className="band" id="audience" style={{ paddingTop: 30 }}>
      <div className="wrap">
        <div className="band-head reveal">
          <span className="eyebrow">为谁而造</span>
          <h2 className="title">
            一套基础设施，
            <br />
            三种角色各取所需。
          </h2>
        </div>
        <div className="dossier">
          <div className="who-card reveal">
            <div className="role">For Players</div>
            <h3>玩家</h3>
            <ul>
              <li>可探索的 360° 沉浸式场景</li>
              <li>多结局与命运反馈</li>
              <li>多周目记忆继承与隐藏真结局</li>
              <li>抵达结局后的因果回放</li>
            </ul>
          </div>
          <div className="who-card reveal">
            <div className="role">For Creators</div>
            <h3>创作者</h3>
            <ul>
              <li>可视化故事结构与分支编辑</li>
              <li>剧情机制与素材的配置面板</li>
              <li>AI 助手协作生成与校验</li>
              <li>一键发布为可试玩游戏</li>
            </ul>
          </div>
          <div className="who-card reveal">
            <div className="role">For Agents</div>
            <h3>智能体</h3>
            <ul>
              <li>把经验沉淀为 Skill 与模板</li>
              <li>测试与逻辑地图反向约束创作</li>
              <li>EvolutionEvent 记录每次创作</li>
              <li>下一次生成自动避开旧坑</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
