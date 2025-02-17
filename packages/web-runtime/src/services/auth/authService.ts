import { UserManager } from './userManager'
import { PublicLinkManager } from './publicLinkManager'
import { Store } from 'vuex'
import { ClientService } from '@ownclouders/web-pkg'
import { ConfigurationManager } from '@ownclouders/web-pkg'
import { RouteLocation, Router } from 'vue-router'
import {
  extractPublicLinkToken,
  isAnonymousContext,
  isIdpContext,
  isPublicLinkContext,
  isUserContext
} from '../../router'
import { unref } from 'vue'
import { Ability } from '@ownclouders/web-client/src/helpers/resource/types'
import { Language } from 'vue3-gettext'

export class AuthService {
  private clientService: ClientService
  private configurationManager: ConfigurationManager
  private store: Store<any>
  private router: Router
  private userManager: UserManager
  private publicLinkManager: PublicLinkManager
  private ability: Ability
  private language: Language

  public hasAuthErrorOccurred: boolean

  public initialize(
    configurationManager: ConfigurationManager,
    clientService: ClientService,
    store: Store<any>,
    router: Router,
    ability: Ability,
    language: Language
  ): void {
    this.configurationManager = configurationManager
    this.clientService = clientService
    this.store = store
    this.router = router
    this.hasAuthErrorOccurred = false
    this.ability = ability
    this.language = language
  }

  /**
   * Initialize publicLinkContext and userContext (whichever is available, respectively).
   *
   * FIXME: at the moment the order "publicLink first, user second" is important, because we trigger the `ready` hook of all applications
   * as soon as any context is ready. This works well for user context pages, because they can't have a public link context at the same time.
   * Public links on the other hand could have a logged in user as well, thus we need to make sure that the public link context is loaded first.
   * For the moment this is fine. In the future we might want to wait triggering the `ready` hook of applications until all available contexts
   * are loaded.
   *
   * @param to {Route}
   */
  public async initializeContext(to: RouteLocation) {
    if (!this.publicLinkManager) {
      this.publicLinkManager = new PublicLinkManager({
        clientService: this.clientService,
        configurationManager: this.configurationManager,
        store: this.store
      })
    }

    if (isPublicLinkContext(this.router, to)) {
      const publicLinkToken = extractPublicLinkToken(to)
      if (publicLinkToken) {
        await this.publicLinkManager.updateContext(publicLinkToken)
      }
    } else {
      this.publicLinkManager.clearContext()
    }

    if (!this.userManager) {
      this.userManager = new UserManager({
        clientService: this.clientService,
        configurationManager: this.configurationManager,
        store: this.store,
        ability: this.ability,
        language: this.language
      })
    }

    if (!isAnonymousContext(this.router, to)) {
      const fetchUserData = !isIdpContext(this.router, to)

      if (!this.userManager.areEventHandlersRegistered) {
        this.userManager.events.addAccessTokenExpired((...args): void => {
          const handleExpirationError = () => {
            console.error('AccessToken Expired：', ...args)
            this.handleAuthError(unref(this.router.currentRoute))
          }

          /**
           * Retry silent token renewal
           *
           * in cases where the application runs in the background (different tab, different window) the AccessTokenExpired event gets called
           * even if the application is still able to obtain a new token.
           *
           * The main reason for this is the browser throttling in combination with `oidc-client-ts` 'Timer' class which uses 'setInterval' to notify / refresh all necessary parties.
           * In those cases the internal clock gets out of sync and the auth library emits that event.
           *
           * For a better understanding why this happens and the interval execution gets throttled please read:
           * https://developer.chrome.com/blog/timer-throttling-in-chrome-88/
           *
           * in cases where 'automaticSilentRenew' is enabled we try to obtain a new token one more time before we really start the authError flow.
           */
          if (this.userManager.settings.automaticSilentRenew) {
            this.userManager.signinSilent().catch(handleExpirationError)
          } else {
            handleExpirationError()
          }
        })

        this.userManager.events.addAccessTokenExpiring((...args) => {
          console.debug('AccessToken Expiring：', ...args)
        })

        this.userManager.events.addUserLoaded(async (user) => {
          console.debug(
            `New User Loaded. access_token： ${user.access_token}, refresh_token: ${user.refresh_token}`
          )
          try {
            await this.userManager.updateContext(user.access_token, fetchUserData)
          } catch (e) {
            console.error(e)
            await this.handleAuthError(unref(this.router.currentRoute))
          }
        })

        this.userManager.events.addUserUnloaded(async () => {
          console.log('user unloaded…')
          await this.resetStateAfterUserLogout()

          if (this.userManager.unloadReason === 'authError') {
            this.hasAuthErrorOccurred = true
            return this.router.push({
              name: 'accessDenied',
              query: { redirectUrl: unref(this.router.currentRoute)?.fullPath }
            })
          }

          // handle redirect after logout
          if (this.configurationManager.isOAuth2) {
            const oAuth2 = this.configurationManager.oAuth2
            if (oAuth2.logoutUrl) {
              return (window.location = oAuth2.logoutUrl as any)
            }
            return (window.location =
              `${this.configurationManager.serverUrl}/index.php/logout` as any)
          }
        })
        this.userManager.events.addSilentRenewError(async (error) => {
          console.error('Silent Renew Error：', error)
          await this.handleAuthError(unref(this.router.currentRoute))
        })

        this.userManager.areEventHandlersRegistered = true
      }

      // relevant for page reload: token is already in userStore
      // no userLoaded event and no signInCallback gets triggered
      const accessToken = await this.userManager.getAccessToken()
      if (accessToken) {
        try {
          await this.userManager.updateContext(accessToken, fetchUserData)
        } catch (e) {
          console.error(e)
          await this.handleAuthError(unref(this.router.currentRoute))
        }
      }
    }
  }

  public loginUser(redirectUrl?: string) {
    this.userManager.setPostLoginRedirectUrl(redirectUrl)
    return this.userManager.signinRedirect()
  }

  /**
   * Sign in callback gets called from the IDP after initial login.
   */
  public async signInCallback() {
    try {
      await this.userManager.signinRedirectCallback(this.buildSignInCallbackUrl())
      const redirectRoute = this.router.resolve(this.userManager.getAndClearPostLoginRedirectUrl())
      return this.router.replace({
        path: redirectRoute.path,
        ...(redirectRoute.query && { query: redirectRoute.query })
      })
    } catch (e) {
      console.warn('error during authentication:', e)
      return this.handleAuthError(unref(this.router.currentRoute))
    }
  }

  /**
   * Sign in silent callback gets called with OIDC during access token renewal when no `refresh_token`
   * is present (`refresh_token` exists when `offline_access` is present in scopes).
   *
   * The oidc-client lib emits a userLoaded event internally, which already handles the token update
   * in web.
   */
  public async signInSilentCallback() {
    await this.userManager.signinSilentCallback(this.buildSignInCallbackUrl())
  }

  /**
   * craft a url that the parser in oidc-client-ts can handle…
   */
  private buildSignInCallbackUrl() {
    const currentQuery = unref(this.router.currentRoute).query
    return '/?' + new URLSearchParams(currentQuery as Record<string, string>).toString()
  }

  public async handleAuthError(route: RouteLocation) {
    if (isPublicLinkContext(this.router, route)) {
      const token = extractPublicLinkToken(route)
      this.publicLinkManager.clear(token)
      return this.router.push({
        name: 'resolvePublicLink',
        params: { token },
        query: { redirectUrl: route.fullPath }
      })
    }
    if (isUserContext(this.router, route) || isIdpContext(this.router, route)) {
      await this.userManager.removeUser('authError')
      return
    }
    // authGuard is taking care of redirecting the user to the
    // accessDenied page if hasAuthErrorOccurred is set to true
    // we can't push the route ourselves, see authGuard for details.
    this.hasAuthErrorOccurred = true
  }

  public async resolvePublicLink(token: string, passwordRequired: boolean, password: string) {
    this.publicLinkManager.setPasswordRequired(token, passwordRequired)
    this.publicLinkManager.setPassword(token, password)
    this.publicLinkManager.setResolved(token, true)

    await this.publicLinkManager.updateContext(token)
  }

  public async logoutUser() {
    const u = await this.userManager.getUser()
    if (u && u.id_token) {
      return this.userManager.signoutRedirect({ id_token_hint: u.id_token })
    } else {
      await this.userManager.removeUser()
    }
  }

  private async resetStateAfterUserLogout() {
    // TODO: create UserUnloadTask interface and allow registering unload-tasks in the authService
    await this.store.dispatch('runtime/auth/clearUserContext')
    await this.store.dispatch('resetUserState')
    await Promise.all([
      this.store.dispatch('clearDynamicNavItems'),
      this.store.dispatch('hideModal'),
      this.store.dispatch('clearSettingsValues')
    ])
  }
}

export const authService = new AuthService()
