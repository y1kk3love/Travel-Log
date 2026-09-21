const TABS = ['planner', 'checklist', 'reservations', 'expenses'];

export function parseHash(hash) {
  const parts = String(hash || '').replace(/^#/, '').split('/').filter(Boolean);
  if (parts[0] === 'trip' && parts[1]) {
    const tab = TABS.includes(parts[2]) ? parts[2] : 'planner';
    const route = { name: 'trip', tripId: parts[1], tab };
    if (tab === 'planner' && parts[2] === 'planner' && parts[3]) route.placeId = parts[3];
    return route;
  }
  return { name: 'trips' };
}

export function navigate(path) {
  window.location.hash = path.startsWith('#') ? path : `#${path}`;
}

export function startRouter(views, container) {
  let cleanup = null;
  const run = () => {
    if (cleanup) cleanup();
    cleanup = null;
    while (container.firstChild) container.removeChild(container.firstChild);
    const route = parseHash(window.location.hash);
    window.scrollTo(0, 0);
    cleanup = views[route.name].render(container, route) || null;
  };
  window.addEventListener('hashchange', run);
  run();
  return () => {
    window.removeEventListener('hashchange', run);
    if (cleanup) cleanup();
  };
}
