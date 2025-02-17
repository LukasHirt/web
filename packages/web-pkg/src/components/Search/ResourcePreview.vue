<template>
  <oc-button
    :type="resource.isFolder ? 'router-link' : 'button'"
    justify-content="left"
    class="files-search-preview oc-flex oc-width-1-1"
    appearance="raw"
    v-bind="attrs"
    v-on="listeners"
  >
    <oc-resource
      :resource="resource"
      :is-path-displayed="true"
      :is-resource-clickable="false"
      :parent-folder-link="parentFolderLink"
      :parent-folder-link-icon-additional-attributes="parentFolderLinkIconAdditionalAttributes"
      :parent-folder-name="parentFolderName"
      :is-thumbnail-displayed="displayThumbnails"
      @parent-folder-clicked="parentFolderClicked"
    />
  </oc-button>
</template>

<script lang="ts">
import { ImageDimension } from '../../constants'
import { VisibilityObserver } from '../../observer'
import { debounce } from 'lodash-es'
import { computed, defineComponent, PropType, ref, unref } from 'vue'
import { mapGetters } from 'vuex'
import { createLocationShares, createLocationSpaces } from '../../router'
import { dirname } from 'path'
import {
  useCapabilityShareJailEnabled,
  useGetMatchingSpace,
  useFileActions
} from '../../composables'
import {
  extractParentFolderName,
  isProjectSpaceResource,
  isShareRoot,
  isShareSpaceResource,
  Resource
} from '@ownclouders/web-client/src/helpers'
import { eventBus } from '../../services'
import { createFileRouteOptions, isResourceTxtFileAlmostEmpty } from '../../helpers'
import { SearchResultValue } from './types'

const visibilityObserver = new VisibilityObserver()

export default defineComponent({
  props: {
    searchResult: {
      type: Object as PropType<SearchResultValue>,
      default: function () {
        return {}
      }
    },
    provider: {
      type: Object,
      default: function () {
        return {}
      }
    }
  },
  setup(props) {
    const { getInternalSpace, getMatchingSpace } = useGetMatchingSpace()
    const previewData = ref()

    const resource = computed((): Resource => {
      return {
        ...(props.searchResult.data as Resource),
        ...(unref(previewData) &&
          ({
            thumbnail: unref(previewData)
          } as Resource))
      }
    })

    const resourceDisabled = computed(() => {
      return unref(resource).disabled === true
    })

    return {
      ...useFileActions(),
      getInternalSpace,
      getMatchingSpace,
      hasShareJail: useCapabilityShareJailEnabled(),
      previewData,
      resource,
      resourceDisabled
    }
  },
  computed: {
    ...mapGetters(['configuration']),
    ...mapGetters('runtime/spaces', ['spaces']),

    attrs() {
      return this.resource.isFolder
        ? {
            to: this.createFolderLink(this.resource.path, this.resource.fileId)
          }
        : {}
    },
    listeners() {
      return this.resource.isFolder
        ? {}
        : {
            click: () =>
              this.triggerDefaultAction({
                space: this.matchingSpace,
                resources: [this.resource]
              })
          }
    },
    matchingSpace() {
      return this.getMatchingSpace(this.resource)
    },
    parentFolderName() {
      if (isShareRoot(this.resource)) {
        return this.$gettext('Shared with me')
      }

      const parentFolder = extractParentFolderName(this.resource)
      if (parentFolder) {
        return parentFolder
      }

      if (!this.hasShareJail) {
        return this.$gettext('All files and folders')
      }

      if (isProjectSpaceResource(this.resource)) {
        return this.$gettext('Spaces')
      }

      if (isProjectSpaceResource(this.matchingSpace) || isShareSpaceResource(this.matchingSpace)) {
        return this.matchingSpace.name
      }

      return this.$gettext('Personal')
    },
    displayThumbnails() {
      return (
        !this.configuration?.options?.disablePreviews &&
        !isResourceTxtFileAlmostEmpty(this.resource)
      )
    },
    folderLink() {
      return this.createFolderLink(this.resource.path, this.resource.fileId)
    },
    parentFolderLink() {
      if (this.resource.shareId && this.resource.path === '/') {
        return createLocationShares('files-shares-with-me')
      }
      if (isProjectSpaceResource(this.resource)) {
        return createLocationSpaces('files-spaces-projects')
      }
      return this.createFolderLink(dirname(this.resource.path), this.resource.parentFolderId)
    },

    parentFolderLinkIconAdditionalAttributes() {
      // Identify if resource is project space or is part of a project space and the resource is located in its root
      if (
        isProjectSpaceResource(this.resource) ||
        (isProjectSpaceResource(
          this.getInternalSpace(this.resource.storageId) || ({} as Resource)
        ) &&
          this.resource.path.split('/').length === 2)
      ) {
        return {
          name: 'layout-grid',
          'fill-type': 'fill'
        }
      }

      return {}
    }
  },
  mounted() {
    if (this.resourceDisabled) {
      this.$el.parentElement.classList.add('disabled')
    }

    if (!this.displayThumbnails) {
      return
    }

    const debounced = debounce(async ({ unobserve }) => {
      unobserve()
      const preview = await this.$previewService.loadPreview(
        {
          space: this.matchingSpace,
          resource: this.resource,
          dimensions: ImageDimension.Thumbnail
        },
        true
      )
      preview && (this.previewData = preview)
    }, 250)

    visibilityObserver.observe(this.$el, { onEnter: debounced, onExit: debounced.cancel })
  },
  beforeUnmount() {
    visibilityObserver.disconnect()
  },
  methods: {
    parentFolderClicked() {
      eventBus.publish('app.search.options-drop.hide')
    },
    createFolderLink(p: string, fileId: string | number) {
      if (!this.matchingSpace) {
        return {}
      }

      return createLocationSpaces(
        'files-spaces-generic',
        createFileRouteOptions(this.matchingSpace, { path: p, fileId })
      )
    }
  }
})
</script>
