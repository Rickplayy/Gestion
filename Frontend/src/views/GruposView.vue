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
import type { CarreraConGrupos, GrupoConAlumnos, Term } from '@/types/api';

const props = defineProps<{ termId: number; carreraId: number }>();

const router = useRouter();
const toast = useToast();
const breadcrumb = useBreadcrumbStore();

const term = ref<Term | null>(null);
const carrera = ref<CarreraConGrupos | null>(null);
const grupos = ref<GrupoConAlumnos[] | null>(null);
const sinGrupo = ref<number | null>(null);
const isExporting = ref(false);

const asignados = computed(() =>
  grupos.value === null ? null : grupos.value.reduce((acc, g) => acc + g.totalAlumnos, 0),
);
const cupo = computed(() =>
  grupos.value === null ? null : grupos.value.reduce((acc, g) => acc + g.cupo, 0),
);
const totalAlumnos = computed(() =>
  asignados.value === null ? null : asignados.value + (sinGrupo.value ?? 0),
);

watchEffect(async () => {
  const { termId, carreraId } = props;
  grupos.value = null;
  sinGrupo.value = null;
  try {
    const [termsRes, carrerasRes, gruposRes, sinGrupoRes] = await Promise.all([
      api.listTerms(),
      api.getCarrerasPorCiclo(termId),
      api.getGruposPorCarrera(termId, carreraId),
      api.queryAlumnos(termId, { carrera: [carreraId], sinAsignar: true }),
    ]);
    term.value = termsRes.items.find((t) => t.id === termId) ?? null;
    carrera.value = carrerasRes.items.find((c) => c.id === carreraId) ?? null;
    grupos.value = gruposRes.items;
    sinGrupo.value = sinGrupoRes.total;

    breadcrumb.setItems([
      { label: 'Ciclos', to: '/ciclos' },
      { label: term.value?.descripcion ?? `Ciclo ${termId}`, to: `/ciclos/${termId}/carreras` },
      { label: carrera.value?.descripcion ?? `Carrera ${carreraId}` },
    ]);
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'No se pudieron cargar los grupos',
      detail: err instanceof Error ? err.message : String(err),
      life: 5000,
    });
  }
});

function selectGrupo(grupoId: string) {
  void router.push({
    name: 'alumnos',
    params: { termId: props.termId, carreraId: props.carreraId, grupoId },
  });
}

async function handleExport() {
  isExporting.value = true;
  try {
    const alumnos = await api.queryAlumnos(props.termId, { carrera: [props.carreraId] });
    const filename = `${term.value?.descripcion ?? props.termId} - ${carrera.value?.descripcion ?? props.carreraId}.xlsx`;
    const result = await exportAlumnos(alumnos.items, filename);
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
    <button
      type="button"
      class="btn-back"
      @click="router.push({ name: 'carreras', params: { termId } })"
    >
      <i class="pi pi-arrow-left" /> Volver a Carreras
    </button>

    <div class="page-head">
      <div>
        <h2>Grupos</h2>
        <p>{{ term?.descripcion ?? '…' }} · {{ carrera?.descripcion ?? '…' }}</p>
        <HeadTotals
          :stats="[
            { label: grupos?.length === 1 ? 'grupo' : 'grupos', value: grupos?.length ?? null },
            { label: 'alumnos', value: totalAlumnos },
            { label: 'lugares de cupo', value: cupo },
            { label: 'sin grupo', value: sinGrupo && sinGrupo > 0 ? sinGrupo : null },
          ]"
        />
      </div>
      <Button
        label="Exportar Excel de la carrera"
        icon="pi pi-file-export"
        severity="secondary"
        outlined
        :loading="isExporting"
        @click="handleExport"
      />
    </div>

    <p v-if="grupos === null" class="loading-state">Cargando…</p>

    <div v-else-if="grupos.length === 0 && sinGrupo === 0" class="empty-state">
      Esta carrera no tiene grupos en este ciclo.
    </div>

    <div v-else-if="grupos.length > 0 || (sinGrupo ?? 0) > 0" class="entity-grid">
      <EntityCard
        v-for="grupo in grupos"
        :key="grupo.id"
        :title="grupo.secuencia"
        @click="selectGrupo(String(grupo.id))"
      >
        <Tag severity="success" :value="grupo.turno === 'M' ? 'Matutino' : 'Vespertino'" />
        <Tag severity="success" :value="`${grupo.totalAlumnos} / ${grupo.cupo} alumnos`" />
      </EntityCard>

      <EntityCard
        v-if="sinGrupo && sinGrupo > 0"
        title="Sin grupo"
        @click="selectGrupo('sin-grupo')"
      >
        <Tag severity="success" :value="`${sinGrupo} alumno${sinGrupo === 1 ? '' : 's'}`" />
      </EntityCard>
    </div>
  </div>
</template>
