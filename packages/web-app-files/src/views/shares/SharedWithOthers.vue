<template>
  <div class="oc-flex">
    <files-view-wrapper>
      <app-bar :side-bar-open="sideBarOpen">
        <template #navigation>
          <SharesNavigation />
        </template>
      </app-bar>
      <app-loading-spinner v-if="areResourcesLoading" />
      <template v-else>
        <no-content-message
          v-if="isEmpty"
          id="files-shared-with-others-empty"
          class="files-empty"
          icon="reply"
        >
          <template #message>
            <span v-translate> You have not shared any resources with other people. </span>
          </template>
        </no-content-message>
        <resource-table
          v-else
          id="files-shared-with-others-table"
          v-model:selectedIds="selectedResourcesIds"
          class="files-table"
          :class="{ 'files-table-squashed': sideBarOpen }"
          :fields-displayed="['name', 'sharedWith', 'sdate']"
          :are-thumbnails-displayed="displayThumbnails"
          :are-paths-displayed="true"
          :resources="paginatedResources"
          :header-position="fileListHeaderY"
          :sort-by="sortBy"
          :sort-dir="sortDir"
          :grouping-settings="groupingSettings"
          @file-click="triggerDefaultAction"
          @row-mounted="rowMounted"
          @sort="handleSort"
        >
          <template #contextMenu="{ resource }">
            <context-actions
              v-if="isResourceInSelection(resource)"
              :action-options="{ space: getMatchingSpace(resource), resources: selectedResources }"
            />
          </template>
          <template #footer>
            <pagination :pages="paginationPages" :current-page="paginationPage" />
            <list-info
              v-if="paginatedResources.length > 0"
              class="oc-width-1-1 oc-my-s"
              :files="totalFilesCount.files"
              :folders="totalFilesCount.folders"
            />
          </template>
        </resource-table>
      </template>
    </files-view-wrapper>
    <side-bar
      :open="sideBarOpen"
      :active-panel="sideBarActivePanel"
      :space="selectedResourceSpace"
    />
  </div>
</template>

<script lang="ts">
import { mapGetters, mapState, mapActions } from 'vuex'

import { useFileActions } from '@ownclouders/web-pkg'
import { VisibilityObserver } from '@ownclouders/web-pkg'
import { ImageDimension, ImageType } from '@ownclouders/web-pkg'
import { debounce, find } from 'lodash-es'

import { ResourceTable } from '@ownclouders/web-pkg'
import { AppLoadingSpinner } from '@ownclouders/web-pkg'
import { NoContentMessage } from '@ownclouders/web-pkg'
import { AppBar } from '@ownclouders/web-pkg'
import ListInfo from '../../components/FilesList/ListInfo.vue'
import { Pagination } from '@ownclouders/web-pkg'
import { ContextActions } from '@ownclouders/web-pkg'
import SideBar from '../../components/SideBar/SideBar.vue'
import FilesViewWrapper from '../../components/FilesViewWrapper.vue'

import { useResourcesViewDefaults } from '../../composables'
import { defineComponent } from 'vue'
import { Resource } from '@ownclouders/web-client'
import { useGroupingSettings } from '@ownclouders/web-pkg'
import { useGetMatchingSpace, useMutationSubscription } from '@ownclouders/web-pkg'
import SharesNavigation from 'web-app-files/src/components/AppBar/SharesNavigation.vue'

const visibilityObserver = new VisibilityObserver()

export default defineComponent({
  components: {
    SharesNavigation,
    FilesViewWrapper,
    AppBar,
    ResourceTable,
    AppLoadingSpinner,
    NoContentMessage,
    ListInfo,
    Pagination,
    ContextActions,
    SideBar
  },

  setup() {
    const { getMatchingSpace } = useGetMatchingSpace()

    const resourcesViewDefaults = useResourcesViewDefaults<Resource, any, any[]>()
    const { sortBy, sortDir, loadResourcesTask, selectedResourcesIds, paginatedResources } =
      resourcesViewDefaults

    useMutationSubscription(['Files/UPDATE_RESOURCE_FIELD'], async (mutation) => {
      if (mutation.payload.field === 'shareTypes') {
        if (selectedResourcesIds.value.length !== 1) return
        const id = selectedResourcesIds.value[0]

        const match = find(paginatedResources.value, { id })
        if (!match) return

        await loadResourcesTask.perform()

        const matchedNewResource = find(paginatedResources.value, { fileId: match.fileId })
        if (!matchedNewResource) return

        selectedResourcesIds.value = [matchedNewResource.id]
      }
    })

    return {
      ...useFileActions(),
      ...resourcesViewDefaults,
      getMatchingSpace,

      // CERN
      ...useGroupingSettings({ sortBy, sortDir })
    }
  },

  computed: {
    ...mapState(['app']),
    ...mapState('Files', ['files']),
    ...mapGetters('Files', ['totalFilesCount']),
    ...mapGetters(['configuration', 'user']),

    isEmpty() {
      return this.paginatedResources.length < 1
    },

    displayThumbnails() {
      return !this.configuration?.options?.disablePreviews
    }
  },

  async created() {
    await this.loadResourcesTask.perform()
    this.scrollToResourceFromRoute(this.paginatedResources, 'files-app-bar')
  },

  beforeUnmount() {
    visibilityObserver.disconnect()
  },

  methods: {
    ...mapActions('Files', ['loadPreview', 'loadAvatars']),

    rowMounted(resource, component) {
      const debounced = debounce(({ unobserve }) => {
        unobserve()
        this.loadAvatars({ resource, clientService: this.$clientService })

        if (!this.displayThumbnails) {
          return
        }

        this.loadPreview({
          previewService: this.$previewService,
          space: this.getMatchingSpace(resource),
          resource,
          dimensions: ImageDimension.Thumbnail,
          type: ImageType.Thumbnail
        })
      }, 250)

      visibilityObserver.observe(component.$el, { onEnter: debounced, onExit: debounced.cancel })
    }
  }
})
</script>
