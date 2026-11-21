import { createRoot } from 'react-dom/client';
import './i18n';
import { App } from './App';
import { DataStatus } from './DataStatus';
import { warmVoices } from './audio';
import '@lernlab/ui/fonts.css';
import '@lernlab/ui/tokens.css';
import 'katex/dist/katex.min.css'; // math on cards: styles and fonts bundled, nothing from the network
import './styles.css';

warmVoices();
createRoot(document.getElementById('root')!).render(
  <>
    <App />
    <DataStatus />
  </>,
);
