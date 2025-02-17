import { isNaN, isNumber, isObject, isString, isBoolean } from 'lodash-es'
import { Language } from 'vue3-gettext'

export interface PasswordPolicyRuleOptions {
  minLength?: number
  maxLength?: number
  characters?: string
}

export interface PasswordPolicyRuleExplained {
  code: string
  message: string
  format: (number | string)[]
  verified?: boolean
}

export interface PasswordPolicyRule {
  assert(options: PasswordPolicyRuleOptions, password: string): boolean
  explain(options: PasswordPolicyRuleOptions, verified?: boolean): PasswordPolicyRuleExplained
  missing(options: PasswordPolicyRuleOptions, password: string): PasswordPolicyRuleExplained
  validate(options?: PasswordPolicyRuleOptions): boolean
}

export class MustNotBeEmptyRule implements PasswordPolicyRule {
  protected $gettext

  constructor({ $gettext }: Language) {
    this.$gettext = $gettext
  }

  explain(options: PasswordPolicyRuleOptions, verified: boolean): PasswordPolicyRuleExplained {
    return {
      code: 'mustNotBeEmpty',
      message: this.$gettext('Must not be empty'),
      format: [],
      ...(isBoolean(verified) && { verified })
    }
  }

  assert(options: PasswordPolicyRuleOptions, password: string): boolean {
    return password.length > 0
  }

  validate(): boolean {
    return true
  }

  missing(options: PasswordPolicyRuleOptions, password: string): PasswordPolicyRuleExplained {
    return this.explain(options, this.assert(options, password))
  }
}
export class MustContainRule implements PasswordPolicyRule {
  protected $gettext

  constructor({ $gettext }: Language) {
    this.$gettext = $gettext
  }

  explain(options: PasswordPolicyRuleOptions, verified: boolean): PasswordPolicyRuleExplained {
    return {
      code: 'mustContain',
      message: this.$gettext('At least %{param1} of the special characters: %{param2}'),
      format: [options.minLength, options.characters],
      ...(isBoolean(verified) && { verified })
    }
  }

  assert(options: PasswordPolicyRuleOptions, password: string) {
    const charsCount = Array.from(password).filter((char) =>
      options.characters.includes(char)
    ).length

    return charsCount >= options.minLength
  }

  validate(options: PasswordPolicyRuleOptions): boolean {
    if (!isObject(options)) {
      throw new Error('options should be an object')
    }

    if (!isNumber(options.minLength) || isNaN(options.minLength)) {
      throw new Error('minLength should be a non-zero number')
    }

    if (!isString(options.characters)) {
      throw new Error('characters should be a character sequence')
    }

    return true
  }
  missing(options, password) {
    return this.explain(options, this.assert(options, password))
  }
}
export class AtMostBaseRule implements PasswordPolicyRule {
  protected $ngettext

  constructor({ $ngettext }: Language) {
    this.$ngettext = $ngettext
  }

  assert(options: PasswordPolicyRuleOptions, password: string): boolean {
    throw new Error('Method not implemented.')
  }

  explain(options: PasswordPolicyRuleOptions, verified?: boolean): PasswordPolicyRuleExplained {
    throw new Error('Method not implemented.')
  }

  validate(options: PasswordPolicyRuleOptions): boolean {
    if (!isObject(options)) {
      throw new Error('options should be an object')
    }

    if (!isNumber(options.maxLength) || isNaN(options.maxLength)) {
      throw new Error('maxLength should be a non-zero number')
    }

    return true
  }

  missing(options: PasswordPolicyRuleOptions, password: string): PasswordPolicyRuleExplained {
    return this.explain(options, this.assert(options, password))
  }
}

export class AtMostCharactersRule extends AtMostBaseRule {
  constructor(args: Language) {
    super(args)
  }

  explain(options: PasswordPolicyRuleOptions, verified: boolean): PasswordPolicyRuleExplained {
    return {
      code: 'atMostCharacters',
      message: this.$ngettext(
        'At most %{param1} character long',
        'At most %{param1} characters long',
        options.maxLength
      ),
      format: [options.maxLength],
      ...(isBoolean(verified) && { verified })
    }
  }

  assert(options: PasswordPolicyRuleOptions, password: string): boolean {
    return password.length <= options.maxLength
  }
}

export class AtLeastBaseRule implements PasswordPolicyRule {
  protected $ngettext

  constructor({ $ngettext }: Language) {
    this.$ngettext = $ngettext
  }

  assert(options: PasswordPolicyRuleOptions, password: string): boolean {
    throw new Error('Method not implemented.')
  }

  explain(options: PasswordPolicyRuleOptions, verified?: boolean): PasswordPolicyRuleExplained {
    throw new Error('Method not implemented.')
  }

  validate(options: PasswordPolicyRuleOptions): boolean {
    if (!isObject(options)) {
      throw new Error('options should be an object')
    }

    if (!isNumber(options.minLength) || isNaN(options.minLength)) {
      throw new Error('minLength should be a non-zero number')
    }

    return true
  }

  missing(options: PasswordPolicyRuleOptions, password: string): PasswordPolicyRuleExplained {
    return this.explain(options, this.assert(options, password))
  }
}

export class AtLeastCharactersRule extends AtLeastBaseRule implements PasswordPolicyRule {
  constructor(args: Language) {
    super(args)
  }

  explain(options: PasswordPolicyRuleOptions, verified: boolean): PasswordPolicyRuleExplained {
    return {
      code: 'atLeastCharacters',
      message: this.$ngettext(
        'At least %{param1} character long',
        'At least %{param1} characters long',
        options.minLength
      ),
      format: [options.minLength],
      ...(isBoolean(verified) && { verified })
    }
  }

  assert(options: PasswordPolicyRuleOptions, password: string): boolean {
    return password.length >= options.minLength
  }
}

export class AtLeastUppercaseCharactersRule extends AtLeastBaseRule {
  constructor(args: Language) {
    super(args)
  }

  explain(options: PasswordPolicyRuleOptions, verified: boolean): PasswordPolicyRuleExplained {
    return {
      code: 'atLeastUppercaseCharacters',
      message: this.$ngettext(
        'At least %{param1} uppercase character',
        'At least %{param1} uppercase characters',
        options.minLength
      ),
      format: [options.minLength],
      ...(isBoolean(verified) && { verified })
    }
  }

  assert(options: PasswordPolicyRuleOptions, password: string): boolean {
    const uppercaseCount = (password || '').match(/[A-Z\xC0-\xD6\xD8-\xDE]/g)?.length
    return uppercaseCount >= options.minLength
  }
}

export class AtLeastLowercaseCharactersRule extends AtLeastBaseRule {
  constructor(args: Language) {
    super(args)
  }

  explain(options: PasswordPolicyRuleOptions, verified: boolean): PasswordPolicyRuleExplained {
    return {
      code: 'atLeastLowercaseCharacters',
      message: this.$ngettext(
        'At least %{param1} lowercase character',
        'At least %{param1} lowercase characters',
        options.minLength
      ),
      format: [options.minLength],
      ...(isBoolean(verified) && { verified })
    }
  }

  assert(options: PasswordPolicyRuleOptions, password: string): boolean {
    const lowercaseCount = (password || '').match(/[a-z\xDF-\xF6\xF8-\xFF]/g)?.length
    return lowercaseCount >= options.minLength
  }
}

export class AtLeastDigitsRule extends AtLeastBaseRule {
  constructor(args: Language) {
    super(args)
  }

  explain(options: PasswordPolicyRuleOptions, verified: boolean): PasswordPolicyRuleExplained {
    return {
      code: 'atLeastDigits',
      message: this.$ngettext(
        'At least %{param1} number',
        'At least %{param1} numbers',
        options.minLength
      ),
      format: [options.minLength],
      ...(isBoolean(verified) && { verified })
    }
  }

  assert(options: PasswordPolicyRuleOptions, password: string): boolean {
    const digitCount = (password || '').match(/\d/g)?.length
    return digitCount >= options.minLength
  }
}
