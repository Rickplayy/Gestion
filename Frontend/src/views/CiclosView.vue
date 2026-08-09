<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import Tag from 'primevue/tag';
import Button from 'primevue/button';
import { api } from '@/api/client';
import { useBreadcrumbStore } from '@/stores/breadcrumb';
import HeadTotals from '@/components/HeadTotals.vue';
import EntityCard from '@/components/EntityCard.vue';
import type { Term } from '@/types/api';

const router = useRouter();
const toast = useToast();
const breadcrumb = useBreadcrumbStore();

const ciclos = ref<Term[] | null>(null);

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
      </EntityCard>
    </div>
  </div>
</template>
