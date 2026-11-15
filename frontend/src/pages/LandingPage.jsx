import { Link } from 'react-router-dom';
import BrandMark from '../components/BrandMark';
import UiIcon from '../components/UiIcon';
import { renderMath } from '../utils/mathRender';
import { APP_NAME, APP_TAGLINE } from '../config/brand';
import { useAuth } from '../context/AuthContext';

// Trang giới thiệu (hiện ở "/" khi chưa đăng nhập). Nút "Đăng nhập" dẫn sang
// /login như cũ. Nội dung chỉ mô tả các tính năng phần mềm đang có thật.

const FEATURES = [
  {
    icon: 'upload',
    title: 'Nhập đề từ file Word',
    text: 'Tải đề trắc nghiệm có công thức MathType, hệ thống tách câu hỏi và giữ công thức hiển thị rõ nét. Đính kèm được file đáp án chi tiết.',
  },
  {
    icon: 'check',
    title: 'Làm bài, chấm điểm ngay',
    text: 'Học sinh làm bài trên web. Nộp xong biết điểm, xem lại từng câu với đáp án đúng và làm lại nếu muốn.',
  },
  {
    icon: 'chart',
    title: 'Thống kê theo chuyên đề',
    text: 'Tỉ lệ làm sai của từng chuyên đề, theo từng lần làm, từng học sinh và cả lớp, để thấy ngay phần cần ôn.',
  },
  {
    icon: 'route',
    title: 'Lộ trình ôn tập do AI soạn',
    text: 'AI đọc các câu làm sai, chỉ ra lỗ hổng kiến thức, cách khắc phục và soạn bài tập tương tự cho từng chuyên đề.',
  },
  {
    icon: 'edit',
    title: 'Giáo viên duyệt trước khi gửi',
    text: 'Mọi lộ trình và bài tập AI đều chờ giáo viên xem, chỉnh sửa hoặc tạo lại trước khi đến tay học sinh.',
  },
  {
    icon: 'sparkles',
    title: 'Trợ lý AI giải toán',
    text: 'Hỏi bất cứ lúc nào: giải chi tiết từng bước, tóm tắt lý thuyết, mẹo bấm máy tính Casio.',
  },
];

const STEPS = [
  { title: 'Giáo viên giao đề', text: 'Tạo đề từ file Word hoặc soạn trực tiếp, rồi giao cho lớp hoặc nhóm học sinh.' },
  { title: 'Học sinh làm bài', text: 'Làm trắc nghiệm trên web. Nộp bài là có điểm và thống kê theo chuyên đề.' },
  { title: 'AI phân tích câu sai', text: 'AI chỉ ra lỗ hổng kiến thức sau từng câu sai và soạn lộ trình kèm bài tập tương tự.' },
  { title: 'Ôn đúng chỗ còn yếu', text: 'Giáo viên duyệt, học sinh nhận lộ trình và luyện tập theo từng chuyên đề.' },
];

const FOR_TEACHERS = [
  'Tạo đề nhanh từ file Word có công thức Toán',
  'Theo dõi điểm và chuyên đề yếu của từng học sinh, từng lớp',
  'Xem lại bài làm, duyệt và chỉnh sửa lộ trình AI trước khi gửi',
  'Đăng thông báo và trò chuyện với học sinh',
];

const FOR_STUDENTS = [
  'Làm các đề được giao, biết điểm ngay khi nộp',
  'Xem lại từng câu cùng đáp án đúng',
  'Ôn theo lộ trình riêng cho từng lần làm bài',
  'Hỏi trợ lý AI khi gặp bài khó',
];

function scrollToId(id) {
  return (e) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  };
}

// Ảnh ghép minh hoạ: các mảnh giao diện thật của phần mềm (thẻ kết quả,
// bước lộ trình có công thức Toán, trạng thái phân tích AI).
function ProductCollage() {
  const formula = renderMath(String.raw`$a^x = b \Leftrightarrow x = \log_a b$`);
  return (
    <div className="lp-collage" aria-hidden="true">
      <div className="lp-window">
        <div className="lp-window-side">
          <BrandMark size={22} />
          <span className="lp-line is-active" />
          <span className="lp-line" />
          <span className="lp-line" />
          <span className="lp-line" />
        </div>
        <div className="lp-window-main">
          <div className="lp-window-title">Kết quả của tôi</div>
          <div className="lp-result">
            <div className="lp-result-score">5.7<small>/10</small></div>
            <div>
              <div className="lp-result-name">Đề 2</div>
              <div className="lp-result-meta">Lần 1</div>
            </div>
          </div>
          <div className="lp-weak">
            <div className="lp-weak-row"><span>Cấp số cộng và cấp số nhân</span><b>Sai 60%</b></div>
            <div className="score-bar"><span className="is-low" style={{ width: '60%' }} /></div>
          </div>
          <div className="lp-weak">
            <div className="lp-weak-row"><span>Phương trình lượng giác</span><b>Sai 40%</b></div>
            <div className="score-bar"><span className="is-low" style={{ width: '40%' }} /></div>
          </div>
        </div>
      </div>

      <div className="lp-float lp-float-step">
        <div className="lp-step-head">
          <span className="lp-step-num">1</span>
          <span>Phương trình mũ và logarit</span>
        </div>
        <div className="lp-step-label"><UiIcon name="book" size={13} /> Lý thuyết cần nắm</div>
        <div className="lp-step-formula" dangerouslySetInnerHTML={{ __html: formula }} />
        <div className="lp-step-mistake"><UiIcon name="alert" size={13} /> Quên điều kiện cơ số</div>
      </div>

      <div className="lp-float lp-float-ai">
        <span className="lp-ai-icon"><UiIcon name="sparkles" size={16} /></span>
        <div>
          <div className="lp-ai-title">AI đã phân tích bài làm</div>
          <div className="lp-ai-sub">Chờ giáo viên duyệt</div>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const year = new Date().getFullYear();
  // Đã đăng nhập: nút chính dẫn thẳng vào trang làm việc thay vì trang đăng nhập.
  const { user } = useAuth();
  const ctaTo = user ? (user.role === 'teacher' ? '/teacher' : '/student') : '/login';
  const ctaLabel = user ? 'Vào trang của tôi' : 'Đăng nhập';

  return (
    <div className="lp">
      <header className="lp-header">
        <div className="lp-wrap lp-header-inner">
          <Link to="/" className="lp-logo" aria-label={`${APP_NAME} - Trang chủ`}>
            <BrandMark size={32} />
            <span>{APP_NAME}</span>
          </Link>
          <nav className="lp-nav" aria-label="Mục trên trang">
            <a href="#tinh-nang" onClick={scrollToId('tinh-nang')}>Tính năng</a>
            <a href="#cach-hoat-dong" onClick={scrollToId('cach-hoat-dong')}>Cách hoạt động</a>
            <a href="#doi-tuong" onClick={scrollToId('doi-tuong')}>Giáo viên và học sinh</a>
          </nav>
          <Link to={ctaTo} className="btn lp-header-cta">{ctaLabel}</Link>
        </div>
      </header>

      <main>
        {/* Mở đầu */}
        <section className="lp-hero">
          <div className="lp-wrap lp-hero-inner">
            <div className="lp-hero-copy">
              <div className="lp-lockup">
                <BrandMark size={40} />
                <div>
                  <div className="lp-lockup-name">{APP_NAME}</div>
                  <div className="lp-lockup-tag">{APP_TAGLINE}</div>
                </div>
              </div>
              <h1>Học toán cùng AI, biết rõ mình cần ôn phần nào.</h1>
              <p>
                Làm bài trắc nghiệm, xem ngay chuyên đề còn yếu và ôn tập theo lộ trình
                do AI soạn, giáo viên duyệt.
              </p>
              <div className="lp-hero-actions">
                <Link to={ctaTo} className="btn btn-lg">{ctaLabel}</Link>
                <a href="#cach-hoat-dong" className="btn btn-lg secondary" onClick={scrollToId('cach-hoat-dong')}>
                  Xem cách hoạt động
                </a>
              </div>
            </div>
            <ProductCollage />
          </div>

          <div className="lp-explore">
            <a href="#tinh-nang" className="lp-explore-btn" onClick={scrollToId('tinh-nang')}>
              Khám phá tính năng <UiIcon name="chevron-down" size={16} />
            </a>
          </div>
        </section>

        {/* Tính năng */}
        <section id="tinh-nang" className="lp-section">
          <div className="lp-wrap">
            <div className="lp-section-head">
              <h2>Mọi thứ cần cho một buổi ôn tập có trọng tâm</h2>
              <p>Từ lúc giao đề đến lúc học sinh ôn xong phần còn yếu, tất cả nằm trong một phần mềm.</p>
            </div>
            <div className="lp-features">
              {FEATURES.map((f) => (
                <div key={f.title} className="lp-feature">
                  <span className="lp-feature-icon"><UiIcon name={f.icon} size={20} /></span>
                  <h3>{f.title}</h3>
                  <p>{f.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Cách hoạt động */}
        <section id="cach-hoat-dong" className="lp-section is-tinted">
          <div className="lp-wrap">
            <div className="lp-section-head">
              <h2>Cách hoạt động</h2>
              <p>Bốn bước, lặp lại sau mỗi lần làm bài.</p>
            </div>
            <ol className="lp-steps">
              {STEPS.map((s, i) => (
                <li key={s.title} className="lp-step">
                  <span className="lp-step-dot">{i + 1}</span>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Giáo viên và học sinh */}
        <section id="doi-tuong" className="lp-section">
          <div className="lp-wrap lp-audience">
            <div className="lp-audience-col">
              <span className="lp-audience-icon"><UiIcon name="users" size={20} /></span>
              <h2>Dành cho giáo viên</h2>
              <ul>
                {FOR_TEACHERS.map((t) => (
                  <li key={t}><UiIcon name="check" size={16} /> {t}</li>
                ))}
              </ul>
            </div>
            <div className="lp-audience-col">
              <span className="lp-audience-icon is-student"><UiIcon name="user" size={20} /></span>
              <h2>Dành cho học sinh</h2>
              <ul>
                {FOR_STUDENTS.map((t) => (
                  <li key={t}><UiIcon name="check" size={16} /> {t}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Lời mời */}
        <section className="lp-cta">
          <div className="lp-wrap">
            <div className="lp-cta-inner">
              <div>
                <h2>Bắt đầu học cùng {APP_NAME}</h2>
                <p>{user ? `Bạn đang đăng nhập với tài khoản ${user.name}.` : 'Học sinh đăng nhập bằng tài khoản do giáo viên cấp.'}</p>
              </div>
              <Link to={ctaTo} className="btn btn-lg lp-cta-btn">{ctaLabel}</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-wrap lp-footer-inner">
          <div className="lp-logo is-footer">
            <BrandMark size={26} />
            <span>{APP_NAME}</span>
          </div>
          <span>{APP_TAGLINE}</span>
          <span className="lp-footer-copy">© {year} {APP_NAME}</span>
        </div>
      </footer>
    </div>
  );
}
