import React from 'react';
import ReactDOM from 'react-dom/client';
import QieDexOptimizer from './qie_dex_optimizer';

function App() {
  return <QieDexOptimizer />;
}

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
