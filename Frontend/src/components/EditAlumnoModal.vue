<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import { useToast } from 'primevue/usetoast';
import { api } from '@/api/client';
import type { AlumnoRow, GrupoConAlumnos } from '@/types/api';

const props = defineProps<{
  alumno: AlumnoRow;
  termId: number;
  carreraId: number;
}>();

const emit = defineEmits<{ close: []; saved: [] }>();
const toast = useToast();

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
function notify(severity: 'success' | 'error', summary: string) {
  toast.add({ severity, summary, life: severity === 'error' ? 6000 : 4000 });
}

const addressMode = ref<'direccion' | 'coordenadas'>('direccion');
const estado = ref('');
const delegacion = ref('');
const cp = ref('');
const calle = ref('');
const numero = ref('');
const lat = ref('');
const lon = ref('');
const isRecalculando = ref(false);
const isLoadingDomicilio = ref(true);

const grupos = ref<GrupoConAlumnos[] | null>(null);
const selectedGrupo = ref<string>(
  props.alumno.idGrupo == null ? 'sin-grupo' : String(props.alumno.idGrupo),
);
const isSavingGrupo = ref(false);

onMounted(async () => {
  try {
    const res = await api.getGruposPorCarrera(props.termId, props.carreraId);
    grupos.value = res.items;
  } catch (err) {
    notify('error', `No se pudieron cargar los grupos: ${message(err)}`);
  }

  try {
    const res = await api.getDomicilio(props.termId, props.alumno.pr);
    estado.value = res.estado ?? '';
    delegacion.value = res.delegacion ?? '';
    cp.value = res.cp ?? '';
    calle.value = res.calle ?? '';
    numero.value = res.numero ?? '';
    lat.value = res.lat != null ? String(res.lat) : '';
    lon.value = res.lon != null ? String(res.lon) : '';
  } catch (err) {
    notify('error', `No se pudo cargar el domicilio actual: ${message(err)}`);
  } finally {
    isLoadingDomicilio.value = false;
  }
});

const direccionCompleta = computed(
  () =>
    !!(
      estado.value.trim() &&
      delegacion.value.trim() &&
      cp.value.trim() &&
      calle.value.trim() &&
      numero.value.trim()
    ),
);
const coordenadasCompletas = computed(
  () =>
    lat.value.trim() !== '' &&
    lon.value.trim() !== '' &&
    !Number.isNaN(Number(lat.value)) &&
    !Number.isNaN(Number(lon.value)),
);

async function handleRecalcularDireccion() {
  isRecalculando.value = true;
  try {
    await api.updateDomicilio(props.termId, props.alumno.pr, {
      ESTADO: estado.value.trim(),
      DELEGACION: delegacion.value.trim(),
      CP: cp.value.trim(),
      CALLE: calle.value.trim(),
      NUMERO: numero.value.trim(),
      COLONIA: '',
    });
    await api.asignarGrupos(props.termId);
    notify('success', 'Dirección actualizada. Los grupos de la carrera se reacomodaron.');
    emit('saved');
  } catch (err) {
    notify('error', `Error recalculando: ${message(err)}`);
  } finally {
    isRecalculando.value = false;
  }
}

async function handleRecalcularCoordenadas() {
  isRecalculando.value = true;
  try {
    await api.updateDomicilioCoordenadas(props.termId, props.alumno.pr, {
      lat: Number(lat.value),
      lon: Number(lon.value),
    });
    await api.asignarGrupos(props.termId);
    notify('success', 'Coordenadas actualizadas. Los grupos de la carrera se reacomodaron.');
    emit('saved');
  } catch (err) {
    notify('error', `Error recalculando: ${message(err)}`);
  } finally {
    isRecalculando.value = false;
  }
}

async function handleGuardarGrupo() {
  isSavingGrupo.value = true;
  try {
    const idGrupo = selectedGrupo.value === 'sin-grupo' ? null : Number(selectedGrupo.value);
    await api.updateGrupoAlumno(props.termId, props.alumno.pr, idGrupo);
    notify('success', 'Grupo actualizado.');
    emit('saved');
  } catch (err) {
    notify('error', `Error cambiando de grupo: ${message(err)}`);
  } finally {
    isSavingGrupo.value = false;
  }
}

const grupoOptions = computed(() => [
  { label: 'Sin grupo', value: 'sin-grupo' },
  ...(grupos.value ?? []).map((g) => ({
    label: `${g.secuencia} · ${g.turno === 'M' ? 'Matutino' : 'Vespertino'}`,
    value: String(g.id),
  })),
]);
</script>

<template>
  <Dialog
    :visible="true"
    modal
    :header="alumno.nombre"
    :style="{ width: '32rem', maxWidth: '95vw' }"
    @update:visible="emit('close')"
  >
    <p class="muted">PR {{ alumno.pr }} · Boleta {{ alumno.boleta ?? '—' }}</p>

    <section class="modal-section">
      <h4>Editar dirección</h4>
      <p class="muted">
        Distancia actual:
        {{
          alumno.distanceMeters != null
            ? `${Math.round(alumno.distanceMeters / 100) / 10} km`
            : 'sin calcular'
        }}
      </p>

      <p v-if="isLoadingDomicilio" class="loading-state">Cargando domicilio actual…</p>

      <div class="tab-toggle">
        <Button
          :severity="addressMode === 'direccion' ? 'primary' : 'secondary'"
          :outlined="addressMode !== 'direccion'"
          label="Por dirección"
          size="small"
          @click="addressMode = 'direccion'"
        />
        <Button
          :severity="addressMode === 'coordenadas' ? 'primary' : 'secondary'"
          :outlined="addressMode !== 'coordenadas'"
          label="Por coordenadas"
          size="small"
          @click="addressMode = 'coordenadas'"
        />
      </div>

      <div v-if="addressMode === 'direccion'" class="field-grid">
        <div>
          <label for="estado">Estado</label>
          <InputText id="estado" v-model="estado" fluid />
        </div>
        <div>
          <label for="delegacion">Delegación</label>
          <InputText id="delegacion" v-model="delegacion" fluid />
        </div>
        <div>
          <label for="cp">CP</label>
          <InputText id="cp" v-model="cp" fluid />
        </div>
        <div>
          <label for="numero">Número</label>
          <InputText id="numero" v-model="numero" fluid />
        </div>
        <div class="span-2">
          <label for="calle">Calle</label>
          <InputText id="calle" v-model="calle" fluid />
        </div>
        <div class="span-2">
          <Button
            label="Recalcular"
            :loading="isRecalculando"
            :disabled="!direccionCompleta || isLoadingDomicilio"
            @click="handleRecalcularDireccion"
          />
        </div>
      </div>

      <div v-else class="field-grid">
        <div>
          <label for="lat">Latitud</label>
          <InputText id="lat" v-model="lat" fluid placeholder="Ej. 19.3960" />
        </div>
        <div>
          <label for="lon">Longitud</label>
          <InputText id="lon" v-model="lon" fluid placeholder="Ej. -99.0919" />
        </div>
        <div class="span-2">
          <Button
            label="Recalcular"
            :loading="isRecalculando"
            :disabled="!coordenadasCompletas || isLoadingDomicilio"
            @click="handleRecalcularCoordenadas"
          />
        </div>
      </div>
    </section>

    <section class="modal-section">
      <h4>Grupo</h4>
      <p v-if="grupos === null" class="loading-state">Cargando grupos…</p>
      <div v-else class="grupo-row">
        <Select
          v-model="selectedGrupo"
          :options="grupoOptions"
          option-label="label"
          option-value="value"
          fluid
        />
        <Button label="Guardar" :loading="isSavingGrupo" @click="handleGuardarGrupo" />
      </div>
    </section>
  </Dialog>
</template>

<style scoped>
.muted {
  color: var(--p-text-muted-color);
  margin: 0.25rem 0 0;
}

.modal-section {
  border-top: 1px solid var(--p-content-border-color);
  padding-top: 1.25rem;
  margin-top: 1.25rem;
}

.modal-section:first-of-type {
  border-top: none;
  padding-top: 0;
  margin-top: 1rem;
}

.modal-section h4 {
  margin: 0 0 0.85rem;
  color: var(--p-text-color);
}

.tab-toggle {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.tab-toggle :deep(.p-button) {
  flex: 1;
}

.field-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.field-grid .span-2 {
  grid-column: 1 / -1;
}

.field-grid label {
  display: block;
  margin-bottom: 0.3rem;
  font-size: 0.82rem;
  color: var(--p-text-muted-color);
  font-weight: 600;
}

.grupo-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.grupo-row :deep(.p-select) {
  flex: 1;
}
</style>
