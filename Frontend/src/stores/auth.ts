import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

const TOKEN_KEY = 'sige_token';

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(sessionStorage.getItem(TOKEN_KEY));

  const isAuthenticated = computed(() => token.value !== null);

  function setToken(value: string | null) {
    token.value = value;
    if (value) sessionStorage.setItem(TOKEN_KEY, value);
    else sessionStorage.removeItem(TOKEN_KEY);
  }

  function logout() {
    setToken(null);
  }

  return { token, isAuthenticated, setToken, logout };
});
