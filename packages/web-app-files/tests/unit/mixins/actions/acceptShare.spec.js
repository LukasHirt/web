import Vuex from 'vuex'
import { mount, createLocalVue } from '@vue/test-utils'
import acceptShare from '@files/src/mixins/actions/acceptShare.js'
import { ShareStatus } from '@files/src/helpers/share'

const localVue = createLocalVue()
localVue.use(Vuex)

describe('acceptShare', () => {
  const Component = {
    render() {},
    mixins: [acceptShare]
  }

  function getWrapper(
    route = {
      name: 'files-shared-with-me'
    }
  ) {
    return mount(Component, {
      localVue,
      mocks: {
        $route: route
      }
    })
  }

  describe('computed property "$_acceptShare_items"', () => {
    describe('isEnabled property of returned element', () => {
      it.each([
        { resources: [{ status: ShareStatus.pending }], expectedStatus: true },
        { resources: [{ status: ShareStatus.declined }], expectedStatus: true },
        { resources: [{ status: ShareStatus.accepted }], expectedStatus: false }
      ])(
        'should be set according to the resource share status if the route name is "files-shared-with-me"',
        (inputData) => {
          const wrapper = getWrapper()

          const resources = inputData.resources
          expect(wrapper.vm.$_acceptShare_items[0].isEnabled({ resources })).toBe(
            inputData.expectedStatus
          )
        }
      )
      it.each([
        { status: ShareStatus.pending },
        { status: ShareStatus.declined },
        { status: ShareStatus.accepted }
      ])(
        'should be set as false if the route name is other than "files-shared-with-me"',
        (resource) => {
          const wrapper = getWrapper({ name: 'files-shared-with-others' })

          expect(wrapper.vm.$_acceptShare_items[0].isEnabled({ resource })).toBeFalsy()
        }
      )
    })
  })
})
