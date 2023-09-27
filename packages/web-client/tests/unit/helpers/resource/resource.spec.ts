import {
  extractDomSelector,
  extractExtensionFromFile,
  extractNameWithoutExtension,
  isResourceTxtFileAlmostEmpty
} from '../../../../src/helpers/resource'
import { Resource } from 'web-client'

describe('extractDomSelector', () => {
  it.each([
    { input: '', expected: '' },
    { input: '1', expected: '1' },
    { input: 'a', expected: 'a' },
    { input: '!=?', expected: '' },
    { input: '-_', expected: '-_' },
    { input: '1a!=?-_', expected: '1a-_' },
    {
      input: 'f2dc18fa-ca05-11ec-8c55-0f9df469d22f',
      expected: 'f2dc18fa-ca05-11ec-8c55-0f9df469d22f'
    }
  ])(
    'creates a string that does not break when being used as query selector',
    ({ input, expected }) => {
      expect(extractDomSelector(input)).toBe(expected)
    }
  )
})

const resourceWithoutExtension = {
  name: 'file'
}
const resourceNameWithExtension = {
  name: 'file.txt',
  extension: 'txt'
}
const resourceNameWithExtensionAndDots = {
  name: 'file.dot.txt',
  extension: 'txt'
}

describe('filterResources', () => {
  describe('extractNameWithoutExtension', () => {
    it('should return resource name when there is no extension', () => {
      expect(extractNameWithoutExtension(resourceWithoutExtension as Resource)).toEqual(
        resourceWithoutExtension.name
      )
    })
    it('should return resource name without extension when there is an extension', () => {
      expect(extractNameWithoutExtension(resourceNameWithExtension as Resource)).toEqual('file')
    })
    it('should return resource name with dots without extension when there is an extension', () => {
      expect(extractNameWithoutExtension(resourceNameWithExtensionAndDots as Resource)).toEqual(
        'file.dot'
      )
    })
  })
  describe('extractExtensionFromFile', () => {
    it('should return simple file extension', () => {
      expect(extractExtensionFromFile({ name: 'test.png' } as Resource)).toEqual('png')
    })
    it('should return complex file extension', () => {
      expect(extractExtensionFromFile({ name: 'test.tar.gz' } as Resource)).toEqual('tar.gz')
    })
    it('should return unknown file extension', () => {
      expect(extractExtensionFromFile({ name: 'test.unknown' } as Resource)).toEqual('unknown')
    })
    it('should return no file extension', () => {
      expect(extractExtensionFromFile({ name: 'test' } as Resource)).toEqual('')
    })
    it.each([
      { name: 'afolder', isFolder: true },
      { name: 'afolder', type: 'dir' },
      { name: 'afolder', type: 'folder' }
    ])('should return empty string if folder', (resource) => {
      expect(extractExtensionFromFile(resource as Resource)).toEqual('')
    })
  })
  describe('isResourceTxtFileAlmostEmpty', () => {
    it('return true for resources smaller 30 bytes', () => {
      expect(isResourceTxtFileAlmostEmpty({ mimeType: 'text/plain', size: 20 } as Resource)).toBe(
        true
      )
    })
    it('return false for resources larger 30 bytes', () => {
      expect(isResourceTxtFileAlmostEmpty({ mimeType: 'text/plain', size: 35 } as Resource)).toBe(
        false
      )
    })
    it('return false for resources that are not text', () => {
      expect(
        isResourceTxtFileAlmostEmpty({ mimeType: 'application/json', size: 35 } as Resource)
      ).toBe(false)
    })
    it('return false for resources that have undefined mimeType', () => {
      expect(isResourceTxtFileAlmostEmpty({ mimeType: undefined, size: 35 } as Resource)).toBe(
        false
      )
    })
  })
})
