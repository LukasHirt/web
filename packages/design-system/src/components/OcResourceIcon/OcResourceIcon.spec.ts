import { shallowMount } from 'web-test-helpers'
import { AVAILABLE_SIZES } from '../../helpers/constants'
import { OcResourceIcon } from '..'
import { OcResourceIconMapping, ocResourceIconMappingInjectionKey } from './types'
import { Resource } from '@ownclouders/web-client'

const resourceIconMapping: OcResourceIconMapping = {
  extension: {
    'not-a-real-extension': {
      name: 'resource-type-madeup-extension',
      color: 'red'
    }
  },
  mimeType: {
    'not-a-real-mimetype': {
      name: 'resource-type-madeup-mimetype',
      color: 'blue'
    }
  }
}

describe('OcResourceIcon', () => {
  ;['file', 'folder', 'space'].forEach((type) => {
    match({
      type
    })
  })

  match(
    {
      type: 'file',
      extension: 'not-a-real-extension'
    },
    'with extension "not-a-real-extension"'
  )

  match(
    {
      type: 'file',
      mimeType: 'not-a-real-mimetype'
    },
    'with mimetype "not-a-real-mimetype"'
  )
})

function match(resource: Partial<Resource>, additionalText?: string) {
  AVAILABLE_SIZES.forEach((size) => {
    it(`renders OcIcon for resource type ${resource.type}${
      additionalText ? ` ${additionalText}` : ''
    } in size ${size}`, () => {
      const { wrapper } = getWrapper({ resource, size })
      expect(wrapper.html()).toMatchSnapshot()
    })
  })
}

function getWrapper({ resource, size }: { resource: Partial<Resource>; size: string }) {
  return {
    wrapper: shallowMount(OcResourceIcon as any, {
      global: {
        provide: {
          [ocResourceIconMappingInjectionKey]: resourceIconMapping
        }
      },
      props: {
        resource,
        size
      }
    })
  }
}
