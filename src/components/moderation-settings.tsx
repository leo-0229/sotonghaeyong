'use client';
import {isTeacher} from '@/lib/domain';
import {AccessDenied,PageHeading} from './shared';
import {useDemo} from './demo-provider';
export function ModerationSettings(){
 const {member}=useDemo();if(!isTeacher(member))return <AccessDenied/>;
 return <><PageHeading eyebrow="교사 관리" title="게시글 검토 안내" description="규칙과 AI가 모두 안전하다고 확인하면 자동 공개하며, AI 미연결 시 검토 대기로 저장됩니다."/><section className="panel form-panel"><h2>검토 보조 기준</h2><p>욕설·혐오·성적 표현과 변형 표기, 외부 링크를 확인합니다. 짧은 초성 줄임말과 반복 웃음·울음 표현은 폭넓게 허용합니다.</p><p>교사명 검사는 현재 사용하지 않으며 성함 명단을 입력받지 않습니다.</p><p>검사 결과는 참고 자료입니다. 일반 단어의 문맥이나 새 우회 표현은 운영진이 직접 확인합니다. 수정한 글도 같은 검토 절차를 다시 거칩니다.</p></section></>;
}
