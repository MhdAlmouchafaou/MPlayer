package expo.modules.mplayer

import android.media.audiofx.BassBoost
import android.media.audiofx.Equalizer
import android.media.audiofx.Virtualizer

/** Equalizer, bass boost and virtualizer bound to the player's audio session. */
class AudioEffects {
  private var sessionId: Int = 0
  private var equalizer: Equalizer? = null
  private var bassBoost: BassBoost? = null
  private var virtualizer: Virtualizer? = null

  fun attach(audioSessionId: Int) {
    if (audioSessionId == 0 || audioSessionId == sessionId) return
    release()
    sessionId = audioSessionId
    equalizer = try { Equalizer(0, audioSessionId) } catch (_: Throwable) { null }
    bassBoost = try { BassBoost(0, audioSessionId) } catch (_: Throwable) { null }
    virtualizer = try { Virtualizer(0, audioSessionId) } catch (_: Throwable) { null }
  }

  fun describe(): Map<String, Any?> {
    val eq = equalizer
    val bands = ArrayList<Map<String, Any?>>()
    val presets = ArrayList<String>()
    var min = -1500
    var max = 1500
    if (eq != null) {
      try {
        val range = eq.bandLevelRange
        min = range[0].toInt()
        max = range[1].toInt()
        for (i in 0 until eq.numberOfBands) {
          val band = i.toShort()
          bands.add(
            mapOf(
              "index" to i,
              "centerFreq" to eq.getCenterFreq(band) / 1000,
              "level" to eq.getBandLevel(band).toInt()
            )
          )
        }
        for (i in 0 until eq.numberOfPresets) presets.add(eq.getPresetName(i.toShort()))
      } catch (_: Throwable) {
      }
    }
    return mapOf(
      "available" to (eq != null),
      "enabled" to (eq?.enabled ?: false),
      "minLevel" to min,
      "maxLevel" to max,
      "bands" to bands,
      "presets" to presets,
      "bassBoostSupported" to (bassBoost?.strengthSupported ?: false),
      "bassBoost" to (try { bassBoost?.roundedStrength?.toInt() } catch (_: Throwable) { null } ?: 0),
      "virtualizerSupported" to (virtualizer?.strengthSupported ?: false),
      "virtualizer" to (try { virtualizer?.roundedStrength?.toInt() } catch (_: Throwable) { null } ?: 0)
    )
  }

  fun setEnabled(enabled: Boolean) {
    try { equalizer?.enabled = enabled } catch (_: Throwable) {}
    try { bassBoost?.enabled = enabled } catch (_: Throwable) {}
    try { virtualizer?.enabled = enabled } catch (_: Throwable) {}
  }

  fun setBandLevel(band: Int, level: Int) {
    try { equalizer?.setBandLevel(band.toShort(), level.toShort()) } catch (_: Throwable) {}
  }

  fun usePreset(preset: Int) {
    try { equalizer?.usePreset(preset.toShort()) } catch (_: Throwable) {}
  }

  fun setBassBoost(strength: Int) {
    try { bassBoost?.setStrength(strength.coerceIn(0, 1000).toShort()) } catch (_: Throwable) {}
  }

  fun setVirtualizer(strength: Int) {
    try { virtualizer?.setStrength(strength.coerceIn(0, 1000).toShort()) } catch (_: Throwable) {}
  }

  fun release() {
    try { equalizer?.release() } catch (_: Throwable) {}
    try { bassBoost?.release() } catch (_: Throwable) {}
    try { virtualizer?.release() } catch (_: Throwable) {}
    equalizer = null
    bassBoost = null
    virtualizer = null
    sessionId = 0
  }
}
