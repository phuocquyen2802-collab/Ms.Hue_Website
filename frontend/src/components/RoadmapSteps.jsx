import { renderMath } from '../utils/mathRender';

// Hiển thị lộ trình ôn tập AI: các bước nối với nhau bằng 1 đường dọc, mỗi
// bước gồm "Lý thuyết cần nắm" / "Lỗi hay mắc phải" / "Hành động khắc phục".
// Dùng chung cho trang học sinh và phần xem trước của giáo viên.

const ICONS = {
  theory: (
    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
  ),
  mistake: (
    <>
      <path d="M10.3 3.9 2.2 18a2 2 0 0 0 1.7 3h16.2a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9.5v4.5M12 17.5h.01" />
    </>
  ),
  action: (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <path d="m8 12.3 2.7 2.7L16.2 9.5" />
    </>
  ),
};

function SectionIcon({ name }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ICONS[name]}
    </svg>
  );
}

function Section({ kind, label, content }) {
  if (!content) return null;
  return (
    <section className={`rm-block rm-${kind}`}>
      <div className="rm-label">
        <SectionIcon name={kind} />
        <span>{label}</span>
      </div>
      <div className="rm-body" dangerouslySetInnerHTML={{ __html: renderMath(content) }} />
    </section>
  );
}

export function RoadmapSummary({ text }) {
  if (!text) return null;
  return <div className="rm-summary" dangerouslySetInnerHTML={{ __html: renderMath(text) }} />;
}

export default function RoadmapSteps({ steps, labels = {} }) {
  if (!Array.isArray(steps) || steps.length === 0) return null;
  const l = {
    theory: 'Lý thuyết cần nắm',
    mistake: 'Lỗi hay mắc phải',
    action: 'Hành động khắc phục',
    ...labels,
  };

  return (
    <ol className="rm-steps">
      {steps.map((step, idx) => {
        const order = (step && typeof step === 'object' && step.order) || idx + 1;
        // Dữ liệu cũ: mỗi bước chỉ là 1 đoạn văn
        if (typeof step === 'string') {
          return (
            <li className="rm-step" key={idx}>
              <span className="rm-step-num" aria-hidden="true">{order}</span>
              <div className="rm-step-card">
                <div className="rm-body" dangerouslySetInnerHTML={{ __html: renderMath(step) }} />
              </div>
            </li>
          );
        }
        return (
          <li className="rm-step" key={`${order}-${idx}`}>
            <span className="rm-step-num" aria-hidden="true">{order}</span>
            <div className="rm-step-card">
              <h3 className="rm-step-title">
                <span className="rm-visually-hidden">Bước {order}: </span>
                {step.tag || step.title || 'Chủ đề ôn tập'}
              </h3>
              <Section kind="theory" label={l.theory} content={step.theory} />
              <Section kind="mistake" label={l.mistake} content={step.commonMistake} />
              <Section kind="action" label={l.action} content={step.action} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
