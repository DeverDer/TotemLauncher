// Пиксельные цветные иконки в стиле Minecraft (сетка до 12x12), без внешних файлов
(() => {
  const PAL = { N: '#4a2f18', k: '#26262e', w: '#ffffff', s: '#c9c9d4', S: '#8a8a99', d: '#4a4a58', g: '#7ddc3a', G: '#3f9a22', r: '#e84a4a', R: '#a02424', b: '#4aa3f0', B: '#2468b8', y: '#ffd84a', Y: '#c9962a', n: '#9a6a3a', N: '#6a4426', c: '#55e0dc', C: '#2aa6a6', o: '#ff9a3a', p: '#ff7eb8', t: '#e0b08a', T: '#b07a52' };
  const G = {
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
  G.anvilo = G.anvil.map((r) => r.replace(/d/g, 'o').replace(/S/g, 'y'));
  const cache = {};
  const url = (n) => {
    if (cache[n]) return cache[n];
    const rows = G[n] || G.info, h = rows.length, w = Math.max(...rows.map((r) => r.length)), c = document.createElement('canvas'); c.width = c.height = 48; const x = c.getContext('2d');
    const ox = Math.floor((12 - w) / 2), oy = Math.floor((12 - h) / 2);
    rows.forEach((r, j) => [...r].forEach((ch, i) => { const col = PAL[ch]; if (col) { x.fillStyle = col; x.fillRect((ox + i) * 4, (oy + j) * 4, 4, 4); } }));
    return (cache[n] = c.toDataURL());
  };
  const hydrate = () => document.querySelectorAll('i[data-i]').forEach((e) => { e.style.backgroundImage = `url(${url(e.dataset.i)})`; });
  window.PIX = { url, hydrate, names: Object.keys(G) }; hydrate();
})();
