import { useEffect, useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import WeakTopicsChart from '../components/WeakTopicsChart';
import UiIcon, { scoreLevel, formatScore, ScoreTrend } from '../components/UiIcon';

export default function TeacherAnalyticsPage() {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [allSubmissions, setAllSubmissions] = useState([]);

  // Filter state
  const [selectedClassFilter, setSelectedClassFilter] = useState('all');
  const [selectedStudentId, setSelectedStudentId] = useState('');

  // Analytics data
  const [studentStats, setStudentStats] = useState(null);
  const [studentStatsLoading, setStudentStatsLoading] = useState(false);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState('all');

  // Distinct classes list for filtering
  const classesList = useMemo(() => {
    const set = new Set();
    students.forEach((st) => {
      if (st.className && st.className.trim()) {
        set.add(st.className.trim());
      }
    });
    return Array.from(set).sort();
  }, [students]);

  // Load basic initial data (students + submissions)
  useEffect(() => {
    async function initData() {
      setLoading(true);
      try {
        const [stRes, subRes] = await Promise.all([
          api.get('/teacher/students'),
          api.get('/teacher/submissions'),
        ]);
        const stList = stRes.data || [];
        setStudents(stList);
        setAllSubmissions(subRes.data || []);

        // Nếu được điều hướng tới kèm ?studentId=... (VD: bấm tên học sinh
        // từ trang "Quản lý học sinh") thì chọn sẵn đúng học sinh đó.
        const studentIdFromUrl = searchParams.get('studentId');
        if (studentIdFromUrl && stList.some((s) => s.id === studentIdFromUrl)) {
          setSelectedStudentId(studentIdFromUrl);
        } else if (stList.length > 0) {
          setSelectedStudentId(stList[0].id);
        }
      } catch (err) {
        console.error('Lỗi khi tải danh sách học sinh:', err);
      } finally {
        setLoading(false);
      }
    }
    initData();
  }, []);

  // Filtered students according to class filter
  const filteredStudents = useMemo(() => {
    if (selectedClassFilter === 'all') return students;
    return students.filter((s) => (s.className || '').trim() === selectedClassFilter);
  }, [students, selectedClassFilter]);

  // Auto pick first student when class filter changes if current student is not in that class
  const handleClassFilterChange = (cls) => {
    setSelectedClassFilter(cls);
    const inCls = cls === 'all' ? students : students.filter((s) => (s.className || '').trim() === cls);
    if (inCls.length > 0 && !inCls.some((s) => s.id === selectedStudentId)) {
      setSelectedStudentId(inCls[0].id);
    }
  };

  // Fetch single student stats when selectedStudentId changes
  useEffect(() => {
    setSelectedSubmissionId('all');
    if (!selectedStudentId) {
      setStudentStats(null);
      return;
    }

    async function fetchStudentStats() {
      setStudentStatsLoading(true);
      try {
        const res = await api.get(`/teacher/students/${selectedStudentId}/stats`);
        setStudentStats(res.data || null);
      } catch (err) {
        console.error('Lỗi khi tải dữ liệu học sinh:', err);
        setStudentStats(null);
      } finally {
        setStudentStatsLoading(false);
      }
    }

    fetchStudentStats();
  }, [selectedStudentId]);

  // Submissions of selected student
  const studentSubmissions = useMemo(() => {
    if (!selectedStudentId) return [];
    return allSubmissions.filter((sub) => sub.studentId === selectedStudentId);
  }, [allSubmissions, selectedStudentId]);

  // Group submissions of selected student by exam
  const groupedSubmissions = useMemo(() => {
    if (!studentSubmissions || studentSubmissions.length === 0) return [];

    const groupsMap = {};
    studentSubmissions.forEach((sub) => {
      const key = sub.examId || sub.examTitle || 'unknown';
      if (!groupsMap[key]) {
        groupsMap[key] = {
          examId: sub.examId,
          examTitle: sub.examTitle || 'Đề thi trắc nghiệm',
          submissions: [],
        };
      }
      groupsMap[key].submissions.push(sub);
    });

    // Sort submissions within each group: newest attempt first (Lần 2, Lần 1...)
    Object.values(groupsMap).forEach((g) => {
      g.submissions.sort((a, b) => (b.attempt || 1) - (a.attempt || 1));
    });

    // Sort exam groups by latest submission date
    return Object.values(groupsMap).sort((a, b) => {
      const timeA = new Date(a.submissions[0]?.submittedAt || 0).getTime();
      const timeB = new Date(b.submissions[0]?.submittedAt || 0).getTime();
      return timeB - timeA;
    });
  }, [studentSubmissions]);

  // Current selected student info
  const currentStudent = useMemo(() => {
    return students.find((s) => s.id === selectedStudentId) || null;
  }, [students, selectedStudentId]);

  // Active submission if a specific attempt is clicked
  const activeSubmission = useMemo(() => {
    if (!selectedSubmissionId || selectedSubmissionId === 'all') return null;
    return studentSubmissions.find((s) => s.id === selectedSubmissionId) || null;
  }, [studentSubmissions, selectedSubmissionId]);

  // Topic stats to display (either of the single attempt or all submissions)
  const displayedTopicStats = useMemo(() => {
    if (activeSubmission && activeSubmission.topicStats) {
      return activeSubmission.topicStats;
    }
    return studentStats?.allTopicStats || [];
  }, [activeSubmission, studentStats]);

  // Weak topics for highlight cards
  const displayedWeakTags = useMemo(() => {
    if (activeSubmission) {
      return (activeSubmission.weakTopics || []).map((wt) => ({
        tag: wt.tag,
        wrongRate: wt.wrongRate,
        totalWrong: wt.totalWrong,
        totalAnswered: wt.totalAnswered,
      }));
    }
    return studentStats?.weakTags || [];
  }, [activeSubmission, studentStats]);

  // Average score of selected student
  const avgScore = useMemo(() => {
    if (studentSubmissions.length === 0) return null;
    const total = studentSubmissions.reduce((acc, cur) => acc + (cur.score || 0), 0);
    return (total / studentSubmissions.length).toFixed(1);
  }, [studentSubmissions]);

  const weakCount = studentStats?.weakTags?.length || 0;

  return (
    <div className="container" style={{ maxWidth: 1200 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Giám sát chất lượng học sinh</h1>
          <p className="page-subtitle">Theo dõi tiến độ và đánh giá năng lực của từng học sinh</p>
        </div>
      </div>

      <div className="card" style={{ padding: '14px 18px' }}>
        <div className="toolbar">
          <div className="segmented" role="group" aria-label="Lọc theo lớp">
            <button
              type="button"
              className={`segmented-btn${selectedClassFilter === 'all' ? ' is-active' : ''}`}
              aria-pressed={selectedClassFilter === 'all'}
              onClick={() => handleClassFilterChange('all')}
            >
              Tất cả lớp <span className="segmented-count">{students.length}</span>
            </button>
            {classesList.map((cls) => {
              const count = students.filter((s) => (s.className || '').trim() === cls).length;
              const isSelected = selectedClassFilter === cls;
              return (
                <button
                  key={cls}
                  type="button"
                  className={`segmented-btn${isSelected ? ' is-active' : ''}`}
                  aria-pressed={isSelected}
                  onClick={() => handleClassFilterChange(cls)}
                >
                  Lớp {cls} <span className="segmented-count">{count}</span>
                </button>
              );
            })}
          </div>

          <div className="toolbar-spacer" />

          <label className="toolbar-field">
            Học sinh
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              disabled={filteredStudents.length === 0}
              style={{ minWidth: 220 }}
            >
              {filteredStudents.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name}{selectedClassFilter === 'all' && st.className ? ` (Lớp ${st.className})` : ''}
                </option>
              ))}
              {filteredStudents.length === 0 && <option value="">Chưa có học sinh</option>}
            </select>
          </label>
        </div>
      </div>

      {loading || studentStatsLoading ? (
        <div className="card">
          <div className="empty-state">
            <div className="spinner" style={{ margin: '0 auto 12px' }} />
            <div className="empty-state-title">Đang tải hồ sơ học sinh…</div>
          </div>
        </div>
      ) : !currentStudent ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon is-svg"><UiIcon name="user" size={22} /></div>
            {students.length === 0 ? (
              <>
                <div className="empty-state-title">Chưa có học sinh nào</div>
                <p className="empty-state-desc">
                  Thêm học sinh ở mục <Link to="/teacher">Quản lý học sinh</Link> để bắt đầu theo dõi kết quả học tập.
                </p>
              </>
            ) : (
              <div className="empty-state-title">Chọn một học sinh để xem kết quả</div>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Hồ sơ học sinh */}
          <div className="card profile-card">
            <div className="profile-head">
              <div className="profile-id">
                <div className="avatar is-lg" aria-hidden="true">
                  {(currentStudent.name || '?').trim().charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2>{currentStudent.name}</h2>
                  <div className="meta-row">
                    <span className="class-badge">{currentStudent.className ? `Lớp ${currentStudent.className}` : 'Chưa phân lớp'}</span>
                    {currentStudent.email && <span>{currentStudent.email}</span>}
                  </div>
                </div>
              </div>

              <dl className="profile-stats">
                <div className="profile-stat">
                  <dt>Bài đã nộp</dt>
                  <dd>{studentSubmissions.length}</dd>
                </div>
                <div className="profile-stat">
                  <dt>Điểm trung bình</dt>
                  <dd className={avgScore !== null ? `score-text is-${scoreLevel(avgScore)}` : ''}>
                    {avgScore !== null ? <>{avgScore}<small>/10</small></> : '—'}
                  </dd>
                </div>
                <div className="profile-stat">
                  <dt>Chuyên đề cần phụ đạo</dt>
                  <dd className={weakCount > 0 ? 'score-text is-low' : ''}>{weakCount}</dd>
                </div>
              </dl>
            </div>

            {displayedWeakTags && displayedWeakTags.length > 0 && (
              <div className="weak-panel">
                <div className="weak-panel-head">
                  <UiIcon name="target" size={17} />
                  <strong>Chuyên đề cần lưu ý</strong>
                  {activeSubmission && (
                    <span className="class-badge">Theo lần làm {activeSubmission.attempt || 1}</span>
                  )}
                </div>
                <div className="weak-grid">
                  {displayedWeakTags.map((wt) => {
                    const percent = Math.round(wt.wrongRate * 100);
                    return (
                      <div key={wt.tag} className="weak-item">
                        <div className="weak-item-row">
                          <span className="weak-name" title={wt.tag}>{wt.tag}</span>
                          <span className="weak-rate">Sai {percent}%</span>
                        </div>
                        <div className="score-bar" aria-hidden="true">
                          <span className="is-low" style={{ width: `${percent}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Lịch sử bài làm */}
          <div className="card">
            <div className="card-header">
              <div className="card-title-group">
                <div className="card-title-row">
                  <h2>Lịch sử bài làm</h2>
                  <span className="count-badge">{studentSubmissions.length}</span>
                </div>
                {studentSubmissions.length > 0 && (
                  <p className="card-hint">Bấm vào một lần làm để xem thống kê chuyên đề của riêng lần đó.</p>
                )}
              </div>
              {selectedSubmissionId !== 'all' && (
                <button type="button" className="btn sm secondary" onClick={() => setSelectedSubmissionId('all')}>
                  Xem tổng hợp mọi lần
                </button>
              )}
            </div>

            {studentSubmissions.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon is-svg"><UiIcon name="inbox" size={22} /></div>
                <div className="empty-state-title">Học sinh này chưa nộp bài nào</div>
                <p className="empty-state-desc">Kết quả sẽ hiện ở đây sau khi học sinh làm bài được giao.</p>
              </div>
            ) : (
              <div className="attempt-groups">
                {groupedSubmissions.map((group) => {
                  const latestAttempt = group.submissions[0];
                  const firstAttempt = group.submissions[group.submissions.length - 1];
                  const attemptsCount = group.submissions.length;
                  const scoreDiff = (latestAttempt.score || 0) - (firstAttempt.score || 0);

                  return (
                    <div key={group.examId || group.examTitle} className="attempt-group">
                      <div className="attempt-group-head">
                        <div className="attempt-group-title">
                          <strong>{group.examTitle}</strong>
                          <span className="count-badge">{attemptsCount} lần làm</span>
                        </div>
                        {attemptsCount > 1 && (
                          <div className="attempt-progress">
                            <span>Lần 1 <b>{formatScore(firstAttempt.score)}</b></span>
                            <UiIcon name="arrow-right" size={14} />
                            <span>
                              Lần {attemptsCount}{' '}
                              <b className={`score-text is-${scoreLevel(latestAttempt.score)}`}>{formatScore(latestAttempt.score)}</b>
                            </span>
                            <ScoreTrend diff={scoreDiff} />
                          </div>
                        )}
                      </div>

                      <div className="table-responsive is-flush">
                        <table className="attempt-table">
                          <thead>
                            <tr>
                              <th>Lần làm</th>
                              <th>Điểm</th>
                              <th>Kết quả</th>
                              <th>Thời gian nộp</th>
                              <th style={{ textAlign: 'right' }}>Chẩn đoán AI</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.submissions.map((sub, idx) => {
                              const isSelected = selectedSubmissionId === sub.id;
                              const score = sub.score !== undefined ? sub.score : 0;
                              const toggle = () => setSelectedSubmissionId(isSelected ? 'all' : sub.id);
                              return (
                                <tr
                                  key={sub.id}
                                  className={`is-clickable${isSelected ? ' is-selected' : ''}`}
                                  onClick={toggle}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      toggle();
                                    }
                                  }}
                                  tabIndex={0}
                                  aria-selected={isSelected}
                                  title="Bấm để xem thống kê chuyên đề của lần làm này"
                                >
                                  <td>
                                    <span className="attempt-chip">
                                      Lần {sub.attempt || (group.submissions.length - idx)}
                                      {isSelected && <UiIcon name="check" size={13} />}
                                    </span>
                                  </td>
                                  <td>
                                    <span className={`score-pill is-${scoreLevel(score)}`}>
                                      {formatScore(score)}<small>/10</small>
                                    </span>
                                  </td>
                                  <td>Đúng {sub.correctCount || 0}/{sub.totalQuestions || sub.totalCount || 0} câu</td>
                                  <td className="text-muted-cell">
                                    {sub.submittedAt ? new Date(sub.submittedAt).toLocaleString('vi-VN') : '—'}
                                  </td>
                                  <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                                    <div className="ai-cell">
                                      {!sub.hasAiProposal && (
                                        <span className="ai-missing" title="Chưa bấm Sinh AI cho bài nộp này">Chưa có lộ trình AI</span>
                                      )}
                                      <Link to={`/teacher/exams/${sub.examId}/submissions/${sub.id}`} className="btn sm">
                                        <UiIcon name="sparkles" size={15} />
                                        Xem bài và AI
                                      </Link>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Thống kê theo chuyên đề - đồng bộ theo lần làm đang chọn */}
          <div className="card">
            <div className="card-header">
              <div className="card-title-group">
                <h2>Thống kê theo chuyên đề</h2>
                <p className="card-hint">
                  {activeSubmission ? (
                    <>
                      {activeSubmission.examTitle || 'Đề thi'}, lần {activeSubmission.attempt || 1} ({formatScore(activeSubmission.score)}/10 điểm)
                    </>
                  ) : (
                    `Tổng hợp ${studentSubmissions.length} bài đã nộp`
                  )}
                </p>
              </div>
              {activeSubmission ? (
                <button type="button" className="btn sm secondary" onClick={() => setSelectedSubmissionId('all')}>
                  Xem tổng hợp mọi lần
                </button>
              ) : (
                <span className="class-badge">Tổng hợp mọi lần làm</span>
              )}
            </div>

            {activeSubmission && activeSubmission.score === 10 && (
              <div className="ce-alert is-success" style={{ marginTop: 0, marginBottom: 16 }}>
                <UiIcon name="check" size={17} />
                <span>Đạt điểm tuyệt đối 10/10 ở lần làm này, tất cả câu hỏi đều đúng.</span>
              </div>
            )}

            {displayedTopicStats && displayedTopicStats.length > 0 ? (
              <WeakTopicsChart data={displayedTopicStats} />
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon is-svg"><UiIcon name="chart" size={22} /></div>
                <div className="empty-state-title">Chưa có dữ liệu chuyên đề</div>
                <p className="empty-state-desc">Thống kê chuyên đề sẽ hiện sau khi học sinh nộp bài.</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
