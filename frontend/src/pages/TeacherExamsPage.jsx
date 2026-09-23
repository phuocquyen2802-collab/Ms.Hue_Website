import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { renderMath } from '../utils/mathRender';
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
  const [createAssignedStudents, setCreateAssignedStudents] = useState([]);
  const [createAssignSearch, setCreateAssignSearch] = useState('');
  const [createAssignClassFilter, setCreateAssignClassFilter] = useState('all');

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

  function handlePickAnswerKeyFile(examId) {
    const input = answerKeyInputRefs.current[examId];
    if (input) input.click();
  }

  async function handleAnswerKeyFileSelected(examId, file) {
    if (!file) return;
    setUploadingAnswerKeyExamId(examId);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await api.post(`/exams/${examId}/answer-key`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await loadData();
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
      await loadData();
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
      const [examsRes, studentsRes, subsRes] = await Promise.all([
        api.get('/exams'),
        api.get('/teacher/students'),
        api.get('/teacher/submissions').catch(() => ({ data: [] })),
      ]);
      setExams(examsRes.data);
      setStudents(studentsRes.data);
      setSubmissions(subsRes.data || []);
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
    } else {
      const merged = Array.from(new Set([...createAssignedStudents, ...classStudentIds]));
      setCreateAssignedStudents(merged);
    }
  }

  function toggleAllInCreate() {
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
      setShowCreateForm(false);
      window.dispatchEvent(new Event('app:refresh-notifications'));
      setSuccessMessage(
        `🎉 Tạo đề thi "${createdExam.title}" thành công! 🚀 Đã giao ngay cho ${assignedCount} học sinh.${importedCount > 0 ? ` (Đã nạp ${importedCount} câu hỏi)` : ''}${answerKeyUploaded ? ' (Đã đính kèm đáp án chi tiết)' : ''}`
      );
      await loadData();
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
        <div className="header-actions">
          <button
            className={`btn ${showCreateForm ? 'secondary' : ''}`}
            onClick={() => setShowCreateForm(!showCreateForm)}
          >
            {showCreateForm ? '✕ Đóng form' : '+ Tạo đề thi mới'}
          </button>
        </div>
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

      {/* Thẻ thống kê */}
      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        <div className="metric-card">
          <div className="metric-info">
            <span className="metric-title">Tổng số đề thi</span>
            <span className="metric-value">{exams.length}</span>
            <span className="metric-sub">Kho đề đã tạo</span>
          </div>
          <div className="metric-icon-box blue">📚</div>
        </div>

        <div className="metric-card">
          <div className="metric-info">
            <span className="metric-title">Đang phát hành</span>
            <span className="metric-value" style={{ color: 'var(--success)' }}>
              {assignedCount}
            </span>
            <span className="metric-sub">Đã giao cho học sinh</span>
          </div>
          <div className="metric-icon-box green">🚀</div>
        </div>
      </div>

      {/* Form tạo đề thi */}
      {showCreateForm && (
        <div className="card" style={{ border: '2px solid var(--primary-border)', boxShadow: 'var(--shadow-md)' }}>
          <div className="card-header">
            <h2>Tạo đề thi mới</h2>
          </div>
          <form className="form-panel" onSubmit={handleCreateExam}>
            {/* Tải lên File Word */}
            <div
              style={{
                background: 'var(--bg-subtle)',
                padding: '16px 18px',
                borderRadius: 'var(--radius-md)',
                border: '1.5px dashed var(--primary-border)',
                marginBottom: 16,
              }}
            >
              <label style={{ display: 'block', fontWeight: 700, fontSize: 14, color: 'var(--text-main)', marginBottom: 6 }}>
                📄 Upload file word tại đây (.docx)
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <input
                  type="file"
                  accept=".docx,.txt"
                  onChange={handleWordFileChange}
                  disabled={uploadingWord || creating}
                  style={{ padding: '8px 12px', fontSize: 13, flex: 1, minWidth: 220, background: '#ffffff' }}
                />
              </div>

              {uploadingWord && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, fontWeight: 600, color: 'var(--primary)', marginBottom: 5 }}>
                    <span>⏳ Đang xử lí file. Vui lòng đợi giấy lát...</span>
                    <span>{Math.round(uploadProgress)}%</span>
                  </div>
                  <div className="progress-bar-wrapper" style={{ maxWidth: '100%', height: 8 }}>
                    <div className="progress-bar-fill" style={{ width: `${uploadProgress}%`, background: 'var(--primary)', transition: 'width 0.3s ease' }} />
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
                    Đề có nhiều công thức Toán sẽ mất nhiều thời gian hơn do phải dựng từng ảnh công thức.
                  </div>
                </div>
              )}

              {uploadError && (
                <p className="error-text" style={{ marginTop: 8 }}>
                  ⚠️ {uploadError}
                </p>
              )}

              {parsedQuestions.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      background: 'var(--success-bg)',
                      color: 'var(--success-text)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 13,
                      fontWeight: 700,
                      marginBottom: 12,
                      flexWrap: 'wrap',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span>✓ Đã nhận diện {parsedQuestions.length} câu hỏi kèm công thức toán học!</span>
                      {totalFormulaCount > 0 && (
                        <span className="tag-badge" style={{ background: '#dbeafe', color: '#1e40af', border: '1px solid #93c5fd' }}>
                          📐 {totalFormulaCount} ảnh công thức
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {totalFormulaCount > 0 && (
                        <button
                          type="button"
                          className="btn sm secondary"
                          style={{ fontSize: 12, fontWeight: 600 }}
                          onClick={selectAllFormulasInExam}
                        >
                          ⚡ Chọn tất cả ({totalFormulaCount})
                        </button>
                      )}

                      {selectedFormulaKeys.length > 0 && (
                        <button
                          type="button"
                          className="btn sm secondary"
                          style={{ fontSize: 12, color: 'var(--danger)' }}
                          onClick={clearFormulaSelection}
                        >
                          ✕ Bỏ chọn
                        </button>
                      )}
                    </div>
                  </div>

                  {totalFormulaCount > 0 && (
                    <div
                      style={{
                        padding: '8px 12px',
                        background: '#eef2ff',
                        border: '1px solid #c7d2fe',
                        borderRadius: 8,
                        color: '#4338ca',
                        fontSize: 12.5,
                        fontWeight: 500,
                        marginBottom: 10,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 6,
                      }}
                    >
                      <span>💡 Bấm vào bất kỳ công thức nào bên dưới để chọn / bỏ chọn. Đã chọn <strong>{selectedFormulaKeys.length}</strong> công thức.</span>
                      {selectedFormulaKeys.length > 0 && (
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#4f46e5' }}>
                          (Xem thanh công cụ phía dưới màn hình để đổi cỡ hàng loạt)
                        </span>
                      )}
                    </div>
                  )}

                  <div style={{ maxHeight: 460, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, paddingRight: 4 }}>
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
                              <div
                                style={{
                                  marginTop: idx > 0 ? 14 : 0,
                                  marginBottom: 4,
                                  padding: '9px 14px',
                                  background: 'var(--ink)',
                                  color: '#fff',
                                  borderRadius: 'var(--radius-md)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  boxShadow: '0 2px 5px rgba(0,0,0,0.08)',
                                  flexWrap: 'wrap',
                                  gap: 8,
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{ fontSize: 16 }}>📚</span>
                                  <strong style={{ fontSize: 13.5, letterSpacing: '0.02em', color: '#f8fafc' }}>
                                    CHỦ ĐỀ: {topicName.toUpperCase()}
                                  </strong>
                                </div>
                                <button
                                  type="button"
                                  className="btn sm"
                                  style={{
                                    background: 'rgba(255, 255, 255, 0.15)',
                                    color: '#fff',
                                    border: '1px solid rgba(255,255,255,0.25)',
                                    fontSize: 11.5,
                                    padding: '3px 10px',
                                    borderRadius: 20,
                                  }}
                                  onClick={() => selectAllFormulasInTopic(topicName)}
                                >
                                  📐 Chọn CT chủ đề này
                                </button>
                              </div>
                            )}

                            <div
                              style={{
                                padding: '14px 16px',
                                background: '#ffffff',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--border-color)',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                              }}
                            >
                              {/* Header câu hỏi: Số câu theo chủ đề, Chủ đề & Chọn đáp án đúng */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                  <strong style={{ fontSize: 14.5, color: 'var(--primary)', fontWeight: 800 }}>
                                    Câu {displayQNum}:
                                  </strong>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Chủ đề:</span>
                                <input
                                  type="text"
                                  aria-label={`Chủ đề của câu ${displayQNum}`}
                                  value={q.tags[0] || ''}
                                  onChange={(e) => updateParsedQuestionTag(idx, e.target.value)}
                                  placeholder="Nhập tên chủ đề…"
                                  spellCheck={false}
                                  style={{
                                    padding: '3px 8px',
                                    fontSize: 12,
                                    fontWeight: 600,
                                    width: 'auto',
                                    minWidth: 160,
                                    height: 28,
                                  }}
                                />
                              </div>

                              <button
                                type="button"
                                className="btn sm secondary"
                                style={{ fontSize: 11, padding: '2px 6px', height: 24 }}
                                title="Chọn toàn bộ công thức trong câu này"
                                onClick={() => selectAllFormulasInQuestion(idx)}
                              >
                                📐 Chọn CT câu này
                              </button>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-main)' }}>Đáp án đúng:</span>
                              <select
                                value={q.correctAnswer || 'A'}
                                onChange={(e) => updateParsedQuestionAnswer(idx, e.target.value)}
                                style={{
                                  padding: '3px 10px',
                                  fontSize: 13,
                                  fontWeight: 800,
                                  width: 'auto',
                                  height: 30,
                                  color: 'var(--success-text)',
                                  borderColor: 'var(--success-border)',
                                  background: 'var(--success-bg)',
                                  borderRadius: 6,
                                  cursor: 'pointer',
                                }}
                              >
                                {['A', 'B', 'C', 'D'].map((key) => (
                                  <option key={key} value={key}>
                                    Phương án {key}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {/* Nội dung đề bài */}
                          <div
                            className="question-content formula-editable"
                            data-formula-container="true"
                            data-preview-idx={idx}
                            data-field="content"
                            data-option-key="none"
                            style={{ fontSize: 13.5, lineHeight: 1.6, marginBottom: 8 }}
                            dangerouslySetInnerHTML={{ __html: renderMath(q.content) }}
                            onClick={(e) => handlePreviewContentClick(e, idx, 'content', null)}
                          />

                          {/* 4 Phương án */}
                          <div
                            style={
                              isLong
                                ? { display: 'flex', flexDirection: 'column', gap: 6 }
                                : { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 6 }
                            }
                          >
                            {q.options.map((opt) => {
                              const isCorrect = opt.key === q.correctAnswer;
                              return (
                                <div
                                  key={opt.key}
                                  className={`option-row ${isCorrect ? 'correct' : ''}`}
                                  style={{
                                    margin: 0,
                                    padding: '6px 10px',
                                    fontSize: 13,
                                    background: isCorrect ? 'var(--success-bg)' : '#f8fafc',
                                    border: isCorrect ? '1.5px solid var(--success-border)' : '1px solid #e2e8f0',
                                    borderRadius: 6,
                                  }}
                                >
                                  <strong style={{ minWidth: 20 }}>{opt.key}.</strong>
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
                                    <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: 'var(--success-text)' }}>
                                      ✓ Đúng
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {/* Cảnh báo nếu có */}
                          {q.warnings && q.warnings.length > 0 && (
                            <div style={{ marginTop: 6, fontSize: 11, color: 'var(--warning-text)' }}>
                              ⚠️ {q.warnings.join(' | ')}
                            </div>
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

            <div className="form-group">
              <label htmlFor="exam-title">Tên đề thi <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input
                id="exam-title"
                type="text"
                placeholder="Đề ôn tập số 1…"
                value={newExam.title}
                onChange={(e) => setNewExam({ ...newExam, title: e.target.value })}
                autoComplete="off"
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="exam-duration">Thời gian làm bài (phút) <span style={{ color: 'var(--danger)' }}>*</span></label>
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
              </div>
              <div className="form-group">
                <label htmlFor="exam-description">Mô tả ngắn</label>
                <input
                  id="exam-description"
                  type="text"
                  placeholder="Đề gồm 10 câu trắc nghiệm…"
                  value={newExam.description}
                  onChange={(e) => setNewExam({ ...newExam, description: e.target.value })}
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="exam-answer-key">📄 File đáp án chi tiết</label>
              <input
                id="exam-answer-key"
                type="file"
                accept=".pdf,image/*,.doc,.docx"
                onChange={(e) => setCreateAnswerKeyFile(e.target.files[0] || null)}
              />
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                {createAnswerKeyFile
                  ? `Upload thành công: ${createAnswerKeyFile.name}`
                  : 'Học sinh sẽ xem/tải/quét QR file này ngay sau khi nộp bài. Có thể bỏ qua và thêm sau ở danh sách đề thi.'}
              </p>
            </div>

            {/* GIAO ĐỀ CHO HỌC SINH / LỚP HỌC */}
            <div
              style={{
                marginTop: 16,
                padding: 16,
                background: '#ffffff',
                border: '1.5px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <strong style={{ fontSize: 14, color: 'var(--text-main)' }}>
                    👥 Giao đề cho học sinh
                  </strong>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    Upload thành công: <strong style={{ color: 'var(--primary)' }}>{createAssignedStudents.length}/{students.length} học sinh</strong>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn sm secondary"
                  onClick={toggleAllInCreate}
                >
                  {createAssignedStudents.length === students.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả học sinh'}
                </button>
              </div>

              {/* Chọn nhanh theo lớp */}
              {distinctClasses.length > 0 && (
                <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>⚡ CHỌN THEO LỚP:</span>
                  {distinctClasses.map((cls) => {
                    const classStudentIds = students.filter((s) => s.className === cls).map((s) => s.id);
                    const allSelected = classStudentIds.length > 0 && classStudentIds.every((id) => createAssignedStudents.includes(id));
                    return (
                      <button
                        key={cls}
                        type="button"
                        onClick={() => toggleClassInCreate(cls)}
                        className={`btn sm ${allSelected ? '' : 'secondary'}`}
                        style={{ padding: '4px 10px', fontSize: 12 }}
                      >
                        🏫 Lớp {cls} ({classStudentIds.length}) {allSelected ? '✓' : ''}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Bộ lọc học sinh */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Tìm theo tên học sinh, email…"
                  aria-label="Tìm học sinh theo tên hoặc email"
                  value={createAssignSearch}
                  onChange={(e) => setCreateAssignSearch(e.target.value)}
                  spellCheck={false}
                  style={{ flex: 1, minWidth: 180, fontSize: 13, padding: '6px 10px' }}
                />
                <select
                  value={createAssignClassFilter}
                  onChange={(e) => setCreateAssignClassFilter(e.target.value)}
                  style={{ width: 'auto', fontSize: 13, padding: '6px 10px' }}
                >
                  <option value="all">Tất cả lớp ({students.length})</option>
                  {distinctClasses.map((cls) => (
                    <option key={cls} value={cls}>Lớp {cls}</option>
                  ))}
                  <option value="unassigned">Chưa phân lớp</option>
                </select>
              </div>

              {/* Danh sách học sinh */}
              <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {filteredCreateStudents.map((st) => {
                  const isChecked = createAssignedStudents.includes(st.id);
                  return (
                    <div
                      key={st.id}
                      onClick={() => toggleStudentInCreate(st.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-sm)',
                        border: isChecked ? '1.5px solid var(--primary)' : '1px solid var(--border-light)',
                        background: isChecked ? 'var(--primary-light, #eff6ff)' : '#ffffff',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => { }}
                          style={{ width: 16, height: 16, cursor: 'pointer' }}
                        />
                        <div>
                          <strong style={{ fontSize: 13, color: 'var(--text-main)' }}>{st.name}</strong>
                        </div>
                      </div>
                      <span className="tag-badge" style={{ margin: 0, fontSize: 11 }}>
                        {st.className ? `Lớp ${st.className}` : 'Chưa phân lớp'}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Thông báo trạng thái giao học sinh */}
              {createAssignedStudents.length === 0 ? (
                <div
                  style={{
                    marginTop: 10,
                    padding: '10px 14px',
                    background: '#fffbeb',
                    border: '1.5px solid #fde68a',
                    borderRadius: 'var(--radius-sm)',
                    color: '#92400e',
                    fontSize: 13,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <span style={{ fontSize: 18, lineHeight: 1 }}>⚠️</span>
                  <div>
                    <strong style={{ color: '#b45309' }}>Chưa chọn học sinh nhận đề:</strong> Vui lòng tick chọn ít nhất một học sinh trong danh sách trên để Tạo đề.
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    marginTop: 10,
                    padding: '8px 14px',
                    background: '#f0fdf4',
                    border: '1.5px solid #bbf7d0',
                    borderRadius: 'var(--radius-sm)',
                    color: '#166534',
                    fontSize: 13,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <span style={{ fontSize: 16 }}>✓</span>
                  <span>
                    Sẵn sàng giao đề ngay cho <strong>{createAssignedStudents.length} học sinh</strong> sau khi bấm Tạo đề.
                  </span>
                </div>
              )}
            </div>

            {createError && (
              <p className="error-text" role="alert" aria-live="polite">
                <span aria-hidden="true">⚠️</span> {createError}
              </p>
            )}

            {createAssignedStudents.length > 0 && parsedQuestions.length === 0 && (
              <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 10 }}>
                ⬆️ Tải lên file Word đề thi ở trên và đợi tách câu hỏi thành công để mở nút tạo đề (không cho tạo đề rỗng chưa có câu hỏi).
              </p>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 14, alignItems: 'center', flexWrap: 'wrap' }}>
              {createAssignedStudents.length > 0 && parsedQuestions.length > 0 ? (
                <button
                  className="btn"
                  type="submit"
                  disabled={creating || uploadingWord}
                  style={{ background: 'linear-gradient(135deg, #10b981, #059669)', fontSize: 14, fontWeight: 700 }}
                >
                  {creating
                    ? 'Đang tạo & giao đề…'
                    : `🚀 Tạo bài tập ➔`}
                </button>
              ) : null}
              <button
                type="button"
                className="btn secondary"
                onClick={() => {
                  setShowCreateForm(false);
                  setWordFile(null);
                  setParsedQuestions([]);
                  setCreateAssignedStudents([]);
                }}
              >
                Huỷ
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Danh sách đề thi */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <h2 style={{ margin: 0 }}>Danh sách đề thi ({filteredExams.length})</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <div className="search-input-wrapper" style={{ width: 220, margin: 0 }}>
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Tìm kiếm đề…"
                aria-label="Tìm đề thi theo tên"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                spellCheck={false}
                style={{ padding: '8px 12px 8px 32px', height: 38 }}
              />
            </div>

            <select
              style={{ width: 'auto', minWidth: 140, padding: '8px 12px', height: 38, margin: 0 }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">Tất cả ({exams.length})</option>
              <option value="assigned">Đang phát hành ({assignedCount})</option>
              <option value="draft">Bản nháp ({draftCount})</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="empty-state-icon">⏳</div>
            <div className="empty-state-title">Đang tải danh sách bài tập…</div>
          </div>
        ) : filteredExams.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📁</div>
            <div className="empty-state-title">Không tìm thấy đề thi</div>
            {!showCreateForm && (
              <button className="btn sm" style={{ marginTop: 10 }} onClick={() => setShowCreateForm(true)}>
                + Tạo đề thi đầu tiên
              </button>
            )}
          </div>
        ) : (
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th style={{ minWidth: 260 }}>Tên đề thi</th>
                  <th className="nowrap" style={{ width: 110 }}>Trạng thái</th>
                  <th className="nowrap" style={{ minWidth: 260 }}>Học sinh & Tiến độ nộp bài</th>
                  <th className="nowrap" style={{ textAlign: 'right', width: 220 }}>Thao tác</th>
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

                  // Tính điểm trung bình của các học sinh đã nộp (lấy đợt mới nhất)
                  let avgScore = null;
                  if (submittedCount > 0) {
                    let totalScore = 0;
                    distinctSubmittedStudentIds.forEach((stId) => {
                      const stSubs = examSubmissions.filter((s) => s.studentId === stId);
                      const latest = stSubs[stSubs.length - 1];
                      totalScore += latest?.score || 0;
                    });
                    avgScore = (totalScore / submittedCount).toFixed(1);
                  }

                  return (
                    <React.Fragment key={exam.id}>
                      <tr>
                        <td style={{ verticalAlign: 'middle', minWidth: 260 }}>
                          <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: 15 }}>
                            <Link to={`/teacher/exams/${exam.id}`}>{exam.title}</Link>
                          </div>
                          {exam.description && (
                            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                              {exam.description}
                            </div>
                          )}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                            <span>📝 {exam.questionsCount ?? (exam.questions?.length || 0)} câu hỏi</span>
                            <span>⏱️ {exam.durationMinutes} phút</span>
                          </div>
                          {aiChildren.length > 0 && (
                            <button
                              type="button"
                              onClick={() => toggleAiFolder(exam.id)}
                              style={{
                                marginTop: 6,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                fontSize: 12,
                                fontWeight: 700,
                                color: 'var(--ai, #7c3aed)',
                                background: 'var(--ai-bg, #f3ecff)',
                                border: '1px solid var(--ai-line, #ddcbfb)',
                                borderRadius: 20,
                                padding: '3px 10px',
                                cursor: 'pointer',
                              }}
                            >
                              📂 {aiChildren.length} bài tập AI sinh thêm {isAiFolderExpanded ? '▲' : '▼'}
                            </button>
                          )}
                        </td>
                        <td className="nowrap" style={{ verticalAlign: 'middle' }}>
                          <span className={`status-pill ${exam.status}`}>
                            {exam.status === 'assigned' ? '✓ Đang giao' : '○ Bản nháp'}
                          </span>
                        </td>
                        <td style={{ verticalAlign: 'middle', minWidth: 260 }}>
                          {assignedStudentIds.length === 0 ? (
                            <span className="tag-badge" style={{ margin: 0, color: 'var(--text-muted)' }}>
                              Chưa giao cho học sinh nào
                            </span>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                              <div>
                                <div style={{ fontWeight: 700, fontSize: 13, color: submittedCount > 0 ? 'var(--text-main)' : 'var(--text-muted)' }}>
                                  {submittedCount > 0 ? `✅ Đã nộp: ${submittedCount}/${assignedStudentIds.length} HS` : `⏳ 0/${assignedStudentIds.length} HS đã nộp`}
                                </div>
                                {avgScore !== null && (
                                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                                    Điểm TB: <strong style={{ color: avgScore >= 5 ? 'var(--success)' : 'var(--danger)' }}>{avgScore}/10</strong>
                                  </div>
                                )}
                              </div>
                              <button
                                type="button"
                                className={`btn sm ${isExpanded ? '' : 'secondary'}`}
                                onClick={() => toggleExpandExam(exam.id)}
                                style={{
                                  padding: '5px 12px',
                                  fontSize: 12,
                                  borderRadius: 20,
                                  fontWeight: 600,
                                  whiteSpace: 'nowrap',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                }}
                              >
                                👥 {isExpanded ? 'Thu gọn ▲' : `Xem chi tiết (${assignedStudentIds.length}) ▼`}
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="nowrap" style={{ textAlign: 'right', verticalAlign: 'middle' }}>
                          <div className="action-buttons" style={{ justifyContent: 'flex-end', gap: 8 }}>
                            {exam.status === 'assigned' ? (
                              <Link
                                to={`/teacher/exams/${exam.id}`}
                                className="btn sm secondary"
                                style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                  <circle cx="12" cy="12" r="3"></circle>
                                </svg>
                                <span>Xem đề</span>
                              </Link>
                            ) : (
                              <Link
                                to={`/teacher/exams/${exam.id}`}
                                className="btn sm"
                                style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                              >
                                <span>Soạn câu hỏi</span>
                                <span>➔</span>
                              </Link>
                            )}

                            {/* Đáp án chi tiết: dùng chung cho cả đề nháp lẫn đề đã giao */}
                            <input
                              ref={(el) => { answerKeyInputRefs.current[exam.id] = el; }}
                              type="file"
                              accept=".pdf,image/*,.doc,.docx"
                              style={{ display: 'none' }}
                              onChange={(e) => handleAnswerKeyFileSelected(exam.id, e.target.files[0])}
                            />
                            <button
                              type="button"
                              className="btn sm secondary"
                              onClick={() => handlePickAnswerKeyFile(exam.id)}
                              disabled={uploadingAnswerKeyExamId === exam.id}
                              title={exam.answerKeyFile ? 'Thay file đáp án chi tiết' : 'Tải lên file đáp án chi tiết (PDF/ảnh) cho học sinh xem sau khi nộp bài'}
                              style={{ whiteSpace: 'nowrap' }}
                            >
                              {uploadingAnswerKeyExamId === exam.id
                                ? '⏳ Đang tải...'
                                : exam.answerKeyFile
                                  ? '📄 Đã có đáp án chi tiết'
                                  : '📄 Đáp án chi tiết'}
                            </button>
                            {exam.answerKeyFile && (
                              <button
                                type="button"
                                className="btn sm outline-danger"
                                onClick={() => handleRemoveAnswerKey(exam.id)}
                                disabled={uploadingAnswerKeyExamId === exam.id}
                                title="Gỡ file đáp án chi tiết"
                                style={{ whiteSpace: 'nowrap' }}
                              >
                                🗑️
                              </button>
                            )}

                            {exam.status === 'assigned' ? (
                              <button
                                type="button"
                                className="btn sm outline-danger"
                                onClick={() => handleDeleteExam(exam)}
                                title="Xoá đề thi"
                                style={{ whiteSpace: 'nowrap' }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6"></polyline>
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                  <line x1="10" y1="11" x2="10" y2="17"></line>
                                  <line x1="14" y1="11" x2="14" y2="17"></line>
                                </svg>
                                <span>Xoá</span>
                              </button>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  className="btn sm secondary"
                                  onClick={() => startEditExam(exam)}
                                  title="Sửa thông tin đề thi"
                                  style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                  </svg>
                                  <span>Sửa</span>
                                </button>
                                <button
                                  type="button"
                                  className="btn sm outline-danger"
                                  onClick={() => handleDeleteExam(exam)}
                                  title="Xoá đề thi"
                                  style={{ whiteSpace: 'nowrap' }}
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                    <line x1="10" y1="11" x2="10" y2="17"></line>
                                    <line x1="14" y1="11" x2="14" y2="17"></line>
                                  </svg>
                                  <span>Xoá</span>
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expandable Accordion Sub-Row */}
                      {isExpanded && assignedStudentIds.length > 0 && (
                        <tr style={{ background: '#f8fafc' }}>
                          <td colSpan={4} style={{ padding: '16px 20px', borderTop: 'none', borderBottom: '2px solid var(--border)' }}>
                            <div
                              style={{
                                background: '#ffffff',
                                border: '1px solid #e2e8f0',
                                borderRadius: 10,
                                padding: '14px 18px',
                                boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 8, borderBottom: '1px dashed #e2e8f0' }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>
                                  📋 Bảng kết quả & Đánh giá AI của từng học sinh: "{exam.title}"
                                </span>
                                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                  Đã nộp: <strong>{submittedCount}/{assignedStudentIds.length}</strong> học sinh
                                </span>
                              </div>

                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {assignedStudentIds.map((stId) => {
                                  const stObj = students.find((s) => s.id === stId);
                                  const studentName = stObj ? stObj.name : stId;
                                  const className = stObj?.className ? `Lớp ${stObj.className}` : null;
                                  const initial = studentName.trim().charAt(0).toUpperCase();
                                  const studentSubs = (submissions || [])
                                    .filter((s) => s.examId === exam.id && s.studentId === stId)
                                    .sort((a, b) => (a.attempt || 1) - (b.attempt || 1));

                                  if (studentSubs.length > 0) {
                                    const latestSub = studentSubs[studentSubs.length - 1];
                                    const firstSub = studentSubs[0];
                                    const attemptsCount = studentSubs.length;
                                    const scoreDiff = (latestSub.score - firstSub.score).toFixed(1);

                                    return (
                                      <div
                                        key={stId}
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                          padding: '12px 18px',
                                          borderRadius: 10,
                                          background: '#ffffff',
                                          border: '1px solid #e2e8f0',
                                          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                                          flexWrap: 'wrap',
                                          gap: 16,
                                        }}
                                      >
                                        {/* 1. Student Info */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 220 }}>
                                          <div
                                            style={{
                                              width: 36,
                                              height: 36,
                                              borderRadius: '50%',
                                              background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                                              color: '#fff',
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              fontWeight: 800,
                                              fontSize: 14,
                                              boxShadow: '0 2px 5px rgba(79,70,229,0.2)',
                                            }}
                                          >
                                            {initial}
                                          </div>
                                          <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                              <strong style={{ color: '#0f172a', fontSize: 14.5 }}>
                                                {studentName}
                                              </strong>
                                              {className && (
                                                <span style={{ fontSize: 11.5, background: '#ede9fe', color: '#6d28d9', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>
                                                  {className}
                                                </span>
                                              )}
                                            </div>
                                            <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
                                              🕒 Nộp lúc: {latestSub.submittedAt ? new Date(latestSub.submittedAt).toLocaleString('vi-VN') : '---'}
                                            </div>
                                          </div>
                                        </div>

                                        {/* 2. Middle: Scorecard Progress (Centered) */}
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, minWidth: 260 }}>
                                          {attemptsCount > 1 ? (
                                            <div
                                              style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: 8,
                                                background: '#f8fafc',
                                                border: '1px solid #e2e8f0',
                                                borderRadius: 20,
                                                padding: '5px 14px',
                                              }}
                                            >
                                              <span style={{ fontSize: 11, fontWeight: 700, background: '#ede9fe', color: '#6d28d9', padding: '2px 8px', borderRadius: 10 }}>
                                                {attemptsCount} lần làm
                                              </span>
                                              <span style={{ fontSize: 12.5, fontWeight: 600, color: '#64748b' }}>
                                                L1: <strong style={{ color: '#334155' }}>{firstSub.score}đ</strong>
                                              </span>
                                              <span style={{ fontSize: 11, color: '#94a3b8' }}>➔</span>
                                              <span style={{ fontSize: 12.5, fontWeight: 700, color: latestSub.score >= 5 ? '#16a34a' : '#dc2626' }}>
                                                L{attemptsCount}: <strong style={{ fontSize: 13.5 }}>{latestSub.score}đ</strong>
                                              </span>
                                              {parseFloat(scoreDiff) > 0 ? (
                                                <span
                                                  style={{
                                                    fontSize: 11.5,
                                                    fontWeight: 800,
                                                    color: '#15803d',
                                                    background: '#dcfce7',
                                                    border: '1px solid #bbf7d0',
                                                    padding: '2px 8px',
                                                    borderRadius: 12,
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: 3,
                                                  }}
                                                >
                                                  🚀 +{scoreDiff}đ
                                                </span>
                                              ) : parseFloat(scoreDiff) < 0 ? (
                                                <span
                                                  style={{
                                                    fontSize: 11.5,
                                                    fontWeight: 700,
                                                    color: '#b91c1c',
                                                    background: '#fee2e2',
                                                    border: '1px solid #fecaca',
                                                    padding: '2px 8px',
                                                    borderRadius: 12,
                                                  }}
                                                >
                                                  📉 {scoreDiff}đ
                                                </span>
                                              ) : (
                                                <span
                                                  style={{
                                                    fontSize: 11.5,
                                                    fontWeight: 600,
                                                    color: '#64748b',
                                                    background: '#f1f5f9',
                                                    padding: '2px 8px',
                                                    borderRadius: 12,
                                                  }}
                                                >
                                                  = Giữ nguyên
                                                </span>
                                              )}
                                            </div>
                                          ) : (
                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                              <span
                                                style={{
                                                  fontWeight: 800,
                                                  fontSize: 13,
                                                  padding: '4px 14px',
                                                  borderRadius: 20,
                                                  background: latestSub.score >= 5 ? '#dcfce7' : '#fee2e2',
                                                  color: latestSub.score >= 5 ? '#15803d' : '#b91c1c',
                                                  border: `1px solid ${latestSub.score >= 5 ? '#bbf7d0' : '#fecaca'}`,
                                                }}
                                              >
                                                {latestSub.score} / 10 điểm
                                              </span>
                                              <span style={{ fontSize: 11.5, fontWeight: 600, background: '#f1f5f9', color: '#64748b', padding: '3px 9px', borderRadius: 10 }}>
                                                1 lần làm
                                              </span>
                                            </div>
                                          )}
                                        </div>

                                        {/* 3. Right: Action button */}
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                                          <Link
                                            to={`/teacher/exams/${exam.id}/submissions/${latestSub.id || latestSub.submissionId}`}
                                            className="btn sm"
                                            style={{
                                              padding: '7px 16px',
                                              fontSize: 12.5,
                                              fontWeight: 700,
                                              borderRadius: 8,
                                              whiteSpace: 'nowrap',
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: 5,
                                              background: 'var(--primary)',
                                              color: '#fff',
                                              boxShadow: '0 2px 6px rgba(138,97,31,0.25)',
                                            }}
                                          >
                                            ✨ Xem bài & AI ➔
                                          </Link>
                                        </div>
                                      </div>
                                    );
                                  }

                                  return (
                                    <div
                                      key={stId}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '8px 14px',
                                        borderRadius: 8,
                                        background: '#f8fafc',
                                        border: '1px solid #f1f5f9',
                                        color: 'var(--text-muted)',
                                        fontSize: 13,
                                      }}
                                    >
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <div
                                          style={{
                                            width: 32,
                                            height: 32,
                                            borderRadius: '50%',
                                            background: '#cbd5e1',
                                            color: '#ffffff',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontWeight: 700,
                                            fontSize: 13,
                                          }}
                                        >
                                          {initial}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                          <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{studentName}</span>
                                          {className && (
                                            <span style={{ fontSize: 11, background: '#e2e8f0', padding: '1px 6px', borderRadius: 4 }}>
                                              {className}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      <span style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--text-muted)' }}>
                                        ⏳ Chưa nộp bài
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}

                      {/* Thư mục con: các đề AI tự sinh thêm dựa trên đề này */}
                      {isAiFolderExpanded && aiChildren.length > 0 && (
                        <tr style={{ background: 'var(--ai-bg, #f3ecff)' }}>
                          <td colSpan={4} style={{ padding: '12px 20px 16px', borderTop: 'none', borderBottom: '2px solid var(--border)' }}>
                            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ai, #7c3aed)', marginBottom: 8 }}>
                              📂 Bài tập AI sinh thêm từ đề "{exam.title}"
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {aiChildren.map((child) => {
                                const childAssigned = child.assignedTo || [];
                                const childStudent = students.find((s) => childAssigned.includes(s.id));
                                return (
                                  <div
                                    key={child.id}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      gap: 12,
                                      flexWrap: 'wrap',
                                      background: '#ffffff',
                                      border: '1px solid var(--ai-line, #ddcbfb)',
                                      borderRadius: 8,
                                      padding: '10px 14px',
                                    }}
                                  >
                                    <div style={{ minWidth: 200 }}>
                                      <Link to={`/teacher/exams/${child.id}`} style={{ fontWeight: 600, fontSize: 13.5 }}>
                                        {child.title}
                                      </Link>
                                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                                        👤 {childStudent ? childStudent.name : 'Học sinh'} · 📝 {child.questionsCount ?? 0} câu
                                      </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <span className={`status-pill ${child.status}`}>
                                        {child.status === 'assigned' ? '✓ Đang giao' : '○ Bản nháp'}
                                      </span>
                                      <Link to={`/teacher/exams/${child.id}`} className="btn sm secondary" style={{ whiteSpace: 'nowrap' }}>
                                        Xem đề
                                      </Link>
                                      <button
                                        type="button"
                                        className="btn sm outline-danger"
                                        onClick={() => handleDeleteExam(child)}
                                        title="Xoá đề này"
                                      >
                                        Xoá
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
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
              <button
                type="button"
                aria-label="Đóng"
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-muted)' }}
                onClick={() => setEditingExam(null)}
              >
                ✕
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
                    <option value="assigned">Đang phát hành</option>
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
                  <span aria-hidden="true">⚠️</span> {editError}
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
            <span style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>
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

          <div style={{ height: 18, width: 1, background: '#e2e8f0', flexShrink: 0 }} />

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

          <div style={{ height: 18, width: 1, background: '#cbd5e1', flexShrink: 0 }} />

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
                background: '#f8fafc',
                color: '#0f172a',
                border: '1.5px solid #cbd5e1',
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

          <div style={{ height: 18, width: 1, background: '#cbd5e1', flexShrink: 0 }} />

          <button
            type="button"
            style={{
              background: '#fef2f2',
              color: '#dc2626',
              border: '1.5px solid #fecaca',
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