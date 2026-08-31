import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'fr.rdvous.app',
  appName: 'rdvous',
  webDir: 'out',
  server: {
    // Le `www` est obligatoire : rdvous.fr renvoie un 307 vers www.rdvous.fr.
    // Sans lui, l'application changeait d'hôte au premier chargement, ce que
    // Capacitor traite comme une navigation externe, avec le risque d'ouvrir le
    // navigateur du téléphone au lancement et d'installer la session sur un
    // hôte différent de celui déclaré.
    url: 'https://www.rdvous.fr/app',
    cleartext: false,
    // Les deux hôtes sont autorisés : un lien partagé sans le `www` doit rester
    // dans l'application plutôt que d'en faire sortir l'utilisatrice.
    allowNavigation: ['www.rdvous.fr', 'rdvous.fr'],
  },
};

export default config;
