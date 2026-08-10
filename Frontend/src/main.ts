import { createApp } from 'vue';
import { createPinia } from 'pinia';
import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';

import App from './App.vue';
import router from './router';
import { themeOptions } from './theme';

import 'primeicons/primeicons.css';
import './styles/main.css';

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.use(PrimeVue, { theme: themeOptions });
app.use(ToastService);

app.mount('#app');
