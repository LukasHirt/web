import isEmpty from 'lodash-es/isEmpty'

const state = {
  state: null,
  server: '',
  // auth is the legacy configuration
  auth: {
    clientId: '',
    apiUrl: '',
    authUrl: '',
    metaDataUrl: ''
  },
  // to be used from now on
  openIdConnect: {
    authority: ''
  },
  themes: [],
  commonTheme: {
    name: '',
    solgan: '',
    logo: '',
    accessDeniedHelpUrl: ''
  },
  currentTheme: {
    general: {
      name: '',
      slogan: '',
      privacyUrl: '',
      imprintUrl: ''
    },
    logo: {
      topbar: '',
      favicon: '',
      login: '',
      notFound: ''
    },
    loginPage: {
      autoRedirect: true,
      backgroundImg: ''
    },
    designTokens: {
      colorPalette: {}
    }
  },
  options: {
    contextHelpers: true,
    defaultExtension: 'files',
    openAppsInTab: false,
    editor: {
      autosaveEnabled: false,
      autosaveInterval: 120
    },
    // ugly hack to still have notifications but don't have
    // them blocking UI elements in acceptance/E2E tests
    topCenterNotifications: false,
    disablePreviews: false,
    displayResourcesLazy: true,
    homeFolder: '',
    hoverableQuickActions: false,
    sidebar: {
      shares: {
        showAllOnLoad: false
      }
    },
    previewFileMimeTypes: [],
    runningOnEos: false,
    cernFeatures: false,
    sharingRecipientsPerPage: 200,
    contextHelpersReadMore: true,
    openLinksWithDefaultApp: true,
    tokenStorageLocal: true,
    loginUrl: '',
    privacyUrl: '',
    imprintUrl: '',
    accessDeniedHelpUrl: '',
    disabledExtensions: []
  }
}

const actions = {
  loadConfig({ commit }, config) {
    commit('LOAD_CONFIG', config)

    if (config.external_apps) {
      config.external_apps.forEach((externalApp) => {
        if (externalApp.config !== undefined) {
          commit(
            'LOAD_EXTENSION_CONFIG',
            { id: externalApp.id, config: externalApp.config },
            { root: true }
          )
        }
      })
    }
  },
  loadTheme(context, { theme }) {
    context.commit('LOAD_THEME', theme)
  },
  loadThemes(context, { theme, common }) {
    context.commit('LOAD_THEMES', theme)
    context.commit('LOAD_COMMON', common)
  }
}

const mutations = {
  LOAD_CONFIG(state, config) {
    state.server = config.server?.endsWith('/') ? config.server : config.server + '/'
    state.auth = config.auth
    state.openIdConnect = config.openIdConnect
    state.state = config.state === undefined ? 'working' : config.state
    state.applications = config.applications === undefined ? [] : config.applications
    if (config.options !== undefined) {
      // Merge default options and provided options. Config options take precedence over defaults.
      state.options = { ...state.options, ...config.options }
    }
    if (config.corrupted) {
      state.corrupted = config.corrupted
    }
  },
  LOAD_THEME(state, theme) {
    state.currentTheme = theme
  },
  LOAD_THEMES(state, theme) {
    state.themes = theme
  },
  LOAD_COMMON(state, common) {
    state.commonTheme = common
  }
}

const getters = {
  configuration: (state) => {
    return state
  },
  previewFileMimeTypes: (state) => {
    const mimeTypes = state.options.previewFileMimeTypes
    return (Array.isArray(mimeTypes) ? mimeTypes : [])
      .filter(Boolean)
      .map((ext) => ext.toLowerCase())
  },
  homeFolder: (state, rootGetters) => {
    if (isEmpty(state.options.homeFolder)) {
      return '/'
    }
    const parsed = parseHomeFolder(state.options.homeFolder, rootGetters.user)
    if (parsed.indexOf('//') > -1) {
      // if there are parts of the template that cannot be filled given the current user, we fall back to '/'
      // because we assume that the path would be broken anyway.
      return '/'
    }
    return parsed
  },
  theme: (state) => {
    return state.currentTheme
  }
}

export default {
  state,
  actions,
  mutations,
  getters
}

/**
 * The given home folder is allowed to contain twig style variables for user specific parts of the folder.
 * This function injects user specific data into it.
 *
 * Examples:
 * `/home/{{.email}}/`
 * `/home/{{substr 0 3 .Id}}/{{.Id}}/`
 *
 * @param tpl The home folder template.
 * @param user The user object from the store.
 * @returns string
 */
function parseHomeFolder(tpl, user) {
  const regex = /{{(.*?)}}/g
  const parts = tpl.match(regex)
  if (parts) {
    parts.forEach((part) => {
      // check if part is a substring of a user value
      const substringRegex = /{{substr\s([0-9]+)\s([0-9]+)\s\.(.*)}}/
      const substringMatches = part.match(substringRegex)
      if (!isEmpty(substringMatches) && substringMatches.length >= 4) {
        const start = parseInt(substringMatches[1], 10)
        const length = parseInt(substringMatches[2], 10)
        const userValue = getUserValue(substringMatches[3], user)
        tpl = tpl.replace(part, userValue.substring(start, start + length))
        return
      }

      // none of the supported types, so we fall back to plain user value
      const plainRegex = /{{\.(.*)}}/
      const plainMatches = part.match(plainRegex)
      if (!isEmpty(plainMatches) && plainMatches.length >= 2) {
        tpl = tpl.replace(part, getUserValue(plainMatches[1], user))
      }
    })
  }
  return tpl
}

function getUserValue(key, user) {
  return user[key.toLowerCase()] || ''
}
