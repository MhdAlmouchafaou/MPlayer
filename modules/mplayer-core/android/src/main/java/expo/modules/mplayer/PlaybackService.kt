@file:OptIn(UnstableApi::class)

package expo.modules.mplayer

import android.app.PendingIntent
import android.content.Intent
import androidx.annotation.OptIn
import androidx.media3.common.util.UnstableApi
import androidx.media3.session.DefaultMediaNotificationProvider
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService

/**
 * Foreground media service: keeps playback alive outside the app and exposes the
 * media session to the notification shade, the lock screen, headsets and Bluetooth.
 */
class PlaybackService : MediaSessionService() {
  private var session: MediaSession? = null

  override fun onCreate() {
    super.onCreate()
    val player = PlayerHolder.get(this)

    val builder = MediaSession.Builder(this, player).setId("mplayer")
    packageManager.getLaunchIntentForPackage(packageName)?.let { launch ->
      launch.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
      val pending = PendingIntent.getActivity(
        this,
        0,
        launch,
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
      )
      builder.setSessionActivity(pending)
    }
    session = builder.build()

    val provider = DefaultMediaNotificationProvider.Builder(this)
      .setChannelName(R.string.mplayer_channel_name)
      .build()
    provider.setSmallIcon(R.drawable.mplayer_ic_notification)
    setMediaNotificationProvider(provider)
  }

  override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? = session

  override fun onTaskRemoved(rootIntent: Intent?) {
    val player = session?.player
    if (player == null || !player.playWhenReady || player.mediaItemCount == 0) {
      stopSelf()
    }
  }

  override fun onDestroy() {
    session?.release()
    session = null
    super.onDestroy()
  }
}
