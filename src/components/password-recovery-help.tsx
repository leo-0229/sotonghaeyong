export function PasswordRecoveryHelp(){
 return <details className="auth-note" style={{display:'block',textAlign:'left'}}>
  <summary>아이디·비밀번호를 잊었나요?</summary>
  <ol style={{paddingLeft:20,marginTop:12}}>
   <li>학교의 L5 담당자에게 계정 분실을 알려 주세요. 기존 비밀번호를 보내지 마세요.</li>
   <li>담당자가 본인임을 확인한 뒤 새 임시 아이디와 비밀번호를 개별 전달합니다.</li>
   <li>새 임시 정보로 로그인하고 아이디·비밀번호를 다시 설정하세요.</li>
  </ol>
  <p>글과 활동 기록은 유지되고 기존 로그인 정보와 세션은 사용할 수 없게 됩니다. 이름·학번만 입력해 누구나 초기화하는 방식은 제공하지 않습니다.</p>
 </details>;
}
