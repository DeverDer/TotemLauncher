// Пиксельные цветные иконки в стиле Minecraft (сетка до 12x12), без внешних файлов
(() => {
  const PAL = { N: '#4a2f18', k: '#26262e', w: '#ffffff', s: '#c9c9d4', S: '#8a8a99', d: '#4a4a58', g: '#7ddc3a', G: '#3f9a22', r: '#e84a4a', R: '#a02424', b: '#4aa3f0', B: '#2468b8', y: '#ffd84a', Y: '#c9962a', n: '#9a6a3a', N: '#6a4426', c: '#55e0dc', C: '#2aa6a6', o: '#ff9a3a', p: '#ff7eb8', t: '#e0b08a', T: '#b07a52' };
  const G = {
    cal: ['.kkkkkkkkkk.', '.krrrrrrrrk.', '.kwwwwwwwwk.', '.kwSwSwSwSk.', '.kwwwwwwwwk.', '.kwSwSwSwSk.', '.kwwwwwwwwk.', '.kkkkkkkkkk.'],
    home: ['.....rr.....', '....rRRr....', '...rRrrRr...', '..rRrrrrRr..', '.rRrrrrrrRr.', '..tttttttt..', '..tyyttyyt..', '..tyyttyyt..', '..ttnnnntt..', '..ttnnnntt..', '..ttnNnntt..', '..kkkkkkkk..'],
    dl: ['....gggg....', '....gGGg....', '....gGGg....', '..gggGGggg..', '...gGGGGg...', '....gGGg....', '.....gg.....', '............', '.d........d.', '.dsssssssSd.', '.dSSSSSSSSd.', '.kkkkkkkkkk.'],
    layers: ['...gggggg...', '..gGGGGGGg..', '..nnnnnnnn..', '..nNNNNNNn..', '..nnnnnnnn..', '..ssssssss..', '..sSSSSSSs..', '..ssssssss..'],
    gear: ['.....SS.....', '..S..SS..S..', '.SSSSssSSSS.', '..SssSSssS..', '..SsS..SsS..', '.SSsS..SsSS.', '.SSsS..SsSS.', '..SsSSSSsS..', '..SssSSssS..', '.SSSSssSSSS.', '..S..SS..S..', '.....SS.....'],
    user: ['.kkkkkkkkkk.', '.kNNNNNNNNk.', '.kNNNNNNNNk.', '.kttttttttk.', '.kwBttttBwk.', '.kttttttttk.', '.kttTttTttk.', '.kttRRRRttk.', '.kttttttttk.', '.kkkkkkkkkk.'],
    chev: ['.ww......ww.', '..ww....ww..', '...ww..ww...', '....wwww....', '.....ww.....'],
    x: ['.rr......rr.', '.rrr....rrr.', '..rrr..rrr..', '...rrrrrr...', '....rrrr....', '....rrrr....', '...rrrrrr...', '..rrr..rrr..', '.rrr....rrr.', '.rr......rr.'],
    min: ['.ssssssssss.', '.SSSSSSSSSS.'],
    check: ['..........gg', '.........ggg', '........ggg.', 'gg.....ggg..', 'ggg...ggg...', '.ggg.ggg....', '..ggggg.....', '...ggg......'],
    minus: ['.SSSSSSSS.', '.SSSSSSSS.'],
    folder: ['.YYYY.......', '.yyyyYYYYYY.', '.yyyyyyyyyy.', '.yyyyyyyyyy.', '.yyyyyyyyyy.', '.yyyyyyyyyy.', '.yyyyyyyyyy.', '.YYYYYYYYYY.'],
    info: ['...bbbbbb...', '..bbbwwbbb..', '.bbbbwwbbbb.', '.bbbbbbbbbb.', '.bbbbwwbbbb.', '.bbbbwwbbbb.', '.bbbbwwbbbb.', '.bbbbwwbbbb.', '..bbbwwbbb..', '...bbbbbb...'],
    search: ['..ssss......', '.sbbbbs.....', 'sbwbbbbs....', 'sbbbbbbs....', 'sbbbbbbs....', '.sbbbbs.....', '..ssssn.....', '......nn....', '.......nn...', '........nn..'],
    grass: ['gggggggggggg', 'gGgggggGgggg', 'gggGgggggGgg', 'nggngggnggng', 'nnnnnnnnnnnn', 'nNnnnNnnnnNn', 'nnnnnnNnnnnn', 'nNnnnnnnNnnn', 'nnnnNnnnnnnN', 'nnnnnnnnnnnn'],
    shirt: ['.ccc.cc.ccc.', 'cccccccccccc', 'cccCcccCcccc', '.ccccccccc..', '..cccccccc..', '..cccccccc..', '..cccccccc..', '..CCCCCCCC..'],
    refresh: ['...gggggg...', '..gg....ggg.', '.gg......ggg', '.gg.....gggg', '.gg......ggg', '..gg....gg..', '...gggggg...'],
    lock: ['...yyyy...', '..y....y..', '..y....y..', '.yyyyyyyy.', '.yYYYYYYy.', '.yYYkkYYy.', '.yYYkkYYy.', '.yYYYYYYy.', '.yyyyyyyy.'],
    plus: ['....gg....', '....gg....', '....gg....', 'gggggggggg', 'gggggggggg', '....gg....', '....gg....', '....gg....'],
    play: ['.gg.........', '.gggg.......', '.gggggg.....', '.gggggggg...', '.gggggggggg.', '.gggggggg...', '.gggggg.....', '.gggg.......', '.gg.........'],
    grid: ['rrrrr.ggggg.', 'rrrrr.ggggg.', 'rrrrr.ggggg.', 'rrrrr.ggggg.', 'rrrrr.ggggg.', '............', 'bbbbb.yyyyy.', 'bbbbb.yyyyy.', 'bbbbb.yyyyy.', 'bbbbb.yyyyy.', 'bbbbb.yyyyy.'],
    l: ['....ww......', '...www......', '..wwww......', '.wwwwwwwwww.', '.wwwwwwwwww.', '..wwww......', '...www......', '....ww......'],
    r: ['......ww....', '......www...', '......wwww..', '.wwwwwwwwww.', '.wwwwwwwwww.', '......wwww..', '......www...', '......ww....'],
    up: ['.....gg.....', '....gggg....', '...gggggg...', '..gggggggg..', '.....gg.....', '.....gg.....', '.....gg.....', '.....gg.....'],
    anvil: ['dddddddddd..', 'dSSSSSSSdddd', '.ddddddddd..', '..dddddd....', '...dddd.....', '...dddd.....', '..dddddd....', '.dddddddddd.'],
    fabric: ['........ttt.', '.......tTtt.', '......tTtt..', '.....tTtt...', '....tTtt....', '...tTtt.....', '..tTtt......', '.tTtt.......'],
    pen: ['.........rr.', '........rRr.', '.......yyr..', '......yyy...', '.....yyy....', '....yyy.....', '...yyy......', '..nyy.......', '.nn.........'],
    er: ['......ppp...', '.....pppp...', '....ppppb...', '...pppbbb...', '..ppbbbb....', '.pbbbbb.....', '.bbbbb......'],
    fill: ['.....ss.....', '...ssbbss...', '..sbbbbbbs..', '.sbbbbbbbbs.', '.sbbbbbbbbs.', '..sbbbbbbs..', '...ssbbss...', '.....bb.....', '.....b......'],
    save: ['bbbbbbbbbb.', 'bbwwwwwwbb.', 'bbwwwwwwbb.', 'bbbbbbbbbb.', 'bbbbbbbbbb.', 'bBBBBBBBBb.', 'bBssssssBb.', 'bBssssssBb.', 'bBBBBBBBBb.'],
    trash: ['...ssss...', '.ssssssss.', '..sSsSsSs.', '..sSsSsSs.', '..sSsSsSs.', '..sSsSsSs.', '..sSsSsSs.', '..ssssssss'],
    copy: ['wwwwww......', 'wssssw......', 'wssssw.wwwww', 'wwwwww.wsssw', '.....wwwsssw', '......wwwwww'],
    paste: ['..nnnnnn..', '.nnwwwwnn.', '.nwwwwwwn.', '.nwswswwn.', '.nwwwwwwn.', '.nwswswwn.', '.nwwwwwwn.', '..nnnnnn..'],
    stop: ['.rrrrrrrr.', '.rRRRRRRr.', '.rRwwwwRr.', '.rRwwwwRr.', '.rRwwwwRr.', '.rRwwwwRr.', '.rRRRRRRr.', '.rrrrrrrr.'],
    chest: ['.nnnnnnnnnn.', 'nNNNNNNNNNNn', 'nnnnnyynnnnn', 'nnnnnyynnnnn', 'nNNNNNNNNNNn', 'nnnnnnnnnnnn', 'nNNNNNNNNNNn'],
    camera: ['.....kk.....', '.kkkkkkkkkk.', 'kssssssssssk', 'kssskkkksssk', 'ksskwwwwkssk', 'ksskwBBwkssk', 'ksskwBBwkssk', 'ksskwwwwkssk', 'kssskkkksssk', 'kssssssssssk', '.kkkkkkkkkk.'],
    tg: ['...BBBBBB...', '..BbbbbbbbB.', '.Bbbbbbbwwb.', '.Bbbbbbwwwb.', 'BbbbwwwwwbbB', 'BbbwwwwwwwbB', 'BbbbbwwwwbbB', 'BbbbbbwwwwbB', 'BbbbbbbwBwbB', '.BbbbbbbwbB.', '..BbbbbbbbB.', '...BBBBBB...'],
    catalog: ['NNNNNNNNNNNN', 'NrrbbggyyrrN', 'NrrbbggyyrrN', 'NrrbbggyyrrN', 'nnnnnnnnnnnn', 'NbbggyyrrbbN', 'NbbggyyrrbbN', 'NbbggyyrrbbN', 'NNNNNNNNNNNN'],
    bolt: ['......yy....', '.....yy.....', '....yy......', '...yyyyyy...', '.....yy.....', '....yy......', '...yy.......', '..y.........'],
    mapi: ['.kkkkkkkkkk.', 'kttttttttttk', 'ktgggttbbttk', 'ktgggttbbttk', 'kttttgggtttk', 'ktbbtgggttrk', 'ktbbttttttrk', 'kttttttttttk', '.kkkkkkkkkk.'],
    scissors: ['rr......rr..', 'rr.....rr...', '.rr...rr....', '..rrrrr.....', '..sssss.....', '.ss...ss....', 'ss.....ss...'],
  };
  // v0.16: новые детальные иконки 16x16 (главная, загрузки, сборки, настройки, телеграм, обновить, стрелки, играть, закрыть, свернуть, каталог)
  const PAL2 = {'k': '#1a1626', 'w': '#ffffff', 'e': '#f1ecff', 's': '#c9c9d4', 'S': '#8a8a99', 'd': '#4a4a58', 'D': '#4a2410', 'g': '#5fd62a', 'G': '#2f8f1a', 'j': '#b6f56a', 'J': '#1d5f12', 'L': '#e9d8ff', 'l': '#c79bff', 'M': '#a35cf0', 'm': '#6a31c4', 'q': '#3b1a7a', 'a': '#e8841f', 'A': '#b4560f', 'h': '#ffc766', 'o': '#f79a2e', 'y': '#ffd84a', 'Y': '#c9962a', 'n': '#9a6a3a', 'b': '#4aa3f0', 'B': '#2468b8', 'c': '#9fe0ff', 'r': '#e84a4a', 'R': '#a02424', 't': '#6b3a1a', 'T': '#8a4e22'};
  const G2 = {
    home: ['.......ll.......', '......llLl......', '.....llLLLl.....', '....llLLLLLl....', '...llLLLLLLLl...', '..llLLLLLLLLLl..', '.llLLLLLLLLLLLl.', 'llMMMMMMMMMMMMll', '..eeeeeeeeeeee..', '..eeeeeeeeeeee..', '..eeeemmmmeeee..', '..eeeemqqmeeee..', '..eeeemqqmeeee..', '..eeeemqqmeeee..', '..llllllllllll..'],
    dl: ['......jggG......', '......jggG......', '......jggG......', '......jggG......', '..jgggggggggGG..', '...jggggggggG...', '....jggggggG....', '.....jggggG.....', '......jggG......', '................', '.dd..........dd.', '.dsssssssssssSd.', '.dSSSSSSSSSSSSd.', '.kkkkkkkkkkkkkk.'],
    layers: ['.DDDDDDD........', '.DhhhhhhDDDDDDD.', '.DhaaaaaaaaaaaD.', '.DhaaaaaaaawwaD.', '.DDDDDDDDDDDDDD.', '.DhhhhhhhhhhhhD.', '.DhooooooooooAD.', '.DhooooooooooAD.', '.DhooooooooooAD.', '.DhooooooooooAD.', '.DhooooooooooAD.', '.DAAAAAAAAAAAAD.', '.DDDDDDDDDDDDDD.'],
    gear: ['......dddd......', '......deed......', '..ddd.deed.ddd..', '..deedeeesdssd..', '..deeeeesssssd..', '...deeesssssd...', 'dddeeeddddssSddd', 'deeeesdkkdsSSSSd', 'deeessdkkdSSSSSd', 'dddsssddddSSSddd', '...dssssSSSSd...', '..dssssSSSSSSd..', '..dssdSSSSdSSd..', '..ddd.dSSd.ddd..', '......dSSd......', '......dddd......'],
    tg: ['................', '..............w.', '............wwl.', '.........wwwwl..', '.......wwwwwLl..', '.....wwwwwwLll..', '...wwwwwwwLll...', '.wwwwwwwwLlll...', '...wwwwwLLlll...', '.....wwLLlll....', '.......Mllll....', '........Mlll....', '.........ll.....', '.........Ml.....', '..........l.....', '................'],
    refresh: ['................', '................', '......LMMM......', '....LLMMMMMM....', '...LLMM..MMMMM..', '...LM......MMM..', '..LMM.....MMMM..', '............Mm..', '..MM............', '..MMMM.....mmm..', '..MMM......mm...', '..MMMMM..mmmm...', '....MMMMmmmm....', '......Mmmm......', '................', '................'],
    l: ['.........ww.....', '........wwww....', '.......wwwwe....', '......wwwwe.....', '.....wwwwe......', '....wwwwe.......', '...wwwwe........', '..wwwwe.........', '...wwwwe........', '....wwwwe.......', '.....wwwwe......', '......wwwwe.....', '.......wwwwe....', '........wwww....', '.........ww.....'],
    r: ['.....ww.........', '....wwww........', '....ewwww.......', '.....ewwww......', '......ewwww.....', '.......ewwww....', '........ewwww...', '.........ewwww..', '........ewwww...', '.......ewwww....', '......ewwww.....', '.....ewwww......', '....ewwww.......', '....wwww........', '.....ww.........'],
    play: ['.JJ.............', '.JjJJ...........', '.JjggJJ.........', '.JjgggggJJ......', '.JjgggggggJJ....', '.JjggggggggggJJ.', '.JjggggggggggggJ', '.JjggggggggggJJ.', '.JjgggggggJJ....', '.JjgggggJJ......', '.JjggJJ.........', '.JjJJ...........', '.JJ.............'],
    x: ['.ww........ww.', '.www......www.', '..www....www..', '...www..www...', '....wwwwww....', '.....wwww.....', '.....wwww.....', '....wwwwww....', '...www..www...', '..www....www..', '.www......www.', '.ww........ww.'],
    min: ['.wwwwwwwwwwww.', '.wwwwwwwwwwww.', '.eeeeeeeeeeee.'],
    catalog: ['.DDDDDDDDDDDD.', 'DhhhhhhhhhhhhD', 'DhoooooooooooA', 'DhoooooccooooA', 'DDDDDDDccDDDDD', 'DhaaaaacBaaaAD', 'DhaaaaabbBaaAD', 'DhaaaaaaaaaaAD', 'DhaaaaaaaaaaAD', 'DAAAAAAAAAAAAD', '.DDDDDDDDDDDD.'],
  };
  G2.cube = ['......llll......', '....llLLLLll....', '..llLLLLLLLLll..', 'llLLLLLLLLLLLLll', 'lMLLLLLLLLLLLLml', 'lMMMLLLLLLLLmmml', 'lMMMMMLLLLmmmmml', 'lMMMMMMllmmmmmml', 'lMMMMMMMmmmmmmml', 'lMMMMMMMmmmmmmml', 'lMMMMMMMmmmmmmml', '.lMMMMMMmmmmmml.', '..lMMMMMmmmmml..', '....lMMMmmml....', '......lmml......'];

  // v0.17: иконки для новой вкладки «Настройки» (16x16, та же палитра)
  Object.assign(PAL2, { 'z': '#ff7eb8', 'Z': '#c44a85', 'u': '#7a4bd0', 'v': '#5a35a8' });
  Object.assign(G2, {
    gamepad: ['................', '................', '...qqqqqqqqqq...', '..qMLLLLLLLLMq..', '.qMLMMMMMMMMMMq.', 'qMLMMwMMMMMMyMMq', 'qMMMwwwMMMMyyrMq', 'qMMwwwwwMMMMrrMq', 'qMMMwwwMMMgMMMMq', 'qMMMMwMMMgGgMMMq', 'qMMMMMMMMMgMMMmq', 'qMMmmmmmmmmmmMmq', '.qMmqqqqqqqqmMq.', '.qmq........qmq.', '..qq........qq..', '................'],
    palette: ['................', '....qqqqqqqq....', '..qqMMMMMMMqq...', '.qMMLLMMMMMMMq..', 'qMLLMMrrMMMMMMq.', 'qMLMMrrrMMyyMMq.', 'qMMMMMrMMyyyMMq.', 'qMMggMMMMMyMMMq.', 'qMggGgMMMMMMMMq.', 'qMMgGMMMMqqqMMq.', '.qMMMMMMqbbbqMq.', '.qMMMMMMMqbbq...', '..qmMMMMMMqqm...', '...qqmmmmmmq....', '.....qqqqqq.....', '................'],
    files: ['................', '.DDDDDD.........', 'DhhhhhhDDDDDDDD.', 'DhooooooooooooAD', 'DhoYYYYYYYYYYoAD', 'DhoooooooooooAAD', 'DhaaaaaaaaaaaAAD', 'DhaaaaaaaaaaaaAD', 'DhaaaaaaaaaaaaAD', 'DhaaaaaaaaaaaaAD', 'DhaaaaaaaaaaaaAD', 'DhaaaaaaaaaaaaAD', 'DhaaaaaaaaaaaaAD', 'DAAAAAAAAAAAAAAD', '.DDDDDDDDDDDDDD.', '................'],
    key: ['................', '.........hhhh...', '.......hhooooh..', '......hooaaaaoh.', '.....hoaAhhAaoh.', '.....hoaA..Aaoh.', '.....hoaAhhAaoh.', '....hhoaaaaaaoh.', '...hhooAAAAAAh..', '..hhoaAhhhhhh...', '.hhoaAh.........', '.hoaAh..........', 'hhaAhh..........', 'hoAAh...........', '.hhh............', '................'],
    ram: ['................', '..M.M.M.M.M.M...', '..M.M.M.M.M.M...', '.qqqqqqqqqqqqq..', '.qLLLLLLLLLLLq..', 'MqLmmmmmmmmmLqM.', 'MqLmMMMMMMMmLqM.', 'MqLmMwwwwwMmLqM.', 'MqLmMwqqqwMmLqM.', 'MqLmMwwwwwMmLqM.', 'MqLmMMMMMMMmLqM.', 'MqLmmmmmmmmmLqM.', '.qLLLLLLLLLLLq..', '.qqqqqqqqqqqqq..', '..M.M.M.M.M.M...', '..M.M.M.M.M.M...'],
    eyeoff: ['................', '................', '.qwq............', '..qwq...........', '...qwqllllllll..', '..lMqwqMMMMMMMl.', '.lMMLqwqwwLLMMl.', 'lMMLLwqwqwwLLMMl', 'lMMLLwwqwqwLLMMl', '.lMMLLwwqwqLMMl.', '..lMMMMMMqwqMMl.', '...lllllllqwql..', '...........qwq..', '............qwq.', '................', '................'],
    winback: ['................', '.qqqqqqqqqqqq...', '.qMMMMMMMMMMq...', '.qMwMwMMMMMMq...', '.qqqqqqqqqqqq...', '.qLLLLLLLLLLqqq.', '.qLmmmmmmmmLqMq.', '.qLmmmmmmmmLqMq.', '.qLmmmmmmmmLqMq.', '.qLmmmmmmmmLqMq.', '.qLmmmmmmmmLqMq.', '.qqqqqqqqqqqqqMq', '.........qMMMMMq', '.........qqqqqqq', '................', '................'],
    sparkle: ['................', '.......L........', '.......L........', '......LlL.......', '......LlL.......', '.....LlMlL......', 'LLLLLlMMMlLLLLL.', '.LlllMMwMMllllL.', '.....LlMlL......', '......LlL...L...', '......LlL..LlL..', '.......L..LlMlL.', '.......L...LlL..', '............L...', '................', '................'],
    windows: ['................', '.bbbbbbb.bbbbbbb', '.bcccccB.bccccB.', '.bcccccB.bccccB.', '.bcccccB.bccccB.', '.bcccccB.bccccB.', '.BBBBBBB.BBBBBB.', '................', '.bbbbbbb.bbbbbbb', '.bcccccB.bccccB.', '.bcccccB.bccccB.', '.bcccccB.bccccB.', '.bcccccB.bccccB.', '.BBBBBBB.BBBBBB.', '................', '................'],
    shortcut: ['................', '.qqqqqqqqqqqqqq.', '.qLLLLLLLLLLLLq.', '.qLMMMMwwwwwwmq.', '.qLMMMMwwwwwwmq.', '.qLMMMMMMwwwwmq.', '.qLMMMMMwwwwwmq.', '.qLMMMMwwwMwwmq.', '.qLMMMwwwMMwwmq.', '.qLMMwwwMMMMMmq.', '.qLMwwwMMMMMMmq.', '.qLwwwMMMMMMMmq.', '.qLMMMMMMMMMMmq.', '.qLmmmmmmmmmmmq.', '.qqqqqqqqqqqqqq.', '................'],
    image: ['................', '.qqqqqqqqqqqqqq.', '.qLLLLLLLLLLLLq.', '.qLbbbbbbbbbbLq.', '.qLbbyybbbbbbLq.', '.qLbyyyybbbbbLq.', '.qLbbyybbbbMbLq.', '.qLbbbbbbbMMMLq.', '.qLbbbbbbMMMMMq.', '.qLbbggbMMMMMMq.', '.qLbggggMMMMMLq.', '.qLggggggMMMMLq.', '.qLGGGGGGGGGGLq.', '.qLLLLLLLLLLLLq.', '.qqqqqqqqqqqqqq.', '................'],
    drop: ['................', '.......l........', '.......ll.......', '......lMl.......', '......lMMl......', '.....lMMMMl.....', '....lMLMMMMl....', '....lMLMMMMMl...', '...lMLMMMMMMml..', '...lMLMMMMMmml..', '...lMMMMMMMmml..', '....lMMMMMmml...', '.....lMmmmml....', '......llllll....', '................', '................'],
    sun: ['................', '.......y........', '..y....y....y...', '...y.......y....', '......yyyy......', '.....yhhhyy.....', '....yhhyyyyY....', 'yy..yhyyyyyY.yy.', '....yyyyyyyY....', '.....yyyyYY.....', '...y..YYYY..y...', '..y....y.....y..', '.......y........', '................', '................', '................'],
    brush: ['................', '..............ww', '.............wMw', '............wMMw', '...........wMMw.', '..........wMMw..', '.........wMMw...', '........nnMw....', '.......nnnn.....', '......nnnnn.....', '.....ynnnn......', '....yyynn.......', '...yyyyn........', '...yyyy.........', '....yy..........', '................'],
    bell: ['................', '.......yy.......', '......yhhy......', '.....yhooyy.....', '....yhooooyy....', '....yhoooooY....', '....yhoooooY....', '...yhooooooYY...', '...yhooooooYY...', '..yhoooooooYYY..', '..yyyyyyyyyyyy..', '.......YY.......', '......YyyY......', '.......YY.......', '................', '................'],
    cursor: ['................', '..ww............', '..wLw...........', '..wLLw..........', '..wLLLw.........', '..wLLLLw........', '..wLLLLLw.......', '..wLLLLLLw......', '..wLLLLLLLw.....', '..wLLLLwwwww....', '..wLLwLw........', '..wLw.wLw.......', '..ww..wLw.......', '.......wLw......', '........ww......', '................'],
    eye: ['................', '................', '................', '...lllllllllll..', '..lMMMMMMMMMMMl.', '.lMMLLwwwwLLMMl.', 'lMMLLwwqqwwLLMMl', 'lMMLLwwqqwwLLMMl', '.lMMLLwwwwLLMMl.', '..lMMMMMMMMMMMl.', '...lllllllllll..', '................', '................', '................', '................', '................']
  });

  // v0.19: иконки окошка загрузок (пауза, ожидание — песочные часы)
  Object.assign(G2, {
    pause: ['................', '................', '..qqqqq..qqqqq..', '..qLeMq..qLeMq..', '..qLeMq..qLeMq..', '..qLeMq..qLeMq..', '..qLeMq..qLeMq..', '..qLeMq..qLeMq..', '..qLeMq..qLeMq..', '..qLeMq..qLeMq..', '..qLeMq..qLeMq..', '..qLeMq..qLeMq..', '..qLeMq..qLeMq..', '..qqqqq..qqqqq..', '................', '................'],
    wait: ['................', '..DDDDDDDDDDDD..', '...cccccccccc...', '...cyyyyyyyyc...', '....cyyyyyyc....', '.....cyyyyc.....', '......cyyc......', '.......yy.......', '.......yy.......', '......cYYc......', '.....cYYYYc.....', '....cYYYYYYc....', '...cYYYYYYYYc...', '...cccccccccc...', '..DDDDDDDDDDDD..', '................'],
  });
  // v0.20: иконки новостей (рупор, календарь)
  Object.assign(G2, {
    news: ['................', '..........ll....', '........llMMm...', '..lllllllMMMMMm.', '.lMMMMMMMMMMMMMm', '.lMwwMMMMMMMMMMm', '.lMwwMMMMMMMMMMm', '.lMMMMMMMMMMMMMm', '..mmmmmmmMMMMMm.', '....mMMm.mMMMm..', '....mMMm...mMm..', '....mmmm........', '................', '................', '................', '................'],
    cal: ['................', '..ll........ll..', '.qqqqqqqqqqqqqq.', '.qMMMMMMMMMMMMq.', '.qLLLLLLLLLLLLq.', '.qLmLLmLLmLLmLq.', '.qLLLLLLLLLLLLq.', '.qLmLLmLLmLLmLq.', '.qLLLLLLLLLLLLq.', '.qLmLLmLLmLLmLq.', '.qLLLLLLLLLLLLq.', '.qqqqqqqqqqqqqq.', '................', '................', '................', '................'],
  });
  // v0.21: кнопка «на весь экран» / «в окно»
  Object.assign(G2, {
    max: ['wwwwwwwwwwwwww', 'wwwwwwwwwwwwww', 'ww..........ww', 'ww..........ww', 'ww..........ww', 'ww..........ww', 'ww..........ww', 'ww..........ww', 'wwwwwwwwwwwwww', 'eeeeeeeeeeeeee'],
    restore: ['....wwwwwwwwww', '....wwwwwwwwww', '....ww......ww', '....ww......ww', 'wwwwwwwwww..ww', 'wwwwwwwwww..ww', 'ww......wwwwww', 'ww......wwwwww', 'ww......ww....', 'ww......ww....', 'wwwwwwwwww....', 'eeeeeeeeee....'],
  });
  // v0.21: чат с Бурмалдецем (облачко, отправить, история)
  Object.assign(G2, {
    ai: ['..............y.', '..qqqqqqqqqqqy..', '.qLLLLLLLLLLLLq.', '.qLMMMMMMMMMMmq.', '.qLMMMMMMMMMMmq.', '.qLMMwMMwMMwMmq.', '.qLMMwMMwMMwMmq.', '.qLMMMMMMMMMMmq.', '.qLMMMMMMMMMMmq.', '.qmmmmmmmmmmmmq.', '..qqqqqqqqqqqq..', '....qmmq........', '....qmq.........', '....qq..........'],
    send: ['.ww.............', '.wwww...........', '.wwwwww.........', '.wwwwwwww.......', '.wwwwwwwwww.....', '.wwwwwwwwwwww...', '.wwwwwwwwwwwwww.', '.wwwwwwwwwwww...', '.wwwwwwwwww.....', '.wwwwwwww.......', '.wwwwww.........', '.wwww...........', '.ww.............'],
    history: ['................', '.....wwwwww.....', '...wwwMMMMwww...', '..wwMMMMMMMMww..', '..wMMMMwMMMMMw..', '.wwMMMMwMMMMMww.', '.wMMMMMwMMMMMMw.', '.wMMMMMwwwwMMMw.', '.wMMMMMMMMMMMMw.', '.wwMMMMMMMMMMww.', '..wMMMMMMMMMMw..', '..wwMMMMMMMMww..', '...wwwMMMMwww...', '.....wwwwww.....'],
  });
  // v0.16 (перенос из «взять»): значки для списка сборок, избранного, журнала ошибок и категорий каталога
  Object.assign(G2, {
    puzzle: ['................', '................', '.....JJJJ.......', '.....JjjJ.......', '.....JgGJ.......', '..JJJggggJJJ....', '..JjjggggjjJ....', '..JgggggggGJ....', '..JgggggggggJJJ.', '..JgggggggggjjJ.', '..JgggggggggGGJ.', '..JgggggggggJJJ.', '..JgggggggGJ....', '..JjGGGGGGGJ....', '..JJJJJJJJJJ....', '................'],
    star: ['.......YY.......', '......YhhY......', '......YyoY......', '.....YyyyoY.....', 'YYYYYhyyyyhYYYYY', '.YhhhyyyyyyhhhY.', '..YyyyyyyyyyoY..', '...YyyyyyyyoY...', '...YyyyooyyoY...', '..YyyyoYYoyyoY..', '..YyyoY..YhyoY..', '.YyyoY....YhyoY.', '.YhoY......YhoY.', 'YYYY........YYYY', '................', '................'],
    starO: ['.......dd.......', '......dssd......', '......dSSd......', '.....dSSSSd.....', 'dddddsSSSSsddddd', '.dsssSSSSSSsssd.', '..dSSSSSSSSSSd..', '...dSSSSSSSSd...', '...dSSSSSSSSd...', '..dSSSSddSSSSd..', '..dSSSd..dsSSd..', '.dSSSd....dsSSd.', '.dsSd......dsSd.', 'dddd........dddd', '................', '................'],
    heart: ['................', '................', '..RRRRR..RRRRR..', '.RwwwwwRRwwwwwR.', '.RrwwrrwwrrrrRR.', '.RrwrrrrrrrrrRR.', '.RwrrrrrrrrrrRR.', '..RwrrrrrrrrRR..', '...RwrrrrrrRR...', '....RwrrrrRR....', '.....RwrrRR.....', '......RwRR......', '.......RR.......', '................', '................', '................'],
    warn: ['................', '.......YY.......', '.......YY.......', '......YyoY......', '......YyoY......', '.....YykkoY.....', '.....YykkoY.....', '....YyykkyoY....', '....YyykkyoY....', '...YyyykkyyoY...', '...YyyyyyyyoY...', '..YyyyykkyyyoY..', '..YhoooooooooY..', '.YYYYYYYYYYYYYY.', '................', '................'],
    dots: ['................', '................', '................', '................', '................', '................', '.www..www..www..', '.www..www..www..', '.sss..sss..sss..', '................', '................', '................', '................', '................', '................', '................'],
    java: ['................', '.........b......', '.....b....b.....', '......b..b......', '.....b....b.....', '......b.........', '................', '...ddddddddd....', '...deeeeeeeeddd.', '...drrrrrrrsd.d.', '...drrrrrrrsd.d.', '...desssssssddd.', '...ddddddddd....', '..SSSSSSSSSSS...', '...ddddddddd....', '................'],
    scroll: ['................', '................', '....ttttttttt...', '..TTeeeeeeeeet..', '..TTLLLLLLLLLt..', '..TTDDDDDDDDLt..', '..TTLLLLLLLLLt..', '..TTDDDDDDDDLt..', '..TTLLLLLLLLLt..', '..TTDDDDDDDDLt..', '..TTLLLLLLLLLt..', '..TTDDDDDLLLLt..', '..TTLLLLLLLLLt..', '....ttttttttt...', '................', '................'],
    crate: ['................', '................', '.DDDDDDDDDDDDDD.', '.DAAhhhhhhhhAAD.', '.DnAAnnnnnnAATD.', '.DnnAAnnnnAAnTD.', '.DnnnAAnnAAnnTD.', '.DnnnnAAAAnnnTD.', '.DAAAAAAAAAAAAD.', '.DnnnnAAAAnnnTD.', '.DnnnAAnnAAnnTD.', '.DnnAAnnnnAAnTD.', '.DnAAnnnnnnAATD.', '.DAATTTTTTTTAAD.', '.DDDDDDDDDDDDDD.', '................'],
  });
  G.anvilo = G.anvil.map((r) => r.replace(/d/g, 'o').replace(/S/g, 'y'));
  // v0.18: картинки-иконки (блок земли, телеграм, фотоаппарат, лицо Стива) лежат файлами
  const IMG = { catalog: 'assets/icons/catalog.png', grass: 'assets/icons/grass.png', tg: 'assets/icons/tg.png', camera: 'assets/icons/camera.png', steve: 'assets/icons/steve.png' };
  const cache = {};
  const url = (n) => {
    if (IMG[n]) return IMG[n];
    if (cache[n]) return cache[n];
    const big = !!G2[n], rows = G2[n] || G[n] || G.info, pal = big ? PAL2 : PAL, S = big ? 16 : 12, cell = 48 / S, h = rows.length, w = Math.max(...rows.map((r) => r.length)), c = document.createElement('canvas'); c.width = c.height = 48; const x = c.getContext('2d');
    const ox = Math.floor((S - w) / 2), oy = Math.floor((S - h) / 2);
    rows.forEach((r, j) => [...r].forEach((ch, i) => { const col = pal[ch]; if (col) { x.fillStyle = col; x.fillRect((ox + i) * cell, (oy + j) * cell, cell, cell); } }));
    return (cache[n] = c.toDataURL());
  };
  const hydrate = () => document.querySelectorAll('i[data-i]').forEach((e) => { e.style.backgroundImage = `url(${url(e.dataset.i)})`; e.classList.toggle('im', !!IMG[e.dataset.i]); });
  window.PIX = { url, hydrate, isImg: (n) => !!IMG[n], names: [...Object.keys(G), ...Object.keys(G2), ...Object.keys(IMG)] }; hydrate();
})();
