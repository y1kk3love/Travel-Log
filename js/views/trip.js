import { el } from '../ui.js';
import { topbar } from './topbar.js';

export function render(container, route) {
  container.append(topbar({ backHref: '#/' }),
    el('main', { class: 'container' }, el('h1', { text: `여행 ${route.tripId}` }), el('p', { class: 'muted', text: '일정 화면은 다음 단계에서 붙어요' })));
}
