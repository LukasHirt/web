import { defineComponent, h } from 'vue'
import AppWrapper from './AppWrapper.vue'
import { AppWrapperSlotArgs } from './types'
import { UrlForResourceOptions } from '../../composables'
import { Resource } from '@ownclouders/web-client/src'

export function AppWrapperRoute(
  fileEditor: ReturnType<typeof defineComponent>,
  options: {
    applicationId: string
    urlForResourceOptions?: UrlForResourceOptions
    importResourceWithExtension?: (resource: Resource) => string
  }
) {
  return defineComponent({
    render() {
      return h(
        AppWrapper,
        {
          wrappedComponent: fileEditor,
          ...options
        },
        {
          default: (slotArgs: AppWrapperSlotArgs) => {
            return h(fileEditor, slotArgs)
          }
        }
      )
    }
  })
}
