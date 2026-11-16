import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { renderMath } from '../utils/mathRender';
import UiIcon, { scoreLevel, formatScore, ScoreTrend } from '../components/UiIcon';
import {
  FORMULA_SIZE_PRESETS,
  valignForHeightEm,
  applyFormulaSize,
  applyFormulaSizeToAll,
  applyFormulaSizeToIndices,
  countFormulaImgs,
  extractFormulaSize,
  listFormulaImgTags,
} from '../utils/formulaResize';

function isLongOptionQuestion(options) {
  if (!options || options.length === 0) return false;
  return options.some((opt) => {
    if (!opt || !opt.text) return false;
    const raw = String(opt.text);
    const unwrapped = raw.replace(/^<p[^>]*>/i, '').replace(/<\/p>$/i, '').trim();
    if (unwrapped.includes('<br') || unwrapped.includes('<p') || unwrapped.includes('\n')) return true;
    if (unwrapped.includes(' và ') || unwrapped.includes(' hoặc ') || unwrapped.includes(' với ') || unwrapped.includes(';')) return true;
    const imgCount = (unwrapped.match(/<img/gi) || []).length;
    if (imgCount >= 2) return true;
    const plain = unwrapped.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
    if (plain.length > 25) return true;
    return false;
  });
}

export default function TeacherExamsPage() {
  const [exams, setExams] = useState([]);
  const [students, setStudents] = useState([]);
  const [groups, setGroups] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Tạo đề thi mới
  const [newExam, setNewExam] = useState({ title: '', description: '', durationMinutes: 15 });
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);
  const [wordFile, setWordFile] = useState(null);
  const [uploadingWord, setUploadingWord] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [parsedQuestions, setParsedQuestions] = useState([]);
  const [uploadError, setUploadError] = useState('');
  const [createAnswerKeyFile, setCreateAnswerKeyFile] = useState(null);
  const [answerKeyCoverage, setAnswerKeyCoverage] = useState(null);
  const [checkingCoverage, setCheckingCoverage] = useState(false);
  const [forceCreateDespiteMissing, setForceCreateDespiteMissing] = useState(false);
  const [createAssignedStudents, setCreateAssignedStudents] = useState([]);
  // Nút "Chọn theo lớp/nhóm" nào đang được coi là "đang áp dụng" (chỉ để tô
  // nổi bật đúng 1 nút vừa bấm) - KHÔNG suy ra từ việc trùng khớp học sinh
  // ngẫu nhiên giữa lớp và nhóm (VD: chọn 1 nhóm mà vô tình đủ hết học sinh
  // của 1 lớp khác cũng không được tô nổi bật nhầm nút lớp đó).
  const [activeQuickSelect, setActiveQuickSelect] = useState({ type: null, key: null });
  const [createAssignSearch, setCreateAssignSearch] = useState('');
  const [createAssignClassFilter, setCreateAssignClassFilter] = useState('all');
  const [wordDragActive, setWordDragActive] = useState(false);
  const wordInputRef = useRef(null);
  const createAnswerKeyInputRef = useRef(null);

  const distinctClasses = useMemo(() => {
    const set = new Set();
    students.forEach((s) => {
      if (s.className && s.className.trim()) {
        set.add(s.className.trim());
      }
    });
    return Array.from(set).sort();
  }, [students]);

  const filteredCreateStudents = useMemo(() => {
    return students.filter((s) => {
      const matchSearch =
        (s.name || '').toLowerCase().includes(createAssignSearch.toLowerCase()) ||
        (s.email || '').toLowerCase().includes(createAssignSearch.toLowerCase()) ||
        (s.className || '').toLowerCase().includes(createAssignSearch.toLowerCase());
      if (!matchSearch) return false;
      if (createAssignClassFilter === 'all') return true;
      if (createAssignClassFilter === 'unassigned') return !s.className || !s.className.trim();
      return (s.className || '').trim() === createAssignClassFilter;
    });
  }, [students, createAssignSearch, createAssignClassFilter]);

  const [editingExam, setEditingExam] = useState(null);
  const [editForm, setEditForm] = useState({ title: '', description: '', durationMinutes: 15, status: 'draft' });
  const [editError, setEditError] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [expandedExamIds, setExpandedExamIds] = useState(new Set());
  const [expandedAiFolderIds, setExpandedAiFolderIds] = useState(new Set());
  const [uploadingAnswerKeyExamId, setUploadingAnswerKeyExamId] = useState(null);
  const answerKeyInputRefs = useRef({});

  const navigate = useNavigate();

  // So khớp thử file đáp án chi tiết với số câu hỏi CỦA TỪNG CHỦ ĐỀ (đề
  // thường đánh số lại từ Câu 1 ở mỗi chủ đề, VD chủ đề 1 có 10 câu, chủ đề 2
  // đánh số lại 1-15) - dùng chung cho cả lúc tạo đề mới (biết trước số câu
  // mỗi chủ đề từ file Word vừa tách) lẫn lúc tải đáp án cho đề đã có sẵn.
  async function checkCoverage(file, topicCounts) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('topicCounts', JSON.stringify(topicCounts));
    const { data } = await api.post('/exams/check-answer-key-coverage', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  }

  // Gom danh sách câu hỏi (đã có field `topic`/`tags`) thành mảng số câu của
  // từng chủ đề THEO ĐÚNG THỨ TỰ xuất hiện (không gộp 2 chủ đề trùng tên
  // nhưng xuất hiện ở 2 vị trí khác nhau thành 1, vì đề vẫn đánh số lại theo
  // từng LẦN xuất hiện của tiêu đề chủ đề, không theo tên).
  function computeTopicCounts(questions, getTopic) {
    const counts = [];
    let lastTopic;
    let hasLastTopic = false;
    questions.forEach((q) => {
      const topic = getTopic(q);
      if (!hasLastTopic || topic !== lastTopic) {
        counts.push(0);
        lastTopic = topic;
        hasLastTopic = true;
      }
      counts[counts.length - 1] += 1;
    });
    return counts;
  }

  useEffect(() => {
    if (!createAnswerKeyFile || parsedQuestions.length === 0) {
      setAnswerKeyCoverage(null);
      setForceCreateDespiteMissing(false);
      return;
    }
    let cancelled = false;
    setCheckingCoverage(true);
    const topicCounts = computeTopicCounts(parsedQuestions, (q) => q.topic);
    checkCoverage(createAnswerKeyFile, topicCounts)
      .then((data) => { if (!cancelled) setAnswerKeyCoverage(data); })
      .catch(() => { if (!cancelled) setAnswerKeyCoverage(null); })
      .finally(() => { if (!cancelled) setCheckingCoverage(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createAnswerKeyFile, parsedQuestions.length]);

  function handlePickAnswerKeyFile(examId) {
    const input = answerKeyInputRefs.current[examId];
    if (input) input.click();
  }

  async function handleAnswerKeyFileSelected(examId, file) {
    if (!file) return;
    setUploadingAnswerKeyExamId(examId);
    try {
      try {
        const { data: examDetail } = await api.get(`/exams/${examId}`);
        const questions = examDetail.questions || [];
        if (questions.length > 0) {
          const topicCounts = computeTopicCounts(questions, (q) => (q.tags && q.tags[0]) || 'Kiến thức chung');
          const coverage = await checkCoverage(file, topicCounts);
          if (coverage.supported && !coverage.isComplete) {
            const proceed = window.confirm(
              `⚠️ File đáp án chi tiết này có vẻ THIẾU lời giải cho ${coverage.missingNumbers.length} số câu ` +
              `(thiếu Câu: ${coverage.missingNumbers.join(', ')} - tính theo từng chủ đề).\n\nVẫn tiếp tục tải lên?`
            );
            if (!proceed) {
              setUploadingAnswerKeyExamId(null);
              return;
            }
          }
        }
      } catch (err) {
        console.error('Lỗi khi so khớp đáp án chi tiết:', err);
        // Không chặn upload nếu bước so khớp bị lỗi (VD: mạng chậm) - chỉ là cảnh báo hỗ trợ.
      }

      const formData = new FormData();
      formData.append('file', file);
      await api.post(`/exams/${examId}/answer-key`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      // Không await: file đã tải lên thành công rồi, làm mới danh sách chỉ để
      // cập nhật UI - không được để bước này treo nút bấm nếu nó chậm/lỗi.
      loadData().catch((err) => console.error('Lỗi làm mới danh sách:', err));
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Lỗi khi tải lên file đáp án chi tiết');
    } finally {
      setUploadingAnswerKeyExamId(null);
    }
  }

  async function handleRemoveAnswerKey(examId) {
    if (!window.confirm('Gỡ file đáp án chi tiết khỏi đề thi này?')) return;
    setUploadingAnswerKeyExamId(examId);
    try {
      await api.delete(`/exams/${examId}/answer-key`);
      loadData().catch((err) => console.error('Lỗi làm mới danh sách:', err));
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Lỗi khi gỡ file đáp án chi tiết');
    } finally {
      setUploadingAnswerKeyExamId(null);
    }
  }

  function toggleExpandExam(examId) {
    setExpandedExamIds((prev) => {
      const next = new Set(prev);
      if (next.has(examId)) {
        next.delete(examId);
      } else {
        next.add(examId);
      }
      return next;
    });
  }

  function toggleAiFolder(examId) {
    setExpandedAiFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(examId)) {
        next.delete(examId);
      } else {
        next.add(examId);
      }
      return next;
    });
  }

  async function loadData() {
    setLoading(true);
    try {
      const [examsRes, studentsRes, subsRes, groupsRes] = await Promise.all([
        api.get('/exams'),
        api.get('/teacher/students'),
        api.get('/teacher/submissions').catch(() => ({ data: [] })),
        api.get('/teacher/groups').catch(() => ({ data: [] })),
      ]);
      setExams(examsRes.data);
      setStudents(studentsRes.data);
      setSubmissions(subsRes.data || []);
      setGroups(groupsRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function toggleStudentInCreate(id) {
    // Bấm tay từng học sinh -> không còn coi là "đang chọn theo đúng 1 lớp/nhóm
    // nào" nữa, tắt trạng thái nổi bật của nút lớp/nhóm (nếu có) để tránh nổi
    // bật nhầm do trùng học sinh ngẫu nhiên giữa lớp và nhóm.
    setActiveQuickSelect({ type: null, key: null });
    if (createAssignedStudents.includes(id)) {
      setCreateAssignedStudents(createAssignedStudents.filter((s) => s !== id));
    } else {
      setCreateAssignedStudents([...createAssignedStudents, id]);
    }
  }

  function toggleClassInCreate(cls) {
    const classStudentIds = students.filter((s) => s.className === cls).map((s) => s.id);
    const allInClassSelected = classStudentIds.every((id) => createAssignedStudents.includes(id));
    if (allInClassSelected) {
      setCreateAssignedStudents(createAssignedStudents.filter((id) => !classStudentIds.includes(id)));
      setActiveQuickSelect({ type: null, key: null });
    } else {
      const merged = Array.from(new Set([...createAssignedStudents, ...classStudentIds]));
      setCreateAssignedStudents(merged);
      setActiveQuickSelect({ type: 'class', key: cls });
    }
  }

  function toggleGroupInCreate(group) {
    const groupStudentIds = group.studentIds;
    const allInGroupSelected = groupStudentIds.every((id) => createAssignedStudents.includes(id));
    if (allInGroupSelected) {
      setCreateAssignedStudents(createAssignedStudents.filter((id) => !groupStudentIds.includes(id)));
      setActiveQuickSelect({ type: null, key: null });
    } else {
      const merged = Array.from(new Set([...createAssignedStudents, ...groupStudentIds]));
      setCreateAssignedStudents(merged);
      setActiveQuickSelect({ type: 'group', key: group.id });
    }
  }

  function toggleAllInCreate() {
    setActiveQuickSelect({ type: null, key: null });
    if (createAssignedStudents.length === students.length) {
      setCreateAssignedStudents([]);
    } else {
      setCreateAssignedStudents(students.map((s) => s.id));
    }
  }

  async function handleWordFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;

    setWordFile(file);
    setUploadError('');
    setUploadingWord(true);
    setUploadProgress(0);

    // Tự động gợi ý tên đề thi từ tên file nếu chưa nhập tên đề
    if (!newExam.title || newExam.title.trim() === '') {
      const cleanName = file.name
        .replace(/\.(docx|doc|txt)$/i, '')
        .replace(/[-_]+/g, ' ')
        .trim();
      if (cleanName) {
        setNewExam((prev) => ({ ...prev, title: cleanName }));
      }
    }

    const formData = new FormData();
    formData.append('file', file);

    // Server xử lý đồng bộ (bóc tách câu hỏi + chuyển đổi từng ảnh công
    // thức qua LibreOffice) nên không có % thật để hỏi giữa chừng. Ghép 2
    // giai đoạn: (1) % thật lúc tải file lên (thường rất nhanh), (2) mô
    // phỏng tăng dần trong lúc chờ server xử lý - chạy chậm lại khi gần
    // tới cuối để không "nói dối" là sắp xong, dừng hẳn khi có phản hồi.
    let simulateInterval = null;
    function startSimulatedProgress() {
      simulateInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 92) return prev;
          const step = prev < 60 ? 4 : prev < 80 ? 2 : 0.5;
          return Math.min(92, prev + step);
        });
      }, 350);
    }

    try {
      const res = await api.post('/exams/import-preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        // Tách công thức ảnh (LibreOffice, độ phân giải cao) có thể mất vài
        // phút với file nhiều công thức - dài hơn hẳn giới hạn 90s mặc định
        // dùng cho các request thông thường khác, nên đặt riêng ở đây.
        timeout: 300000,
        onUploadProgress: (evt) => {
          if (!evt.total) return;
          const uploadPercent = Math.round((evt.loaded / evt.total) * 30); // tải file chiếm ~30% thanh tiến trình
          setUploadProgress((prev) => Math.max(prev, uploadPercent));
          if (evt.loaded >= evt.total && !simulateInterval) {
            startSimulatedProgress();
          }
        },
      });

      const rawQuestions = Array.isArray(res.data) ? res.data : (res.data.questions || []);

      const list = rawQuestions.map((q, idx) => ({
        tempId: q.tempId || `q-${idx}`,
        content: q.contentHtml,
        topic: q.topic || q.tag || 'Kiến thức chung',
        qNum: q.qNum || (idx + 1),
        options: (q.options || []).map((opt) => ({
          key: opt.key,
          text: opt.html || '',
        })),
        correctAnswer: q.suggestedAnswer || 'A',
        tags: q.tag ? [q.tag] : (q.topic ? [q.topic] : ['Kiến thức chung']),
        difficulty: 'medium',
        warnings: q.warnings || [],
      }));

      setParsedQuestions(list);
      setUploadProgress(100);
    } catch (err) {
      console.error(err);
      setUploadError(err.response?.data?.message || err.message || 'Không thể đọc và bóc tách file Word này.');
    } finally {
      if (simulateInterval) clearInterval(simulateInterval);
      setUploadingWord(false);
      setTimeout(() => setUploadProgress(0), 600);
    }
  }

  function updateParsedQuestionTag(idx, newTag) {
    setParsedQuestions((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], tags: [newTag] };
      return updated;
    });
  }

  function updateParsedQuestionAnswer(idx, newAns) {
    setParsedQuestions((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], correctAnswer: newAns };
      return updated;
    });
  }

  // Chỉnh tay cỡ ảnh công thức (hỗ trợ chọn 1 hoặc NHIỀU công thức cùng lúc)
  const [resizeTarget, setResizeTarget] = useState(null); // { previewIdx, field, optionKey, imgIndex }
  const [customEmValue, setCustomEmValue] = useState('');
  const [resizeScope, setResizeScope] = useState('target'); // 'target' | 'question' | 'all'
  const [selectedFormulaKeys, setSelectedFormulaKeys] = useState([]); // 'preview_${idx}_${field}_${optKey || 'none'}_${imgIndex}'
  const [batchCustomEmValue, setBatchCustomEmValue] = useState('');

  // Đếm tổng số công thức có trong toàn bộ đề
  const totalFormulaCount = useMemo(() => {
    let count = 0;
    parsedQuestions.forEach((q) => {
      count += countFormulaImgs(q.content);
      (q.options || []).forEach((opt) => {
        count += countFormulaImgs(opt.text);
      });
    });
    return count;
  }, [parsedQuestions]);

  // Tính danh sách các mức cỡ hiện tại của các công thức đang được chọn
  const selectedFormulaSizes = useMemo(() => {
    if (selectedFormulaKeys.length === 0) return [];
    const sizes = new Set();
    selectedFormulaKeys.forEach((key) => {
      const parts = key.split('_');
      const pIdx = parseInt(parts[1], 10);
      const field = parts[2];
      const optKey = parts[3];
      const imgIdx = parseInt(parts[4], 10);

      const q = parsedQuestions[pIdx];
      if (!q) return;
      const html = field === 'content' ? q.content : q.options?.find((o) => o.key === optKey)?.text;
      const imgs = listFormulaImgTags(html);
      if (imgs[imgIdx]) {
        const size = extractFormulaSize(imgs[imgIdx].tag);
        sizes.add(size);
      }
    });
    return Array.from(sizes);
  }, [selectedFormulaKeys, parsedQuestions]);

  // Đồng bộ hiệu ứng viền sáng (.formula-selected) và tooltip kích thước cho các công thức
  useEffect(() => {
    const containers = document.querySelectorAll('[data-formula-container]');
    containers.forEach((container) => {
      const previewIdx = container.getAttribute('data-preview-idx');
      const field = container.getAttribute('data-field');
      const optionKey = container.getAttribute('data-option-key') || 'none';
      const imgs = container.querySelectorAll('img.formula-img');
      imgs.forEach((img, imgIndex) => {
        const key = `preview_${previewIdx}_${field}_${optionKey}_${imgIndex}`;
        const currentSize = img.style.height || '1.55em';
        img.setAttribute('title', `📐 Cỡ hiện tại: ${currentSize} (Bấm để chọn/bỏ chọn)`);
        if (selectedFormulaKeys.includes(key)) {
          img.classList.add('formula-selected');
        } else {
          img.classList.remove('formula-selected');
        }
      });
    });
  }, [selectedFormulaKeys, parsedQuestions]);

  // Chọn toàn bộ công thức trong toàn bộ đề
  function selectAllFormulasInExam() {
    const keys = [];
    parsedQuestions.forEach((q, idx) => {
      const contentCount = countFormulaImgs(q.content);
      for (let i = 0; i < contentCount; i++) {
        keys.push(`preview_${idx}_content_none_${i}`);
      }
      (q.options || []).forEach((opt) => {
        const optCount = countFormulaImgs(opt.text);
        for (let i = 0; i < optCount; i++) {
          keys.push(`preview_${idx}_option_${opt.key}_${i}`);
        }
      });
    });
    setSelectedFormulaKeys(keys);
    setIsMultiFormulaSelect(true);
  }

  // Chọn toàn bộ công thức trong 1 câu cụ thể

  // Chọn tất cả công thức thuộc 1 chủ đề
  function selectAllFormulasInTopic(topicName) {
    const keys = [];
    parsedQuestions.forEach((q, idx) => {
      const qTopic = q.tags?.[0] || q.topic || 'Kiến thức chung';
      if (qTopic === topicName) {
        const contentCount = countFormulaImgs(q.content);
        for (let i = 0; i < contentCount; i++) {
          keys.push(`preview_${idx}_content_none_${i}`);
        }
        (q.options || []).forEach((opt) => {
          const optCount = countFormulaImgs(opt.text);
          for (let i = 0; i < optCount; i++) {
            keys.push(`preview_${idx}_option_${opt.key}_${i}`);
          }
        });
      }
    });
    setSelectedFormulaKeys((prev) => Array.from(new Set([...prev, ...keys])));
  }

  function selectAllFormulasInQuestion(targetIdx) {
    const q = parsedQuestions[targetIdx];
    if (!q) return;
    const keys = [];
    const contentCount = countFormulaImgs(q.content);
    for (let i = 0; i < contentCount; i++) {
      keys.push(`preview_${targetIdx}_content_none_${i}`);
    }
    (q.options || []).forEach((opt) => {
      const optCount = countFormulaImgs(opt.text);
      for (let i = 0; i < optCount; i++) {
        keys.push(`preview_${targetIdx}_option_${opt.key}_${i}`);
      }
    });
    setSelectedFormulaKeys((prev) => Array.from(new Set([...prev, ...keys])));
    setIsMultiFormulaSelect(true);
  }

  function clearFormulaSelection() {
    setSelectedFormulaKeys([]);
  }

  // Áp dụng đổi cỡ hàng loạt cho các công thức đã chọn
  function handleApplyBatchFormulaSize(heightEm, vAlignEm) {
    if (selectedFormulaKeys.length === 0) return;

    // Phân loại các key theo từng câu hỏi và trường nội dung
    // Key format: preview_${previewIdx}_${field}_${optionKey}_${imgIndex}
    const keyMap = {}; // { [previewIdx]: { content: Set(imgIndices), options: { [optKey]: Set(imgIndices) } } }
    selectedFormulaKeys.forEach((key) => {
      const parts = key.split('_');
      if (parts[0] !== 'preview') return;
      const pIdx = parseInt(parts[1], 10);
      const field = parts[2];
      const optKey = parts[3];
      const imgIdx = parseInt(parts[4], 10);

      if (!keyMap[pIdx]) keyMap[pIdx] = { content: new Set(), options: {} };
      if (field === 'content') {
        keyMap[pIdx].content.add(imgIdx);
      } else {
        if (!keyMap[pIdx].options[optKey]) keyMap[pIdx].options[optKey] = new Set();
        keyMap[pIdx].options[optKey].add(imgIdx);
      }
    });

    setParsedQuestions((prev) =>
      prev.map((q, idx) => {
        const item = keyMap[idx];
        if (!item) return q;

        let newContent = q.content;
        if (item.content.size > 0) {
          newContent = applyFormulaSizeToIndices(q.content, item.content, heightEm, vAlignEm);
        }

        const newOptions = (q.options || []).map((opt) => {
          const optIndices = item.options[opt.key];
          if (optIndices && optIndices.size > 0) {
            return { ...opt, text: applyFormulaSizeToIndices(opt.text, optIndices, heightEm, vAlignEm) };
          }
          return opt;
        });

        return { ...q, content: newContent, options: newOptions };
      })
    );

    setSelectedFormulaKeys([]);
    setBatchCustomEmValue('');
  }

  function handleResizeFormula(target, heightEm, vAlignEm, scope = resizeScope) {
    if (scope === 'all') {
      // Đổi toàn bộ công thức trong toàn bài
      setParsedQuestions((prev) =>
        prev.map((q) => ({
          ...q,
          content: applyFormulaSizeToAll(q.content, heightEm, vAlignEm),
          options: (q.options || []).map((o) => ({ ...o, text: applyFormulaSizeToAll(o.text, heightEm, vAlignEm) })),
        }))
      );
    } else if (scope === 'question') {
      // Đổi toàn bộ công thức trong câu hỏi này
      setParsedQuestions((prev) => {
        const updated = [...prev];
        const q = updated[target.previewIdx];
        if (!q) return prev;
        updated[target.previewIdx] = {
          ...q,
          content: applyFormulaSizeToAll(q.content, heightEm, vAlignEm),
          options: (q.options || []).map((o) => ({ ...o, text: applyFormulaSizeToAll(o.text, heightEm, vAlignEm) })),
        };
        return updated;
      });
    } else {
      // Chỉ đổi 1 công thức cụ thể
      setParsedQuestions((prev) => {
        const updated = [...prev];
        const q = updated[target.previewIdx];
        if (!q) return prev;
        if (target.field === 'content') {
          updated[target.previewIdx] = { ...q, content: applyFormulaSize(q.content, target.imgIndex, heightEm, vAlignEm) };
        } else {
          updated[target.previewIdx] = {
            ...q,
            options: q.options.map((o) =>
              o.key === target.optionKey ? { ...o, text: applyFormulaSize(o.text, target.imgIndex, heightEm, vAlignEm) } : o
            ),
          };
        }
        return updated;
      });
    }

    setResizeTarget(null);
    setCustomEmValue('');
    setResizeScope('target');
  }

  // Bắt sự kiện click trên ảnh công thức: mặc định bấm vào công thức nào là chọn/bỏ chọn ngay
  function handlePreviewContentClick(e, previewIdx, field, optionKey) {
    const img = e.target.closest('img.formula-img');
    if (!img) return;
    const allFormulaImgs = Array.from(e.currentTarget.querySelectorAll('img.formula-img'));
    const imgIndex = allFormulaImgs.indexOf(img);
    if (imgIndex === -1) return;

    const key = `preview_${previewIdx}_${field}_${optionKey || 'none'}_${imgIndex}`;
    setSelectedFormulaKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  async function handleCreateExam(e) {
    e.preventDefault();
    setCreateError('');
    setSuccessMessage('');

    if (parsedQuestions.length === 0) {
      setCreateError('Vui lòng tải lên file Word đề thi và đợi tách câu hỏi thành công trước khi tạo đề - không tạo đề rỗng (chưa có câu hỏi).');
      return;
    }

    if (
      createAnswerKeyFile &&
      answerKeyCoverage?.supported &&
      !answerKeyCoverage.isComplete &&
      !forceCreateDespiteMissing
    ) {
      setCreateError('Đáp án chi tiết đang thiếu lời giải cho một số câu - vui lòng bổ sung hoặc tick xác nhận "Vẫn tạo đề" ở trên trước khi tạo đề.');
      return;
    }

    if (createAssignedStudents.length === 0) {
      setCreateError('Vui lòng chọn ít nhất một học sinh để giao đề thi!');
      return;
    }

    setCreating(true);
    try {
      // 1. Tạo đề thi mới (luôn giao cho học sinh)
      const assignedCount = createAssignedStudents.length;
      const { data: createdExam } = await api.post('/exams', {
        ...newExam,
        assignedTo: createAssignedStudents,
        status: 'assigned',
      });

      // 2. Nếu có file Word đã bóc tách câu hỏi, nạp ngay vào đề thi
      const importedCount = parsedQuestions.length;
      if (importedCount > 0) {
        const payload = parsedQuestions.map((q) => ({
          content: q.content,
          options: q.options,
          correctAnswer: q.correctAnswer || 'A',
          tags: q.tags && q.tags.length > 0 ? q.tags : ['Kiến thức chung'],
          difficulty: q.difficulty || 'medium',
        }));

        await api.post(`/exams/${createdExam.id}/questions/bulk`, { questions: payload });
      }

      // 3. Nếu giáo viên đã chọn sẵn file đáp án chi tiết, tải lên luôn
      let answerKeyUploaded = false;
      if (createAnswerKeyFile) {
        try {
          const formData = new FormData();
          formData.append('file', createAnswerKeyFile);
          await api.post(`/exams/${createdExam.id}/answer-key`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          answerKeyUploaded = true;
        } catch (err) {
          console.error('Lỗi tải file đáp án chi tiết:', err);
        }
      }

      setNewExam({ title: '', description: '', durationMinutes: 15 });
      setWordFile(null);
      setParsedQuestions([]);
      setCreateAssignedStudents([]);
      setCreateAnswerKeyFile(null);
      setAnswerKeyCoverage(null);
      setForceCreateDespiteMissing(false);
      setShowCreateForm(false);
      window.dispatchEvent(new Event('app:refresh-notifications'));
      setSuccessMessage(
        `🎉 Tạo đề thi "${createdExam.title}" thành công! 🚀 Đã giao ngay cho ${assignedCount} học sinh.${importedCount > 0 ? ` (Đã nạp ${importedCount} câu hỏi)` : ''}${answerKeyUploaded ? ' (Đã đính kèm đáp án chi tiết)' : ''}`
      );
      // KHÔNG await ở đây: việc tạo/giao đề đã XONG và THÀNH CÔNG ở trên rồi -
      // làm mới danh sách chỉ là cập nhật UI, lỡ bị treo/chậm (mất mạng, backend
      // đang bận xử lý file khác) không được phép giữ nút bấm ở trạng thái
      // "Đang tạo..." vĩnh viễn dù việc tạo đề thật đã xong từ trước đó.
      loadData().catch((err) => console.error('Lỗi làm mới danh sách sau khi tạo đề:', err));
    } catch (err) {
      setCreateError(err.response?.data?.message || 'Tạo đề thi thất bại');
    } finally {
      setCreating(false);
    }
  }

  function startEditExam(exam) {
    setEditingExam(exam);
    setEditForm({
      title: exam.title,
      description: exam.description || '',
      durationMinutes: exam.durationMinutes,
      status: exam.status || 'draft',
    });
    setEditError('');
  }

  async function handleSaveEditExam(e) {
    e.preventDefault();
    if (!editingExam) return;
    setEditError('');
    setSavingEdit(true);
    try {
      await api.put(`/exams/${editingExam.id}`, editForm);
      setEditingExam(null);
      loadData();
    } catch (err) {
      setEditError(err.response?.data?.message || 'Cập nhật đề thi thất bại');
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDeleteExam(exam) {
    if (!window.confirm(`Xoá đề thi "${exam.title}"?`)) return;
    try {
      await api.delete(`/exams/${exam.id}`);
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Xoá đề thi thất bại');
    }
  }

  // Nhóm các đề do AI tự sinh thêm (sourceExamId) vào đúng "thư mục" của đề
  // gốc, thay vì hiện tách rời như 1 đề độc lập trong danh sách chính.
  const examIds = new Set(exams.map((e) => e.id));
  const aiChildrenByParent = {};
  exams.forEach((exam) => {
    if (exam.sourceExamId && examIds.has(exam.sourceExamId)) {
      if (!aiChildrenByParent[exam.sourceExamId]) aiChildrenByParent[exam.sourceExamId] = [];
      aiChildrenByParent[exam.sourceExamId].push(exam);
    }
  });
  // Đề gốc thật (không phải AI sinh) HOẶC đề AI sinh nhưng đề gốc của nó
  // không còn tồn tại nữa (đã bị xoá) - vẫn hiện ở danh sách chính để không mất dữ liệu.
  const topLevelExams = exams.filter((exam) => !exam.sourceExamId || !examIds.has(exam.sourceExamId));

  const filteredExams = topLevelExams.filter((exam) => {
    const matchesSearch =
      exam.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (exam.description && exam.description.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;
    if (statusFilter === 'all') return true;
    return exam.status === statusFilter;
  });

  const assignedCount = exams.filter((e) => e.status === 'assigned').length;
  const draftCount = exams.filter((e) => e.status === 'draft').length;

  return (
    <div className="container">
      {/* Tiêu đề & Nút tạo */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Quản lý bài tập</h1>
          <p className="page-subtitle">Tạo đề thi trắc nghiệm, soạn câu hỏi và phân phối cho học sinh</p>
        </div>
        {!showCreateForm && (
          <div className="header-actions">
            <button className="btn" onClick={() => setShowCreateForm(true)}>
              <UiIcon name="plus" size={17} />
              Tạo đề thi mới
            </button>
          </div>
        )}
      </div>

      {/* Thông báo thành công */}
      {successMessage && (
        <div
          style={{
            padding: '12px 18px',
            marginBottom: 20,
            borderRadius: 'var(--radius-md)',
            background: 'var(--success-bg)',
            border: '1px solid var(--success-border)',
            color: 'var(--success-text)',
            fontSize: 14,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <span>{successMessage}</span>
          <button
            type="button"
            onClick={() => setSuccessMessage('')}
            aria-label="Đóng thông báo"
            style={{
              background: 'none',
              border: 'none',
              fontSize: 18,
              cursor: 'pointer',
              color: 'var(--success-text)',
              fontWeight: 800,
              padding: '0 4px',
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Thẻ số liệu */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-info">
            <span className="metric-title">Tổng số đề thi</span>
            <span className="metric-value">{exams.length}</span>
            <span className="metric-sub">Trong kho đề của bạn</span>
          </div>
          <div className="metric-icon-box blue"><UiIcon name="book" size={20} /></div>
        </div>
        <div className="metric-card">
          <div className="metric-info">
            <span className="metric-title">Đang giao</span>
            <span className="metric-value">{assignedCount}</span>
            <span className="metric-sub">Học sinh đang làm bài</span>
          </div>
          <div className="metric-icon-box green"><UiIcon name="send" size={20} /></div>
        </div>
        <div className="metric-card">
          <div className="metric-info">
            <span className="metric-title">Lượt nộp bài</span>
            <span className="metric-value">{submissions.length}</span>
            <span className="metric-sub">Từ tất cả các đề</span>
          </div>
          <div className="metric-icon-box slate"><UiIcon name="inbox" size={20} /></div>
        </div>
      </div>

      {/* Form tạo đề thi: 4 bước theo đúng thứ tự giáo viên thao tác */}
      {showCreateForm && (() => {
        const step1Done = parsedQuestions.length > 0;
        const step2Done = Boolean(newExam.title && newExam.title.trim()) && Number(newExam.durationMinutes) > 0;
        const step4Done = createAssignedStudents.length > 0;
        const answerKeyNeedsConfirm = Boolean(
          createAnswerKeyFile && answerKeyCoverage?.supported && !answerKeyCoverage.isComplete && !forceCreateDespiteMissing
        );
        const missing = [];
        if (!step1Done) missing.push('tải file đề thi');
        if (!(newExam.title && newExam.title.trim())) missing.push('đặt tên đề');
        if (!step4Done) missing.push('chọn học sinh nhận đề');
        if (answerKeyNeedsConfirm) missing.push('xác nhận đáp án chi tiết còn thiếu lời giải');
        const canSubmit = missing.length === 0 && !creating && !uploadingWord;
        const allStudentsSelected = students.length > 0 && createAssignedStudents.length === students.length;

        function closeCreateForm() {
          setShowCreateForm(false);
          setWordFile(null);
          setParsedQuestions([]);
          setCreateAssignedStudents([]);
        }

        function pickWordFile(fileList) {
          if (!fileList || fileList.length === 0 || uploadingWord || creating) return;
          handleWordFileChange({ target: { files: fileList } });
        }

        return (
          <div className="card create-exam">
            <div className="ce-header">
              <div>
                <h2>Tạo đề thi mới</h2>
                <p>Tải file Word đề thi, kiểm tra câu hỏi rồi giao cho học sinh.</p>
              </div>
              <button type="button" className="ce-close" onClick={closeCreateForm} aria-label="Đóng form tạo đề">
                <UiIcon name="close" size={18} />
              </button>
            </div>

            <form className="form-panel" onSubmit={handleCreateExam}>
              <input
                ref={wordInputRef}
                type="file"
                accept=".docx,.txt"
                className="visually-hidden"
                tabIndex={-1}
                onChange={(e) => {
                  pickWordFile(e.target.files);
                  e.target.value = '';
                }}
              />

              {/* Bước 1: Tải đề */}
              <section className={`ce-step${step1Done ? ' is-done' : ''}`}>
                <div className="ce-step-marker" aria-hidden="true">
                  {step1Done ? <UiIcon name="check" size={15} /> : 1}
                </div>
                <div className="ce-step-body">
                  <div className="ce-step-head">
                    <h3>Tải đề thi lên</h3>
                  </div>
                  <p className="ce-step-desc">File Word (.docx) có câu hỏi trắc nghiệm, công thức Toán được giữ nguyên.</p>

                  {uploadingWord ? (
                    <div className="ce-progress" role="status" aria-live="polite">
                      <div className="ce-progress-row">
                        <span className="spinner" />
                        <span className="ce-progress-label">Đang xử lí {wordFile ? `“${wordFile.name}”` : 'file'}…</span>
                        <span className="ce-progress-pct">{Math.round(uploadProgress)}%</span>
                      </div>
                      <div className="ce-progress-track">
                        <div className="ce-progress-fill" style={{ width: `${uploadProgress}%` }} />
                      </div>
                      <p className="ce-help">Đề có nhiều công thức sẽ mất thêm thời gian để dựng ảnh công thức.</p>
                    </div>
                  ) : step1Done ? (
                    <div className="ce-file-row">
                      <span className="ce-file-icon"><UiIcon name="file" size={20} /></span>
                      <div className="ce-file-info">
                        <strong>{wordFile ? wordFile.name : 'File đề thi'}</strong>
                        <span>
                          {parsedQuestions.length} câu hỏi
                          {totalFormulaCount > 0 ? `, ${totalFormulaCount} ảnh công thức` : ''}
                        </span>
                      </div>
                      <button type="button" className="btn sm secondary" onClick={() => wordInputRef.current?.click()} disabled={creating}>
                        Đổi file
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className={`ce-dropzone${wordDragActive ? ' is-drag' : ''}`}
                      onClick={() => wordInputRef.current?.click()}
                      onDragOver={(e) => { e.preventDefault(); setWordDragActive(true); }}
                      onDragLeave={() => setWordDragActive(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setWordDragActive(false);
                        pickWordFile(e.dataTransfer.files);
                      }}
                      disabled={creating}
                    >
                      <span className="ce-dropzone-icon"><UiIcon name="upload" size={22} /></span>
                      <span className="ce-dropzone-title">Kéo thả file Word vào đây</span>
                      <span className="ce-dropzone-sub">hoặc <span className="ce-dropzone-link">chọn file từ máy</span></span>
                    </button>
                  )}

                  {uploadError && (
                    <div className="ce-alert is-danger" role="alert">
                      <UiIcon name="alert" size={17} />
                      <span>{uploadError} Kiểm tra lại file rồi tải lên lần nữa.</span>
                    </div>
                  )}

                  {step1Done && !uploadingWord && (
                    <div className="ce-review">
                      <div className="ce-review-bar">
                        <div>
                          <strong>Kiểm tra câu hỏi</strong>
                          <span>
                            {totalFormulaCount > 0
                              ? `Bấm vào công thức để chọn và chỉnh cỡ. Đã chọn ${selectedFormulaKeys.length} công thức.`
                              : 'Sửa chủ đề và đáp án đúng nếu cần.'}
                          </span>
                        </div>
                        <div className="ce-review-actions">
                          {totalFormulaCount > 0 && (
                            <button type="button" className="btn sm secondary" onClick={selectAllFormulasInExam}>
                              Chọn tất cả công thức ({totalFormulaCount})
                            </button>
                          )}
                          {selectedFormulaKeys.length > 0 && (
                            <button type="button" className="btn sm secondary" onClick={clearFormulaSelection}>
                              Bỏ chọn
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="ce-question-list">
                        {(() => {
                          let currentTopicName = null;
                          let qNumInTopic = 0;

                          return parsedQuestions.map((q, idx) => {
                            const isLong = isLongOptionQuestion(q.options);
                            const topicName = q.tags?.[0] || q.topic || 'Kiến thức chung';
                            const isNewTopic = topicName !== currentTopicName;
                            if (isNewTopic) {
                              currentTopicName = topicName;
                              qNumInTopic = 1;
                            } else {
                              qNumInTopic += 1;
                            }
                            const displayQNum = q.qNum || qNumInTopic;

                            return (
                              <React.Fragment key={q.tempId || idx}>
                                {isNewTopic && (
                                  <div className="ce-topic">
                                    <span className="ce-topic-name">{topicName}</span>
                                    {totalFormulaCount > 0 && (
                                      <button type="button" className="ce-text-btn" onClick={() => selectAllFormulasInTopic(topicName)}>
                                        Chọn công thức của chủ đề
                                      </button>
                                    )}
                                  </div>
                                )}

                                <div className="ce-question">
                                  <div className="ce-question-head">
                                    <span className="ce-qnum">Câu {displayQNum}</span>
                                    <label className="ce-inline-field">
                                      <span>Chủ đề</span>
                                      <input
                                        type="text"
                                        value={q.tags[0] || ''}
                                        onChange={(e) => updateParsedQuestionTag(idx, e.target.value)}
                                        placeholder="Nhập tên chủ đề…"
                                        spellCheck={false}
                                      />
                                    </label>
                                    {countFormulaImgs(q.content) + (q.options || []).reduce((sum, o) => sum + countFormulaImgs(o.text), 0) > 0 && (
                                      <button
                                        type="button"
                                        className="ce-text-btn"
                                        title="Chọn toàn bộ công thức trong câu này"
                                        onClick={() => selectAllFormulasInQuestion(idx)}
                                      >
                                        Chọn công thức
                                      </button>
                                    )}
                                    <label className="ce-inline-field ce-answer-field">
                                      <span>Đáp án đúng</span>
                                      <select value={q.correctAnswer || 'A'} onChange={(e) => updateParsedQuestionAnswer(idx, e.target.value)}>
                                        {['A', 'B', 'C', 'D'].map((key) => (
                                          <option key={key} value={key}>{key}</option>
                                        ))}
                                      </select>
                                    </label>
                                  </div>

                                  <div
                                    className="question-content formula-editable"
                                    data-formula-container="true"
                                    data-preview-idx={idx}
                                    data-field="content"
                                    data-option-key="none"
                                    dangerouslySetInnerHTML={{ __html: renderMath(q.content) }}
                                    onClick={(e) => handlePreviewContentClick(e, idx, 'content', null)}
                                  />

                                  <div className={`ce-options${isLong ? ' is-stacked' : ''}`}>
                                    {q.options.map((opt) => {
                                      const isCorrect = opt.key === q.correctAnswer;
                                      return (
                                        <div key={opt.key} className={`option-row ${isCorrect ? 'correct' : ''}`}>
                                          <strong className="ce-option-key">{opt.key}.</strong>
                                          <span
                                            className="formula-editable"
                                            data-formula-container="true"
                                            data-preview-idx={idx}
                                            data-field="option"
                                            data-option-key={opt.key}
                                            style={{ flex: 1 }}
                                            dangerouslySetInnerHTML={{ __html: renderMath(opt.text) }}
                                            onClick={(e) => handlePreviewContentClick(e, idx, 'option', opt.key)}
                                          />
                                          {isCorrect && (
                                            <span className="ce-correct-mark" aria-label="Đáp án đúng">
                                              <UiIcon name="check" size={15} />
                                            </span>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>

                                  {q.warnings && q.warnings.length > 0 && (
                                    <div className="ce-question-warning">{q.warnings.join(' ')}</div>
                                  )}
                                </div>
                              </React.Fragment>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* Bước 2: Thông tin đề */}
              <section className={`ce-step${step2Done ? ' is-done' : ''}`}>
                <div className="ce-step-marker" aria-hidden="true">
                  {step2Done ? <UiIcon name="check" size={15} /> : 2}
                </div>
                <div className="ce-step-body">
                  <div className="ce-step-head">
                    <h3>Thông tin đề thi</h3>
                  </div>
                  <p className="ce-step-desc">Tên đề được gợi ý từ tên file, bạn có thể sửa lại.</p>

                  <div className="form-group">
                    <label htmlFor="exam-title">Tên đề thi <span className="ce-required">*</span></label>
                    <input
                      id="exam-title"
                      type="text"
                      placeholder="VD: Đề ôn tập số 1"
                      value={newExam.title}
                      onChange={(e) => setNewExam({ ...newExam, title: e.target.value })}
                      autoComplete="off"
                      required
                    />
                  </div>

                  <div className="ce-field-row">
                    <div className="form-group">
                      <label htmlFor="exam-duration">Thời gian làm bài <span className="ce-required">*</span></label>
                      <div className="ce-input-suffix">
                        <input
                          id="exam-duration"
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={180}
                          value={newExam.durationMinutes}
                          onChange={(e) => setNewExam({ ...newExam, durationMinutes: Number(e.target.value) })}
                          required
                        />
                        <span>phút</span>
                      </div>
                    </div>
                    <div className="form-group">
                      <label htmlFor="exam-description">Mô tả ngắn</label>
                      <input
                        id="exam-description"
                        type="text"
                        placeholder="VD: Đề gồm 25 câu trắc nghiệm"
                        value={newExam.description}
                        onChange={(e) => setNewExam({ ...newExam, description: e.target.value })}
                        autoComplete="off"
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* Bước 3: Đáp án chi tiết (không bắt buộc) */}
              <section className={`ce-step${createAnswerKeyFile ? ' is-done' : ''}`}>
                <div className="ce-step-marker" aria-hidden="true">
                  {createAnswerKeyFile ? <UiIcon name="check" size={15} /> : 3}
                </div>
                <div className="ce-step-body">
                  <div className="ce-step-head">
                    <h3>Đáp án chi tiết</h3>
                    <span className="ce-optional">Không bắt buộc</span>
                  </div>
                  <p className="ce-step-desc">
                    Học sinh xem, tải hoặc quét QR file này sau khi nộp bài. Có thể thêm sau.
                  </p>

                  <input
                    ref={createAnswerKeyInputRef}
                    id="exam-answer-key"
                    type="file"
                    accept=".pdf,image/*,.doc,.docx"
                    className="visually-hidden"
                    tabIndex={-1}
                    onChange={(e) => {
                      setCreateAnswerKeyFile(e.target.files[0] || null);
                      e.target.value = '';
                    }}
                  />
                  {createAnswerKeyFile ? (
                    <div className="ce-file-row">
                      <span className="ce-file-icon"><UiIcon name="file" size={20} /></span>
                      <div className="ce-file-info">
                        <strong>{createAnswerKeyFile.name}</strong>
                        <span>{checkingCoverage ? 'Đang so khớp với đề thi…' : 'PDF, ảnh hoặc Word'}</span>
                      </div>
                      <button type="button" className="btn sm secondary" onClick={() => createAnswerKeyInputRef.current?.click()}>
                        Đổi file
                      </button>
                      <button
                        type="button"
                        className="ce-icon-btn"
                        onClick={() => setCreateAnswerKeyFile(null)}
                        aria-label="Bỏ file đáp án chi tiết"
                      >
                        <UiIcon name="close" size={16} />
                      </button>
                    </div>
                  ) : (
                    <button type="button" className="btn secondary" onClick={() => createAnswerKeyInputRef.current?.click()}>
                      <UiIcon name="upload" size={16} />
                      Chọn file đáp án
                    </button>
                  )}

                  {createAnswerKeyFile && !checkingCoverage && answerKeyCoverage && (
                    answerKeyCoverage.supported === false ? (
                      <p className="ce-help">{answerKeyCoverage.message}</p>
                    ) : answerKeyCoverage.isComplete ? (
                      <div className="ce-alert is-success">
                        <UiIcon name="check" size={17} />
                        <span>Có đủ lời giải cho toàn bộ {answerKeyCoverage.totalQuestions} câu.</span>
                      </div>
                    ) : (
                      <div className="ce-alert is-danger">
                        <UiIcon name="alert" size={17} />
                        <div>
                          <div>
                            Thiếu lời giải cho <strong>{answerKeyCoverage.missingNumbers.length}/{answerKeyCoverage.totalQuestions}</strong> câu
                            (Câu {answerKeyCoverage.missingNumbers.join(', ')}).
                          </div>
                          <label className="ce-checkbox">
                            <input
                              type="checkbox"
                              checked={forceCreateDespiteMissing}
                              onChange={(e) => setForceCreateDespiteMissing(e.target.checked)}
                            />
                            Tôi đã kiểm tra, vẫn tạo đề và giao ngay
                          </label>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </section>

              {/* Bước 4: Giao cho học sinh */}
              <section className={`ce-step${step4Done ? ' is-done' : ''}`}>
                <div className="ce-step-marker" aria-hidden="true">
                  {step4Done ? <UiIcon name="check" size={15} /> : 4}
                </div>
                <div className="ce-step-body">
                  <div className="ce-step-head">
                    <h3>Giao cho học sinh</h3>
                    <span className="ce-count">
                      Đã chọn <strong>{createAssignedStudents.length}</strong>/{students.length}
                    </span>
                  </div>
                  <p className="ce-step-desc">Đề được giao ngay cho các học sinh đã chọn sau khi bấm Tạo và giao đề.</p>

                  {students.length === 0 ? (
                    <div className="ce-empty">
                      Chưa có học sinh nào. Thêm học sinh ở mục <Link to="/teacher">Quản lý học sinh</Link> trước khi giao đề.
                    </div>
                  ) : (
                    <>
                      <div className="ce-quick">
                        <button
                          type="button"
                          className={`ce-chip${allStudentsSelected ? ' is-active' : ''}`}
                          aria-pressed={allStudentsSelected}
                          onClick={toggleAllInCreate}
                        >
                          Tất cả học sinh <span className="ce-chip-count">{students.length}</span>
                        </button>
                        {distinctClasses.map((cls) => {
                          const classCount = students.filter((st) => st.className === cls).length;
                          const isActive = activeQuickSelect.type === 'class' && activeQuickSelect.key === cls;
                          return (
                            <button
                              key={cls}
                              type="button"
                              className={`ce-chip${isActive ? ' is-active' : ''}`}
                              aria-pressed={isActive}
                              onClick={() => toggleClassInCreate(cls)}
                            >
                              Lớp {cls} <span className="ce-chip-count">{classCount}</span>
                            </button>
                          );
                        })}
                        {groups.map((g) => {
                          const isActive = activeQuickSelect.type === 'group' && activeQuickSelect.key === g.id;
                          return (
                            <button
                              key={g.id}
                              type="button"
                              className={`ce-chip is-group${isActive ? ' is-active' : ''}`}
                              aria-pressed={isActive}
                              onClick={() => toggleGroupInCreate(g)}
                            >
                              Nhóm {g.name} <span className="ce-chip-count">{g.studentIds.length}</span>
                            </button>
                          );
                        })}
                      </div>

                      <div className="ce-filter-row">
                        <input
                          type="search"
                          placeholder="Tìm theo tên hoặc email"
                          aria-label="Tìm học sinh theo tên hoặc email"
                          value={createAssignSearch}
                          onChange={(e) => setCreateAssignSearch(e.target.value)}
                          spellCheck={false}
                        />
                        <select
                          aria-label="Lọc theo lớp"
                          value={createAssignClassFilter}
                          onChange={(e) => setCreateAssignClassFilter(e.target.value)}
                        >
                          <option value="all">Tất cả lớp ({students.length})</option>
                          {distinctClasses.map((cls) => (
                            <option key={cls} value={cls}>Lớp {cls}</option>
                          ))}
                          <option value="unassigned">Chưa phân lớp</option>
                        </select>
                      </div>

                      {filteredCreateStudents.length === 0 ? (
                        <div className="ce-empty">Không có học sinh nào khớp với bộ lọc.</div>
                      ) : (
                        <div className="ce-student-grid">
                          {filteredCreateStudents.map((st) => {
                            const isChecked = createAssignedStudents.includes(st.id);
                            return (
                              <label key={st.id} className={`ce-student${isChecked ? ' is-checked' : ''}`}>
                                <input type="checkbox" checked={isChecked} onChange={() => toggleStudentInCreate(st.id)} />
                                <span className="ce-student-name">{st.name}</span>
                                <span className="ce-student-class">{st.className ? `Lớp ${st.className}` : 'Chưa phân lớp'}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </section>

              {createError && (
                <div className="ce-alert is-danger" role="alert" aria-live="polite">
                  <UiIcon name="alert" size={17} />
                  <span>{createError}</span>
                </div>
              )}

              <div className="ce-footer">
                <p className={`ce-footer-status${missing.length === 0 ? ' is-ready' : ''}`}>
                  {missing.length === 0
                    ? `Sẵn sàng giao cho ${createAssignedStudents.length} học sinh.`
                    : `Còn thiếu: ${missing.join(', ')}.`}
                </p>
                <div className="ce-footer-actions">
                  <button type="button" className="btn secondary" onClick={closeCreateForm}>
                    Huỷ
                  </button>
                  <button className="btn" type="submit" disabled={!canSubmit}>
                    {creating ? 'Đang tạo và giao đề…' : 'Tạo và giao đề'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        );
      })()}

      {/* Danh sách đề thi */}
      <div className="card">
        <div className="card-header">
          <div className="card-title-row">
            <h2>Danh sách đề thi</h2>
            <span className="count-badge">{filteredExams.length}</span>
          </div>
          <div className="toolbar">
            <div className="segmented" role="group" aria-label="Lọc theo trạng thái">
              {[
                { key: 'all', label: 'Tất cả', count: exams.length },
                { key: 'assigned', label: 'Đang giao', count: assignedCount },
                { key: 'draft', label: 'Bản nháp', count: draftCount },
              ].map((f) => (
                <button
                  key={f.key}
                  type="button"
                  className={`segmented-btn${statusFilter === f.key ? ' is-active' : ''}`}
                  aria-pressed={statusFilter === f.key}
                  onClick={() => setStatusFilter(f.key)}
                >
                  {f.label} <span className="segmented-count">{f.count}</span>
                </button>
              ))}
            </div>
            <div className="search-field">
              <UiIcon name="search" size={16} />
              <input
                type="search"
                placeholder="Tìm đề thi"
                aria-label="Tìm đề thi theo tên"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                spellCheck={false}
                style={{ width: 220 }}
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="spinner" style={{ margin: '0 auto 12px' }} />
            <div className="empty-state-title">Đang tải danh sách đề thi…</div>
          </div>
        ) : filteredExams.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon is-svg"><UiIcon name="book" size={22} /></div>
            {exams.length === 0 ? (
              <>
                <div className="empty-state-title">Chưa có đề thi nào</div>
                <p className="empty-state-desc">Tải file Word đề thi lên để tạo đề đầu tiên và giao cho học sinh.</p>
                {!showCreateForm && (
                  <button className="btn" onClick={() => setShowCreateForm(true)}>
                    <UiIcon name="plus" size={17} />
                    Tạo đề thi mới
                  </button>
                )}
              </>
            ) : (
              <>
                <div className="empty-state-title">Không có đề thi khớp bộ lọc</div>
                <p className="empty-state-desc">Thử đổi từ khoá tìm kiếm hoặc chọn trạng thái khác.</p>
              </>
            )}
          </div>
        ) : (
          <div className="table-responsive">
            <table className="exam-table">
              <thead>
                <tr>
                  <th>Đề thi</th>
                  <th>Trạng thái</th>
                  <th>Bài nộp</th>
                  <th style={{ textAlign: 'right' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredExams.map((exam) => {
                  const assignedStudentIds = exam.assignedTo || [];
                  const examSubmissions = submissions.filter((s) => s.examId === exam.id);
                  const distinctSubmittedStudentIds = new Set(examSubmissions.map((s) => s.studentId));
                  const submittedCount = distinctSubmittedStudentIds.size;
                  const isExpanded = expandedExamIds.has(exam.id);
                  const aiChildren = aiChildrenByParent[exam.id] || [];
                  const isAiFolderExpanded = expandedAiFolderIds.has(exam.id);
                  const submittedPercent = assignedStudentIds.length > 0
                    ? Math.round((submittedCount / assignedStudentIds.length) * 100)
                    : 0;

                  // Điểm trung bình của các học sinh đã nộp (lấy lần làm mới nhất)
                  let avgScore = null;
                  if (submittedCount > 0) {
                    let totalScore = 0;
                    distinctSubmittedStudentIds.forEach((stId) => {
                      const stSubs = examSubmissions.filter((s) => s.studentId === stId);
                      const latest = stSubs[stSubs.length - 1];
                      totalScore += latest?.score || 0;
                    });
                    avgScore = totalScore / submittedCount;
                  }

                  return (
                    <React.Fragment key={exam.id}>
                      <tr>
                        <td className="exam-cell">
                          <Link className="exam-title" to={`/teacher/exams/${exam.id}`}>{exam.title}</Link>
                          {exam.description && <div className="exam-desc">{exam.description}</div>}
                          <div className="meta-row" style={{ marginTop: 6 }}>
                            <span><UiIcon name="list" size={14} />{exam.questionsCount ?? (exam.questions?.length || 0)} câu hỏi</span>
                            <span><UiIcon name="clock" size={14} />{exam.durationMinutes} phút</span>
                            {exam.answerKeyFile && <span><UiIcon name="file" size={14} />Có đáp án chi tiết</span>}
                          </div>
                          {aiChildren.length > 0 && (
                            <button
                              type="button"
                              className="ai-toggle"
                              onClick={() => toggleAiFolder(exam.id)}
                              aria-expanded={isAiFolderExpanded}
                            >
                              <UiIcon name="sparkles" size={14} />
                              {aiChildren.length} bài tập AI sinh thêm
                              <UiIcon name={isAiFolderExpanded ? 'chevron-up' : 'chevron-down'} size={14} />
                            </button>
                          )}
                        </td>
                        <td className="nowrap">
                          <span className={`status-pill ${exam.status}`}>
                            <span className="status-dot" />
                            {exam.status === 'assigned' ? 'Đang giao' : 'Bản nháp'}
                          </span>
                        </td>
                        <td>
                          {assignedStudentIds.length === 0 ? (
                            <span className="text-muted-cell">Chưa giao cho học sinh</span>
                          ) : (
                            <div className="progress-cell">
                              <div className="progress-cell-top">
                                <span><b>{submittedCount}</b>/{assignedStudentIds.length} đã nộp</span>
                                {avgScore !== null && (
                                  <span className={`score-text is-${scoreLevel(avgScore)}`}>TB {avgScore.toFixed(1)}</span>
                                )}
                              </div>
                              <div className="score-bar is-thin" aria-hidden="true">
                                <span className="is-primary" style={{ width: `${submittedPercent}%` }} />
                              </div>
                              <button
                                type="button"
                                className="text-btn"
                                onClick={() => toggleExpandExam(exam.id)}
                                aria-expanded={isExpanded}
                              >
                                {isExpanded ? 'Thu gọn' : 'Xem kết quả từng học sinh'}
                                <UiIcon name={isExpanded ? 'chevron-up' : 'chevron-down'} size={14} />
                              </button>
                            </div>
                          )}
                        </td>
                        <td>
                          <div className="row-actions">
                            {exam.status === 'assigned' ? (
                              <Link to={`/teacher/exams/${exam.id}`} className="btn sm secondary">
                                <UiIcon name="eye" size={15} />
                                Xem đề
                              </Link>
                            ) : (
                              <Link to={`/teacher/exams/${exam.id}`} className="btn sm">
                                <UiIcon name="edit" size={15} />
                                Soạn câu hỏi
                              </Link>
                            )}

                            {/* Đáp án chi tiết: dùng chung cho cả đề nháp lẫn đề đã giao */}
                            <input
                              ref={(el) => { answerKeyInputRefs.current[exam.id] = el; }}
                              type="file"
                              accept=".pdf,image/*,.doc,.docx"
                              className="visually-hidden"
                              tabIndex={-1}
                              onChange={(e) => {
                                handleAnswerKeyFileSelected(exam.id, e.target.files[0]);
                                e.target.value = '';
                              }}
                            />
                            <button
                              type="button"
                              className="btn sm secondary"
                              onClick={() => handlePickAnswerKeyFile(exam.id)}
                              disabled={uploadingAnswerKeyExamId === exam.id}
                              title={exam.answerKeyFile ? 'Thay file đáp án chi tiết khác' : 'Tải lên file đáp án chi tiết cho học sinh xem sau khi nộp bài'}
                            >
                              <UiIcon name="file" size={15} />
                              {uploadingAnswerKeyExamId === exam.id
                                ? 'Đang tải…'
                                : exam.answerKeyFile ? 'Đổi đáp án' : 'Thêm đáp án'}
                            </button>
                            {exam.answerKeyFile && (
                              <button
                                type="button"
                                className="icon-btn"
                                onClick={() => handleRemoveAnswerKey(exam.id)}
                                disabled={uploadingAnswerKeyExamId === exam.id}
                                aria-label="Gỡ file đáp án chi tiết"
                                title="Gỡ file đáp án chi tiết"
                              >
                                <UiIcon name="close" size={15} />
                              </button>
                            )}
                            {exam.status !== 'assigned' && (
                              <button
                                type="button"
                                className="icon-btn"
                                onClick={() => startEditExam(exam)}
                                aria-label="Sửa thông tin đề thi"
                                title="Sửa thông tin đề thi"
                              >
                                <UiIcon name="edit" size={15} />
                              </button>
                            )}
                            <button
                              type="button"
                              className="icon-btn is-danger"
                              onClick={() => handleDeleteExam(exam)}
                              aria-label="Xoá đề thi"
                              title="Xoá đề thi"
                            >
                              <UiIcon name="trash" size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Kết quả từng học sinh */}
                      {isExpanded && assignedStudentIds.length > 0 && (
                        <tr className="exam-subrow">
                          <td colSpan={4}>
                            <div className="result-panel">
                              <div className="result-panel-head">
                                <strong>Kết quả từng học sinh</strong>
                                <span>Đã nộp {submittedCount}/{assignedStudentIds.length}</span>
                              </div>
                              <ul className="result-list">
                                {assignedStudentIds.map((stId) => {
                                  const stObj = students.find((s) => s.id === stId);
                                  const studentName = stObj ? stObj.name : stId;
                                  const className = stObj?.className ? `Lớp ${stObj.className}` : null;
                                  const initial = String(studentName).trim().charAt(0).toUpperCase();
                                  const studentSubs = (submissions || [])
                                    .filter((s) => s.examId === exam.id && s.studentId === stId)
                                    .sort((a, b) => (a.attempt || 1) - (b.attempt || 1));

                                  if (studentSubs.length === 0) {
                                    return (
                                      <li key={stId} className="result-row is-pending">
                                        <div className="result-student">
                                          <span className="avatar is-muted" aria-hidden="true">{initial}</span>
                                          <div className="result-name">
                                            {studentName}
                                            {className && <span className="class-badge">{className}</span>}
                                          </div>
                                        </div>
                                        <span className="result-pending">Chưa nộp bài</span>
                                      </li>
                                    );
                                  }

                                  const latestSub = studentSubs[studentSubs.length - 1];
                                  const firstSub = studentSubs[0];
                                  const attemptsCount = studentSubs.length;
                                  return (
                                    <li key={stId} className="result-row">
                                      <div className="result-student">
                                        <span className="avatar" aria-hidden="true">{initial}</span>
                                        <div style={{ minWidth: 0 }}>
                                          <div className="result-name">
                                            <span title={studentName}>{studentName}</span>
                                            {className && <span className="class-badge">{className}</span>}
                                          </div>
                                          <div className="result-time">
                                            Nộp lúc {latestSub.submittedAt ? new Date(latestSub.submittedAt).toLocaleString('vi-VN') : '—'}
                                          </div>
                                        </div>
                                      </div>
                                      <div className="result-score">
                                        {attemptsCount > 1 ? (
                                          <>
                                            <span>Lần 1 <b>{formatScore(firstSub.score)}</b></span>
                                            <UiIcon name="arrow-right" size={14} />
                                            <span>
                                              Lần {attemptsCount}{' '}
                                              <b className={`score-text is-${scoreLevel(latestSub.score)}`}>{formatScore(latestSub.score)}</b>
                                            </span>
                                            <ScoreTrend diff={(latestSub.score || 0) - (firstSub.score || 0)} />
                                          </>
                                        ) : (
                                          <>
                                            <span className={`score-pill is-${scoreLevel(latestSub.score)}`}>
                                              {formatScore(latestSub.score)}<small>/10</small>
                                            </span>
                                            <span className="result-attempts">1 lần làm</span>
                                          </>
                                        )}
                                      </div>
                                      <Link
                                        to={`/teacher/exams/${exam.id}/submissions/${latestSub.id || latestSub.submissionId}`}
                                        className="btn sm"
                                      >
                                        <UiIcon name="sparkles" size={15} />
                                        Xem bài và AI
                                      </Link>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          </td>
                        </tr>
                      )}

                      {/* Thư mục con: các đề AI tự sinh thêm dựa trên đề này */}
                      {isAiFolderExpanded && aiChildren.length > 0 && (
                        <tr className="exam-subrow">
                          <td colSpan={4}>
                            <div className="result-panel is-ai">
                              <div className="result-panel-head">
                                <strong><UiIcon name="sparkles" size={15} />Bài tập AI sinh thêm từ đề này</strong>
                                <span>{aiChildren.length} đề</span>
                              </div>
                              <ul className="result-list">
                                {aiChildren.map((child) => {
                                  const childAssigned = child.assignedTo || [];
                                  const childStudent = students.find((s) => childAssigned.includes(s.id));
                                  return (
                                    <li key={child.id} className="result-row">
                                      <div style={{ minWidth: 0, flex: 1 }}>
                                        <Link className="exam-title is-sm" to={`/teacher/exams/${child.id}`}>{child.title}</Link>
                                        <div className="meta-row" style={{ marginTop: 4 }}>
                                          <span><UiIcon name="user" size={14} />{childStudent ? childStudent.name : 'Học sinh'}</span>
                                          <span><UiIcon name="list" size={14} />{child.questionsCount ?? 0} câu</span>
                                        </div>
                                      </div>
                                      <span className={`status-pill ${child.status}`}>
                                        <span className="status-dot" />
                                        {child.status === 'assigned' ? 'Đang giao' : 'Bản nháp'}
                                      </span>
                                      <div className="row-actions">
                                        <Link to={`/teacher/exams/${child.id}`} className="btn sm secondary">
                                          <UiIcon name="eye" size={15} />
                                          Xem đề
                                        </Link>
                                        <button
                                          type="button"
                                          className="icon-btn is-danger"
                                          onClick={() => handleDeleteExam(child)}
                                          aria-label="Xoá đề này"
                                          title="Xoá đề này"
                                        >
                                          <UiIcon name="trash" size={15} />
                                        </button>
                                      </div>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Sửa Đề Thi */}
      {editingExam && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.4)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 20,
          }}
          onClick={() => setEditingExam(null)}
        >
          <div
            className="card"
            style={{ width: '100%', maxWidth: 500, margin: 0, boxShadow: 'var(--shadow-lg)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-header">
              <h2>Sửa thông tin đề thi</h2>
              <button type="button" className="ce-close" aria-label="Đóng" onClick={() => setEditingExam(null)}>
                <UiIcon name="close" size={18} />
              </button>
            </div>

            <form className="form-panel" onSubmit={handleSaveEditExam}>
              <div className="form-group">
                <label htmlFor="edit-exam-title">Tên đề thi <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input
                  id="edit-exam-title"
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  autoComplete="off"
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="edit-exam-duration">Thời gian (phút) <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input
                    id="edit-exam-duration"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={180}
                    value={editForm.durationMinutes}
                    onChange={(e) => setEditForm({ ...editForm, durationMinutes: Number(e.target.value) })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="edit-exam-status">Trạng thái</label>
                  <select
                    id="edit-exam-status"
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  >
                    <option value="draft">Bản nháp</option>
                    <option value="assigned">Đang giao</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="edit-exam-description">Mô tả ngắn</label>
                <input
                  id="edit-exam-description"
                  type="text"
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  autoComplete="off"
                />
              </div>

              {editError && (
                <p className="error-text" role="alert" aria-live="polite">
                  {editError}
                </p>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
                <button type="button" className="btn secondary" onClick={() => setEditingExam(null)}>
                  Huỷ
                </button>
                <button className="btn" type="submit" disabled={savingEdit}>
                  {savingEdit ? 'Đang lưu…' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Thanh công cụ nổi khi chọn công thức (Batch Formula Sizing Toolbar - Light Theme) */}
      {selectedFormulaKeys.length > 0 && (
        <div className="formula-batch-toolbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <span style={{ fontSize: 15 }}>📐</span>
            <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink)' }}>
              Đã chọn <strong style={{ color: 'var(--primary)' }}>{selectedFormulaKeys.length}</strong> CT
            </span>
            {selectedFormulaSizes.length > 0 && (
              <span
                style={{
                  background: 'var(--gold-soft)',
                  color: 'var(--primary)',
                  border: '1px solid var(--primary-border)',
                  padding: '2px 8px',
                  borderRadius: 12,
                  fontSize: 11.5,
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <span>📏 Hiện:</span>
                <strong>{selectedFormulaSizes.map((s) => `${s}em`).join(', ')}</strong>
              </span>
            )}
          </div>

          <div style={{ height: 18, width: 1, background: 'var(--line)', flexShrink: 0 }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {FORMULA_SIZE_PRESETS.map((preset) => {
              const isMatch = selectedFormulaSizes.length === 1 && selectedFormulaSizes[0] === preset.heightEm;
              return (
                <button
                  key={preset.label}
                  type="button"
                  className={`btn-preset ${isMatch ? 'active' : ''}`}
                  onClick={() => handleApplyBatchFormulaSize(preset.heightEm, valignForHeightEm(preset.heightEm))}
                >
                  <span>{preset.label}</span>
                  <span style={{ fontSize: 11, opacity: isMatch ? 0.95 : 0.7 }}>({preset.heightEm}em)</span>
                  {isMatch && <span style={{ fontSize: 11 }}>✓</span>}
                </button>
              );
            })}
          </div>

          <div style={{ height: 18, width: 1, background: 'var(--line-strong)', flexShrink: 0 }} />

          <form
            style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
            onSubmit={(e) => {
              e.preventDefault();
              const val = parseFloat(batchCustomEmValue);
              if (!val || val <= 0) return;
              handleApplyBatchFormulaSize(val, valignForHeightEm(val));
            }}
          >
            <input
              type="number"
              step="0.1"
              min="0.5"
              max="10"
              placeholder={selectedFormulaSizes.length === 1 ? `Cỡ (hiện ${selectedFormulaSizes[0]})` : 'Nhập cỡ em'}
              value={batchCustomEmValue}
              onChange={(e) => setBatchCustomEmValue(e.target.value)}
              style={{
                width: 105,
                padding: '5px 10px',
                fontSize: 12.5,
                fontWeight: 600,
                borderRadius: 20,
                background: 'var(--surface-2)',
                color: 'var(--ink)',
                border: '1.5px solid var(--line-strong)',
              }}
            />
            <button
              type="submit"
              className="btn sm"
              style={{
                background: 'var(--primary)',
                color: '#ffffff',
                border: 'none',
                borderRadius: 20,
                padding: '5px 12px',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(138, 97, 31, 0.3)',
              }}
              disabled={!batchCustomEmValue}
            >
              Áp dụng
            </button>
          </form>

          <div style={{ height: 18, width: 1, background: 'var(--line-strong)', flexShrink: 0 }} />

          <button
            type="button"
            style={{
              background: 'var(--danger-bg)',
              color: '#dc2626',
              border: '1.5px solid var(--danger-border)',
              borderRadius: 20,
              fontSize: 12,
              padding: '4px 10px',
              cursor: 'pointer',
              fontWeight: 700,
              flexShrink: 0,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
            onClick={clearFormulaSelection}
          >
            ✕ Bỏ chọn
          </button>
        </div>
      )}
    </div>
  );
}