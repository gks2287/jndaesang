import type {
  GeneratedNewsletter,
  GeneratedInteraction,
  GeneratedSurvey,
  AlwaysSurveyQuestion,
  InteractionTypeKey,
  SurveyTypeKey,
} from '@/components/newsletter/NewsletterRender';

// 세로 슬라이드 (A4 Portrait)
const W = 7.5;
const H = 10;

const C = {
  blue:      '2B9EE8',
  darkBlue:  '1E3A5F',
  lightBlue: 'EAF4FC',
  green:     '10B981',
  lightGreen:'F0FDF4',
  textDark:  '2C2C2C',
  textGray:  '6B7280',
  border:    'E1EFFB',
  bg:        'F0F7FF',
  white:     'FFFFFF',
};

function headerBar(slide: ReturnType<InstanceType<typeof import('pptxgenjs')['default']>['addSlide']>, vol: number, companyName: string, pptx: InstanceType<typeof import('pptxgenjs')['default']>) {
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: W, h: 0.72, fill: { color: C.darkBlue }, line: { color: C.darkBlue } });
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.1, h: 0.72, fill: { color: C.blue }, line: { color: C.blue } });
  slide.addText(`J&Company  ·  Vol.${vol}`, { x: 0.25, y: 0, w: 5, h: 0.72, fontSize: 11, bold: true, color: C.white, valign: 'middle' });
  slide.addText(companyName, { x: W - 2.0, y: 0, w: 1.8, h: 0.72, fontSize: 10, color: C.white, transparency: 25, valign: 'middle', align: 'right' });
}

function footerBar(slide: ReturnType<InstanceType<typeof import('pptxgenjs')['default']>['addSlide']>, text: string, pptx: InstanceType<typeof import('pptxgenjs')['default']>) {
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: H - 0.42, w: W, h: 0.42, fill: { color: C.darkBlue }, line: { color: C.darkBlue } });
  slide.addText(text, { x: 0.3, y: H - 0.42, w: W - 0.6, h: 0.42, fontSize: 9, color: C.white, transparency: 30, valign: 'middle' });
}

export async function downloadNewsletterPPT(
  newsletter: GeneratedNewsletter,
  meta: {
    vol: number;
    companyName: string;
    dateLabel?: string;
    interactions?: InteractionTypeKey[];   // 선택된 인터랙션 타입
    surveys?: SurveyTypeKey[];             // 선택된 만족도 타입
  }
) {
  const PptxGenJS = (await import('pptxgenjs')).default;
  const pptx = new PptxGenJS();

  pptx.defineLayout({ name: 'PORTRAIT', width: W, height: H });
  pptx.layout = 'PORTRAIT';
  pptx.author = 'J&Company';
  pptx.subject = newsletter.subject;

  // ────────────────────────────────────────────────────────
  // 슬라이드 1: 본문
  // ────────────────────────────────────────────────────────
  const s1 = pptx.addSlide();
  s1.background = { color: C.white };
  headerBar(s1, meta.vol, meta.companyName, pptx);

  let y = 0.85;
  const PAD = 0.3;
  const IW = W - PAD * 2;   // 내용 너비
  const FOOTER_Y = H - 0.45;

  // Subject 레이블
  if (newsletter.subject) {
    s1.addText(newsletter.subject, {
      x: PAD, y, w: IW, h: 0.28,
      fontSize: 9, bold: true, color: C.blue, transparency: 10,
    });
    y += 0.42;
  }

  // Headline
  s1.addText(newsletter.headline, {
    x: PAD, y, w: IW, h: 0.9,
    fontSize: 17, bold: true, color: C.textDark,
    wrap: true, lineSpacingMultiple: 1.2,
  });
  y += 1.08;

  // Intro
  s1.addText(newsletter.intro, {
    x: PAD, y, w: IW, h: 0.6,
    fontSize: 9.5, color: C.textGray,
    wrap: true, lineSpacingMultiple: 1.4,
  });
  y += 0.82;

  // 구분선 + 섹션 헤더
  s1.addShape(pptx.ShapeType.rect, { x: PAD, y, w: IW, h: 0.015, fill: { color: 'E5E7EB' }, line: { color: 'E5E7EB' } });
  y += 0.1;
  s1.addShape(pptx.ShapeType.rect, { x: PAD, y, w: 0.06, h: 0.32, fill: { color: C.blue }, line: { color: C.blue } });
  s1.addText('📖  오늘의 이야기', { x: PAD + 0.12, y: y + 0.02, w: IW - 0.12, h: 0.28, fontSize: 11, bold: true, color: C.textDark });
  y += 0.52;

  // 각 콘텐츠 섹션
  newsletter.sections.forEach((sec, idx) => {
    if (y >= FOOTER_Y - 0.5) return;

    // 섹션 구분 점선 (두 번째 이상)
    if (idx > 0) {
      s1.addShape(pptx.ShapeType.rect, { x: PAD + 0.5, y, w: IW - 1, h: 0.01, fill: { color: 'D1D5DB' }, line: { color: 'D1D5DB' } });
      y += 0.26;
    }

    // 섹션 제목
    const titleH = 0.34;
    s1.addShape(pptx.ShapeType.rect, { x: PAD, y, w: 0.04, h: titleH, fill: { color: C.blue }, line: { color: C.blue } });
    s1.addText(`${sec.emoji}  ${sec.contentTitle}`, {
      x: PAD + 0.1, y, w: IW - 0.1, h: titleH,
      fontSize: 12, bold: true, color: C.textDark,
    });
    y += titleH + 0.16;

    // 부제
    if (sec.subtitle && y < FOOTER_Y) {
      s1.addText(sec.subtitle, { x: PAD + 0.1, y, w: IW - 0.1, h: 0.24, fontSize: 9, color: C.blue, italic: true });
      y += 0.38;
    }

    // 도입
    if (sec.intro && y < FOOTER_Y) {
      s1.addText(sec.intro, { x: PAD + 0.1, y, w: IW - 0.1, h: 0.36, fontSize: 9, color: C.textGray, wrap: true, lineSpacingMultiple: 1.35 });
      y += 0.54;
    }

    // 본문 단락
    const bodyParas = (sec.body && sec.body.length > 0) ? sec.body : [sec.mainBody].filter(Boolean) as string[];
    bodyParas.slice(0, 2).forEach(para => {
      if (!para || y >= FOOTER_Y) return;
      s1.addText(para, { x: PAD + 0.1, y, w: IW - 0.1, h: 0.44, fontSize: 9, color: C.textDark, wrap: true, lineSpacingMultiple: 1.4 });
      y += 0.62;
    });

    // 인용구
    if (sec.quote && y < FOOTER_Y) {
      s1.addShape(pptx.ShapeType.rect, { x: PAD + 0.1, y, w: IW - 0.1, h: 0.36, fill: { color: C.lightBlue }, line: { color: C.border, width: 0.5 } });
      s1.addShape(pptx.ShapeType.rect, { x: PAD + 0.1, y, w: 0.06, h: 0.36, fill: { color: C.blue }, line: { color: C.blue } });
      s1.addText(`"${sec.quote}"`, { x: PAD + 0.22, y: y + 0.06, w: IW - 0.32, h: 0.26, fontSize: 9, color: C.darkBlue, italic: true });
      y += 0.56;
    }

    // 데이터 박스
    if (sec.dataStat?.value && y < FOOTER_Y) {
      s1.addShape(pptx.ShapeType.rect, { x: PAD + 0.1, y, w: IW - 0.1, h: 0.38, fill: { color: C.bg }, line: { color: C.border, width: 0.5 } });
      s1.addText(`📊 ${sec.dataStat.value}`, { x: PAD + 0.2, y: y + 0.06, w: 2.0, h: 0.28, fontSize: 12, bold: true, color: C.blue });
      if (sec.dataStat.description) {
        s1.addText(sec.dataStat.description, { x: PAD + 2.4, y: y + 0.08, w: IW - 2.4, h: 0.24, fontSize: 9, color: C.textGray, wrap: true });
      }
      y += 0.58;
    }

    // 핵심 포인트 (없는 섹션은 생략)
    if (y < FOOTER_Y && sec.keyTakeaway && sec.keyTakeaway.trim()) {
      s1.addShape(pptx.ShapeType.rect, { x: PAD + 0.1, y, w: IW - 0.1, h: 0.4, fill: { color: C.lightGreen }, line: { color: '86EFAC', width: 0.5 } });
      s1.addShape(pptx.ShapeType.rect, { x: PAD + 0.1, y, w: 0.06, h: 0.4, fill: { color: C.green }, line: { color: C.green } });
      s1.addText(`💡  ${sec.keyTakeaway}`, { x: PAD + 0.22, y: y + 0.08, w: IW - 0.32, h: 0.28, fontSize: 9.5, bold: true, color: '065F46', wrap: true });
      y += 0.58;
    }

    y += 0.18;
  });

  // Closing
  if (newsletter.closing && y < FOOTER_Y - 0.2) {
    s1.addShape(pptx.ShapeType.rect, { x: PAD, y, w: IW, h: 0.01, fill: { color: 'E5E7EB' }, line: { color: 'E5E7EB' } });
    y += 0.1;
    s1.addText(newsletter.closing, {
      x: PAD, y, w: IW, h: 0.36,
      fontSize: 9, color: C.textGray, italic: true, wrap: true,
    });
  }

  footerBar(s1, `J&Company 코칭팀${meta.dateLabel ? '  ·  ' + meta.dateLabel : ''}`, pptx);

  // ────────────────────────────────────────────────────────
  // 슬라이드 2: 퀴즈 + 투두(Action Plan) + 상시만족도 설문
  // ────────────────────────────────────────────────────────
  const s2 = pptx.addSlide();
  s2.background = { color: C.white };
  headerBar(s2, meta.vol, meta.companyName, pptx);

  let y2 = 0.85;

  // ── 퀴즈 ──
  const quizIA: GeneratedInteraction | undefined = newsletter.interactions.find(ia => ia.type === 'quiz');
  const hasQuiz = !!quizIA || (meta.interactions ?? []).includes('quiz');

  if (hasQuiz) {
    // 섹션 헤더
    s2.addShape(pptx.ShapeType.rect, { x: PAD, y: y2, w: 0.06, h: 0.32, fill: { color: C.blue }, line: { color: C.blue } });
    s2.addText('🎯  함께 생각해봐요', { x: PAD + 0.12, y: y2 + 0.02, w: IW - 0.12, h: 0.28, fontSize: 11, bold: true, color: C.textDark });
    y2 += 0.54;

    if (quizIA) {
      const c = quizIA.content as { question: string; options: string[]; answer: number };
      s2.addShape(pptx.ShapeType.rect, { x: PAD, y: y2, w: IW, h: 0.34, fill: { color: C.bg }, line: { color: C.border, width: 0.5 } });
      s2.addText(`🧠  ${quizIA.title}`, { x: PAD + 0.15, y: y2 + 0.07, w: IW - 0.3, h: 0.22, fontSize: 10.5, bold: true, color: C.textDark });
      y2 += 0.5;

      s2.addText(c.question ?? '', { x: PAD, y: y2, w: IW, h: 0.32, fontSize: 9.5, color: C.textGray, wrap: true });
      y2 += 0.48;

      (c.options ?? []).forEach((opt, i) => {
        if (y2 >= FOOTER_Y) return;
        s2.addShape(pptx.ShapeType.rect, { x: PAD, y: y2, w: IW, h: 0.36, fill: { color: C.white }, line: { color: C.border, width: 0.5 } });
        s2.addShape(pptx.ShapeType.ellipse, { x: PAD + 0.12, y: y2 + 0.1, w: 0.17, h: 0.17, fill: { color: C.white }, line: { color: 'D1D5DB', width: 1 } });
        s2.addText(opt, { x: PAD + 0.38, y: y2 + 0.09, w: IW - 0.5, h: 0.2, fontSize: 9.5, color: C.textDark });
        y2 += 0.44;
      });
      y2 += 0.2;
    } else {
      // 템플릿 예시
      s2.addShape(pptx.ShapeType.rect, { x: PAD, y: y2, w: IW, h: 0.34, fill: { color: C.bg }, line: { color: C.border, width: 0.5 } });
      s2.addText('🧠  학습 내용 확인 퀴즈', { x: PAD + 0.15, y: y2 + 0.07, w: IW - 0.3, h: 0.22, fontSize: 10.5, bold: true, color: C.textDark });
      y2 += 0.5;
      s2.addText('이번 회차의 핵심 내용을 가장 잘 설명한 것은 무엇일까요?', { x: PAD, y: y2, w: IW, h: 0.28, fontSize: 9.5, color: C.textGray });
      y2 += 0.44;
      ['선택지 A', '선택지 B', '선택지 C'].forEach(opt => {
        s2.addShape(pptx.ShapeType.rect, { x: PAD, y: y2, w: IW, h: 0.36, fill: { color: C.white }, line: { color: C.border, width: 0.5 } });
        s2.addShape(pptx.ShapeType.ellipse, { x: PAD + 0.12, y: y2 + 0.1, w: 0.16, h: 0.16, fill: { color: C.white }, line: { color: 'D1D5DB', width: 1 } });
        s2.addText(opt, { x: PAD + 0.36, y: y2 + 0.09, w: IW - 0.5, h: 0.2, fontSize: 9.5, color: C.textDark });
        y2 += 0.44;
      });
      y2 += 0.18;
    }
  }

  // ── 투두 (Action Plan 통합) ──
  const allActions = newsletter.sections.flatMap(sec => sec.actionPlan ?? []).filter(Boolean);
  if (allActions.length > 0 && y2 < FOOTER_Y - 0.4) {
    s2.addShape(pptx.ShapeType.rect, { x: PAD, y: y2, w: IW, h: 0.01, fill: { color: 'E5E7EB' }, line: { color: 'E5E7EB' } });
    y2 += 0.18;

    s2.addShape(pptx.ShapeType.rect, { x: PAD, y: y2, w: 0.06, h: 0.32, fill: { color: C.green }, line: { color: C.green } });
    s2.addText('✅  Action Plan — 오늘부터 실천해요', { x: PAD + 0.12, y: y2 + 0.02, w: IW - 0.12, h: 0.28, fontSize: 11, bold: true, color: C.textDark });
    y2 += 0.54;

    allActions.slice(0, 6).forEach((item, i) => {
      if (y2 >= FOOTER_Y - 0.1) return;
      s2.addShape(pptx.ShapeType.rect, { x: PAD, y: y2, w: IW, h: 0.36, fill: { color: C.lightGreen }, line: { color: '86EFAC', width: 0.5 } });
      s2.addShape(pptx.ShapeType.rect, { x: PAD + 0.12, y: y2 + 0.1, w: 0.16, h: 0.16, fill: { color: C.white }, line: { color: C.green, width: 1.5 } });
      s2.addText(item, { x: PAD + 0.38, y: y2 + 0.09, w: IW - 0.52, h: 0.2, fontSize: 9.5, color: '065F46' });
      y2 += 0.44;
    });
    y2 += 0.2;
  }

  // ── 상시 만족도 설문 ──
  const alwaysSurvey: GeneratedSurvey | undefined = newsletter.surveys.find(s => s.type === 'always');
  const hasAlways = !!alwaysSurvey || (meta.surveys ?? []).includes('always');

  if (hasAlways && y2 < FOOTER_Y - 0.4) {
    s2.addShape(pptx.ShapeType.rect, { x: PAD, y: y2, w: IW, h: 0.01, fill: { color: 'E5E7EB' }, line: { color: 'E5E7EB' } });
    y2 += 0.18;

    s2.addShape(pptx.ShapeType.rect, { x: PAD, y: y2, w: 0.06, h: 0.32, fill: { color: C.blue }, line: { color: C.blue } });
    s2.addText('💬  의견 들려주세요', { x: PAD + 0.12, y: y2 + 0.02, w: IW - 0.12, h: 0.28, fontSize: 11, bold: true, color: C.textDark });
    y2 += 0.54;

    s2.addShape(pptx.ShapeType.rect, { x: PAD, y: y2, w: IW, h: 0.36, fill: { color: C.bg }, line: { color: C.border, width: 0.5 } });
    s2.addText('이번 호 어떠셨나요?', { x: PAD + 0.15, y: y2 + 0.09, w: IW - 0.3, h: 0.2, fontSize: 10.5, bold: true, color: C.textDark });
    y2 += 0.5;

    const emojiOpts = alwaysSurvey
      ? ((alwaysSurvey.questions[0] as AlwaysSurveyQuestion)?.options ?? ['아쉬워요', '괜찮아요', '최고예요'])
      : ['아쉬워요', '괜찮아요', '최고예요'];
    const emojis = ['😐', '😊', '🤩'];
    const btnW = (IW - 0.1) / emojiOpts.length;
    emojiOpts.forEach((opt, i) => {
      if (y2 >= FOOTER_Y) return;
      s2.addShape(pptx.ShapeType.rect, { x: PAD + i * (btnW + 0.05), y: y2, w: btnW, h: 0.58, fill: { color: C.white }, line: { color: C.border, width: 0.5 } });
      s2.addText(emojis[i] ?? '⭐', { x: PAD + i * (btnW + 0.05), y: y2 + 0.04, w: btnW, h: 0.32, fontSize: 14, align: 'center' });
      s2.addText(String(opt), { x: PAD + i * (btnW + 0.05), y: y2 + 0.36, w: btnW, h: 0.2, fontSize: 8.5, color: C.textGray, align: 'center' });
    });
    y2 += 0.74;

    // 팔로업 + 오픈 텍스트
    if (alwaysSurvey) {
      const q = alwaysSurvey.questions[0] as AlwaysSurveyQuestion;
      if (q?.followUp && y2 < FOOTER_Y) {
        s2.addText(q.followUp, { x: PAD, y: y2, w: IW, h: 0.28, fontSize: 9.5, bold: true, color: C.textDark });
        y2 += 0.4;
        (q.followUpOptions ?? []).slice(0, 3).forEach(opt => {
          if (y2 >= FOOTER_Y) return;
          s2.addShape(pptx.ShapeType.rect, { x: PAD + 0.1, y: y2 + 0.05, w: 0.15, h: 0.15, fill: { color: C.white }, line: { color: C.border, width: 1 } });
          s2.addText(String(opt), { x: PAD + 0.32, y: y2 + 0.04, w: IW - 0.42, h: 0.2, fontSize: 9, color: C.textDark });
          y2 += 0.34;
        });
        y2 += 0.12;
      }
      if (q?.openQuestion && y2 < FOOTER_Y) {
        s2.addText(q.openQuestion, { x: PAD, y: y2, w: IW, h: 0.28, fontSize: 9.5, bold: true, color: C.textDark });
        y2 += 0.38;
      }
    } else {
      if (y2 < FOOTER_Y) {
        s2.addText('도움이 된 콘텐츠가 있었나요?', { x: PAD, y: y2, w: IW, h: 0.28, fontSize: 9.5, bold: true, color: C.textDark });
        y2 += 0.4;
        ['본문 콘텐츠', '인터랙션', '특별히 없음'].forEach(opt => {
          if (y2 >= FOOTER_Y) return;
          s2.addShape(pptx.ShapeType.rect, { x: PAD + 0.1, y: y2 + 0.05, w: 0.15, h: 0.15, fill: { color: C.white }, line: { color: C.border, width: 1 } });
          s2.addText(opt, { x: PAD + 0.32, y: y2 + 0.04, w: IW - 0.42, h: 0.2, fontSize: 9, color: C.textDark });
          y2 += 0.34;
        });
        y2 += 0.12;
      }
    }

    // 한 줄 의견 입력창
    if (y2 < FOOTER_Y - 0.3) {
      s2.addShape(pptx.ShapeType.rect, { x: PAD, y: y2, w: IW, h: 0.44, fill: { color: C.white }, line: { color: C.border, width: 0.5 } });
      s2.addText('답변을 입력해 주세요...', { x: PAD + 0.15, y: y2 + 0.12, w: IW - 0.3, h: 0.24, fontSize: 9, color: 'D1D5DB' });
      y2 += 0.5;
    }
  }

  // Closing text (same as slide 1, italic gray)
  if (newsletter.closing && y2 < FOOTER_Y - 0.28) {
    s2.addShape(pptx.ShapeType.rect, { x: PAD, y: y2, w: IW, h: 0.01, fill: { color: 'E5E7EB' }, line: { color: 'E5E7EB' } });
    y2 += 0.1;
    s2.addText(newsletter.closing, {
      x: PAD, y: y2, w: IW, h: 0.36,
      fontSize: 9, color: C.textGray, italic: true, wrap: true,
    });
  }

  footerBar(s2, `J&Company 코칭팀${meta.dateLabel ? '  ·  ' + meta.dateLabel : ''}`, pptx);

  const fileName = `JCompany_뉴스레터_Vol${meta.vol}_${meta.companyName}.pptx`;
  await pptx.writeFile({ fileName });
}
