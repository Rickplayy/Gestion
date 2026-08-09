import { defineStore } from 'pinia';
import { ref } from 'vue';

export type BreadcrumbItem = {
  label: string;
  to?: string;
};

export const useBreadcrumbStore = defineStore('breadcrumb', () => {
  const items = ref<BreadcrumbItem[]>([]);

  function setItems(next: BreadcrumbItem[]) {
    items.value = next;
  }

  return { items, setItems };
});
