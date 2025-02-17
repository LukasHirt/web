<template>
  <main :id="applicationId" class="oc-height-1-1" @keydown.esc="closeApp">
    <h1 class="oc-invisible-sr" v-text="pageTitle" />
    <app-top-bar
      v-if="!loading && !loadingError"
      :main-actions="fileActions"
      :resource="resource"
      @close="closeApp"
    />
    <loading-screen v-if="loading" />
    <error-screen v-else-if="loadingError" :message="loadingError.message" />
    <div v-else class="oc-height-1-1">
      <slot v-bind="slotAttrs" />
    </div>
  </main>
</template>

<script lang="ts">
import {
  PropType,
  Ref,
  defineComponent,
  onBeforeUnmount,
  ref,
  unref,
  watch,
  computed,
  onMounted
} from 'vue'
import { DateTime } from 'luxon'
import { useTask } from 'vue-concurrency'
import { useGettext } from 'vue3-gettext'
import { onBeforeRouteLeave } from 'vue-router'

import AppTopBar from '../AppTopBar.vue'
import ErrorScreen from './PartialViews/ErrorScreen.vue'
import LoadingScreen from './PartialViews/LoadingScreen.vue'
import {
  UrlForResourceOptions,
  useAppDefaults,
  useClientService,
  useStore
} from '../../composables'
import { Resource } from '@ownclouders/web-client'
import { DavPermission, DavProperty } from '@ownclouders/web-client/src/webdav/constants'
import { Action, ActionOptions } from '../../composables/actions/types'
import { isProjectSpaceResource } from '@ownclouders/web-client/src/helpers'
import { HttpError } from '@ownclouders/web-client/src/errors'
import { ModifierKey, Key, useKeyboardActions } from '../../composables/keyboardActions'
import { useAppMeta } from '../../composables/appDefaults/useAppMeta'

export default defineComponent({
  name: 'AppWrapper',
  components: {
    AppTopBar,
    ErrorScreen,
    LoadingScreen
  },
  props: {
    // TODO: Add app-top-bar-actions array prop and pass to AppTopBar
    applicationId: {
      type: String,
      required: true
    },
    urlForResourceOptions: {
      type: Object as PropType<UrlForResourceOptions>,
      default: () => null,
      required: false
    },
    wrappedComponent: {
      type: Object as PropType<ReturnType<typeof defineComponent>>,
      default: null
    },
    importResourceWithExtension: {
      type: Function as PropType<(Resource) => string>,
      default: () => null
    }
  },
  setup(props) {
    const { $gettext } = useGettext()
    const store = useStore()

    const applicationName = ref('')
    const resource: Ref<Resource> = ref()
    const currentETag = ref('')
    const url = ref('')
    const loading = ref(true)
    const loadingError: Ref<Error> = ref()
    const isReadOnly = ref(false)
    const serverContent = ref()
    const currentContent = ref()

    const isEditor = computed(() => {
      return Boolean(props.wrappedComponent.emits?.includes('update:currentContent'))
    })

    const hasProp = (name: string) => {
      return Boolean(Object.keys(props.wrappedComponent.props).includes(name))
    }

    const isDirty = computed(() => {
      return unref(currentContent) !== unref(serverContent)
    })

    const preventUnload = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }

    watch(isDirty, (dirty) => {
      // Prevent reload if there are changes
      if (dirty) {
        window.addEventListener('beforeunload', preventUnload)
      } else {
        window.removeEventListener('beforeunload', preventUnload)
      }
    })

    const clientService = useClientService()

    const {
      applicationConfig,
      closeApp,
      currentFileContext,
      getFileContents,
      getFileInfo,
      getUrlForResource,
      loadFolderForFileContext,
      putFileContents,
      replaceInvalidFileRoute,
      revokeUrl
    } = useAppDefaults({
      applicationId: props.applicationId
    })

    const { applicationMeta } = useAppMeta({ applicationId: props.applicationId, store })

    const pageTitle = computed(() => {
      const { name: appName } = unref(applicationMeta)

      return $gettext(`%{appName} for %{fileName}`, {
        appName: unref(applicationName) || $gettext(appName),
        fileName: unref(unref(currentFileContext).fileName)
      })
    })

    const loadFileTask = useTask(function* () {
      try {
        resource.value = yield getFileInfo(currentFileContext, {
          davProperties: [DavProperty.FileId, DavProperty.Permissions, DavProperty.Name]
        })

        const space = unref(unref(currentFileContext).space)

        const newExtension = props.importResourceWithExtension(unref(resource))
        if (newExtension) {
          const timestamp = DateTime.local().toFormat('yyyyMMddHHmmss')
          const targetPath = `${unref(resource).name}_${timestamp}.${newExtension}`
          if (
            !(yield clientService.webdav.copyFiles(space, unref(resource), space, {
              path: targetPath
            }))
          ) {
            throw new Error($gettext('Importing failed'))
          }

          resource.value = { path: targetPath } as Resource
        }

        if (replaceInvalidFileRoute(currentFileContext, unref(resource))) {
          return
        }

        isReadOnly.value = ![DavPermission.Updateable, DavPermission.FileUpdateable].some(
          (p) => (unref(resource).permissions || '').indexOf(p) > -1
        )

        if (unref(hasProp('currentContent'))) {
          const fileContentsResponse = yield getFileContents(currentFileContext)
          serverContent.value = currentContent.value = fileContentsResponse.body
          currentETag.value = fileContentsResponse.headers['OC-ETag']
        }

        if (unref(hasProp('url'))) {
          const tmpUrl = yield getUrlForResource(
            space,
            unref(resource),
            props.urlForResourceOptions
          )
          url.value = tmpUrl
        }
        loading.value = false
      } catch (e) {
        console.error(e)
        loadingError.value = e
        loading.value = false
      }
    }).restartable()

    watch(
      currentFileContext,
      () => {
        loadFileTask.perform()
      },
      { immediate: true }
    )

    onBeforeUnmount(() => {
      if (unref(hasProp('url'))) {
        revokeUrl(url.value)
      }
    })

    const errorPopup = (error: HttpError) => {
      console.error(error)
      store.dispatch('showErrorMessage', {
        title: $gettext('An error occurred'),
        desc: error.message,
        error
      })
    }

    const autosavePopup = () => {
      store.dispatch('showMessage', {
        title: $gettext('File autosaved')
      })
    }

    const saveFileTask = useTask(function* () {
      const newContent = unref(currentContent)
      try {
        const putFileContentsResponse = yield putFileContents(currentFileContext, {
          content: newContent,
          previousEntityTag: unref(currentETag)
        })
        serverContent.value = newContent
        currentETag.value = putFileContentsResponse.etag
      } catch (e) {
        switch (e.statusCode) {
          case 401:
          case 403:
            errorPopup(
              new HttpError($gettext("You're not authorized to save this file"), e.response)
            )
            break
          case 409:
          case 412:
            errorPopup(
              new HttpError(
                $gettext(
                  'This file was updated outside this window. Please refresh the page (all changes will be lost).'
                ),
                e.response
              )
            )
            break
          case 507:
            const space = store.getters['runtime/spaces/spaces'].find(
              (space) => space.id === unref(resource).storageId && isProjectSpaceResource(space)
            )
            if (space) {
              errorPopup(
                new HttpError(
                  $gettext('There is not enough quota on "%{spaceName}" to save this file', {
                    spaceName: space.name
                  }),
                  e.response
                )
              )
              break
            }
            errorPopup(
              new HttpError($gettext('There is not enough quota to save this file'), e.response)
            )
            break
          default:
            errorPopup(new HttpError('', e.response))
        }
      }
    }).drop()

    const save = async () => {
      await saveFileTask.perform()
    }

    let autosaveIntervalId = null
    onMounted(() => {
      if (!unref(isEditor)) {
        return
      }
      const editorOptions = store.getters.configuration.options.editor
      if (editorOptions.autosaveEnabled) {
        autosaveIntervalId = setInterval(async () => {
          if (isDirty.value) {
            await save()
            autosavePopup()
          }
        }, (editorOptions.autosaveInterval || 120) * 1000)
      }
    })
    onBeforeUnmount(() => {
      if (!unref(isEditor)) {
        return
      }

      clearInterval(autosaveIntervalId)
      autosaveIntervalId = null
    })

    const { bindKeyAction } = useKeyboardActions({ skipDisabledKeyBindingsCheck: true })
    bindKeyAction({ modifier: ModifierKey.Ctrl, primary: Key.S }, () => {
      if (!unref(isDirty)) {
        return
      }
      save()
    })

    const fileActions = computed((): Action<ActionOptions>[] => [
      {
        name: 'save-file',
        disabledTooltip: () => '',
        isEnabled: () => unref(isEditor),
        isDisabled: () => isReadOnly.value || !isDirty.value,
        componentType: 'button',
        icon: 'save',
        id: 'app-save-action',
        label: () => 'Save',
        handler: () => {
          save()
        }
      }
    ])

    onBeforeRouteLeave((_to, _from, next) => {
      if (unref(isDirty)) {
        const modal = {
          variation: 'danger',
          icon: 'warning',
          title: $gettext('Unsaved changes'),
          message: $gettext('Your changes were not saved. Do you want to save them?'),
          cancelText: $gettext("Don't Save"),
          confirmText: $gettext('Save'),
          onCancel() {
            store.dispatch('hideModal')
            next()
          },
          async onConfirm() {
            await save()
            store.dispatch('hideModal')
            next()
          }
        }
        store.dispatch('createModal', modal)
      } else {
        next()
      }
    })

    const slotAttrs = computed(() => ({
      url: unref(url),
      resource: unref(resource),
      isDirty: unref(isDirty),
      isReadOnly: unref(isReadOnly),
      applicationConfig: unref(applicationConfig),
      currentFileContext: unref(currentFileContext),
      currentContent: unref(currentContent),

      'onUpdate:currentContent': (value) => {
        currentContent.value = value
      },
      'onUpdate:applicationName': (value) => {
        applicationName.value = value
      },

      onSave: save,
      onClose: closeApp
    }))

    return {
      isEditor,
      closeApp,
      fileActions,
      loading,
      loadingError,
      pageTitle,
      resource,
      slotAttrs
    }
  }
})
</script>
