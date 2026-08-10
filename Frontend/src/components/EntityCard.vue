<script setup lang="ts">
defineProps<{ title: string }>();
defineEmits<{ click: [] }>();
</script>

<template>
  <div
    class="entity-card"
    role="button"
    tabindex="0"
    @click="$emit('click')"
    @keydown.enter="$emit('click')"
    @keydown.space.prevent="$emit('click')"
  >
    <div>
      <div class="entity-card-title">{{ title }}</div>
      <div class="entity-card-meta">
        <slot />
      </div>
    </div>
    <div class="entity-card-end">
      <slot name="actions" />
      <i class="pi pi-angle-right entity-card-chevron" />
    </div>
  </div>
</template>

<style scoped>
.entity-card {
  background: var(--p-content-background);
  border: 1px solid var(--p-content-border-color);
  border-radius: 10px;
  padding: 1.1rem 1.25rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  text-align: left;
  transition:
    border-color 0.2s,
    transform 0.15s;
  width: 100%;
}

.entity-card:hover {
  border-color: var(--p-primary-color);
  transform: translateY(-1px);
}

.entity-card:focus-visible {
  outline: 2px solid var(--p-primary-color);
  outline-offset: 2px;
}

.entity-card-title {
  font-weight: 600;
  font-size: 1rem;
  color: var(--p-text-color);
}

.entity-card-meta {
  margin-top: 0.5rem;
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.entity-card-end {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.entity-card-chevron {
  color: var(--p-text-muted-color);
}
</style>
