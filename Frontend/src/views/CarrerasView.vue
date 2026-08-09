<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import Tag from 'primevue/tag';
import Button from 'primevue/button';
import { api } from '@/api/client';
import { useBreadcrumbStore } from '@/stores/breadcrumb';
import { exportAlumnos } from '@/utils/exportAlumnos';
import HeadTotals from '@/components/HeadTotals.vue';
import EntityCard from '@/components/EntityCard.vue';
import type { CarreraConGrupos, Term } from '@/types/api';

const props = defineProps<{ termId: number }>();

const router = useRouter();
const toast = useToast();
const breadcrumb = useBreadcrumbStore();

const term = ref<Term | null>(null);
const carreras = ref<CarreraConGrupos[] | null>(null);
const isExporting = ref(false);

const totales = computed(() => {
  if (carreras.value === null) return null;
  return carreras.value.reduce(
    (acc, c) => ({
      grupos: acc.grupos + c.totalGrupos,
      alumnos: acc.alumnos + c.totalAlumnos,
      hombres: acc.hombres + c.hombres,
      mujeres: acc.mujeres + c.mujeres,
    }),
    { grupos: 0, alumnos: 0, hombres: 0, mujeres: 0 },
  );
});

watchEffect(async () => {
  const termId = props.termId;
  carreras.value = null;
  try {
    const [termsRes, carrerasRes] = await Promise.all([
      api.listTerms(),
      api.getCarrerasPorCiclo(termId),
    ]);
    term.value = termsRes.items.find((t) => t.id === termId) ?? null;
    carreras.value = carrerasRes.items;
    breadcrumb.setItems([
      { label: 'Ciclos', to: '/ciclos' },
      { label: term.value?.descripcion ?? `Ciclo ${termId}` },
    ]);
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'No se pudieron cargar las carreras',
      detail: err instanceof Error ? err.message : String(err),
      life: 5000,
    });
  }
});

function selectCarrera(carreraId: number) {
  void router.push({ name: 'grupos', params: { termId: props.termId, carreraId } });
}

async function handleExport() {
  isExporting.value = true;
  try {
    const alumnos = await api.queryAlumnos(props.termId);
    const result = await exportAlumnos(
      alumnos.items,
      `${term.value?.descripcion ?? props.termId}.xlsx`,
    );
    if ('cancelled' in result) {
      toast.add({ severity: 'warn', summary: 'Exportación cancelada', life: 4000 });
      return;
    }
    toast.add({
      severity: 'success',
      summary:
        result.location === 'descargas'
          ? `"${result.name}" descargado`
          : `"${result.name}" guardado`,
      life: 4000,
    });
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Error exportando',
      detail: err instanceof Error ? err.message : String(err),
      life: 5000,
    });
  } finally {
    isExporting.value = false;
  }
}
</script>

<template>
  <div class="page">
    <button type="button" class="btn-back" @click="router.push({ name: 'ciclos' })">
      <i class="pi pi-arrow-left" /> Volver a Ciclos
    </button>

    <div class="page-head">
      <div>
        <h2>Carreras</h2>
        <p>Ciclo escolar: {{ term?.descripcion ?? '…' }}</p>
        <HeadTotals
          :stats="[
            {
              label: carreras?.length === 1 ? 'carrera' : 'carreras',
              value: carreras?.length ?? null,
            },
            { label: 'grupos', value: totales?.grupos ?? null },
            { label: 'alumnos', value: totales?.alumnos ?? null },
            { label: 'hombres', value: totales?.hombres ?? null },
            { label: 'mujeres', value: totales?.mujeres ?? null },
          ]"
        />
      </div>
      <Button
        label="Exportar Excel del ciclo"
        icon="pi pi-file-export"
        severity="secondary"
        outlined
        :loading="isExporting"
        @click="handleExport"
      />
    </div>

    <p v-if="carreras === null" class="loading-state">Cargando…</p>

    <div v-else-if="carreras.length === 0" class="empty-state">
      Este ciclo aún no tiene grupos creados para ninguna carrera.
    </div>

    <div v-else class="entity-grid">
      <EntityCard
        v-for="carrera in carreras"
        :key="carrera.id"
        :title="carrera.descripcion"
        @click="selectCarrera(carrera.id)"
      >
        <Tag
          severity="success"
          :value="`${carrera.totalGrupos} grupo${carrera.totalGrupos === 1 ? '' : 's'}`"
        />
        <Tag
          severity="success"
          :value="`${carrera.totalAlumnos} alumno${carrera.totalAlumnos === 1 ? '' : 's'}`"
        />
        <Tag severity="success" :value="`${carrera.hombres} hombres`" />
        <Tag severity="success" :value="`${carrera.mujeres} mujeres`" />
      </EntityCard>
    </div>
  </div>
</template>
