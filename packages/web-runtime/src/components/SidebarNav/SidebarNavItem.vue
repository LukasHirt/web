<template>
  <li class="oc-sidebar-nav-item oc-pb-xs oc-px-s" :aria-current="active ? 'page' : null">
    <oc-button
      v-oc-tooltip="toolTip"
      type="router-link"
      :appearance="active ? 'raw-inverse' : 'raw'"
      :variation="active ? 'primary' : 'passive'"
      :class="['oc-sidebar-nav-item-link', { active: active }]"
      :to="target"
      :data-nav-id="index"
      :data-nav-name="navName"
    >
      <span class="oc-flex">
        <oc-icon :name="icon" :fill-type="fillType" variation="inherit" />
        <span class="oc-ml-m text" :class="{ 'text-invisible': collapsed }" v-text="name" />
      </span>
      <oc-tag v-if="tag" class="oc-py-rm" size="small">{{ tag }}</oc-tag>
    </oc-button>
  </li>
</template>
<script lang="ts">
import { defineComponent, PropType } from 'vue'
import { RouteLocationRaw } from 'vue-router'

export default defineComponent({
  props: {
    name: {
      type: String,
      required: true
    },
    index: {
      type: String,
      required: true
    },
    active: {
      type: Boolean,
      required: false,
      default: false
    },
    target: {
      type: [String, Object] as PropType<RouteLocationRaw>,
      required: false,
      default: null
    },
    icon: {
      type: String,
      required: true
    },
    fillType: {
      type: String,
      required: false,
      default: 'fill'
    },
    collapsed: {
      type: Boolean,
      required: false,
      default: false
    },
    tag: {
      type: String,
      required: false,
      default: null
    }
  },
  computed: {
    navName() {
      return this.$router?.resolve(this.target, this.$route)?.name || 'route.name'
    },
    toolTip() {
      const value = this.collapsed
        ? this.$gettext('Navigate to %{ pageName } page', {
            pageName: this.name
          })
        : ''
      return {
        content: value,
        placement: 'right',
        arrow: false
      }
    }
  }
})
</script>

<style lang="scss">
.oc-sidebar-nav-item-link {
  position: relative;
  align-items: center !important;
  display: flex !important;
  justify-content: space-between !important;
  padding: var(--oc-space-small) !important;
  border-radius: 5px;
  white-space: nowrap;
  user-select: none;

  .oc-tag {
    color: var(--oc-color-text-default);
    background-color: var(--oc-color-background-highlight);
  }
  .text {
    opacity: 1;
    transition: all 0.3s;
  }
  .text-invisible {
    opacity: 0 !important;
    transition: 0s;
  }

  &:hover:not(.active) {
    color: var(--oc-color-swatch-brand-hover) !important;
  }

  &:hover,
  &:focus {
    text-decoration: none !important;
  }
  &.active {
    overflow: hidden;
  }

  .oc-icon svg {
    transition: all 0.3s;
  }
}
</style>
