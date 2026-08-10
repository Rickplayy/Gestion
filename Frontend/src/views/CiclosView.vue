<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import Tag from 'primevue/tag';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import { api } from '@/api/client';
import { useBreadcrumbStore } from '@/stores/breadcrumb';
import HeadTotals from '@/components/HeadTotals.vue';
import EntityCard from '@/components/EntityCard.vue';
import type { Term } from '@/types/api';

const router = useRouter();
const toast = useToast();
const breadcrumb = useBreadcrumbStore();

const ciclos = ref<Term[] | null>(null);
const cicloToDelete = ref<Term | null>(null);
const isDeleting = ref(false);

async function load() {
  try {
    const res = await api.listTerms();
    ciclos.value = res.items;
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'No se pudieron cargar los ciclos escolares',
      detail: err instanceof Error ? err.message : String(err),
      life: 5000,
    });
  }
}

onMounted(() => {
  breadcrumb.setItems([{ label: 'Ciclos' }]);
  void load();
});

function selectCiclo(termId: number) {
  void router.push({ name: 'carreras', params: { termId } });
}

function askDelete(ciclo: Term) {
  cicloToDelete.value = ciclo;
}

async function confirmDelete() {
  if (cicloToDelete.value === null) return;
  const ciclo = cicloToDelete.value;
  isDeleting.value = true;
  try {
    await api.deleteTerm(ciclo.id);
    toast.add({
      severity: 'success',
      summary: `Ciclo "${ciclo.descripcion}" eliminado.`,
      life: 4000,
    });
    cicloToDelete.value = null;
    await load();
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'No se pudo eliminar el ciclo',
      detail: err instanceof Error ? err.message : String(err),
      life: 5000,
    });
  } finally {
    isDeleting.value = false;
  }
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2>Ciclos escolares</h2>
        <p>Selecciona un ciclo para ver sus carreras y grupos, o crea uno nuevo.</p>
        <HeadTotals
          :stats="[
            {
              label: ciclos?.length === 1 ? 'ciclo escolar' : 'ciclos escolares',
              value: ciclos?.length ?? null,
            },
          ]"
        />
      </div>
      <Button
        label="Nuevo ciclo escolar"
        icon="pi pi-plus"
        @click="router.push({ name: 'wizard' })"
      />
    </div>

    <p v-if="ciclos === null" class="loading-state">Cargando…</p>

    <div v-else-if="ciclos.length === 0" class="empty-state">
      Aún no hay ciclos escolares registrados.
    </div>

    <div v-else class="entity-grid">
      <EntityCard
        v-for="ciclo in ciclos"
        :key="ciclo.id"
        :title="ciclo.descripcion"
        @click="selectCiclo(ciclo.id)"
      >
        <span v-if="ciclo.carreras.length === 0" style="color: var(--p-text-muted-color)"
          >Sin carreras aún</span
        >
        <Tag
          v-else
          severity="success"
          :value="`${ciclo.carreras.length} carrera${ciclo.carreras.length === 1 ? '' : 's'}`"
        />
        <template #actions>
          <Button
            icon="pi pi-trash"
            severity="danger"
            text
            rounded
            size="small"
            aria-label="Eliminar ciclo escolar"
            @click.stop="askDelete(ciclo)"
          />
        </template>
      </EntityCard>
    </div>

    <Dialog
      :visible="cicloToDelete !== null"
      modal
      header="Eliminar ciclo escolar"
      :style="{ width: '28rem', maxWidth: '95vw' }"
      @update:visible="cicloToDelete = null"
    >
      <p>
        ¿Seguro que quieres eliminar el ciclo <strong>{{ cicloToDelete?.descripcion }}</strong
        >? Se borrarán también sus grupos y los alumnos registrados en él. Esta acción no se puede
        deshacer.
      </p>
      <template #footer>
        <Button
          label="Cancelar"
          severity="secondary"
          outlined
          :disabled="isDeleting"
          @click="cicloToDelete = null"
        />
        <Button label="Eliminar" severity="danger" :loading="isDeleting" @click="confirmDelete" />
      </template>
    </Dialog>
  </div>
</template>
