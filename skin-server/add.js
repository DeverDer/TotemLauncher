// Добавить скин в каталог: node skin-server/add.js skin.png "Название" "Автор" [classic|slim] ["описание"]
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const [file, name, author, model = 'classic', desc = ''] = process.argv.slice(2);
if (!file || !name || !author) { console.error('Использование: node skin-server/add.js skin.png "Название" "Автор" [classic|slim] ["описание"]'); process.exit(1); }
const DATA = path.resolve(process.env.DATA || path.join(__dirname, 'data')), IDX = path.join(DATA, 'skins.json');
const b = fs.readFileSync(file);
if (b.length > 1 << 20 || b.readUInt32BE(0) !== 0x89504e47 || b.readUInt32BE(16) !== 64 || b.readUInt32BE(20) !== 64) { console.error('Нужен PNG 64×64 до 1 МБ'); process.exit(1); }
fs.mkdirSync(DATA, { recursive: true });
let j = { skins: [] }; try { j = JSON.parse(fs.readFileSync(IDX, 'utf8')); } catch {}
const id = crypto.randomBytes(6).toString('hex');
fs.writeFileSync(path.join(DATA, id + '.png'), b);
j.skins.push({ id, name: name.slice(0, 40), author: author.slice(0, 32), model: model === 'slim' ? 'slim' : 'classic', created: new Date().toISOString(), downloads: 0, desc: desc.slice(0, 300) });
fs.writeFileSync(IDX, JSON.stringify(j, null, 1)); console.log('Добавлен скин', id);
