import { mount } from 'svelte';
import '@/lib/ui/tokens.css';
import '@/lib/ui/page.css';
import App from './App.svelte';

const target = document.getElementById('app');
if (target) mount(App, { target });
