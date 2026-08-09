<script setup lang="ts">
import { ref, watchEffect } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import Button from 'primevue/button';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import { api } from '@/api/client';
import { useBreadcrumbStore } from '@/stores/breadcrumb';
import { exportAlumnos } from '@/utils/exportAlumnos';
import EditAlumnoModal from '@/components/EditAlumnoModal.vue';
import type { AlumnoRow, CarreraConGrupos, GrupoConAlumnos, Term } from '@/types/api';

const props = defineProps<{ termId: number; carreraId: number; grupoId: string }>();

const router = useRouter();
const toast = useToast();
const breadcrumb = useBreadcrumbStore();

const term = ref<Term | null>(null);
const carrera = ref<CarreraConGrupos | null>(null);
const grupo = ref<GrupoConAlumnos | null>(null);
const isSinGrupo = () => props.grupoId === 'sin-grupo';

const alumnos = ref<AlumnoRow[] | null>(null);
const isExporting = ref(false);
const editingAlumno = ref<AlumnoRow | null>(null);

async function fetchAlumnos() {
  const filters = isSinGrupo()
    ? { carrera: [props.carreraId], sinAsignar: true }
    : { secuencia: [grupo.value?.secuencia ?? ''] };
  try {
    const res = await api.queryAlumnos(props.termId, filters);
    alumnos.value = res.items;
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'No se pudieron cargar los alumnos',
      detail: err instanceof Error ? err.message : String(err),
      life: 5000,
    });
  }
}

watchEffect(async () => {
  const { termId, carreraId, grupoId } = props;
  alumnos.value = null;
  try {
    const [termsRes, carrerasRes, gruposRes] = await Promise.all([
      api.listTerms(),
      api.getCarrerasPorCiclo(termId),
      api.getGruposPorCarrera(termId, carreraId),
    ]);
    term.value = termsRes.items.find((t) => t.id === termId) ?? null;
    carrera.value = carrerasRes.items.find((c) => c.id === carreraId) ?? null;
    grupo.value =
      grupoId === 'sin-grupo'
        ? null
        : (gruposRes.items.find((g) => String(g.id) === grupoId) ?? null);

    breadcrumb.setItems([
      { label: 'Ciclos', to: '/ciclos' },
      { label: term.value?.descripcion ?? `Ciclo ${termId}`, to: `/ciclos/${termId}/carreras` },
      {
        label: carrera.value?.descripcion ?? `Carrera ${carreraId}`,
        to: `/ciclos/${termId}/carreras/${carreraId}/grupos`,
      },
      {
        label:
          grupoId === 'sin-grupo' ? 'Sin grupo' : (grupo.value?.secuencia ?? `Grupo ${grupoId}`),
      },
    ]);

    await fetchAlumnos();
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'No se pudo cargar la información del grupo',
      detail: err instanceof Error ? err.message : String(err),
      life: 5000,
    });
  }
});

async function handleExport() {
  if (!alumnos.value) return;
  isExporting.value = true;
  try {
    const filename = isSinGrupo()
      ? `${term.value?.descripcion ?? props.termId} - ${carrera.value?.descripcion ?? props.carreraId} - Sin grupo.xlsx`
      : `${term.value?.descripcion ?? props.termId} - ${grupo.value?.secuencia ?? props.grupoId}.xlsx`;
    const result = await exportAlumnos(alumnos.value, filename);
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

function handleSaved() {
  editingAlumno.value = null;
  void fetchAlumnos();
}
</script>

<template>
  <div class="page">
    <button
      type="button"
      class="btn-back"
      @click="router.push({ name: 'grupos', params: { termId, carreraId } })"
    >
      <i class="pi pi-arrow-left" /> Volver a Grupos
    </button>

    <div class="page-head">
      <div>
        <h2>
          {{
            isSinGrupo() ? 'Alumnos sin grupo' : `Alumnos del grupo ${grupo?.secuencia ?? grupoId}`
          }}
        </h2>
        <p>
          {{ term?.descripcion ?? '…' }} · {{ carrera?.descripcion ?? '…' }}
          <template v-if="!isSinGrupo() && grupo"
            >· {{ grupo.turno === 'M' ? 'Matutino' : 'Vespertino' }}</template
          >
        </p>
      </div>
      <Button
        label="Exportar Excel"
        icon="pi pi-file-export"
        severity="secondary"
        outlined
        :loading="isExporting"
        :disabled="!alumnos?.length"
        @click="handleExport"
      />
    </div>

    <p v-if="alumnos === null" class="loading-state">Cargando…</p>

    <div v-else-if="alumnos.length === 0" class="empty-state">No hay alumnos que mostrar aquí.</div>

    <DataTable v-else :value="alumnos" size="small" scrollable scroll-height="65vh">
      <Column field="pr" header="PR" />
      <Column field="boleta" header="Boleta">
        <template #body="{ data }">{{ data.boleta ?? '—' }}</template>
      </Column>
      <Column field="nombre" header="Nombre" />
      <Column header="Género">
        <template #body="{ data }">{{ data.genero === 'F' ? 'Mujer' : 'Hombre' }}</template>
      </Column>
      <Column header="Promedio">
        <template #body="{ data }">{{ data.promedio ?? '—' }}</template>
      </Column>
      <Column header="Distancia (km)">
        <template #body="{ data }">
          {{ data.distanceMeters != null ? Math.round(data.distanceMeters / 100) / 10 : '—' }}
        </template>
      </Column>
      <Column header="">
        <template #body="{ data }">
          <Button
            label="Editar"
            size="small"
            severity="secondary"
            outlined
            @click="editingAlumno = data"
          />
        </template>
      </Column>
    </DataTable>

    <EditAlumnoModal
      v-if="editingAlumno"
      :alumno="editingAlumno"
      :term-id="termId"
      :carrera-id="carreraId"
      @close="editingAlumno = null"
      @saved="handleSaved"
    />
  </div>
</template>
