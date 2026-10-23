import '@fontsource-variable/inter';
import './styles/tokens.css';
import './styles/global.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter } from 'react-router';

import { AppProviders } from './app/AppProviders';
import { routes } from './app/routes';

const router = createBrowserRouter(routes);

const container = document.getElementById('root');
if (!container) {
  throw new Error('index.html has no #root element');
}

createRoot(container).render(
  <StrictMode>
    <AppProviders router={router} />
  </StrictMode>,
);
