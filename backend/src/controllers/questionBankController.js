// Ngân hàng đề & trò chơi "Đường đua Toán học".
//
// Giáo viên tải lên nhiều file Word, mỗi file là 1 ngân hàng đề có tên chủ đề.
// Câu hỏi được bóc tách bằng đúng bộ nhập Word của phần tạo đề thi
// (docxImportService), chỉ giữ những câu đủ 4 đáp án và có đáp án đúng.
// Học sinh chọn chủ đề trong mục Trò chơi: máy chủ phát câu hỏi KHÔNG kèm đáp
// án đúng, mỗi lần trả lời thì gọi /check để chấm (không lộ đáp án trước).
//
// Dữ liệu: question_banks (thông tin ngân hàng), bank_questions (câu hỏi).
// Tách riêng khỏi questions của đề thi để không lẫn vào thống kê điểm.
const { v4: uuidv4 } = require('uuid');
const dataAccess = require('../models/dataAccess');
const { importExamFromDocx } = require('../services/docxImportService');

const BANKS = 'question_banks';
const BANK_QUESTIONS = 'bank_questions';
const MAX_GAME_QUESTIONS = 50;

const isBlank = (html) => !String(html || '').replace(/<(?!img)[^>]*>/gi, '').replace(/&nbsp;/g, ' ').trim();

function bankSummary(bank) {
  return {
    id: bank.id,
    title: bank.title,
    fileName: bank.fileName,
    questionCount: bank.questionCount,
    skippedCount: bank.skippedCount || 0,
    createdAt: bank.createdAt,
  };
}

// ---------- Giáo viên ----------

function listBanks(req, res) {
  const banks = dataAccess.findAll(BANKS)
    .slice()
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return res.json(banks.map(bankSummary));
}

async function createBank(req, res) {
  if (!req.file) return res.status(400).json({ message: 'Thiếu file .docx' });
  const title = String(req.body.title || '').trim();
  if (!title) return res.status(400).json({ message: 'Nhập tên chủ đề cho ngân hàng đề' });

  let parsed;
  try {
    parsed = await importExamFromDocx(req.file.buffer);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: `Không đọc được file Word: ${err.message}` });
  }

  const bankId = `qb-${uuidv4()}`;
  const now = new Date().toISOString();
  let skippedCount = 0;
  const questions = [];
  (parsed.questions || []).forEach((q) => {
    const options = (q.options || []).map((o) => ({ key: o.key, text: o.html || '' }));
    const playable = !isBlank(q.contentHtml)
      && options.length === 4
      && options.every((o) => !isBlank(o.text))
      && options.some((o) => o.key === q.suggestedAnswer);
    if (!playable) {
      skippedCount += 1;
      return;
    }
    questions.push({
      id: `bq-${uuidv4()}`,
      bankId,
      content: q.contentHtml,
      options,
      correctAnswer: q.suggestedAnswer,
      topic: q.topic || title,
      createdAt: now,
    });
  });

  if (questions.length === 0) {
    return res.status(400).json({
      message: 'Không tìm được câu hỏi nào đủ 4 đáp án và có bảng đáp án trong file này.',
      skippedCount,
    });
  }

  questions.forEach((q) => dataAccess.insert(BANK_QUESTIONS, q));
  const bank = {
    id: bankId,
    title,
    // Tên file gửi kèm từ trình duyệt (tên có dấu trong multipart dễ bị lỗi mã hoá).
    fileName: String(req.body.fileName || req.file.originalname || '').slice(0, 200) || null,
    questionCount: questions.length,
    skippedCount,
    createdBy: req.user.id,
    createdAt: now,
  };
  dataAccess.insert(BANKS, bank);
  return res.status(201).json(bankSummary(bank));
}

function renameBank(req, res) {
  const bank = dataAccess.findById(BANKS, req.params.bankId);
  if (!bank) return res.status(404).json({ message: 'Không tìm thấy ngân hàng đề' });
  const title = String(req.body.title || '').trim();
  if (!title) return res.status(400).json({ message: 'Nhập tên chủ đề cho ngân hàng đề' });
  return res.json(bankSummary(dataAccess.updateById(BANKS, bank.id, { title })));
}

function deleteBank(req, res) {
  const bank = dataAccess.findById(BANKS, req.params.bankId);
  if (!bank) return res.status(404).json({ message: 'Không tìm thấy ngân hàng đề' });
  dataAccess.findMany(BANK_QUESTIONS, { bankId: bank.id }).forEach((q) => dataAccess.removeById(BANK_QUESTIONS, q.id));
  dataAccess.removeById(BANKS, bank.id);
  return res.status(204).send();
}

// Xem trước câu hỏi (kèm đáp án đúng) - chỉ giáo viên.
function getBankQuestions(req, res) {
  const bank = dataAccess.findById(BANKS, req.params.bankId);
  if (!bank) return res.status(404).json({ message: 'Không tìm thấy ngân hàng đề' });
  const questions = dataAccess.findMany(BANK_QUESTIONS, { bankId: bank.id });
  return res.json({ bank: bankSummary(bank), questions });
}

// ---------- Học sinh: trò chơi ----------

function listGameBanks(req, res) {
  const banks = dataAccess.findAll(BANKS)
    .filter((b) => b.questionCount > 0)
    .sort((a, b) => a.title.localeCompare(b.title, 'vi'));
  return res.json(banks.map((b) => ({ id: b.id, title: b.title, questionCount: b.questionCount })));
}

function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Bắt đầu 1 lượt chơi: lấy ngẫu nhiên `count` câu (0 = tất cả), không kèm đáp án đúng.
function startGame(req, res) {
  const bank = dataAccess.findById(BANKS, req.params.bankId);
  if (!bank) return res.status(404).json({ message: 'Không tìm thấy ngân hàng đề' });
  const all = dataAccess.findMany(BANK_QUESTIONS, { bankId: bank.id });
  const wanted = Number(req.body?.count) || 0;
  const count = Math.min(all.length, wanted > 0 ? wanted : all.length, MAX_GAME_QUESTIONS);
  const questions = shuffle(all).slice(0, count).map((q) => ({ id: q.id, content: q.content, options: q.options }));
  return res.json({ bank: { id: bank.id, title: bank.title }, questions });
}

function checkGameAnswer(req, res) {
  const { questionId, answer } = req.body || {};
  const question = dataAccess.findById(BANK_QUESTIONS, questionId);
  if (!question || question.bankId !== req.params.bankId) {
    return res.status(404).json({ message: 'Không tìm thấy câu hỏi' });
  }
  return res.json({ correct: answer === question.correctAnswer, correctAnswer: question.correctAnswer });
}

module.exports = {
  listBanks, createBank, renameBank, deleteBank, getBankQuestions,
  listGameBanks, startGame, checkGameAnswer,
};
