import { Icon } from './Icon';

export function AnswerStars() {
  return <div className="answer-stars" aria-hidden="true" data-testid="answer-stars">
    <div className="star-reward-card">
      <span className="reward-caption">ทำได้แล้ว!</span>
      <span className="celebration-star"><Icon name="star" size={104}/></span>
      <strong>ได้ 1 ดาว</strong>
      <span className="reward-small">อีกหนึ่งก้าวเล็ก ๆ ของเรา</span>
    </div>
  </div>;
}
