<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/yup';
import * as yup from 'yup';
import InputText from 'primevue/inputtext';
import Password from 'primevue/password';
import Button from 'primevue/button';
import Message from 'primevue/message';
import { api } from '@/api/client';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const router = useRouter();

const schema = toTypedSchema(
  yup.object({
    username: yup.string().required('El usuario es obligatorio.'),
    password: yup.string().required('La contraseña es obligatoria.'),
  }),
);

const { handleSubmit, defineField, errors } = useForm({
  validationSchema: schema,
});

const [username, usernameAttrs] = defineField('username');
const [password, passwordAttrs] = defineField('password');

const isSubmitting = ref(false);
const loginError = ref('');

const onSubmit = handleSubmit(async (values) => {
  isSubmitting.value = true;
  loginError.value = '';
  try {
    const { token } = await api.login(values.username, values.password);
    auth.setToken(token);
    await router.push({ name: 'ciclos' });
  } catch (err) {
    loginError.value = err instanceof Error ? err.message : 'Error al iniciar sesión.';
  } finally {
    isSubmitting.value = false;
  }
});
</script>

<template>
  <div class="login-container">
    <form class="login-card" @submit="onSubmit">
      <div class="brand-mark">IPN</div>
      <h2>Sistema Gestión IPN</h2>

      <div class="field">
        <label for="username">Usuario</label>
        <InputText
          id="username"
          v-model="username"
          v-bind="usernameAttrs"
          fluid
          autocomplete="username"
          :invalid="!!errors.username"
        />
        <small v-if="errors.username" class="field-error">{{ errors.username }}</small>
      </div>

      <div class="field">
        <label for="password">Contraseña</label>
        <Password
          id="password"
          v-model="password"
          v-bind="passwordAttrs"
          fluid
          :feedback="false"
          toggle-mask
          autocomplete="current-password"
          :invalid="!!errors.password"
        />
        <small v-if="errors.password" class="field-error">{{ errors.password }}</small>
      </div>

      <Message v-if="loginError" severity="error" :closable="false" style="margin-bottom: 1rem">
        {{ loginError }}
      </Message>

      <Button type="submit" label="Entrar" :loading="isSubmitting" fluid />
    </form>
  </div>
</template>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: 1.5rem;
}

.login-card {
  background: var(--p-content-background);
  border: 1px solid var(--p-content-border-color);
  padding: 2rem;
  border-radius: 12px;
  width: 100%;
  max-width: 380px;
  text-align: center;
}

.login-card .brand-mark {
  margin: 0 auto 1rem;
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
}

.login-card h2 {
  color: var(--p-text-color);
  margin-bottom: 1.5rem;
}

.field {
  margin-bottom: 1rem;
  text-align: left;
}

.field label {
  display: block;
  margin-bottom: 0.4rem;
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--p-text-muted-color);
}

.field-error {
  color: var(--p-red-400);
  display: block;
  margin-top: 0.3rem;
}
</style>
