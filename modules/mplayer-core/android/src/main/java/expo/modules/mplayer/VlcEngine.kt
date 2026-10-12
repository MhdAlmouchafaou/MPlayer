package expo.modules.mplayer

import android.content.Context
import android.net.Uri
import android.os.ParcelFileDescriptor
import org.videolan.libvlc.LibVLC
import org.videolan.libvlc.Media
import org.videolan.libvlc.MediaPlayer
import org.videolan.libvlc.interfaces.IMedia
import org.videolan.libvlc.util.VLCVideoLayout
import java.io.File

/**
 * Software-capable fallback engine based on libVLC. It decodes what the platform cannot
 * (HEVC on weak chips, AC-3/DTS audio, AVI, WMV, FLV, RMVB, old codecs...).
 * All calls happen on the main thread.
 */
object VlcEngine {
  private var libVlc: LibVLC? = null
  private var player: MediaPlayer? = null
  private var pfd: ParcelFileDescriptor? = null
  private var layout: VLCVideoLayout? = null
  var currentUri: String? = null
    private set
  var emit: ((String, Map<String, Any?>) -> Unit)? = null
  private var lastTimeEmit = 0L
  var scale: String = "fit"
    private set

  private fun lib(context: Context): LibVLC {
    libVlc?.let { return it }
    val options = arrayListOf(
      "--audio-time-stretch",
      "--avcodec-skiploopfilter=1",
      "--avcodec-hurry-up",
      "--network-caching=1500",
      "--file-caching=800",
      "--subsdec-encoding=UTF-8",
      "--freetype-rel-fontsize=16",
      "--freetype-background-opacity=96",
      "-v"
    )
    return LibVLC(context.applicationContext, options).also { libVlc = it }
  }

  private fun mp(context: Context): MediaPlayer {
    player?.let { return it }
    val p = MediaPlayer(lib(context))
    p.setEventListener(object : MediaPlayer.EventListener {
      override fun onEvent(event: MediaPlayer.Event) {
      when (event.type) {
        MediaPlayer.Event.Playing -> emit?.invoke("onVlcState", mapOf("state" to "playing"))
        MediaPlayer.Event.Paused -> emit?.invoke("onVlcState", mapOf("state" to "paused"))
        MediaPlayer.Event.Stopped -> emit?.invoke("onVlcState", mapOf("state" to "stopped"))
        MediaPlayer.Event.Buffering -> emit?.invoke("onVlcState", mapOf("state" to if (event.buffering < 100f) "buffering" else "ready"))
        MediaPlayer.Event.EndReached -> emit?.invoke("onVlcState", mapOf("state" to "ended"))
        MediaPlayer.Event.EncounteredError -> emit?.invoke("onVlcError", mapOf("message" to "Lecture impossible avec le décodeur logiciel"))
        MediaPlayer.Event.TimeChanged -> {
          val now = System.currentTimeMillis()
          if (now - lastTimeEmit > 200) {
            lastTimeEmit = now
            emit?.invoke("onVlcProgress", mapOf("position" to event.timeChanged.toDouble(), "duration" to p.length.toDouble()))
          }
        }
        MediaPlayer.Event.LengthChanged -> emit?.invoke("onVlcProgress", mapOf("position" to p.time.toDouble(), "duration" to event.lengthChanged.toDouble()))
        MediaPlayer.Event.Vout -> emitVideoSize()
        else -> {}
      }
      }
    })
    player = p
    return p
  }

  private fun emitVideoSize() {
    val p = player ?: return
    val track = try { p.getCurrentVideoTrack() } catch (_: Throwable) { null } ?: return
    var w = track.width
    var h = track.height
    if (track.orientation == IMedia.VideoTrack.Orientation.LeftBottom || track.orientation == IMedia.VideoTrack.Orientation.RightTop) {
      val t = w; w = h; h = t
    }
    if (track.sarDen > 0 && track.sarNum > 0) w = w * track.sarNum / track.sarDen
    emit?.invoke("onVideoSize", mapOf("width" to w, "height" to h, "engine" to "vlc"))
  }

  fun open(context: Context, uriString: String, startMs: Long, play: Boolean) {
    val p = mp(context)
    try { p.stop() } catch (_: Throwable) {}
    try { pfd?.close() } catch (_: Throwable) {}
    pfd = null
    val uri = Uri.parse(uriString)
    val media = when (uri.scheme) {
      "content" -> {
        val fd = context.contentResolver.openFileDescriptor(uri, "r") ?: throw IllegalStateException("Fichier introuvable")
        pfd = fd
        Media(lib(context), fd.fileDescriptor)
      }
      "file", null -> Media(lib(context), File(uri.path ?: uriString).absolutePath)
      else -> Media(lib(context), uri)
    }
    media.setHWDecoderEnabled(true, false)
    if (startMs > 0) media.addOption(":start-time=${startMs / 1000.0}")
    p.setMedia(media)
    media.release()
    currentUri = uriString
    layout?.let { attach(it) }
    if (play) p.play()
  }

  fun attach(view: VLCVideoLayout) {
    val p = player
    layout = view
    if (p == null) return
    try { p.detachViews() } catch (_: Throwable) {}
    p.attachViews(view, null, true, true)
    applyScale()
  }

  fun detach(view: VLCVideoLayout) {
    if (layout !== view) return
    try { player?.detachViews() } catch (_: Throwable) {}
    layout = null
  }

  fun setScale(mode: String) {
    scale = mode
    applyScale()
  }

  private fun applyScale() {
    val p = player ?: return
    try {
      when (scale) {
        "fill" -> { p.setAspectRatio(null); p.setVideoScale(MediaPlayer.ScaleType.SURFACE_FIT_SCREEN) }
        "stretch" -> { p.setAspectRatio(null); p.setVideoScale(MediaPlayer.ScaleType.SURFACE_FILL) }
        "16:9" -> { p.setVideoScale(MediaPlayer.ScaleType.SURFACE_BEST_FIT); p.setAspectRatio("16:9") }
        "4:3" -> { p.setVideoScale(MediaPlayer.ScaleType.SURFACE_BEST_FIT); p.setAspectRatio("4:3") }
        else -> { p.setAspectRatio(null); p.setVideoScale(MediaPlayer.ScaleType.SURFACE_BEST_FIT) }
      }
    } catch (_: Throwable) {
    }
  }

  fun play() { player?.play() }
  fun pause() { player?.pause() }
  fun isPlaying() = player?.isPlaying ?: false
  fun seek(ms: Long, fast: Boolean) { player?.setTime(ms.coerceAtLeast(0), fast) }
  fun time(): Long = player?.time ?: 0
  fun length(): Long = player?.length ?: 0
  fun setRate(rate: Float) { player?.setRate(rate) }
  fun setVolume(percent: Int) { player?.setVolume(percent.coerceIn(0, 200)) }

  fun tracks(): Map<String, Any?> {
    val p = player ?: return emptyMap()
    fun list(arr: Array<MediaPlayer.TrackDescription>?) =
      arr?.map { mapOf("id" to it.id.toString(), "label" to it.name) } ?: emptyList()
    return mapOf(
      "audio" to list(p.getAudioTracks()),
      "text" to list(p.getSpuTracks()),
      "audioSelected" to p.getAudioTrack().toString(),
      "textSelected" to p.getSpuTrack().toString()
    )
  }

  fun selectAudio(id: Int) { player?.setAudioTrack(id) }
  fun selectText(id: Int) { player?.setSpuTrack(id) }

  fun stop() {
    try { player?.stop() } catch (_: Throwable) {}
    try { pfd?.close() } catch (_: Throwable) {}
    pfd = null
    currentUri = null
  }

  fun release() {
    stop()
    try { player?.detachViews() } catch (_: Throwable) {}
    player?.release()
    player = null
    layout = null
  }
}
