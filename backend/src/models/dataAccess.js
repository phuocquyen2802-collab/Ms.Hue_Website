// Lớp trung gian (Data Access Layer) để đọc/ghi các file JSON trong thư mục
// data/. Toàn bộ backend PHẢI thao tác dữ liệu qua module này, không được
// dùng fs.readFileSync/writeFileSync trực tiếp ở nơi khác, để đảm bảo tính
// nhất quán và dễ thay đổi cách lưu trữ sau này nếu cần.

const path = require('path');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

// Thư mục data/ nằm ở gốc dự án, ngoài thư mục backend/
const DATA_DIR = path.join(__dirname, '../../../data');

// Mỗi lần gọi tạo một lowdb instance MỚI, tức là luôn đọc lại dữ liệu mới
// nhất từ đĩa trước khi ghi. Đây là cách đơn giản nhất để tránh tình trạng
// một request ghi đè mất dữ liệu của request khác vừa ghi trước đó, mà
// không cần dùng tới transaction/locking phức tạp (phù hợp quy mô đồ án nhỏ).
function getDb(collectionName) {
  const filePath = path.join(DATA_DIR, `${collectionName}.json`);
  const adapter = new FileSync(filePath);
  const db = low(adapter);
  db.defaults([]).write();
  return db;
}

function findAll(collectionName) {
  return getDb(collectionName).value();
}

function findById(collectionName, id) {
  return getDb(collectionName).find({ id }).value();
}

function findOne(collectionName, predicate) {
  return getDb(collectionName).find(predicate).value();
}

function findMany(collectionName, predicate) {
  return getDb(collectionName).filter(predicate).value();
}

function insert(collectionName, item) {
  const db = getDb(collectionName);
  db.push(item).write();
  return item;
}

function updateById(collectionName, id, changes) {
  const db = getDb(collectionName);
  db.find({ id }).assign(changes).write();
  return db.find({ id }).value();
}

function removeById(collectionName, id) {
  const db = getDb(collectionName);
  db.remove({ id }).write();
}

module.exports = {
  findAll,
  findById,
  findOne,
  findMany,
  insert,
  updateById,
  removeById,
};
