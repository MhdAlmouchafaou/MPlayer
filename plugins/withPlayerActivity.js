// Main activity tweaks for a media player: picture-in-picture, no restart on rotation or
// window resize, and "Open with" entries for videos, audio and PDF files.
const { withAndroidManifest } = require('expo/config-plugins');

const CONFIG_CHANGES =
  'keyboard|keyboardHidden|orientation|screenSize|smallestScreenSize|screenLayout|uiMode|density|navigation';

const MIME_TYPES = ['video/*', 'audio/*', 'application/pdf', 'application/x-mpegURL', 'application/vnd.apple.mpegurl', 'application/ogg', 'application/x-matroska'];

module.exports = function withPlayerActivity(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application?.[0];
    const activity = app?.activity?.find((a) => a.$['android:name'] === '.MainActivity');
    if (!activity) return cfg;
    activity.$['android:supportsPictureInPicture'] = 'true';
    activity.$['android:resizeableActivity'] = 'true';
    activity.$['android:configChanges'] = CONFIG_CHANGES;
    activity.$['android:launchMode'] = 'singleTask';

    activity['intent-filter'] = activity['intent-filter'] || [];
    const marker = 'mplayer-open-with';
    if (!activity['intent-filter'].some((f) => f.$?.['android:label'] === marker)) {
      for (const scheme of ['content', 'file']) {
        activity['intent-filter'].push({
          $: { 'android:label': marker },
          action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
          category: [
            { $: { 'android:name': 'android.intent.category.DEFAULT' } },
            { $: { 'android:name': 'android.intent.category.BROWSABLE' } },
          ],
          data: MIME_TYPES.map((m) => ({ $: { 'android:scheme': scheme, 'android:mimeType': m } })),
        });
      }
      // Streams opened from a browser or another app.
      activity['intent-filter'].push({
        $: { 'android:label': marker },
        action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
        category: [
          { $: { 'android:name': 'android.intent.category.DEFAULT' } },
          { $: { 'android:name': 'android.intent.category.BROWSABLE' } },
        ],
        data: ['http', 'https'].flatMap((scheme) =>
          ['video/*', 'audio/*', 'application/x-mpegURL', 'application/vnd.apple.mpegurl'].map((m) => ({
            $: { 'android:scheme': scheme, 'android:mimeType': m },
          }))
        ),
      });
    }
    // Large heap helps with 4K frames and big PDFs.
    app.$['android:largeHeap'] = 'true';
    app.$['android:requestLegacyExternalStorage'] = 'true';
    return cfg;
  });
};
