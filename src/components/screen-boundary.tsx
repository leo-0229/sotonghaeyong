'use client';

import {Component,type ReactNode} from 'react';
import {Button} from './ui/button';

// Keep navigation and logout available when a single screen fails. Never log school content.
export class ScreenBoundary extends Component<{children:ReactNode},{failed:boolean}>{
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){
    if(this.state.failed)return <section className="panel access-denied" role="alert"><h1>화면을 표시하지 못했어요</h1><p>다시 시도해 주세요. 계속되면 담당자에게 이용 중이던 메뉴를 알려 주세요.</p><Button onClick={()=>this.setState({failed:false})}>화면 다시 열기</Button></section>;
    return this.props.children;
  }
}
