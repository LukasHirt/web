import { checkRoute, isPublicFilesRoute } from '../../helpers/route'

import {
  isDownloadAsArchiveAvailable,
  triggerDownloadAsArchive
} from '../../helpers/download/downloadAsArchive'

export default {
  computed: {
    $_downloadFolder_items() {
      return [
        {
          name: 'download-archive',
          icon: 'archive',
          handler: this.$_downloadFolder_trigger,
          label: ({ resources }) => {
            if (resources.length === 1 && resources[0].isFolder) {
              return this.$gettext('Download folder')
            }
            return this.$gettext('Download')
          },
          isEnabled: ({ resources }) => {
            if (
              !checkRoute(
                ['files-personal', 'files-public-list', 'files-favorites'],
                this.$route.name
              )
            ) {
              return false
            }
            if (resources.length === 0) {
              return false
            }
            if (resources.length === 1 && resources[0].isFolder) {
              return false
            }
            if (!isDownloadAsArchiveAvailable()) {
              return false
            }
            const downloadDisabled = resources.some((resource) => {
              return !resource.canDownload()
            })
            return !downloadDisabled
          },
          canBeDefault: true,
          componentType: 'oc-button',
          class: 'oc-files-actions-download-archive-trigger'
        }
      ]
    }
  },
  methods: {
    async $_downloadFolder_trigger({ resources }) {
      await triggerDownloadAsArchive({
        fileIds: resources.map((resource) => resource.fileId),
        ...(isPublicFilesRoute(this.$route) && {
          publicToken: this.$route.params.item.split('/')[0]
        })
      }).catch((e) => {
        console.error(e)
        this.showMessage({
          title: this.$ngettext(
            'Error downloading the selected folder.',
            'Error downloading the selected files.',
            this.selectedFiles.length
          ),
          status: 'danger'
        })
      })
    }
  }
}
