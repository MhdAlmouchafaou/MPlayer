@file:OptIn(UnstableApi::class)

package expo.modules.mplayer

import android.content.Context
import android.media.audiofx.LoudnessEnhancer
import android.os.Looper
import androidx.annotation.OptIn
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.util.UnstableApi
import androidx.media3.common.util.Util
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.exoplayer.DefaultRenderersFactory
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.SeekParameters
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.extractor.DefaultExtractorsFactory
import androidx.media3.extractor.ts.DefaultTsPayloadReaderFactory

/**
 * Single ExoPlayer instance shared by audio and video playback, the JS module and the
 * media session service. Must only be touched from the main thread.
 */
object PlayerHolder {
  private var player: ExoPlayer? = null
  private var loudness: LoudnessEnhancer? = null
  private var loudnessSession = 0
  var boostMb: Int = 0
    private set

  fun get(context: Context): ExoPlayer {
    check(Looper.myLooper() == Looper.getMainLooper()) { "PlayerHolder must be used on the main thread" }
    player?.let { return it }
    val app = context.applicationContext

    // Hardware decoders first, then any other decoder able to handle the stream
    // (software codecs, secondary hardware codecs), instead of failing outright.
    val renderers = DefaultRenderersFactory(app)
      .setEnableDecoderFallback(true)
      .setExtensionRendererMode(DefaultRenderersFactory.EXTENSION_RENDERER_MODE_ON)

    // Be lenient with odd files: constant-bitrate seeking for MP3/ADTS without index,
    // and detect more TS stream types.
    val extractors = DefaultExtractorsFactory()
      .setConstantBitrateSeekingEnabled(true)
      .setConstantBitrateSeekingAlwaysEnabled(true)
      .setTsExtractorFlags(DefaultTsPayloadReaderFactory.FLAG_DETECT_ACCESS_UNITS)

    val attributes = AudioAttributes.Builder()
      .setUsage(C.USAGE_MEDIA)
      .setContentType(C.AUDIO_CONTENT_TYPE_MOVIE)
      .build()

    val loadControl = DefaultLoadControl.Builder()
      .setBufferDurationsMs(15_000, 50_000, 1_000, 2_000)
      .build()

    val created = ExoPlayer.Builder(app, renderers)
      .setMediaSourceFactory(DefaultMediaSourceFactory(app, extractors))
      .setLoadControl(loadControl)
      .setAudioAttributes(attributes, true)
      .setHandleAudioBecomingNoisy(true)
      .setWakeMode(C.WAKE_MODE_LOCAL)
      .setSeekBackIncrementMs(10_000)
      .setSeekForwardIncrementMs(10_000)
      .build()
    try {
      created.audioSessionId = Util.generateAudioSessionIdV21(app)
    } catch (_: Throwable) {
    }
    created.setSeekParameters(SeekParameters.EXACT)
    player = created
    return created
  }

  fun peek(): ExoPlayer? = player

  /** Software gain above 100 % (0 to 1500 mB) using the platform loudness enhancer. */
  fun setBoost(mb: Int) {
    val p = player ?: return
    boostMb = mb.coerceIn(0, 1500)
    try {
      if (loudness == null || loudnessSession != p.audioSessionId) {
        loudness?.release()
        loudness = LoudnessEnhancer(p.audioSessionId)
        loudnessSession = p.audioSessionId
      }
      loudness?.setTargetGain(boostMb)
      loudness?.enabled = boostMb > 0
    } catch (_: Throwable) {
      loudness = null
    }
  }
}
