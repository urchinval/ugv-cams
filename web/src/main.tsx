import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'react-grid-layout/css/styles.css';
import './styles/base.css';
import './styles/toolbar.css';
import './styles/grid.css';
import './styles/tile.css';
import './styles/dialog.css';
import './styles/editor.css';
import { App } from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
