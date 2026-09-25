import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { renderMath } from '../utils/mathRender';
import QuestionDiagram from '../components/QuestionDiagram';
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

// Kiểm tra phương án có dài hoặc nhiều dòng để trình bày dọc A B C D thay vì hàng ngang
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

export default function ExamEditorPage() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const [exam, setExam] = useState(null);
  const [students, setStudents] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [activeQuickSelect, setActiveQuickSelect] = useState({ type: null, key: null });
  const [submissions, setSubmissions] = useState([]);

  // UI Modes
  const [isEditMode, setIsEditMode] = useState(false); // false: Xem đề (Preview), true: Chế độ sửa
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showSubmissionsModal, setShowSubmissionsModal] = useState(false);
  const [showEditExamModal, setShowEditExamModal] = useState(false);

  // Form nhập từ file Word (.docx)
  const [parsedQuestions, setParsedQuestions] = useState([]);
  const [uploadingWord, setUploadingWord] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [importingWord, setImportingWord] = useState(false);
  const [importMessage, setImportMessage] = useState('');

  // Giao đề
  const [assignMessage, setAssignMessage] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [assignSearch, setAssignSearch] = useState('');
  const [assignClassFilter, setAssignClassFilter] = useState('all');


  // Sửa thông tin đề
  const [editExamForm, setEditExamForm] = useState({ title: '', description: '', durationMinutes: 15, status: 'draft' });
  const [editExamError, setEditExamError] = useState('');
  const [savingExam, setSavingExam] = useState(false);

  async function loadExam() {
    try {
      const [examRes, subsRes] = await Promise.all([
        api.get(`/exams/${examId}`),
        api.get(`/exams/${examId}/submissions`).catch(() => ({ data: [] })),
      ]);
      setExam(examRes.data);
      setSelectedStudents(examRes.data.assignedTo || []);
      setSubmissions(subsRes.data || []);
      setEditExamForm({
        title: examRes.data.title,
        description: examRes.data.description || '',
        durationMinutes: examRes.data.durationMinutes,
        status: examRes.data.status || 'draft',
      });
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    loadExam();
    api.get('/teacher/students').then((res) => setStudents(res.data || []));
    api.get('/teacher/groups').then((res) => setGroups(res.data || [])).catch(() => setGroups([]));
  }, [examId]);

  // Tải file Word lên Server
  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportMessage('');
    setUploadingWord(true);
    setUploadProgress(0);

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
      if (file.name.endsWith('.docx')) {
        const formData = new FormData();
        formData.append('file', file);

        const res = await api.post(`/exams/${examId}/import-preview`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          // Tách công thức ảnh (LibreOffice, độ phân giải cao) có thể mất vài
          // phút với file nhiều công thức - dài hơn giới hạn 90s mặc định.
          timeout: 300000,
          onUploadProgress: (evt) => {
            if (!evt.total) return;
            const uploadPercent = Math.round((evt.loaded / evt.total) * 30);
            setUploadProgress((prev) => Math.max(prev, uploadPercent));
            if (evt.loaded >= evt.total && !simulateInterval) {
              startSimulatedProgress();
            }
          },
        });

        const serverQuestions = res.data.questions || [];

        const mapped = serverQuestions.map((q, idx) => ({
          tempId: q.tempId || `import-${idx}`,
          content: q.contentHtml,
          topic: q.topic || q.tag || 'Kiến thức chung',
          qNum: q.qNum || (idx + 1),
          options: (q.options || []).map((o) => ({ key: o.key, text: o.html })),
          correctAnswer: q.suggestedAnswer || 'A',
          tags: q.tag ? [q.tag] : (q.topic ? [q.topic] : ['Kiến thức chung']),
          difficulty: 'medium',
          warnings: q.warnings || [],
        }));

        setParsedQuestions(mapped);
        setImportMessage(`✓ Đã phân tích thành công ${mapped.length} câu hỏi từ file Word! Hãy kiểm tra chủ đề và đáp án bên dưới trước khi lưu.`);
        setUploadProgress(100);
      } else {
        setImportMessage('⚠️ Vui lòng chọn file Word (.docx) để hệ thống nhận diện câu hỏi và công thức toán.');
      }
    } catch (err) {
      setImportMessage(`⚠️ Lỗi khi đọc file Word: ` + (err.response?.data?.message || err.message));
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

  async function handleBatchImport() {
    if (parsedQuestions.length === 0) return;
    setImportingWord(true);
    setImportMessage('');

    try {
      const payload = parsedQuestions.map((q) => ({
        content: q.content,
        options: q.options,
        correctAnswer: q.correctAnswer || 'A',
        tags: q.tags && q.tags.length > 0 ? q.tags : ['Kiến thức chung'],
        difficulty: q.difficulty || 'medium',
      }));

      const res = await api.post(`/exams/${examId}/questions/bulk`, { questions: payload });

      setImportMessage(`✓ Đã nạp thành công tất cả ${res.data.created || payload.length} câu hỏi vào đề!`);
      setParsedQuestions([]);
      await loadExam();
    } catch (err) {
      setImportMessage(`⚠️ Nạp câu hỏi thất bại: ` + (err.response?.data?.message || err.message));
    } finally {
      setImportingWord(false);
    }
  }

  async function handleDeleteQuestion(questionId) {
    if (!window.confirm('Xoá câu hỏi này khỏi đề thi?')) return;
    await api.delete(`/exams/${examId}/questions/${questionId}`);
    loadExam();
  }

  // Chỉnh tay cỡ 1 ảnh công thức cụ thể - cỡ tự động (backend tính lúc
  // import) không thể đúng 100% với mọi trường hợp vì ảnh WMF/MathType
  // không giữ đủ thông tin đáng tin cậy, nên cho giáo viên tự sửa nhanh.
  // Hoạt động ở CẢ 2 nơi: (1) ngay tại bước "Xem trước" sau khi tải file
  // Chỉnh tay cỡ ảnh công thức (hỗ trợ chọn 1 hoặc NHIỀU công thức cùng lúc)
  const [resizeTarget, setResizeTarget] = useState(null); // { source: 'saved'|'preview', questionId|previewIdx, field, optionKey, imgIndex }
  const [customEmValue, setCustomEmValue] = useState('');
  const [resizeScope, setResizeScope] = useState('target'); // 'target' | 'question' | 'all'
  const [selectedFormulaKeys, setSelectedFormulaKeys] = useState([]); // 'preview_${idx}_...' or 'saved_${qId}_...'
  const [batchCustomEmValue, setBatchCustomEmValue] = useState('');

  // Đếm tổng số công thức có trong danh sách câu hỏi đã lưu hoặc bản xem trước
  const totalSavedFormulaCount = useMemo(() => {
    let count = 0;
    (exam?.questions || []).forEach((q) => {
      count += countFormulaImgs(q.content);
      (q.options || []).forEach((opt) => {
        count += countFormulaImgs(opt.text);
      });
    });
    return count;
  }, [exam]);

  const totalPreviewFormulaCount = useMemo(() => {
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
      const source = parts[0];
      const idOrIdx = parts[1];
      const field = parts[2];
      const optKey = parts[3];
      const imgIdx = parseInt(parts[4], 10);

      if (source === 'preview') {
        const pIdx = parseInt(idOrIdx, 10);
        const q = parsedQuestions[pIdx];
        if (!q) return;
        const html = field === 'content' ? q.content : q.options?.find((o) => o.key === optKey)?.text;
        const imgs = listFormulaImgTags(html);
        if (imgs[imgIdx]) sizes.add(extractFormulaSize(imgs[imgIdx].tag));
      } else if (source === 'saved') {
        const q = exam?.questions?.find((item) => item.id === idOrIdx);
        if (!q) return;
        const html = field === 'content' ? q.content : q.options?.find((o) => o.key === optKey)?.text;
        const imgs = listFormulaImgTags(html);
        if (imgs[imgIdx]) sizes.add(extractFormulaSize(imgs[imgIdx].tag));
      }
    });
    return Array.from(sizes);
  }, [selectedFormulaKeys, parsedQuestions, exam]);

  // Đồng bộ hiệu ứng viền sáng (.formula-selected) và tooltip kích thước cho các công thức
  useEffect(() => {
    const containers = document.querySelectorAll('[data-formula-container]');
    containers.forEach((container) => {
      const source = container.getAttribute('data-source');
      const previewIdx = container.getAttribute('data-preview-idx');
      const questionId = container.getAttribute('data-question-id');
      const field = container.getAttribute('data-field');
      const optionKey = container.getAttribute('data-option-key') || 'none';
      const imgs = container.querySelectorAll('img.formula-img');
      imgs.forEach((img, imgIndex) => {
        const key = source === 'saved'
          ? `saved_${questionId}_${field}_${optionKey}_${imgIndex}`
          : `preview_${previewIdx}_${field}_${optionKey}_${imgIndex}`;
        const currentSize = img.style.height || '1.55em';
        img.setAttribute('title', `📐 Cỡ hiện tại: ${currentSize} (Bấm để chọn/bỏ chọn)`);
        if (selectedFormulaKeys.includes(key)) {
          img.classList.add('formula-selected');
        } else {
          img.classList.remove('formula-selected');
        }
      });
    });
  }, [selectedFormulaKeys, parsedQuestions, exam]);

  // Chọn toàn bộ công thức trong danh sách xem trước
  function selectAllFormulasInPreview() {
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

  // Chọn toàn bộ công thức trong danh sách câu đã lưu
  function selectAllFormulasInSavedExam() {
    const keys = [];
    (exam?.questions || []).forEach((q) => {
      const contentCount = countFormulaImgs(q.content);
      for (let i = 0; i < contentCount; i++) {
        keys.push(`saved_${q.id}_content_none_${i}`);
      }
      (q.options || []).forEach((opt) => {
        const optCount = countFormulaImgs(opt.text);
        for (let i = 0; i < optCount; i++) {
          keys.push(`saved_${q.id}_option_${opt.key}_${i}`);
        }
      });
    });
    setSelectedFormulaKeys(keys);
    setIsMultiFormulaSelect(true);
  }

  // Chọn toàn bộ công thức trong 1 câu hỏi cụ thể
  function selectAllFormulasInQuestion(target) {
    const keys = [];
    if (target.source === 'preview') {
      const q = parsedQuestions[target.previewIdx];
      if (!q) return;
      const contentCount = countFormulaImgs(q.content);
      for (let i = 0; i < contentCount; i++) {
        keys.push(`preview_${target.previewIdx}_content_none_${i}`);
      }
      (q.options || []).forEach((opt) => {
        const optCount = countFormulaImgs(opt.text);
        for (let i = 0; i < optCount; i++) {
          keys.push(`preview_${target.previewIdx}_option_${opt.key}_${i}`);
        }
      });
    } else {
      const q = exam?.questions?.find((item) => item.id === target.questionId);
      if (!q) return;
      const contentCount = countFormulaImgs(q.content);
      for (let i = 0; i < contentCount; i++) {
        keys.push(`saved_${q.id}_content_none_${i}`);
      }
      (q.options || []).forEach((opt) => {
        const optCount = countFormulaImgs(opt.text);
        for (let i = 0; i < optCount; i++) {
          keys.push(`saved_${q.id}_option_${opt.key}_${i}`);
        }
      });
    }
    setSelectedFormulaKeys((prev) => Array.from(new Set([...prev, ...keys])));
    setIsMultiFormulaSelect(true);
  }

  function clearFormulaSelection() {
    setSelectedFormulaKeys([]);
  }

  // Áp dụng đổi cỡ hàng loạt
  async function handleApplyBatchFormulaSize(heightEm, vAlignEm) {
    if (selectedFormulaKeys.length === 0) return;

    // Phân nhóm theo source
    const previewKeyMap = {};
    const savedKeyMap = {};

    selectedFormulaKeys.forEach((key) => {
      const parts = key.split('_');
      const source = parts[0];
      const idOrIdx = parts[1];
      const field = parts[2];
      const optKey = parts[3];
      const imgIdx = parseInt(parts[4], 10);

      if (source === 'preview') {
        const pIdx = parseInt(idOrIdx, 10);
        if (!previewKeyMap[pIdx]) previewKeyMap[pIdx] = { content: new Set(), options: {} };
        if (field === 'content') previewKeyMap[pIdx].content.add(imgIdx);
        else {
          if (!previewKeyMap[pIdx].options[optKey]) previewKeyMap[pIdx].options[optKey] = new Set();
          previewKeyMap[pIdx].options[optKey].add(imgIdx);
        }
      } else if (source === 'saved') {
        const qId = idOrIdx;
        if (!savedKeyMap[qId]) savedKeyMap[qId] = { content: new Set(), options: {} };
        if (field === 'content') savedKeyMap[qId].content.add(imgIdx);
        else {
          if (!savedKeyMap[qId].options[optKey]) savedKeyMap[qId].options[optKey] = new Set();
          savedKeyMap[qId].options[optKey].add(imgIdx);
        }
      }
    });

    // 1. Áp dụng cho preview questions
    if (Object.keys(previewKeyMap).length > 0) {
      setParsedQuestions((prev) =>
        prev.map((q, idx) => {
          const item = previewKeyMap[idx];
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
    }

    // 2. Áp dụng cho saved questions
    const savedQuestionIds = Object.keys(savedKeyMap);
    if (savedQuestionIds.length > 0) {
      const updatePromises = savedQuestionIds.map((qId) => {
        const q = exam.questions.find((item) => item.id === qId);
        if (!q) return Promise.resolve();
        const item = savedKeyMap[qId];

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

        return api.put(`/exams/${examId}/questions/${qId}`, {
          content: newContent,
          options: newOptions,
        });
      });

      try {
        await Promise.all(updatePromises);
        await loadExam();
      } catch (err) {
        console.error('Lỗi cập nhật cỡ công thức hàng loạt:', err);
      }
    }

    setSelectedFormulaKeys([]);
    setBatchCustomEmValue('');
  }

  function handleResizeFormula(target, heightEm, vAlignEm, scope = resizeScope) {
    const { source, field, optionKey, imgIndex } = target;

    if (source === 'preview') {
      if (scope === 'all') {
        setParsedQuestions((prev) =>
          prev.map((q) => ({
            ...q,
            content: applyFormulaSizeToAll(q.content, heightEm, vAlignEm),
            options: (q.options || []).map((o) => ({ ...o, text: applyFormulaSizeToAll(o.text, heightEm, vAlignEm) })),
          }))
        );
      } else if (scope === 'question') {
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
        setParsedQuestions((prev) => {
          const updated = [...prev];
          const q = updated[target.previewIdx];
          if (!q) return prev;
          if (field === 'content') {
            updated[target.previewIdx] = { ...q, content: applyFormulaSize(q.content, imgIndex, heightEm, vAlignEm) };
          } else {
            updated[target.previewIdx] = {
              ...q,
              options: q.options.map((o) =>
                o.key === optionKey ? { ...o, text: applyFormulaSize(o.text, imgIndex, heightEm, vAlignEm) } : o
              ),
            };
          }
          return updated;
        });
      }
      setResizeTarget(null);
      setCustomEmValue('');
      setResizeScope('target');
      return;
    }

    // source === 'saved'
    if (scope === 'all') {
      const updatePromises = (exam.questions || []).map((q) =>
        api.put(`/exams/${examId}/questions/${q.id}`, {
          content: applyFormulaSizeToAll(q.content, heightEm, vAlignEm),
          options: (q.options || []).map((o) => ({ ...o, text: applyFormulaSizeToAll(o.text, heightEm, vAlignEm) })),
        })
      );
      Promise.all(updatePromises).then(() => {
        setResizeTarget(null);
        setCustomEmValue('');
        setResizeScope('target');
        loadExam();
      });
      return;
    }

    const question = exam.questions.find((q) => q.id === target.questionId);
    if (!question) return;

    if (scope === 'question') {
      api
        .put(`/exams/${examId}/questions/${question.id}`, {
          content: applyFormulaSizeToAll(question.content, heightEm, vAlignEm),
          options: question.options.map((o) => ({ ...o, text: applyFormulaSizeToAll(o.text, heightEm, vAlignEm) })),
        })
        .then(() => {
          setResizeTarget(null);
          setCustomEmValue('');
          setResizeScope('target');
          loadExam();
        });
      return;
    }

    const changes = {};
    if (field === 'content') {
      changes.content = applyFormulaSize(question.content, imgIndex, heightEm, vAlignEm);
    } else {
      changes.options = question.options.map((o) =>
        o.key === optionKey ? { ...o, text: applyFormulaSize(o.text, imgIndex, heightEm, vAlignEm) } : o
      );
    }
    api.put(`/exams/${examId}/questions/${question.id}`, changes).then(() => {
      setResizeTarget(null);
      setCustomEmValue('');
      setResizeScope('target');
      loadExam();
    });
  }

  // Bắt sự kiện click trên ảnh công thức: mặc định bấm vào công thức nào là chọn/bỏ chọn ngay
  function handleContentClick(e, baseTarget, field, optionKey) {
    const img = e.target.closest('img.formula-img');
    if (!img) return;
    const allFormulaImgs = Array.from(e.currentTarget.querySelectorAll('img.formula-img'));
    const imgIndex = allFormulaImgs.indexOf(img);
    if (imgIndex === -1) return;

    const source = baseTarget.source;
    const key = source === 'saved'
      ? `saved_${baseTarget.questionId}_${field}_${optionKey || 'none'}_${imgIndex}`
      : `preview_${baseTarget.previewIdx}_${field}_${optionKey || 'none'}_${imgIndex}`;

    setSelectedFormulaKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  function toggleStudent(studentId) {
    // Bấm tay từng học sinh -> tắt trạng thái nổi bật của nút lớp/nhóm nhanh
    // (nếu có), tránh nổi bật nhầm do trùng học sinh ngẫu nhiên.
    setActiveQuickSelect({ type: null, key: null });
    setSelectedStudents((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    );
  }

  function toggleClass(className) {
    const classStudentIds = students.filter((s) => s.className === className).map((s) => s.id);
    const allSelected = classStudentIds.every((id) => selectedStudents.includes(id));

    if (allSelected) {
      setSelectedStudents((prev) => prev.filter((id) => !classStudentIds.includes(id)));
      setActiveQuickSelect({ type: null, key: null });
    } else {
      setSelectedStudents((prev) => Array.from(new Set([...prev, ...classStudentIds])));
      setActiveQuickSelect({ type: 'class', key: className });
    }
  }

  function toggleGroup(group) {
    const groupStudentIds = group.studentIds;
    const allSelected = groupStudentIds.every((id) => selectedStudents.includes(id));
    if (allSelected) {
      setSelectedStudents((prev) => prev.filter((id) => !groupStudentIds.includes(id)));
      setActiveQuickSelect({ type: null, key: null });
    } else {
      setSelectedStudents((prev) => Array.from(new Set([...prev, ...groupStudentIds])));
      setActiveQuickSelect({ type: 'group', key: group.id });
    }
  }

  function toggleAllStudents() {
    setActiveQuickSelect({ type: null, key: null });
    if (selectedStudents.length === students.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(students.map((s) => s.id));
    }
  }

  async function handleAssign() {
    setAssignMessage('');
    setAssigning(true);
    try {
      await api.put(`/exams/${examId}/assign`, { studentIds: selectedStudents });
      setAssignMessage(`🎉 Đã giao đề thành công cho ${selectedStudents.length} học sinh!`);
      await loadExam();
      setTimeout(() => {
        setShowAssignModal(false);
      }, 900);
    } catch (err) {
      setAssignMessage(err.response?.data?.message || 'Giao đề thất bại');
    } finally {
      setAssigning(false);
    }
  }

  async function handleSaveEditExam(e) {
    e.preventDefault();
    setEditExamError('');
    setSavingExam(true);
    try {
      await api.put(`/exams/${examId}`, editExamForm);
      setShowEditExamModal(false);
      loadExam();
    } catch (err) {
      setEditExamError(err.response?.data?.message || 'Cập nhật đề thi thất bại');
    } finally {
      setSavingExam(false);
    }
  }

  async function handleDeleteExam() {
    if (!window.confirm(`Xoá đề thi "${exam?.title}"?`)) return;
    try {
      await api.delete(`/exams/${examId}`);
      navigate('/teacher/exams');
    } catch (err) {
      alert(err.response?.data?.message || 'Xoá đề thi thất bại');
    }
  }

  const distinctClasses = useMemo(() => {
    return Array.from(new Set(students.map((s) => s.className).filter(Boolean))).sort();
  }, [students]);

  const filteredAssignStudents = useMemo(() => {
    return students.filter((s) => {
      const matchesSearch =
        s.name.toLowerCase().includes(assignSearch.toLowerCase()) ||
        s.email.toLowerCase().includes(assignSearch.toLowerCase()) ||
        (s.className && s.className.toLowerCase().includes(assignSearch.toLowerCase()));

      if (!matchesSearch) return false;
      if (assignClassFilter === 'all') return true;
      if (assignClassFilter === 'unassigned') return !s.className;
      return s.className === assignClassFilter;
    });
  }, [students, assignSearch, assignClassFilter]);

  if (!exam) {
    return (
      <div className="container">
        <div className="empty-state">
          <div className="empty-state-icon">⏳</div>
          <div className="empty-state-title">Đang tải đề thi…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: 1040, paddingBottom: 60 }}>
      {/* Quay lại */}
      <div style={{ marginBottom: 14 }}>
        <Link to="/teacher/exams" className="btn-back">
          <span className="btn-back-arrow">←</span> Quay lại danh sách bài tập & đề thi
        </Link>
      </div>

      {/* Header Xem Đề Thi */}
      <div
        className="card"
        style={{
          marginBottom: 20,
          border: '1px solid var(--border-color)',
          boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                {exam.title}
              </h1>
              <span className={`status-pill ${exam.status}`}>
                {exam.status === 'assigned' ? '✓ Đang phát hành' : '○ Bản nháp'}
              </span>
            </div>

            {exam.description && (
              <p style={{ fontSize: 13.5, color: 'var(--text-muted)', marginTop: 6, marginBottom: 0 }}>
                {exam.description}
              </p>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
              <span className="tag-badge" style={{ fontSize: 12.5, padding: '4px 10px' }}>
                ⏱️ Thời gian: <strong>{exam.durationMinutes} phút</strong>
              </span>
              <span className="tag-badge" style={{ fontSize: 12.5, padding: '4px 10px' }}>
                📝 Tổng số: <strong>{exam.questions.length} câu hỏi</strong>
              </span>
              <span
                className="tag-badge"
                style={{
                  fontSize: 12.5,
                  padding: '4px 10px',
                  background: selectedStudents.length > 0 ? 'rgba(16,185,129,0.1)' : 'var(--bg-subtle)',
                  borderColor: selectedStudents.length > 0 ? 'rgba(16,185,129,0.3)' : 'var(--border-color)',
                  color: selectedStudents.length > 0 ? '#065f46' : 'var(--text-muted)',
                }}
              >
                👥 Đã giao cho: <strong>{selectedStudents.length}/{students.length} học sinh</strong>
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`btn ${isEditMode ? 'secondary' : ''}`}
              onClick={() => setIsEditMode(!isEditMode)}
              style={
                isEditMode
                  ? { background: '#fef3c7', color: '#92400e', borderColor: '#fde68a', fontWeight: 700 }
                  : { fontWeight: 700 }
              }
            >
              {isEditMode ? '✓ Đóng chế độ sửa' : '✏️ Chỉnh sửa đề'}
            </button>

            {submissions.length > 0 && (
              <button
                type="button"
                className="btn secondary"
                onClick={() => setShowSubmissionsModal(true)}
                style={{ fontWeight: 600 }}
              >
                📥 Bài nộp ({submissions.length})
              </button>
            )}

            <button
              type="button"
              className="btn sm outline-danger"
              onClick={handleDeleteExam}
              title="Xoá đề thi này"
              style={{ padding: '7px 10px' }}
            >
              🗑️
            </button>
          </div>
        </div>

        {/* Chế độ Chỉnh sửa Banner */}
        {isEditMode && (
          <div
            style={{
              marginTop: 18,
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              background: '#fffbeb',
              border: '1.5px dashed #f59e0b',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>🛠️</span>
              <span style={{ fontSize: 13, color: '#92400e', fontWeight: 600 }}>
                Bạn đang ở <strong>Chế độ Chỉnh sửa</strong>: có thể xoá từng câu hỏi, sửa thông tin đề, nạp thêm câu từ file Word và giao lại đề cho học sinh.
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn sm"
                onClick={() => setShowAssignModal(true)}
                style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: '#ffffff', fontSize: 12.5, fontWeight: 700 }}
              >
                🚀 Giao lại đề cho học sinh
              </button>
              <button
                type="button"
                className="btn sm secondary"
                onClick={() => setShowEditExamModal(true)}
                style={{ background: '#ffffff', fontSize: 12.5 }}
              >
                ⚙️ Sửa tên & thời gian đề
              </button>
              <button
                type="button"
                className="btn sm"
                onClick={() => setIsEditMode(false)}
                style={{ background: '#f59e0b', color: '#ffffff', fontSize: 12.5, fontWeight: 700 }}
              >
                ✓ Hoàn tất sửa
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Chế độ Sửa: Khối tải file Word nạp thêm câu hỏi */}
      {isEditMode && (
        <div className="card" style={{ marginBottom: 20, border: '1.5px solid var(--primary-border)' }}>
          <div className="card-header">
            <h2>📄 Nạp thêm câu hỏi từ File Word (.docx)</h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <input
                  type="file"
                  accept=".docx"
                  onChange={handleFileUpload}
                  style={{ padding: '8px 12px', fontSize: 13, flex: 1, minWidth: 240 }}
                  disabled={uploadingWord}
                />
              </div>
              <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: 4 }}>
                Hệ thống tự động nhận diện tiêu đề chủ đề, công thức MathType và bảng đáp án.
              </small>

              {uploadingWord && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, fontWeight: 600, color: 'var(--primary)', marginBottom: 5 }}>
                    <span>⏳ Đang xử lí file. Vui lòng đợi giây lát ...</span>
                    <span>{Math.round(uploadProgress)}%</span>
                  </div>
                  <div className="progress-bar-wrapper" style={{ maxWidth: '100%', height: 8 }}>
                    <div className="progress-bar-fill" style={{ width: `${uploadProgress}%`, background: 'var(--primary)', transition: 'width 0.3s ease' }} />
                  </div>
                </div>
              )}
            </div>

            {importMessage && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: importMessage.startsWith('✓') ? 'var(--success-bg)' : 'var(--warning-bg)',
                  color: importMessage.startsWith('✓') ? 'var(--success-text)' : 'var(--warning-text)',
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                {importMessage}
              </div>
            )}

            {parsedQuestions.length > 0 && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div>
                    <strong style={{ fontSize: 14, color: 'var(--primary)' }}>
                      Xem trước {parsedQuestions.length} câu hỏi nhận diện từ file:
                    </strong>
                    <p style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                      💡 Bấm vào công thức nào chưa vừa cỡ để chỉnh tay ngay tại đây, trước khi nạp vào đề
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn sm"
                    onClick={handleBatchImport}
                    disabled={importingWord}
                    style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', fontWeight: 700 }}
                  >
                    {importingWord ? 'Đang nạp…' : `✓ Nạp tất cả ${parsedQuestions.length} câu vào đề`}
                  </button>
                </div>

                <div style={{ maxHeight: 380, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {parsedQuestions.map((q, idx) => (
                    <div
                      key={q.tempId || idx}
                      style={{
                        padding: '12px 14px',
                        background: '#f8fafc',
                        border: '1px solid var(--border-color)',
                        borderRadius: 8,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <strong style={{ fontSize: 13, color: 'var(--primary)' }}>Câu {idx + 1}:</strong>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Chủ đề:</span>
                          <input
                            type="text"
                            value={q.tags[0] || ''}
                            onChange={(e) => updateParsedQuestionTag(idx, e.target.value)}
                            style={{ padding: '2px 8px', fontSize: 12, width: 160 }}
                          />
                          <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>Đáp án đúng:</span>
                          <select
                            value={q.correctAnswer || 'A'}
                            onChange={(e) => updateParsedQuestionAnswer(idx, e.target.value)}
                            style={{ padding: '2px 8px', fontSize: 12, fontWeight: 700 }}
                          >
                            {['A', 'B', 'C', 'D'].map((key) => (
                              <option key={key} value={key}>
                                {key}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div
                        className="question-content formula-editable"
                        style={{ fontSize: 13, marginBottom: 8 }}
                        dangerouslySetInnerHTML={{ __html: renderMath(q.content) }}
                        onClick={(e) => handleContentClick(e, { source: 'preview', previewIdx: idx }, 'content', null)}
                      />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {q.options.map((opt) => (
                          <div
                            key={opt.key}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: 6,
                              fontSize: 12.5,
                              padding: '4px 8px',
                              background: opt.key === (q.correctAnswer || 'A') ? 'var(--success-bg)' : '#ffffff',
                              border: '1px solid var(--border-light)',
                              borderRadius: 6,
                            }}
                          >
                            <strong style={{ minWidth: 16 }}>{opt.key}.</strong>
                            <span
                              className="formula-editable"
                              style={{ flex: 1 }}
                              dangerouslySetInnerHTML={{ __html: renderMath(opt.text) }}
                              onClick={(e) => handleContentClick(e, { source: 'preview', previewIdx: idx }, 'option', opt.key)}
                            />
                          </div>
                        ))}
                      </div>
                      {q.warnings && q.warnings.length > 0 && (
                        <p style={{ fontSize: 11.5, color: 'var(--warning-text)', marginTop: 6, marginBottom: 0 }}>
                          ⚠️ {q.warnings.join('; ')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* DANH SÁCH CÂU HỎI (Giao diện Xem Đề Thi Chuẩn) */}
      <div className="card" style={{ padding: '20px 24px' }}>
        <div
          className="card-header"
          style={{
            borderBottom: '1.5px solid var(--border-light)',
            paddingBottom: 14,
            marginBottom: 20,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
              📋 Nội dung các câu hỏi trong đề ({exam.questions.length} câu)
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
              Đáp án đúng được tô màu xanh lá để giáo viên dễ dàng đối chiếu
            </p>
          </div>

          {!isEditMode && (
            <button
              type="button"
              className="btn sm secondary"
              onClick={() => setIsEditMode(true)}
              style={{ fontWeight: 600 }}
            >
              ✏️ Bật chỉnh sửa đề
            </button>
          )}
        </div>

        {exam.questions.length === 0 ? (
          <div className="empty-state" style={{ padding: '40px 20px' }}>
            <div className="empty-state-icon">📝</div>
            <div className="empty-state-title">Đề thi chưa có câu hỏi nào</div>
            <p className="empty-state-desc">
              Bấm vào nút "Chỉnh sửa đề" ở trên để tải file Word (.docx) nạp câu hỏi tự động.
            </p>
            <button
              type="button"
              className="btn"
              onClick={() => setIsEditMode(true)}
              style={{ marginTop: 12 }}
            >
              ✏️ Bật chế độ nạp câu hỏi
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {(() => {
              let currentTopicName = null;
              let qNumInTopic = 0;

              return exam.questions.map((q, idx) => {
                const isLong = isLongOptionQuestion(q.options);
                const topicName = q.tags?.[0] || 'Kiến thức chung';
                const isNewTopic = topicName !== currentTopicName;
                if (isNewTopic) {
                  currentTopicName = topicName;
                  qNumInTopic = 1;
                } else {
                  qNumInTopic += 1;
                }
                const displayQNum = qNumInTopic;

                return (
                  <React.Fragment key={q.id}>
                    {isNewTopic && (
                      <div
                        style={{
                          marginTop: idx > 0 ? 14 : 0,
                          marginBottom: 4,
                          padding: '9px 16px',
                          background: 'var(--ink)',
                          color: '#fff',
                          borderRadius: 'var(--radius-md)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.06)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 16 }}>📚</span>
                          <strong style={{ fontSize: 14, letterSpacing: '0.02em', color: '#f8fafc' }}>
                            CHỦ ĐỀ: {topicName.toUpperCase()}
                          </strong>
                        </div>
                      </div>
                    )}

                    <div
                      className="question-card"
                      style={{
                        background: '#ffffff',
                        border: '1px solid var(--border-color)',
                        borderRadius: 10,
                        padding: '16px 20px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                        marginBottom: 0,
                      }}
                    >
                      {/* Header câu hỏi */}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: 10,
                          flexWrap: 'wrap',
                          gap: 8,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span
                            style={{
                              background: 'var(--primary-light)',
                              color: 'var(--primary)',
                              fontWeight: 800,
                              fontSize: 13.5,
                              padding: '3px 10px',
                              borderRadius: 6,
                            }}
                          >
                            Câu {displayQNum}
                          </span>
                          {q.tags && q.tags.length > 0 && (
                            <span
                              className="tag-badge"
                              style={{
                                margin: 0,
                                fontSize: 12,
                                background: 'var(--gold-soft)',
                                color: 'var(--primary)',
                                border: '1px solid var(--primary-border)',
                              }}
                            >
                              🏷️ {q.tags.join(', ')}
                            </span>
                          )}
                        </div>

                        {/* Chỉ hiển thị nút xoá khi ở chế độ chỉnh sửa */}
                        {isEditMode && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                              💡 Bấm vào công thức để chọn và đổi cỡ
                            </span>
                            <button
                              type="button"
                              className="btn sm outline-danger"
                              onClick={() => handleDeleteQuestion(q.id)}
                              style={{ fontSize: 12, padding: '3px 8px' }}
                            >
                              🗑️ Xoá câu này
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Nội dung câu hỏi */}
                      <div
                        className={`question-content${isEditMode ? ' formula-editable' : ''}`}
                        data-formula-container={isEditMode ? 'true' : undefined}
                        data-source="saved"
                        data-question-id={q.id}
                        data-field="content"
                        data-option-key="none"
                        style={{ fontSize: 15, lineHeight: 1.65, marginBottom: 12, color: 'var(--text-main)' }}
                        dangerouslySetInnerHTML={{ __html: renderMath(q.content) }}
                        onClick={(e) => isEditMode && handleContentClick(e, { source: 'saved', questionId: q.id }, 'content', null)}
                      />

                      <QuestionDiagram diagram={q.diagram} />

                      {/* 4 Phương án A, B, C, D */}
                      <div
                        style={
                          isLong
                            ? { display: 'flex', flexDirection: 'column', gap: 8 }
                            : {
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                              gap: 8,
                            }
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
                                padding: '8px 12px',
                                borderRadius: 8,
                                fontSize: 14,
                                background: isCorrect ? 'var(--success-bg)' : '#f8fafc',
                                border: isCorrect ? '1.5px solid var(--success-border)' : '1px solid #e2e8f0',
                              }}
                            >
                              <strong style={{ minWidth: 22, color: isCorrect ? 'var(--success-text)' : 'var(--text-main)' }}>
                                {opt.key}.
                              </strong>
                              <span
                                className={isEditMode ? 'formula-editable' : ''}
                                data-formula-container={isEditMode ? 'true' : undefined}
                                data-source="saved"
                                data-question-id={q.id}
                                data-field="option"
                                data-option-key={opt.key}
                                style={{ flex: 1 }}
                                dangerouslySetInnerHTML={{ __html: renderMath(opt.text) }}
                                onClick={(e) => isEditMode && handleContentClick(e, { source: 'saved', questionId: q.id }, 'option', opt.key)}
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
                    </div>
                  </React.Fragment>
                );
              });
            })()}
          </div>
        )}

        {/* Footer actions */}
        {exam.questions.length > 0 && (
          <div
            style={{
              marginTop: 24,
              paddingTop: 18,
              borderTop: '1px solid var(--border-light)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Đang hiển thị toàn bộ <strong>{exam.questions.length}</strong> câu hỏi của đề thi.
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {isEditMode ? (
                <>
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() => setIsEditMode(false)}
                  >
                    ✓ Đóng chế độ sửa
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setShowAssignModal(true)}
                    style={{
                      background: 'linear-gradient(135deg, #10b981, #059669)',
                      color: '#ffffff',
                      fontWeight: 700,
                    }}
                  >
                    🚀 Giao lại đề cho học sinh ➔
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => setIsEditMode(true)}
                  style={{ fontWeight: 600 }}
                >
                  ✏️ Chỉnh sửa đề & câu hỏi
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ================= MODAL GIAO ĐỀ CHO HỌC SINH / LỚP ================= */}
      {showAssignModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 20,
          }}
          onClick={() => setShowAssignModal(false)}
        >
          <div
            className="card form-panel"
            style={{
              width: '100%',
              maxWidth: 620,
              maxHeight: '90vh',
              overflowY: 'auto',
              margin: 0,
              boxShadow: 'var(--shadow-lg)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18 }}>🚀 Giao đề thi cho Học sinh / Lớp</h2>
                <p style={{ margin: '4px 0 0 0', fontSize: 12.5, color: 'var(--text-muted)' }}>
                  Upload thành công <strong style={{ color: 'var(--primary)' }}>{selectedStudents.length}/{students.length} học sinh</strong>
                </p>
              </div>
              <button
                type="button"
                aria-label="Đóng"
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-muted)' }}
                onClick={() => setShowAssignModal(false)}
              >
                ✕
              </button>
            </div>

            {/* Chọn nhanh theo LỚP */}
            {distinctClasses.length > 0 && (
              <div
                style={{
                  marginBottom: 14,
                  padding: '12px 14px',
                  background: 'var(--bg-subtle)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-light)',
                }}
              >
                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>
                  ⚡ Chọn nhanh theo Lớp:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {distinctClasses.map((cls) => {
                    const classStudents = students.filter((s) => s.className === cls);
                    const selectedCount = classStudents.filter((s) => selectedStudents.includes(s.id)).length;
                    // Chỉ tô đậm nút vừa được BẤM chọn (activeQuickSelect), không suy ra từ
                    // việc trùng khớp học sinh ngẫu nhiên với nhóm/lớp khác.
                    const isAllSelected = activeQuickSelect.type === 'class' && activeQuickSelect.key === cls;
                    const isPartial = !isAllSelected && selectedCount > 0 && selectedCount < classStudents.length;

                    return (
                      <button
                        key={cls}
                        type="button"
                        className="btn sm"
                        onClick={() => toggleClass(cls)}
                        style={{
                          background: isAllSelected ? 'var(--primary)' : isPartial ? 'var(--primary-light)' : '#ffffff',
                          color: isAllSelected ? '#ffffff' : isPartial ? 'var(--primary)' : 'var(--text-main)',
                          border: isAllSelected ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                          fontSize: 12,
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          cursor: 'pointer',
                        }}
                      >
                        <span>🏫 Lớp {cls}</span>
                        <span style={{ fontSize: 11, fontWeight: 700 }}>
                          ({selectedCount}/{classStudents.length})
                        </span>
                        {isAllSelected && <span>✓</span>}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    className="btn sm secondary"
                    onClick={toggleAllStudents}
                    style={{ fontSize: 12 }}
                  >
                    {selectedStudents.length === students.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                  </button>
                </div>
              </div>
            )}

            {/* Chọn nhanh theo NHÓM (tạo trong mục Quản lý học sinh) */}
            {groups.length > 0 && (
              <div
                style={{
                  marginBottom: 14,
                  padding: '12px 14px',
                  background: 'var(--bg-subtle)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-light)',
                }}
              >
                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>
                  ⚡ Chọn nhanh theo Nhóm:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {groups.map((g) => {
                    const selectedCount = g.studentIds.filter((id) => selectedStudents.includes(id)).length;
                    const isAllSelected = activeQuickSelect.type === 'group' && activeQuickSelect.key === g.id;
                    const isPartial = !isAllSelected && selectedCount > 0 && selectedCount < g.studentIds.length;

                    return (
                      <button
                        key={g.id}
                        type="button"
                        className="btn sm"
                        onClick={() => toggleGroup(g)}
                        style={{
                          background: isAllSelected ? 'var(--primary)' : isPartial ? 'var(--primary-light)' : '#ffffff',
                          color: isAllSelected ? '#ffffff' : isPartial ? 'var(--primary)' : 'var(--text-main)',
                          border: isAllSelected ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                          fontSize: 12,
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          cursor: 'pointer',
                        }}
                      >
                        <span>🗂️ {g.name}</span>
                        <span style={{ fontSize: 11, fontWeight: 700 }}>
                          ({selectedCount}/{g.studentIds.length})
                        </span>
                        {isAllSelected && <span>✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tìm kiếm & Lọc */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <div className="search-input-wrapper" style={{ flex: 1, minWidth: 160 }}>
                <span className="search-icon">🔍</span>
                <input
                  type="text"
                  placeholder="Tìm theo tên học sinh…"
                  aria-label="Tìm học sinh theo tên"
                  value={assignSearch}
                  onChange={(e) => setAssignSearch(e.target.value)}
                  spellCheck={false}
                  style={{ padding: '6px 10px 6px 30px', fontSize: 13 }}
                />
              </div>
              <select
                value={assignClassFilter}
                onChange={(e) => setAssignClassFilter(e.target.value)}
                style={{ width: 'auto', minWidth: 130, padding: '6px 10px', fontSize: 13 }}
              >
                <option value="all">Tất cả lớp ({students.length})</option>
                {distinctClasses.map((cls) => (
                  <option key={cls} value={cls}>
                    Lớp {cls}
                  </option>
                ))}
                <option value="unassigned">Chưa phân lớp</option>
              </select>
            </div>

            {/* Danh sách học sinh */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 8,
                marginBottom: 16,
                maxHeight: 280,
                overflowY: 'auto',
                padding: 2,
              }}
            >
              {filteredAssignStudents.map((s) => {
                const isSelected = selectedStudents.includes(s.id);
                return (
                  <div
                    key={s.id}
                    onClick={() => toggleStudent(s.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 10px',
                      borderRadius: 6,
                      border: isSelected ? '1.5px solid var(--primary)' : '1px solid var(--border-light)',
                      background: isSelected ? 'var(--primary-light)' : '#ffffff',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleStudent(s.id)}
                      style={{ width: 16, height: 16, cursor: 'pointer' }}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <strong style={{ fontSize: 12.5, color: 'var(--text-main)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.name}
                      </strong>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {s.className ? `Lớp ${s.className}` : 'Chưa phân lớp'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {assignMessage && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: 6,
                  background: 'var(--success-bg)',
                  color: 'var(--success-text)',
                  fontWeight: 600,
                  fontSize: 13,
                  marginBottom: 12,
                }}
              >
                {assignMessage}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="btn secondary"
                onClick={() => setShowAssignModal(false)}
              >
                Đóng
              </button>
              <button
                type="button"
                className="btn"
                onClick={handleAssign}
                disabled={assigning}
                style={{
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  color: '#ffffff',
                  fontWeight: 700,
                }}
              >
                {assigning ? 'Đang lưu…' : `✓ Xác nhận giao cho ${selectedStudents.length} học sinh`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL XEM BÀI NỘP HỌC SINH ================= */}
      {showSubmissionsModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 20,
          }}
          onClick={() => setShowSubmissionsModal(false)}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: 720,
              maxHeight: '90vh',
              overflowY: 'auto',
              margin: 0,
              boxShadow: 'var(--shadow-lg)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18 }}>📥 Danh sách bài nộp ({submissions.length})</h2>
                <p style={{ margin: '4px 0 0 0', fontSize: 12.5, color: 'var(--text-muted)' }}>
                  Kết quả làm bài và chẩn đoán AI của học sinh
                </p>
              </div>
              <button
                type="button"
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-muted)' }}
                onClick={() => setShowSubmissionsModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>Học sinh</th>
                    <th className="nowrap" style={{ width: 110 }}>Điểm số</th>
                    <th className="nowrap" style={{ width: 120 }}>Số câu đúng</th>
                    <th className="nowrap" style={{ width: 150 }}>Thời gian nộp</th>
                    <th className="nowrap" style={{ textAlign: 'right', width: 140 }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((sub) => {
                    return (
                      <tr key={sub.id}>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: 13.5 }}>
                            {sub.studentName}
                          </div>
                        </td>
                        <td className="nowrap">
                          <span
                            style={{
                              fontWeight: 800,
                              fontSize: 14,
                              color: sub.score >= 5 ? 'var(--success)' : 'var(--danger)',
                            }}
                          >
                            {sub.score} / 10
                          </span>
                        </td>
                        <td className="nowrap" style={{ fontSize: 13 }}>
                          Đúng {sub.correctCount}/{sub.totalQuestions}
                        </td>
                        <td className="nowrap" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {new Date(sub.submittedAt).toLocaleString('vi-VN')}
                        </td>
                        <td className="nowrap" style={{ textAlign: 'right' }}>
                          <Link
                            to={`/teacher/exams/${examId}/submissions/${sub.id}`}
                            className="btn sm"
                            style={{
                              background: 'var(--primary)',
                              color: '#ffffff',
                              fontWeight: 600,
                              fontSize: 12,
                            }}
                          >
                            ✨ Xem bài & AI ➔
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
              <button
                type="button"
                className="btn secondary"
                onClick={() => setShowSubmissionsModal(false)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL SỬA THÔNG TIN ĐỀ THI ================= */}
      {showEditExamModal && (
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
          onClick={() => setShowEditExamModal(false)}
        >
          <div
            className="card"
            style={{ width: '100%', maxWidth: 480, margin: 0, boxShadow: 'var(--shadow-lg)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-header">
              <h2>Sửa thông tin đề thi</h2>
              <button
                type="button"
                aria-label="Đóng"
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-muted)' }}
                onClick={() => setShowEditExamModal(false)}
              >
                ✕
              </button>
            </div>

            <form className="form-panel" onSubmit={handleSaveEditExam}>
              <div className="form-group">
                <label htmlFor="editor-exam-title">
                  Tên đề thi <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  id="editor-exam-title"
                  type="text"
                  value={editExamForm.title}
                  onChange={(e) => setEditExamForm({ ...editExamForm, title: e.target.value })}
                  autoComplete="off"
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="editor-exam-duration">
                    Thời gian (phút) <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    id="editor-exam-duration"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={180}
                    value={editExamForm.durationMinutes}
                    onChange={(e) => setEditExamForm({ ...editExamForm, durationMinutes: Number(e.target.value) })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="editor-exam-status">Trạng thái</label>
                  <select
                    id="editor-exam-status"
                    value={editExamForm.status}
                    onChange={(e) => setEditExamForm({ ...editExamForm, status: e.target.value })}
                  >
                    <option value="draft">Bản nháp</option>
                    <option value="assigned">Đang phát hành</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="editor-exam-description">Mô tả ngắn</label>
                <textarea
                  id="editor-exam-description"
                  rows={2}
                  value={editExamForm.description}
                  onChange={(e) => setEditExamForm({ ...editExamForm, description: e.target.value })}
                />
              </div>

              {editExamError && (
                <p className="error-text" role="alert" aria-live="polite">
                  <span aria-hidden="true">⚠️</span> {editExamError}
                </p>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
                <button type="button" className="btn secondary" onClick={() => setShowEditExamModal(false)}>
                  Huỷ
                </button>
                <button className="btn" type="submit" disabled={savingExam}>
                  {savingExam ? 'Đang lưu…' : 'Lưu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Batch Formula Toolbar - Light Theme */}
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