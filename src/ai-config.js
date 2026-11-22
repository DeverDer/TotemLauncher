// Настройки встроенного помощника «Бурмалдец». Одни на всех пользователей, в интерфейс и в журнал не попадают.
// Значения хранятся в закодированном виде (чтобы не светились при случайном просмотре файла).
const d = (s) => Buffer.from(s, 'base64').toString('utf8');
module.exports = {
  base: d('aHR0cHM6Ly9hbnltb2RlbC5vcmcvdjE='),
  model: d('YW0vbmVtb3Ryb24tMy11bHRyYS01NTBiLWE1NWI='),
  key: d('c2stZGM5ZDRiN2RmMzZiYTU1NS1kOGh3NjMtMTY3ZTdiMzY='),
};
