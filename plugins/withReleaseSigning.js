// Signs release builds with the keystore given through environment variables (set in CI).
// Without them, the default Expo setup (debug keystore) is kept.
const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = '// mplayer-release-signing';

const SNIPPET = `
${MARKER}
android {
    signingConfigs {
        mplayerRelease {
            def ks = System.getenv("MPLAYER_KEYSTORE")
            if (ks) {
                storeFile file(ks)
                storePassword System.getenv("MPLAYER_KEYSTORE_PASSWORD")
                keyAlias System.getenv("MPLAYER_KEY_ALIAS")
                keyPassword System.getenv("MPLAYER_KEY_PASSWORD")
            }
        }
    }
    buildTypes {
        release {
            if (System.getenv("MPLAYER_KEYSTORE")) {
                signingConfig signingConfigs.mplayerRelease
            }
        }
    }
}
`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (!cfg.modResults.contents.includes(MARKER)) {
      cfg.modResults.contents += SNIPPET;
    }
    return cfg;
  });
};
