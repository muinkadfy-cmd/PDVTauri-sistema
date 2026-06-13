import '@testing-library/jest-dom/vitest';

// matchMedia é usado por alguns componentes/estilos responsivos
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {}, // deprecated
    removeListener: () => {}, // deprecated
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Evita erro quando algum código tenta usar scrollTo em JSDOM
window.scrollTo = window.scrollTo || (() => {});
