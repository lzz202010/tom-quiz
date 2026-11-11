/* e2 作文模版 · 内容数据(window.WR2) · 八哥smile 英语二写作体系
   数据源:资料/e2/writing-sources/(八哥大作文预测/小作文终极预测/7次带练汇总/图表漫画方法)
   核心思路:全部题型共用一套背诵句 —— 核心句在 句库(core)→模版(big/small)→范文(samples)
   →练习(practice)→挖空(drill) 五处反复复现,考场直接默写。 */
(function () {
  'use strict';

  /* ═══════════ 分题型自查:不要把书信的格式要求套到告示/纪要 ═══════════ */
  const CHECK_SMALL = [
    '首段 As a…, I am writing this email to + 目的(动词组照抄)',
    '题目任务点逐条覆盖,一条不漏(一般 2~3 点)',
    '用了对应素材包:活动三句 / 事物优点 / 建议四句 / 道歉三句…',
    '尾段 I really hope that you can accept my X. + looking forward to your early reply',
    '落款 Li Ming / Zhang Wei(按题干),没写真名',
    '100 词左右(80~110)'
  ];
  const CHECK_NOTICE = [
    '标题 Notice 居中,日期写在标题下一行右侧',
    '首段 This notice is written to + 通知目的,任务点齐全',
    '活动三句齐全:时间地点 / 目的 / 流程;招募类再写志愿者要求',
    '结尾有联系方式和 Come on and join us now!',
    '落款写机构(如 The Student Union),不写 Li Ming,不写书信尾段',
    '100 词左右(80~110)'
  ];
  const CHECK_MINUTES = [
    'Subject / Date / Location / Present 顶格;题干没给出席者就不编',
    'The minutes are as follows: 后至少写 3 个要点',
    '流程 / 目的 / 其他要点均回应题干,不套书信称呼和尾段',
    '要点用编号,句子主谓一致,时间地点与题干一致',
    '100 词左右(80~110)'
  ];
  const CHECK_BIG = [
    '第一段点图;静态按 lion\'s share / second largest / respectively 写清占比',
    '第二段 First and foremost 从中获益(3 个短语)+ In addition 原因二',
    '收尾 With due consideration… is projected to show an upward trend',
    '衔接词齐全:First and foremost / In addition / By contrast',
    '字数 150 左右(130~175 都安全)',
    '占比、主谓一致和自己最易错的句再检查一遍'
  ];
  const CHECK_BIG_DYNAMIC = [
    '第一段点图;动态数据写全 from…to…、年份和单位',
    '上升/下降用词与图中趋势一致,没有把 billion 和「亿」混写',
    '第二段 First and foremost 从中获益(3 个短语)+ In addition 原因二',
    '收尾 With due consideration… is projected to show an upward trend',
    '字数 150 左右(130~175 都安全)',
    '数字、主谓一致和自己最易错的句再检查一遍'
  ];
  const CHECK_BIG_COMBO = [
    '第一段先写漫画,再用 Meanwhile, there is a chart… 写图表',
    '漫画人物、话语和图表数值都与题目一致,不另编信息',
    '第二段 First and foremost 从中获益(3 个短语)+ In addition 原因二',
    '收尾 With due consideration… is projected to show an upward trend',
    '字数 150 左右(130~175 都安全)',
    '倒装句主谓一致、数据单位和自己最易错的句再检查一遍'
  ];

  /* ═══════════ 核心句库(八哥背诵句,全站复现的母本) ═══════════ */
  const sent = (en, zh, use) =>
    `<li><span class="en">${en}</span><span class="zh">${zh}${use ? `<b class="use-tag">${use}</b>` : ''}</span></li>`;

  const CORE = [
  { id: 'c1', no: '句库 01', title: '小作文骨架', tag: '所有书信通用 · 首段身份+目的,尾段两句', html: `
    <p class="wlead">任何书信,不管感谢还是投诉,骨架只有三段:<b>首段自报身份+说来意,中间段套素材包,尾段两个固定句</b>。首段的身份从句和目的动词组都能从题干直接抄。</p>
    <h3>称谓(按题干)</h3>
    <table class="wtable">
      <tr><th>题干</th><th>写法</th></tr>
      <tr><td>写给机构</td><td>Dear Sir or Madam,</td></tr>
      <tr><td>写给个人(有名字)</td><td>Dear + 人名(直接抄题干)</td></tr>
      <tr><td>写给集体</td><td>Dear experts / Dear all,</td></tr>
    </table>
    <p class="wnote">落款:Yours sincerely, + Li Ming / Zhang Wei(题干指定谁写抄谁,千万别写真名)。</p>
    <h3>首段公式(一句写完)</h3>
    <ul class="wsent">
      ${sent('As <i>a student who wants to learn more things</i>, I am writing this email to <i>apply for admission to Oxford University</i>.', '身份用定语从句(从题干找),目的用下面的动词组。', '万能首段')}
      ${sent('As <i>the president of the Student Union</i>, I am writing this email to invite you to attend the graduation ceremony.', '身份是主席/班长就用 the president of…。')}
      ${sent('It is my great honor to do this survey with you.', '满分加分句,可与上句连用(2024 真题)。')}
    </ul>
    <h3>目的动词组(to 后面照抄)</h3>
    <table class="wtable">
      <tr><th>信型</th><th>to …</th></tr>
      <tr><td>感谢/道歉/祝贺/欢迎</td><td>to express my sincere gratitude / apology / congratulations / welcome to you</td></tr>
      <tr><td>建议</td><td>to make some useful suggestions about <i>主题</i></td></tr>
      <tr><td>推荐</td><td>to recommend you <i>东西</i>(a song / a major / Peking Roast Duck / a person)</td></tr>
      <tr><td>邀请</td><td>to invite you to <i>attend 活动</i></td></tr>
      <tr><td>申请</td><td>to apply for <i>a job / admission / a scholarship</i></td></tr>
      <tr><td>询问</td><td>to ask if you could give me some information about <i>主题</i></td></tr>
      <tr><td>请求</td><td>to ask if you could <i>题干信息</i></td></tr>
      <tr><td>告知/辞职</td><td>to tell you my decision to <i>quit</i></td></tr>
      <tr><td>投诉</td><td>to make a complaint about <i>商品/服务</i></td></tr>
    </table>
    <h3>尾段两句(所有信型通用)</h3>
    <ul class="wsent">
      ${sent('I really hope that you can accept my <i>suggestions / invitation / apology / recommendation / complaint</i>.', 'X 换成信型名词。', '尾段第 1 句')}
      ${sent('I am looking forward to your early reply.', '尾段第 2 句,原样背。', '尾段第 2 句')}
    </ul>
    <div class="wbox"><h4>去练这组</h4><p><a href="#/drill/c1" class="golink">挖空默写「小作文骨架」›</a></p></div>` },

  { id: 'c2', no: '句库 02', title: '活动三句', tag: '题干有活动/事件就能用:邀请·告示·备忘录·介绍·欢迎', html: `
    <p class="wlead">八哥体系的<b>第一素材包</b>:只要题干出现会议/比赛/夏令营/文化节/义卖/毕业典礼,中间段就写这三句(+被邀人重要性一句)。时间地点从题干抄,目的和流程用短语库填。</p>
    <h3>① 时间地点(被动固定句)</h3>
    <ul class="wsent">
      ${sent('<i>The ceremony</i> is to be held by our university <i>on the playground</i> at <i>8 a.m. on June 15th</i>.', '活动名 is to be held by 主办方 + 地点 + 时间,全部照题干替换。', '邀请/告示/备忘录')}
      ${sent('地点三选一:室内 at the auditorium / 室外 on the playground / 线上 at Ding Talk', '题干没给地点就从这三个里挑。')}
    </ul>
    <h3>② 活动目的(aims + smile bar 八短语)</h3>
    <ul class="wsent">
      ${sent('It aims to <i>enrich their campus life</i>, <i>relieve their pressure</i> and <i>shorten the distance between students</i>.', 'aims to do A, do B and do C,三个短语从下面 smile bar 里选。', '一切活动')}
    </ul>
    <div class="wbox"><h4>smile bar 八短语(背顺序:s-m-i-l-e-b-a-r)</h4>
      <p>shorten the distance between students 拉近距离 · make their campus colorful 多姿多彩 · improve X 提高X(自信 confidence / 爱心 love / 责任感 the social sense of responsibility / 身体素质 physical conditions / 创造性 creativity) · liberate their imagination 解放想象力 · enrich their life 丰富生活 · broaden their horizons 开阔视野 · arouse their interest in X 唤起兴趣 · relieve their pressure 缓解压力</p></div>
    <h3>③ 活动流程/内容</h3>
    <ul class="wsent">
      ${sent('It includes a variety of procedures, such as <i>the opening session</i>, <i>the speech-delivering part</i> and <i>the awarding part</i>.', '流程词库随便挑三个。', '邀请/告示/纪要')}
      ${sent('流程词库:the opening session 开幕 · the question and answering part 问答 · the awarding part 颁奖 · the speech-delivering part 致辞 · the dinner party 晚宴 · the grateful education 感恩教育 · the basketball competition 篮球赛', '记中文就行,英文现场拼。')}
    </ul>
    <h3>④ 被邀请人重要性(长辈/平辈二选一)</h3>
    <ul class="wsent">
      ${sent('You have enjoyed popularity in our university, so your coming will be our great honor.', '对长辈/专家/教授用这句。', '邀请信专用')}
      ${sent('This is especially for you, so you will have a good time then.', '对同学/平辈用这句。', '邀请信专用')}
    </ul>
    <div class="wbox"><h4>去练这组</h4><p><a href="#/drill/c2" class="golink">挖空默写「活动三句」›</a></p></div>` },

  { id: 'c3', no: '句库 03', title: '事物优点四句', tag: '推荐信/介绍信:推荐景点·美食·专业·歌曲·社团', html: `
    <p class="wlead">推荐<b>任何东西</b>(长城、北京烤鸭、临床医学、Faded、传统文化社团)都用这四句:总论 → 从中获益 → 有名 → 有意思。<b>「从中获益」就是大作文第二段的同一套短语</b>,背一遍两边用。</p>
    <ul class="wsent">
      ${sent('The reasons why I recommend this to you are as follows.', '总论句,原样背。', '推荐信第 1 句')}
      ${sent('First and foremost, from <i>visiting the Great Wall</i>, you can get numerous benefits, such as <i>broadening your horizons, arousing your interest in Chinese culture and acquiring unique experience</i>.', 'from + 干什么, you can get numerous benefits, such as + 三个获益短语。', '★全站最高频句')}
      ${sent('In addition, <i>the Palace Museum</i> is quite famous, enjoying a great reputation all over the world.', '有名句:enjoying 现在分词拖尾。', '事物·城市·大学都行')}
      ${sent('Last but not least, it is so <i>splendid</i> that I never fail to be attracted to it, which leaves a deep impression on me.', '有意思句。形容词按对象换:interesting 有趣 / promising 有前景 / yummy 美味 / splendid 宏伟。', '推荐信收尾')}
    </ul>
    <div class="wbox"><h4>去练这组</h4><p><a href="#/drill/c3" class="golink">挖空默写「事物优点四句」›</a></p></div>` },

  { id: 'c4', no: '句库 04', title: '建议四句 + 三大从句', tag: '建议信/回复信 · 按目标分数选从句', html: `
    <p class="wlead">建议信=总论句+三个建议句。建议的内容用「动词+名词」从题干想(学语法/延长开放时间/找导游),句尾再挂一个从句冲分:<b>四级未过挂 which 从句,四级过了挂 so that,六级过了挂 because</b> —— 全都背 also 可以,考场上哪个顺手写哪个。</p>
    <ul class="wsent">
      ${sent('Here are some useful suggestions about <i>improving your translation</i>.', '总论句,about 后接主题。', '建议信第 1 句')}
      ${sent('First and foremost, it is necessary for <i>you / our library / the government</i> to <i>purchase more books</i>.', '建议 1:it is necessary for sb to do sth。', '建议 1')}
      ${sent('In addition, <i>you</i> are supposed to <i>read more books</i>.', '建议 2:be supposed to do。', '建议 2')}
      ${sent('Last but not least, <i>more practice</i> should be <i>done</i>.', '建议 3:被动句,名词提前。', '建议 3')}
      ${sent('…, <b>which would be beneficial to you</b>. / …, <b>which would bring convenience to students</b>.', '从句一(结果/定从):两种拖尾换着用。', '★四级未过也背')}
      ${sent('…, <b>so that you can broaden your horizons, arouse your interest in reading and enrich your campus life</b>.', '从句二(目的):so that + 三个获益短语。', '★和获益库联动')}
      ${sent('…, <b>because practice makes perfect</b>.', '从句三(原因):because + 一句理由。')}
    </ul>
    <div class="wbox"><h4>「动词+名词」题库(真题都从这里出)</h4>
      <p>图书馆(2007):安装空调 · 购买更多书 · 延长开放时间 prolong the opening time · 改善预约系统 · 提供更多座位<br>
      食堂:降低价格 lower the price · 丰富食物种类 enrich the kinds of foods<br>
      学翻译(2016):学语法 study grammar · 找专业老师 · 读更多英文书 · 做练习 do more practice<br>
      古建筑调查(2024):读更多书籍 · 查找相关资料 · 找当地导游 find a local guide · 带一个相机</p></div>
    <div class="wbox"><h4>去练这组</h4><p><a href="#/drill/c4" class="golink">挖空默写「建议四句」›</a></p></div>` },

  { id: 'c5', no: '句库 05', title: '道歉三句', tag: '原因+背锅+补救 · 三句拿满道歉信中间段', html: `
    <p class="wlead">道歉信中间段就这三句:<b>犯错原因(粗心)+全面背锅+补救办法</b>。原因统一说「太粗心忘了检查行李/时间表」,补救满足对方任何合理要求。</p>
    <ul class="wsent">
      ${sent('The reason for my mistake was that I was so careless that I failed to <i>check my luggage carefully</i>.', '原因句:so careless that I failed to do。短语按题换:check my schedule / book a flight ticket / arrange my schedule reasonably。', '道歉 1')}
      ${sent('I take full responsibility and I assure you that this won\'t happen again.', '背锅句,原样背。', '道歉 2')}
      ${sent('To make up for my fault, I will satisfy any reasonable request you make.', '补救句。2008 真题变体:you can buy a new one in Canada, and I will pay for it.', '道歉 3')}
    </ul>
    <div class="wbox"><h4>去练这组</h4><p><a href="#/drill/c5" class="golink">挖空默写「道歉三句」›</a></p></div>` },

  { id: 'c6', no: '句库 06', title: '感谢四句', tag: '反面假设+正面解决 · 后两句 80 分以上再背', html: `
    <p class="wlead">感谢信的杀手锏是<b>反面假设句</b>:假如没有你的帮助,我就不会……。后面接三个「没有得到帮助的后果」,直接套获益库的过去分词版(improved / found / made)。</p>
    <ul class="wsent">
      ${sent('If I had not got your assistance, I fear that I might not have <i>improved my spoken English, found a nice apartment and made more friends</i>.', '反面假设(虚拟语气原样背),三个后果从题干想:提高口语/找到公寓/交到朋友/适应新环境 adapted to a new environment。', '★感谢信核心句')}
      ${sent('However, with your help, I solved many problems.', '正面句,短但必需。', '感谢 2')}
      ${sent('Although nowadays many people talk about the need to be unselfish and to help others, we see very few people practice what they preach.', '升华句(80+ 再背):说别人光说不做。', '冲高分')}
      ${sent('But you showed by your actions that you are an exception.', '升华句下半:用行动证明你是例外。', '冲高分')}
    </ul>
    <p class="wnote">感谢+邀请是八哥点名的预测组合:感谢之后接 I want to invite you to visit the Great Wall. It is quite famous, enjoying a great reputation in the world.(事物优点句复现)</p>
    <div class="wbox"><h4>去练这组</h4><p><a href="#/drill/c6" class="golink">挖空默写「感谢四句」›</a></p></div>` },

  { id: 'c7', no: '句库 07', title: '人物优点 + 志愿者', tag: '申请信(我)·推荐人(他)·告示志愿者(他们)', html: `
    <p class="wlead">写「人」的优点就这四句,人称随题型换:申请信 I、推荐信 he/she、招募告示 they。志愿者告示直接把后两句挂在活动三句后面。</p>
    <ul class="wsent">
      ${sent('I have all the qualifications that are required.', '总论句,原样背。', '人物 1')}
      ${sent('In the past 4 years, I have maintained an average score of 90 and proved myself to be a straight-A student.', '成绩句:年数和分数按题干。', '人物 2')}
      ${sent('I am confident, optimistic and creative, and most importantly I have strong communication skills.', '性格句:括号里可换 leadership / teamwork spirit。', '人物 3')}
      ${sent('I have worked as <i>a volunteer teacher</i>, and I have attained a fair knowledge and experience in this field.', '经历句。', '人物 4')}
      ${sent('Several volunteers are needed for this activity.', '志愿者总论(告示用)。', '告示·招募')}
      ${sent('They should be warm-hearted, patient and energetic.', '性格(they 版)。', '告示·招募')}
      ${sent('In addition, they ought to have good communication skills and be proficient in English.', '能力(they 版),和人物 3 是同一套词。', '告示·招募')}
    </ul>
    <div class="wbox"><h4>去练这组</h4><p><a href="#/drill/c7" class="golink">挖空默写「人物优点+志愿者」›</a></p></div>` },

  { id: 'c8', no: '句库 08', title: '询问 · 投诉 · 祝贺', tag: '各三两句 · 组合信的配料', html: `
    <p class="wlead">三种小配角,常和主信型组合出题(2024 英语二就是建议+询问)。句子少,直接背。</p>
    <h3>询问三句</h3>
    <ul class="wsent">
      ${sent('First and foremost, can you tell me <i>how I can get the ticket</i>?', '疑问词 what/when/where/why/how + 问题 1。', '询问 1')}
      ${sent('In addition, I would also like to inquire <i>the exact time of the concert</i>.', '询问 2:inquire + 问题 2。')}
      ${sent('Another aspect I am concerned about is <i>the price of the ticket</i>.', '询问 3。')}
    </ul>
    <h3>投诉四句(产品/服务)</h3>
    <ul class="wsent">
      ${sent('The factors for my disappointment can be listed as follows.', '投诉总论。', '投诉 1')}
      ${sent('Firstly, the <i>screen</i> worked in the first day, but later showed some obvious problems.', '问题 1:名词按题换 screen / keyboard / light / TV。', '投诉 2')}
      ${sent('Secondly, I am not satisfied with your after-sales service.', '问题 2:售后态度,固定。', '投诉 3')}
      ${sent('I strongly demand that you should compensate for my loss.', '诉求句:demand that sb should do(虚拟)。', '投诉 4')}
    </ul>
    <h3>祝贺两句</h3>
    <ul class="wsent">
      ${sent('Your own intelligence and diligence have earned you this achievement.', '把成就归功于对方的聪明+勤奋。', '祝贺 1')}
      ${sent('I can well imagine that your parents are so proud of you now and anxiously hope to witness your brilliant success.', '想象父母骄傲,场面话。', '祝贺 2')}
    </ul>
    <div class="wbox"><h4>去练这组</h4><p><a href="#/drill/c8" class="golink">挖空默写「询问·投诉·祝贺」›</a></p></div>` },

  { id: 'c9', no: '句库 09', title: '大作文 · 动态图数据句', tag: '数字在变就用这组:增长/下降/翻倍', html: `
    <p class="wlead">动态图(柱/线/表,年份对比)第一段全部用「<b>great changes 句 + witness 句</b>」:一句写降的,一句写升的,数据 from A to B 给全。</p>
    <ul class="wsent">
      ${sent('From the chart, we can clearly see that great changes have taken place in <i>the sales of electric vehicles</i>, <i>increasing dramatically from 0.77 million in 2018 to 4.2 million in 2021</i>.', '主句+现在分词拖尾,一降一升各用一次。', '★动态图第 1 句')}
      ${sent('On the contrary, a remarkable rise was witnessed in <i>the number of online education users</i>, rising from 0.11 billion to 0.423 billion during the same period.', 'witness 被动:上升下降都能换(was witnessed in…rising from…to…)。', '★动态图第 2 句')}
      ${sent('And the percentage of <i>starting a business</i> doubled during the same period.', '小数据一句话:翻倍/略升(ranged from 8% to 20%)。', '动态图收尾')}
      ${sent('数字表达:increasing dramatically 猛增 / decreasing dramatically 猛降 / a steady rise 稳升 / ranging from A to B 从A到B', '记四个就够全部真题。')}
    </ul>
    <div class="wbox"><h4>去练这组</h4><p><a href="#/drill/c9" class="golink">挖空默写「动态图数据句」›</a></p></div>` },

  { id: 'c10', no: '句库 10', title: '大作文 · 静态图数据句', tag: '饼图/单年柱图:最大·第二·其他', html: `
    <p class="wlead">静态图(某一年占比)第一段三件套:<b>lion's share 最大份额 → second largest 第二 → By contrast 其余分别</b>。三个句型把任何饼图写完。</p>
    <ul class="wsent">
      ${sent('The proportion of <i>mobile payment</i> gets the lion\'s share, occupying <i>50%</i>.', '最大项:lion\'s share(最大份额)+ occupying。', '★静态图第 1 句')}
      ${sent('The percentage of <i>credit card</i> takes up the second largest part, with <i>25%</i>.', '第二项:take up the second largest part, with。', '★静态图第 2 句')}
      ${sent('By contrast, that of <i>cash and others</i> only accounts for 17% and 8% respectively.', '其余项:that of 指代 + respectively(分别)。', '★静态图第 3 句')}
      ${sent('The pie chart reflects <i>the survey of the payment ways of the residents in a certain city in 2019</i>.', '首句点图:chart 名 + the survey of 主题 + 时间地点,全部照题干抄。', '动/静通用首句')}
    </ul>
    <div class="wbox"><h4>去练这组</h4><p><a href="#/drill/c10" class="golink">挖空默写「静态图数据句」›</a></p></div>` },

  { id: 'c11', no: '句库 11', title: '大作文 · 从中获益 + 原因二', tag: '第二段万能:获益三短语 + 四种原因二', html: `
    <p class="wlead">第二段固定结构:<b>总起句 → First and foremost 从中获益(三个短语)→ In addition 原因二</b>。获益短语和小作文是同一套(复现!),原因二从四备选里挑一个。</p>
    <ul class="wsent">
      ${sent('Actually, there are two noteworthy factors that may contribute to this phenomenon.', '总起句(词多版:a host of complicated driving factors…留给漫画)。', '第二段第 1 句')}
      ${sent('First and foremost, from <i>using mobile payment</i>, we can get numerous benefits, such as <i>improving the work efficiency, making our life more convenient and saving our time greatly</i>, which would explain what appears in the chart.', '★全体系最高频句:from + 干什么, we can get numerous benefits, such as + 三短语。', '★大作文核心句')}
      ${sent('which would explain what appears in the chart.', '拖尾从句,挂在获益句后,把原因和图表勾连。', '加满句')}
    </ul>
    <div class="wbox"><h4>获益短语库(大小作文通吃,和 smile bar 联动)</h4>
      <p>make our life more convenient 便利 · save time / money greatly 省时省钱 · improve the work / study efficiency 提效 · make full use of fragmented time 碎片时间 · enrich our life 丰富生活 · broaden our horizons 开阔视野 · acquire unique experience 独特体验 · relieve the pressure 缓解压力 · acquire more advanced knowledge and better resources 更优资源 · lead a low-carbon lifestyle 低碳 · make our own contributions to environmental protection 环保贡献 · acquire a higher platform 更高平台 · learn more things 学到更多</p></div>
    <h3>原因二(四选一,按话题挑)</h3>
    <ul class="wsent">
      ${sent('In addition, with the advancement in science and technology, <i>the Internet industry</i> has been enjoying a rapid development, thus providing people with more choices.', '①行业版:互联网/手机/电池/交通设施/电影/小说行业,换名词复用。', '★最常用')}
      ${sent('In addition, it is universally acknowledged that the government is sparing no effort to <i>encourage students to combine theory with practice</i>.', '②政策版:政府不遗余力。', '教育类话题')}
      ${sent('In addition, in recent years, China has been characterized by the increase in people\'s income and the rapid development in economy, which enabled people to possess extra money to <i>buy more meat</i>.', '③收入版:收入提高买得起。', '消费类话题')}
      ${sent('In addition, it is difficult for many people to <i>cook their own foods</i> because <i>they are so busy with their work</i>.', '④反面版:别的选项不行,所以选它(太忙没法做饭/堵车不开私家车)。', '★生活方式类')}
    </ul>
    <div class="wbox"><h4>去练这组</h4><p><a href="#/drill/c11" class="golink">挖空默写「从中获益+原因二」›</a></p></div>` },

  { id: 'c12', no: '句库 12', title: '收尾预测 + 漫画两句', tag: '第三段一句收尾 · 图表漫画组合第一段', html: `
    <p class="wlead">第三段只有一句(最多加半句建议):<b>With due consideration 预测句</b>。另外,大纲新宠「图表+漫画」组合题的第一段是两个固定句,先漫画后图表。</p>
    <h3>第三段 · 收尾</h3>
    <ul class="wsent">
      ${sent('With due consideration of all these factors, we may make a rational prediction: <i>the percentage of mobile payment</i> is projected to show an upward trend.', '★万能收尾:rational prediction + is projected to show an upward trend。', '所有大作文')}
      ${sent('With due consideration of all these contributors, we may make a rational prediction…', '变体:contributors / factors 换用,防雷同。')}
    </ul>
    <h3>图表+漫画 · 第一段两句</h3>
    <ul class="wsent">
      ${sent('As is shown above, at <i>the right side of the cartoon</i> is <i>a car owner</i> who is saying, "<i>Electric vehicle helps me save a lot of money.</i>"', '①先漫画:完全倒装 at the …side is a 人 who is saying "翻译气泡"。', '★组合题第 1 句')}
      ${sent('Meanwhile, there is a chart which shows that <i>the sales of electric vehicles increased from 4.5 million in 2021 to 9.5 million in 2024</i>.', '②后图表:There be + 动态句/静态句复现。', '★组合题第 2 句')}
    </ul>
    <h3>纯漫画 · 第二段两句(论证主题重要)</h3>
    <ul class="wsent">
      ${sent('Actually, there are a host of complicated driving factors that may explain the importance of <i>insisting on dreams</i>, and the two most noteworthy ones could be summarized as follows.', '纯漫画专用总起(比图表版词多)。', '纯漫画')}
      ${sent('In addition, studies from Harvard University have found that college students—those who <i>insist on their dreams</i>—excel other students on a range of education and career achievement factors.', '哈佛研究句:那些主题词的大学生领先他人。', '纯漫画冲分')}
    </ul>
    <div class="wbox"><h4>去练这组</h4><p><a href="#/drill/c12" class="golink">挖空默写「收尾+漫画句」›</a></p></div>` }
  ];

  /* ═══════════ 挖空默写题(答案判等时忽略大小写/空格/尾部标点) ═══════════ */
  const DRILL = [
    { g: 'c1', s: 'As a die-hard fan of your newspaper, I am writing this letter to ___ my views.', a: 'express', zh: '表达我的观点(首段目的)' },
    { g: 'c1', s: 'I really hope that you can ___ my suggestions.', a: 'accept', zh: '希望你接受我的建议(尾段)' },
    { g: 'c1', s: 'I am looking forward to your early ___.', a: 'reply', zh: '期待早日回复(尾段)' },
    { g: 'c2', s: 'The ceremony ___ ___ ___ by our university on the playground at 8 a.m. on June 15th.', a: 'is to be held', zh: '典礼将由我校举办(被动)' },
    { g: 'c2', s: 'It ___ to enrich their campus life, relieve their pressure and shorten the distance between students.', a: 'aims', zh: '活动目的句的动词' },
    { g: 'c2', s: 'It includes a ___ of procedures, such as the opening session and the awarding part.', a: 'variety', zh: 'a ___ of 各种各样的' },
    { g: 'c2', s: 'You have ___ ___ in our university, so your coming will be our great honor.', a: 'enjoyed popularity', zh: '您在我校享有盛誉(长辈)' },
    { g: 'c3', s: 'The reasons why I ___ this to you are as follows.', a: 'recommend', zh: '推荐信总论句动词' },
    { g: 'c3', s: 'It is quite famous, ___ a great reputation all over the world.', a: 'enjoying', zh: '享有盛誉(现在分词拖尾)' },
    { g: 'c3', s: 'It is so splendid that I never ___ to be attracted to it, which leaves a deep impression on me.', a: 'fail', zh: '从不未能被吸引(negative 动词)' },
    { g: 'c4', s: 'Here are some useful ___ about improving your translation.', a: 'suggestions', zh: '建议信总论句名词' },
    { g: 'c4', s: '…, which would be ___ to you.', a: 'beneficial', zh: '对你有益(从句拖尾)' },
    { g: 'c4', s: 'you are supposed to read more books ___ ___ you can broaden your horizons.', a: 'so that', zh: '目的从句连接词' },
    { g: 'c4', s: 'Last but not least, an outline ___ ___ ___, which would bring convenience to you.', a: 'should be prepared', zh: '建议3被动句' },
    { g: 'c5', s: 'The reason for my mistake was that I was so ___ that I failed to check my luggage carefully.', a: 'careless', zh: '犯错原因(粗心)' },
    { g: 'c5', s: 'I take full ___ and I assure you that this won\'t happen again.', a: 'responsibility', zh: '全面背锅句名词' },
    { g: 'c5', s: 'To ___ ___ for my fault, I will meet any reasonable request you make.', a: 'make up', zh: '弥补我的过错(短语)' },
    { g: 'c6', s: 'If I had not got your ___, I fear that I might not have improved my spoken English.', a: 'assistance', zh: '感谢信反面假设句名词' },
    { g: 'c6', s: 'However, with your help, I ___ many problems.', a: 'solved', zh: '正面句动词(过去式)' },
    { g: 'c7', s: 'I have all the ___ that are required.', a: 'qualifications', zh: '人物优点总论句名词' },
    { g: 'c7', s: 'I have maintained an average score of 90 and proved myself to be a ___ student.', a: 'straight-a', zh: '全A生(连字符词)' },
    { g: 'c7', s: 'I am confident, ___ and creative, and most importantly I have strong communication skills.', a: 'optimistic', zh: '乐观的(性格三连)' },
    { g: 'c8', s: 'The factors for my ___ can be listed as follows.', a: 'disappointment', zh: '投诉信总论句名词' },
    { g: 'c8', s: 'I am not satisfied with your ___ service.', a: 'after-sales', zh: '售后服务(连字符)' },
    { g: 'c8', s: 'Your own intelligence and ___ have earned you this achievement.', a: 'diligence', zh: '聪明与勤奋(祝贺句)' },
    { g: 'c9', s: 'great changes have ___ ___ in the sales of electric vehicles, decreasing dramatically from 28.01 to 16.81 million.', a: 'taken place', zh: '发生巨变(完成时短语)' },
    { g: 'c9', s: 'a remarkable rise was ___ in the number of online education users.', a: 'witnessed', zh: '见证了上升(被动动词)' },
    { g: 'c10', s: 'the proportion of mobile payment gets the ___ ___, occupying 50%.', a: "lion's share", zh: '最大份额(两词)' },
    { g: 'c10', s: 'the percentage of credit card takes up the ___ largest part, with 25%.', a: 'second', zh: '第二大' },
    { g: 'c10', s: 'that of cash and others only ___ for 17% and 8% respectively.', a: 'accounts', zh: '占比动词(第三人称)' },
    { g: 'c11', s: 'there are two ___ factors that may contribute to this phenomenon.', a: 'noteworthy', zh: '两个值得注意的因素' },
    { g: 'c11', s: 'from using mobile payment, we can get ___ benefits, such as making our life more convenient.', a: 'numerous', zh: '获益句的数量词' },
    { g: 'c11', s: 'with the ___ in science and technology, the Internet industry has been enjoying a rapid development.', a: 'advancement', zh: '随着科技进步(名词)' },
    { g: 'c12', s: 'we may make a rational prediction: the percentage of mobile payment is ___ to show an upward trend.', a: 'projected', zh: '预计呈上升趋势' },
    { g: 'c12', s: 'As is shown above, at the right side of the cartoon ___ a car owner who is saying "…".', a: 'is', zh: '完全倒装,主谓一致' },
    { g: 'c12', s: 'Meanwhile, there is a chart which ___ that the sales of electric vehicles increased…', a: 'shows', zh: '图表句动词' }
  ];

  /* ═══════════ 大作文模版 ═══════════ */
  const big = [
  { id: 't1', no: '模版1', title: '图表原因分析', tag: '大作文 150 词 · 柱/线/饼/表四类通吃', html: `
    <p class="wlead">英语二大作文的指定题型。三段结构固定:<b>第一段数据句,第二段从中获益+原因二,第三段预测收尾</b>。图表只分两类 —— 动态(数字在变)和静态(占比),每类三个句型,见 <a href="#/t/c9" class="golink">句库09 动态</a> / <a href="#/t/c10" class="golink">句库10 静态</a>。</p>
    <div class="wbox">
      <h4>考场三步(拿到图先做)</h4>
      <ol>
        <li>判断动态/静态,把图表标题抄成首句(the survey of <i>标题</i>);</li>
        <li>挑<b>最大值 + 第二 + 一个对照</b>,动态引 2~3 个数,静态引 3 个占比;</li>
        <li>第二段获益短语按话题选 3 个,原因二从四备选挑 1 个(见 <a href="#/t/c11" class="golink">句库11</a>)。</li>
      </ol>
    </div>
    <h3>三段骨架</h3>
    <table class="wtable">
      <tr><th>段落</th><th>任务</th><th>句数</th><th>用哪组句</th></tr>
      <tr><td>第一段</td><td>点图 + 2~3 个数据</td><td>2 句</td><td>句库 09(动态)/ 句库 10(静态)</td></tr>
      <tr><td>第二段</td><td>获益 + 原因二</td><td>2~3 句</td><td>句库 11</td></tr>
      <tr><td>第三段</td><td>预测收尾</td><td>1 句</td><td>句库 12</td></tr>
    </table>
    <h3>第一段 · 两种写法(复现句库 09/10)</h3>
    <ul class="wsent">
      ${sent('The pie chart reflects the survey of <i>the payment ways of the residents in a certain city in 2019</i>.', '首句点图:图名 + the survey of 主题 + 地点年份,照题干抄。')}
      ${sent('动态:great changes have taken place in <i>A</i>, decreasing dramatically from <i>x</i> to <i>y</i>. On the contrary, a remarkable rise was witnessed in <i>B</i>, rising from <i>m</i> to <i>n</i> during the same period.', '一降一升各一句,from…to 给全。')}
      ${sent('静态:the proportion of <i>A</i> gets the lion\'s share, occupying <i>x%</i> and the percentage of <i>B</i> takes up the second largest part, with <i>y%</i>. By contrast, that of <i>C and D</i> only accounts for <i>m% and n%</i> respectively.', '最大 → 第二 → 其余,三句连招。')}
    </ul>
    <h3>第二段 · 获益+原因二(复现句库 11)</h3>
    <ul class="wsent">
      ${sent('Actually, there are two noteworthy factors that may contribute to this phenomenon.', '总起。')}
      ${sent('First and foremost, from <i>主题动作</i>, we can get numerous benefits, such as <i>获益1, 获益2 and 获益3</i>, which would explain what appears in the chart.', '★全体系最高频句,小作文「事物优点」同一句。')}
      ${sent('In addition, with the advancement in science and technology, <i>某行业</i> has been enjoying a rapid development, thus providing people with more choices.', '原因二·行业版(互联网/手机/电池/电影业都能换)。')}
    </ul>
    <h3>第三段 · 收尾(复现句库 12)</h3>
    <ul class="wsent">
      ${sent('With due consideration of all these factors, we may make a rational prediction: <i>主题</i> is projected to show an upward trend.', '万能收尾,一句话写完。')}
    </ul>
    <h3>范文 · 2024 真题(劳动实践课 · 八哥原文)</h3>
    <div class="wsample" data-sample="s-labor"></div>
    <h3>范文 · 2021 真题图(居民锻炼方式 · 按八哥句式写)</h3>
    <figure class="wfig"><img src="figs/2021-w48-p14.webp" alt="2021 真题柱状图:某市居民体育锻炼方式调查" loading="lazy"><figcaption>真题原图:独自锻炼 54.3% · 和朋友 47.7% · 和家人 23.9% · 团体活动 15.8%</figcaption></figure>
    <div class="wsample" data-sample="s-ex2021"></div>` },

  { id: 't2', no: '模版2', title: '漫画 · 纯漫画与图表组合', tag: '大纲新宠 · 组合题两句定第一段', html: `
    <p class="wlead">大纲允许文字/图画提示。两种打法:<b>图表+漫画组合</b>(图表为主、漫画辅助)和<b>纯漫画</b>(论证主题重要)。组合题第一段两句固定:先漫画(完全倒装)后图表(There be)。</p>
    <h3>组合题 · 第一段两句(复现句库 12)</h3>
    <ul class="wsent">
      ${sent('As is shown above, at <i>the right side of the cartoon</i> is <i>a car owner</i> who is saying, "<i>Electric vehicle helps me save a lot of money.</i>"', '①完全倒装:at the 方位 is a 人 who is saying "把气泡中文翻译成英文"。')}
      ${sent('Meanwhile, there is a chart which shows that <i>the sales of electric vehicles increased from 4.5 million in 2021 to 9.5 million in 2024</i>.', '②There be + 动态句/静态句,数据照图抄。')}
    </ul>
    <div class="wbox"><h4>另外三个组合预测(第一段直接套;电动车见下方范文)</h4>
      <p>高铁:on a high-speed train → "It is so fast and convenient!" · 高铁里程:the total length of high-speed railways increased from 120km in 2008 to 45000km in 2024<br>
      中国文化:on the Great Wall is a foreigner → "It is so impressive/incredible/splendid." · HSK:the number of foreigners who take the HSK exam increased from 0.37 million to 0.92 million<br>
      电子书纸质书:in the library are two students who are using two different ways to read · the percentage of using electronic books increased from 30% in 2019 to 70% in 2023</p></div>
    <h3>纯漫画 · 三段骨架</h3>
    <table class="wtable">
      <tr><th>段落</th><th>任务</th><th>句子</th></tr>
      <tr><td>第一段</td><td>两个人物对话速写</td><td>As is shown above… / Meanwhile, there is another man who is saying…</td></tr>
      <tr><td>第二段</td><td>总起+获益+哈佛研究</td><td>a host of complicated driving factors… / 从中获益句 / studies from Harvard University…</td></tr>
      <tr><td>第三段</td><td>趋势预测</td><td>the importance of <i>主题</i> is projected to show an upward trend</td></tr>
    </table>
    <ul class="wsent">
      ${sent('Actually, there are a host of complicated driving factors that may explain the importance of <i>主题词</i>, and the two most noteworthy ones could be summarized as follows.', '纯漫画专用总起(比图表版词多,防雷同)。')}
      ${sent('First and foremost, from <i>主题词</i>, we can benefit a lot, such as learning more things, acquiring unique experience and acquiring a higher platform.', '获益句漫画版。')}
      ${sent('In addition, studies from Harvard University have found that college students—those who <i>主题词</i>—excel other students on a range of education and career achievement factors.', '哈佛研究句,冲分利器。')}
    </ul>
    <h3>范文 · 组合题(电动车 · 八哥句式)</h3>
    <div class="wsample" data-sample="s-ev-combo"></div>
    <h3>范文 · 纯漫画(坚持梦想 · 八哥原文 155 词)</h3>
    <div class="wsample" data-sample="s-dream"></div>` }
  ];

  /* ═══════════ 小作文模版 ═══════════ */
  const small = [
  { id: 'x1', no: '01', title: '书信', tag: '高频 · 骨架(句库01)+ 素材包(句库02-08)拼装', html: `
    <p class="wlead">所有书信 = <a href="#/t/c1" class="golink">句库01 骨架</a>(首段身份+目的、尾段两句)+ 一个素材包(活动三句 / 事物优点 / 建议四句 / 道歉三句 / 感谢四句 / 人物优点 / 询问投诉)。<b>拼装公式:活动3句+人物优点4句+事物优点4句、道歉3句+感谢2句+建议4句+投诉3句</b> —— 组合信就这么写。</p>
    <h3>格式</h3>
    <div class="wfmt">
      <p>Dear <i>Sir or Madam / 人名</i>,</p>
      <p>首段:As a <i>身份定语从句</i>, I am writing this email to <i>目的动词组</i>.</p>
      <p>中间段:素材包 3~4 句(任务点逐条覆盖)</p>
      <p>尾段:I really hope that you can accept my <i>X</i>. + I am looking forward to your early reply.</p>
      <p>Yours sincerely,<br>Li Ming / Zhang Wei</p>
    </div>
    <h3>高频信型 → 用哪个素材包</h3>
    <table class="wtable">
      <tr><th>信型(真题年份)</th><th>素材包</th><th>范文</th></tr>
      <tr><td>邀请(2018 毕业典礼)</td><td><a href="#/t/c2" class="golink">活动三句</a> + 被邀人重要性</td><td>下方范文一</td></tr>
      <tr><td>推荐(2017 长城故宫 / 2023 机器人展)</td><td><a href="#/t/c3" class="golink">事物优点四句</a></td><td>下方范文二</td></tr>
      <tr><td>投诉(2012 电子词典)</td><td><a href="#/t/c8" class="golink">投诉四句</a></td><td>下方范文三</td></tr>
      <tr><td>建议(2009 禁塑令 / 2016 翻译回复 / 2024 古建筑)</td><td><a href="#/t/c4" class="golink">建议四句+从句</a></td><td>课后练习第 1、7 次</td></tr>
      <tr><td>道歉(2008 音乐 CD)</td><td><a href="#/t/c5" class="golink">道歉三句</a></td><td>课后练习第 1 次</td></tr>
      <tr><td>感谢+邀请(2010 中美交流)</td><td><a href="#/t/c6" class="golink">感谢四句</a> + 事物优点</td><td>批改·预测六</td></tr>
      <tr><td>申请(预测 牛津)</td><td><a href="#/t/c7" class="golink">人物优点四句</a></td><td>课后练习第 1 次</td></tr>
      <tr><td>介绍/回复(2017 中国文化演讲)</td><td>事物优点 + 活动三句</td><td>课后练习第 5 次</td></tr>
    </table>
    <h3>范文一 · 邀请信(2018 真题 · 八哥原文)</h3>
    <div class="wsample" data-sample="l-invite2018"></div>
    <h3>范文二 · 推荐信(2017 真题 · 八哥原文)</h3>
    <div class="wsample" data-sample="l-reco2017"></div>
    <h3>范文三 · 投诉信(2012 真题 · 八哥原文)</h3>
    <div class="wsample" data-sample="l-complaint2012"></div>` },

  { id: 'x2', no: '02', title: '告示', tag: '次高频 · 活动三句+志愿者句 · 2020真题', html: `
    <p class="wlead">告示=通知目的句 + <a href="#/t/c2" class="golink">活动三句</a> + <a href="#/t/c7" class="golink">志愿者三句</a>(招募类)+ 联系方式。没有称呼,落款写机构。</p>
    <h3>格式</h3>
    <div class="wfmt">
      <p>Notice <i>(居中,日期右侧)</i></p>
      <p>第一段:This notice is written to <i>do 短语(照题干抄)</i>.</p>
      <p>第二段:活动三句(时间地点/目的/流程)+ 志愿者三句(招募类)</p>
      <p>第三段:Those who are interested in being part of it call 12345678 for further information. + Come on and join us now!</p>
      <p>The Student Union <i>(题干有机构抄机构,没有就写这个)</i></p>
    </div>
    <ul class="wsent">
      ${sent('This notice is written to inform the international students about the "Hope" singing competition.', '目的句:is written to + 题干动作。', '告示第 1 句')}
      ${sent('Those who are interested in being part of it call 12345678 for further information.', '联系方式句。', '告示倒数第 2 句')}
      ${sent('Come on and join us now!', '口号收尾。', '告示最后一句')}
    </ul>
    <h3>范文 · 2020 真题(唱歌比赛 · 八哥原文)</h3>
    <div class="wsample" data-sample="l-notice2020"></div>` },

  { id: 'x3', no: '03', title: '纪要', tag: '大纲新增 · sdlpt 顶格 · 活动句复用', html: `
    <p class="wlead">纪要=把一场会讲清楚:<b>主题+时间+地点+出席者+至少 3 个要点</b>。格式口诀 sdlpt(Subject/date/location/present/the minutes),全部<b>靠左顶格</b>;要点直接复用活动三句。</p>
    <h3>格式(八哥 sdlpt)</h3>
    <div class="wfmt">
      <p>Subject: <i>主题(题干找)</i></p>
      <p>Date: May 1st, 2023</p>
      <p>Location: <i>地点(会议室三选一)</i></p>
      <p>Present: <i>出席者(题干有就写,没有不写)</i></p>
      <p>The minutes are as follows:</p>
      <p>1. 流程:It includes a variety of parts, such as…<br>2. 目的:It aims to do A, do B and do C, which would be beneficial to…<br>3. 自由要点(按题干)</p>
    </div>
    <h3>范文 · 八哥原创预测(慈善义卖)</h3>
    <div class="wsample" data-sample="l-minutes"></div>` },

  { id: 'x4', no: '04', title: '备忘录', tag: '大纲题型 · To/From/Date/Subject · 活动三句复用', html: `
    <p class="wlead">备忘录=内部通知,四行头(To/From/Date/Subject)+ 正文直接用<a href="#/t/c2" class="golink">活动三句</a>+联系方式句。比书信少客套。</p>
    <h3>格式</h3>
    <div class="wfmt">
      <p>To: All club members</p>
      <p>From: Li Ming</p>
      <p>Date: May 1st, 2022</p>
      <p>Subject: Creating Green Culture and Building Low-Carbon Campus</p>
      <p>正文:宣布活动(We are going to hold…)+ 活动三句 + Those who are interested… + Come on and join us now!</p>
    </div>
    <h3>范文 · 八哥原创预测(低碳校园)</h3>
    <div class="wsample" data-sample="l-memo"></div>` }
  ];

  /* ═══════════ 范文库(八哥原文 + 中文对照) ═══════════ */
  const SAMPLES = {
    's-labor': {
      title: '2024 真题 · 劳动实践课的收获(八哥原文)',
      en: `The bar chart reflects the main gains of the students of the laboring practice courses in a certain university. From the chart, we can clearly see that the percentage of studying related knowledge gets the lion's share, occupying 91.3% and the proportion of improving practical ability takes the second largest part, with 84.8%. By contrast, that of enhancing cooperative ability and feeling relaxed only accounts for 32.6% and 54.4% respectively.

Actually, there are two noteworthy factors that may contribute to this phenomenon. First and foremost, from laboring practice courses, we can get numerous benefits, such as acquiring unique experience, enriching our campus life and broadening our horizons, which would explain what appears in the chart. It is universally acknowledged that the government is sparing no effort to encourage students to combine theory with practice through taking laboring practice courses.

With due consideration of all these factors, we may make a rational prediction: the percentage of taking laboring practice courses is projected to show an upward trend.`,
      zh: `柱状图反映了某高校劳动实践课学生的主要收获。如图清晰可见,学到相关知识占比最大,为 91.3%;提高实践能力占第二位,为 84.8%。相比之下,增强合作能力和放松身心的比例分别只有 32.6% 和 54.4%。

事实上,有两个值得注意的因素可以解释这一现象。首先,从劳动实践课中我们能获得诸多好处,比如获得独特体验、丰富校园生活、开阔眼界,这正解释了图中所示。众所周知,政府正不遗余力地鼓励学生通过劳动实践课把理论与实践结合起来。

充分考虑这些因素后,我们可以做出合理预测:上劳动实践课的比例预计将呈上升趋势。`
    },
    's-ex2021': {
      title: '2021 真题 · 居民锻炼方式(按八哥句式写)',
      en: `The bar chart reflects the survey of the ways of physical exercise for the residents in a certain city. From the chart, we can clearly see that the proportion of exercising alone gets the lion's share, occupying 54.3% and the percentage of working out with friends takes up the second largest part, with 47.7%. By contrast, that of exercising with family and joining group activities only accounts for 23.9% and 15.8% respectively.

Actually, there are two noteworthy factors that may contribute to this phenomenon. First and foremost, from exercising alone, we can get numerous benefits, such as making full use of fragmented time, relieving the pressure after work and keeping regular habits, which would explain what appears in the chart. In addition, nowadays, it is difficult for many residents to join group activities because their schedules vary greatly.

With due consideration of all these factors, we may make a rational prediction: the percentage of exercising alone is projected to show an upward trend.`,
      zh: `柱状图反映了某市居民体育锻炼方式的调查。如图清晰可见,独自锻炼占比最大,为 54.3%;与朋友一起锻炼占第二位,为 47.7%。相比之下,与家人锻炼和参加团体活动的比例分别只有 23.9% 和 15.8%。

事实上,有两个值得注意的因素可以解释这一现象。首先,独自锻炼能让我们获得诸多好处,比如充分利用碎片时间、缓解下班后的压力、保持规律习惯,这正解释了图中所示。此外,如今很多居民难以参加团体活动,因为各自的作息差别太大。

充分考虑这些因素后,我们可以做出合理预测:独自锻炼的比例预计将呈上升趋势。`
    },
    's-ev': {
      title: '预测 · 新能源汽车产销量(八哥原文 · 网站校订)',
      en: `From the chart, we can clearly see that great changes have taken place in the sales of traditional fuel-based vehicles, decreasing dramatically from 28.01 million in 2018 to 16.81 million in 2021. On the contrary, a remarkable rise was witnessed in the sales of electric vehicles, rising from 0.77 million to 4.2 million during the same period.

Actually, there are a host of complicated driving factors that may contribute to this phenomenon, and the two most noteworthy ones could be summarized as follows. First and foremost, from using electric vehicles, we can get numerous benefits, such as saving money greatly, acquiring unique experience and making our own contributions to environmental protection, which would explain what appears in the chart. In addition, with the advancement in science and technology, the Chinese battery industry has been enjoying a rapid development, thus providing people with more long-endurance batteries, such as the Qilin battery.

With due consideration of all these contributors, we may make a rational prediction: the sales of electric vehicles are projected to show an upward trend.`,
      zh: `从图中可以清楚看到,传统燃油车销量发生了巨大变化,从 2018 年的 2810 万辆骤降至 2021 年的 1681 万辆。相反,电动汽车销量见证了显著上升,同期从 77 万辆增至 420 万辆。

事实上,有大量复杂的驱动因素可以解释这一现象,最值得注意的两个总结如下。首先,使用电动汽车能让我们获得诸多好处,比如大大省钱、获得独特体验、为环保做出自己的贡献,这正解释了图中所示。此外,随着科技进步,中国电池行业迅速发展,为人们提供了更多长续航电池,比如麒麟电池。

充分考虑这些因素后,我们可以做出合理预测:电动汽车销量预计将呈上升趋势。`
    },
    's-grad2019': {
      title: '2019 真题 · 毕业生去向(八哥原文 · 网站校订)',
      en: `The bar chart reflects the changes of the choices of graduates in a certain university from 2013 to 2018. From the chart, we can clearly see that great changes have taken place in the percentage of looking for a job, decreasing from 68.1% to 60.7%. On the contrary, a rise was witnessed in the proportion of pursuing a master's degree, rising from 26.3% to 34% during the same period. And the percentage of starting a business doubled during the same period.

Actually, there are two noteworthy factors that may contribute to this phenomenon. First and foremost, from pursuing a master's degree, we can get numerous benefits, such as acquiring a higher platform, learning more things and broadening our horizons, which would explain what appears in the chart. In addition, it is difficult for many graduates to look for a job because job opportunities are limited.

With due consideration of all these contributors, we may make a rational prediction: the proportion of pursuing further study is projected to show an upward trend.`,
      zh: `柱状图反映了 2013–2018 年某高校毕业生去向的变化。如图清晰可见,找工作的比例发生巨变,从 68.1% 降到 60.7%。相反,读研的比例见证了上升,同期从 26.3% 涨到 34%。创业的比例同期翻了一番。

事实上,有两个值得注意的因素可以解释这一现象。首先,读研能让我们获得诸多好处,比如获得更高平台、学到更多东西、开阔眼界,这正解释了图中所示。此外,很多毕业生很难找到工作,因为就业机会有限。

充分考虑这些因素后,我们可以做出合理预测:继续深造的比例预计将呈上升趋势。`
    },
    's-diet': {
      title: '预测 · 居民饮食结构(八哥原文 · 网站校订)',
      en: `The table chart reflects the changes of the survey of the dietary structure of the residents in a certain city from 2016 to 2019. From the chart, we can clearly see that great changes have taken place in the percentage of grain, decreasing from 49% to 39%. On the contrary, a rise was witnessed in the proportion of fruit and vegetables, rising from 15% to 28% during the same period. And there was a climb in the percentage of meat, ranging from 8% to 20%.

Actually, there are two noteworthy factors that may contribute to this phenomenon. First and foremost, from eating more meat, we can get numerous benefits, such as improving our living standards, absorbing more nutrition and maintaining a balanced diet, which would explain what appears in the chart. In addition, in recent years, China has been characterized by the increase in people's income and the rapid development in economy, which enabled people to possess extra money to buy more meat.

With due consideration of all these contributors, we may make a rational prediction: the percentage of eating more meat is projected to show an upward trend.`,
      zh: `表格反映了 2016–2019 年某市居民饮食结构调查的变化。如图清晰可见,谷物的比例发生巨变,从 49% 降到 39%。相反,水果蔬菜的比例见证了上升,同期从 15% 涨到 28%。肉类的比例则在攀升,从 8% 到 20%。

事实上,有两个值得注意的因素可以解释这一现象。首先,多吃肉能让我们获得诸多好处,比如提高生活水平、吸收更多营养、保持均衡饮食,这正解释了图中所示。此外,近年来中国的特点正是居民收入增加和经济快速发展,这使人们有更多的余钱去买肉。

充分考虑这些因素后,我们可以做出合理预测:多吃肉的比例预计将呈上升趋势。`
    },
    's-pay': {
      title: '预测 · 居民支付方式(八哥原文)',
      en: `The pie chart reflects the survey of the payment ways of the residents in a certain city in 2019. From the chart, we can clearly see that the proportion of mobile payment gets the lion's share, occupying 50% and the percentage of credit card takes up the second largest part, with 25%. By contrast, that of cash and others only accounts for 17% and 8% respectively.

Actually, there are a host of complicated driving factors that may contribute to this phenomenon, and the two most noteworthy ones could be summarized as follows. First and foremost, from using mobile payment, we can get numerous benefits, such as improving the work efficiency, making our life more convenient and saving our time greatly, which would explain what appears in the chart. In addition, with the advancement in science and technology, the Internet industry has been enjoying a rapid development, thus providing people with more choices.

With due consideration of all these factors, we may make a rational prediction: the percentage of mobile payment is projected to show an upward trend.`,
      zh: `饼图反映了 2019 年某市居民支付方式的调查。如图清晰可见,移动支付占比最大,为 50%;信用卡占第二位,为 25%。相比之下,现金和其他方式分别只占 17% 和 8%。

事实上,有大量复杂的驱动因素可以解释这一现象,最值得注意的两个总结如下。首先,使用移动支付能让我们获得诸多好处,比如提高工作效率、让生活更便利、大大节省时间,这正解释了图中所示。此外,随着科技进步,互联网行业迅速发展,为人们提供了更多选择。

充分考虑这些因素后,我们可以做出合理预测:移动支付的比例预计将呈上升趋势。`
    },
    's-commute': {
      title: '预测 · 居民出行方式(八哥原文)',
      en: `The pie chart reflects the survey of the ways to commute for the residents in a certain city in 2020. From the chart, we can clearly see that the proportion of using public transportation gets the lion's share, occupying 60% and the percentage of private cars takes up the second largest part, with 20%. By contrast, that of shared bicycles and walking only accounts for 12% and 8% respectively.

Actually, there are two noteworthy factors that may contribute to this phenomenon. First and foremost, from using public transportation, we can get numerous benefits, such as saving money and time greatly, making our life more convenient and leading a low-carbon lifestyle, which would explain what appears in the chart. In addition, with the advancement in science and technology, the construction of urban traffic facilities has been enjoying a rapid development, thus providing people with more choices.

With due consideration of all these factors, we may make a rational prediction: the percentage of using public transportation is projected to show an upward trend.`,
      zh: `饼图反映了 2020 年某市居民出行方式的调查。如图清晰可见,公共交通占比最大,为 60%;私家车占第二位,为 20%。相比之下,共享单车和步行分别只占 12% 和 8%。

事实上,有两个值得注意的因素可以解释这一现象。首先,乘坐公共交通能让我们获得诸多好处,比如大大省钱省时、让生活更便利、过上低碳生活,这正解释了图中所示。此外,随着科技进步,城市交通设施建设迅速发展,为人们提供了更多选择。

充分考虑这些因素后,我们可以做出合理预测:乘坐公共交通的比例预计将呈上升趋势。`
    },
    's-onlineedu': {
      title: '预测 · 在线教育(八哥原文 · 网站校订)',
      en: `From the chart, we can clearly see that great changes have taken place in the number of online education users, increasing dramatically from 0.11 billion in 2015 to 0.423 billion in 2020. Meanwhile, a steady rise was witnessed in the Internet penetration rate, rising from 50.3% to 64.5% during the same period.

Actually, there are two noteworthy factors that may contribute to this phenomenon. First and foremost, from using online education, we can get numerous benefits, such as acquiring more advanced knowledge and better educational resources, making the study more convenient, improving the study efficiency and making full use of fragmented time to study, which would explain what appears in the chart. In addition, with the advancement in science and technology, the Internet industry has been enjoying a rapid development, thus providing people with more choices.

With due consideration of all these factors, we may make a rational prediction: the number of online education users is projected to show an upward trend.`,
      zh: `从图中可以清楚看到,在线教育用户数发生了巨大变化,从 2015 年的 1.1 亿骤增至 2020 年的 4.23 亿。同时,互联网普及率见证了稳步上升,同期从 50.3% 涨到 64.5%。

事实上,有两个值得注意的因素可以解释这一现象。首先,使用在线教育能让我们获得诸多好处,比如获得更先进的知识和更好的教育资源、学习更便利、提高学习效率、充分利用碎片时间学习,这正解释了图中所示。此外,随着科技进步,互联网行业迅速发展,为人们提供了更多选择。

充分考虑这些因素后,我们可以做出合理预测:在线教育用户数预计将呈上升趋势。`
    },
    's-news': {
      title: '预测 · 大学生获取新闻方式(八哥原文)',
      en: `The pie chart reflects the survey of the ways of acquiring news for the students in a certain university. From the chart, we can clearly see that the proportion of smart phones gets the lion's share, occupying 52% and the percentage of computers takes up the second largest part, with 21%. By contrast, that of television and radio, newspapers and magazines and others only accounts for 11%, 12% and 4% respectively.

Actually, there are two noteworthy factors that may contribute to this phenomenon. First and foremost, from getting news by smart phones, we can get numerous benefits, such as making full use of fragmented time, improving the study efficiency and broadening our horizons, which would explain what appears in the chart. In addition, with the advancement in science and technology, the cellphone industry has been enjoying a rapid development, thus providing students with more choices.

With due consideration of all these factors, we may make a rational prediction: the percentage of using smartphones to get news is projected to show an upward trend.`,
      zh: `饼图反映了某高校学生获取新闻方式的调查。如图清晰可见,智能手机占比最大,为 52%;电脑占第二位,为 21%。相比之下,电视广播、报刊杂志和其他方式分别只占 11%、12% 和 4%。

事实上,有两个值得注意的因素可以解释这一现象。首先,用手机获取新闻能让我们获得诸多好处,比如充分利用碎片时间、提高学习效率、开阔眼界,这正解释了图中所示。此外,随着科技进步,手机行业迅速发展,为学生提供了更多选择。

充分考虑这些因素后,我们可以做出合理预测:用手机获取新闻的比例预计将呈上升趋势。`
    },
    's-dining': {
      title: '预测 · 上班族就餐选择(八哥原文)',
      en: `The pie chart reflects the survey of the dining choices of the commuters in a certain city on weekdays. From the chart, we can clearly see that the proportion of ordering the food delivery gets the lion's share, occupying 61.3% and the percentage of dining in a restaurant takes up the second largest part, with 17.5%. By contrast, that of cooking their own foods, eating in a canteen and others only accounts for 16%, 4.2% and 1% respectively.

Actually, there are two noteworthy factors that may contribute to this phenomenon. First and foremost, from ordering the food delivery, we can get numerous benefits, such as making our life more convenient, saving time greatly and acquiring more choices, which would explain what appears in the chart. In addition, nowadays, it is difficult for many people to cook their own foods because they are so busy with their work.

With due consideration of all these factors, we may make a rational prediction: the percentage of ordering food delivery is projected to show an upward trend.`,
      zh: `饼图反映了某市上班族工作日就餐选择的调查。如图清晰可见,点外卖占比最大,为 61.3%;下馆子占第二位,为 17.5%。相比之下,自己做饭、吃食堂和其他方式分别只占 16%、4.2% 和 1%。

事实上,有两个值得注意的因素可以解释这一现象。首先,点外卖能让我们获得诸多好处,比如让生活更便利、大大节省时间、获得更多选择,这正解释了图中所示。此外,如今很多人很难自己做饭,因为工作太忙了。

充分考虑这些因素后,我们可以做出合理预测:点外卖的比例预计将呈上升趋势。`
    },
    's-ev-combo': {
      title: '预测 · 图表+漫画:电动车(第一段为八哥原句)',
      en: `As is shown above, at the right side of the cartoon is a car owner who is saying, "Electric vehicle helps me save a lot of money." Meanwhile, there is a chart which shows that the sales of electric vehicles increased from 4.5 million in 2021 to 9.5 million in 2024.

Actually, there are two noteworthy factors that may contribute to this phenomenon. First and foremost, from using electric vehicles, we can get numerous benefits, such as saving money greatly, making our life more convenient and making our own contributions to environmental protection, which would explain what appears in the chart. In addition, with the advancement in science and technology, the Chinese battery industry has been enjoying a rapid development, thus providing people with more choices.

With due consideration of all these factors, we may make a rational prediction: the sales of electric vehicles are projected to show an upward trend.`,
      zh: `如图所示,漫画右边是一位车主,他说:"电动车帮我省了很多钱。"同时,旁边有一张图表,显示电动汽车销量从 2021 年的 450 万辆增长到 2024 年的 950 万辆。

事实上,有两个值得注意的因素可以解释这一现象。首先,使用电动汽车能让我们获得诸多好处,比如大大省钱、让生活更便利、为环保做贡献,这正解释了图中所示。此外,随着科技进步,中国电池行业迅速发展,为人们提供了更多选择。

充分考虑这些因素后,我们可以做出合理预测:电动汽车销量预计将呈上升趋势。`
    },
    's-hsr-combo': {
      title: '预测 · 图表+漫画:高铁(第一段为八哥原句)',
      en: `As is shown above, on a high-speed train is a passenger who is saying, "It is so fast and convenient!" Meanwhile, there is a chart which shows that the total length of high-speed railways increased from 120km in 2008 to 45000km in 2024.

Actually, there are two noteworthy factors that may contribute to this phenomenon. First and foremost, from taking high-speed trains, we can get numerous benefits, such as saving time greatly, improving the travel efficiency and making our life more convenient, which would explain what appears in the chart. In addition, it is universally acknowledged that the government is sparing no effort to develop the railway network, thus providing people with more choices.

With due consideration of all these factors, we may make a rational prediction: the ridership on the high-speed lines is projected to show an upward trend.`,
      zh: `如图所示,一列高铁上有一位乘客说:"又快又方便!"同时,旁边有一张图表,显示中国高铁总里程从 2008 年的 120 公里增长到 2024 年的 45000 公里。

事实上,有两个值得注意的因素可以解释这一现象。首先,乘坐高铁能让我们获得诸多好处,比如大大节省时间、提高出行效率、让生活更便利,这正解释了图中所示。此外,众所周知,政府正不遗余力地建设铁路网络,为人们提供了更多选择。

充分考虑这些因素后,我们可以做出合理预测:高铁客运量预计将呈上升趋势。`
    },
    's-dream': {
      title: '纯漫画 · 坚持梦想(八哥原文 155 词)',
      en: `As is shown above, at the right side of the picture is a man who is saying, "I am tired and I don't want to climb." Meanwhile, there is another man who is saying, "Have a rest and continue to climb."

Actually, there are a host of complicated driving factors that may explain the importance of insisting on dreams, and the two most noteworthy ones could be summarized as follows. First and foremost, from insisting on our dreams, we can get numerous benefits, such as learning more things, acquiring unique experience and acquiring a higher platform. In addition, studies from Harvard University have found that college students—those who insist on their dreams—excel other students on a range of education and career achievement factors.

With due consideration of all these factors, we may make a rational prediction: the importance of insisting on dreams is projected to show an upward trend.`,
      zh: `如图所示,画面右边一个人说:"我累了,不想爬了。"同时,另一个人说:"休息一下,继续爬。"

事实上,有大量复杂的驱动因素可以解释坚持梦想的重要性,最值得注意的两个总结如下。首先,坚持梦想能让我们获得诸多好处,比如学到更多东西、获得独特体验、登上更高平台。此外,哈佛大学的研究发现,那些坚持梦想的大学生,在一系列教育和职业成就指标上都领先其他学生。

充分考虑这些因素后,我们可以做出合理预测:坚持梦想的重要性预计将呈上升趋势。`
    },
    'l-invite2018': {
      title: '2018 真题 · 邀请专家参加毕业典礼(八哥原文)',
      en: `Dear experts,

As the president of the Student Union, I am writing this email to invite you to attend the graduation ceremony that will leave a deep impression on you.

The ceremony is to be held by our university on the playground at 8 a.m. on June 15th. It includes a variety of processes, such as the opening session, the speech-delivering and so on. You have enjoyed great popularity in our university, so your coming will be our great honor.

I really hope that you can accept my invitation. I am looking forward to your early reply.

Yours sincerely,
Li Ming`,
      zh: `各位专家:

作为学生会主席,我写信邀请各位出席毕业典礼,它一定会给您留下深刻印象。

典礼由我校于 6 月 15 日上午 8 点在操场举办,包括开幕、致辞等多个环节。各位在我校享有盛誉,您的到来将是我们莫大的荣幸。

真诚希望您接受邀请,期待早日回复。

李明 谨上`
    },
    'l-reco2017': {
      title: '2017 真题 · 推荐长城和故宫(八哥原文)',
      en: `Dear Professor Cook,

As a student who has lived in Beijing for many years, I am writing this email to recommend you two scenic spots—the Great Wall and the Palace Museum.

The reasons why I recommend these to you are as follows. First and foremost, from visiting the Great Wall, you can get numerous benefits, such as broadening your horizons, arousing your interest in Chinese culture and acquiring unique experience. In addition, the Palace Museum is so splendid that I never fail to be attracted to it, which leaves a deep impression on me. Last but not least, it is quite famous, enjoying a great reputation in the world.

I really hope that you can accept my recommendation. I am looking forward to your early reply.

Yours sincerely,
Li Ming`,
      zh: `库克教授:

作为在北京生活多年的学生,我写信向您推荐两个景点——长城和故宫。

推荐理由如下。首先,游览长城能让您获益良多,比如开阔眼界、唤起您对中国文化的兴趣、获得独特体验。此外,故宫如此宏伟,我每次都为之倾倒,它给我留下了深刻印象。最后,它们举世闻名,享有盛誉。

真诚希望您接受我的推荐,期待早日回复。

李明 谨上`
    },
    'l-complaint2012': {
      title: '2012 真题 · 投诉电子词典(八哥原文)',
      en: `Dear Sir or Madam,

As one of the loyal customers of your online store, I am writing this email to make a complaint about the electronic dictionary that I bought two weeks ago.

The factors for my disappointment can be listed as follows. Firstly, the screen worked in the first day, but later showed some obvious problems. Secondly, I am not satisfied with your after-sales service. I strongly demand that you should compensate for my loss and improve your attitude for after-sales service.

I really hope that you can accept my complaint. I am looking forward to your early reply.

Yours sincerely,
Zhang Wei`,
      zh: `尊敬的先生/女士:

作为贵网店的忠实顾客,我写信投诉两周前购买的电子词典。

失望的原因罗列如下。第一,屏幕第一天还能用,后来就出现明显问题。第二,我对你们的售后服务不满意。我强烈要求你们赔偿我的损失并改善售后服务态度。

真诚希望你们受理我的投诉,期待早日回复。

张伟 谨上`
    },
    'l-sugg2009': {
      title: '2009 真题 · 禁塑令建议信(八哥原文)',
      en: `Dear Sir or Madam,

As a die-hard fan of your newspaper, I am writing this letter to express my views that "White pollution" is harmful to environment.

Here are some useful suggestions about the restrictions on the use of plastic bags. First and foremost, it is necessary for the government to raise the price of plastic bags so that people can stop using plastic bags. In addition, the government is supposed to make related laws, which would be beneficial to environmental protection. Last but not least, more alternative products such as paper bags should be produced.

I really hope that you can accept my suggestions. I am looking forward to your early reply.

Yours sincerely,
Li Ming`,
      zh: `尊敬的编辑:

作为贵报的忠实读者,我写信表达观点:"白色污染"正在危害环境。

以下是关于限制使用塑料袋的几条建议。首先,政府有必要提高塑料袋价格,让人们不再使用。此外,政府应当制定相关法律,这将有益于环境保护。最后,应当生产更多纸袋等替代品。

真诚希望您采纳我的建议,期待早日回复。

李明 谨上`
    },
    'l-apply': {
      title: '预测 · 申请牛津大学(八哥原文)',
      en: `Dear Sir or Madam,

As a student who wants to learn more things, I am writing this email to apply for admission to Oxford University that is quite famous, enjoying a great reputation in the world.

I have all the qualifications that are required. First and foremost, in the past 4 years, I have maintained an average score of 90 and proved myself to be a straight-A student. In addition, I am confident, optimistic and creative, and most importantly I have strong teamwork spirit.

I really hope that you can accept my application. I am looking forward to your early reply.

Yours sincerely,
Zhang Wei`,
      zh: `尊敬的先生/女士:

作为一个想学到更多东西的学生,我写信申请牛津大学的录取,贵校举世闻名,享有盛誉。

我具备所有所需条件。首先,过去四年我的平均分保持在 90,证明自己是全 A 生。此外,我自信、乐观、有创造力,最重要的是我有很强的团队精神。

真诚希望你们接受我的申请,期待早日回复。

张伟 谨上`
    },
    'l-apolog2008': {
      title: '2008 真题 · 忘还音乐 CD 道歉信(八哥原文)',
      en: `Dear Bob,

As a student who received a lot of help from you, I am writing this letter to express my sincere apology to you because I forgot to return to you the music CD that is very precious to you.

The reason for my mistake was that I was so careless that I failed to check my luggage carefully. I take full responsibility and I assure you that this won't happen again. To make up for my fault, you can buy a new one in Canada, and I will pay for it.

I really hope that you can accept my apology. I am looking forward to seeing you again.

Yours sincerely,
Li Ming`,
      zh: `亲爱的 Bob:

作为受过你许多帮助的学生,我写信向你真诚道歉,因为我忘记归还那张对你十分珍贵的音乐 CD。

我犯错的原因是我太粗心,没有仔细检查行李。我承担全部责任,并保证不会再发生。为了弥补过错,你可以在加拿大买一张新的,我来付钱。

真诚希望你能接受我的道歉,期待再见到你。

李明 谨上`
    },
    'l-notice2020': {
      title: '2020 真题 · 唱歌比赛告示(八哥原文)',
      en: `Notice

May 1st, 2023

This notice is written to inform the international students about the "Hope" singing competition that is quite famous, enjoying a great reputation.

The contest is to be held by XXX University on the playground at 7 p.m. on May 10th. It aims to enrich their campus life, relieve their pressure and shorten the distance between students. Several volunteers are needed for this activity. They should be warm-hearted, patient and confident, and most importantly, they ought to have good communication skills and be proficient in English.

Those who are interested in being part of it call 12345678 for further information. Come on and join us now!

The Student Union`,
      zh: `通知

2023 年 5 月 1 日

本通知旨在告知国际学生"希望"歌唱比赛,该比赛十分有名,享有盛誉。

比赛由某某大学于 5 月 10 日晚 7 点在操场举办,旨在丰富校园生活、缓解压力、拉近同学距离。本次活动需要若干志愿者:他们应热心、耐心、自信,最重要的是善于沟通且英语熟练。

有意参加者请致电 12345678 了解详情。快来加入我们吧!

学生会`
    },
    'l-minutes': {
      title: '八哥原创预测 · 慈善义卖纪要(原文)',
      en: `Subject: A Charity Sale
Date: May 1st, 2023
Location: No.3 Meeting Hall
Present: Ms. Alice—President, Mr. Smith—Vice President
The minutes are as follows:
1. The "Hope" charity sale includes a variety of processes, such as the opening session, the speech-delivering and the question and answering part.
2. It aims to enrich students' life, improve their love, enhance their social sense of responsibility and broaden their horizons.
3. Several volunteers are needed for this charity sale. They should be warm-hearted, patient and confident, and most importantly, they ought to have good communication skills and be proficient in English.`,
      zh: `主题:慈善义卖
日期:2023 年 5 月 1 日
地点:3 号会议厅
出席:Alice 女士(主席)、Smith 先生(副主席)
纪要如下:
1. "希望"慈善义卖包括多个环节,如开幕式、致辞和问答环节。
2. 活动旨在丰富学生生活、培养爱心、增强社会责任感、开阔眼界。
3. 本次义卖需要若干志愿者:应热心、耐心、自信,最重要的是善于沟通且英语熟练。`
    },
    'l-memo': {
      title: '八哥原创预测 · 低碳校园备忘录(原文)',
      en: `To: All club members
From: Li Ming
Date: May 1st, 2022
Subject: Creating Green Culture and Building Low-Carbon Campus

We are going to hold several activities for a Green Culture and a Low-Carbon campus.

These activities are to be held at the No.3 Meeting Hall at 7 p.m. on May 10th. These aim to enrich our life, improve our awareness for environmental protection and shorten the distance among members.

Those who are interested in being part of it call 12345678 for further information. Come on and join us now!`,
      zh: `收件:全体社团成员
发件:李明
日期:2022 年 5 月 1 日
主题:创建绿色文化,建设低碳校园

我们将举办多项绿色文化、低碳校园活动。

活动定于 5 月 10 日晚 7 点在 3 号会议厅举行,旨在丰富生活、提高环保意识、拉近成员距离。

有意参加者请致电 12345678 了解详情。快来加入我们吧!`
    },
    'l-thanks2010': {
      title: '2010 真题 · 感谢+邀请(八哥原文)',
      en: `Dear Paul,

As one who participated in the "Bridge" Sino-American cultural exchange program, I am writing this letter to express my sincere gratitude to you for your warm reception that left a deep impression on me.

If I had not got your assistance, I fear that I might not have improved my spoken English, found a nice apartment and made more friends. I want to invite you to visit the Great Wall. It is quite famous, enjoying a great reputation in the world.

I really hope that you can accept my invitation. I am looking forward to your early reply.

Yours sincerely,
Zhang Wei`,
      zh: `亲爱的 Paul:

作为"桥"中美文化交流项目的参与者,我写信对你的热情接待表达真诚感谢,它给我留下了深刻印象。

如果没有你的帮助,我恐怕无法提高口语、找到好公寓、交到这么多朋友。我想邀请你来游览长城——它举世闻名,享有盛誉。

真诚希望你接受邀请,期待早日回复。

张伟 谨上`
    },
    'l-reply2016': {
      title: '2016 真题 · 翻译建议回复信(八哥原文)',
      en: `Dear Jack,

As a student who just won a translation contest, I am writing this reply to express my sincere gratitude for your congratulations. I heard that you are interested in translation.

Here are some useful suggestions about improving your translation. First and foremost, it is necessary for you to study grammar, which would be beneficial to you. In addition, you are supposed to read more books so that you can broaden your horizons. Last but not least, more practice should be done.

I really hope that you can accept my suggestions. I am looking forward to your early reply.

Yours sincerely,
Li Ming`,
      zh: `亲爱的 Jack:

作为刚赢得翻译比赛的学生,我回信感谢你的祝贺。听说你对翻译很感兴趣。

以下是提高翻译水平的建议。首先,你有必要学好语法,这对你有益。此外,你应当多读书以开阔眼界。最后,应当多做练习。

真诚希望您采纳我的建议,期待早日回复。

李明 谨上`
    },
    'l-inquire': {
      title: '预测 · 询问演唱会信息(八哥原文)',
      en: `Dear Sir or Madam,

As a student who has liked Eason Chan for many years, I am writing this email to ask for some relevant information about his concert that is quite famous, enjoying a great reputation in the world.

First and foremost, can you tell me how I can get the ticket of the concert? In addition, I would also like to inquire when the concert is to be held by our university on the playground. Another aspect I am concerned about is the price of the ticket.

I really hope that you can accept my inquiry. I am looking forward to your early reply.

Yours sincerely,
Zhang Wei`,
      zh: `尊敬的先生/女士:

作为喜欢陈奕迅多年的学生,我写信询问他演唱会的相关信息,这场演唱会十分有名,享有盛誉。

首先,能告诉我如何买到演唱会门票吗?此外,我还想询问演唱会的确切时间(据称由我校在操场举办)。我关心的另一个问题是票价。

真诚希望你们答复我的询问,期待早日回复。

张伟 谨上`
    },
    'l-survey2024': {
      title: '2024 真题 · 古建筑调查建议+询问(八哥原文)',
      en: `Dear Jack,

As one who is going to do this survey with you next week, I am writing this email to tell you my suggestions.

First and foremost, it is necessary for us to read more books about ancient houses, which would be beneficial to us. In addition, we are supposed to visit some museums and historic professors so that we can learn more things and save more time. Last but not least, a local guide should be found, which would bring convenience to us. And do you have any better ideas? I believe that your creative thinking will make our research better.

I really hope that you can accept my suggestions. I am looking forward to your early reply.

Yours sincerely,
Li Ming`,
      zh: `亲爱的 Jack:

作为下周要和你一起做调查的人,我写信说说我的建议。

首先,我们有必要多读古建筑方面的书,这对我们有益。此外,我们应当拜访一些博物馆和历史学教授,以便学到更多、节省时间。最后,应当找一位当地导游,这会给我们带来便利。你有更好的想法吗?我相信你的创造性思维会让我们的研究更好。

真诚希望您采纳我的建议,期待早日回复。

李明 谨上`
    },
    'l-intro2017': {
      title: '2017 真题 · 中国文化演讲回复(八哥原文 · 网站校订)',
      en: `Dear Professor Williams,

As a student who is filled with respect for you, I am writing this email to accept your invitation to give a presentation about Chinese culture to a host of foreign students.

Here are the key points of my presentation. First and foremost, from Taoism, you can get numerous benefits, such as enriching your spiritual life, broadening your horizons and shortening the distance with Chinese students. In addition, Chinese traditional culture, such as Confucianism is quite famous, enjoying a great reputation in the world.

I really hope that you can accept my presentation. I am looking forward to your early reply.

Yours sincerely,
Li Ming`,
      zh: `尊敬的 Williams 教授:

作为一位十分敬重您的学生,我写信接受您的邀请,将为众多留学生做一场关于中国文化的演讲。

以下是演讲要点。首先,道家思想能让大家获益良多,比如丰富精神生活、开阔眼界、拉近与中国学生的距离。此外,以儒家思想为代表的中国传统文化举世闻名,享有盛誉。

真诚希望您认可我的演讲安排,期待早日回复。

李明 谨上`
    },
    'l-debate2019': {
      title: '2019 真题 · 低碳辩论主题与安排(八哥原文)',
      en: `Dear Professor Smith,

As the president of the Student Union, I am writing this email to suggest a topic for the debate—A Low-Carbon Lifestyle.

My main reason for this topic is that from a low-carbon lifestyle, we can get numerous benefits, such as making our contributions to environmental protection, reducing CO2 emissions. The debate competition is to be held by our university at the auditorium at 8 p.m. on June 15th. It includes a variety of processes, such as the speech-delivering, the question and answering part and the awarding part.

I really hope that you can accept my arrangements. I am looking forward to your early reply.

Yours sincerely,
Zhang Wei`,
      zh: `尊敬的 Smith 教授:

作为学生会主席,我写信建议本次辩论的主题——低碳生活。

我建议这个主题,主要是因为低碳生活能让我们获益良多,比如为环保做贡献、减少二氧化碳排放。辩论赛由我校于 6 月 15 日晚 8 点在礼堂举办,包括致辞、问答和颁奖等环节。

真诚希望您接受我的安排,期待早日回复。

张伟 谨上`
    },
    'l-reco2023': {
      title: '2023 真题 · 机器人展推荐信(八哥原文)',
      en: `Dear David,

As one who has taken part in some robot shows, I am writing this email to recommend you the "Hope" robot show.

Here are the reasons why I recommend this to you. First and foremost, it is quite famous, enjoying a great reputation in China. In addition, from this robot show, you can get numerous benefits, such as broadening your horizons and enriching your life. Last but not least, it is so interesting that I never fail to be attracted to it, which leaves a deep impression on me.

I really hope that you can accept my recommendation. I am looking forward to your early reply.

Yours sincerely,
Li Ming`,
      zh: `亲爱的 David:

作为参加过几届机器人展的人,我写信向你推荐"希望"机器人展。

推荐理由如下。首先,它十分有名,在中国享有盛誉。此外,从这个机器人展你能获益良多,比如开阔眼界、丰富生活。最后,它太有意思了,我每次都为之吸引,给我留下了深刻印象。

真诚希望您接受我的推荐,期待早日回复。

李明 谨上`
    }
  };

  /* ═══════════ 课后练习:11 次 · 22 天(全部来自 7 次带练真题) ═══════════ */
  const practice = {
    sub: '11 次 · 22 天 · 真题带练(八哥 7 次带练 + 组合/漫画 + 复盘 + 模考)',
    sessions: [
      { n: 1, days: '第 1–2 天', kind: '小作文', type: '建议+申请+道歉', title: '三信连写(2009 禁塑令 / 牛津申请 / 2008 CD)',
        cn: '三封真题信一次写完:① 2009 给编辑写禁塑令建议信;② 申请牛津,说明自己为何够格;③ 2008 忘记归还房东 Bob 的音乐 CD,道歉并提解决方案。',
        en: '1) give your opinions briefly and 2) make two or three suggestions; state reasons why you are qualified; make an apology and suggest a solution.',
        time: '第 1 天每封限时 15 分钟;第 2 天对照范文,把「建议四句」「道歉三句」「人物优点四句」抄一遍',
        sarr: ['l-sugg2009', 'l-apply', 'l-apolog2008'], link: 'c4', checks: CHECK_SMALL },
      { n: 2, days: '第 3–4 天', kind: '大作文', type: '动态图 A/B/C', title: '新能源车 / 毕业生去向 / 饮食结构',
        cn: '三篇动态图:① 燃油车 28.01→16.81 百万、电动车 0.77→4.2 百万(2018–2021);② 2019 真题:就业 68.1→60.7%、升学 26.3→34%、创业 1.3→2.6%;③ 谷物 49→39%、果蔬 15→28%、肉类 8→20%(2016–2019)。',
        en: '动态图三连:一降一升各一句(great changes / was witnessed),再加一句翻倍或区间。',
        time: '第 3 天任选两篇各 30 分钟;第 4 天写第三篇 + 对照「句库09」逐句检查',
        sarr: ['s-ev', 's-grad2019', 's-diet'], link: 'c9', checks: CHECK_BIG_DYNAMIC },
      { n: 3, days: '第 5–6 天', kind: '小作文', type: '告示+纪要+备忘录', title: '三种格式一次记牢(2020 唱歌 / 义卖纪要 / 低碳备忘录)',
        cn: '① 2020 真题:给国际学生写唱歌比赛告示(含招募志愿者);② 慈善义卖会议纪要(sdlpt 顶格);③ 低碳校园活动备忘录(To/From/Date/Subject)。',
        en: '三种格式全靠「活动三句」拼装,注意各自的头尾格式差异。',
        time: '第 5 天三篇各 15 分钟;第 6 天默写三种格式的头尾各一遍',
        sarr: ['l-notice2020', 'l-minutes', 'l-memo'], link: 'c2', checks: ['告示:Notice + 日期 + 机构落款,没有书信称呼和尾段', '纪要:Subject / Date / Location / Present 顶格,至少 3 个要点', '备忘录:To / From / Date / Subject 四行头齐全', '三篇都复用了活动句,且时间地点与题目一致'] },
      { n: 4, days: '第 7–8 天', kind: '大作文', type: '静态图', title: '支付方式 / 出行方式 / 在线教育',
        cn: '三篇:① 2019 支付方式饼图(移动支付 50%/刷卡 25%/现金 17%/其他 8%);② 2020 出行方式(公共交通 60%/私家车 20%/单车 12%/步行 8%);③ 在线教育用户 1.1→4.23 亿、互联网普及率 50.3%→64.5%。',
        en: '静态三件套:lion\'s share → take up the second largest → By contrast… respectively。',
        time: '第 7 天任选两篇各 30 分钟;第 8 天第三篇 + 默写「句库10」三个句型',
        sarr: ['s-pay', 's-commute', 's-onlineedu'], link: 'c10', checks: CHECK_BIG },
      { n: 5, days: '第 9–10 天', kind: '小作文', type: '五信连写', title: '邀请 / 推荐 / 投诉 / 介绍 / 建议',
        cn: '① 2018 邀请专家参加毕业典礼;② 2017 推荐长城故宫;③ 2012 投诉电子词典;④ 2017 回复 Prof. Williams 的中国文化演讲邀请;⑤ 2019 给 Smith 教授建议辩论主题(低碳)并做安排。',
        en: '每封信先想好用哪个素材包,再套骨架。介绍信=事物优点+活动三句组合示范。',
        time: '第 9 天写前三封;第 10 天写后两封 + 对照范文标注素材包句',
        sarr: ['l-invite2018', 'l-reco2017', 'l-complaint2012', 'l-intro2017', 'l-debate2019'], link: 'c3', checks: CHECK_SMALL },
      { n: 6, days: '第 11–12 天', kind: '大作文', type: '静态图', title: '获取新闻方式 / 上班族就餐选择',
        cn: '① 某高校获取新闻方式(手机 52%/电脑 21%/电视广播 11%/报刊 12%/其他 4%);② 某市上班族工作日就餐(外卖 61.3%/下馆子 17.5%/自己做 16%/食堂 4.2%/其他 1%)。',
        en: '注意两篇的「原因二」选不同的:手机→行业版;外卖→反面版(太忙没法做饭)。',
        time: '第 11 天两篇各 30 分钟;第 12 天对照「句库11」换一个原因二重写第二段',
        sarr: ['s-news', 's-dining'], link: 'c11', checks: CHECK_BIG },
      { n: 7, days: '第 13–14 天', kind: '小作文', type: '感谢+回复+询问+真题', title: '2010 感谢 / 2016 回复 / 询问 / 2024 古建筑',
        cn: '① 2010 感谢中美交流同事并邀请来华;② 2016 回复 Jack 祝贺并给翻译建议;③ 预测:询问陈奕迅演唱会信息;④ 2024 真题:与 Jack 做古建筑调查,提计划并征询意见。',
        en: '组合信拼装:感谢+邀请、感谢+建议、建议+询问,一封信两个素材包。',
        time: '第 13 天写前两封;第 14 天写后两封(限时 15 分钟/封)',
        sarr: ['l-thanks2010', 'l-reply2016', 'l-inquire', 'l-survey2024'], link: 'c6', checks: CHECK_SMALL },
      { n: 8, days: '第 15–16 天', kind: '大作文', type: '图表+漫画组合', title: '电动车省钱 / 高铁快又方便',
        cn: '组合题:① 漫画=车主说"电动车帮我省了很多钱",图表=销量 4.5→9.5 百万(2021–2024);② 漫画=高铁乘客说"又快又方便!",图表=高铁里程 120km→45000km(2008–2024)。',
        en: '第一段两句固定:As is shown above…(倒装) + Meanwhile, there is a chart which shows that…。',
        time: '第 15 天两篇各 30 分钟;第 16 天默写组合题第一段 + 哈佛研究句',
        sarr: ['s-ev-combo', 's-hsr-combo'], link: 'c12', checks: CHECK_BIG_COMBO },
      { n: 9, days: '第 17–18 天', kind: '大作文', type: '纯漫画', title: '坚持梦想(155 词范文)',
        cn: '漫画:爬山途中一人说"我累了,不想爬了",另一人说"休息一下,继续爬"。写主题词「坚持梦想」的重要性。',
        en: '纯漫画三段:a host of complicated driving factors… + 获益句 + 哈佛研究句 + upward trend。',
        time: '第 17 天 30 分钟写完;第 18 天对照范文,把第二段两句抄到能默写',
        sarr: ['s-dream'], link: 'c12', checks: CHECK_BIG },
      { n: 10, days: '第 19–20 天', kind: '复盘', type: '终极预测话题串讲', title: '大学生+居民 17 话题 · 每题口述两句原因',
        cn: '过一遍八哥 17 个预测话题的词汇与思路:选修课/课余时间/图书借阅/阅读媒介/获取知识/缓解压力/择业因素 | 支付/出行/新能源车/高铁/用餐/饮食结构/观影/入境游客/AI 市场/在线教育/志愿者。每个话题口述:获益三短语 + 一个原因二。',
        en: '不写全文,只练审题:给每个话题配 3 个获益短语和 1 个原因二(行业/政策/收入/反面)。',
        time: '第 19 天大学生 7 题;第 20 天居民 10 题;每题 2 分钟',
        link: 'c11', linkext: '', checks: ['17 个话题全部过了一遍', '每个话题都能立刻说出 3 个获益短语', '每个话题都能立刻说出 1 个原因二', '生词(如 ridership / penetration / filmgoer)抄了一遍'] },
      { n: 11, days: '第 21–22 天', kind: '模拟', type: '限时 45 分钟', title: '大小作文各一篇(真题全真模考)',
        cn: '打开 e2 真题页,任选一套没做过的:小作文(第 47 题)15 分钟 + 大作文(第 48 题)30 分钟,连续完成,不看任何资料。',
        en: 'No dictionary, no template peeking. 45 minutes, both essays.',
        time: '第 21 天限时完成;第 22 天隔天重读,至少改出 3 处',
        linkext: 'index.html', checks: ['小作文 15 分钟内完成,大作文 30 分钟内完成', '两项都没有跑题,任务点齐全', '隔天重读,至少改出 3 处问题'] }
    ]
  };

  /* ═══════════ 批改预测题(9 道:大 5 + 小 4) ═══════════ */
  const preds = [
    { id: 'p1', no: '预测一', title: '新能源汽车', kind: '大作文', type: '动态图', sample: 's-ev',
      cn: '2018–2021 年汽车销量:燃油车 28.01 → 16.81 百万辆,电动车 0.77 → 4.2 百万辆。',
      dir: 'Write an essay based on the chart below. In your writing, you should 1) interpret the chart, and 2) give your comments. You should write about 150 words.',
      data: '<tr><th>销量(百万辆)</th><td>2018</td><td>2021</td></tr><tr><th>燃油车</th><td>28.01</td><td>16.81</td></tr><tr><th>电动车</th><td>0.77</td><td>4.2</td></tr>',
      think: ['词汇:燃油车 traditional fuel-based vehicles · 电动车 electric vehicles · 麒麟电池 the Qilin battery · 长续航电池 long-endurance batteries。', '一降一升:燃油车 great changes…decreasing,电动车 a remarkable rise was witnessed。', '获益选:省钱 saving money greatly / 独特体验 / 环保贡献;原因二用行业版:电池行业 the Chinese battery industry。'],
      outline: ['P1 点图 + 一降一升两句', 'P2 获益(省钱/体验/环保)+ 电池行业迅猛发展', 'P3 销量 projected to show an upward trend'],
      sents: [
        ['great changes have taken place in the sales of traditional fuel-based vehicles, decreasing dramatically from 28.01 million to 16.81 million.', '下降句:现在分词拖尾。'],
        ['a remarkable rise was witnessed in the sales of electric vehicles, rising from 0.77 million to 4.2 million.', '上升句:witness 被动 + rising from…to。'],
        ['the Chinese battery industry has been enjoying a rapid development, thus providing people with more long-endurance batteries.', '行业版原因二:thus providing 拖尾。']
      ], checks: CHECK_BIG_DYNAMIC },
    { id: 'p2', no: '预测二', title: '居民支付方式', kind: '大作文', type: '静态饼图', sample: 's-pay',
      cn: '2019 年某市居民支付方式调查:移动支付 50% · 刷卡 25% · 现金 17% · 其他 8%。',
      dir: 'Write an essay based on the chart below. In your writing, you should 1) interpret the chart, and 2) give your comments. You should write about 150 words.',
      data: '<tr><th>支付方式</th><td>移动支付</td><td>刷卡</td><td>现金</td><td>其他</td></tr><tr><th>占比</th><td>50%</td><td>25%</td><td>17%</td><td>8%</td></tr>',
      think: ['词汇:移动支付 mobile payment · 刷卡 credit card · 现金 cash。', '静态三件套:lion\'s share → second largest → By contrast…respectively,三个数全给。', '获益选:提效 / 便利 / 省时;原因二行业版:the Internet industry。'],
      outline: ['P1 首句点图 + 静态三件套', 'P2 获益(提效/便利/省时)+ 互联网行业', 'P3 移动支付占比 upward trend'],
      sents: [
        ['the proportion of mobile payment gets the lion\'s share, occupying 50%.', '最大项句。'],
        ['By contrast, that of cash and others only accounts for 17% and 8% respectively.', '其余项:that of 指代 + respectively。'],
        ['from using mobile payment, we can get numerous benefits, such as improving the work efficiency, making our life more convenient and saving our time greatly.', '★获益句三短语。']
      ], checks: CHECK_BIG },
    { id: 'p3', no: '预测三', title: '居民出行方式', kind: '大作文', type: '静态饼图', sample: 's-commute',
      cn: '2020 年某市居民出行方式:公共交通 60% · 私家车 20% · 共享单车 12% · 步行 8%。',
      dir: 'Write an essay based on the chart below. In your writing, you should 1) interpret the chart, and 2) give your comments. You should write about 150 words.',
      data: '<tr><th>出行方式</th><td>公共交通</td><td>私家车</td><td>共享单车</td><td>步行</td></tr><tr><th>占比</th><td>60%</td><td>20%</td><td>12%</td><td>8%</td></tr>',
      think: ['词汇:出行 commute · 网约车 online ride-hailing · 共享单车 shared bicycles。', '获益选:省钱省时 / 便利 / 低碳 lead a low-carbon lifestyle。', '原因二行业版换个名词:the construction of urban traffic facilities(城市交通设施建设)。'],
      outline: ['P1 静态三件套(60/20/12+8)', 'P2 获益(省钱省时/便利/低碳)+ 交通设施建设', 'P3 公共交通占比 upward trend'],
      sents: [
        ['the proportion of using public transportation gets the lion\'s share, occupying 60%.', '最大项:of + doing。'],
        ['saving money and time greatly, making our life more convenient and leading a low-carbon lifestyle', '获益三短语(低碳是本话题专属)。'],
        ['the construction of urban traffic facilities has been enjoying a rapid development.', '行业版原因二,只换主语名词。']
      ], checks: CHECK_BIG },
    { id: 'p4', no: '预测四', title: '在线教育', kind: '大作文', type: '动态双线', sample: 's-onlineedu',
      cn: '2015–2020 年:在线教育用户 1.1 → 4.23 亿人(英文写作:0.11 → 0.423 billion);互联网普及率 50.3% → 64.5%。',
      dir: 'Write an essay based on the chart below. In your writing, you should 1) interpret the chart, and 2) give your comments. You should write about 150 words.',
      data: '<tr><th></th><td>2015</td><td>2020</td></tr><tr><th>在线教育用户(亿)</th><td>1.1</td><td>4.23</td></tr><tr><th>互联网普及率</th><td>50.3%</td><td>64.5%</td></tr>',
      think: ['词汇:网民 netizens · 普及率 the Internet penetration rate(penetration=普及)。', '双线动态:用户数 increasing dramatically;普及率 a steady rise was witnessed。', '获益选:更先进知识和资源 / 学习便利 / 提效 / 碎片时间(可写四个);原因二:the Internet industry。'],
      outline: ['P1 用户数猛增 + 普及率稳升', 'P2 获益(资源/便利/提效/碎片时间)+ 互联网行业', 'P3 用户数 upward trend'],
      sents: [
        ['great changes have taken place in the number of online education users, increasing dramatically from 0.11 billion to 0.423 billion.', '增长句:increasing dramatically。'],
        ['a steady rise was witnessed in the Internet penetration rate.', '稳升:a steady rise。'],
        ['acquiring more advanced knowledge and better educational resources', '本话题专属获益短语。']
      ], checks: CHECK_BIG_DYNAMIC },
    { id: 'p5', no: '预测五', title: '图表+漫画:电动车', kind: '大作文', type: '组合题', sample: 's-ev-combo',
      cn: '漫画:车主说"电动车帮我省了很多钱"。图表:电动车销量 2021 年 4.5 百万 → 2024 年 9.5 百万辆。',
      dir: 'Write an essay based on the picture and the chart below. In your writing, you should 1) interpret them, and 2) give your comments. You should write about 150 words.',
      data: '<tr><th>销量(百万辆)</th><td>2021</td><td>2024</td></tr><tr><th>电动车</th><td>4.5</td><td>9.5</td></tr>',
      think: ['组合题=先漫画后图表,两句固定:As is shown above…(倒装) + Meanwhile, there is a chart which shows that…。', '气泡中文翻成简单英语即可:"Electric vehicle helps me save a lot of money."', '第二、三段照常:获益(省钱/便利/环保)+ 行业版原因二 + upward trend。'],
      outline: ['P1 漫画倒装句 + There be 图表句', 'P2 获益(省钱/便利/环保)+ 电池行业', 'P3 销量 upward trend'],
      sents: [
        ['As is shown above, at the right side of the cartoon is a car owner who is saying, "Electric vehicle helps me save a lot of money."', '★组合题第 1 句:完全倒装 + who is saying。'],
        ['Meanwhile, there is a chart which shows that the sales of electric vehicles increased from 4.5 million to 9.5 million.', '★组合题第 2 句:There be + 动态句。']
      ], checks: CHECK_BIG },
    { id: 'p6', no: '预测六', title: '感谢+邀请', kind: '小作文', type: '书信', sample: 'l-thanks2010',
      cn: '你刚结束中美文化交流项目回国,写信感谢美国同事 Paul 的热情接待,并邀请他适时来华。',
      dir: 'You have just come back from the U.S. as a member of a Sino-American cultural exchange program. Write a letter to your American colleague to 1) express your thanks for his/her warm reception, and 2) welcome him/her to visit China in due course. Use "Zhang Wei" instead.',
      think: ['八哥点名的预测组合:感谢四句 + 邀请(长城=事物优点句)。', '反面假设句的三个后果按题干想:提高口语 / 找到公寓 / 交到朋友。', '邀请部分两句话够了:I want to invite you to visit the Great Wall. + 有名句。'],
      outline: ['P1 As one who participated in…, express my sincere gratitude', 'P2 If I had not got your assistance… + 邀请长城 + 有名句', 'P3 hope + looking forward'],
      sents: [
        ['If I had not got your assistance, I fear that I might not have improved my spoken English, found a nice apartment and made more friends.', '★反面假设句,虚拟语气原样背。'],
        ['It is quite famous, enjoying a great reputation in the world.', '事物优点·有名句复现。']
      ], checks: CHECK_SMALL },
    { id: 'p7', no: '预测七', title: '食堂建议+投诉', kind: '小作文', type: '书信', sample: 'l-complaint2012',
      cn: '你对学校食堂不满意(菜价高、开放时间短、种类少),写信给校长室:表达不满并提出 2~3 条建议。',
      dir: 'Suppose you are not satisfied with the school cafeteria. Write an email to the president\'s office to 1) make a complaint, and 2) put forward some suggestions. Use "Li Ming" instead.',
      think: ['建议+投诉组合:投诉一句(I am not satisfied with…)+ 建议四句。', '动词+名词题库:lower the price / prolong the opening time / enrich the kinds of foods。', '从句后缀升级:which would bring convenience to students。'],
      outline: ['P1 As a student…, make a complaint about the cafeteria', 'P2 不满意句 + 建议四句(降价/延时/丰富种类)', 'P3 hope + looking forward'],
      sents: [
        ['I am not satisfied with the variety and price of foods.', '投诉句:variety and price 可按题换。'],
        ['it is necessary for our university to prolong the opening time of the canteen, which would bring convenience to students.', '建议句 + which 从句。'],
        ['our university is supposed to lower the prices of foods, which would be beneficial to students.', '建议句第二连。']
      ], checks: CHECK_SMALL },
    { id: 'p8', no: '预测八', title: '招募志愿者告示', kind: '小作文', type: '告示', sample: 'l-notice2020',
      cn: '学生会将举办"希望"歌唱比赛,写告示告知国际学生,并招募会英语的志愿者。',
      dir: 'The Student Union will hold a "Hope" singing competition. Write a notice to inform the international students and recruit volunteers. You should write about 100 words.',
      think: ['告示=目的句 + 活动三句 + 志愿者三句 + 联系方式 + 口号。', '落款是机构:The Student Union,不是 Li Ming。', '日期写在标题下一行右侧;标题 Notice 居中。'],
      outline: ['Notice + 日期', 'P1 This notice is written to inform…', 'P2 活动三句 + 志愿者三句', 'P3 Those who are interested… + Come on and join us now!'],
      sents: [
        ['This notice is written to inform the international students about the "Hope" singing competition.', '告示目的句。'],
        ['Several volunteers are needed for this activity.', '志愿者总论句。'],
        ['They should be warm-hearted, patient and confident, and most importantly, they ought to have good communication skills and be proficient in English.', '志愿者性格+能力两句连用。']
      ], checks: CHECK_SMALL },
    { id: 'p9', no: '预测九', title: '慈善义卖纪要', kind: '小作文', type: '纪要', sample: 'l-minutes',
      cn: '为帮助困难儿童,学校开了一场介绍慈善义卖的会议。写会议纪要告知同学细节(流程、目的、志愿者)。',
      dir: 'Suppose a meeting has been held to introduce a charity sale for kids in need of help. Write a minute to inform your classmates about the details. You should write about 100 words.',
      think: ['纪要=sdlpt 顶格:Subject/Date/Location/Present + The minutes are as follows。', '三个要点=复用活动句:流程 includes…、目的 aims to…、志愿者 Several volunteers…。', 'Present 题干有就写,没有不写(不编)。'],
      outline: ['Subject/Date/Location/Present 顶格', '1. 流程句(It includes a variety of processes…)', '2. 目的句(It aims to…)', '3. 志愿者句(Several volunteers are needed…)'],
      sents: [
        ['The minutes are as follows:', '纪要正文总起,固定句。'],
        ['It aims to enrich students\' life, improve their love, enhance their social sense of responsibility and broaden their horizons.', '目的句:四个 smile bar 短语连用。']
      ], checks: CHECK_SMALL },
    { id: 'p10', no: '预测十', title: '大学生获取新闻方式', kind: '大作文', type: '静态饼图', sample: 's-news',
      cn: '某高校学生获取新闻方式的调查:智能手机 52% · 电脑 21% · 报刊杂志 12% · 电视广播 11% · 其他 4%。',
      dir: 'Write an essay based on the chart below. In your writing, you should 1) interpret the chart, and 2) give your comments. You should write about 150 words.',
      data: '<tr><th></th><td>占比</td></tr><tr><th>智能手机</th><td>52%</td></tr><tr><th>电脑</th><td>21%</td></tr><tr><th>报刊杂志</th><td>12%</td></tr><tr><th>电视广播</th><td>11%</td></tr><tr><th>其他</th><td>4%</td></tr>',
      think: ['静态饼图:lion\'s share → takes up the second largest part → By contrast… respectively,顺序按图上大小。', '手机相关的行业原因二:the cellphone industry has been enjoying a rapid development。', '获益选:充分利用碎片时间 / 提高学习效率 / 开阔眼界。'],
      outline: ['P1 点图 + 手机 52% 最大、电脑 21% 第二、其余三项并列', 'P2 获益(碎片时间/提效/眼界)+ 手机行业迅速发展', 'P3 手机获取新闻比例 upward trend'],
      sents: [
        ['the proportion of smart phones gets the lion\'s share, occupying 52% and the percentage of computers takes up the second largest part, with 21%.', '静态图最大 + 第二大连招。'],
        ['that of television and radio, newspapers and magazines and others only accounts for 11%, 12% and 4% respectively.', '其余几项并列:that of… accounts for… respectively。'],
        ['making full use of fragmented time, improving the study efficiency and broadening our horizons', '本话题获益三短语。']
      ], checks: CHECK_BIG },
    { id: 'p11', no: '预测十一', title: '上班族就餐选择', kind: '大作文', type: '静态饼图', sample: 's-dining',
      cn: '某市上班族工作日就餐选择:外卖 61.3% · 下馆子 17.5% · 自己做 16% · 食堂 4.2% · 其他 1%。',
      dir: 'Write an essay based on the chart below. In your writing, you should 1) interpret the chart, and 2) give your comments. You should write about 150 words.',
      data: '<tr><th></th><td>占比</td></tr><tr><th>点外卖</th><td>61.3%</td></tr><tr><th>下馆子</th><td>17.5%</td></tr><tr><th>自己做饭</th><td>16%</td></tr><tr><th>食堂</th><td>4.2%</td></tr><tr><th>其他</th><td>1%</td></tr>',
      think: ['静态饼图套同一套句,只换主题名词:the dining choices of the commuters on weekdays。', '原因二走「反面版」:it is difficult for many people to cook their own foods because they are so busy with their work。', '获益选:生活更便利 / 大大节省时间 / 获得更多选择。'],
      outline: ['P1 点图 + 外卖 61.3% 最大、下馆子 17.5% 第二、其余三项并列', 'P2 获益(便利/省时/选择多)+ 工作太忙没法做饭', 'P3 外卖比例 upward trend'],
      sents: [
        ['the proportion of ordering the food delivery gets the lion\'s share, occupying 61.3%', '静态图最大占比句,换主题词即可。'],
        ['it is difficult for many people to cook their own foods because they are so busy with their work.', '反面版原因二:because 从句给理由。'],
        ['making our life more convenient, saving time greatly and acquiring more choices', '本话题获益三短语。']
      ], checks: CHECK_BIG },
    { id: 'p12', no: '预测十二', title: '机器人展推荐信', kind: '小作文', type: '书信', sample: 'l-reco2023',
      cn: '你的朋友 David 想了解中国的机器人展,写信向他推荐"希望"机器人展并说明理由。',
      dir: 'Suppose your friend David wants to know about robot shows in China. Write an email to recommend the "Hope" robot show to him. Use "Li Ming" instead. You should write about 100 words.',
      think: ['推荐信骨架=目的句 + 三个理由 + 期待回复;理由用「有名 → 获益 → 有趣」三层。', '第三层用 so…that 结果句:I never fail to be attracted to it。', '落款 Li Ming,不写机构。'],
      outline: ['P1 As one who…, I am writing this email to recommend…', 'P2 有名句 + 获益句 + so…that 有趣句', 'P3 I really hope that you can accept my recommendation.'],
      sents: [
        ['As one who has taken part in some robot shows, I am writing this email to recommend you the "Hope" robot show.', '推荐信目的句:As one who… 身份前置。'],
        ['it is so interesting that I never fail to be attracted to it, which leaves a deep impression on me.', 'so…that + which 从句,推荐第三层理由。']
      ], checks: CHECK_SMALL }
  ];

  window.WR2 = { core: CORE, drill: DRILL, big, small, practice, preds, samples: SAMPLES };
})();
