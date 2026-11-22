# TotemLauncher
Лаунчер Minecraft Java для Windows (Electron).

- Запуск из исходников: `npm install && npm start` (Windows, Node 20+).
- Установка и обновления через GitHub: **docs/GITHUB.md** (пошаговая инструкция).
- Сборка установщика и пакета лаунчера: `npm run dist` → `dist/installer/TotemLauncher-Setup.exe` и `dist/TotemLauncher-<версия>-win-x64.zip`.
  На GitHub это делает workflow «Release» (вкладка Actions → Run workflow → тег `v0.16.0`).
- Первый запуск: окно настройки → экран загрузки → главное окно. Сброс первого запуска: удалить `%APPDATA%\totem-launcher\settings.json`.
- Логи: `%APPDATA%\totem-launcher\logs\launcher.log`. Заметки для разработки: `DEV_NOTES.md`.
