import get from 'lodash-es/get'
import isEqual from 'lodash-es/isEqual'
import { stringify } from 'qs'
import { Store } from 'vuex'
import { cacheService } from '../cache'
import { ClientService } from '../client'
import { ConfigurationManager } from '../../configuration'
import { encodePath } from '../../utils'
import { isPublicSpaceResource } from '@ownclouders/web-client/src/helpers'
import { BuildQueryStringOptions, LoadPreviewOptions, PreviewCapability } from '.'

export class PreviewService {
  store: Store<unknown>
  clientService: ClientService
  configurationManager: ConfigurationManager

  capability?: PreviewCapability

  constructor({
    store,
    clientService,
    configurationManager
  }: {
    store: Store<unknown>
    clientService: ClientService
    configurationManager: ConfigurationManager
  }) {
    this.store = store
    this.clientService = clientService
    this.configurationManager = configurationManager

    this.capability = get(store, 'getters.capabilities.files.thumbnail', {
      enabled: true,
      version: 'v0.1',
      supportedMimeTypes: store.getters.configuration?.options?.previewFileMimeTypes || []
    })
  }

  private get available(): boolean {
    return !!this.capability?.version
  }

  private get supportedMimeTypes() {
    return this.capability?.supportedMimeTypes || []
  }

  private get userId() {
    return this.store.getters.user.id
  }

  private get token() {
    return this.store.getters['runtime/auth/accessToken']
  }

  private get serverUrl() {
    return this.configurationManager.serverUrl
  }

  public isMimetypeSupported(mimeType: string, onlyImages = false) {
    if (!this.supportedMimeTypes.length) {
      return true
    }
    const mimeTypes = this.getSupportedMimeTypes(onlyImages ? 'image/' : null)
    return mimeTypes.includes(mimeType)
  }

  public getSupportedMimeTypes(filter?: string) {
    if (!filter) {
      return this.supportedMimeTypes
    }
    return this.supportedMimeTypes.filter((mimeType) => mimeType.startsWith(filter))
  }

  public loadPreview(options: LoadPreviewOptions, cached = false): Promise<string> {
    const { space, resource } = options
    const serverSupportsPreview = this.available && this.isMimetypeSupported(resource.mimeType)
    const resourceSupportsPreview = resource.type !== 'folder' && resource.extension
    if (!serverSupportsPreview || !resourceSupportsPreview) {
      return undefined
    }

    const isPublic = isPublicSpaceResource(space)
    if (!isPublic && (!this.serverUrl || !this.userId || !this.token)) {
      return undefined
    }

    if (isPublic) {
      return this.publicPreviewUrl(options)
    }
    return this.privatePreviewBlob(options, cached)
  }

  private async cacheFactory(options: LoadPreviewOptions): Promise<string> {
    const { resource, dimensions } = options
    const hit = cacheService.filePreview.get(resource.id.toString())

    if (hit && hit.etag === resource.etag && isEqual(dimensions, hit.dimensions)) {
      return hit.src
    }
    try {
      const src = await this.privatePreviewBlob(options)
      return cacheService.filePreview.set(
        resource.id.toString(),
        { src, etag: resource.etag, dimensions },
        0
      ).src
    } catch (ignored) {}
  }

  private buildQueryString(options: BuildQueryStringOptions): string {
    return stringify({
      scalingup: options.scalingup || 0,
      preview: Object.hasOwnProperty.call(options, 'preview') ? options.preview : 1,
      a: Object.hasOwnProperty.call(options, 'a') ? options.a : 1,
      ...(options.processor && { processor: options.processor }),
      ...(options.etag && { c: options.etag.replaceAll('"', '') }),
      ...(options.dimensions && options.dimensions[0] && { x: options.dimensions[0] }),
      ...(options.dimensions && options.dimensions[1] && { y: options.dimensions[1] })
    })
  }

  private async privatePreviewBlob(options: LoadPreviewOptions, cached = false): Promise<string> {
    const { resource, dimensions, processor } = options
    if (cached) {
      return this.cacheFactory(options)
    }

    const url = [
      this.serverUrl,
      'remote.php/dav',
      encodePath(resource.webDavPath),
      '?',
      this.buildQueryString({ etag: resource.etag, dimensions, processor })
    ].join('')
    try {
      const { data } = await this.clientService.httpAuthenticated.get(url, {
        responseType: 'blob'
      })
      return window.URL.createObjectURL(data)
    } catch (ignored) {}
  }

  private async publicPreviewUrl(options: LoadPreviewOptions): Promise<string> {
    const { resource, dimensions, processor } = options
    // In a public context, i.e. public shares, the downloadURL contains a pre-signed url to
    // download the file.
    const [url, signedQuery] = resource.downloadURL.split('?')

    // Since the pre-signed url contains query parameters and the caller of this method
    // can also provide query parameters we have to combine them.
    const combinedQuery = [
      this.buildQueryString({ etag: resource.etag, dimensions, processor }),
      signedQuery
    ]
      .filter(Boolean)
      .join('&')

    const previewUrl = [url, combinedQuery].filter(Boolean).join('?')
    const { status } = await this.clientService.httpUnAuthenticated.head(previewUrl)

    if (status !== 404) {
      return previewUrl
    }
  }
}
