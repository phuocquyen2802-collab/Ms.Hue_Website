import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';

import LoginPage from './pages/LoginPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import LandingPage from './pages/LandingPage';
import TeacherDashboard from './pages/TeacherDashboard';
import TeacherExamsPage from './pages/TeacherExamsPage';
import TeacherAnalyticsPage from './pages/TeacherAnalyticsPage';
import TeacherScoreStatsPage from './pages/TeacherScoreStatsPage';
import ExamEditorPage from './pages/ExamEditorPage';
import TeacherStudentDetailPage from './pages/TeacherStudentDetailPage';
import TeacherSubmissionDetailPage from './pages/TeacherSubmissionDetailPage';
import GeneratedExercisesListPage from './pages/GeneratedExercisesListPage';
import StudentDashboard from './pages/StudentDashboard';
import ExamPage from './pages/ExamPage';
import ResultPage from './pages/ResultPage';
import StudentWeakTopicsPage from './pages/StudentWeakTopicsPage';
import StudentRoadmapsPage from './pages/StudentRoadmapsPage';
import StudentHistoryDetailPage from './pages/StudentHistoryDetailPage';
import SettingsPage from './pages/SettingsPage';
import AnnouncementsPage from './pages/AnnouncementsPage';
import AiAssistantPage from './pages/AiAssistantPage';
import TeacherQuestionBanksPage from './pages/TeacherQuestionBanksPage';
import StudentGamesPage from './pages/StudentGamesPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      {/* Mở từ đường dẫn trong email khôi phục mật khẩu */}
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/register" element={<Navigate to="/login" replace />} />

      {/* "/" luôn là trang giới thiệu (kể cả khi đã đăng nhập - khi đó nút
          chính đổi thành "Vào trang của tôi", xem LandingPage). */}
      <Route path="/" element={<LandingPage />} />

      {/* Teacher Routes */}
      <Route
        path="/teacher"
        element={
          <ProtectedRoute role="teacher">
            <TeacherDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/exams"
        element={
          <ProtectedRoute role="teacher">
            <TeacherExamsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/analytics"
        element={
          <ProtectedRoute role="teacher">
            <TeacherAnalyticsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/score-stats"
        element={
          <ProtectedRoute role="teacher">
            <TeacherScoreStatsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/exams/:examId"
        element={
          <ProtectedRoute role="teacher">
            <ExamEditorPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/exams/:examId/submissions/:submissionId"
        element={
          <ProtectedRoute role="teacher">
            <TeacherSubmissionDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/students/:studentId"
        element={
          <ProtectedRoute role="teacher">
            <TeacherStudentDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/generated-exercises"
        element={
          <ProtectedRoute role="teacher">
            <GeneratedExercisesListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/ai-assistant"
        element={
          <ProtectedRoute role="teacher">
            <AiAssistantPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/teacher/question-banks"
        element={
          <ProtectedRoute role="teacher">
            <TeacherQuestionBanksPage />
          </ProtectedRoute>
        }
      />

      {/* Student Routes */}
      <Route
        path="/student"
        element={
          <ProtectedRoute role="student">
            <StudentDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/exams/:examId"
        element={
          <ProtectedRoute role="student">
            <ExamPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/submissions/:submissionId"
        element={
          <ProtectedRoute role="student">
            <ResultPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/history/:submissionId"
        element={
          <ProtectedRoute role="student">
            <StudentHistoryDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/weak-topics"
        element={
          <ProtectedRoute role="student">
            <StudentWeakTopicsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/roadmaps"
        element={
          <ProtectedRoute role="student">
            <StudentRoadmapsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/ai-assistant"
        element={
          <ProtectedRoute role="student">
            <AiAssistantPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/student/games"
        element={
          <ProtectedRoute role="student">
            <StudentGamesPage />
          </ProtectedRoute>
        }
      />

      {/* Shared Routes */}
      <Route
        path="/announcements"
        element={
          <ProtectedRoute>
            <AnnouncementsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
