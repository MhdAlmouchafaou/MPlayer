@file:OptIn(UnstableApi::class)

package expo.modules.mplayer

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.media.AudioManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.content.pm.ActivityInfo
import android.provider.Settings
import android.view.WindowManager
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.media3.common.TrackSelectionOverride
import androidx.media3.exoplayer.SeekParameters
import android.os.Looper
import androidx.annotation.OptIn
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.C
import androidx.media3.common.Tracks
import androidx.media3.common.VideoSize
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.google.common.util.concurrent.ListenableFuture
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.Executors
import kotlin.math.min

class MPlayerModule : Module() {
  private val mainHandler = Handler(Looper.getMainLooper())
  private val artworkExecutor = Executors.newSingleThreadExecutor()
  private var controllerFuture: ListenableFuture<MediaController>? = null
  private var listenerAttached = false
  private val effects = AudioEffects()

  private var fadeMs = 0L
  private var sleepAtEndOfTrack = false
  private var sleepDeadline = 0L
  private var tickCount = 0
  private var errorStreak = 0

  private fun kindOf(item: MediaItem?): String = item?.mediaMetadata?.extras?.getString("kind") ?: "audio"
  private fun currentKind(): String = kindOf(PlayerHolder.peek()?.currentMediaItem)

  private val context: Context
    get() = appContext.reactContext?.applicationContext ?: throw Exceptions.ReactContextLost()

  private fun player(): ExoPlayer {
    val p = PlayerHolder.get(context)
    if (!listenerAttached) {
      p.addListener(listener)
      listenerAttached = true
      effects.attach(p.audioSessionId)
    }
    if (controllerFuture == null) {
      val token = SessionToken(context, ComponentName(context, PlaybackService::class.java))
      controllerFuture = MediaController.Builder(context, token).buildAsync()
    }
    return p
  }

  private fun safeSend(name: String, body: Map<String, Any?>) {
    try {
      sendEvent(name, body)
    } catch (_: Throwable) {
    }
  }

  // region ticker (progress events, fades, sleep timer)
  private val ticker = object : Runnable {
    override fun run() {
      val p = PlayerHolder.peek() ?: return
      tickCount++
      applyFade(p)
      if (sleepDeadline > 0 && System.currentTimeMillis() >= sleepDeadline) {
        sleepDeadline = 0
        p.pause()
        safeSend("onSleepTimerEnd", emptyMap())
      }
      if (tickCount % (if (currentKind() == "video") 2 else 5) == 0) emitProgress(p)
      if (p.isPlaying || intentOf(p) || sleepDeadline > 0) {
        mainHandler.postDelayed(this, 100)
      }
    }
  }

  private fun startTicker() {
    mainHandler.removeCallbacks(ticker)
    mainHandler.post(ticker)
  }

  private fun applyFade(p: ExoPlayer) {
    if (fadeMs <= 0 || currentKind() == "video") {
      if (p.volume != 1f) p.volume = 1f
      return
    }
    val duration = p.duration
    val position = p.currentPosition
    var volume = 1f
    if (duration > 0 && duration > fadeMs * 3) {
      if (position < fadeMs) volume = position.toFloat() / fadeMs
      val remaining = duration - position
      if (remaining < fadeMs && (p.hasNextMediaItem() || p.repeatMode == Player.REPEAT_MODE_ALL)) {
        volume = min(volume, remaining.toFloat() / fadeMs)
      }
    }
    p.volume = volume.coerceIn(0.02f, 1f)
  }

  private var lastIntent: Boolean? = null

  /**
   * "Playing" as the user sees it: playback is wanted and not finished. Short buffering
   * gaps when switching tracks no longer flash the pause state in the UI.
   */
  private fun intentOf(p: ExoPlayer): Boolean =
    p.playWhenReady && p.playbackState != Player.STATE_ENDED && p.playbackState != Player.STATE_IDLE

  private fun emitIntent(p: ExoPlayer) {
    val intent = intentOf(p)
    if (intent != lastIntent) {
      lastIntent = intent
      safeSend("onPlayingChange", mapOf("isPlaying" to intent, "kind" to currentKind()))
    }
  }

  private fun emitProgress(p: ExoPlayer) {
    safeSend(
      "onProgress",
      mapOf(
        "position" to p.currentPosition.toDouble(),
        "duration" to (if (p.duration > 0) p.duration.toDouble() else 0.0),
        "index" to p.currentMediaItemIndex,
        "kind" to currentKind(),
        "buffered" to p.bufferedPosition.toDouble()
      )
    )
  }
  // endregion

  private val listener = object : Player.Listener {
    override fun onIsPlayingChanged(isPlaying: Boolean) {
      if (isPlaying) {
        errorStreak = 0
        startTicker()
      }
      PlayerHolder.peek()?.let { emitIntent(it) }
    }

    override fun onPlayWhenReadyChanged(playWhenReady: Boolean, reason: Int) {
      PlayerHolder.peek()?.let {
        emitIntent(it)
        emitProgress(it)
      }
    }

    override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
      val p = PlayerHolder.peek() ?: return
      if (sleepAtEndOfTrack && reason == Player.MEDIA_ITEM_TRANSITION_REASON_AUTO) {
        sleepAtEndOfTrack = false
        p.pause()
        safeSend("onSleepTimerEnd", emptyMap())
      }
      safeSend(
        "onTrackChange",
        mapOf(
          "index" to p.currentMediaItemIndex,
          "id" to (mediaItem?.mediaId ?: ""),
          "kind" to kindOf(mediaItem),
          "auto" to (reason == Player.MEDIA_ITEM_TRANSITION_REASON_AUTO || reason == Player.MEDIA_ITEM_TRANSITION_REASON_REPEAT)
        )
      )
      emitProgress(p)
      if (mediaItem != null) loadArtworkFor(p.currentMediaItemIndex, mediaItem)
    }

    override fun onPlaybackStateChanged(playbackState: Int) {
      val p = PlayerHolder.peek() ?: return
      if (playbackState == Player.STATE_ENDED) {
        if (sleepAtEndOfTrack) {
          sleepAtEndOfTrack = false
          safeSend("onSleepTimerEnd", emptyMap())
        }
        safeSend("onQueueEnded", mapOf("kind" to currentKind()))
      }
      if (playbackState == Player.STATE_READY) emitProgress(p)
      safeSend("onBuffering", mapOf("buffering" to (playbackState == Player.STATE_BUFFERING), "kind" to currentKind()))
      emitIntent(p)
    }

    override fun onPlayerError(error: PlaybackException) {
      val p = PlayerHolder.peek() ?: return
      val kind = currentKind()
      val code = error.errorCode
      // Decoder / container problems are worth retrying with the software engine.
      val fallback = code in 3000..5999
      safeSend(
        "onError",
        mapOf(
          "message" to (error.message ?: "Lecture impossible"),
          "code" to code,
          "codeName" to error.errorCodeName,
          "index" to p.currentMediaItemIndex,
          "kind" to kind,
          "fallback" to fallback,
          "position" to p.currentPosition.toDouble()
        )
      )
      if (kind == "video") return
      errorStreak++
      // Skip unreadable files instead of stopping the whole queue.
      if (errorStreak < 5 && p.hasNextMediaItem()) {
        p.seekToNextMediaItem()
        p.prepare()
        p.play()
      }
    }

    override fun onAudioSessionIdChanged(audioSessionId: Int) {
      effects.attach(audioSessionId)
      if (PlayerHolder.boostMb > 0) PlayerHolder.setBoost(PlayerHolder.boostMb)
    }

    override fun onTracksChanged(tracks: Tracks) {
      if (currentKind() != "video") return
      safeSend("onTracks", describeTracks(tracks))
    }

    override fun onVideoSizeChanged(videoSize: VideoSize) {
      if (videoSize.width > 0 && videoSize.height > 0) {
        safeSend(
          "onVideoSize",
          mapOf("width" to (videoSize.width * videoSize.pixelWidthHeightRatio).toInt(), "height" to videoSize.height, "engine" to "exo")
        )
      }
    }
  }

  private fun describeTracks(tracks: Tracks): Map<String, Any?> {
    val audio = ArrayList<Map<String, Any?>>()
    val text = ArrayList<Map<String, Any?>>()
    var videoPresent = false
    var videoSupported = false
    var audioPresent = false
    var audioSupported = false
    var videoInfo: Map<String, Any?>? = null
    tracks.groups.forEachIndexed { g, group ->
      for (i in 0 until group.length) {
        val f = group.getTrackFormat(i)
        val supported = group.isTrackSupported(i)
        val selected = group.isTrackSelected(i)
        when (group.type) {
          C.TRACK_TYPE_VIDEO -> {
            videoPresent = true
            if (supported) videoSupported = true
            if (selected || videoInfo == null) {
              videoInfo = mapOf(
                "codec" to (f.codecs ?: f.sampleMimeType),
                "mime" to f.sampleMimeType,
                "width" to f.width,
                "height" to f.height,
                "frameRate" to f.frameRate.toDouble(),
                "bitrate" to f.bitrate,
                "hdr" to (f.colorInfo?.colorTransfer == C.COLOR_TRANSFER_ST2084 || f.colorInfo?.colorTransfer == C.COLOR_TRANSFER_HLG),
                "supported" to supported
              )
            }
          }
          C.TRACK_TYPE_AUDIO -> {
            audioPresent = true
            if (supported) audioSupported = true
            audio.add(
              mapOf(
                "id" to "$g:$i",
                "label" to trackLabel(f.label, f.language, "${f.channelCount}ch ${f.sampleMimeType?.substringAfter('/') ?: ""}"),
                "language" to f.language,
                "selected" to selected,
                "supported" to supported,
                "codec" to f.sampleMimeType,
                "channels" to f.channelCount
              )
            )
          }
          C.TRACK_TYPE_TEXT -> text.add(
            mapOf(
              "id" to "$g:$i",
              "label" to trackLabel(f.label, f.language, "Piste ${text.size + 1}"),
              "language" to f.language,
              "selected" to selected,
              "supported" to supported
            )
          )
        }
      }
    }
    return mapOf(
      "audio" to audio,
      "text" to text,
      "video" to videoInfo,
      "videoUnsupported" to (videoPresent && !videoSupported),
      "audioUnsupported" to (audioPresent && !audioSupported)
    )
  }

  private fun trackLabel(label: String?, language: String?, fallback: String): String {
    if (!label.isNullOrBlank()) return label
    if (!language.isNullOrBlank() && language != "und") {
      return try {
        java.util.Locale.forLanguageTag(language).getDisplayLanguage(java.util.Locale.FRENCH).replaceFirstChar { it.uppercase() }
      } catch (_: Throwable) {
        language
      }
    }
    return fallback
  }

  private fun loadArtworkFor(index: Int, item: MediaItem) {
    if (item.mediaMetadata.artworkUri != null || kindOf(item) == "video") return
    val trackId = item.mediaId.toLongOrNull() ?: return
    val albumId = item.mediaMetadata.extras?.getString("albumId")?.toLongOrNull() ?: 0L
    val ctx = context
    artworkExecutor.execute {
      val art = MediaScanner.artwork(ctx, trackId, albumId, 512) ?: return@execute
      mainHandler.post {
        val p = PlayerHolder.peek() ?: return@post
        if (index >= p.mediaItemCount) return@post
        val current = p.getMediaItemAt(index)
        if (current.mediaId != item.mediaId || current.mediaMetadata.artworkUri != null) return@post
        val updated = current.buildUpon()
          .setMediaMetadata(current.mediaMetadata.buildUpon().setArtworkUri(Uri.parse(art)).build())
          .build()
        try {
          p.replaceMediaItem(index, updated)
        } catch (_: Throwable) {
        }
      }
    }
  }

  private fun toMediaItem(raw: Map<String, Any?>): MediaItem {
    val id = raw["id"]?.toString() ?: ""
    val uri = raw["uri"]?.toString() ?: ""
    val extras = android.os.Bundle().apply {
      putString("albumId", raw["albumId"]?.toString() ?: "")
      putString("kind", raw["kind"]?.toString() ?: "audio")
    }
    val meta = MediaMetadata.Builder()
      .setTitle(raw["title"]?.toString())
      .setArtist(raw["artist"]?.toString())
      .setAlbumTitle(raw["album"]?.toString())
      .setExtras(extras)
    (raw["artwork"] as? String)?.takeIf { it.isNotBlank() }?.let { meta.setArtworkUri(Uri.parse(it)) }
    return MediaItem.Builder()
      .setMediaId(id)
      .setUri(uri)
      .setMediaMetadata(meta.build())
      .build()
  }

  private fun state(p: ExoPlayer): Map<String, Any?> = mapOf(
    "index" to p.currentMediaItemIndex,
    "count" to p.mediaItemCount,
    "position" to p.currentPosition.toDouble(),
    "duration" to (if (p.duration > 0) p.duration.toDouble() else 0.0),
    "isPlaying" to intentOf(p),
    "playWhenReady" to p.playWhenReady,
    "id" to (p.currentMediaItem?.mediaId ?: "")
  )

  override fun definition() = ModuleDefinition {
    Name("MPlayerCore")

    Events(
      "onTrackChange", "onPlayingChange", "onProgress", "onQueueEnded", "onError", "onSleepTimerEnd",
      "onBuffering", "onTracks", "onVideoSize", "onVlcState", "onVlcProgress", "onVlcError", "onPipChange"
    )

    OnCreate {
      VlcEngine.emit = { name, body -> safeSend(name, body) }
      mainHandler.post {
        try {
          player()
        } catch (_: Throwable) {
        }
      }
    }

    OnDestroy {
      mainHandler.post {
        mainHandler.removeCallbacks(ticker)
        PlayerHolder.peek()?.removeListener(listener)
        listenerAttached = false
        controllerFuture?.let { MediaController.releaseFuture(it) }
        controllerFuture = null
      }
    }

    // region library
    AsyncFunction("queryTracks") { minDurationMs: Double ->
      MediaScanner.queryTracks(context, minDurationMs.toLong())
    }

    AsyncFunction("getArtwork") { trackId: String, albumId: String, size: Int ->
      MediaScanner.artwork(context, trackId.toLongOrNull() ?: 0L, albumId.toLongOrNull() ?: 0L, size)
    }

    AsyncFunction("getPalette") { trackId: String, albumId: String ->
      MediaScanner.palette(context, trackId.toLongOrNull() ?: 0L, albumId.toLongOrNull() ?: 0L)
    }

    AsyncFunction("getVolume") {
      val am = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
      val max = am.getStreamMaxVolume(AudioManager.STREAM_MUSIC).coerceAtLeast(1)
      am.getStreamVolume(AudioManager.STREAM_MUSIC).toDouble() / max
    }

    AsyncFunction("setVolume") { value: Double ->
      val am = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
      val max = am.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
      am.setStreamVolume(AudioManager.STREAM_MUSIC, (value.coerceIn(0.0, 1.0) * max).toInt(), 0)
    }

    AsyncFunction("clearArtworkMisses") {
      MediaScanner.clearArtworkMisses(context)
    }

    AsyncFunction("shareTrack") { uri: String, title: String ->
      val send = Intent(Intent.ACTION_SEND).apply {
        type = "audio/*"
        putExtra(Intent.EXTRA_STREAM, Uri.parse(uri))
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }
      val chooser = Intent.createChooser(send, title).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }
      val activity = appContext.currentActivity
      if (activity != null) activity.startActivity(chooser) else context.startActivity(chooser)
    }.runOnQueue(Queues.MAIN)
    // endregion

    // region queue & transport
    AsyncFunction("setQueue") { items: List<Map<String, Any?>>, startIndex: Int, startPositionMs: Double, playWhenReady: Boolean ->
      val p = player()
      val mediaItems = items.map { toMediaItem(it) }
      if (mediaItems.isEmpty()) {
        p.stop()
        p.clearMediaItems()
        return@AsyncFunction state(p)
      }
      val index = startIndex.coerceIn(0, mediaItems.size - 1)
      p.setMediaItems(mediaItems, index, startPositionMs.toLong().coerceAtLeast(0L))
      p.prepare()
      p.playWhenReady = playWhenReady
      errorStreak = 0
      startTicker()
      state(p)
    }.runOnQueue(Queues.MAIN)

    // Replaces every queue item except the one currently playing, without interrupting it.
    AsyncFunction("replaceQueueKeepingCurrent") { items: List<Map<String, Any?>>, currentIndex: Int ->
      val p = player()
      val count = p.mediaItemCount
      if (count == 0 || currentIndex !in items.indices) {
        return@AsyncFunction state(p)
      }
      val playingIndex = p.currentMediaItemIndex
      if (playingIndex + 1 < count) p.removeMediaItems(playingIndex + 1, count)
      if (playingIndex > 0) p.removeMediaItems(0, playingIndex)
      val before = items.subList(0, currentIndex).map { toMediaItem(it) }
      val after = items.subList(currentIndex + 1, items.size).map { toMediaItem(it) }
      if (before.isNotEmpty()) p.addMediaItems(0, before)
      if (after.isNotEmpty()) p.addMediaItems(after)
      state(p)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("insertItems") { index: Int, items: List<Map<String, Any?>> ->
      val p = player()
      val at = index.coerceIn(0, p.mediaItemCount)
      p.addMediaItems(at, items.map { toMediaItem(it) })
      state(p)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("removeItem") { index: Int ->
      val p = player()
      if (index in 0 until p.mediaItemCount) p.removeMediaItem(index)
      state(p)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("moveItem") { from: Int, to: Int ->
      val p = player()
      val count = p.mediaItemCount
      if (from in 0 until count && to in 0 until count && from != to) p.moveMediaItem(from, to)
      state(p)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("play") {
      val p = player()
      if (p.playbackState == Player.STATE_IDLE) p.prepare()
      if (p.playbackState == Player.STATE_ENDED) p.seekTo(0, 0)
      p.play()
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("pause") {
      player().pause()
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("next") {
      val p = player()
      if (p.hasNextMediaItem()) p.seekToNextMediaItem() else if (p.mediaItemCount > 0) p.seekTo(0, 0)
      if (p.playbackState == Player.STATE_IDLE) p.prepare()
      p.play()
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("previous") {
      val p = player()
      p.seekToPrevious()
      if (p.playbackState == Player.STATE_IDLE) p.prepare()
      p.play()
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("skipTo") { index: Int, play: Boolean ->
      val p = player()
      if (index in 0 until p.mediaItemCount) {
        p.seekTo(index, 0)
        if (p.playbackState == Player.STATE_IDLE) p.prepare()
        if (play) p.play()
      }
      state(p)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("seekTo") { positionMs: Double ->
      val p = player()
      p.seekTo(positionMs.toLong().coerceAtLeast(0L))
      emitProgress(p)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("getState") {
      state(player())
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("stop") {
      val p = player()
      p.stop()
      p.clearMediaItems()
    }.runOnQueue(Queues.MAIN)
    // endregion

    // region options
    AsyncFunction("setRepeatMode") { mode: Int ->
      player().repeatMode = when (mode) {
        1 -> Player.REPEAT_MODE_ONE
        2 -> Player.REPEAT_MODE_ALL
        else -> Player.REPEAT_MODE_OFF
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("setSpeed") { speed: Double ->
      player().setPlaybackSpeed(speed.toFloat().coerceIn(0.25f, 3f))
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("setSkipSilence") { enabled: Boolean ->
      player().skipSilenceEnabled = enabled
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("setPauseOnNoisy") { enabled: Boolean ->
      player().setHandleAudioBecomingNoisy(enabled)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("setFade") { ms: Double ->
      fadeMs = ms.toLong().coerceAtLeast(0L)
      val p = player()
      if (fadeMs == 0L) p.volume = 1f
      startTicker()
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("setSleepTimer") { ms: Double, endOfTrack: Boolean ->
      player()
      sleepAtEndOfTrack = endOfTrack
      sleepDeadline = if (!endOfTrack && ms > 0) System.currentTimeMillis() + ms.toLong() else 0L
      startTicker()
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("getSleepTimer") {
      mapOf(
        "remaining" to (if (sleepDeadline > 0) (sleepDeadline - System.currentTimeMillis()).coerceAtLeast(0L).toDouble() else 0.0),
        "endOfTrack" to sleepAtEndOfTrack
      )
    }.runOnQueue(Queues.MAIN)
    // endregion

    // region effects
    AsyncFunction("getEqualizer") {
      val p = player()
      effects.attach(p.audioSessionId)
      effects.describe()
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("setEqualizerEnabled") { enabled: Boolean ->
      effects.attach(player().audioSessionId)
      effects.setEnabled(enabled)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("setBandLevel") { band: Int, level: Int ->
      effects.attach(player().audioSessionId)
      effects.setBandLevel(band, level)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("usePreset") { preset: Int ->
      effects.attach(player().audioSessionId)
      effects.usePreset(preset)
      effects.describe()
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("setBassBoost") { strength: Int ->
      effects.attach(player().audioSessionId)
      effects.setBassBoost(strength)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("setVirtualizer") { strength: Int ->
      effects.attach(player().audioSessionId)
      effects.setVirtualizer(strength)
    }.runOnQueue(Queues.MAIN)
    // endregion

    // region video library & tools
    AsyncFunction("queryVideos") {
      MediaLibrary.queryVideos(context)
    }

    AsyncFunction("getVideoThumbnail") { idOrUri: String, width: Int ->
      MediaLibrary.videoThumbnail(context, idOrUri, width)
    }

    AsyncFunction("getFrameAt") { uri: String, positionMs: Double, width: Int, exact: Boolean ->
      MediaLibrary.frameAt(context, uri, positionMs.toLong(), width, exact)
    }

    AsyncFunction("releaseFrames") {
      MediaLibrary.releaseRetriever()
      MediaLibrary.clearFrames(context)
    }

    AsyncFunction("probe") { uri: String ->
      MediaLibrary.probe(context, uri)
    }

    AsyncFunction("describeUri") { uri: String ->
      MediaLibrary.describeUri(context, uri)
    }

    AsyncFunction("persistUri") { uri: String ->
      try {
        context.contentResolver.takePersistableUriPermission(Uri.parse(uri), Intent.FLAG_GRANT_READ_URI_PERMISSION)
        true
      } catch (_: Throwable) {
        false
      }
    }

    AsyncFunction("queryDocuments") {
      MediaLibrary.queryDocuments(context)
    }

    AsyncFunction("hasAllFilesAccess") {
      MediaLibrary.hasAllFilesAccess()
    }

    AsyncFunction("requestAllFilesAccess") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        val activity = appContext.currentActivity
        val intent = Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION, Uri.parse("package:${context.packageName}"))
        try {
          if (activity != null) activity.startActivity(intent) else context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        } catch (_: Throwable) {
          val any = Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          context.startActivity(any)
        }
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("shareFile") { uri: String, mime: String, title: String ->
      val parsed = Uri.parse(uri)
      val shareUri = if (parsed.scheme == "file") {
        try {
          androidx.core.content.FileProvider.getUriForFile(context, "${context.packageName}.mplayer.files", java.io.File(parsed.path ?: ""))
        } catch (_: Throwable) {
          parsed
        }
      } else parsed
      val send = Intent(Intent.ACTION_SEND).apply {
        type = mime
        putExtra(Intent.EXTRA_STREAM, shareUri)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }
      val chooser = Intent.createChooser(send, title).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION)
      val activity = appContext.currentActivity
      if (activity != null) activity.startActivity(chooser) else context.startActivity(chooser)
    }.runOnQueue(Queues.MAIN)
    // endregion

    // region exoplayer video helpers
    AsyncFunction("setSeekMode") { exact: Boolean ->
      player().setSeekParameters(if (exact) SeekParameters.EXACT else SeekParameters.CLOSEST_SYNC)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("stepFrame") { forward: Boolean ->
      val p = player()
      p.pause()
      val fps = p.videoFormat?.frameRate?.takeIf { it > 1f } ?: 30f
      val step = (1000f / fps).toLong().coerceAtLeast(1)
      p.setSeekParameters(SeekParameters.EXACT)
      p.seekTo((p.currentPosition + if (forward) step else -step).coerceAtLeast(0))
      emitProgress(p)
      p.currentPosition.toDouble()
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("selectTrack") { type: String, id: String? ->
      val p = player()
      val trackType = if (type == "audio") C.TRACK_TYPE_AUDIO else C.TRACK_TYPE_TEXT
      val builder = p.trackSelectionParameters.buildUpon()
      if (id == null) {
        builder.setTrackTypeDisabled(trackType, true)
      } else {
        val parts = id.split(":")
        val g = parts.getOrNull(0)?.toIntOrNull()
        val i = parts.getOrNull(1)?.toIntOrNull()
        val groups = p.currentTracks.groups
        if (g != null && i != null && g < groups.size) {
          builder.setTrackTypeDisabled(trackType, false)
          builder.setOverrideForType(TrackSelectionOverride(groups[g].mediaTrackGroup, i))
        }
      }
      p.trackSelectionParameters = builder.build()
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("getTracks") {
      describeTracks(player().currentTracks)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("setVolumeBoost") { mb: Int ->
      player()
      PlayerHolder.setBoost(mb)
      VlcEngine.setVolume(100 + mb / 15)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("captureFrame") { name: String ->
      val view = MPlayerVideoView.active?.get() ?: return@AsyncFunction null
      val bmp = view.captureBitmap() ?: return@AsyncFunction null
      val uri = MPlayerVideoView.saveToGallery(context, bmp, name)
      bmp.recycle()
      uri
    }.runOnQueue(Queues.MAIN)
    // endregion

    // region vlc engine
    AsyncFunction("vlcOpen") { uri: String, startMs: Double, play: Boolean ->
      // Stop the shared player so the two engines never play at the same time.
      PlayerHolder.peek()?.let { if (kindOf(it.currentMediaItem) == "video") it.pause() }
      VlcEngine.open(context, uri, startMs.toLong(), play)
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("vlcPlay") { VlcEngine.play() }.runOnQueue(Queues.MAIN)
    AsyncFunction("vlcPause") { VlcEngine.pause() }.runOnQueue(Queues.MAIN)
    AsyncFunction("vlcSeek") { ms: Double, fast: Boolean -> VlcEngine.seek(ms.toLong(), fast) }.runOnQueue(Queues.MAIN)
    AsyncFunction("vlcSetRate") { rate: Double -> VlcEngine.setRate(rate.toFloat()) }.runOnQueue(Queues.MAIN)
    AsyncFunction("vlcTracks") { VlcEngine.tracks() }.runOnQueue(Queues.MAIN)
    AsyncFunction("vlcSelectAudio") { id: Int -> VlcEngine.selectAudio(id) }.runOnQueue(Queues.MAIN)
    AsyncFunction("vlcSelectText") { id: Int -> VlcEngine.selectText(id) }.runOnQueue(Queues.MAIN)
    AsyncFunction("vlcStop") { VlcEngine.stop() }.runOnQueue(Queues.MAIN)
    AsyncFunction("vlcState") {
      mapOf("position" to VlcEngine.time().toDouble(), "duration" to VlcEngine.length().toDouble(), "isPlaying" to VlcEngine.isPlaying())
    }.runOnQueue(Queues.MAIN)
    // endregion

    // region screen
    AsyncFunction("setBrightness") { value: Double ->
      val activity = appContext.currentActivity ?: return@AsyncFunction
      val lp = activity.window.attributes
      lp.screenBrightness = if (value < 0) WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE else value.toFloat().coerceIn(0.01f, 1f)
      activity.window.attributes = lp
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("getBrightness") {
      val activity = appContext.currentActivity
      val own = activity?.window?.attributes?.screenBrightness ?: -1f
      if (own >= 0f) own.toDouble() else try {
        Settings.System.getInt(context.contentResolver, Settings.System.SCREEN_BRIGHTNESS) / 255.0
      } catch (_: Throwable) {
        0.5
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("setKeepAwake") { on: Boolean ->
      val window = appContext.currentActivity?.window ?: return@AsyncFunction
      if (on) window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON) else window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("setImmersive") { on: Boolean ->
      val activity = appContext.currentActivity ?: return@AsyncFunction
      val window = activity.window
      val controller = WindowCompat.getInsetsController(window, window.decorView)
      if (on) {
        controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        controller.hide(WindowInsetsCompat.Type.systemBars())
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
          val lp = window.attributes
          lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
          window.attributes = lp
        }
      } else {
        controller.show(WindowInsetsCompat.Type.systemBars())
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("setOrientation") { mode: String ->
      val activity = appContext.currentActivity ?: return@AsyncFunction
      activity.requestedOrientation = when (mode) {
        "landscape" -> ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
        "portrait" -> ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
        "sensor" -> ActivityInfo.SCREEN_ORIENTATION_FULL_SENSOR
        "locked" -> ActivityInfo.SCREEN_ORIENTATION_LOCKED
        else -> ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("enterPip") { width: Int, height: Int ->
      val activity = appContext.currentActivity ?: return@AsyncFunction false
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return@AsyncFunction false
      try {
        activity.enterPictureInPictureMode(pipParams(width, height, false))
      } catch (_: Throwable) {
        false
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("setAutoPip") { enabled: Boolean, width: Int, height: Int ->
      val activity = appContext.currentActivity ?: return@AsyncFunction
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        try {
          activity.setPictureInPictureParams(pipParams(width, height, enabled))
        } catch (_: Throwable) {
        }
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("isInPip") {
      val activity = appContext.currentActivity
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) activity?.isInPictureInPictureMode ?: false else false
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("getSystemVolume") {
      val am = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
      mapOf("current" to am.getStreamVolume(AudioManager.STREAM_MUSIC), "max" to am.getStreamMaxVolume(AudioManager.STREAM_MUSIC))
    }

    AsyncFunction("setSystemVolumeStep") { step: Int ->
      val am = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
      am.setStreamVolume(AudioManager.STREAM_MUSIC, step.coerceIn(0, am.getStreamMaxVolume(AudioManager.STREAM_MUSIC)), 0)
    }
    // endregion

    // region pdf
    AsyncFunction("pdfOpen") { uri: String ->
      PdfEngine.open(context, uri)
    }
    AsyncFunction("pdfRender") { uri: String, page: Int, width: Int, mode: Int ->
      PdfEngine.render(context, uri, page, width, mode)
    }
    AsyncFunction("pdfThumbnail") { uri: String, width: Int ->
      PdfEngine.thumbnail(context, uri, width)
    }
    AsyncFunction("pdfClose") { uri: String ->
      PdfEngine.close(uri)
    }
    AsyncFunction("pdfClearCache") {
      PdfEngine.clearCache(context)
    }
    // endregion

    View(MPlayerVideoView::class) {
      Prop("engine") { view: MPlayerVideoView, engine: String? -> view.setEngine(engine ?: "none") }
      Prop("resizeMode") { view: MPlayerVideoView, mode: String? -> view.setResizeMode(mode ?: "fit") }
      Prop("subtitleScale") { view: MPlayerVideoView, scale: Float? -> view.setSubtitleScale(scale ?: 1f) }
      Prop("subtitleStyle") { view: MPlayerVideoView, style: String? -> view.setSubtitleStyle(style ?: "shadow") }
      OnViewDestroys { view: MPlayerVideoView -> view.release() }
    }
  }

  private fun pipParams(width: Int, height: Int, auto: Boolean): android.app.PictureInPictureParams {
    val w = width.coerceAtLeast(1)
    val h = height.coerceAtLeast(1)
    // Android only accepts ratios between 1:2.39 and 2.39:1.
    val ratio = (w.toFloat() / h).coerceIn(0.42f, 2.39f)
    val rational = android.util.Rational((ratio * 1000).toInt(), 1000)
    val builder = android.app.PictureInPictureParams.Builder().setAspectRatio(rational)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      builder.setAutoEnterEnabled(auto)
      builder.setSeamlessResizeEnabled(true)
    }
    return builder.build()
  }
}
