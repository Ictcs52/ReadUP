import type { CSSProperties } from 'react';
import { Icon } from './Icon';

export function AnswerStars() {
  const positions = [
    { x: -83, y: -12, delay: 0.03 },
    { x: -43, y: -43, delay: 0.07 },
    { x: 0, y: -60, delay: 0 },
    { x: 43, y: -43, delay: 0.07 },
    { x: 83, y: -12, delay: 0.03 }
  ];
  return <div className="answer-stars" aria-hidden="true" data-testid="answer-stars">
    {positions.map((position, i) => <span className="celebration-star" key={i} style={{ '--dx': `${position.x}px`, '--dy': `${position.y}px`, '--delay': `${position.delay}s` } as CSSProperties}><Icon name="star" size={29}/></span>)}
  </div>;
}
