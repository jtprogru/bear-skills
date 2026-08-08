'use strict';

// Symlink-safe запись в предсказуемый путь.
//
// Флаг-файл лежит по угадываемому пути в домашнем каталоге. Если кто-то
// подменит его симлинком на чужой файл, обычная запись пойдёт по ссылке и
// перезапишет цель правами пользователя. Поэтому здесь: отказ при симлинке
// (на самом файле и на его родителе), O_NOFOLLOW, атомарная замена через
// временный файл, режим 0600.
//
// Все функции молча возвращают false при любой ошибке файловой системы.
// Хук не имеет права уронить старт сессии — это дороже, чем не записать флаг.

const fs = require('fs');
const path = require('path');

// Родитель не должен быть симлинком: подмена каталога уводит запись целиком,
// сколько бы проверок ни стояло на самом файле.
function parentIsSafe(filePath) {
  try {
    return !fs.lstatSync(path.dirname(filePath)).isSymbolicLink();
  } catch {
    return false;
  }
}

function targetIsSafe(filePath) {
  try {
    return !fs.lstatSync(filePath).isSymbolicLink();
  } catch (e) {
    // Файла нет — записывать можно. Любая другая ошибка — нельзя.
    return e.code === 'ENOENT';
  }
}

function safeWrite(filePath, contents) {
  try {
    if (!parentIsSafe(filePath) || !targetIsSafe(filePath)) return false;

    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });

    // Пишем во временный файл в том же каталоге и переименовываем:
    // читатель видит либо старое содержимое, либо новое, но не половину.
    const tmp = path.join(dir, `.${path.basename(filePath)}.${process.pid}.tmp`);
    const fd = fs.openSync(tmp, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL, 0o600);
    try {
      fs.writeFileSync(fd, contents);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(tmp, filePath);
    return true;
  } catch {
    return false;
  }
}

// Чтение с теми же гарантиями: по симлинку не ходим.
function safeRead(filePath) {
  try {
    if (!parentIsSafe(filePath) || !targetIsSafe(filePath)) return null;
    const fd = fs.openSync(filePath, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    try {
      return fs.readFileSync(fd, 'utf8');
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return null;
  }
}

function safeRemove(filePath) {
  try {
    if (!parentIsSafe(filePath) || !targetIsSafe(filePath)) return false;
    fs.unlinkSync(filePath);
    return true;
  } catch {
    return false;
  }
}

module.exports = { safeWrite, safeRead, safeRemove, parentIsSafe, targetIsSafe };
