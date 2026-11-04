/**
 * Punto de arranque de React: monta App en el elemento raíz del HTML e importa los
 * estilos globales.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
