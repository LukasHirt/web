<template>
  <iframe
    v-if="appUrl && method === 'GET'"
    :src="appUrl"
    class="oc-width-1-1 oc-height-1-1"
    :title="iFrameTitle"
    allowfullscreen
  />
  <div v-if="appUrl && method === 'POST' && formParameters" class="oc-height-1-1">
    <form :action="appUrl" target="app-iframe" method="post">
      <input ref="subm" type="submit" :value="formParameters" class="oc-hidden" />
      <div v-for="(item, key, index) in formParameters" :key="index">
        <input :name="key" :value="item" type="hidden" />
      </div>
    </form>
    <iframe
      name="app-iframe"
      class="oc-width-1-1 oc-height-1-1"
      :title="iFrameTitle"
      allowfullscreen
    />
  </div>
</template>

<script lang="ts">
import { stringify } from 'qs'
import { PropType, computed, defineComponent, unref, nextTick, ref, watch, VNodeRef } from 'vue'
import { useTask } from 'vue-concurrency'
import { useGettext } from 'vue3-gettext'

import { Resource } from '@ownclouders/web-client/src'
import { urlJoin } from '@ownclouders/web-client/src/utils'
import { queryItemAsString, useRequest, useRouteQuery, useStore } from '@ownclouders/web-pkg'
import { configurationManager } from '@ownclouders/web-pkg'

export default defineComponent({
  name: 'ExternalApp',
  props: {
    resource: { type: Object as PropType<Resource>, required: true }
  },
  emits: ['update:applicationName'],
  setup(props, { emit }) {
    const language = useGettext()
    const store = useStore()

    const { $gettext } = language
    const { makeRequest } = useRequest()

    const appNameQuery = useRouteQuery('app')
    const appUrl = ref()
    const formParameters = ref({})
    const method = ref()
    const subm: VNodeRef = ref()

    const capabilities = computed(() => store.getters['capabilities'])
    const applicationName = computed(() => {
      const appName = queryItemAsString(unref(appNameQuery))
      emit('update:applicationName', appName)
      return appName
    })

    const iFrameTitle = computed(() => {
      return $gettext('"%{appName}" app content area', {
        appName: unref(applicationName)
      })
    })

    const errorPopup = (error) => {
      store.dispatch('showErrorMessage', {
        title: $gettext('An error occurred'),
        desc: error,
        error
      })
    }

    const loadAppUrl = useTask(function* () {
      try {
        const fileId = props.resource.fileId
        const baseUrl = urlJoin(
          configurationManager.serverUrl,
          unref(capabilities).files.app_providers[0].open_url
        )

        const query = stringify({
          file_id: fileId,
          lang: language.current,
          ...(unref(applicationName) && { app_name: unref(applicationName) })
        })

        const url = `${baseUrl}?${query}`
        const response = yield makeRequest('POST', url, {
          validateStatus: () => true
        })

        if (response.status !== 200) {
          switch (response.status) {
            case 425:
              errorPopup(
                $gettext(
                  'This file is currently being processed and is not yet available for use. Please try again shortly.'
                )
              )
              break
            default:
              errorPopup(response.data?.message)
          }

          const error = new Error('Error fetching app information')
          throw error
        }

        if (!response.data.app_url || !response.data.method) {
          const error = new Error('Error in app server response')
          throw error
        }

        appUrl.value = response.data.app_url
        method.value = response.data.method

        if (response.data.form_parameters) {
          formParameters.value = response.data.form_parameters
        }

        if (method.value === 'POST' && formParameters.value) {
          // eslint-disable-next-line vue/valid-next-tick
          yield nextTick()
          unref(subm).click()
        }
      } catch (e) {
        console.error('web-app-external error', e)
        throw e
      }
    }).restartable()

    watch(
      props.resource,
      () => {
        loadAppUrl.perform()
      },
      { immediate: true }
    )

    return {
      appUrl,
      formParameters,
      iFrameTitle,
      method,
      subm
    }
  }
})
</script>
