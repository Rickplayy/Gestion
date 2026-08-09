<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/yup';
import * as yup from 'yup';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import { api } from '@/api/client';
import { useBreadcrumbStore } from '@/stores/breadcrumb';
import { parseExcelBuffer } from '@/utils/excelParser';
import {
  extractSecuencias,
  pickSaveTarget,
  discardSaveTarget,
  exportToExcel,
} from '@/utils/groupGenerator';
import { buildGruposPayload, buildAlumnosPayload, type Omitido } from '@/utils/mapToBackend';
import type { Carrera, ConteoAlumnosResponse, CreateAlumnosResponse } from '@/types/api';

const router = useRouter();
const toast = useToast();
const breadcrumb = useBreadcrumbStore();

const carreras = ref<Carrera[]>([]);

onMounted(async () => {
  breadcrumb.setItems([{ label: 'Ciclos', to: '/ciclos' }, { label: 'Nuevo ciclo escolar' }]);
  try {
    const res = await api.getCarreras();
    carreras.value = res.items;
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'No se pudo cargar el catálogo de carreras',
      detail: err instanceof Error ? err.message : String(err),
      life: 5000,
    });
  }
});

function notify(severity: 'success' | 'error' | 'warn', summary: string) {
  toast.add({ severity, summary, life: severity === 'error' ? 6000 : 4000 });
}

// --- Paso 1: ciclo escolar ---
const termId = ref<number | null>(null);
const isCreatingTerm = ref(false);

const termSchema = toTypedSchema(
  yup.object({ descripcion: yup.string().required('La descripción es obligatoria.') }),
);
const {
  handleSubmit: handleTermSubmit,
  defineField: defineTermField,
  errors: termErrors,
} = useForm({
  validationSchema: termSchema,
});
const [termDescripcion, termDescripcionAttrs] = defineTermField('descripcion');

const onCreateTerm = handleTermSubmit(async (values) => {
  isCreatingTerm.value = true;
  try {
    const term = await api.createTerm(values.descripcion.trim());
    termId.value = term.id;
    notify('success', `Ciclo escolar "${term.descripcion}" creado (id ${term.id}).`);
  } catch (err) {
    notify('error', `Error creando el ciclo: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    isCreatingTerm.value = false;
  }
});

// --- Paso 2: secuencias -> grupos ---
const fileSecuenciasInput = ref<HTMLInputElement | null>(null);
const secuenciasFileName = ref<string | null>(null);
const isUploadingGrupos = ref(false);
const gruposResumen = ref<{ creados: number; omitidos: Omitido[] } | null>(null);

async function handleSecuenciasSelect(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file || termId.value === null) return;
  secuenciasFileName.value = file.name;
  gruposResumen.value = null;
  isUploadingGrupos.value = true;
  try {
    const buffer = await file.arrayBuffer();
    const list = await extractSecuencias(buffer);
    const { validos, omitidos } = buildGruposPayload(list, carreras.value);
    if (validos.length === 0) {
      throw new Error('Ninguna secuencia se pudo mapear a una carrera/turno válidos.');
    }
    const result = await api.createGrupos(termId.value, validos);
    gruposResumen.value = { creados: result.items.length, omitidos };
    notify(
      'success',
      `${result.items.length} grupo(s) creados${omitidos.length ? `, ${omitidos.length} omitido(s)` : ''}.`,
    );
  } catch (err) {
    notify(
      'error',
      `Error procesando secuencias: ${err instanceof Error ? err.message : String(err)}`,
    );
  } finally {
    isUploadingGrupos.value = false;
  }
}

// --- Paso 3: aspirantes -> alumnos ---
const fileAspirantesInput = ref<HTMLInputElement | null>(null);
const aspirantesFileName = ref<string | null>(null);
const isUploadingAlumnos = ref(false);
const alumnosResumen = ref<(CreateAlumnosResponse & { omitidosLocal: Omitido[] }) | null>(null);

async function handleAspirantesSelect(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file || termId.value === null) return;
  aspirantesFileName.value = file.name;
  alumnosResumen.value = null;
  isUploadingAlumnos.value = true;
  try {
    const buffer = await file.arrayBuffer();
    const parsed = await parseExcelBuffer(buffer);
    const { validos, omitidos } = buildAlumnosPayload(parsed, carreras.value);
    if (validos.length === 0) {
      throw new Error('Ningún aspirante se pudo mapear correctamente.');
    }
    const result = await api.createAlumnos(termId.value, validos);
    alumnosResumen.value = { ...result, omitidosLocal: omitidos };
    notify(
      'success',
      `${result.insertados} alumno(s) insertados, ${result.duplicados.length} duplicado(s), ` +
        `${result.fallidos.length} fallido(s), ${omitidos.length} omitido(s) antes de enviar.`,
    );
  } catch (err) {
    notify(
      'error',
      `Error procesando aspirantes: ${err instanceof Error ? err.message : String(err)}`,
    );
  } finally {
    isUploadingAlumnos.value = false;
  }
}

// --- Paso 4: conteo ---
const isLoadingConteo = ref(false);
const conteo = ref<ConteoAlumnosResponse | null>(null);
const conteoRows = () =>
  conteo.value
    ? [
        ...conteo.value.carreras,
        {
          idCarrera: -1,
          descripcion: 'Total',
          total: conteo.value.total,
          hombres: conteo.value.hombres,
          mujeres: conteo.value.mujeres,
        },
      ]
    : [];

async function handleConteo() {
  if (termId.value === null) return;
  isLoadingConteo.value = true;
  try {
    conteo.value = await api.getConteo(termId.value);
  } catch (err) {
    notify(
      'error',
      `Error obteniendo el conteo: ${err instanceof Error ? err.message : String(err)}`,
    );
  } finally {
    isLoadingConteo.value = false;
  }
}

// --- Asignar y exportar ---
const isAsignando = ref(false);

async function handleAsignarYExportar() {
  if (termId.value === null) return;
  const target = await pickSaveTarget('gruposAsignados.xlsx');
  if (target?.cancelled) {
    notify('warn', 'Guardado cancelado.');
    return;
  }

  isAsignando.value = true;
  try {
    await api.asignarGrupos(termId.value);
    const alumnosRes = await api.queryAlumnos(termId.value);

    const rows = alumnosRes.items.map((alumno) => ({
      Secuencia: alumno.secuencia ?? 'SIN GRUPO',
      Turno: alumno.turno === 'M' ? 'Matutino' : alumno.turno === 'V' ? 'Vespertino' : '',
      Carrera: alumno.carrera,
      PR: alumno.pr,
      Boleta: alumno.boleta ?? '',
      Nombre: alumno.nombre,
      Genero: alumno.genero === 'F' ? 'Mujer' : 'Hombre',
      Promedio: alumno.promedio ?? '',
      DistanciaKm:
        alumno.distanceMeters != null ? Math.round(alumno.distanceMeters / 100) / 10 : '',
    }));

    if (rows.length === 0) {
      throw new Error('No hay alumnos registrados en este ciclo.');
    }

    const saved = await exportToExcel(rows, 'gruposAsignados.xlsx', target);
    notify(
      'success',
      saved.location === 'descargas'
        ? `"${saved.name}" se descargó a tu carpeta de Descargas con ${rows.length} alumnos asignados.`
        : `"${saved.name}" guardado con ${rows.length} alumnos asignados.`,
    );
  } catch (err) {
    await discardSaveTarget(target);
    notify(
      'error',
      `Error asignando/exportando: ${err instanceof Error ? err.message : String(err)}`,
    );
  } finally {
    isAsignando.value = false;
  }
}
</script>

<template>
  <div class="page generator">
    <button type="button" class="btn-back" @click="router.push({ name: 'ciclos' })">
      <i class="pi pi-arrow-left" /> Volver a Ciclos
    </button>

    <header class="generator-head">
      <h2>Crear ciclo escolar</h2>
      <p>Sigue los pasos para asignar los grupos a partir de tus archivos de Excel.</p>
    </header>

    <!-- Paso 1 -->
    <section class="step-card" :class="{ 'is-done': termId !== null }">
      <div class="step-head">
        <span class="step-num">{{ termId !== null ? '✓' : '1' }}</span>
        <div class="step-title">
          <h3>Ciclo escolar</h3>
          <p>Crea el ciclo escolar en el que vas a registrar los grupos y aspirantes.</p>
        </div>
      </div>
      <div class="step-body">
        <p v-if="termId !== null">
          Ciclo escolar activo: <strong>id {{ termId }}</strong>
        </p>
        <form v-else class="term-form" @submit="onCreateTerm">
          <InputText
            v-model="termDescripcion"
            v-bind="termDescripcionAttrs"
            placeholder="Ej. 2026-1"
            :invalid="!!termErrors.descripcion"
          />
          <Button type="submit" label="Crear ciclo" :loading="isCreatingTerm" />
        </form>
        <small v-if="termErrors.descripcion" class="field-error">{{
          termErrors.descripcion
        }}</small>
      </div>
    </section>

    <!-- Paso 2 -->
    <section class="step-card" :class="{ 'is-done': gruposResumen !== null }">
      <div class="step-head">
        <span class="step-num">{{ gruposResumen !== null ? '✓' : '2' }}</span>
        <div class="step-title">
          <h3>Archivo de Secuencias con cupos</h3>
          <p>Define los grupos disponibles y su cupo por carrera.</p>
        </div>
      </div>
      <div class="step-body">
        <input
          ref="fileSecuenciasInput"
          type="file"
          accept=".xlsx, .xls"
          style="display: none"
          @change="handleSecuenciasSelect"
        />
        <Button
          label="Seleccionar archivo"
          severity="secondary"
          outlined
          :disabled="termId === null || isUploadingGrupos"
          :loading="isUploadingGrupos"
          @click="fileSecuenciasInput?.click()"
        />
        <span class="file-name" :class="{ 'has-file': secuenciasFileName }">
          {{ secuenciasFileName ?? 'Ningún archivo seleccionado' }}
        </span>
        <details v-if="gruposResumen && gruposResumen.omitidos.length > 0" class="panel">
          <summary>{{ gruposResumen.omitidos.length }} secuencia(s) omitida(s)</summary>
          <ul>
            <li v-for="(o, i) in gruposResumen.omitidos" :key="i">
              {{ o.secuencia }}: {{ o.motivo }}
            </li>
          </ul>
        </details>
      </div>
    </section>

    <!-- Paso 3 -->
    <section class="step-card" :class="{ 'is-done': alumnosResumen !== null }">
      <div class="step-head">
        <span class="step-num">{{ alumnosResumen !== null ? '✓' : '3' }}</span>
        <div class="step-title">
          <h3>Archivo de Aspirantes inscritos</h3>
          <p>Se registran en el ciclo escolar y se les calcula distancia a UPIICSA.</p>
        </div>
      </div>
      <div class="step-body">
        <input
          ref="fileAspirantesInput"
          type="file"
          accept=".xlsx, .xls"
          style="display: none"
          @change="handleAspirantesSelect"
        />
        <Button
          label="Seleccionar archivo"
          severity="secondary"
          outlined
          :disabled="termId === null || isUploadingAlumnos"
          :loading="isUploadingAlumnos"
          @click="fileAspirantesInput?.click()"
        />
        <span class="file-name" :class="{ 'has-file': aspirantesFileName }">
          {{ aspirantesFileName ?? 'Ningún archivo seleccionado' }}
        </span>
        <div v-if="alumnosResumen" class="panel full-width">
          <p>
            Total en archivo: {{ alumnosResumen.total }} · Insertados:
            {{ alumnosResumen.insertados }} · Duplicados: {{ alumnosResumen.duplicados.length }} ·
            Fallidos: {{ alumnosResumen.fallidos.length }} · Omitidos antes de enviar:
            {{ alumnosResumen.omitidosLocal.length }}
          </p>
          <details
            v-if="alumnosResumen.fallidos.length > 0 || alumnosResumen.omitidosLocal.length > 0"
          >
            <summary>Ver detalle de los que no se insertaron</summary>
            <ul>
              <li v-for="(f, i) in alumnosResumen.fallidos" :key="`f${i}`">
                {{ f.pr }}: {{ f.motivo }}
              </li>
              <li v-for="(o, i) in alumnosResumen.omitidosLocal" :key="`o${i}`">
                {{ o.pr ?? '(sin PR)' }}: {{ o.motivo }}
              </li>
            </ul>
          </details>
        </div>
      </div>
    </section>

    <!-- Paso 4 -->
    <section class="step-card">
      <div class="step-head">
        <span class="step-num">4</span>
        <div class="step-title">
          <h3>Conteo por carrera</h3>
          <p>Revisa cuántos alumnos hay registrados antes de asignar grupos.</p>
        </div>
      </div>
      <div class="step-body">
        <Button
          label="Ver conteo"
          severity="secondary"
          outlined
          :disabled="termId === null || isLoadingConteo"
          :loading="isLoadingConteo"
          @click="handleConteo"
        />
        <DataTable v-if="conteo" class="full-width" :value="conteoRows()" size="small">
          <Column field="descripcion" header="Carrera" />
          <Column field="total" header="Total" />
          <Column field="hombres" header="Hombres" />
          <Column field="mujeres" header="Mujeres" />
        </DataTable>
      </div>
    </section>

    <Button
      label="Asignar grupos y exportar Excel"
      class="btn-generate"
      :loading="isAsignando"
      :disabled="termId === null"
      @click="handleAsignarYExportar"
    />
  </div>
</template>

<style scoped>
.generator {
  max-width: 760px;
}

.generator-head {
  text-align: center;
  margin-bottom: 1.5rem;
}

.generator-head h2 {
  color: var(--p-text-color);
  margin-bottom: 0.35rem;
}

.step-card {
  background: var(--p-content-background);
  border: 1px solid var(--p-content-border-color);
  border-left: 3px solid var(--p-content-border-color);
  border-radius: 10px;
  padding: 1.25rem 1.5rem;
  margin-bottom: 1.1rem;
  transition: border-color 0.25s;
}

.step-card.is-done {
  border-left-color: var(--p-primary-color);
}

.step-head {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
}

.step-num {
  flex: 0 0 auto;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--p-content-border-color);
  border: 1px solid var(--p-content-border-color);
  color: var(--p-text-muted-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.95rem;
}

.step-card.is-done .step-num {
  background: var(--p-primary-color);
  border-color: var(--p-primary-color);
  color: var(--p-primary-contrast-color);
}

.step-title h3 {
  margin: 0.2rem 0 0.15rem;
  color: var(--p-text-color);
  font-size: 1.05rem;
}

.step-title p {
  margin: 0;
  font-size: 0.85rem;
  color: var(--p-text-muted-color);
}

.step-body {
  margin-top: 1rem;
  padding-left: calc(34px + 1rem);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem 1rem;
}

.term-form {
  display: flex;
  gap: 0.5rem;
}

.field-error {
  color: var(--p-red-400);
  width: 100%;
}

.file-name {
  font-size: 0.9rem;
  color: var(--p-text-muted-color);
  font-style: italic;
}

.file-name.has-file {
  color: var(--p-text-color);
  font-style: normal;
  font-weight: 600;
}

.file-name.has-file::before {
  content: '📄 ';
  font-style: normal;
}

.panel {
  margin-top: 0.75rem;
  text-align: left;
  background: var(--p-content-background);
  border: 1px solid var(--p-content-border-color);
  padding: 1rem;
  border-radius: 8px;
}

.full-width {
  flex: 1 1 100%;
  margin-top: 0.5rem;
}

.btn-generate {
  display: block;
  width: 100%;
  margin-top: 1.5rem;
}
</style>
