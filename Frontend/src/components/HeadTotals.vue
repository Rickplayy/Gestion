<script setup lang="ts">
type Stat = { label: string; value: number | null };

const props = defineProps<{ stats: Stat[] }>();

const visibles = () => props.stats.filter((stat) => stat.value !== null);
</script>

<template>
  <div v-if="visibles().length > 0" class="head-totals">
    <span v-for="stat in visibles()" :key="stat.label">
      <strong>{{ stat.value!.toLocaleString('es-MX') }}</strong> {{ stat.label }}
    </span>
  </div>
</template>

<style scoped>
.head-totals {
  margin-top: 0.4rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.15rem 0.85rem;
  font-size: 0.78rem;
  color: var(--p-text-muted-color);
}

.head-totals strong {
  color: var(--p-text-color);
  font-weight: 700;
}
</style>
