/**
 * Central place for all user-facing strings (Dutch).
 * Keep code/comments in English; keep UI copy here.
 */
export const copy = {
  app: {
    name: "BibSync",
    tagline: "Synchroniseer je studiepauzes met je groep.",
    description:
      "BibSync helpt studenten die samen in de bib zitten om pauzes te plannen, te stemmen en te zien wie er aanwezig is.",
  },
  nav: {
    login: "Inloggen",
    register: "Registreren",
    logout: "Uitloggen",
    profile: "Profiel",
    toApp: "Naar de app",
  },
  landing: {
    heroTitle: "Studeer samen, pauzeer samen.",
    heroSubtitle:
      "Plan pauzes, stem op voorstellen en zie in één oogopslag wie er aan het studeren is.",
    ctaPrimary: "Account aanmaken",
    ctaSecondary: "Ik heb al een account",
  },
  auth: {
    loginTitle: "Welkom terug",
    loginSubtitle: "Log in om verder te gaan.",
    registerTitle: "Account aanmaken",
    registerSubtitle: "Maak een account om met je groep te starten.",
    tabPassword: "Wachtwoord",
    tabMagicLink: "Magic link",
    emailLabel: "E-mailadres",
    emailPlaceholder: "jij@voorbeeld.be",
    passwordLabel: "Wachtwoord",
    passwordPlaceholder: "••••••••",
    displayNameLabel: "Weergavenaam",
    displayNamePlaceholder: "Hoe je groep je kent",
    submitLogin: "Inloggen",
    submitRegister: "Registreren",
    submitMagicLink: "Stuur magic link",
    submittingLogin: "Bezig met inloggen…",
    submittingRegister: "Account aanmaken…",
    submittingMagicLink: "Versturen…",
    noAccount: "Nog geen account?",
    haveAccount: "Heb je al een account?",
    registerLink: "Registreer hier",
    loginLink: "Log hier in",
    magicLinkHint:
      "We sturen je een link om in te loggen zonder wachtwoord.",
    magicLinkSent:
      "Check je mailbox — we stuurden je een inloglink.",
    confirmEmailSent:
      "Bijna klaar! Check je mailbox om je account te bevestigen.",
    invalidCredentials: "E-mailadres of wachtwoord klopt niet.",
    genericError: "Er ging iets mis. Probeer het opnieuw.",
    confirmFailed: "De bevestigingslink is ongeldig of verlopen.",
  },
  profile: {
    title: "Profiel",
    emailLabel: "E-mailadres",
    displayNameLabel: "Weergavenaam",
    memberSince: "Lid sinds",
  },
  appHome: {
    welcome: (name: string) => `Welkom ${name}`,
    placeholder: "Hier komen straks je rooms.",
  },
  validation: {
    emailInvalid: "Geef een geldig e-mailadres in.",
    passwordTooShort: "Wachtwoord moet minstens 8 tekens zijn.",
    displayNameRequired: "Geef een weergavenaam in.",
    displayNameTooLong: "Weergavenaam mag max 40 tekens zijn.",
  },
} as const;
