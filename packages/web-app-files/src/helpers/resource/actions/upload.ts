import { Language } from 'vue3-gettext'
import { Store } from 'vuex'
import { Resource } from '@ownclouders/web-client'
import { extractExtensionFromFile } from '@ownclouders/web-client/src/helpers'
import {
  ConflictDialog,
  ResolveConflict,
  resolveFileNameDuplicate,
  ResolveStrategy,
  UppyResource
} from '@ownclouders/web-pkg'

interface ConflictedResource {
  name: string
  type: string
}

export class ResourceConflict extends ConflictDialog {
  store: Store<any>

  constructor(store: Store<any>, language: Language) {
    const { $gettext, $ngettext } = language
    super(
      (modal) => store.dispatch('createModal', modal),
      () => store.dispatch('hideModal'),
      (msg) => store.dispatch('showMessage', msg),
      (msg) => store.dispatch('showErrorMessage', msg),
      $gettext,
      $ngettext
    )

    this.store = store
  }

  get files(): Resource[] {
    return this.store.getters['Files/files']
  }

  getConflicts(files: UppyResource[]): ConflictedResource[] {
    const conflicts: ConflictedResource[] = []
    for (const file of files) {
      const relativeFilePath = file.meta.relativePath
      if (relativeFilePath) {
        // Logic for folders, applies to all files inside folder and subfolders
        const rootFolder = relativeFilePath.replace(/^\/+/, '').split('/')[0]
        const exists = this.files.find((f) => f.name === rootFolder)
        if (exists) {
          if (conflicts.some((conflict) => conflict.name === rootFolder)) {
            continue
          }
          conflicts.push({ name: rootFolder, type: 'folder' })
          continue
        }
      }
      // Logic for files
      const exists = this.files.find((f) => f.name === file.name && !file.meta.relativeFolder)
      if (exists) {
        conflicts.push({ name: file.name, type: 'file' })
      }
    }
    return conflicts
  }

  async displayOverwriteDialog(
    files: UppyResource[],
    conflicts: ConflictedResource[]
  ): Promise<UppyResource[]> {
    let fileCount = 0
    let folderCount = 0
    const resolvedFileConflicts = []
    const resolvedFolderConflicts = []
    let doForAllConflicts = false
    let allConflictsStrategy
    let doForAllConflictsFolders = false
    let allConflictsStrategyFolders

    for (const conflict of conflicts) {
      const isFolder = conflict.type === 'folder'
      const conflictArray = isFolder ? resolvedFolderConflicts : resolvedFileConflicts

      if (doForAllConflicts && !isFolder) {
        conflictArray.push({
          name: conflict.name,
          strategy: allConflictsStrategy
        })
        continue
      }
      if (doForAllConflictsFolders && isFolder) {
        conflictArray.push({
          name: conflict.name,
          strategy: allConflictsStrategyFolders
        })
        continue
      }

      const conflictsLeft =
        conflicts.filter((c) => c.type === conflict.type).length -
        (isFolder ? folderCount : fileCount)

      const resolvedConflict: ResolveConflict = await this.resolveFileExists(
        { name: conflict.name, isFolder } as Resource,
        conflictsLeft,
        conflictsLeft === 1,
        isFolder,
        true
      )
      isFolder ? folderCount++ : fileCount++
      if (resolvedConflict.doForAllConflicts) {
        if (isFolder) {
          doForAllConflictsFolders = true
          allConflictsStrategyFolders = resolvedConflict.strategy
        } else {
          doForAllConflicts = true
          allConflictsStrategy = resolvedConflict.strategy
        }
      }

      conflictArray.push({
        name: conflict.name,
        strategy: resolvedConflict.strategy
      })
    }
    const filesToSkip = resolvedFileConflicts
      .filter((e) => e.strategy === ResolveStrategy.SKIP)
      .map((e) => e.name)
    const foldersToSkip = resolvedFolderConflicts
      .filter((e) => e.strategy === ResolveStrategy.SKIP)
      .map((e) => e.name)

    files = files.filter((e) => !filesToSkip.includes(e.name))
    files = files.filter(
      (file) =>
        !foldersToSkip.some((folderName) => file.meta.relativeFolder.split('/')[1] === folderName)
    )

    const filesToKeepBoth = resolvedFileConflicts
      .filter((e) => e.strategy === ResolveStrategy.KEEP_BOTH)
      .map((e) => e.name)
    const foldersToKeepBoth = resolvedFolderConflicts
      .filter((e) => e.strategy === ResolveStrategy.KEEP_BOTH)
      .map((e) => e.name)

    for (const fileName of filesToKeepBoth) {
      const file = files.find((e) => e.name === fileName && !e.meta.relativeFolder)
      const extension = extractExtensionFromFile({ name: fileName } as Resource)
      file.name = resolveFileNameDuplicate(fileName, extension, this.files)
      file.meta.name = file.name
      if (file.xhrUpload?.endpoint) {
        file.xhrUpload.endpoint = file.xhrUpload.endpoint.replace(
          new RegExp(`/${encodeURIComponent(fileName)}`),
          `/${encodeURIComponent(file.name)}`
        )
      }
    }
    for (const folder of foldersToKeepBoth) {
      const filesInFolder = files.filter((e) => e.meta.relativeFolder.split('/')[1] === folder)
      for (const file of filesInFolder) {
        const newFolderName = resolveFileNameDuplicate(folder, '', this.files)
        file.meta.relativeFolder = file.meta.relativeFolder.replace(
          new RegExp(`/${folder}`),
          `/${newFolderName}`
        )
        file.meta.relativePath = file.meta.relativePath.replace(
          new RegExp(`/${folder}/`),
          `/${newFolderName}/`
        )
        file.meta.tusEndpoint = file.meta.tusEndpoint.replace(
          new RegExp(`/${encodeURIComponent(folder)}`),
          `/${encodeURIComponent(newFolderName)}`
        )
        if (file.xhrUpload?.endpoint) {
          file.xhrUpload.endpoint = file.xhrUpload.endpoint.replace(
            new RegExp(`/${encodeURIComponent(folder)}`),
            `/${encodeURIComponent(newFolderName)}`
          )
        }
        if (file.tus?.endpoint) {
          file.tus.endpoint = file.tus.endpoint.replace(
            new RegExp(`/${encodeURIComponent(folder)}`),
            `/${encodeURIComponent(newFolderName)}`
          )
        }
      }
    }
    return files
  }
}
