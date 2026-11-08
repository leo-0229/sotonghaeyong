import type { AppState, ClassTask, Post } from './domain';

const day = (d: number) => `2026-11-${String(d).padStart(2, '0')}T09:00:00+09:00`;
export const DEMO_CLASSES = Array.from({ length: 18 }, (_, i) => `${Math.floor(i / 6) + 1}-${i % 6 + 1}`);
const entries = [
  ['notice', '소통해용 이용 안내 및 게시판 운영 규칙', '모든 게시글과 댓글은 운영진 승인 후 공개됩니다. 서로의 의견을 존중하고 개인정보가 담긴 글은 작성하지 말아 주세요. 이 화면에 보이는 회원과 학교 일정은 초안 확인을 위한 가상 자료입니다.', '학생회', true],
  ['council', '2026 문산제 학급 부스 운영 신청 안내', '문산제 학급 부스 운영 계획을 받습니다. 학급 대표는 학급 대표 업무 메뉴에서 운영 계획과 필요 물품을 제출해 주세요. 가상 행사로 실제 학교 일정과 관계없습니다.', '학생회 문화부', true],
  ['notice', '11월 학생 자치 회의 일정 및 안건 안내', '이번 달 학생 자치 회의에서는 학교 시설 개선과 축제 운영에 대해 논의합니다. 각 학급의 의견을 취합해 학급 대표 업무로 제출해 주세요.', '학생회', true],
  ['free', '이번 문산제에 어떤 부스가 있으면 좋을까요?', '우리 반에서 축제 부스를 고민하고 있어요. 보드게임 카페나 작은 사진관을 생각 중인데 여러분은 어떤 부스에 가고 싶나요?', '김하준', false],
  ['info', '도서관에서 빌릴 수 있는 추천 도서 모음', '친구들과 함께 읽기 좋은 책들을 모아봤어요. 소설부터 과학 교양서까지 다양하게 골랐으니 도서관에서 한번 찾아보세요.', '이서연', false],
  ['question', '점심시간에 체육관 이용할 수 있나요?', '점심시간에 친구들과 배드민턴을 하고 싶은데 체육관 개방 시간이 따로 있는지 궁금해요. 알고 있는 친구가 있다면 알려 주세요!', '박지우', false],
  ['report', '10월 학생회 정기 회의 결과를 공유합니다', '지난 회의에서는 학생 건의사항과 공약 추진 상황을 확인했습니다. 우산 대여함 설치와 도서관 자율 학습 공간에 대한 논의를 진행했습니다.', '학생회', false],
  ['free', '학교에서 발견한 가을 🍂', '오늘 운동장 옆 나무가 정말 예쁘더라고요. 쉬는 시간에 잠깐 걸어 보세요. 친구들과 가을 풍경을 함께 즐기면 좋겠어요.', '최도윤', false],
  ['info', '수학 공부할 때 도움 되는 무료 자료 정리', '개념 복습과 문제 풀이를 꾸준히 할 수 있는 자료를 정리했어요. 교과서의 예제부터 차근차근 풀어보는 방법도 추천합니다.', '정유진', false],
  ['question', '멘토·멘티는 다른 학년끼리도 신청되나요?', '영어 공부 방법을 배우고 싶어서 멘티로 신청하려고 해요. 같은 학년이 아니어도 멘토링할 수 있는지 궁금합니다.', '김하준', false],
  ['free', '체육대회 응원곡 같이 골라봐요', '학급 응원 시간에 함께 부를 수 있는 신나는 노래를 찾고 있어요. 다 같이 따라 부르기 쉬운 노래를 추천해 주세요.', '이서연', false],
  ['info', '분리수거할 때 헷갈리는 것들 정리', '깨끗하게 씻은 플라스틱과 종이류를 나누어 버려주세요. 내용물이 묻은 쓰레기는 재활용이 어렵다고 합니다. 함께 쾌적한 학교를 만들어 봐요.', '환경부', false],
] as const;
const posts: Post[] = entries.map((e, i) => ({ id: `post-${i + 1}`, board: e[0], title: e[1], content: e[2], author: e[3], authorId: i < 3 || i === 6 ? 'executive' : 'seed-student', pinned: e[4], date: day(7 - Math.floor(i / 3)), views: 286 - i * 17, status: 'APPROVED', comments: i === 3 ? [{ id: 'comment-seed', authorId: 'seed-student', author: '이서연', content: '보드게임 카페 재밌을 것 같아요!', date: day(7), status: 'APPROVED' }] : [] }));
export const seedTasks: ClassTask[] = [
  { id: 'festival', title: '문산제 학급별 부스 운영 계획 제출', description: '학급 회의를 통해 정한 부스 운영 계획을 제출해 주세요. 부스의 내용, 활동 인원과 필요 물품을 구체적으로 적어 주시면 문화부에서 확인하겠습니다.', department: '문화부', type: '자료 제출', start: day(1), deadline: '2026-11-13T23:59:00+09:00', allowLate: false, closed: false, targets: DEMO_CLASSES, managerIds: ['officer'], fields: [{ id: 'name', label: '부스 이름', type: 'text', required: true }, { id: 'plan', label: '부스 운영 계획', type: 'textarea', required: true }, { id: 'count', label: '운영 참여 인원', type: 'number', required: true }, { id: 'materials', label: '필요 물품 및 요청사항', type: 'textarea', required: false }] },
  { id: 'opinion', title: '11월 학급 건의사항 취합', description: '학급 친구들의 의견을 듣고 학교에 전달할 건의사항을 정리해 주세요. 개인 이름이나 연락처는 적지 않아도 됩니다.', department: '생활안전부', type: '의견 제출', start: day(1), deadline: '2026-11-18T23:59:00+09:00', allowLate: false, closed: false, targets: DEMO_CLASSES, managerIds: ['officer'], fields: [{ id: 'category', label: '건의 분야', type: 'select', required: true, options: ['학교 시설', '학교 행사', '급식', '생활 환경', '기타'] }, { id: 'summary', label: '의견 요약', type: 'text', required: true }, { id: 'details', label: '구체적인 내용', type: 'textarea', required: true }] },
  { id: 'sports', title: '학급 체육활동 종목 선호도 조사', description: '학급 친구들이 함께하고 싶은 종목을 취합하여 제출해 주세요.', department: '체육부', type: '대표 설문', start: day(1), deadline: '2026-11-20T23:59:00+09:00', allowLate: false, closed: false, targets: DEMO_CLASSES, managerIds: [], fields: [{ id: 'sports', label: '선호 종목', type: 'multiselect', required: true, options: ['축구', '피구', '배드민턴', '줄다리기', '계주'] }, { id: 'opinion', label: '추가 의견', type: 'textarea', required: false }] },
];
export function createSeed(): AppState {
  return structuredClone({
    currentMemberId: null,
    members: [
      { id: 'student', name: '이서연', role: 'STUDENT', gender: 'FEMALE', classId: '2-3', status: 'ACTIVE' },
      { id: 'president', name: '김민서', role: 'CLASS_OFFICER', gender: 'FEMALE', classId: '2-3', position: 'CLASS_PRESIDENT', status: 'ACTIVE' },
      { id: 'vice', name: '박지우', role: 'CLASS_OFFICER', gender: 'FEMALE', classId: '2-3', position: 'CLASS_VICE_PRESIDENT', status: 'ACTIVE' },
      { id: 'officer', name: '최도윤', role: 'COUNCIL_OFFICER', gender: 'MALE', classId: '3-1', status: 'ACTIVE' },
      { id: 'executive', name: '정유진', role: 'COUNCIL_EXECUTIVE', gender: 'FEMALE', classId: '3-2', status: 'ACTIVE' },
      { id: 'pr', name: '김하준', role: 'PR_DIRECTOR', gender: 'MALE', classId: '3-3', status: 'ACTIVE' },
      { id: 'teacher', name: '담당 선생님', role: 'SUPERVISING_TEACHER', classId: '', status: 'ACTIVE' },
      { id: 'pending-student', name: '홍예은', role: 'STUDENT', classId: '1-2', status: 'PENDING' },
    ],
    posts: [...posts, { id: 'pending-post', board: 'free', title: '친구들과 함께하는 독서 모임을 만들고 싶어요', content: '점심시간에 함께 책을 읽고 이야기를 나누는 독서 모임을 만들고 싶어요. 관심 있는 친구들의 의견을 듣고 싶습니다.', authorId: 'student', author: '이서연', date: day(7), status: 'PENDING', views: 0, comments: [] }],
    tasks: seedTasks,
    submissions: DEMO_CLASSES.filter(c => c !== '2-3').slice(0, 14).map((classId, i) => ({ taskId: 'festival', classId, status: 'SUBMITTED', answers: { name: `우리 반 작은 놀이터 ${i + 1}`, plan: '학급 친구들과 함께 보드게임 및 퀴즈 부스를 운영합니다.', count: '12', materials: '책상 4개, 의자 8개' }, version: 1, submittedBy: 'seed-student', updatedBy: 'seed-student', updatedAt: day(6),  history: [] })),
    events: [
      { id: 'event-festival', title: '2026 문산제', description: '학급 부스와 동아리 공연이 함께하는 학교 축제. 각 학급의 아이디어를 기다립니다.', category: '학교 축제', date: '2026-11-27T09:00:00+09:00', deadline: '2026-11-13T23:59:00+09:00', place: '학교 운동장 · 강당', method: 'class', capacity: 18, taskId: 'festival', color: 'blue', applications: [] },
      { id: 'event-book', title: '가을 독서 나눔', description: '좋아하는 책 한 권을 소개하고 친구들과 함께 이야기를 나누어요.', category: '독서 활동', date: '2026-11-19T13:00:00+09:00', deadline: '2026-11-16T23:59:00+09:00', place: '학교 도서관', method: 'individual', capacity: 30, color: 'green', applications: ['student', 'officer'] },
      { id: 'event-clean', title: '우리 학교 플로깅', description: '교정을 걸으며 쓰레기를 줍는 작은 실천에 함께해 주세요.', category: '환경 활동', date: '2026-11-21T10:00:00+09:00', deadline: '2026-11-18T23:59:00+09:00', place: '교문 앞 집결', method: 'individual', capacity: 40, color: 'orange', applications: ['pr'] },
    ],
    suggestions: [{ id: 'suggestion-1', authorId: 'student', title: '도서관에 독서대를 추가하면 좋겠어요', category: '학교 시설', content: '점심시간에 도서관을 이용하는 친구들이 많아요. 독서대가 더 있으면 책을 읽을 때 편리할 것 같습니다.', status: '검토 중', assignedTo: 'officer', date: day(5) }],
    pledges: [{ id: 'p1', title: '우산 대여함 설치', department: '생활안전부', progress: 80, description: '설치 장소 협의 완료 · 대여 운영 규칙 준비 중', updated: day(6) }, { id: 'p2', title: '학생 의견을 반영한 학교 축제', department: '문화부', progress: 60, description: '학급 부스 의견 수렴 및 신청 진행 중', updated: day(7) }, { id: 'p3', title: '도서관 자율 학습 공간 개선', department: '학습부', progress: 100, description: '좌석 배치 조정 및 이용 안내 완료', updated: day(3) }],
    surveys: [{ id: 'survey-1', title: '문산제에서 가장 기대되는 프로그램은?', description: '여러분의 의견을 축제 기획에 반영할게요. 한 가지를 골라 주세요.', deadline: '2026-11-15T23:59:00+09:00', options: ['학급 체험 부스', '동아리 공연', '학생 장기자랑', '체육 프로그램'], responses: { student: '학급 체험 부스', officer: '동아리 공연', executive: '학급 체험 부스' } }],
    mentoring: [], notifications: [{ id: 'n1', recipientId: 'president', title: '문산제 부스 운영 계획 제출 요청이 도착했어요.', href: '/class-tasks/festival', read: false, date: day(7) }, { id: 'n2', recipientId: 'president', title: '11월 학급 건의사항을 취합해 주세요.', href: '/class-tasks/opinion', read: false, date: day(6) }], logs: [], reports: [],
  });
}
