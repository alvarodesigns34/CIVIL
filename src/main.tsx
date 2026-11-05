import { render } from 'preact';
import '@fontsource-variable/fraunces';
import '@fontsource/alegreya-sans/400.css';
import '@fontsource/alegreya-sans/500.css';
import '@fontsource/alegreya-sans/700.css';
import './ui/style.css';
import { App } from './ui/App';

render(<App />, document.getElementById('app')!);
