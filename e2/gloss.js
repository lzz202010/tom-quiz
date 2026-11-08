/* e2 中文释义表（真题语境）
   术语约定:统一用 n./v./adj./adv./prep./pron. 词性缩写;试卷术语一律按本表译法:
   PASSAGE/TEXT=原文段落, QUESTIONS=题目, OPTIONS=备选项, ANSWER SHEET=作答区,
   Section I Use of English=第一部分·英语知识运用(完形填空), Reading Comprehension=阅读理解。
   多义词把考研语境里最贴切的义项放在最前;另有 E2GLOSS_CTX 按例句选定义项。
   未收录的词:界面提供「补充释义」手动填写,写入词条 gloss 字段后长期保存。 */
(function (global) {
  'use strict';
  const G = {
    /* 试卷/界面术语 */
    answer: 'n. 答案；v. 回答', answers: 'n. 答案（复数）', sheet: 'n. 答题卡；表格',
    text: 'n. 原文；文章', texts: 'n. 阅读篇目（原题 Text 1–4）', passage: 'n. 原文段落；文章',
    paragraph: 'n. 段落', question: 'n. 试题；问题', questions: 'n. 题目（复数）',
    point: 'n. 分；要点', points: 'n. 分值（如 10 points＝10 分）',
    direction: 'n. 说明；方向', directions: 'n. 题目要求；答题说明',
    mark: 'v. 涂写；标记（Mark your answers＝把答案涂在答题卡上）',
    score: 'n. 分数；得分', section: 'n. 部分；节（试卷分节）',
    read: 'v. 阅读；读到', write: 'v. 写；撰写', writing: 'n. 写作；文字',
    choose: 'v. 选择', choosing: 'v. 选择（现在分词）', option: 'n. 选项', options: 'n. 备选项',
    following: 'adj. 下列的；以下的', according: 'adv. 依据（according to 按照）',
    numbered: 'adj. 编号的', blank: 'n. 空格；空白处', sheet1: '',
    /* 高频实词 */
    people: 'n. 人们', should: 'v.aux. 应该；理应', time: 'n. 时间；次数',
    other: 'adj. 其他的；pron. 其他人/物', work: 'v. 工作；起作用；n. 工作',
    working: 'v. 工作（现在分词）；adj. 在职的', each: 'det. 每个；各自',
    need: 'v. 需要；n. 需求', needs: 'n. 需求（复数）', make: 'v. 使得；制造；组成',
    making: 'v. 使得；制造（现在分词）', student: 'n. 学生', students: 'n. 学生（复数）',
    say: 'v. 说；表明', says: 'v. 指出；写道', said: 'v. 说（过去式）',
    much: 'det. 许多（不可数）', just: 'adv. 只是；刚刚；恰好', many: 'det. 许多（可数）',
    health: 'n. 健康', after: 'prep. 在……之后', like: 'v. 喜欢；prep. 像；如同',
    help: 'v. 帮助；n. 帮助', less: 'det. 更少的；adv. 更少地', good: 'adj. 好的；有益的',
    life: 'n. 生活；生命', could: 'v.aux. 可能；能够', feel: 'v. 感觉；认为',
    often: 'adv. 经常', social: 'adj. 社交的；社会的', home: 'n. 家；adv. 在家',
    while: 'conj. 当……时；然而', year: 'n. 年；年份', years: 'n. 年份（复数）',
    job: 'n. 工作；职位', jobs: 'n. 岗位（复数）', might: 'v.aux. 可能；也许',
    best: 'adj. 最好的', children: 'n. 儿童；子女', change: 'n./v. 改变；变化',
    college: 'n. 大学；学院', study: 'n./v. 研究；学习', thing: 'n. 事物；事情',
    things: 'n. 事情（复数）', give: 'v. 给；提供', world: 'n. 世界；领域',
    american: 'adj. 美国的；n. 美国人', find: 'v. 发现；找到', found: 'v. 发现（过去式）；建立',
    future: 'n. 未来；adj. 未来的', school: 'n. 学校；学院', think: 'v. 认为；思考',
    university: 'n. 大学', first: 'det. 第一的；adv. 首先', others: 'pron. 其他人/物',
    take: 'v. 采取；拿；花费', word: 'n. 单词；话语', words: 'n. 词；话语',
    better: 'adj. 更好的；adv. 更好地', company: 'n. 公司；陪伴',
    companies: 'n. 公司（复数）', high: 'adj. 高的；高度的',
    public: 'adj. 公共的；n. 公众', something: 'pron. 某事；某物',
    through: 'prep. 通过；穿过', rather: 'adv. 相当；宁愿（rather than 而不是）',
    well: 'adv. 好地；adj. 健康的', become: 'v. 变成；成为', person: 'n. 人',
    still: 'adv. 仍然；adj. 静止的', information: 'n. 信息；资料',
    instead: 'adv. 代替；反而', around: 'prep. 围绕；adv. 大约',
    government: 'n. 政府', worker: 'n. 工人；员工', workers: 'n. 劳动者（复数）',
    between: 'prep. 在……之间', different: 'adj. 不同的', important: 'adj. 重要的',
    likely: 'adj. 可能的；adv. 很可能', talk: 'v./n. 谈话；交谈',
    great: 'adj. 巨大的；很好的', last: 'adj. 最后的；上一个的；v. 持续',
    problem: 'n. 问题；难题', women: 'n. 女性（复数）', once: 'adv. 一次；曾经；conj. 一旦',
    right: 'adj. 合适的；正确的；n. 权利', back: 'adv. 回来；n. 背部',
    both: 'det. 两者都', example: 'n. 例子；例证', research: 'n./v. 研究',
    business: 'n. 商业；企业；事务', conversation: 'n. 对话；交谈',
    energy: 'n. 精力；能源', human: 'adj. 人类的；n. 人', real: 'adj. 真实的；真正的',
    same: 'adj. 相同的', another: 'det. 另一个；再一个', below: 'prep. 在……下面；adv. 如下',
    national: 'adj. 全国的；国家的', parent: 'n. 父亲（或母亲）；家长',
    parents: 'n. 父母；家长', economic: 'adj. 经济的', kid: 'n. 小孩', kids: 'n. 孩子（复数）',
    know: 'v. 知道；认识', past: 'n. 过去；adj. 过去的', plan: 'n./v. 计划',
    state: 'n. 状态；州；国家；v. 陈述', states: 'n. 州；国家（复数）',
    want: 'v. 想要；需要', keep: 'v. 保持；继续', researcher: 'n. 研究人员',
    researchers: 'n. 研究人员（复数）', today: 'adv. 今天；如今',
    federal: 'adj. 联邦的', focus: 'n. 焦点；v. 集中（focus on 聚焦于）',
    food: 'n. 食物', least: 'det. 最少的（at least 至少）',
    long: 'adj. 长的；adv. 长久地', longer: 'adv. 更久（no longer 不再）',
    money: 'n. 钱；资金', power: 'n. 力量；权力；电力', used: 'adj. 用过的（used to 过去常常）',
    among: 'prep. 在……之中', average: 'adj. 平均的；n. 平均数', chart: 'n. 图表',
    come: 'v. 来；出现', mean: 'v. 意味着；adj. 吝啬的', means: 'n. 方法；手段',
    part: 'n. 部分；角色', without: 'prep. 没有；不', activity: 'n. 活动',
    activities: 'n. 活动（复数）', doing: 'v. 做（现在分词）', market: 'n. 市场',
    reading: 'n. 阅读；adj. 阅读的', way: 'n. 方式；方法', ways: 'n. 方式（复数）',
    always: 'adv. 总是', common: 'adj. 常见的；共同的', growth: 'n. 增长；成长',
    happiness: 'n. 幸福；快乐', hard: 'adj. 困难的；adv. 努力地',
    increase: 'n./v. 增加；增长', product: 'n. 产品', products: 'n. 产品（复数）',
    since: 'conj. 自从；因为', enough: 'det. 足够的；adv. 足够地',
    having: 'v. 有；进行（现在分词）', homework: 'n. 家庭作业',
    little: 'adj. 小的；少的', remember: 'v. 记得；记住', share: 'v. 分享；共有',
    suppose: 'v. 假设；认为', true: 'adj. 真的；正确的', against: 'prep. 反对；靠着',
    economy: 'n. 经济；经济体', effect: 'n. 影响；效果', impact: 'n./v. 影响；冲击',
    issue: 'n. 问题；议题；v. 发布', result: 'n. 结果；v. 导致', reason: 'n. 原因；理由',
    level: 'n. 水平；层级', process: 'n. 过程；v. 处理', project: 'n. 项目；课题',
    role: 'n. 角色；作用', value: 'n. 价值；v. 重视', view: 'n. 观点；看法',
    approach: 'n. 方法；v. 接近', challenge: 'n. 挑战；v. 质疑',
    evidence: 'n. 证据；迹象', experience: 'n. 经验；经历；v. 体验',
    industry: 'n. 行业；产业', policy: 'n. 政策',
    pressure: 'n. 压力', risk: 'n. 风险；v. 冒……的风险',
    society: 'n. 社会', system: 'n. 系统；制度', technology: 'n. 技术',
    training: 'n. 培训；训练', trend: 'n. 趋势', workforce: 'n. 劳动力；员工队伍',
    /* 考研英语二真题里的核心词（结合具体年份语境取义） */
    reskill: 'v. 再培训；技能重塑', reskilling: 'n. 技能再培训（为适应新岗位重新培训）',
    thorny: 'adj. 棘手的；难处理的', loneliness: 'n. 孤独；孤独感',
    downtime: 'n. 休息时间；停工期', burnout: 'n. 精疲力竭；职业倦怠',
    overwhelming: 'adj. 令人不知所措的；压倒性的', retirement: 'n. 退休',
    collaboration: 'n. 协作；合作', harness: 'v. 利用；驾驭',
    innovative: 'adj. 创新的；革新的', premium: 'adj. 高端的；n. 溢价',
    resistance: 'n. 阻力；抵抗', propelling: 'adj. 推进的；提供动力的',
    upwash: 'n. 上升气流（编队飞行时的上洗气流）', formation: 'n. 编队；形成',
    epidemic: 'n. 流行病；（坏事的）蔓延', cigarette: 'n. 香烟',
    guilt: 'n. 内疚；罪责', moral: 'adj. 道德的；n. 寓意',
    destructive: 'adj. 破坏性的', buzzword: 'n. 流行语；时髦术语',
    linguist: 'n. 语言学家', coach: 'n. 教练；辅导者；v. 辅导',
    parachute: 'v. 空降；伞降', corporate: 'adj. 公司的；企业的',
    pandemic: 'n. 大流行病', shortage: 'n. 短缺；不足',
    unemployment: 'n. 失业', mismatch: 'n. 不匹配；错配',
    collective: 'adj. 集体的；共同的', obvious: 'adj. 明显的',
    benefit: 'n. 好处；v. 有益于', concerned: 'adj. 有关的；担忧的',
    individual: 'adj. 个人的；n. 个人', strategy: 'n. 策略；战略',
    skill: 'n. 技能', skills: 'n. 技能（复数）', effort: 'n. 努力',
    energised: 'adj. 精力充沛的', drained: 'adj. 精疲力尽的',
    irritability: 'n. 易怒；烦躁', calendar: 'n. 日程表；日历',
    recognise: 'v. 意识到；认出', serendipity: 'n. 意外发现美好事物的机缘',
    /* 联想/界面常见 */
    paper: 'n. 试卷；论文（此处指真题试卷，不指"纸"）',
    term: 'n. 术语；学期', context: 'n. 语境；上下文',
    sentence: 'n. 句子', meaning: 'n. 含义；意义',
    note: 'n. 备注；笔记', source: 'n. 来源；出处', manual: 'adj. 手动的；手工的',
    /* 缩写与所有格:词典不收,真题里却很常见 */
    "it's": "it is / it has 的缩写（它是；它有）",
    "don't": 'do not 的缩写（不；别）',
    "doesn't": 'does not 的缩写（不；并不）',
    "didn't": 'did not 的缩写（没有；过去不）',
    "isn't": 'is not 的缩写（不是）',
    "aren't": 'are not 的缩写（不是）',
    "can't": 'cannot 的缩写（不能；不可能）',
    "won't": 'will not 的缩写（将不；不愿意）',
    "you're": 'you are 的缩写（你是；你们是）',
    "you'll": 'you will 的缩写（你将）',
    "we're": 'we are 的缩写（我们是）',
    "they're": 'they are 的缩写（他们是）',
    "that's": 'that is 的缩写（那是；也就是说）',
    "there's": 'there is 的缩写（有；存在）',
    "people's": "people 的所有格（人们的）",
    "children's": "children 的所有格（孩子们的）",
    "author's": "author 的所有格（作者的）",
    "child's": "child 的所有格（孩子的）",
    "company's": "company 的所有格（公司的）",
    "world's": "world 的所有格（世界的）",
    ones: 'one 的复数（指代前文提到的复数名词）',
    dominating: 'adj. 占主导地位的；主要的',
    composed: 'v. 组成（be composed of 由……组成）',
    wholly: 'adv. 完全地；统统',
    issue: 'n. 议题；问题（此处不指"期号/发行"）',
    address: 'v. 处理；应对（此处不指"地址"）'
  };

  /* 多义词:结合例句给出最贴切的一个义项（优先于通用义） */
  const CTX = [
    { w: 'social', re: /social\s+(life|media|burnout|limit|activities|conversation)/i,
      t: 'adj. 社交的（此处指社交生活，不是"社会的"）' },
    { w: 'life', re: /social\s+life/i, t: 'n. 社交生活（social life 固定搭配）' },
    { w: 'life', re: /life\s+changes/i, t: 'n. 生活（人生阶段的变化）' },
    { w: 'right', re: /what.s right for|right (amount|time|way|thing|balance)/i,
      t: 'adj. 合适的；恰当的（不是"正确的/右边的"）' },
    { w: 'right', re: /rights|human rights/i, t: 'n. 权利' },
    { w: 'paper', re: /the paper|exam|test|真题/i, t: 'n. 试卷（真题卷）' },
    { w: 'text', re: /Text\s*[1-4]/i, t: 'n. 阅读篇目（原题 Text 1–4 的编号）' },
    { w: 'sheet', re: /ANSWER SHEET/i, t: 'n. 答题卡（答题纸）' },
    { w: 'mark', re: /mark your answers/i, t: 'v. 涂写；把答案涂在答题卡上' },
    { w: 'state', re: /United States|federal|state government/i, t: 'n. 州；国家' },
    { w: 'state', re: /state of|emotional state/i, t: 'n. 状态' },
    { w: 'part', re: /Part\s+[AB]/i, t: 'n. 部分（试卷的 A/B 节）' },
    { w: 'company', re: /companies|business|firm|employer/i, t: 'n. 公司；企业' },
    { w: 'work', re: /working from home|at work/i, t: 'v. 工作；上班' },
    { w: 'work', re: /work out|work well|doesn.t work/i, t: 'v. 奏效；起作用' },
    { w: 'mean', re: /means of|the means|by means/i, t: 'n. 手段；方法' },
    { w: 'figure', re: /figure out/i, t: 'v. 弄明白；想出' },
    { w: 'address', re: /address (the|this|these|problem|issue)/i, t: 'v. 处理；应对' },
    { w: 'issue', re: /issue of|key issue/i, t: 'n. 议题；问题' }
  ];

  /* 简单词形还原,覆盖 -s/-es/-ed/-ing/-ly 等常见变形 */
  function forms(w) {
    const out = [w];
    const push = x => { if (x && x.length > 1 && out.indexOf(x) < 0) out.push(x); };
    if (/ies$/.test(w)) push(w.slice(0, -3) + 'y');
    if (/(ches|shes|sses|xes)$/.test(w)) push(w.slice(0, -2));
    if (/s$/.test(w) && !/(ss|us|is)$/.test(w)) { push(w.slice(0, -1)); }
    if (/ed$/.test(w)) { push(w.slice(0, -2)); push(w.slice(0, -1)); push(w.slice(0, -3)); }
    if (/ing$/.test(w)) { push(w.slice(0, -3)); push(w.slice(0, -3) + 'e'); push(w.slice(0, -4)); }
    if (/ly$/.test(w)) push(w.slice(0, -2));
    if (/’|'/.test(w)) push(w.replace(/[’']s?$/, ''));
    return out;
  }

  const DATA = global.E2GLOSS_DATA || {};    // 8861 条,覆盖全部真题词

  function lookup(word, sentence) {
    const w = String(word || '').toLowerCase().replace(/[’']/g, "'");
    const s = String(sentence || '');
    const fs = forms(w);
    for (const r of CTX) {                    // ① 结合例句选多义项
      if (r.w === w && r.re.test(s)) return r.t;
    }
    for (const k of fs) {                     // ② 人工校订过的真题语境释义
      if (G[k]) return G[k];
    }
    for (const r of CTX) {                    // ③ 变形词也套语境规则
      if (fs.some(f => f.indexOf(r.w) === 0) && r.re.test(s)) return r.t;
    }
    for (const k of fs) {                     // ④ 词典兜底,保证点哪个词都有中文
      if (DATA[k]) return DATA[k];
    }
    return '';
  }

  global.E2GL = { lookup, forms, table: G, data: DATA, rules: CTX };
})(window);
