<script setup lang="ts">
import { useRouter } from 'vue-router';
import Breadcrumb from 'primevue/breadcrumb';
import Button from 'primevue/button';
import Toast from 'primevue/toast';
import { useAuthStore } from '@/stores/auth';
import { useBreadcrumbStore } from '@/stores/breadcrumb';

const auth = useAuthStore();
const breadcrumb = useBreadcrumbStore();
const router = useRouter();

function handleLogout() {
  auth.logout();
  router.push({ name: 'login' });
}
</script>

<template>
  <div class="app-shell">
    <Toast />

    <header class="app-header">
      <div class="brand">
        <div class="brand-mark">IPN</div>
        <div class="brand-text">
          <div class="brand-title">Sistema Gestión IPN</div>
          <div class="brand-subtitle">Gestión de ciclos escolares</div>
        </div>
      </div>
      <Button label="Salir" severity="secondary" outlined size="small" @click="handleLogout" />
    </header>

    <nav v-if="breadcrumb.items.length" class="app-breadcrumb">
      <Breadcrumb :model="breadcrumb.items" />
    </nav>

    <main class="page-shell">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  border-bottom: 1px solid var(--p-content-border-color);
  padding: 1.1rem 2rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.brand-mark {
  flex: 0 0 auto;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: var(--p-primary-color);
  color: var(--p-primary-contrast-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 0.8rem;
  letter-spacing: 0.02em;
}

.brand-title {
  font-weight: 700;
  font-size: 1rem;
  color: var(--p-text-color);
}

.brand-subtitle {
  margin-top: 0.1rem;
  font-size: 0.82rem;
  color: var(--p-text-muted-color);
}

.app-breadcrumb {
  max-width: 960px;
  margin: 1.25rem auto 0;
  padding: 0 2rem;
  width: 100%;
  box-sizing: border-box;
}

.page-shell {
  flex: 1;
}

@media (max-width: 768px) {
  .app-header {
    padding: 0.85rem 1.25rem;
  }

  .app-breadcrumb {
    padding: 0 1.25rem;
  }
}
</style>
