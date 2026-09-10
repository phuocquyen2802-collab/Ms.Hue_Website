const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const dataAccess = require('../models/dataAccess');

// Thư mục lưu trữ tệp đính kèm tin nhắn
const UPLOAD_DIR = path.join(__dirname, '../../../data/chat_uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Giải mã tên file tiếng Việt UTF-8 chuẩn (khắc phục lỗi Multer tự parse thành Latin1)
function decodeUtf8FileName(str) {
  if (!str) return '';
  try {
    const converted = Buffer.from(str, 'latin1').toString('utf8');
    // Nếu có chứa ký tự tiếng Việt hợp lệ, trả về chuỗi đã fix
    return converted;
  } catch {
    return str;
  }
}

// Cấu hình Multer lưu tệp vào đĩa
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const rawName = decodeUtf8FileName(file.originalname);
    const ext = path.extname(rawName);
    const safeName = path.basename(rawName, ext).replace(/[^a-zA-Z0-9_\-\u00C0-\u024F\u1E00-\u1EFF]/g, '_');
    cb(null, `${uuidv4()}_${Date.now()}_${safeName}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // Hỗ trợ tới 50MB
});

// Ngưỡng thời gian xác định người dùng đang online (hoạt động trong 2 phút gần nhất)
const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;

// Cập nhật nhịp tim (Heartbeat) định kỳ khi người dùng đang mở trang
function heartbeat(req, res) {
  const userId = req.user.id;
  const now = new Date().toISOString();

  const user = dataAccess.findById('users', userId);
  if (user) {
    dataAccess.updateById('users', userId, { lastActiveAt: now });
  }

  return res.json({ ok: true, lastActiveAt: now });
}

// Đặt trạng thái ngoại tuyến ngay lập tức khi đăng xuất
function setOffline(req, res) {
  const userId = req.user.id;
  const user = dataAccess.findById('users', userId);
  if (user) {
    dataAccess.updateById('users', userId, { lastActiveAt: null });
  }
  return res.json({ ok: true });
}

function safeArray(val) {
  return Array.isArray(val) ? val : [];
}

// Upload tệp đính kèm (Word, PDF, Excel, Ảnh...)
function uploadFile(req, res) {
  if (!req.file) {
    return res.status(400).json({ message: 'Không có tệp nào được tải lên' });
  }

  const file = req.file;
  const originalUtf8Name = decodeUtf8FileName(file.originalname);
  const isImage = file.mimetype.startsWith('image/');
  const fileUrl = `/api/chat/download/${file.filename}?name=${encodeURIComponent(originalUtf8Name)}`;

  return res.json({
    fileId: file.filename,
    name: originalUtf8Name,
    size: file.size,
    type: file.mimetype,
    isImage,
    url: fileUrl,
  });
}

// Tải tệp đính kèm về máy (giữ đúng 100% tên file tiếng Việt có dấu)
function downloadFile(req, res) {
  const filename = req.params.filename;
  const safeFilename = path.basename(filename);
  const filePath = path.join(UPLOAD_DIR, safeFilename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: 'Tệp không tồn tại hoặc đã bị xóa' });
  }

  let customName = req.query.name ? decodeURIComponent(req.query.name) : safeFilename;
  customName = decodeUtf8FileName(customName);

  return res.download(filePath, customName);
}

// Lấy danh sách liên hệ kèm trạng thái online (dấu chấm xanh) và tin nhắn gần nhất
function getContacts(req, res) {
  const currentUserId = req.user.id;
  const isTeacher = req.user.role === 'teacher';
  const now = Date.now();

  const allUsers = safeArray(dataAccess.findAll('users'));
  const allMessages = safeArray(dataAccess.findAll('messages'));

  // Giáo viên thấy tất cả học sinh, Học sinh thấy các giáo viên
  const targetUsers = allUsers.filter((u) => (isTeacher ? u.role === 'student' : u.role === 'teacher'));

  const contacts = targetUsers.map((target) => {
    const lastActiveMs = target.lastActiveAt ? new Date(target.lastActiveAt).getTime() : 0;
    const isOnline = now - lastActiveMs <= ONLINE_THRESHOLD_MS;

    // Lọc tin nhắn giữa 2 người
    const conversation = allMessages.filter(
      (m) =>
        (m.senderId === currentUserId && m.receiverId === target.id) ||
        (m.senderId === target.id && m.receiverId === currentUserId)
    );
    conversation.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    const lastMessage = conversation.length > 0 ? conversation[conversation.length - 1] : null;
    const unreadCount = conversation.filter((m) => m.receiverId === currentUserId && !m.read).length;

    let snippet = '';
    if (lastMessage) {
      if (lastMessage.text) snippet = lastMessage.text;
      else if (lastMessage.image) snippet = '📷 [Hình ảnh]';
      else if (lastMessage.attachment) snippet = `📎 [Tệp: ${lastMessage.attachment.name}]`;
    }

    return {
      id: target.id,
      name: target.name,
      email: target.email,
      role: target.role,
      className: target.className || '',
      isOnline,
      lastActiveAt: target.lastActiveAt || null,
      lastMessage: lastMessage
        ? {
            text: snippet,
            createdAt: lastMessage.createdAt,
            senderId: lastMessage.senderId,
            isMe: lastMessage.senderId === currentUserId,
          }
        : null,
      unreadCount,
    };
  });

  // Sắp xếp: Ai có tin nhắn chưa đọc lên đầu, sau đó đến ai online
  contacts.sort((a, b) => {
    if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
    if (b.unreadCount > 0 && a.unreadCount === 0) return 1;
    if (a.isOnline && !b.isOnline) return -1;
    if (!a.isOnline && b.isOnline) return 1;

    const timeA = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
    const timeB = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
    if (timeA !== timeB) return timeB - timeA;

    return a.name.localeCompare(b.name, 'vi');
  });

  return res.json(contacts);
}

// Lấy lịch sử hội thoại với một người dùng cụ thể
function getConversation(req, res) {
  const currentUserId = req.user.id;
  const partnerId = req.params.partnerId;

  const partner = dataAccess.findById('users', partnerId);
  if (!partner) {
    return res.status(404).json({ message: 'Không tìm thấy người dùng' });
  }

  const allMessages = safeArray(dataAccess.findAll('messages'));
  const conversation = allMessages
    .filter(
      (m) =>
        (m.senderId === currentUserId && m.receiverId === partnerId) ||
        (m.senderId === partnerId && m.receiverId === currentUserId)
    )
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  // Đánh dấu các tin nhắn đối phương gửi cho mình là đã đọc
  let hasChanges = false;
  conversation.forEach((m) => {
    if (m.receiverId === currentUserId && !m.read) {
      dataAccess.updateById('messages', m.id, { read: true });
      m.read = true;
      hasChanges = true;
    }
  });

  const now = Date.now();
  const lastActiveMs = partner.lastActiveAt ? new Date(partner.lastActiveAt).getTime() : 0;
  const isOnline = now - lastActiveMs <= ONLINE_THRESHOLD_MS;

  return res.json({
    partner: {
      id: partner.id,
      name: partner.name,
      role: partner.role,
      className: partner.className || '',
      isOnline,
      lastActiveAt: partner.lastActiveAt,
    },
    messages: conversation,
  });
}

// Gửi tin nhắn mới (văn bản + ảnh URL/tệp attachment URL)
function sendMessage(req, res) {
  const senderId = req.user.id;
  const { receiverId, text, image, attachment } = req.body || {};

  const cleanText = (text || '').trim();
  if (!receiverId || (!cleanText && !image && !attachment)) {
    return res.status(400).json({ message: 'Thiếu người nhận hoặc nội dung tin nhắn/hình ảnh/tệp đính kèm' });
  }

  const receiver = dataAccess.findById('users', receiverId);
  if (!receiver) {
    return res.status(404).json({ message: 'Người nhận không tồn tại' });
  }

  const newMessage = {
    id: uuidv4(),
    senderId,
    receiverId,
    text: cleanText,
    image: image || null,
    attachment: attachment || null,
    createdAt: new Date().toISOString(),
    read: false,
  };

  dataAccess.insert('messages', newMessage);
  return res.status(201).json(newMessage);
}

// Đánh dấu đã đọc hội thoại
function markConversationAsRead(req, res) {
  const currentUserId = req.user.id;
  const partnerId = req.params.partnerId;

  const allMessages = safeArray(dataAccess.findAll('messages'));
  allMessages.forEach((m) => {
    if (m.senderId === partnerId && m.receiverId === currentUserId && !m.read) {
      dataAccess.updateById('messages', m.id, { read: true });
    }
  });

  return res.json({ ok: true });
}

// Xóa tất cả tin nhắn giữa 2 người
function clearConversation(req, res) {
  const currentUserId = req.user.id;
  const partnerId = req.params.partnerId;

  const allMessages = safeArray(dataAccess.findAll('messages'));
  const messagesToDelete = allMessages.filter(
    (m) =>
      (m.senderId === currentUserId && m.receiverId === partnerId) ||
      (m.senderId === partnerId && m.receiverId === currentUserId)
  );

  messagesToDelete.forEach((m) => {
    dataAccess.removeById('messages', m.id);
  });

  return res.json({ ok: true, deletedCount: messagesToDelete.length });
}

module.exports = {
  upload,
  uploadFile,
  downloadFile,
  heartbeat,
  setOffline,
  getContacts,
  getConversation,
  sendMessage,
  markConversationAsRead,
  clearConversation,
};
