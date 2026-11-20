import { createRoot } from 'react-dom/client';
import './i18n';
import { App } from './App';
import { warmVoices } from './audio';
import '@lernlab/ui/tokens.css';
import './styles.css';

warmVoices();
createRoot(document.getElementById('root')!).render(<App />);
