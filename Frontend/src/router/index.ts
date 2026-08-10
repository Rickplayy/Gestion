import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { public: true },
    },
    {
      path: '/',
      component: () => import('@/layouts/DefaultLayout.vue'),
      children: [
        { path: '', redirect: { name: 'ciclos' } },
        {
          path: 'ciclos',
          name: 'ciclos',
          component: () => import('@/views/CiclosView.vue'),
        },
        {
          path: 'ciclos/nuevo',
          name: 'wizard',
          component: () => import('@/views/WizardView.vue'),
        },
        {
          path: 'ciclos/:termId/carreras',
          name: 'carreras',
          component: () => import('@/views/CarrerasView.vue'),
          props: (route) => ({ termId: Number(route.params.termId) }),
        },
        {
          path: 'ciclos/:termId/carreras/:carreraId/grupos',
          name: 'grupos',
          component: () => import('@/views/GruposView.vue'),
          props: (route) => ({
            termId: Number(route.params.termId),
            carreraId: Number(route.params.carreraId),
          }),
        },
        {
          path: 'ciclos/:termId/carreras/:carreraId/grupos/:grupoId/alumnos',
          name: 'alumnos',
          component: () => import('@/views/AlumnosView.vue'),
          props: (route) => ({
            termId: Number(route.params.termId),
            carreraId: Number(route.params.carreraId),
            grupoId: route.params.grupoId as string,
          }),
        },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: { name: 'ciclos' } },
  ],
});

router.beforeEach((to) => {
  const auth = useAuthStore();

  if (!to.meta.public && !auth.isAuthenticated) {
    return { name: 'login' };
  }
  if (to.name === 'login' && auth.isAuthenticated) {
    return { name: 'ciclos' };
  }
});

export default router;
