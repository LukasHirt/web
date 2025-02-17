import {
  createStore,
  defaultComponentMocks,
  defaultStoreMockOptions,
  mount,
  defaultPlugins,
  mockAxiosResolve
} from 'web-test-helpers'
import TagsPanel from 'web-app-files/src/components/SideBar/TagsPanel.vue'
import { mockDeep } from 'jest-mock-extended'
import { Resource } from '@ownclouders/web-client'
import { ClientService, eventBus } from '@ownclouders/web-pkg'

jest.mock('@ownclouders/web-pkg', () => ({
  ...jest.requireActual('@ownclouders/web-pkg'),
  useAccessToken: jest.fn()
}))

describe('Tags Panel', () => {
  it('show tags input form if loaded successfully', () => {
    const resource = mockDeep<Resource>({ tags: [] })
    const { wrapper } = createWrapper(resource)
    expect(wrapper.find('#tags-form').exists()).toBeTruthy()
  })

  it('all available tags are selectable', async () => {
    const tags = 'a,b,c'
    const resource = mockDeep<Resource>({ tags: [] })
    const clientService = mockDeep<ClientService>()
    clientService.graphAuthenticated.tags.getTags.mockResolvedValueOnce(
      mockAxiosResolve({ value: tags.split(',') })
    )

    const { wrapper } = createWrapper(resource, clientService)
    await wrapper.vm.loadAvailableTagsTask.last
    expect(wrapper.findComponent<any>('vue-select-stub').props('options')).toEqual([
      { label: 'a' },
      { label: 'b' },
      { label: 'c' }
    ])
  })

  describe('save method', () => {
    it('publishes the "save"-event', async () => {
      const eventStub = jest.spyOn(eventBus, 'publish')
      const tags = ['a', 'b']
      const resource = mockDeep<Resource>({ tags: tags })
      const { wrapper } = createWrapper(resource, mockDeep<ClientService>(), false)
      await wrapper.vm.save(tags)
      expect(eventStub).toHaveBeenCalled()
    })
  })

  test.each<[string[], { label: string }[], string[]]>([
    [['a', 'b'], [{ label: 'c' }], ['c']],
    [['a', 'b'], [{ label: 'a' }, { label: 'b' }, { label: 'c' }], ['c']],
    [
      ['a', 'b'],
      [{ label: 'a' }, { label: 'b' }, { label: 'c' }, { label: 'd' }],
      ['c', 'd']
    ]
  ])(
    'resource with the initial tags %s and selected tags %s adds %s',
    async (resourceTags, selectedTags, expected) => {
      const resource = mockDeep<Resource>({ tags: resourceTags })
      const clientService = mockDeep<ClientService>()
      const stub = clientService.graphAuthenticated.tags.assignTags.mockImplementation()
      const { wrapper } = createWrapper(resource, clientService, false)

      wrapper.vm.selectedTags = selectedTags

      await wrapper.vm.save(selectedTags)

      /* eslint-disable jest/no-conditional-expect*/
      if (expected.length) {
        expect(stub).toHaveBeenCalledWith(
          expect.objectContaining({
            tags: expected
          })
        )
      } else {
        expect(stub).not.toHaveBeenCalled()
      }
    }
  )

  test.each<[string[], { label: string }[], string[]]>([
    [['a', 'b'], [{ label: 'a' }], ['b']],
    [['a', 'b'], [{ label: 'a' }, { label: 'b' }, { label: 'c' }], []],
    [['a', 'b'], [], ['a', 'b']]
  ])(
    'resource with the initial tags %s and selected tags %s removes %s',
    async (resourceTags, selectedTags, expected) => {
      const resource = mockDeep<Resource>({ tags: resourceTags })
      const clientService = mockDeep<ClientService>()
      const stub = clientService.graphAuthenticated.tags.unassignTags.mockImplementation()
      const { wrapper } = createWrapper(resource, clientService, false)

      wrapper.vm.selectedTags = selectedTags

      await wrapper.vm.save(selectedTags)

      /* eslint-disable jest/no-conditional-expect*/
      if (expected.length) {
        expect(stub).toHaveBeenCalledWith(
          expect.objectContaining({
            tags: expected
          })
        )
      } else {
        expect(stub).not.toHaveBeenCalled()
      }
    }
  )

  it('shows message on failure', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    const clientService = mockDeep<ClientService>()
    const assignTagsStub = clientService.graphAuthenticated.tags.assignTags
      .mockImplementation()
      .mockRejectedValue(new Error())
    const resource = mockDeep<Resource>({ tags: ['a'] })
    const eventStub = jest.spyOn(eventBus, 'publish')
    const { wrapper, storeOptions } = createWrapper(resource, clientService)
    wrapper.vm.selectedTags.push('b')
    await wrapper.vm.save(wrapper.vm.selectedTags)
    expect(assignTagsStub).toHaveBeenCalled()
    expect(eventStub).not.toHaveBeenCalled()
    expect(storeOptions.actions.showErrorMessage).toHaveBeenCalled()
  })

  it('does not accept tags consisting of blanks only', () => {
    const { wrapper } = createWrapper(mockDeep<Resource>({ tags: [] }))
    const option = wrapper.vm.createOption(' ')
    expect(option.error).toBeDefined()
    expect(option.selectable).toBeFalsy()
  })
})

function createWrapper(resource, clientService = mockDeep<ClientService>(), stubVueSelect = true) {
  const storeOptions = defaultStoreMockOptions
  const store = createStore(storeOptions)
  const mocks = { ...defaultComponentMocks(), $clientService: clientService }
  return {
    storeOptions,
    wrapper: mount(TagsPanel, {
      global: {
        plugins: [...defaultPlugins(), store],
        mocks,
        provide: { ...mocks, resource },
        stubs: { VueSelect: stubVueSelect, CompareSaveDialog: true }
      }
    })
  }
}
